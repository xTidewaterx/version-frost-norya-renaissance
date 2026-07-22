import { NextResponse } from "next/server";
import { verifyStripeWebhook, stripe } from "@/lib/stripe";
import {
  sendEmail,
  getBuyerConfirmationHtml,
  getSellerNotificationHtml,
} from "@/lib/sendEmail";

// Stripe needs the RAW request body to verify the signature, so we must
// disable Next.js body parsing for this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback recipient used when a PaymentIntent is missing the buyer/seller email.
// Override via FALLBACK_EMAIL in .env.local if you prefer.
const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL || "johan12ab@gmail.com";

// In-memory guard to avoid duplicate emails when both
// checkout.session.completed and payment_intent.succeeded fire for the same order.
const sentPaymentIntents = new Set();

export async function GET() {
  return new Response("Webhook endpoint is alive!", { status: 200 });
}

export async function POST(req) {
  const signature = req.headers.get("stripe-signature");

  // Read the raw body as text — do NOT use req.json(), it would mutate the
  // stream and break Stripe's signature verification.
  const rawBody = await req.text();

  let event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Log every verified event so you can confirm what Stripe is firing.
  console.log(`🔔 [webhook] event received: ${event.type} (id: ${event.id})`);

  // Handle the events we care about.
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const paymentIntentId = session.payment_intent;
      const buyerEmail = session.customer_details?.email || FALLBACK_EMAIL;

      let sellerEmail = FALLBACK_EMAIL;
      let orderId = paymentIntentId || `order_${session.id}`;
      let amount = 0;
      let currency = "nok";
      let items = [];

      // Retrieve the linked PaymentIntent so we can read metadata
      // (sellerEmail, orderId, items) that we stored on creation.
      if (paymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          sellerEmail = pi.metadata?.sellerEmail || FALLBACK_EMAIL;
          orderId = pi.metadata?.orderId || paymentIntentId;
          amount = pi.amount || 0;
          currency = pi.currency || "nok";
          if (pi.metadata?.items) {
            try {
              items = JSON.parse(pi.metadata.items);
            } catch {
              items = [];
            }
          }
        } catch (err) {
          console.error("❌ [webhook] failed to retrieve PaymentIntent:", err.message);
        }
      }

      const usedFallback = !session.customer_details?.email;
      console.log(
        `🔔 [webhook][checkout.session] buyer_email=${buyerEmail} | fallback=${usedFallback} | orderId=${orderId}`
      );
      console.log("🔔 [webhook] full session object:", JSON.stringify(session, null, 2));

      if (!sentPaymentIntents.has(orderId)) {
        sentPaymentIntents.add(orderId);
        try {
          await Promise.all([
            sendEmail({
              to: buyerEmail,
              subject: "Your NORYA order confirmation",
              html: getBuyerConfirmationHtml({ orderId, amount, currency }),
            }),
            sendEmail({
              to: sellerEmail,
              subject: `New order received — ${orderId}`,
              html: getSellerNotificationHtml({
                orderId,
                amount,
                currency,
                buyerEmail,
                items,
              }),
            }),
          ]);
          console.log(`🎉 [email] SENT via checkout.session.completed for ${orderId}`);
        } catch (err) {
          console.error("❌ [email] FAILED to send order emails:", err);
        }
      } else {
        console.log(`ℹ️ [webhook] duplicate checkout.session.completed suppressed for ${orderId}`);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId || paymentIntent.id;

      if (sentPaymentIntents.has(orderId)) {
        console.log(`ℹ️ [webhook] duplicate payment_intent.succeeded suppressed for ${orderId}`);
        break;
      }

      const buyerEmail =
        paymentIntent.metadata?.buyerEmail ||
        paymentIntent.receipt_email ||
        FALLBACK_EMAIL;
      const sellerEmail = paymentIntent.metadata?.sellerEmail || FALLBACK_EMAIL;
      const amount = paymentIntent.amount;
      const currency = paymentIntent.currency;
      const usedFallback =
        !paymentIntent.metadata?.buyerEmail && !paymentIntent.receipt_email;

      console.log(
        `🔔 [webhook] buyer_email=${buyerEmail} | fallback=${usedFallback} | orderId=${orderId}`
      );
      console.log("🔔 [webhook] full paymentIntent object:", JSON.stringify(paymentIntent, null, 2));

      if (!paymentIntent.metadata?.buyerEmail && !paymentIntent.receipt_email) {
        console.warn(`⚠️ [email] buyer email missing → using fallback ${FALLBACK_EMAIL}`);
      }
      if (!paymentIntent.metadata?.sellerEmail) {
        console.warn(`⚠️ [email] seller email missing → using fallback ${FALLBACK_EMAIL}`);
      }

      console.log(
        `💳 [payment] succeeded | orderId: ${orderId} | buyer: ${buyerEmail} | seller: ${sellerEmail}`
      );

      sentPaymentIntents.add(orderId);
      try {
        await Promise.all([
          sendEmail({
            to: buyerEmail,
            subject: "Your NORYA order confirmation",
            html: getBuyerConfirmationHtml({ orderId, amount, currency }),
          }),
          sendEmail({
            to: sellerEmail,
            subject: `New order received — ${orderId}`,
            html: getSellerNotificationHtml({
              orderId,
              amount,
              currency,
              buyerEmail,
              items: paymentIntent.metadata?.items
                ? JSON.parse(paymentIntent.metadata.items)
                : [],
            }),
          }),
        ]);
        console.log(`🎉 [email] ALL SENT for order ${orderId}`);
      } catch (err) {
        console.error("❌ [email] FAILED to send order emails:", err);
      }
      break;
    }

    // Add other event types here (e.g. payment_intent.payment_failed).

    default:
      console.log(`ℹ️ [webhook] unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
