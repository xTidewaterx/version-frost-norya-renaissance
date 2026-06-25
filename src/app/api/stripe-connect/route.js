import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("❌ STRIPE_SECRET_KEY is required but not set in environment");
}

console.log("🔵 Using Stripe key:", stripeSecretKey.slice(0, 18) + "...");

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  try {
    const { userId, userEmail, userName } = await req.json();
    console.log(
      "🔵 Stripe onboarding started for clientId:",
      userId,
      "email:",
      userEmail,
      "secretKey:",
      stripeSecretKey.slice(0, 18) + "...",
      "(from .env.local)"
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!stripe) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or userEmail' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!appUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing NEXT_PUBLIC_APP_URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let account;

    try {
      const accounts = await stripe.accounts.list({ limit: 100 });
      account = accounts.data.find((acc) => acc.email === userEmail);

      if (account) {
        console.log("Reusing existing account:", account.id);
      }
    } catch (e) {
      console.warn("Error checking existing accounts:", e.message);
    }

    if (!account) {
      account = await stripe.accounts.create({
        type: 'express',
        country: 'NO',
        email: userEmail,
        business_type: 'individual',
        default_currency: 'nok',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: userName || 'NORYA Creator',
          url: appUrl,
        },
        metadata: {
          user_id: userId,
          platform: 'NORYA',
        },
      });
      console.log('Created new account:', account.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: `${appUrl}/profile?stripe=refresh`,
      return_url: `${appUrl}/profile?stripe=success`,
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, accountId: account.id }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Stripe-connect error:', err);
    return new Response(
      JSON.stringify({ error: err.message, type: err.type, code: err.code }),
      { status: 500 }
    );
  }
}
