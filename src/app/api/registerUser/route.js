import { NextResponse } from "next/server";
import admin from "firebase-admin";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: "https://norland-a7730-default-rtdb.firebaseio.com",
  });
}

const db = admin.firestore();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("❌ STRIPE_SECRET_KEY is required but not set in environment");
}

console.log("🔵 Using Stripe key:", stripeSecretKey.slice(0, 18) + "...");

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2022-11-15",
});

export async function POST(req) {
  try {
    const { email, password, fullName, phone, photoURL, role } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
      photoURL: photoURL || null,
    });

    const newClientId = userRecord.uid;
    const userTag = `#${uuidv4().slice(0, 8)}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;

    let stripeConnectId = null;
    let stripeConnectEmail = null;
    let stripeConnectAt = null;

    if (role === "seller") {
      try {
        console.log(
        "🔵 Stripe onboarding started for clientId:",
        newClientId,
        "email:",
        email,
        "secretKey:",
        stripeSecretKey.slice(0, 18) + "...",
        "(from .env.local)"
      );
        const account = await stripe.accounts.create({
          type: "express",
          country: "NO",
          email,
          business_profile: {
            name: fullName || "NORYA Seller",
            url: appUrl,
          },
        });

        stripeConnectId = account.id;
        stripeConnectEmail = email;
        stripeConnectAt = new Date().toISOString();
      } catch (stripeErr) {
        console.error("Stripe Connect creation failed during registration:", stripeErr);
      }
    }

    const userData = {
      uid: userRecord.uid,
      email,
      fullName,
      displayName: fullName,
      phone: phone || null,
      photoURL: photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userTag,
      role: role || "civilian",
      stripeConnectId: stripeConnectId,
      stripeConnectEmail: stripeConnectEmail,
      stripeConnectAt: stripeConnectAt,
    };

    const publicUserData = {
      fullName,
      displayName: fullName,
      photoURL: photoURL || null,
      uid: userRecord.uid,
      role: role || "civilian",
      stripeConnectId: stripeConnectId,
    };

    await db.collection("users").doc(userRecord.uid).set(userData);
    await db.collection("publicUsers").doc(userRecord.uid).set(publicUserData);

    return NextResponse.json({ success: true, uid: userRecord.uid, userTag, role: role || "civilian" });
  } catch (err) {
    console.error("Error creating user:", err);

    if (err.code === "auth/email-already-in-use") {
      return NextResponse.json(
        {
          error: "Denne e-posten er allerede registrert. Logg inn i stedet, eller slett kontoen din fra profilen.",
          code: "email-already-in-use",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
