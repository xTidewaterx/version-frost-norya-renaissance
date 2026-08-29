import { NextResponse } from "next/server";
import { withRateLimit } from "../lib/rateLimit";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const payment_intent = searchParams.get("payment_intent");

    if (!payment_intent) {
      return NextResponse.json({ ok: false, error: "Missing payment_intent" }, { status: 400 });
    }

    const { stripe } = await import("../../../lib/stripe");
    const pi = await stripe.paymentIntents.retrieve(payment_intent);

    if (pi.status === "succeeded") {
      const consignmentNumber = pi.metadata?.consignmentNumber || null;
      const trackingUrl = consignmentNumber
        ? `https://sporing.posten.no/sporing/${encodeURIComponent(consignmentNumber)}`
        : null;
      return NextResponse.json({
        ok: true,
        status: pi.status,
        consignmentNumber,
        trackingUrl,
      });
    }

    const consignmentNumber = pi.metadata?.consignmentNumber || null;
    const trackingUrl = consignmentNumber
      ? `https://sporing.posten.no/sporing/${encodeURIComponent(consignmentNumber)}`
      : null;
    return NextResponse.json({
      ok: false,
      status: pi.status,
      message: "Payment not succeeded yet",
      consignmentNumber,
      trackingUrl,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 500 });
  }
};

export const GET = withRateLimit(20, 60000)(handler);
