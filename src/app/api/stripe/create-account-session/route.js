import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error("❌ STRIPE_SECRET_KEY is required but not set in environment");
}

console.log("🔵 Using Stripe key:", stripeSecret.slice(0, 18) + "...");

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  try {
    const { userId, email, userName } = await req.json();

    console.log(
      "🔵 Stripe onboarding started for clientId:",
      userId,
      "email:",
      email,
      "secretKey:",
      stripeSecret.slice(0, 18) + "...",
      "(from .env.local)"
    );
    console.log("📝 Received Stripe Connect request:", { userId, email, userName });

    if (!userId || !email) {
      console.warn("Missing required fields:", { userId, email });
      return new Response(
        JSON.stringify({ error: "Missing userId or email" }),
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error("❌ Missing NEXT_PUBLIC_APP_URL");
      return new Response(
        JSON.stringify({ error: "Missing NEXT_PUBLIC_APP_URL" }),
        { status: 500 }
      );
    }

    let account;
    try {
      const accounts = await stripe.accounts.list({ limit: 100 });
      account = accounts.data.find((acc) => acc.email === email);

      if (account) {
        console.log("✅ Found existing account:", account.id);
      }
    } catch (e) {
      console.warn("Error checking existing accounts:", e.message);
    }

    if (!account) {
      console.log("🔄 Creating new Express Connect account for:", email);
      account = await stripe.accounts.create({
        type: "express",
        country: "NO",
        email,
        business_type: "individual",
        default_currency: "nok",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: userName || "NORYA Creator",
          url: appUrl,
        },
        metadata: {
          user_id: userId,
          platform: "NORYA",
        },
      });
      console.log("✅ Created new account:", account.id, "charges_enabled:", account.charges_enabled, "payouts_enabled:", account.payouts_enabled);
    }

    console.log("🔗 Creating account link for account:", account.id);
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/profile?stripe=refresh`,
      return_url: `${appUrl}/profile?stripe=success`,
      type: "account_onboarding",
    });

    console.log("✅ Account link created:", accountLink.url);

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        accountId: account.id,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ create-account-session error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Stripe error", type: err.type, code: err.code }),
      { status: 500 }
    );
  }
}