import Stripe from "stripe";
import { authAdmin, db } from "../../../lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function verifyOwnerOrAdmin(req, stripeProductId) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    const product = await stripe.products.retrieve(stripeProductId);
    if (product.metadata?.creatorId === decoded.uid) return decoded;
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (userDoc.exists && userDoc.data().role === "admin") return decoded;
  } catch {
    // fall through
  }
  return null;
}

export async function POST(req) {
  try {
    console.log("✅ Received request at updateProduct.js");

    const { id, name, description, images, price, metadata } = await req.json();
    console.log("🧩 Parsed client request body:", { id, name, description, images, price, metadata });

    if (!id) {
      return new Response(JSON.stringify({ error: "Product ID is required" }), {
        status: 400,
      });
    }

    const decoded = await verifyOwnerOrAdmin(req, id);
    if (!decoded) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Retrieve existing product
    console.log("🔍 Retrieving existing product from Stripe...");
    const product = await stripe.products.retrieve(id);
    console.log("📦 Existing product found:", product.id);

    let sellerAccountId = product.metadata?.sellerAccountId || null;
    if (!sellerAccountId) {
      try {
        const userDoc = await db.collection("users").doc(decoded.uid).get();
        if (userDoc.exists) {
          sellerAccountId = userDoc.data().stripeConnectId || null;
        }
      } catch (err) {
        console.warn("⚠️ [updateProduct] Could not fetch stripeConnectId:", err.message);
      }
    }

    // Prepare update payload
    const productUpdatePayload = {
      name,
      description,
      images: images || [],
      metadata: {
        ...(product.metadata || {}),
        ...(metadata || {}),
        ...(sellerAccountId ? { sellerAccountId } : {}),
      },
    };

    // Optional: Update price if provided
    let newPriceData = null;
    if (price) {
      const parsedPrice = Math.round(Number(price) * 100); // Ensure integer in øre (Stripe requires cents)
      if (isNaN(parsedPrice)) {
        return new Response(JSON.stringify({ error: "Invalid price format" }), { status: 400 });
      }

      console.log("💰 Creating new Stripe price for product:", id);
      newPriceData = await stripe.prices.create({
        unit_amount: parsedPrice,
        currency: "nok",
        product: id,
      });

      productUpdatePayload.default_price = newPriceData.id;
      console.log("✅ New price created:", newPriceData.id);
    }

    // Update product
    console.log("🛠 Updating product on Stripe...");
    const updatedProduct = await stripe.products.update(id, productUpdatePayload);
    console.log("🎉 Stripe product updated successfully:", updatedProduct.id);

    return new Response(
      JSON.stringify({
        success: true,
        updatedProduct,
        newPrice: newPriceData,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error updating product:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
