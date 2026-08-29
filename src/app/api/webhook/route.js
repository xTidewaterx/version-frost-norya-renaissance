import { NextResponse } from "next/server";
import { verifyStripeWebhook, stripe } from "@/lib/stripe";
import { db, authAdmin } from "../../lib/firebaseAdmin";
import {
  sendEmail,
  getBuyerConfirmationHtml,
  getSellerNotificationHtml,
} from "@/lib/sendEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL || "johan12ab@gmail.com";
const BOOKING_URL = "/api/book-shipment";
const BRING_CLIENT_URL = process.env.BRING_CLIENT_URL || "https://localhost:3000";

const PROCESSED_ORDERS = new Set();

async function isOrderProcessed(orderId) {
  try {
    const doc = await db.collection("stripe_processed_orders").doc(orderId).get();
    return doc.exists;
  } catch {
    return false;
  }
}

async function markOrderProcessed(orderId, eventId) {
  try {
    await db.collection("stripe_processed_orders").doc(orderId).set({
      eventId,
      processedAt: new Date(),
    });
  } catch {
    // non-fatal: in-memory dedup still protects this instance
  }
}

async function getOrderPaymentIntents(orderId) {
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) return [];
    const data = orderDoc.data();
    return data?.paymentIntents || [];
  } catch {
    return [];
  }
}

async function areAllPaymentIntentsSucceeded(orderId) {
  const paymentIntents = await getOrderPaymentIntents(orderId);
  if (paymentIntents.length === 0) return true;

  const succeeded = await Promise.all(
    paymentIntents.map(async (pi) => {
      try {
        const stripePi = await stripe.paymentIntents.retrieve(pi.paymentIntentId);
        return stripePi.status === "succeeded";
      } catch {
        return false;
      }
    })
  );

  return succeeded.every(Boolean);
}

async function markPaymentIntentProcessed(orderId, paymentIntentId) {
  try {
    const docRef = db.collection("stripe_pi_processed").doc(`${orderId}_${paymentIntentId}`);
    await docRef.set({
      orderId,
      paymentIntentId,
      processedAt: new Date(),
    });
  } catch {
    // non-fatal
  }
}

async function isPaymentIntentProcessed(orderId, paymentIntentId) {
  try {
    const docRef = db.collection("stripe_pi_processed").doc(`${orderId}_${paymentIntentId}`);
    const doc = await docRef.get();
    return doc.exists;
  } catch {
    return false;
  }
}

async function safeParseJsonFromResponse(res) {
  const text = await res.text();
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      return { ok: false, error: "invalid_json", text };
    }
  }
  return { ok: false, error: "non_json", text };
}

