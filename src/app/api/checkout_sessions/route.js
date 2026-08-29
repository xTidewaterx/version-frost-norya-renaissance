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

      if (!item.sellerAccountId) {
        return NextResponse.json(
          { error: `Product ${item.id} is missing sellerAccountId` },
          { status: 400 }
        );
      }

      resolvedItems.push({
        price_data: {
          currency: priceData.currency,
          product_data: { name: item.name || "Product" },
          unit_amount: priceData.unitAmount,
        },
        quantity,
        sellerAccountId: item.sellerAccountId || null,
      });
      totalAmount += priceData.unitAmount * quantity;
    }

    const shippingId = shipping?.id || shipping?.method || "standard";
    const selectedShipping = SHIPPING_OPTIONS[shippingId] || SHIPPING_OPTIONS.standard;
    const shippingCost = selectedShipping.cost;

    totalAmount += shippingCost;

    if (!Number.isInteger(totalAmount) || totalAmount < MIN_AMOUNT) {
      return NextResponse.json({ error: "Invalid total amount" }, { status: 400 });
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const essentialShipping = normalizeShipping(shipping, selectedShipping);

    const sellerGroups = new Map();
    for (const item of resolvedItems) {
      const sellerId = item.sellerAccountId || "platform";
      if (!sellerGroups.has(sellerId)) {
        sellerGroups.set(sellerId, []);
      }
      sellerGroups.get(sellerId).push(item);
    }

    console.log("🧾 [checkout] seller groups:", Array.from(sellerGroups.keys()));
    console.log("🧾 [checkout] items per seller:", Array.from(sellerGroups.values()).map(g => g.length));

    const paymentIntents = [];
    const sellerSummaries = [];

    for (const [sellerId, sellerItems] of sellerGroups.entries()) {
      const sellerSubtotal = sellerItems.reduce(
        (sum, item) => sum + item.price_data.unit_amount * item.quantity,
        0
      );
      const sellerTotal = sellerSubtotal + shippingCost;
      const isPlatform = sellerId === "platform";

      const metadata = {
        orderId,
        buyerEmail: (email || "").slice(0, 200),
        sellerEmail: (sellerEmail || "").slice(0, 200),
        sellerId,
        isPlatform: String(isPlatform),
        items: JSON.stringify(
          sellerItems.map((item) => ({
            id: item.price_data.product_data?.name || "Product",
            name: item.price_data.product_data?.name || "Product",
            quantity: item.quantity,
            price: item.price_data.unit_amount,
            sellerAccountId: item.sellerAccountId || null,
          }))
        ).slice(0, 4000),
      };

      const shippingJson = essentialShipping ? JSON.stringify(essentialShipping) : "";
      if (shippingJson) {
        metadata.shipping = shippingJson.slice(0, 500);
      }

      const piParams = {
        amount: sellerTotal,
        currency: APP_CURRENCY,
        payment_method_types: ["card"],
        metadata,
        description: `NORYA order - ${sellerItems.length} item(s)${isPlatform ? " (platform)" : ""}`,
        receipt_email: email,
      };

      if (!isPlatform && sellerId) {
        const platformFee = Math.ceil(sellerTotal * 0.15); // 15% platform fee
        piParams.transfer_data = { destination: sellerId };
        piParams.application_fee_amount = platformFee;
      }

      const pi = await stripe.paymentIntents.create(
        piParams,
        { idempotencyKey: `${orderId}_${sellerId}` }
      );

      paymentIntents.push({
        sellerId,
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        amount: sellerTotal,
        isPlatform,
      });

      sellerSummaries.push({
        sellerId,
        amount: sellerTotal,
        items: sellerItems.length,
        paymentIntentId: pi.id,
        isPlatform,
      });

      console.log("🧾 [checkout] created PI for seller:", sellerId, "amount:", sellerTotal, "id:", pi.id, "transfer_data:", !isPlatform && sellerId ? "YES" : "NO");
    }

    try {
      const orderData = {
        orderId,
        paymentIntents: paymentIntents.map((pi) => ({
          paymentIntentId: pi.paymentIntentId,
          sellerId: pi.sellerId,
          amount: pi.amount,
          isPlatform: pi.isPlatform,
        })),
        shipping: essentialShipping,
        buyerEmail: email || null,
        sellerEmail: sellerEmail || null,
        amount: totalAmount,
        currency: APP_CURRENCY,
        items: resolvedItems.map((item) => ({
          id: item.price_data.product_data?.name || "Product",
          name: item.price_data.product_data?.name || "Product",
          quantity: item.quantity,
          price: item.price_data.unit_amount,
          sellerAccountId: item.sellerAccountId || null,
        })),
        createdAt: new Date(),
      };

      await db.collection("orders").doc(orderId).set(orderData);
      console.log("🧾 [checkout] saved order to Firestore:", orderId, "PIs:", paymentIntents.length);
    } catch (firestoreError) {
      console.error("❌ [checkout] failed to save order to Firestore:", firestoreError.message);
    }

    return new Response(
      JSON.stringify({
        orderId,
        paymentIntents,
        totalAmount,
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
