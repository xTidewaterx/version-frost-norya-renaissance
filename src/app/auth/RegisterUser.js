"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../../firebase/firebaseConfig";
import { auth } from "../../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getCroppedImg } from "../utils/cropImage";
import "../globals.css";
import { GoogleSignIn } from "./GoogleSignIn";
import OnboardingNotice from "../components/OnboardingNotice";

const DEFAULT_AVATAR_URL =
  "https://firebasestorage.googleapis.com/v0/b/norland-a7730.appspot.com/o/profile%2FA%20rectangular%20default%20profile%20edit.png?alt=media&token=f00d3c5c-4d54-4af8-8f89-dba56cefb708";

export const RegisterUser = ({ defaultRole }) => {
  const [authObject, setAuthObject] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    role: defaultRole || "civilian",
  });

  useEffect(() => {
    if (defaultRole) {
      setAuthObject((prev) => ({ ...prev, role: defaultRole }));
    }
  }, [defaultRole]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const [imageSrc, setImageSrc] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showCropper, setShowCropper] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAuthObject((prev) => ({ ...prev, [name]: value }));
    setError("");
    setSuccess("");
  };

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const showCroppedImage = async () => {
    if (imageSrc && croppedAreaPixels) {
      try {
        const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
        const url = URL.createObjectURL(blob);
        setCroppedImage(url);
        setShowCropper(false);
      } catch (err) {
        setError("Image crop failed.");
      }
    }
  };

  const handleRegister = async () => {
    const { email, password, confirmPassword, fullName, phone, role } = authObject;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const pendingProfilePic = croppedImage;

    try {
      const res = await fetch("/api/registerUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, phone, photoURL: DEFAULT_AVATAR_URL, role }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Account created! Your user tag is ${data.userTag}`);
        setError("");

        try {
          await signInWithEmailAndPassword(auth, email, password);

          if (pendingProfilePic && data.uid) {
            try {
              const blob = await (await fetch(pendingProfilePic)).blob();
              const storage = getStorage(app);
              const imageRef = ref(storage, `profilePics/${data.uid}/profile.jpg`);
              await uploadBytes(imageRef, blob);
              const downloadURL = await getDownloadURL(imageRef);

              const currentUser = auth.currentUser;
              if (currentUser) {
                await fetch("/api/updateProfile", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${await currentUser.getIdToken()}`,
                  },
                  body: JSON.stringify({ photoURL: downloadURL }),
                });
              }
            } catch (uploadErr) {
              console.warn("Profile pic upload after login failed:", uploadErr);
            }
          }
        } catch (err) {
          console.error("Auto-login failed:", err);
        }

        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setError(data.error || "Failed to create account");
        setSuccess("");
      }
    } catch (err) {
      console.error("Frontend error:", err);
      setError("Something went wrong");
      setSuccess("");
    }
  };

  //Asynchronous code lets a program start a task and continue running without waiting for that task to finish, improving efficiency and responsiveness.
 //await is what you use inside asynchronous code to pause execution until a promise (or async task) is finished, without blocking the rest of the program.
  return (
    <section className="bg-[#F0F4F8] dark:bg-[#001A4A] min-h-screen flex flex-col items-center justify-start px-4 py-10 space-y-6">
      
      
  
      
      <div className="w-full max-w-md bg-white dark:bg-[#00205B] rounded-lg shadow-lg p-6 space-y-6">
        <div className="text-center">
          {croppedImage ? (
            <img src={croppedImage} className="w-24 h-24 rounded-full object-cover mx-auto" />
          ) : (
            <img src={DEFAULT_AVATAR_URL} className="w-12 h-12 rounded-full object-cover mx-auto" alt="Default Avatar" />
          )}
          <h1 className="text-2xl font-bold mt-2 text-[#00205B] dark:text-[#FFD100]">Create an account</h1>
        </div>

        <OnboardingNotice
          storageKey="norya_register_intro_seen"
          title="Velkommen til NORYA"
          buttonLabel="La oss starte"
        >
          Opprett bruker for å få din egen profilside. Når kontoen er klar, kan du legge ut produkter under Min Profil og begynne å selge.
        </OnboardingNotice>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {success && (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
              <svg className="w-10 h-10 text-green-500 animate-check-draw" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-500 text-sm font-medium">{success}</p>
          </div>
        )}

        <form className="space-y-4">
          <div className="flex flex-col items-center">
            <label htmlFor="profile-pic" className="cursor-pointer px-4 py-2 border border-[#FFD100] text-[#00205B] dark:text-[#FFD100] rounded-md hover:bg-[#00205B] hover:text-white transition">
              Choose Profile Picture
            </label>
            <input id="profile-pic" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>

          {showCropper && imageSrc && (
            <div className="relative w-full h-64 crop-container">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
              <div className="crop-overlay-circle"></div>
              <button type="button" className="absolute bottom-2 right-2 bg-[#00205B] text-white px-3 py-1 rounded hover:opacity-90 transition" onClick={showCroppedImage}>Crop</button>
            </div>
          )}

          <input name="fullName" value={authObject.fullName} onChange={handleChange} placeholder="Full Name" required className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
          <input name="email" type="email" value={authObject.email} onChange={handleChange} placeholder="Email" required className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
          <input name="phone" type="tel" value={authObject.phone} onChange={handleChange} placeholder="Phone (+47 12345678)" pattern="^\+?[0-9\s\-]{7,15}$" className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
          <input name="password" type="password" value={authObject.password} onChange={handleChange} placeholder="Password" minLength={6} required autoComplete="new-password" className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
          <input name="confirmPassword" type="password" value={authObject.confirmPassword} onChange={handleChange} placeholder="Confirm Password" minLength={6} required autoComplete="new-password" className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">Kontotype</label>
            {defaultRole ? (
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {defaultRole === 'seller' ? 'Selger' : 'Kunde'}
              </p>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAuthObject((prev) => ({ ...prev, role: "seller" }))}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    authObject.role === "seller"
                      ? "border-[#FFD100] bg-[#FFD100]/10 text-[#00205B] dark:text-[#FFD100]"
                      : "border-gray-300 bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  Selger
                </button>
                <button
                  type="button"
                  onClick={() => setAuthObject((prev) => ({ ...prev, role: "civilian" }))}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    authObject.role === "civilian"
                      ? "border-[#FFD100] bg-[#FFD100]/10 text-[#00205B] dark:text-[#FFD100]"
                      : "border-gray-300 bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  Kunde
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {authObject.role === "seller"
                ? "Som selger kan du publisere produkter og motta betalinger via Stripe Connect."
                : "Som kunde kan du kjøpe produkter og følge skapere."}
            </p>
          </div>

          <button type="button" onClick={handleRegister} className="w-full bg-[#00205B] hover:bg-[#001A4A] text-white py-2 rounded transition">
            Create Account
          </button>
        </form>
      </div>


    <div className="w-full max-w-md bg-white dark:bg-[#00205B] rounded-lg shadow-lg p-6 space-y-6">
        <p className="text-sm text-center text-slate-600 dark:text-slate-200">
          Tips: Google-innlogging fungerer også for skapere som vil publisere produkter senere.
        </p>
        <GoogleSignIn />
      </div>
      
    </section>
  );
};