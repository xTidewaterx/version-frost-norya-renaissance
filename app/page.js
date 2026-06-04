import Navbar from './components/Navbar';
import Creators from './components/creators/Creators';
import ShippingForm from './components/ShippingForm';
import CreatorsMellow from './components/creators/CreatorsMellow';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />


    

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
          <p className="font-sans text-[#f5f0e1] text-sm md:text-base tracking-[0.3em] uppercase mb-8 animate-fade-in-up">
            Håndverk i Norge
          </p>






<h2 className="font-merriweather text-8xl text-white">NORYA</h2>


          <p className="font-sans italic text-[#c9a227] text-lg md:text-xl max-w-2xl mb-12 animate-fade-in-up animation-delay-200">
            Hvor nordens ånd møter tidløst håndverk
          </p>

          <div className="animate-fade-in-up animation-delay-300">
            <a
              href="#craft"
              className="inline-block border border-[#c9a227] text-[#f5f0e1] px-10 py-3 text-sm tracking-widest uppercase hover:bg-[#c9a227] hover:text-[#1a1a1a] transition-all duration-500"
            >
              Oppdag håndverket
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c9a227"
            strokeWidth="1"
          >
            <path d="M12 5V19M12 19L5 12M12 19L19 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* Manifesto Section */}
      <section className="py-32 px-6 md:px-16 bg-[#faf8f5]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-sans text-2xl md:text-3xl text-[#1a1a1a] leading-relaxed font-light">
            "I en verden av masseproduksjon, velger vi{" "}
            <span className="font-bold text-[#1e3a5f]">det bevisste</span>.{" "}
            Hver sting, hver vev, hver finish beretter en historie om patience,{" "}
            <span className="italic text-[#c9a227]">mesterlighet</span>, og den stille nordmanns stolthet."
          </p>
        </div>
      </section>

      {/* About Craft Section */}
      <section id="craft" className="py-32 bg-[#f5f0e1]">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#1e3a5f] font-sans text-xs tracking-[0.2em] uppercase mb-4 block">
                Tradisjonen
              </span>
              <h2 className="font-serif text-4xl md:text-5xl text-[#1a1a1a] mb-8 leading-tight font-semibold">
                Håndverket over generasjoner,<br />båret i livet
              </h2>
              <p className="font-sans text-[#1a1a1a] text-base md:text-lg leading-relaxed mb-6">
                NORYA står i skjæringspunktet mellom norsk arv og samtidig elegans. Våre håndverkere, mange av dem tredje-generasjonsmestere, arbeider med materialer hentet fra det barske nordiske landskapet — ull fra fjellfår, tre fra gamle skoger, og metall smidd av nordlige vind.
              </p>
              <p className="font-sans text-[#1a1a1a] text-base md:text-lg leading-relaxed">
                Hver eneste piece forteller en historie om patience. Ingen samlebånd,ingen snarveier. Kun den sta hånden til en mester og den tidløse visdommen til tradisjonen.
              </p>
            </div>

            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src="/images/blyfjell_mens_sweater_h00_01_2.webp"
                  alt="Norsk håndverker i arbeid"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[#c9a227] opacity-20" />
            </div>
          </div>
        </div>
      </section>

     

<Creators/>

<CreatorsMellow/>


      {/* Philosophy Section */}
      <section className="py-32 bg-[#1e3a5f] text-[#f5f0e1]">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl font-serif text-[#c9a227] mb-6 font-black">
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
              <div className="text-5xl font-serif text-[#c9a227] mb-6 font-black">
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
              <div className="text-5xl font-serif text-[#c9a227] mb-6 font-black">
                III
              </div>
              <h3 className="font-sans text-xl uppercase tracking-wider mb-4">
                Utdøvelighet
              </h3>
              <p className="font-sans italic text-[#f5f0e1]/80">
                Vi skaper pieces ment å overleve trender, å bli arvestykker gått gjennom generasjoner.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="profile" className="py-32 bg-[#faf8f5]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1a1a1a] mb-8 font-semibold">
            Begynn reisen din
          </h2>
          <p className="font-sans text-lg text-[#555] mb-12 max-w-xl mx-auto leading-relaxed">
            Utforsk vår samling av håndverket norske mesterverk, hver med en historie som venter på å bli en del av din.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button className="px-12 py-4 bg-[#1e3a5f] text-[#f5f0e1] font-sans text-sm uppercase tracking-wider hover:bg-[#c9a227] hover:text-[#1a1a1a] transition-all duration-500">
              Utforsk Kolleksjonen
            </button>
            <button className="px-12 py-4 border border-[#1a1a1a] text-[#1a1a1a] font-sans text-sm uppercase tracking-wider hover:bg-[#1a1a1a] hover:text-[#f5f0e1] transition-all duration-500">
              Møt Håndverkerne
            </button>
          </div>
        </div>
      </section>

      {/* About Section with ID for navigation */}
      <section id="about" className="py-32 bg-[#faf8f5]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1a1a1a] mb-8 font-semibold">
            Om NORYA
          </h2>
          <p className="font-sans text-lg text-[#333] mb-6 leading-relaxed">
            NORYA ble grunnlagt i 1987 med et enkelt prinsipp: at ekte håndverk forteller sin egen historie. Fra våverkammer i Setesdal til lærverksteder i Oslo, har vi bevart tradisjonene som har definert norsk Design i generasjoner.
          </p>
          <p className="font-sans text-lg text-[#333] leading-relaxed">
            Vi tror på工业化ens motsetning — håndverk som tar tid, materialer som modnes, og produkter som blir vakrere jo mer de brukes. Hver NORYA-piece er et løfte om kvalitet, et arvestykke i making.
          </p>
        </div>
      </section>
      
<ShippingForm/>


      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-[#888] py-16">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0 flex flex-col items-center md:items-start">
              <img
                src="/images/NORYA-logo.png"
                alt="NORYA"
                className="h-12 w-auto mb-2"
              />
              <p className="font-sans text-sm">NORYA — Grunnlagt 2025</p>
            </div>

            <div className="text-center md:text-right">
              <p className="font-sans italic text-sm">
                "Nordens ånd, tidløst håndverk"
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-[#333] text-center">
            <p className="font-sans text-xs uppercase tracking-wider">
              © 2026 NORYA. Alle rettigheter reservert. Håndverket med intensjon.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
