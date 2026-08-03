'use client';

import { AuthProvider } from './auth/authContext';
import CreatorsMellow from '../components/creators/CreatorsMellow';
import GetProducts from './components/homePage/get/GetProducts';
import TestTrackingPage from './test-tracking/page';

export default function Home() {
  return (
    <AuthProvider>
      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="relative h-[90vh] w-full overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage:
                'url("https://firebasestorage.googleapis.com/v0/b/norland-a7730.appspot.com/o/images%2Focean%20traveller%20v%C3%A5gnes%20troms%C3%B8%20northern%20spirit.jpg?alt=media&token=19828aad-263c-4cf2-9cd4-455253c5a3d7")',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          </div>

<div className="relative h-full flex flex-col justify-center items-center text-center px-6 md:px-12 pt-20">
             
             
              <h1 className="font-merriweather text-8xl text-white mb-6">NORYA</h1>
  <p className="font-sans text-norwegian-gold text-sm md:text-base tracking-[0.3em] uppercase mb-10 animate-fade-in-up">
                Håndlaget i Norge
              </p>
              <div className="animate-fade-in-up animation-delay-300 text-white">
                <a
                  href="#products"
                  className="inline-block border border-norwegian-gold text-white px-10 py-3 text-sm tracking-widest uppercase hover:bg-norwegian-gold hover:text-white transition-all duration-500"
                >
                  Oppdag kolleksjonene
                </a>
              </div>
            </div>

{/* Trust points - Trygg handel centered with horizontal yellow lines */}
            <div className="relative mt-6 md:mt-0 md:absolute md:bottom-16 md:left-1/2 md:-translate-x-1/2 flex items-center text-glacial-white text-sm md:text-base whitespace-nowrap">
              <span className="font-sans uppercase tracking-wider hidden md:inline-block">Kuratert kvalitet</span>
              <span className="hidden md:block w-px h-6 bg-norwegian-gold mx-2"></span>
              <span className="font-sans uppercase tracking-wider md:whitespace-nowrap">
                Trygg handel
              </span>
              <span className="hidden md:block w-px h-6 bg-norwegian-gold mx-2"></span>
              <span className="font-sans uppercase tracking-wider hidden md:inline-block">Støtter norske produsenter</span>
            </div>

           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
<svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--norwegian-gold)"
                strokeWidth="1"
              >
               <path d="M12 5V19M12 19L5 12M12 19L19 12" strokeLinecap="round" strokeLinejoin="round" />
             </svg>
           </div>
        </section>


        
        {/* Products Section with Header */}

          <GetProducts variant="home" />


 {/* Manifesto Section */}
<section className="px-6 md:px-16 bg-[#faf8f5] py-16 md:py-20">
  <div className="max-w-7xl mx-auto text-center">
    <p className="font-sans text-4xl sm:text-6xl md:text-8xl lg:text-9xl text-[#1a1a1a] leading-tight font-light">
      NORSK{" "}
      <span className="font-bold text-[#1e3a5f]">KVALITET FRA NORDMENN</span>.
    </p>
    <p className="mt-8 max-w-2xl mx-auto text-lg md:text-xl text-[#555] font-light">
      Hvert produkt forteller en historie. Hver detalj er en beslutning.
    </p>
  </div>
</section>


        <CreatorsMellow />


        
       {/* Philosophy Section */}
        <section className="py-32 bg-[#1e3a5f] text-[#f5f0e1]">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
           <div className="text-center mb-16">
             <h2 className="font-sans text-sm uppercase tracking-[0.3em] text-norwegian-gold mb-4">Vår filosofi</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div>
<div className="text-5xl font-serif text-norwegian-gold mb-6 font-black">
                     I
                  </div>
                 <h3 className="font-sans text-xl uppercase tracking-wider mb-4">
                   Integritet
                 </h3>
                 <p className="font-sans italic text-[#f5f0e1]/80">
                   Hvert materiale er etisk anskaffet, hver prosess transparent. Vi står bak hvert sting.
                 </p>
               </div>

              <div>
<div className="text-5xl font-serif text-norwegian-gold mb-6 font-black">
                     II
                  </div>
                 <h3 className="font-sans text-xl uppercase tracking-wider mb-4">
                   Intensjon
                 </h3>
                 <p className="font-sans italic text-[#f5f0e1]/80">
                   Intet er tilfeldig. Hver kurve, hver linje tjener et formål — skjønnhet i funksjon, funksjon i skjønnhet.
                 </p>
               </div>

              <div>
<div className="text-5xl font-serif text-norwegian-gold mb-6 font-black">
                     III
                  </div>
                 <h3 className="font-sans text-xl uppercase tracking-wider mb-4">
                   Tidløshet
                 </h3>
                 <p className="font-sans italic text-[#f5f0e1]/80">
                   Vi skaper pieces ment å overleve trender, å bli arvestykker gått gjennom generasjoner.
                 </p>
               </div>
            </div>
          </div>
        </section>


<TestTrackingPage/>
      </main>
    </AuthProvider>
  );
}