'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/authContext';
import Link from 'next/link';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Cormorant_Garamond, Space_Grotesk } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function CustomerProfile() {
  const { user, handleSignOut } = useAuth();
  const auth = getAuth();
  const db = getFirestore();

  const [profileThemeId, setProfileThemeId] = useState('fjord');
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  const firebaseUser = auth.currentUser;
  const effectiveName = firebaseUser?.displayName || user?.email || 'Uten navn';
  const profilePic = firebaseUser?.photoURL || '';

  useEffect(() => {
    async function fetchTheme() {
      if (!firebaseUser?.uid) return;
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data()?.profileThemeId) {
          setProfileThemeId(userSnap.data().profileThemeId);
        }
      } catch (error) {
        console.error('Error fetching profile theme:', error);
      }
    }

    fetchTheme();
  }, [db, firebaseUser]);

  useEffect(() => {
    async function fetchFavorites() {
      if (!firebaseUser?.uid) {
        setLoadingFavorites(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
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
          setFavoriteProducts(json.data.filter((p) => favoriteIds.includes(p.id)));
        } else {
          setFavoriteProducts([]);
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
        setFavoriteProducts([]);
      } finally {
        setLoadingFavorites(false);
      }
    }

    fetchFavorites();
  }, [db, firebaseUser]);

  const activeTheme = PROFILE_THEMES.find((theme) => theme.id === profileThemeId) || PROFILE_THEMES[0];
  const profileSurfaceStyle = {
    background: activeTheme.surface,
  };

  const onSignOut = async () => {
    await handleSignOut();
  };

  return (
    <div
      className={`${spaceGrotesk.className} relative min-h-screen px-4 pb-16 pt-32 text-slate-900 sm:px-8`}
      style={profileSurfaceStyle}
    >
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-12">
        {user && (
          <>
            <section className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="pt-2">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <div className="relative h-28 w-28 shrink-0">
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
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Profil</p>
                    <h1 className={`${cormorant.className} mt-2 text-2xl font-semibold text-slate-900`}>
                      {effectiveName}
                    </h1>
                    <p className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">
                      {firebaseUser?.email || ''}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/products/cart"
                    className="rounded-full border px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
                    style={{ backgroundColor: activeTheme.accent, borderColor: activeTheme.accent }}
                  >
                    Handlekurv
                  </Link>
                  <Link
                    href="/products"
                    className="rounded-full border border-slate-300 bg-white/60 px-5 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-white"
                  >
                    Utforsk produkter
                  </Link>
                </div>

                <div className="mt-4">
                  <button
                    onClick={onSignOut}
                    className="rounded-full border border-slate-300 bg-white/60 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
                  >
                    Logg Ut
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                  Tema
                </div>
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
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: activeTheme.accent }}
                />
                Favoritter
              </div>

              {loadingFavorites ? (
                <p className="text-slate-600">Laster favoritter...</p>
              ) : favoriteProducts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Ingen favoritter funnet. Gå til produkter og legg til favoritter for å vise dem her.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {favoriteProducts.map((favorite) => (
                    <a
                      key={favorite.id}
                      href={`/products/${favorite.id}`}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)]"
                    >
                      <div className="overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={favorite.images?.[0] || '/placeholder.jpg'}
                          alt={favorite.name}
                          className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="pt-3">
                        <div className="truncate text-base font-semibold text-slate-900">
                          {favorite.name || 'Ukjent produkt'}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {favorite.currency?.toUpperCase() || 'NOK'} {favorite.price ?? 0}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!user && (
          <section className="mx-auto w-full max-w-3xl pt-2">
            <div className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Profiltilgang
            </div>
            <h1 className={`${cormorant.className} text-2xl font-semibold text-slate-900`}>Min Profil</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Logg inn eller opprett bruker for å administrere profil, favoritter og handlekurv.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth"
                className="rounded-full border px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
                style={{ backgroundColor: activeTheme.accent, borderColor: activeTheme.accent }}
              >
                Logg inn
              </Link>
              <Link
                href="/auth"
                className="rounded-full border border-slate-300 bg-white/60 px-5 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Opprett konto
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
