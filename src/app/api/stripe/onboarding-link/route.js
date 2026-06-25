import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
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

    const documentRequired = requirementsDue.some((req) =>
      req.startsWith('individual.verification.document')
    );

    if (!documentRequired) {
      return Response.json({ onboardingUrl: null });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`,
      type: 'account_onboarding',
    });

    return Response.json({ onboardingUrl: accountLink.url });
  } catch (err) {
    console.error('Stripe onboarding-link error:', err);
    return Response.json(
      { error: err.message || 'Failed to create onboarding link' },
      { status: 500 }
    );
  }
}