async function tryBookShipment(paymentIntent) {
  if (paymentIntent.metadata?.consignmentNumber) {
    return paymentIntent.metadata.consignmentNumber;
  }

  const shippingMeta = paymentIntent.metadata?.shipping;
  console.log("🔍 [book-shipment] shippingMeta present:", !!shippingMeta, "consignmentNumber:", !!paymentIntent.metadata?.consignmentNumber);
  console.log("🔍 [book-shipment] metadata keys:", Object.keys(paymentIntent.metadata || {}));
  console.log("🔍 [book-shipment] shippingMeta raw:", JSON.stringify(shippingMeta));
  console.log("🔍 [book-shipment] shippingMeta type:", typeof shippingMeta);
  if (!shippingMeta) {
    console.warn("⚠️ [book-shipment] missing shipping metadata, attempting Firestore fallback");
    const orderId = paymentIntent.metadata?.orderId || paymentIntent.id;
    let fallbackShipping = null;
    let buyerEmail =
      paymentIntent.metadata?.buyerEmail ||
      paymentIntent.receipt_email ||
      FALLBACK_EMAIL;

    try {
      const orderDoc = await db.collection("orders").doc(orderId).get();
      if (orderDoc.exists) {
        const orderData = orderDoc.data();
        fallbackShipping = orderData?.shipping || null;
        buyerEmail = orderData?.buyerEmail || buyerEmail;
        console.log("🔍 [book-shipment] Firestore order fallback found for:", orderId, "shipping present:", !!fallbackShipping);
      } else {
        console.warn("⚠️ [book-shipment] no Firestore order found for:", orderId);
      }
    } catch (e) {
      console.warn("⚠️ [book-shipment] Firestore order lookup failed:", e.message);
    }

    let fallbackName = "";
    let fallbackStreet = "";
    let fallbackPostalCode = "";
    let fallbackCity = "";
    let fallbackCountry = "NO";
    let pickup = null;

    if (fallbackShipping) {
      const customer = fallbackShipping.customerData || {};
      const topAddress = {
        street: fallbackShipping.address || "",
        streetNumber: "",
        postalCode: fallbackShipping.postalCode || "",
        city: fallbackShipping.city || "",
        country: fallbackShipping.country || "NO",
      };
      const pp = fallbackShipping.pickupPointData || fallbackShipping.pickupPoint || null;
      const pickupAddress = pp?.address || {};
      const pickupName = pp?.name || "";

      fallbackName = customer.name || pickupName || fallbackShipping.name || "";
      fallbackStreet = customer.street || topAddress.street || pickupAddress.street || "";
      fallbackPostalCode = customer.postcode || topAddress.postalCode || fallbackShipping.postalCode || pickupAddress.postalCode || "";
      fallbackCity = customer.city || topAddress.city || fallbackShipping.city || pickupAddress.city || "";
      fallbackCountry = customer.country || topAddress.country || pickupAddress.countryCode || "NO";
      pickup = pp;
    }

    if (!fallbackName && buyerEmail && buyerEmail !== FALLBACK_EMAIL) {
      try {
        const userRecord = await authAdmin.getUserByEmail(buyerEmail);
        const userDoc = await db.collection("users").doc(userRecord.uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          fallbackName = data?.fullName || data?.displayName || fallbackName;
          if (!fallbackStreet) fallbackStreet = data?.street || data?.address || "";
          if (!fallbackPostalCode) fallbackPostalCode = data?.postcode || data?.postalCode || "";
          if (!fallbackCity) fallbackCity = data?.city || "";
          if (fallbackCountry === "NO") fallbackCountry = data?.country || data?.countryCode || "NO";
        }
      } catch (e) {
        console.warn("⚠️ [book-shipment] Firestore user fallback failed:", e.message);
      }
    }

    if (!fallbackName && buyerEmail) {
      fallbackName = buyerEmail.split("@")[0];
    }

    if (!fallbackStreet && !fallbackPostalCode && !fallbackCity) {
      console.warn("⚠️ [book-shipment] no address data available, skipping shipment booking");
      return null;
    }

    const BRING_MAIN_PRODUCT = "3622";
    const isPickupPoint = Boolean(pickup);
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
        name: fallbackName || "Customer",
        addressLine: fallbackStreet || "Testveien 1",
        addressLine2: null,
        postalCode: fallbackPostalCode || "0155",
        city: fallbackCity || "OSLO",
        countryCode: fallbackCountry,
        reference: buyerEmail || paymentIntent.id,
        contact: {
          name: fallbackName || "Customer",
          email: buyerEmail || paymentIntent.metadata?.buyerEmail || "",
          phoneNumber: "",
        },
      },
      product: { id: BRING_MAIN_PRODUCT, customerNumber: "5" },
      purchaseOrder: null,
      packages: [
        {
          weightInKg: Number(process.env.DEFAULT_PACKAGE_WEIGHT_KG || 2),
          goodsDescription: "NORYA order",
          dimensions: {
            heightInCm: Number(process.env.DEFAULT_PACKAGE_HEIGHT_CM || 10),
            widthInCm: Number(process.env.DEFAULT_PACKAGE_WIDTH_CM || 20),
            lengthInCm: Number(process.env.DEFAULT_PACKAGE_LENGTH_CM || 30),
          },
          containerId: null,
          packageType: null,
          numberOfItems: null,
        },
      ],
      shippingDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      orderId: paymentIntent.metadata?.orderId || paymentIntent.id,
      pickupPoint: isPickupPoint
        ? {
            id: pickup.id || fallbackShipping?.id,
            countryCode: pickup.address?.countryCode || pickup.countryCode || fallbackCountry,
          }
        : null,
      flow: isPickupPoint ? "pickup" : "pib",
    };

    try {
      const appUrl = BRING_CLIENT_URL.endsWith("/") ? BRING_CLIENT_URL.slice(0, -1) : BRING_CLIENT_URL;
      const bookingEndpoint = `${appUrl}${BOOKING_URL}`;
      const res = await fetch(bookingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      const parsed = await safeParseJsonFromResponse(res);
      if (!parsed.ok) {
        console.error("❌ [book-shipment] fallback booking failed:", res.status, parsed.text);
        return null;
      }
      const data = parsed.json;
      const consignmentNumber =
        data?.consignmentNumber ||
        data?.confirmation?.consignmentNumber ||
        data?.consignments?.[0]?.confirmation?.consignmentNumber ||
        null;
      if (!res.ok || !consignmentNumber) {
        console.error("❌ [book-shipment] fallback booking returned no consignmentNumber");
        return null;
      }
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...(paymentIntent.metadata || {}),
            consignmentNumber: String(consignmentNumber),
          },
        });
      } catch {
        // non-fatal
      }
      console.log("✅ [book-shipment] fallback booked:", consignmentNumber);
      return String(consignmentNumber);
    } catch (err) {
      console.error("❌ [book-shipment] fallback booking error:", err.message);
      return null;
    }
  }

  let shipping;
  try {
    shipping = typeof shippingMeta === "string" ? JSON.parse(shippingMeta) : shippingMeta;
  } catch {
    console.error("❌ [book-shipment] failed to parse shipping metadata");
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

  let name = customer.name || pickupName || shipping.name || "";
  const email = customer.email || paymentIntent.metadata?.buyerEmail || paymentIntent.receipt_email || FALLBACK_EMAIL;
  const street = customer.street || topAddress.street || pickupAddress.street || "";
  const streetNumber = customer.streetNumber || topAddress.streetNumber || pickupAddress.streetNumber || "";
  const postalCode = customer.postcode || topAddress.postalCode || shipping.postalCode || pickupAddress.postalCode || "";
  const city = customer.city || topAddress.city || shipping.city || pickupAddress.city || "";
  const country = customer.country || topAddress.country || pickupAddress.countryCode || "NO";

  if (!name && email && email !== FALLBACK_EMAIL) {
    try {
      const userRecord = await authAdmin.getUserByEmail(email);
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data?.fullName) {
          name = data.fullName;
        }
      }
    } catch {
      // non-fatal: use email prefix as name fallback
    }
  }

  if (!name) {
    name = email ? email.split("@")[0] : "Customer";
  }

  console.log("🔍 [book-shipment] resolved recipient:", { name, email, street, postalCode, city, country, hasPickupPoint: !!pickup });

  if (!email) {
    return null;
  }

  const BRING_MAIN_PRODUCT = "3622";
  const BRING_PICKUP_SERVICE = "1073";
  // Product 3622 (PIB — Pakke i postkassen) does NOT support pickup-point delivery.
  // Sending a pickupPoint with this product triggers BOOK-INPUT-047.
  const PICKUP_INCOMPAT_PRODUCTS = new Set(["3622"]);

  const isPickupPoint = Boolean(pickup);
  const isMailboxPickup = shipping.pickupPointType === "MAILBOX" || shipping.id === "MAILBOX";
  const productSupportsPickup = !PICKUP_INCOMPAT_PRODUCTS.has(BRING_MAIN_PRODUCT);
  const usePickup = (isPickupPoint || isMailboxPickup) && productSupportsPickup;

  const weightInKg = Number(process.env.DEFAULT_PACKAGE_WEIGHT_KG || 2);
  const lengthInCm = Number(process.env.DEFAULT_PACKAGE_LENGTH_CM || 30);
  const widthInCm = Number(process.env.DEFAULT_PACKAGE_WIDTH_CM || 20);
  const heightInCm = Number(process.env.DEFAULT_PACKAGE_HEIGHT_CM || 10);

  const hasRealAddress = street && postalCode && city;

  const product = {
    id: BRING_MAIN_PRODUCT,
    customerNumber: "5",
    ...(usePickup ? { additionalServices: [{ id: BRING_PICKUP_SERVICE }] } : {}),
  };

  const normalizedRecipientAddress = {
    addressLine: hasRealAddress ? street : "Testveien 1",
    addressLine2: null,
    postalCode: hasRealAddress ? postalCode : "0155",
    city: hasRealAddress ? city : "OSLO",
    countryCode: country,
  };

  const normalizedPickupPoint = usePickup
    ? {
        id: pickup.id || shipping.id,
        countryCode: pickup.address?.countryCode || pickup.countryCode || country,
      }
    : null;

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
          heightInCm: heightInCm,
          widthInCm: widthInCm,
          lengthInCm: lengthInCm,
        },
        containerId: null,
        packageType: null,
        numberOfItems: null,
      },
    ],
    shippingDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    orderId: paymentIntent.metadata?.orderId || paymentIntent.id,
    pickupPoint: normalizedPickupPoint,
    ...(usePickup ? { customerSpecifiedDispatchDateTime: new Date().toISOString() } : {}),
    flow: usePickup ? "pickup" : "pib",
  };

  try {
    const appUrl = BRING_CLIENT_URL.endsWith("/") ? BRING_CLIENT_URL.slice(0, -1) : BRING_CLIENT_URL;
    const bookingEndpoint = `${appUrl}${BOOKING_URL}`;

    async function sendBooking(payloadToSend) {
      const res = await fetch(bookingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
        redirect: "follow",
      });
      const parsed = await safeParseJsonFromResponse(res);
      return { res, parsed };
    }

    function isPickupPointNotSupportedError(parsed) {
      const consignment = parsed.json?.details?.consignments?.[0] || parsed.json?.consignments?.[0];
      if (!parsed.ok || !consignment?.errors) return false;
      const errors = consignment.errors;
      return errors.some(
        (err) => err.code === "BOOK-INPUT-047" || err.code === "CUSTOMER_SPECIFIED_DISPATCH_DATE-INPUT-003"
      );
    }

    let { res, parsed } = await sendBooking(payload);

    if (!res.ok && isPickupPointNotSupportedError(parsed)) {
      console.warn("⚠️ [book-shipment] pickup point not supported, retrying without pickupPoint...");
      const fallbackPayload = JSON.parse(JSON.stringify(payload));
      delete fallbackPayload.pickupPoint;
      fallbackPayload.flow = "pib";
      const retry = await sendBooking(fallbackPayload);
      ({ res, parsed } = retry);
    }

    if (!parsed.ok) {
      console.error("❌ [book-shipment] booking failed:", res.status, parsed.text);
      return null;
    }

    const data = parsed.json;
    const consignmentNumber =
      data?.consignmentNumber ||
      data?.confirmation?.consignmentNumber ||
      data?.consignments?.[0]?.confirmation?.consignmentNumber ||
      null;

    if (!res.ok || !consignmentNumber) {
      console.error("❌ [book-shipment] booking returned no consignmentNumber");
      return null;
    }

    try {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...(paymentIntent.metadata || {}),
          consignmentNumber: String(consignmentNumber),
        },
      });
    } catch {
      // non-fatal
    }

    return String(consignmentNumber);
  } catch (err) {
    console.error("❌ [book-shipment] failed:", err && err.message ? err.message : String(err));
    return null;
  }
}

