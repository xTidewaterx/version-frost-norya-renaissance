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
        JSON.stringify({ error: "Verification helper is only available in test mode." }),
        { status: 400 }
      );
    }

    console.log("🔵 [simulate-verification] Checking verification status for account:", accountId);

    // Express accounts cannot be verified server-side via API.
    // The seller must complete Stripe-hosted onboarding (which includes KYC)
    // and upload a test image in test mode.
    // This endpoint returns the current account status so the frontend can
    // determine whether verification is needed.
    const account = await stripe.accounts.retrieve(accountId);

    const isFullyVerified =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    return new Response(
      JSON.stringify({
        success: true,
        accountId: account.id,
        fullyVerified: isFullyVerified,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements_currently_due: account.requirements?.currently_due || [],
        requirements_eventually_due: account.requirements?.eventually_due || [],
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ [simulate-verification] error:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to check verification status",
        type: err.type || "unknown",
        code: err.code || "unknown",
      }),
      { status: 500 }
    );
  }
}
