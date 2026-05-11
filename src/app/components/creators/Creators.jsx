



import React from 'react'

const Creators = () => {
  return (
  
      <section id="sellers" className="py-32 bg-[#faf8f5]">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="text-center mb-20">
            <span className="text-[#1e3a5f] font-sans text-xs tracking-[0.2em] uppercase">
              Håndverkerne
            </span>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1a1a1a] mt-4 mb-6 font-semibold">
              Møt skaperne
            </h2>
            <p className="font-sans text-[#555] max-w-2xl mx-auto leading-relaxed">
              Bak hver eneste NORYA-piece står en person — en dedikert håndverker med tiår av erfaring, dyp respekt for materialer, og en ubøyd forpliktelse til perfeksjon.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Creator 1 */}
            <div className="group">
              <div className="aspect-[3/4] overflow-hidden mb-6">
                <img
                  src="/images/en.visitbergen.jpg"
                  alt="Erik Johansen - Mestervever"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
              <h3 className="font-serif text-xl text-[#1a1a1a] mb-2 font-semibold">
                Erik Johansen
              </h3>
              <p className="font-sans text-sm text-[#666] uppercase tracking-wider">
                Mestervever, 42 års erfaring
              </p>
            </div>

            {/* Creator 2 */}
            <div className="group">
              <div className="aspect-[3/4] overflow-hidden mb-6">
                <img
                  src="/images/dale-of-norway.jpg"
                  alt="Ingrid Bergman - Lærhåndverkere"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
              <h3 className="font-serif text-xl text-[#1a1a1a] mb-2 font-semibold">
                Ingrid Bergman
              </h3>
              <p className="font-sans text-sm text-[#666] uppercase tracking-wider">
                Lærhåndverkere, 28 års erfaring
              </p>
            </div>

            {/* Creator 3 */}
            <div className="group">
              <div className="aspect-[3/4] overflow-hidden mb-6">
                <img
                  src="/images/ullgenser-test-hipp.png"
                  alt="Olav Hansen - Metalarbeider"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
              <h3 className="font-serif text-xl text-[#1a1a1a] mb-2 font-semibold">
                Olav Hansen
              </h3>
              <p className="font-sans text-sm text-[#666] uppercase tracking-wider">
                Metalarbeider, 35 års erfaring
              </p>
            </div>
          </div>
        </div>
      </section>

  )
}

export default Creators