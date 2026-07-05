import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export async function POST(req) {
  try {
    const { photoURL } = await req.json();

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    await admin.auth().updateUser(uid, { photoURL });

    const userDocRef = db.collection("users").doc(uid);
    const publicUserDocRef = db.collection("publicUsers").doc(uid);

    await Promise.all([
      userDocRef.update({ photoURL }),
      publicUserDocRef.update({ photoURL }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating profile:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}