'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getAuth, updateProfile } from 'firebase/auth';
import { getCroppedImg } from '../utils/cropImage';
import { useAuth } from '../auth/authContext';
import { RegisterUser } from '../auth/RegisterUser';
import { SignInUser } from '../auth/SignIn';
import PostProduct from '../post/PostProduct';
import { getFirestore, doc, collection, getDocs, getDoc } from 'firebase/firestore';
import { Space_Grotesk, Roboto } from 'next/font/google';
import OnboardingNotice from '../components/OnboardingNotice';
import PaymentInfo from '../components/PaymentInfo';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

const PROFILE_THEMES = [
  { id: 'fjord', name: 'Fjordbla', accent: '#1f4a58', surface: '#edf4f7', border: '#bfd3db' },
  { id: 'midnatt', name: 'Midnatt', accent: '#263248', surface: '#eef1f7', border: '#c7cfdf' },
  { id: 'skog', name: 'Skog', accent: '#315044', surface: '#edf5f1', border: '#c7ddd3' },
  { id: 'rav', name: 'Rav', accent: '#7a5322', surface: '#f8f1e8', border: '#e5d4be' },
  { id: 'plomme', name: 'Plomme', accent: '#4a355f', surface: '#f2eef8', border: '#d7cde9' },
  { id: 'stein', name: 'Stein', accent: '#4b5563', surface: '#f1f3f5', border: '#d5dbe2' },
  { id: 'kyst', name: 'Kyst', accent: '#005f73', surface: '#eaf5f7', border: '#bdd9de' },
  { id: 'vin', name: 'Vinrod', accent: '#6f2f3b', surface: '#f8ecef', border: '#e6c5cc' },
];

const hexToRgba = (hex, alpha) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ColorDot = ({ color, className = '' }) => (
  <span className={`inline-block h-3 w-3 rounded-full ${className}`} style={{ backgroundColor: color }} />
);

const ProductCard = ({ product, favorite = false }) => (
  <a href={`/products/${product.id}`} className="group block">
    <div className="aspect-[4/5] w-full overflow-hidden rounded-[1.35rem] bg-slate-100">
      <img
        src={product.images?.[0] || '/placeholder.jpg'}
        alt={favorite ? favorite.name : product.name}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
    <h3 className="mt-3 truncate text-sm font-semibold text-slate-900 sm:text-base">
      {favorite ? favorite.name || 'Ukjent Produkt' : product.name}
    </h3>
    <p className="mt-1 min-h-[2.25rem] text-xs text-slate-500">
      {favorite ? favorite.currency?.toUpperCase() || 'NOK' : product.currency?.toUpperCase() || 'NOK'}{' '}
      {favorite ? favorite.price ?? '0' : product.description || 'Ingen beskrivelse'}
    </p>
    {!favorite && (
      <p className="mt-1 text-sm font-bold text-slate-800">
        {product.currency?.toUpperCase() || 'NOK'} {product.price?.toLocaleString()}
      </p>
    )}
  </a>
);

