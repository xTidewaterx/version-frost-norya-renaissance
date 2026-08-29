import { NextResponse } from "next/server";
import { authAdmin, db } from "../../lib/firebaseAdmin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function verifyToken(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await authAdmin.verifyIdToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const decoded = await verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = decoded.uid;
    const { lookupEmail } = await req.json().catch(() => ({}));

    let targetUid = uid;

    // If admin sends lookupEmail, find and delete that user instead
    if (lookupEmail && decoded.admin === true) {
      try {
        const userRecord = await authAdmin.getUserByEmail(lookupEmail);
        targetUid = userRecord.uid;
        console.log("🔍 [delete-account] Found user by email:", lookupEmail, "→", targetUid);
      } catch (lookupErr) {
        console.error("❌ [delete-account] User not found by email:", lookupEmail);
        return NextResponse.json({ error: "User not found by email" }, { status: 404 });
      }
    }

    // Look up user document to get Stripe Connect account ID
    const userDoc = await db.collection("users").doc(targetUid).get();
    if (!userDoc.exists) {
      console.warn("⚠️ [delete-account] User doc not found, user may have been partially deleted:", targetUid);
    }

    const userData = userDoc.exists ? userDoc.data() : {};
    const stripeConnectId = userData.stripeConnectId || userData.stripeAccountId || null;

    const errors = [];

    // 1. Delete from Stripe (if connected account exists)
    if (stripeConnectId) {
      try {
        await stripe.accounts.del(stripeConnectId);
        console.log("✅ [delete-account] Deleted Stripe account:", stripeConnectId);
      } catch (stripeErr) {
        console.error("❌ [delete-account] Failed to delete Stripe account:", stripeErr.message);
        errors.push(`Stripe: ${stripeErr.message}`);
      }
    }

    // 2. Delete from Firestore (users + publicUsers)
    try {
      await db.collection("users").doc(targetUid).delete();
      console.log("✅ [delete-account] Deleted Firestore user doc:", targetUid);
    } catch (firestoreErr) {
      console.error("❌ [delete-account] Failed to delete Firestore user:", firestoreErr.message);
      errors.push(`Firestore: ${firestoreErr.message}`);
    }

    try {
      await db.collection("publicUsers").doc(targetUid).delete();
      console.log("✅ [delete-account] Deleted Firestore publicUser doc:", targetUid);
    } catch (firestoreErr) {
      console.error("❌ [delete-account] Failed to delete publicUser:", firestoreErr.message);
      errors.push(`Firestore public: ${firestoreErr.message}`);
    }

    // Also clean up favourites subcollection
    try {
      const favSnap = await db.collection("users").doc(targetUid).collection("favourites").get();
      const batch = db.batch();
      favSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch {
      // non-fatal
    }

    // 3. Delete from Firebase Auth
    try {
      await authAdmin.deleteUser(targetUid);
      console.log("✅ [delete-account] Deleted Firebase Auth user:", targetUid);
    } catch (authErr) {
      console.error("❌ [delete-account] Failed to delete Firebase Auth user:", authErr.message);
      errors.push(`Auth: ${authErr.message}`);
    }

    return NextResponse.json({
      success: true,
      stripeDeleted: !!stripeConnectId,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("❌ [delete-account] unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
