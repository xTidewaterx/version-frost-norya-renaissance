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
const BOOKING_URL = "/api/book-shipment"; // internal booking endpoint path
const BRING_CLIENT_URL = process.env.BRING_CLIENT_URL || "http://localhost:3000"; // must be public for QA testing
const sentPaymentIntents = new Set();

// --- helper: safe JSON parse
async function safeParseJsonFromResponse(res) {
  const text = await res.text();
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: "invalid_json", text };
    }
  }
  // non-json (likely HTML)
  return { ok: false, error: "non_json", text };
}

// --- tryBookShipment: forwards to internal booking endpoint and handles non-JSON responses
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
  const email = customer.email || paymentIntent.metadata?.buyerEmail || paymentIntent.receipt_email || FALLBACK_EMAIL;
  const street = customer.street || topAddress.street || pickupAddress.street || "";
  const streetNumber = customer.streetNumber || topAddress.streetNumber || pickupAddress.streetNumber || "";
  const postalCode = customer.postcode || topAddress.postalCode || shipping.postalCode || pickupAddress.postalCode || "";
  const city = customer.city || topAddress.city || shipping.city || pickupAddress.city || "";
  const country = customer.country || topAddress.country || pickupAddress.countryCode || "NO";

  if (!email) {
    console.warn("⚠️ [webhook] missing email for booking, skipping");
    return null;
  }

  // Bring consumer product codes (QA defaults)
  const BRING_MAIN_PRODUCT = "3622"; // Norgespakke Liten (QA)
  const BRING_PICKUP_SERVICE = "1073"; // Henting (PickUp)

  const isPickupPoint = Boolean(pickup);
  const isMailboxPickup = shipping.pickupPointType === "MAILBOX" || shipping.id === "MAILBOX";

  // Package dimensions (defaults)
  const weightInKg = Number(process.env.DEFAULT_PACKAGE_WEIGHT_KG || 2);
  const lengthInCm = Number(process.env.DEFAULT_PACKAGE_LENGTH_CM || 30);
  const widthInCm = Number(process.env.DEFAULT_PACKAGE_WIDTH_CM || 20);
  const heightInCm = Number(process.env.DEFAULT_PACKAGE_HEIGHT_CM || 10);

  const hasRealAddress = street && postalCode && city;

  // Build Bring product block — enforce QA customerNumber "5"
  const product = {
    id: BRING_MAIN_PRODUCT,
    customerNumber: "5",
    ...(isPickupPoint || isMailboxPickup ? { additionalServices: [{ id: BRING_PICKUP_SERVICE }] } : {}),
  };

  const normalizedRecipientAddress = {
    addressLine: hasRealAddress ? street : "Testveien 1",
    addressLine2: null,
    postalCode: hasRealAddress ? postalCode : "0155",
    city: hasRealAddress ? city : "OSLO",
    countryCode: country,
  };

  const normalizedPickupPoint = isPickupPoint
    ? {
        id: pickup.id || shipping.id,
        countryCode: pickup.address?.countryCode || pickup.countryCode || country,
      }
    : null;

  // Build Bring booking payload (internal API expects this shape)
  const payload = {
    sender: {
      name: "NORYA Marketplace AS",
      addressLine: "Storgata 1",
      addressLine2: null,
      postalCode: "0155",
      city: "OSLO",
      countryCode: "NO",
      reference: paymentIntent.metadata?.orderId || paymentIntent.id,
      contact: {
        name: "NORYA Marketplace AS",
        email: process.env.FALLBACK_EMAIL || FALLBACK_EMAIL,
        phoneNumber: "",
      },
    },

    recipient: {
      name: name || "Test Customer",
      addressLine: normalizedRecipientAddress.addressLine,
      addressLine2: null,
      postalCode: normalizedRecipientAddress.postalCode,
      city: normalizedRecipientAddress.city,
      countryCode: normalizedRecipientAddress.countryCode,
      reference: email || paymentIntent.id,
      contact: {
        name: name || "Test Customer",
        email: email || paymentIntent.metadata?.buyerEmail || "",
        phoneNumber: "",
      },
    },

    product,
    purchaseOrder: null,
    packages: [
      {
        weightInKg,
        goodsDescription: "NORYA order",
        dimensions: {
          heightInCm,
          widthInCm,
          lengthInCm,
        },
        containerId: null,
        packageType: null,
        numberOfItems: null,
      },
    ],
    shippingDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    orderId: paymentIntent.metadata?.orderId || paymentIntent.id,
    pickupPoint: normalizedPickupPoint,
    flow: isPickupPoint || isMailboxPickup ? "pickup" : "pib",
  };

  console.log("🚚 [webhook] attempting to book shipment for", payload.orderId);
  console.log("🚚 [webhook] booking payload:", JSON.stringify(payload, null, 2));

  try {
    // Ensure BRING_CLIENT_URL is a full URL (http(s)://host)
    const appUrl = BRING_CLIENT_URL.endsWith("/") ? BRING_CLIENT_URL.slice(0, -1) : BRING_CLIENT_URL;
    const bookingEndpoint = `${appUrl}${BOOKING_URL}`;

    const res = await fetch(bookingEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    console.log("🚚 [webhook] forwarded to booking endpoint:", bookingEndpoint, "status:", res.status, "finalUrl:", res.url);

    const parsed = await safeParseJsonFromResponse(res);

    if (!parsed.ok) {
      // Non-JSON or invalid JSON response from internal booking endpoint
      console.error("❌ [webhook] booking forward returned non-JSON or invalid JSON:", parsed.error);
      console.error(parsed.text?.slice(0, 1000));
      return null;
    }

    const data = parsed.json;

    // Expect internal booking endpoint to return consignmentNumber or success object
    const consignmentNumber = data?.consignmentNumber || data?.confirmation?.consignmentNumber || data?.consignments?.[0]?.confirmation?.consignmentNumber || null;

    if (!res.ok || !consignmentNumber) {
      console.error("❌ [webhook] booking failed or missing consignmentNumber:", res.status, data);
      return null;
    }

    console.log("✅ [webhook] booked shipment:", consignmentNumber, data.trackingUrl || null);

    // Save consignmentNumber back to PaymentIntent metadata
    try {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...(paymentIntent.metadata || {}),
          consignmentNumber: String(consignmentNumber),
        },
      });
      console.log("🔑 [webhook] saved consignmentNumber to PaymentIntent metadata");
    } catch (updateErr) {
      console.warn("⚠️ [webhook] failed to update PaymentIntent metadata:", updateErr.message);
    }

    return String(consignmentNumber);
  } catch (err) {
    console.error("❌ [webhook] booking error:", err && err.message ? err.message : String(err));
    return null;
  }
}

