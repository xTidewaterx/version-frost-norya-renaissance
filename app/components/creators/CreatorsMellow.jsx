import React from 'react';
import { creatorsData } from './creatorsData';

const CreatorsMellow = () => {
  return (
    <section id="sellers" className="py-32 bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <div className="text-center mb-20">
          <span className="text-cyan-400 font-sans text-xs tracking-[0.2em] uppercase">
            Håndverkerne
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 mb-6 font-semibold">
            Møt skaperne
          </h2>
          <p className="font-sans text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Bak hver eneste NORYA-piece står en person — en dedikert håndverker med tiår av erfaring, dyp respekt for materialer, og en ubøyd forpliktelse til perfeksjon.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {creatorsData.map((creator, index) => {
            // Define color themes for each creator
            const themes = [
              { color: 'cyan', bgFrom: 'from-cyan-500/20', bgTo: 'to-cyan-600/20', textColor: 'text-cyan-300', textMuted: 'text-cyan-500/70' },
              { color: 'purple', bgFrom: 'from-purple-500/20', bgTo: 'to-indigo-600/20', textColor: 'text-purple-300', textMuted: 'text-purple-500/70' },
              { color: 'emerald', bgFrom: 'from-emerald-500/20', bgTo: 'to-teal-600/20', textColor: 'text-emerald-300', textMuted: 'text-emerald-500/70' }
            ];
            
            const theme = themes[index] || themes[0];

            return (
              <div key={creator.slug} className="group">
                <div 
                  className={`aspect-[3/4] overflow-hidden mb-6 ${theme.bgFrom} ${theme.bgTo}`}
                  style={{
                    borderRadius: '32px',
                    cornerShape: 'superellipse(2)',
                  }}
                >
                  <a href={`/profile/${creator.slug}`}>
                    <img
                      src={creator.image}
                      alt={creator.imageAlt}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                      style={{ cornerShape: 'superellipse(2)', borderRadius: 'inherit' }}
                    />
                  </a>
                </div>
                <h3 className={`font-serif text-xl ${theme.textColor} mb-2 font-semibold`}>
                  {creator.name}
                </h3>
                <p className={`font-sans text-sm ${theme.textMuted} uppercase tracking-wider`}>
                  {creator.title}, {creator.experience}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
   
  );
};

export default CreatorsMellow;