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
    const { accountId, amount = 50000, currency = "nok" } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId is required." }),
        { status: 400 }
      );
    }

    const isTestMode = stripeSecret.startsWith("sk_test_");

    if (!isTestMode) {
      return new Response(
        JSON.stringify({ error: "Test funding is only available in test mode." }),
        { status: 400 }
      );
    }

    console.log("🔵 [add-funds] Setting up test funding for account:", accountId);

    // Step 1: Ensure transfers + card_payments capabilities are requested and active
    // For Express accounts, the platform can request capabilities via stripe.accounts.update
    // In test mode, they auto-activate without KYC
    await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    console.log("✅ [add-funds] Requested card_payments and transfers capabilities");

    // Step 2: Wait for capabilities to activate (test mode auto-activates)
    // Poll account status up to 5 times (5 seconds total)
    let capsActive = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const account = await stripe.accounts.retrieve(accountId);
      const caps = account.capabilities || {};

      const transfersCap = caps.transfers || {};
      const cardPaymentsCap = caps.card_payments || {};

      console.log(`🔍 [add-funds] Capability status (attempt ${i + 1}):`, {
        transfers: transfersCap.status,
        card_payments: cardPaymentsCap.status,
      });

      if (transfersCap.status === 'active' && cardPaymentsCap.status === 'active') {
        capsActive = true;
        break;
      }
    }

    if (!capsActive) {
      console.log("⚠️ [add-funds] Capabilities did not become active after polling — will still attempt payment");
    }

    // Step 3: Attempt test verification tokens (works for Custom accounts)
    try {
      await stripe.accounts.update(accountId, {
        individual: {
          verification: {
            document: {
              front: "file_identity_document_success",
              back: "file_identity_document_success",
            },
          },
        },
      });
      console.log("✅ [add-funds] Applied test verification tokens");
    } catch (verifErr) {
      console.log("ℹ️ [add-funds] Verification token update skipped (expected for Express accounts)");
    }

    // Step 4: Attempt test individual details (works for Custom accounts)
    try {
      await stripe.accounts.update(accountId, {
        individual: {
          first_name: "Test",
          last_name: "Seller",
          email: "test@example.com",
          dob: { day: 1, month: 1, year: 1990 },
          address: {
            line1: "Test Street 123",
            city: "Oslo",
            postal_code: "0001",
            country: "NO",
          },
        },
      });
      console.log("✅ [add-funds] Applied test individual details");
    } catch (indivErr) {
      console.log("ℹ️ [add-funds] Individual update skipped (expected for Express accounts)");
    }

    // Step 5: Create a test PaymentIntent with on_behalf_of + transfer_data
    // This creates a charge that appears in the connected account's Dashboard
    console.log("🔵 [add-funds] Creating PaymentIntent...");
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency.toLowerCase(),
      payment_method_types: ["card"],
      payment_method: "pm_card_visa",
      confirm: true,
      off_session: true,
      on_behalf_of: accountId,
      transfer_data: {
        destination: accountId,
      },
    });

    console.log("✅ [add-funds] PaymentIntent created:", paymentIntent.id, "status:", paymentIntent.status);

    // Retrieve the connected account to check updated status
    const account = await stripe.accounts.retrieve(accountId);

    return new Response(
      JSON.stringify({
        success: true,
        paymentIntentId: paymentIntent.id,
        paymentIntentStatus: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        capabilities: account.capabilities,
        requirements_currently_due: account.requirements?.currently_due || [],
        requirements_eventually_due: account.requirements?.eventually_due || [],
        available_balance: account.balance?.available?.[0]?.amount || 0,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ [add-funds] error:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to add funds",
        type: err.type || "unknown",
        code: err.code || "unknown",
        param: err.param || undefined,
      }),
      { status: 500 }
    );
  }
}
