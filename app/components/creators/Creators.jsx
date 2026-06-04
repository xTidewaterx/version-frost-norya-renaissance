



import React from 'react';
import { creatorsData } from './creatorsData';

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
          {creatorsData.map((creator) => (
            <div key={creator.slug} className="group">
              <div className="aspect-[3/4] overflow-hidden mb-6">
                <a href={`/profile/${creator.slug}`}>
                  <img
                    src={creator.image}
                    alt={creator.imageAlt}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  />
                </a>
              </div>
              <h3 className="font-serif text-xl text-[#1a1a1a] mb-2 font-semibold">
                {creator.name}
              </h3>
              <p className="font-sans text-sm text-[#666] uppercase tracking-wider">
                {creator.title}, {creator.experience}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Creators;