async function sendOrderEmails(paymentIntent, buyerEmail, sellerEmail, orderId, amount, currency, consignmentNumber) {
  const items = paymentIntent.metadata?.items ? JSON.parse(paymentIntent.metadata.items) : [];
  await Promise.all([
    sendEmail({
      to: buyerEmail,
      subject: "Your NORYA order confirmation",
      html: getBuyerConfirmationHtml({
        orderId,
        amount,
        currency,
        consignmentNumber,
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
        consignmentNumber,
      }),
    }),
  ]);
}

async function createSellerTransfers(paymentIntent, amount, orderId) {
  if (paymentIntent.transfer_data?.destination) {
    console.log("ℹ️ [webhook] PI has transfer_data.destination, Stripe handles transfer automatically:", paymentIntent.transfer_data.destination);
    return;
  }

  const itemsMeta = paymentIntent.metadata?.items;
  if (!itemsMeta) {
    console.warn("⚠️ [webhook] no items metadata, skipping transfers");
    return;
  }

  const parsedItems = JSON.parse(itemsMeta);
  const sellerGroups = {};
  for (const item of parsedItems) {
    const sid = item.sellerAccountId;
    if (!sid) continue;
    if (!sellerGroups[sid]) sellerGroups[sid] = { amount: 0 };
    sellerGroups[sid].amount += (item.price || 0) * (item.quantity || 1);
  }

  let totalSellerCents = 0;
  for (const group of Object.values(sellerGroups)) {
    totalSellerCents += Math.round(group.amount * 0.902);
  }

  if (totalSellerCents > amount) {
    console.error("❌ [webhook] seller payout total exceeds payment amount, skipping transfers");
    return;
  }

  for (const [sellerId, group] of Object.entries(sellerGroups)) {
    const sellerAmount = Math.round(group.amount * 0.902);
    if (sellerAmount <= 0) continue;
    const existingTransfers = await stripe.transfers.list({
      limit: 1,
      destination: sellerId,
      source_transaction: paymentIntent.id,
    });
    if (existingTransfers.data.length === 0) {
      const transfer = await stripe.transfers.create({
        amount: sellerAmount,
        currency: "nok",
        destination: sellerId,
        source_transaction: paymentIntent.id,
        transfer_group: paymentIntent.id,
        description: `NORYA payout for order ${orderId}`,
      });
      console.log("✅ [webhook] transfer created:", transfer.id, "to seller", sellerId, "amount:", sellerAmount);
    } else {
      console.log("ℹ️ [webhook] transfer already exists for seller", sellerId, "order:", orderId);
    }
  }
}

