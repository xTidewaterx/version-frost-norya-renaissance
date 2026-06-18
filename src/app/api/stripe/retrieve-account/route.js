import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15',
});

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return Response.json({ error: 'accountId is required.' }, { status: 400 });
    }

    const account = await stripe.accounts.retrieve(accountId);

    const requirementsDue = [];

    if (account.requirements?.currently_due) {
      requirementsDue.push(...account.requirements.currently_due);
    }
    if (account.requirements?.eventually_due) {
      requirementsDue.push(...account.requirements.eventually_due);
    }

    const needsBankAccount = requirementsDue.includes('external_account');
    const needsTosAcceptance =
      requirementsDue.includes('tos_acceptance.date') ||
      requirementsDue.includes('tos_acceptance.ip') ||
      account.tos_acceptance?.date == null ||
      account.tos_acceptance?.ip == null;

    return Response.json({
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements_due: requirementsDue,
      needsBankAccount,
      needsTosAcceptance,
    });
  } catch (err) {
    console.error('Stripe retrieve-account error:', err);
    return Response.json(
      { error: err.message || 'Failed to retrieve account' },
      { status: 500 }
    );
  }
}
