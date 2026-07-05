"use client";

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  onAuthStateChanged,
  getAuth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { app, auth, provider } from "../../firebase/firebaseConfig";

export function GoogleSignIn({ role }) {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const db = getFirestore(app);
  const firebaseAuth = getAuth(app);
useEffect(() => {
  const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        await firebaseUser.getIdToken(true);
        setUser(firebaseUser);
        console.log("🔄 Token refreshed for:", firebaseUser.email);

        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || "",
            role: role || "civilian",
            createdAt: new Date(),
          });
          const publicUserRef2 = doc(db, "publicUsers", firebaseUser.uid);
          await setDoc(publicUserRef2, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || "",
            role: role || "civilian",
          });
          console.log("📦 Firestore profile created for:", firebaseUser.email);
        }
      } catch (err) {
        console.warn("⚠️ Token refresh failed:", err);
        setUser(null);
        await firebaseAuth.signOut();
      }
    } else {
      setUser(null);
    }
  });

  return () => unsubscribe();
  // ✅ Leave dependency array empty to avoid size-change warning
}, []); 

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const signedInUser = result.user;

      // ✅ Force a new token right away
      await signedInUser.getIdToken(true);

      // ✅ Firestore sync (for first-time users)
      const userRef = doc(db, "users", signedInUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
          const userRole = role || "civilian";
          await setDoc(userRef, {
            uid: signedInUser.uid,
            email: signedInUser.email,
            displayName: signedInUser.displayName || "",
            photoURL: signedInUser.photoURL || "",
            role: userRole,
            createdAt: new Date(),
          });
          const publicUserRef = doc(db, "publicUsers", signedInUser.uid);
          await setDoc(publicUserRef, {
            uid: signedInUser.uid,
            email: signedInUser.email,
            displayName: signedInUser.displayName || "",
            photoURL: signedInUser.photoURL || "",
            role: userRole,
          });
          console.log("📦 Firestore profile created for:", signedInUser.email);
        }
    
      setUser(signedInUser);
      setErrorMessage("");
      console.log("✅ Google sign-in successful:", signedInUser.email);
    } catch (error) {
      setErrorMessage(error.message);
      console.error("❌ Google sign-in error:", error.message);
    }
  };

  return (
    <>
      {!user && (
        <button
          onClick={handleGoogleSignIn}
          className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white flex items-center justify-center gap-2"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google logo"
            className="w-5 h-5"
          />
          Fortsett med Google
        </button>
      )}
      {errorMessage && (
        <p className="text-sm text-red-500 text-center">{errorMessage}</p>
      )}
    </>
  );
}