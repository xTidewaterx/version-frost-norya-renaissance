"use client";

import Navbar from "../../components/Navbar";
import { getProfileByUid } from "../../components/profiles/profilesData";

export default function ProfilePage() {
  // Hard‑code Ingrid
  const profile = getProfileByUid("ingrid-bergman");

  const firstName = profile.name?.split(" ")[0] || profile.name;
  const materials = profile.materials || [];
  const disciplines = profile.disciplines || [];

  return (
    <main className="min-h-screen bg-[#f5f3ef] text-[#111827]">
      <Navbar />

      <div className="pt-24 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* MAIN CARD */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e5ddcf]">

            {/* HERO SECTION */}
            <section className="relative px-6 sm:px-10 pt-10 pb-14">
              <div className="grid lg:grid-cols-2 gap-10">

                {/* IMAGE SIDE */}
                <div>
                  <div className="relative rounded-3xl overflow-hidden border border-[#d4cbb8] shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                    <img
                      src={profile.image}
                      alt={profile.imageAlt}
                      className="w-full h-[460px] object-cover object-center"
                    />
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  </div>

                  {/* META STRIP */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] tracking-[0.18em] uppercase text-[#4b5563]">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0b2545]" />
                      {profile.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#c9a227]" />
                      {profile.experience}
                    </span>
                    {disciplines.length > 0 && (
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#15803d]" />
                        {disciplines.join(" • ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* TEXT SIDE */}
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] tracking-[0.25em] uppercase text-[#6b7280] mb-4">
                      NORYA • PORTRETT FRA LOFOTEN
                    </p>

                    <h1 className="font-serif text-5xl sm:text-6xl font-black text-[#111827] leading-tight mb-6">
                      {profile.name}
                    </h1>

                    <p className="text-[15px] leading-relaxed text-[#4b5563] mb-6">
                      {profile.bio}
                    </p>

                    <blockquote className="border-l-4 border-[#c9a227] pl-5 italic text-lg text-[#374151]">
                      “{profile.quote}”
                    </blockquote>
                  </div>

                  {/* MATERIALER */}
                  <div className="mt-10 border-t border-[#e5ddcf] pt-5">
                    <p className="text-[11px] tracking-[0.25em] uppercase text-[#9ca3af] mb-3">
                      MATERIALER & FAGLIG IDENTITET
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {materials.map((mat, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-full border border-[#d4cbb8] bg-[#f9f5ee] px-3 py-1.5"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                mat.toLowerCase().includes("tre")
                                  ? "#0b2545"
                                  : mat.toLowerCase().includes("stål")
                                  ? "#c9a227"
                                  : "#15803d",
                            }}
                          />
                          <span className="text-[11px] tracking-[0.18em] uppercase text-[#4b5563]">
                            {mat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* FULL-BLEED GUCCI MAP */}
            <section className="border-t border-[#e5ddcf] bg-[#faf7f3] text-[#1a1a1a]">
              <div className="max-w-4xl mx-auto px-0 sm:px-0 py-16">

                <div className="px-6 sm:px-10 mb-8">
                  <p className="text-[11px] tracking-[0.25em] uppercase text-[#9ca3af] mb-2">
                    GEOGRAFISK IDENTITET
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl font-black text-[#1a1a1a]">
                    Reine, Lofoten — et landskap som former kunsten
                  </h2>
                </div>

                <div className="relative w-full h-[380px] sm:h-[420px] overflow-hidden">

                  {/* Pastel background */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#fef3ff] via-[#fdf4ff] to-[#fef9f3]" />

                  {/* Grain */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='noStitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                    }}
                  />

                  {/* Distant mountains */}
                  <svg
                    className="absolute inset-x-[-5%] bottom-[26%] w-[110%] h-[40%]"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                  >
                    <path
                      fill="#7cc4ff"
                      d="M0,192L60,181.3C120,171,240,149,360,144C480,139,600,149,720,165.3C840,181,960,203,1080,208C1200,213,1320,203,1380,197.3L1440,192V0H0Z"
                    />
                  </svg>

                  {/* Mid mountains */}
                  <svg
                    className="absolute inset-x-[-5%] bottom-[16%] w-[110%] h-[40%]"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                  >
                    <path
                      fill="#4fd1c5"
                      d="M0,224L80,213.3C160,203,320,181,480,170.7C640,160,800,160,960,170.7C1120,181,1280,203,1360,213.3L1440,224V0H0Z"
                    />
                  </svg>

                  {/* Foreground ridge */}
                  <svg
                    className="absolute inset-x-[-5%] bottom-0 w-[110%] h-[42%]"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                  >
                    <path
                      fill="#fb7185"
                      d="M0,288L60,272C120,256,240,224,360,213.3C480,203,600,213,720,224C840,235,960,245,1080,234.7C1200,224,1320,192,1380,176L1440,160V320H0Z"
                    />
                  </svg>

                  {/* Reine marker */}
                  <div className="absolute left-1/2 bottom-[32%] -translate-x-1/2 flex flex-col items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-[#c9a227] shadow-[0_0_0_6px_rgba(201,162,39,0.35)]" />
                    <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-[#c9a227]/50 text-[11px] tracking-[0.18em] uppercase text-[#1a1a1a]">
                      Reine • Lofoten
                    </span>
                  </div>

                  {/* Aurora wash */}
                  <div className="absolute inset-x-[-20%] top-[-10%] h-40 bg-gradient-to-r from-[#f97316]/40 via-[#ec4899]/45 to-[#22c55e]/35 blur-3xl opacity-80" />
                </div>

                <div className="px-6 sm:px-10">
                  <p className="mt-6 text-sm text-[#4b5563] leading-relaxed max-w-2xl">
                    Reine er mer enn et sted — det er en rytme av fjell, hav og lys. For {firstName} er dette
                    landskapet ikke bare hjem, men et levende atelier som former hver kurve i tre og hver kant i stål.
                  </p>
                </div>
              </div>
            </section>

            {/* ARTICLE BODY */}
            <section className="border-t border-[#e5ddcf] bg-[#fdfaf5]">
              <div className="max-w-4xl mx-auto px-6 sm:px-10 py-16">
                <div className="prose prose-lg max-w-none font-serif text-[#111827] leading-relaxed">

                  <h2 className="font-serif text-4xl font-black mb-6">
                    {profile.specialty}
                  </h2>

                  <p className="mb-8 text-[15px] text-[#374151]">
                    {profile.story}
                  </p>

                  <h3 className="font-serif text-3xl font-semibold mb-5">
                    Den kreative prosessen
                  </h3>

                  <p className="mb-8 text-[15px] text-[#374151]">
                    {profile.process}
                  </p>

                  <h3 className="font-serif text-3xl font-semibold mb-5">
                    Hvor inspirasjonen kommer fra
                  </h3>

                  <p className="mb-8 text-[15px] text-[#374151]">
                    {profile.inspiration}
                  </p>

                  {/* PRODUCTS */}
                  {profile.products && profile.products.length > 0 && (
                    <div className="mt-16">
                      <h3 className="font-serif text-3xl font-black mb-6">
                        Kollektionen til {profile.name}
                      </h3>

                      <div className="grid gap-10">
                        {profile.products.map((product, index) => (
                          <article
                            key={index}
                            className="bg-white rounded-2xl shadow-md border border-[#e5ddcf] overflow-hidden"
                          >
                            <div className="relative">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-[300px] object-cover"
                              />
                              <div className="absolute top-4 left-4 bg-[#c9a227] text-white px-4 py-1 text-[11px] uppercase tracking-[0.18em]">
                                {product.price}
                              </div>
                            </div>

                            <div className="p-6">
                              <h4 className="font-serif text-xl font-semibold mb-2">
                                {product.name}
                              </h4>

                              <p className="text-[15px] text-[#4b5563] mb-5">
                                {product.description}
                              </p>

                              <a
                                href="/#profile"
                                className="text-[#0b2545] border-b border-[#0b2545]/40 text-[11px] uppercase tracking-[0.2em]"
                              >
                                Kjøp nå
                              </a>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-20 text-center">
                    <h3 className="font-serif text-3xl font-semibold mb-5">
                      Kunstnerens filosofi
                    </h3>
                    <p className="text-[15px] text-[#4b5563] max-w-2xl mx-auto">
                      I en verden av masseproduksjon velger {firstName} det bevisste. Hver kant i stål,
                      hver årring i tre, er en stille motstand mot det masseproduserte – og en hyllest
                      til det langsomme, nordlige håndverket.
                    </p>
                  </div>

                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="bg-[#0b2545] text-[#f5f0e1] border-t border-[#1f2937]">
              <div className="max-w-4xl mx-auto px-6 sm:px-10 py-14 text-center">
                <h2 className="font-serif text-4xl font-black mb-6">
                  Begynn din NORYA‑reise med {firstName}
                </h2>
                <p className="text-sm text-[#e5e7eb]/80 mb-8">
                  Utforsk håndplukkede verk fra Reine og resten av Norge – kuratert for hjem som
                  vil bære historier, ikke bare objekter.
                </p>
                <a
                  href="/#profile"
                  className="inline-block border border-[#c9a227] text-[#f5f0e1] px-8 py-3 text-[11px] tracking-[0.25em] uppercase rounded-full hover:bg-[#c9a227] hover:text-[#111827] transition-all"
                >
                  Se kollektionen
                </a>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
