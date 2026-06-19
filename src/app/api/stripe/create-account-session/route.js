import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15',
});

export async function POST(req) {
  try {
    const { userId, email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required.' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'NO',
      email,
      business_profile: {
        name: userId,
        url: appUrl,
      },
    });

    const session = await stripe.accountSessions.create({
      account: account.id,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return Response.json({
      client_secret: session.client_secret,
      accountId: account.id,
    });
  } catch (err) {
    console.error('Stripe create-account-session error:', err);
    return Response.json(
      { error: err.message || 'Failed to create account session' },
      { status: 500 }
    );
  }
}
