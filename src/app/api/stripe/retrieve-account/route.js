import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("❌ STRIPE_SECRET_KEY is required but not set in environment");
}

console.log("🔵 Using Stripe key (retrieve-account):", stripeSecretKey.slice(0, 18) + "...");

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return Response.json({ error: 'accountId is required.' }, { status: 400 });
    }

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

    const needsDocumentVerification = requirementsCurrentlyDue.some((req) =>
      req.startsWith('individual.verification.document')
    );

    return Response.json({
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements_due: requirementsDue,
      requirements_currently_due: requirementsCurrentlyDue,
      requirements_eventually_due: requirementsEventuallyDue,
      needsBankAccount,
      needsTosAcceptance,
      needsDocumentVerification,
    });
  } catch (err) {
    console.error('Stripe retrieve-account error:', err);
    return Response.json(
      { error: err.message || 'Failed to retrieve account' },
      { status: 500 }
    );
  }
}
