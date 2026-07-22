import { NextResponse } from "next/server";
import admin from "firebase-admin";
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

export async function POST(req) {
  try {
    const { email, role } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-post er påkrevd" }, { status: 400 });
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      userRecord = await admin.auth().createUser({ email });
      const userTag = `#${uuidv4().slice(0, 8)}`;
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        fullName: "",
        displayName: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userTag,
        role: role || "civilian",
      });
    }

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error("Magic link error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
