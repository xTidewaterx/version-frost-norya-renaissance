import { NextResponse } from "next/server";
import { withRateLimit } from "../lib/rateLimit";
import { stripe } from "@/lib/stripe";

const handler = async (req) => {
  try {
    const body = await req.json();
    const { productId, orderId, items, shipping, email, sellerEmail } = body;

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
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const APP_CURRENCY = (process.env.NEXT_PUBLIC_APP_CURRENCY || "nok").toLowerCase();
    const MIN_AMOUNT = 300;

    const finalOrderId = orderId || `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const resolvedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await stripe.products.retrieve(item.id);
      if (!product.default_price) {
        return NextResponse.json(
          { error: `Product ${item.id} has no valid price` },
          { status: 400 }
        );
      }
      const priceData = await stripe.prices.retrieve(product.default_price);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      resolvedItems.push({
        price_data: {
          currency: priceData.currency || APP_CURRENCY,
          product_data: { name: item.name || "Product" },
          unit_amount: priceData.unit_amount,
        },
        quantity,
      });
      totalAmount += priceData.unit_amount * quantity;
    }

    const shippingCost = Number(shipping?.cost) || 0;
    if (shippingCost > 0) {
      resolvedItems.push({
        price_data: {
          currency: APP_CURRENCY,
          product_data: { name: shipping?.name || "Shipping" },
          unit_amount: shippingCost,
        },
        quantity: 1,
      });
      totalAmount += shippingCost;
    }

    if (!Number.isInteger(totalAmount) || totalAmount < MIN_AMOUNT) {
      return NextResponse.json(
        { error: `Invalid total amount` },
        { status: 400 }
      );
    }

    const metadata = {
      orderId: finalOrderId,
      buyerEmail: (email || "").slice(0, 200),
      sellerEmail: (sellerEmail || "").slice(0, 200),
      items: JSON.stringify(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          sellerAccountId: i.sellerAccountId,
        }))
      ).slice(0, 4000),
    };

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: APP_CURRENCY,
        payment_method_types: ["card"],
        metadata,
        description: `NORYA order - ${resolvedItems.length} item(s)`,
        receipt_email: email,
      },
      { idempotencyKey: `order_${finalOrderId}` }
    );

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      orderId: finalOrderId,
    });
  } catch (err) {
    console.error("[stripe] create PaymentIntent error:", err.type, err.message);
    let status = 500;
    let userMsg = "Feil ved betaling. Prøv igjen.";
    if (err.type === "StripeInvalidRequestError") {
      status = 400;
      userMsg = `Ugyldig betalingsforespørsel: ${err.message}`;
    }
    return NextResponse.json({ error: userMsg }, { status });
  }
};

export const POST = withRateLimit(10, 60000)(handler);
