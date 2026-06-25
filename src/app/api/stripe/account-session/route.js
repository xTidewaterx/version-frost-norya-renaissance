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

    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      },
    });

    return Response.json({
      client_secret: session.client_secret,
      accountId,
    });
  } catch (err) {
    console.error('Stripe account-session error:', err);
    return Response.json(
      { error: err.message || 'Failed to create account session' },
      { status: 500 }
    );
  }
}
