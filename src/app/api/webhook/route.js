import Stripe from "stripe";
import { headers } from "next/headers";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function normalizeCountryCode(countryInput) {
  if (!countryInput) return "NO";
  const input = countryInput.toString().trim().toUpperCase();

  const countryMap = {
    'DANMARK': 'DK',
    'DENMARK': 'DK',
    'NORGE': 'NO',
    'NORWAY': 'NO',
    'SVERIGE': 'SE',
    'SWEDEN': 'SE',
    'FINLAND': 'FI',
    'SUOMI': 'FI',
    'DK': 'DK',
    'NO': 'NO',
    'SE': 'SE',
    'FI': 'FI',
  };

  return countryMap[input] || input.slice(0, 2).toUpperCase() || "NO";
}

async function syncAccountToUser(account) {
  try {
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');
    // This would sync account status back to the user document
    console.log("🔄 Sync account to user:", {
      accountId: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements_due: account.requirements?.currently_due,
    });
  } catch (err) {
    console.error("Failed to sync account:", err);
  }
}

export async function POST(req) {
  const body = await req.arrayBuffer();
  const rawBody = Buffer.from(body);
  const signature = headers().get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("📥 Webhook received:", event.type, event.data?.object?.id);

  switch (event.type) {
    case "charge.succeeded":
      console.log("💰 Charge succeeded:", event.data.object.id);
      break;

    case "payment_intent.succeeded":
      console.log("✨ Payment Intent success:", event.data.object.id);

      try {
        const metadata = event.data.object.metadata || {};
        if (metadata.shipping) {
          let shippingInfo = {};
          try {
            shippingInfo = JSON.parse(metadata.shipping);
          } catch (e) {
            console.warn("Could not parse shipping metadata:", e.message);
            shippingInfo = { raw: metadata.shipping };
          }

          const customerData = shippingInfo.customerData || {};

          const address1 = customerData.street
            ? `${customerData.street} ${customerData.streetNumber || ''}`.trim()
            : (customerData.address || shippingInfo.address || "");

          const shipmentRequest = {
            reference: `Order ${event.data.object.id}`,
            parties: [
              {
                type: "sender",
                name: process.env.SHIPMENT_SENDER_NAME || "NORYA Sender",
                address1: process.env.SHIPMENT_SENDER_ADDRESS1 || "Sender Street 1",
                postal_code: process.env.SHIPMENT_SENDER_POSTCODE || "0000",
                city: process.env.SHIPMENT_SENDER_CITY || "Oslo",
                country_code: process.env.SHIPMENT_SENDER_COUNTRY || "NO",
                email: process.env.SHIPMENT_SENDER_EMAIL || "sender@example.com",
                phone: process.env.SHIPMENT_SENDER_PHONE || "+4712345678",
              },
              {
                type: "receiver",
                name: customerData.name || shippingInfo.name || "Receiver",
                address1: address1,
                postal_code: customerData.postcode || shippingInfo.postal_code || "0000",
                city: customerData.city || shippingInfo.city || "",
                country_code: normalizeCountryCode(customerData.country || shippingInfo.country || "NO"),
                email: customerData.email || shippingInfo.email || "",
                phone: customerData.phone || shippingInfo.phone || "",
              }
            ],
            parcels: [
              {
                weight: 1,
                length: 20,
                width: 15,
                height: 5,
              }
            ],
          };

          console.log("📦 Creating shipment:", {
            accountId: event.data.object.id,
            receiver: shipmentRequest.parties[1].name,
          });

          const resp = await fetch("/api/shipment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-shipment-secret": process.env.SHIPMENT_INTERNAL_SECRET || "",
            },
            body: JSON.stringify(shipmentRequest),
          });

          const respBody = await resp.text();
          console.log("✅ Shipment response:", resp.status, respBody.slice(0, 300));
        }
      } catch (err) {
        console.error("❌ Failed to create shipment:", err);
      }
      break;

    case "account.updated": {
      const account = event.data.object;
      console.log("✅ STRIPE CONNECT ACCOUNT UPDATED:", account.id);

      if (account.details_submitted) {
        console.log("📝 Account details submitted:", {
          accountId: account.id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        });
      }

      if (account.charges_enabled && account.payouts_enabled) {
        console.log("🎉 CONNECT ACCOUNT FULLY VERIFIED - READY FOR PAYOUTS:", {
          accountId: account.id,
          email: account.email,
          business_name: account.business_profile?.name,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          requirements_due: account.requirements?.currently_due?.length || 0,
        });
      }

      await syncAccountToUser(account);
      break;
    }

    case "identity.verification_session.created": {
      const verification = event.data.object;
      console.log("🆔 ID VERIFICATION SESSION CREATED:", verification.id, "for account:", verification.account);
      break;
    }

    case "identity.verification_session.completed": {
      const verification = event.data.object;
      console.log("🆔 ID VERIFICATION SESSION COMPLETED - SUCCESS:", verification.id, "status:", verification.status);
      break;
    }

    case "identity.verification_session.failed": {
      const verification = event.data.object;
      console.log("❌ ID VERIFICATION FAILED:", verification.id, "status:", verification.status, "last error:", verification.last_error?.message);
      break;
    }

    default:
      console.log("Unhandled event type:", event.type);
  }

  return new Response("OK", { status: 200 });
}