async function processSuccessfulPayment(paymentIntent, buyerEmailOverride) {
  const orderId = paymentIntent.metadata?.orderId || paymentIntent.id;

  const alreadyProcessed = await isPaymentIntentProcessed(orderId, paymentIntent.id);
  if (alreadyProcessed) {
    return;
  }

  await markPaymentIntentProcessed(orderId, paymentIntent.id);

  const buyerEmail =
    buyerEmailOverride ||
    paymentIntent.metadata?.buyerEmail ||
    paymentIntent.receipt_email ||
    FALLBACK_EMAIL;
  const sellerEmail = paymentIntent.metadata?.sellerEmail || FALLBACK_EMAIL;
  const amount = paymentIntent.amount || 0;
  const currency = paymentIntent.currency || "nok";
  const consignmentNumber = paymentIntent.metadata?.consignmentNumber || null;

  const allSucceeded = await areAllPaymentIntentsSucceeded(orderId);
  if (!allSucceeded) {
    console.log("🔍 [webhook] order has multiple PIs, waiting for all to succeed:", orderId);
    return;
  }

  const effectiveConsignmentNumber = consignmentNumber || (await tryBookShipment(paymentIntent));

  try {
    await sendOrderEmails(paymentIntent, buyerEmail, sellerEmail, orderId, amount, currency, effectiveConsignmentNumber);
  } catch {
    // email failure should not block payout processing
  }

  try {
    await createSellerTransfers(paymentIntent, amount, orderId);
  } catch (err) {
    console.error("❌ [webhook] transfer creation failed:", err && err.message ? err.message : String(err));
  }

  try {
    await db.collection("stripe_processed_orders").doc(orderId).set({
      eventId: paymentIntent.id,
      processedAt: new Date(),
    });
  } catch {
    // non-fatal
  }

  PROCESSED_ORDERS.add(orderId);
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
  } catch {
    return new Response("Webhook Error", { status: 400 });
  }

  try {
    console.log("🔔 [webhook] event received:", event.type, "(id:", event.id + ")");
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const paymentIntentId = session.payment_intent;
        if (!paymentIntentId) break;

        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          console.log("🔍 [webhook] checkout.session.completed paymentIntent id:", pi.id);
          console.log("🔍 [webhook] checkout.session.completed metadata keys:", Object.keys(pi.metadata || {}));
          console.log("🔍 [webhook] checkout.session.completed metadata.shipping length:", (pi.metadata?.shipping || "").length);
          console.log("🔍 [webhook] checkout.session.completed metadata.shipping raw:", JSON.stringify(pi.metadata?.shipping));
          const buyerEmail =
            session.customer_details?.email ||
            pi.metadata?.buyerEmail ||
            pi.receipt_email ||
            FALLBACK_EMAIL;
          await processSuccessfulPayment(pi, buyerEmail);
        } catch {
          // non-fatal
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("🔍 [webhook] payment_intent.succeeded id:", paymentIntent.id);
        console.log("🔍 [webhook] payment_intent.succeeded metadata keys:", Object.keys(paymentIntent.metadata || {}));
        console.log("🔍 [webhook] payment_intent.succeeded metadata.shipping length:", (paymentIntent.metadata?.shipping || "").length);
        console.log("🔍 [webhook] payment_intent.succeeded metadata.shipping raw:", JSON.stringify(paymentIntent.metadata?.shipping));
        await processSuccessfulPayment(paymentIntent);
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          console.log("🔍 [webhook] charge.succeeded paymentIntent id:", paymentIntent.id);
          console.log("🔍 [webhook] charge.succeeded metadata keys:", Object.keys(paymentIntent.metadata || {}));
          console.log("🔍 [webhook] charge.succeeded metadata.shipping length:", (paymentIntent.metadata?.shipping || "").length);
          console.log("🔍 [webhook] charge.succeeded metadata.shipping raw:", JSON.stringify(paymentIntent.metadata?.shipping));
          await processSuccessfulPayment(paymentIntent);
        } catch {
          // non-fatal
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
