import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.error("❌ [retrieve-account] STRIPE_SECRET_KEY is missing");
}

const stripe = new Stripe(stripeSecret || "sk_test_placeholder", {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  console.log("🔵 [retrieve-account] handler invoked");

  try {
    const contentType = req.headers.get("content-type") || "";
    console.log("🔵 [retrieve-account] content-type:", contentType);

    let body = {};
    try {
      const text = await req.text();
      console.log("🔵 [retrieve-account] raw body length:", text.length);
      try {
        body = JSON.parse(text);
      } catch {
        console.error("❌ [retrieve-account] JSON parse failed");
        return new Response(
          JSON.stringify({ error: "Invalid JSON body. Expected { accountId: string }" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
    } catch (err) {
      console.error("❌ [retrieve-account] failed to read body:", err.message);
      return new Response(
        JSON.stringify({ error: "Failed to read request body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const accountId = body?.accountId;
    if (!accountId || typeof accountId !== "string") {
      console.error("❌ [retrieve-account] missing accountId");
      return new Response(
        JSON.stringify({ error: "accountId is required and must be a string." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    console.log("🔵 [retrieve-account] STRIPE_SECRET_KEY:", stripeSecret);
    console.log("🔵 [retrieve-account] accountId requested:", accountId);

    const account = await stripe.accounts.retrieve(accountId);

    const requirementsCurrentlyDue = account.requirements?.currently_due || [];
    const requirementsEventuallyDue = account.requirements?.eventually_due || [];
    const requirementsDue = [
      ...requirementsCurrentlyDue,
      ...requirementsEventuallyDue,
    ];

    const needsBankAccount = requirementsCurrentlyDue.includes('external_account');
    const needsTosAcceptance =
      requirementsCurrentlyDue.includes('tos_acceptance.date') ||
      requirementsCurrentlyDue.includes('tos_acceptance.ip') ||
      account.tos_acceptance?.date == null ||
      account.tos_acceptance?.ip == null;

    const needsDocumentVerification =
      requirementsCurrentlyDue.some((req) =>
        req.startsWith('individual.verification.document')
      ) ||
      requirementsEventuallyDue.some((req) =>
        req.startsWith('individual.verification.document')
      );

    const payload = {
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements_due: requirementsDue,
      requirements_currently_due: requirementsCurrentlyDue,
      requirements_eventually_due: requirementsEventuallyDue,
      needsBankAccount,
      needsTosAcceptance,
      needsDocumentVerification,
    };

    console.log("✅ [retrieve-account] retrieved:", accountId, payload);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("❌ [retrieve-account] error:", err);
    console.error("🔵 [retrieve-account] STRIPE_SECRET_KEY:", stripeSecret);

    const message = err?.message || "Failed to retrieve account";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
