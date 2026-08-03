'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { app } from '../../firebase/firebaseConfig';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import OnboardingNotice from '../components/OnboardingNotice';

const db = getFirestore(app);

const TEMP_NORWAY_STOCK_PHOTOS = [
  'https://images.pexels.com/photos/3222422/pexels-photo-3222422.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1468379/pexels-photo-1468379.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1858175/pexels-photo-1858175.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1680172/pexels-photo-1680172.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/532220/pexels-photo-532220.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1200',
];

const getTempSellerPhoto = (index) => TEMP_NORWAY_STOCK_PHOTOS[index % TEMP_NORWAY_STOCK_PHOTOS.length];

const keyframes = `
@keyframes sellersCardReveal {
  from { opacity: 0; transform: translateY(48px) scale(0.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes sellersFadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sellersShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.seller-card {
  opacity: 0;
  animation: sellersCardReveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.seller-fade-up {
  opacity: 0;
  animation: sellersFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.seller-shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: sellersShimmer 1.5s infinite;
}

.animation-delay-100 { animation-delay: 0.1s; }
.animation-delay-200 { animation-delay: 0.2s; }
.animation-delay-300 { animation-delay: 0.3s; }
.animation-delay-400 { animation-delay: 0.4s; }
`;

export default function GetProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = querySnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setProfiles(users);
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
      } finally {
        setIsLoaded(true);
      }
    }

    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter((profile) =>
    profile.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <style>{keyframes}</style>
      <div className="min-h-screen bg-[#faf9f7]">
        {/* Hero Header - Apple style */}
        <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 md:px-12">
          <div className="max-w-7xl mx-auto text-center">
            <div className="seller-fade-up inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-[#1e3a5f]/[0.04]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
              <span className="text-xs font-semibold text-[#1e3a5f] tracking-[0.2em] uppercase">
                Håndverkere
              </span>
            </div>
            <h1 className="seller-fade-up animation-delay-100 font-serif text-5xl md:text-7xl lg:text-8xl text-[#1a1a1a] mb-6 font-light tracking-tight leading-[1.1]">
              Skapere
            </h1>
            <p className="seller-fade-up animation-delay-200 max-w-2xl mx-auto text-lg md:text-xl text-[#5a6767] leading-relaxed font-light">
              Møt de talentfulle skaperne som driver NORYA. Hver av dem bringer unik ekspertise og lidenskap til plattformen vår.
            </p>
          </div>
        </section>

        {/* Onboarding Notice */}
        <div className="max-w-3xl mx-auto px-6 md:px-12 mb-16 seller-fade-up animation-delay-300">
          <OnboardingNotice
            storageKey="norya_sellers_page_intro_seen"
            title="Vil du selge på NORYA?"
            buttonLabel="Skjønner"
          >
            Opprett eller logg inn på konto, gå til Min Profil, og trykk Nytt Produkt for å publisere dine første varer.
            <div className="mt-3">
              <Link href="/profile" className="font-semibold text-[#1e3a5f] underline underline-offset-4 hover:text-[#16354a] transition-colors">
                Gå til Min Profil
              </Link>
            </div>
          </OnboardingNotice>
        </div>

        {/* Creator Grid */}
        <section className="px-6 md:px-12 pb-32">
          <div className="max-w-7xl mx-auto">
            {/* Search - refined Apple style */}
            <div className="mb-12 flex justify-center seller-fade-up animation-delay-400">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Søk etter skaper..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-white border border-[#e6eae7] text-[#1f2a2a] placeholder-[#5a6767] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all duration-300 shadow-sm hover:shadow-md text-base"
                />
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a6767] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Cards Grid - Apple/Netflix style */}
            {isLoaded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {filteredProfiles.map((profile, index) => (
                  <Link
                    key={profile.id}
                    href={`/profile/${profile.id}`}
                    className="seller-card group block"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="relative bg-white rounded-[28px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 ease-out hover:-translate-y-1 border border-[#f0f0f0]">
                      {/* Image Card */}
                      <div className="relative aspect-[4/5] overflow-hidden bg-[#f7f8f6]">
                        <img
                          alt={profile.displayName || 'Profile'}
                          src={getTempSellerPhoto(index)}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        {/* Hover overlay with name */}
                        <div className="absolute inset-0 flex items-end p-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                          <span className="text-white font-serif text-lg drop-shadow-md">Se profil</span>
                        </div>
                      </div>

                      {/* Info Card */}
                      <div className="p-6">
                        <h3 className="font-serif text-xl md:text-2xl text-[#1a1a1a] mb-2 font-medium truncate">
                          {profile.displayName || 'Uten navn'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
                          <span className="text-sm text-[#5a6767] font-medium">Skaper på NORYA</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {isLoaded && filteredProfiles.length === 0 && (
              <div className="text-center py-24">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1e3a5f]/[0.04] mb-4">
                  <svg className="w-8 h-8 text-[#1e3a5f]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-[#5a6767] text-lg">Ingen skapere funnet for "{searchTerm}"</p>
              </div>
            )}

            {!isLoaded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-[28px] overflow-hidden">
                    <div className="aspect-[4/5] bg-[#e6eae7] seller-shimmer"></div>
                    <div className="p-6">
                      <div className="h-6 bg-[#e6eae7] rounded-lg mb-3 w-3/4 seller-shimmer"></div>
                      <div className="h-4 bg-[#e6eae7] rounded-lg w-1/2 seller-shimmer"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
