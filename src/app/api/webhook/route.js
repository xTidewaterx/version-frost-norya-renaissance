import { NextResponse } from "next/server";
import { verifyStripeWebhook, stripe } from "@/lib/stripe";
import {
  sendEmail,
  getBuyerConfirmationHtml,
  getSellerNotificationHtml,
} from "@/lib/sendEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL || "johan12ab@gmail.com";

const sentPaymentIntents = new Set();

const BOOKING_URL = "/api/book-shipment";
const MARKETPLACE_SENDER = {
  name: "NORYA Marketplace AS",
  address: {
    street: "Storgata 1",
    streetNumber: "1",
    postalCode: "0155",
    city: "OSLO",
    countryCode: "NO",
  },
};

async function tryBookShipment(paymentIntent) {
  if (paymentIntent.metadata?.consignmentNumber) {
    return paymentIntent.metadata.consignmentNumber;
  }

  const shippingMeta = paymentIntent.metadata?.shipping;
  if (!shippingMeta) {
    console.log("ℹ️ [webhook] no shipping metadata, skipping shipment booking");
    return null;
  }

  let shipping;
  try {
    shipping = typeof shippingMeta === "string" ? JSON.parse(shippingMeta) : shippingMeta;
  } catch {
    console.warn("⚠️ [webhook] failed to parse shipping metadata");
    return null;
  }

  const customer = shipping.customerData || {};
  const topAddress = {
    street: shipping.address || "",
    streetNumber: "",
    postalCode: shipping.postalCode || "",
    city: shipping.city || "",
    country: shipping.country || "NO",
  };

  const pickup = shipping.pickupPointData || shipping.pickupPoint || null;
  const pickupAddress = pickup?.address || {};
  const pickupName = pickup?.name || "";

  const name = customer.name || pickupName || shipping.name || "";
  const email = customer.email || paymentIntent.metadata?.buyerEmail || "";
  const street = customer.street || topAddress.street || pickupAddress.street || "";
  const streetNumber = customer.streetNumber || topAddress.streetNumber || pickupAddress.streetNumber || "";
  const postalCode = customer.postcode || topAddress.postalCode || shipping.postalCode || pickupAddress.postalCode || "";
  const city = customer.city || topAddress.city || shipping.city || pickupAddress.city || "";
  const country = customer.country || topAddress.country || pickupAddress.countryCode || "NO";

  if (!email) {
    console.warn("⚠️ [webhook] missing email for booking, skipping");
    return null;
  }

 // Bring consumer product codes
const BRING_MAIN_PRODUCT = "3622";        // Norgespakke Liten
const BRING_PICKUP_SERVICE = "1073";      // Henting (PickUp)

// Determine if this shipment uses a pickup point
const isPickupPoint = Boolean(pickup);

// Determine if this shipment is PickUp (henting i postkasse)
const isMailboxPickup = shipping.pickupPointType === "MAILBOX" || shipping.id === "MAILBOX";

// Build Bring product block
const product = {
  id: BRING_MAIN_PRODUCT,
  customerNumber: process.env.BRING_CUSTOMER_NUMBER || "YOUR_CUSTOMER_NUMBER",
  ...(isPickupPoint || isMailboxPickup
    ? { additionalServices: [{ id: BRING_PICKUP_SERVICE }] }
    : {})
};

// Package dimensions
const weightInKg = Number(process.env.DEFAULT_PACKAGE_WEIGHT_KG || 2);
const lengthInCm = Number(process.env.DEFAULT_PACKAGE_LENGTH_CM || 30);
const widthInCm = Number(process.env.DEFAULT_PACKAGE_WIDTH_CM || 20);
const heightInCm = Number(process.env.DEFAULT_PACKAGE_HEIGHT_CM || 10);

// Validate address
const hasRealAddress = street && postalCode && city;

// Build Bring booking payload
const payload = {
  sender: MARKETPLACE_SENDER,

  recipient: {
    name: name || "Test Customer",
    email,
    address: {
      street: hasRealAddress ? street : "Testveien 1",
      streetNumber: hasRealAddress ? streetNumber : "1",
      postalCode: hasRealAddress ? postalCode : "0155",
      city: hasRealAddress ? city : "OSLO",
      countryCode: country,
    },
  },

  product,

  packages: [
    { weightInKg, lengthInCm, widthInCm, heightInCm }
  ],

  pickupPoint: isPickupPoint
    ? {
        id: pickup.id || shipping.id,
        name: pickup.name || shipping.name,
        address: {
          street: pickup.address?.street || shipping.address || "",
          postalCode: pickup.address?.postalCode || shipping.postalCode || "",
          city: pickup.address?.city || shipping.city || "",
          countryCode: pickup.address?.countryCode || country,
        },
      }
    : undefined,

  shippingDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  orderId: paymentIntent.metadata?.orderId || paymentIntent.id,
};

console.log("🚚 [webhook] attempting to book shipment for", payload.orderId);
console.log("🚚 [webhook] booking payload:", JSON.stringify(payload, null, 2));

try {
  const appUrl = process.env.BRING_CLIENT_URL; // MUST be public (ngrok or production)
  const res = await fetch(`${appUrl}${BOOKING_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });


    const data = await res.json();
    if (!res.ok || !data?.consignmentNumber) {
      console.error("❌ [webhook] booking failed:", data);
      return null;
    }

    console.log("✅ [webhook] booked shipment:", data.consignmentNumber, data.trackingUrl);

    try {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...(paymentIntent.metadata || {}),
          consignmentNumber: String(data.consignmentNumber),
        },
      });
      console.log("🔑 [webhook] saved consignmentNumber to PaymentIntent metadata");
    } catch (updateErr) {
      console.warn("⚠️ [webhook] failed to update PaymentIntent metadata:", updateErr.message);
    }

    return String(data.consignmentNumber);
  } catch (err) {
    console.error("❌ [webhook] booking error:", err.message);
    return null;
  }
}

export async function GET() {
  return new Response("Webhook endpoint is alive!", { status: 200 });
}

export async function POST(req) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`🔔 [webhook] event received: ${event.type} (id: ${event.id})`);

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
      let consignmentNumber = null;

      if (paymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          sellerEmail = pi.metadata?.sellerEmail || FALLBACK_EMAIL;
          orderId = pi.metadata?.orderId || paymentIntentId;
          amount = pi.amount || 0;
          currency = pi.currency || "nok";
          consignmentNumber = pi.metadata?.consignmentNumber || null;
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

        let piForBooking = null;
        if (paymentIntentId) {
          try {
            piForBooking = await stripe.paymentIntents.retrieve(paymentIntentId);
          } catch {}
        }

        const effectiveConsignmentNumber =
          consignmentNumber || (piForBooking ? await tryBookShipment(piForBooking) : null);

        try {
          await Promise.all([
            sendEmail({
              to: buyerEmail,
              subject: "Your NORYA order confirmation",
              html: getBuyerConfirmationHtml({
                orderId,
                amount,
                currency,
                consignmentNumber: effectiveConsignmentNumber,
              }),
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
                consignmentNumber: effectiveConsignmentNumber,
              }),
            }),
          ]);

          console.log(`🎉 [email] SENT via checkout.session.completed for ${orderId}`);
        } catch (err) {
          console.error("❌ [email] FAILED to send order emails:", err);
        }

        try {
          const itemsMeta = pi?.metadata?.items || session.metadata?.items;
          if (itemsMeta) {
            const parsedItems = JSON.parse(itemsMeta);
            const sellerGroups = {};
            for (const item of parsedItems) {
              const sid = item.sellerAccountId;
              if (!sid) continue;
              if (!sellerGroups[sid]) sellerGroups[sid] = { amount: 0 };
              sellerGroups[sid].amount += (item.price || 0) * (item.quantity || 1);
            }
            const sellerIds = Object.keys(sellerGroups);
            for (const [sellerId, group] of Object.entries(sellerGroups)) {
              const sellerAmount = Math.round(group.amount * 0.902);
              if (sellerAmount <= 0) continue;
              const existingTransfers = await stripe.transfers.list({
                limit: 1,
                destination: sellerId,
                source_transaction: session.payment_intent,
              });
              if (existingTransfers.data.length === 0) {
                await stripe.transfers.create({
                  amount: sellerAmount,
                  currency: 'nok',
                  destination: sellerId,
                  source_transaction: session.payment_intent,
                  transfer_group: session.id,
                });
              }
            }
            console.log(`💸 [webhook] payouts for order ${orderId}: sellers ${sellerIds.join(', ')}`);
          }
        } catch (transferErr) {
          console.error("❌ [webhook] transfer creation failed:", transferErr.message);
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
      const consignmentNumber = paymentIntent.metadata?.consignmentNumber || null;
      const usedFallback =
        !paymentIntent.metadata?.buyerEmail && !paymentIntent.receipt_email;

      console.log(
        `🔔 [webhook] buyer_email=${buyerEmail} | fallback=${usedFallback} | orderId=${orderId} | tracking=${consignmentNumber || "none"}`
      );
      console.log("🔔 [webhook] full paymentIntent object:", JSON.stringify(paymentIntent, null, 2));

      if (!paymentIntent.metadata?.buyerEmail && !paymentIntent.receipt_email) {
        console.warn(`⚠️ [email] buyer email missing → using fallback ${FALLBACK_EMAIL}`);
      }
      if (!paymentIntent.metadata?.sellerEmail) {
        console.warn(`⚠️ [email] seller email missing → using fallback ${FALLBACK_EMAIL}`);
      }

      console.log(
        `💳 [payment] succeeded | orderId: ${orderId} | buyer: ${buyerEmail} | seller: ${sellerEmail} | tracking: ${consignmentNumber || "none"}`
      );

      sentPaymentIntents.add(orderId);

      const effectiveConsignmentNumber =
        consignmentNumber || (await tryBookShipment(paymentIntent));

      try {
        await Promise.all([
          sendEmail({
            to: buyerEmail,
            subject: "Your NORYA order confirmation",
            html: getBuyerConfirmationHtml({
              orderId,
              amount,
              currency,
              consignmentNumber: effectiveConsignmentNumber,
            }),
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
              consignmentNumber: effectiveConsignmentNumber,
            }),
          }),
        ]);

        console.log(`🎉 [email] ALL SENT for order ${orderId}`);
       } catch (err) {
         console.error("❌ [email] FAILED to send order emails:", err);
       }

       try {
         const itemsMeta = paymentIntent.metadata?.items;
         if (itemsMeta) {
           const parsedItems = JSON.parse(itemsMeta);
           const sellerGroups = {};
           for (const item of parsedItems) {
             const sid = item.sellerAccountId;
             if (!sid) continue;
             if (!sellerGroups[sid]) sellerGroups[sid] = { amount: 0 };
             sellerGroups[sid].amount += (item.price || 0) * (item.quantity || 1);
           }
           const sellerIds = Object.keys(sellerGroups);
           for (const [sellerId, group] of Object.entries(sellerGroups)) {
             const sellerAmount = Math.round(group.amount * 0.902);
             if (sellerAmount <= 0) continue;
             const existingTransfers = await stripe.transfers.list({
               limit: 1,
               destination: sellerId,
               source_transaction: paymentIntent.id,
             });
             if (existingTransfers.data.length === 0) {
               await stripe.transfers.create({
                 amount: sellerAmount,
                 currency: 'nok',
                 destination: sellerId,
                 source_transaction: paymentIntent.id,
                 transfer_group: orderId,
               });
             }
           }
           console.log(`💸 [webhook] payouts for order ${orderId}: sellers ${sellerIds.join(', ')}`);
         }
       } catch (transferErr) {
         console.error("❌ [webhook] transfer creation failed:", transferErr.message);
       }
       break;
     }

    default:
      console.log(`ℹ️ [webhook] unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