const ImageCropUploader = () => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [showHalo, setShowHalo] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [profileThemeId, setProfileThemeId] = useState('fjord');

  const [creatorProducts, setCreatorProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [favoriteProducts, setFavoriteProducts] = useState([]);

  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();
  const user = auth.currentUser;
  const { user: contextUser } = useAuth();

  const effectiveName = user?.displayName || contextUser?.fullName || user?.email || 'Uten navn';
  const profilePic = user?.photoURL || '';

  useEffect(() => {
    const reloadUser = async () => {
      const current = auth.currentUser;
      if (current) {
        try {
          await current.reload();
        } catch (err) {
          console.error('Failed to reload user:', err);
        }
      }
    };
    reloadUser();
  }, [auth]);

  useEffect(() => {
    setShowHalo(true);
    const timer = setTimeout(() => setShowHalo(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const onCropComplete = useCallback((_, croppedArea) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageSrc(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!user) return;

    let downloadURL = profilePic;

    try {
      if (imageSrc && croppedAreaPixels) {
        const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
        const storageRef = ref(storage, `profilePics/${user.uid}.jpg`);
        await uploadBytes(storageRef, blob);
        downloadURL = await getDownloadURL(storageRef);
      }

      await updateProfile(user, {
        displayName: newName || user.displayName,
        photoURL: downloadURL,
      });

      const userDocRef = doc(db, 'users', user.uid);
      const publicUserDocRef = doc(db, 'publicUsers', user.uid);

      await Promise.all([
        updateDoc(userDocRef, {
          displayName: newName || user.displayName,
          photoURL: downloadURL,
          profileThemeId,
        }),
        updateDoc(publicUserDocRef, {
          displayName: newName || user.displayName,
          photoURL: downloadURL,
          profileThemeId,
        }),
      ]);

      alert('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  useEffect(() => {
    async function fetchProducts() {
      if (!user?.uid) return;
      try {
        console.log('attempting to fetch products from Next.js API route...');
        const res = await fetch('/api/products');
        const json = await res.json();

        if (json.data) {
          const filtered = json.data.filter(
            (product) => product.metadata?.creatorId === user.uid
          );
          setCreatorProducts(filtered);
        } else {
          console.warn('No data returned from API.');
          setCreatorProducts([]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setCreatorProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    }

    fetchProducts();
  }, [user]);

  useEffect(() => {
    async function fetchFavorites() {
      if (!user?.uid) return;
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const favouritesRef = collection(userDocRef, 'favourites');
        const snapshot = await getDocs(favouritesRef);
        const favoriteIds = snapshot.docs.map((doc) => doc.data().productId).filter(Boolean);

        if (favoriteIds.length === 0) {
          setFavoriteProducts([]);
          return;
        }

        const res = await fetch('/api/products');
        const json = await res.json();
        if (json.data) {
          const favoriteProducts = json.data.filter((p) => favoriteIds.includes(p.id));
          setFavoriteProducts(favoriteProducts);
        } else {
          setFavoriteProducts([]);
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
        setFavoriteProducts([]);
      }
    }

    fetchFavorites();
  }, [user]);

  useEffect(() => {
    async function fetchTheme() {
      if (!user?.uid) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data()?.profileThemeId) {
          setProfileThemeId(userSnap.data().profileThemeId);
        }
      } catch (error) {
        console.error('Error fetching profile theme:', error);
      }
    }

    fetchTheme();
  }, [db, user]);

  const activeTheme = PROFILE_THEMES.find((theme) => theme.id === profileThemeId) || PROFILE_THEMES[0];
  const profileSurfaceStyle = {
    background: activeTheme.surface,
  };

  const UploadProductIfSignedIn = () =>
    user?.uid ? (
      <>
        {!showNewProduct ? (
            <button
              onClick={() => setShowNewProduct(true)}
              className="inline-flex items-center rounded-full border px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
              style={{ backgroundColor: activeTheme.accent, borderColor: activeTheme.accent }}
            >
              Nytt Produkt
            </button>
        ) : (
          <div className="rounded-[1.35rem] bg-white/55 p-5 sm:p-6">
            <PostProduct />
            <button
              onClick={() => setShowNewProduct(false)}
              className="mt-5 w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Lukk
            </button>
          </div>
        )}
      </>
    ) : null;

  return (
    <div className={`${spaceGrotesk.className} relative min-h-screen overflow-hidden px-4 pb-16 pt-32 text-slate-900 sm:px-8`} style={profileSurfaceStyle}>
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-14">
        {user && (
          <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="pt-2">
              {!editing ? (
                <>
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                    <div className="relative h-28 w-28 shrink-0">
                      {showHalo && <div className="animate-glow absolute inset-0 rounded-full bg-slate-300/30 blur-xl"></div>}
                      {profilePic ? (
                        <img
                          src={profilePic}
                          alt="Profil"
                          className="relative z-10 h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-white/70 text-2xl font-semibold text-slate-500">
                          {effectiveName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="text-center sm:text-left">
                      <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Profiloversikt</p>
      <h1 className={`${roboto.className} mt-2 text-2xl font-semibold text-slate-900`}>{effectiveName}</h1>
      <div className="mt-3 text-center text-xs font-medium text-slate-500 sm:text-left">
        Tema: {activeTheme.name}
      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-full border px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
                      style={{ backgroundColor: activeTheme.accent, borderColor: activeTheme.accent }}
                    >
                      Rediger Profil
                    </button>
                    <button
                      onClick={async () => {
                        await auth.signOut();
                        alert('Du er logget ut.');
                      }}
                      className="rounded-full border border-slate-300 bg-white/60 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
                    >
                      Logg Ut
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                    Redigeringsmodus
                  </div>
                  <h1 className={`${roboto.className} text-2xl font-semibold text-slate-900`}>
                    Oppdater <span className="text-slate-700">{effectiveName}</span>
                  </h1>

                  <div className="mt-6 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Visningsnavn</label>
                      <input
                        className="w-full rounded-full border border-slate-300 bg-white/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Skriv nytt navn"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Profilbilde</label>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full text-sm file:mr-4 file:rounded-full file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-slate-700 hover:file:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Profilfarge</label>
                      <div className="flex flex-wrap gap-3">
                        {PROFILE_THEMES.map((theme) => {
                          const selected = theme.id === profileThemeId;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => setProfileThemeId(theme.id)}
                              title={theme.name}
                              aria-label={`Velg ${theme.name}`}
                              className="h-6 w-6 rounded-full transition hover:scale-110"
                              style={{
                                backgroundColor: theme.accent,
                                boxShadow: selected ? `0 0 0 3px ${hexToRgba(theme.accent, 0.22)}` : 'none',
                              }}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Denne fargen brukes kun pa profilsider.</p>
                    </div>

                    {imageSrc && (
                      <div className="relative aspect-square w-full overflow-hidden rounded-[1.35rem] bg-slate-100">
                        <Cropper
                          image={imageSrc}
                          crop={crop}
                          zoom={zoom}
                          cropShape="round"
                          aspect={1}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={onCropComplete}
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleUpload}
                        className="flex-1 rounded-full border px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
                        style={{ backgroundColor: activeTheme.accent, borderColor: activeTheme.accent }}
                      >
                        Lagre
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex-1 rounded-full border border-slate-300 bg-white/60 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

          </section>
        )}

        {!user && (
          <section className="mx-auto w-full max-w-3xl pt-2">
            <div className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Profiltilgang
            </div>
            <h1 className={`${roboto.className} text-2xl font-semibold text-slate-900`}>Min Profil</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Logg inn eller opprett bruker for å administrere profil, produkter og favoritter.
            </p>

            <div className="mt-6">
              <OnboardingNotice
                storageKey="norya_profile_access_intro_seen"
                title="Ny bruker?"
                buttonLabel="Ok"
              >
                Start med å registrere deg eller logge inn. Etterpå får du tilgang til profil, favoritter og verktøy for å publisere produkter.
              </OnboardingNotice>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <SignInUser />
              </div>
              <div>
                <RegisterUser />
              </div>
            </div>
          </section>
        )}

        {user && (
          <section className="grid gap-12 xl:grid-cols-2">
            <div>
              <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                <ColorDot color={activeTheme.accent} />
                Produkter
              </div>

              {loadingProducts ? (
                <p className="text-slate-600">Laster produkter...</p>
              ) : creatorProducts.length === 0 ? (
                <p className="border-t border-slate-900/8 pt-4 text-sm text-slate-600">Ingen produkter funnet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {creatorProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                <ColorDot color={activeTheme.accent} />
                Favoritter
              </div>

              {favoriteProducts.length === 0 ? (
                <p className="border-t border-slate-900/8 pt-4 text-sm text-slate-600">
                  Ingen favoritter funnet. Gå til Produkter og legg til favoritter for å vise dem her.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {favoriteProducts.map((favorite) => (
                    <ProductCard key={favorite.id} product={favorite} favorite />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {user && (
          <section className="pt-2">
            <h2 className={`${roboto.className} mb-5 text-2xl font-semibold text-slate-900`}>Nytt produkt</h2>
            <OnboardingNotice
              storageKey="norya_creator_tools_intro_seen"
              title="Skaperveiledning"
              buttonLabel="Klar"
              className="mb-6"
            >
              Trykk Nytt Produkt for å åpne publiseringsskjemaet. Du kan når som helst redigere eksisterende produkter fra produktkortene under.
            </OnboardingNotice>
            <UploadProductIfSignedIn />
          </section>
        )}

        {user && (
          <section className="pt-2">
            <PaymentInfo activeTheme={activeTheme} />
          </section>
        )}
      </main>

      <style jsx>{`
        @keyframes glow {
          0% { transform: scale(0.82); opacity: 0; }
          25% { transform: scale(1); opacity: 0.55; }
          55% { transform: scale(1.18); opacity: 0.4; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        .animate-glow {
          animation: glow 2.7s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ImageCropUploader;
