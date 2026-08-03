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

    console.log("🔵 [simulate-verification] Creating test identity document for account:", accountId);

    // Create a test identity document file
    const file = await stripe.files.create({
      purpose: "identity_document",
    });

    console.log("🔵 [simulate-verification] Created test file:", file.id);

    // Attach the test file to the connected account
    const updatedAccount = await stripe.accounts.update(accountId, {
      individual: {
        verification: {
          document: {
            front: file.id,
            back: file.id,
          },
        },
      },
    });

    console.log("✅ [simulate-verification] Account updated:", updatedAccount.id);
    console.log("   charges_enabled:", updatedAccount.charges_enabled);
    console.log("   payouts_enabled:", updatedAccount.payouts_enabled);
    console.log("   requirements.currently_due:", updatedAccount.requirements?.currently_due || []);
    console.log("   requirements.eventually_due:", updatedAccount.requirements?.eventually_due || []);

    return new Response(
      JSON.stringify({
        success: true,
        accountId: updatedAccount.id,
        charges_enabled: updatedAccount.charges_enabled,
        payouts_enabled: updatedAccount.payouts_enabled,
        requirements_currently_due: updatedAccount.requirements?.currently_due || [],
        requirements_eventually_due: updatedAccount.requirements?.eventually_due || [],
        fileId: file.id,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ [simulate-verification] error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to simulate verification" }),
      { status: 500 }
    );
  }
}