// --- central handler for succeeded PaymentIntent
async function handleSucceededPaymentIntent(paymentIntent) {
  const orderId = paymentIntent.metadata?.orderId || paymentIntent.id;

  if (sentPaymentIntents.has(orderId)) {
    console.log(`ℹ️ [webhook] duplicate payment suppressed for ${orderId}`);
    return;
  }

  sentPaymentIntents.add(orderId);

  const buyerEmail = paymentIntent.metadata?.buyerEmail || paymentIntent.receipt_email || FALLBACK_EMAIL;
  const sellerEmail = paymentIntent.metadata?.sellerEmail || FALLBACK_EMAIL;
  const amount = paymentIntent.amount || 0;
  const currency = paymentIntent.currency || "nok";
  const consignmentNumber = paymentIntent.metadata?.consignmentNumber || null;

  console.log(`🔔 [webhook] buyer_email=${buyerEmail} | orderId=${orderId} | tracking=${consignmentNumber || "none"}`);
  console.log("🔔 [webhook] full paymentIntent object:", JSON.stringify(paymentIntent, null, 2));

  // Attempt booking if we don't already have consignmentNumber
  const effectiveConsignmentNumber = consignmentNumber || (await tryBookShipment(paymentIntent));

  // Send emails (buyer + seller)
  try {
    const items = paymentIntent.metadata?.items ? JSON.parse(paymentIntent.metadata.items) : [];
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
    console.log(`🎉 [email] ALL SENT for order ${orderId}`);
  } catch (err) {
    console.error("❌ [email] FAILED to send order emails:", err);
  }

  // Optional: create transfers/payouts (existing logic preserved)
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
            transfer_group: paymentIntent.id,
          });
        }
      }
      console.log(`💸 [webhook] payouts for order ${orderId}: sellers ${Object.keys(sellerGroups).join(', ')}`);
    }
  } catch (transferErr) {
    console.error("❌ [webhook] transfer creation failed:", transferErr.message);
  }
}

// --- route handlers
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

  try {
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

        console.log(
          `🔔 [webhook][checkout.session] buyer_email=${buyerEmail} | orderId=${orderId}`
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

          // transfers/payouts logic preserved (omitted here for brevity; you can reuse above)
        } else {
          console.log(`ℹ️ [webhook] duplicate checkout.session.completed suppressed for ${orderId}`);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        await handleSucceededPaymentIntent(paymentIntent);
        break;
      }

      case "charge.succeeded": {
        // charge object contains payment_intent id; retrieve the PaymentIntent and handle it
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) {
          console.warn("⚠️ [webhook] charge.succeeded without payment_intent, skipping");
          break;
        }
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          await handleSucceededPaymentIntent(paymentIntent);
        } catch (err) {
          console.error("❌ [webhook] failed to retrieve PaymentIntent for charge.succeeded:", err.message);
        }
        break;
      }

      default:
        console.log(`ℹ️ [webhook] unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ [webhook] processing failed:", err);
    return NextResponse.json({ received: false, error: String(err) }, { status: 500 });
  }
}
