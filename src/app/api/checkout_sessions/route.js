import Stripe from "stripe";
import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const APP_CURRENCY = (process.env.NEXT_PUBLIC_APP_CURRENCY || "nok").toLowerCase();

const SHIPPING_OPTIONS = {
  standard: { id: "standard", name: "Standard frakt (2-4 dager)", cost: 5000 },
  express: { id: "express", name: "Ekspressfrakt (1-2 dager)", cost: 15000 },
};

const MIN_AMOUNT = 300;

async function resolveProductPrice(productId) {
  if (!productId) return null;
  try {
    const product = await stripe.products.retrieve(productId);
    if (!product.default_price) return null;
    const price = await stripe.prices.retrieve(product.default_price);
    return {
      unitAmount: price.unit_amount,
      currency: price.currency || APP_CURRENCY,
    };
  } catch (err) {
    console.error(`[checkout] failed to resolve price for product ${productId}:`, err.message);
    return null;
  }
}

function normalizeShipping(rawShipping, selectedShipping) {
  if (!rawShipping) return null;

  // FIX: If pickupPointType exists but pickupPoint is missing → create safe fallback
  if (rawShipping.pickupPointType && !rawShipping.pickupPoint) {
    rawShipping.pickupPoint = {
      id: rawShipping.pickupPointType,
      name: rawShipping.pickupPointType,
      address: {
        street: rawShipping.address || "",
        postalCode: rawShipping.postalCode || "",
        city: rawShipping.city || "",
        countryCode: rawShipping.country || "NO",
      },
    };
  }

  const customer = rawShipping.customerData || {};

  return {
    id: selectedShipping.id,
    name: selectedShipping.name,
    cost: selectedShipping.cost,

    pickupPoint: rawShipping.pickupPoint || null,
    pickupPointType: rawShipping.pickupPointType || null,

    address: rawShipping.address || null,
    postalCode: rawShipping.postalCode || null,
    city: rawShipping.city || null,
    country: rawShipping.country || "NO",

    customerData: customer
      ? {
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          street: customer.street || "",
          streetNumber: customer.streetNumber || "",
          city: customer.city || "",
          postcode: customer.postcode || "",
          country: customer.country || "",
        }
      : null,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, shipping, email, sellerEmail } = body;

    const forbiddenFields = [
      "price",
      "amount",
      "unit_amount",
      "payout",
      "fee",
      "total",
      "customerNumber",
    ];
    for (const field of forbiddenFields) {
      if (body[field] !== undefined) {
        return NextResponse.json(
          { error: `Client-sent field "${field}" is not allowed` },
          { status: 400 }
        );
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items in request" }, { status: 400 });
    }

    const resolvedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const priceData = await resolveProductPrice(item.id);
      if (!priceData) {
        return NextResponse.json(
          { error: `Product ${item.id} has no valid price` },
          { status: 400 }
        );
      }
      const quantity = Math.max(1, Number(item.quantity) || 1);
      resolvedItems.push({
        price_data: {
          currency: priceData.currency,
          product_data: { name: item.name || "Product" },
          unit_amount: priceData.unitAmount,
        },
        quantity,
      });
      totalAmount += priceData.unitAmount * quantity;
    }

    const shippingId = shipping?.id || shipping?.method || "standard";
    const selectedShipping = SHIPPING_OPTIONS[shippingId] || SHIPPING_OPTIONS.standard;
    const shippingCost = selectedShipping.cost;

    // Add shipping line to Stripe pricing
    resolvedItems.push({
      price_data: {
        currency: APP_CURRENCY,
        product_data: { name: selectedShipping.name },
        unit_amount: shippingCost,
      },
      quantity: 1,
    });

    totalAmount += shippingCost;

    if (!Number.isInteger(totalAmount) || totalAmount < MIN_AMOUNT) {
      return NextResponse.json({ error: `Invalid total amount` }, { status: 400 });
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    let essentialShipping = null;
    const metadata = {};

    try {
      essentialShipping = normalizeShipping(shipping, selectedShipping);

      const shippingJson = essentialShipping ? JSON.stringify(essentialShipping) : "";

      console.log("🧾 [checkout] shipping param keys:", shipping ? Object.keys(shipping) : "null");
      console.log("🧾 [checkout] essentialShipping present:", !!essentialShipping, "length:", shippingJson.length);
      console.log("🧾 [checkout] essentialShipping JSON:", shippingJson);
      console.log("🧾 [checkout] metadata.shipping first 120 chars:", shippingJson.slice(0, 120));

      metadata.shipping = shippingJson.slice(0, 500);

      // FIX: Build items metadata ONLY from items, not resolvedItems
      const itemMetadata = items.map((item, idx) => ({
        id: item.id,
        name: item.name,
        quantity: resolvedItems[idx].quantity,
        price: resolvedItems[idx].price_data.unit_amount,
        sellerAccountId: item.sellerAccountId,
      }));

      metadata.items = JSON.stringify(itemMetadata).slice(0, 4000);
      metadata.buyerEmail = (email || "").slice(0, 200);
      metadata.sellerEmail = (sellerEmail || "").slice(0, 200);
      metadata.orderId = orderId;
    } catch (e) {
      console.error("❌ [checkout] failed to build metadata:", e.message);
      metadata.shipping = "";
      metadata.items = "";
    }

    console.log("🧾 [checkout] metadata object keys:", Object.keys(metadata));
    console.log("🧾 [checkout] metadata.shipping length:", (metadata.shipping || "").length);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: APP_CURRENCY,
        payment_method_types: ["card"],
        metadata,
        description: `NORYA order - ${resolvedItems.length} item(s)`,
        receipt_email: email,
      },
      { idempotencyKey: `order_${orderId}` }
    );

    console.log("🧾 [checkout] created PaymentIntent:", paymentIntent.id);
    console.log("🧾 [checkout] returned metadata keys:", Object.keys(paymentIntent.metadata || {}));
    console.log("🧾 [checkout] returned metadata.shipping length:", (paymentIntent.metadata?.shipping || "").length);
    console.log("🧾 [checkout] returned metadata.shipping raw:", JSON.stringify(paymentIntent.metadata?.shipping));

    if ((paymentIntent.metadata?.shipping || "").length === 0 && (metadata.shipping || "").length > 0) {
      console.warn("⚠️ [checkout] Stripe dropped shipping metadata, attempting to update PI...");
      try {
        const updated = await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: { ...metadata },
        });
        console.log("🧾 [checkout] updated PI metadata.shipping length:", (updated.metadata?.shipping || "").length);
      } catch (updateError) {
        console.error("❌ [checkout] failed to update PI metadata:", updateError.message);
      }
    }

    try {
      await db.collection("orders").doc(orderId).set({
        orderId,
        paymentIntentId: paymentIntent.id,
        shipping: essentialShipping,
        buyerEmail: email || null,
        sellerEmail: sellerEmail || null,
        amount: totalAmount,
        currency: APP_CURRENCY,

        // FIX: Use itemMetadata instead of resolvedItems
        items: items.map((item, idx) => ({
          id: item.id,
          name: item.name,
          quantity: resolvedItems[idx].quantity,
          price: resolvedItems[idx].price_data.unit_amount,
          sellerAccountId: item.sellerAccountId,
        })),

        createdAt: new Date(),
      });
      console.log("🧾 [checkout] saved order to Firestore:", orderId);
    } catch (firestoreError) {
      console.error("❌ [checkout] failed to save order to Firestore:", firestoreError.message);
    }

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[checkout] error:", err.type, err.message);
    let status = 500;
    let userMsg = "Feil ved betaling. Prøv igjen.";

    if (
      err.message?.includes("missing a valid product id") ||
      err.message?.includes("has no default price")
    ) {
      userMsg = "Mangler vare i handlekurven. Oppdater siden og legg varen i handlekurven på nytt.";
      status = 400;
    } else if (err.type === "StripeInvalidRequestError") {
      userMsg = `Ugyldig betalingsforespørsel: ${err.message}`;
      status = 400;
    }

    return new Response(JSON.stringify({ error: userMsg }), { status });
  }
}
