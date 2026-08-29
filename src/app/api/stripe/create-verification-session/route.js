import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error("❌ STRIPE_SECRET_KEY is required but not set in environment");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId is required." }),
        { status: 400 }
      );
    }

    const isTestMode = stripeSecret.startsWith("sk_test_");

    if (!isTestMode) {
      return new Response(
        JSON.stringify({ error: "Simulated verification is only available in test mode." }),
        { status: 400 }
      );
    }

    console.log("🔵 [create-verification-session] Creating VerificationSession for account:", accountId);

    // Create an Identity VerificationSession
    // This creates a Stripe-hosted KYC flow where the seller uploads documents
    // In test mode, they can upload Stripe's test verification images
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: ["driving_license", "id_card", "passport"],
        },
      },
    }, {
      stripeAccount: accountId,
    });

    console.log("✅ [create-verification-session] Created session:", session.id);
    console.log("   client_secret:", session.client_secret);

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: session.client_secret,
        sessionId: session.id,
        accountId,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ [create-verification-session] error:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to create verification session",
        type: err.type || "unknown",
        code: err.code || "unknown",
      }),
      { status: 500 }
    );
  }
}
