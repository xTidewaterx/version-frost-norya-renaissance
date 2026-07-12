import { NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/stripe";
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
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;

      const buyerEmail = paymentIntent.receipt_email || FALLBACK_EMAIL;
      const sellerEmail = paymentIntent.metadata?.sellerEmail || FALLBACK_EMAIL;
      const orderId = paymentIntent.metadata?.orderId || paymentIntent.id;
      const amount = paymentIntent.amount;
      const currency = paymentIntent.currency;

      // Note which recipients fell back so you can spot missing metadata.
      if (!paymentIntent.receipt_email) {
        console.warn(`⚠️ [email] buyer email missing → using fallback ${FALLBACK_EMAIL}`);
      }
      if (!paymentIntent.metadata?.sellerEmail) {
        console.warn(`⚠️ [email] seller email missing → using fallback ${FALLBACK_EMAIL}`);
      }

      console.log(
        `💳 [payment] succeeded | orderId: ${orderId} | buyer: ${buyerEmail} | seller: ${sellerEmail}`
      );

      // Fire-and-forget the emails but await them so failures are caught and
      // logged. We don't want a single email failure to crash the webhook.
      try {
        const emailTasks = [];

        emailTasks.push(
          sendEmail({
            to: buyerEmail,
            subject: "Your NORYA order confirmation",
            html: getBuyerConfirmationHtml({ orderId, amount, currency }),
          })
        );

        emailTasks.push(
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
          })
        );

        if (emailTasks.length > 0) {
          console.log(`📨 [email] dispatching ${emailTasks.length} email(s) for order ${orderId}...`);
          const results = await Promise.all(emailTasks);
          console.log(
            `🎉 [email] ALL SENT for order ${orderId} | messageIds: ${results.map((r) => r.messageId).join(", ")}`
          );
        } else {
          console.warn(`⚠️ [email] NOTHING SENT for order ${orderId} (no recipient emails available).`);
        }
      } catch (err) {
        // Log but still return 200 so Stripe doesn't retry endlessly.
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
