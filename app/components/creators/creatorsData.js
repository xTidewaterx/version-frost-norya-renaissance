// Creator data for NORYA artisans
export const creatorsData = [
  {
    slug: "erik-johansen",
    name: "Erik Johansen",
    title: "Mestervever",
    experience: "42 års erfaring",
    image: "/images/en.visitbergen.jpg",
    imageAlt: "Erik Johansen - Mestervever",
    bio: "Erik har vevd i over fire årtier, lærte kunstnernen fra sin bestefar i Setesdal. Hans vever kombinerer tradisjonelle norske mønster med moderne minimalisme, skapende tidløse stykker som forteller historier om fjell og fjord.",
    specialty: "Tradisjonelle norske vevteknikker med moderne uttrykk",
    products: [
      { name: "Setesdal Ullteppe", price: "2.499 kr", image: "/images/setesdal-teppe.jpg" },
      { name: "Fjordlinne Tepp", price: "1.899 kr", image: "/images/fjordlinne-tepp.jpg" }
    ],
    quote: "En vev er ikke bare et stoff – det er en dialog mellom hender, arv og fremtid."
  },
  {
    slug: "ingrid-bergman",
    name: "Ingrid Bergman",
    title: "Lærhåndverkere",
    experience: "28 års erfaring",
    image: "/images/dale-of-norway.jpg",
    imageAlt: "Ingrid Bergman - Lærhåndverkere",
    bio: "Ingrid arbeider med læder fra norske fjordfe, gartert ved hjelp av århundre gamle metoder som bruker trebark og naturlige farger. Hvert stykke formes med håndverktøy som har gått i arv gjennom generasjoner.",
    specialty: "Tradisjonell lærgarveri og sømme",
    products: [
      { name: "Fjordskjeppe Veske", price: "1.299 kr", image: "/images/fjordskjeppe-veske.jpg" },
      { name: "Nordisk Lærbelte", price: "899 kr", image: "/images/nordisk-laerbelte.jpg" }
    ],
    quote: "Lær er et levende materiale – det pustes, det formes, og det blir vakrere med hvert steg du tar."
  },
  {
    slug: "olav-hansen",
    name: "Olav Hansen",
    title: "Metalarbeider",
    experience: "35 års erfaring",
    image: "/images/ullgenser-test-hipp.png",
    imageAlt: "Olav Hansen - Metalarbeider",
    bio: "Olav smider sølv og bronse i sin verksted i Kongsberg, der gruvedriften har formet byens identitet i over 300 år. Hans smykker og accessories kombinerer rå metallisk styrke med delikat, organisk form.",
    specialty: "Tradisjonell metallverk og smykkedesign",
    products: [
      { name: "Kongsberg Sølvring", price: "1.699 kr", image: "/images/kongsberg-solvring.jpg" },
      { name: "Bronse Armbånd", price: "1.199 kr", image: "/images/bronse-armbaand.jpg" }
    ],
    quote: "Metall har en selv – min jobb er å lytte til den og hjelpe den å finne sin form."
  }
];

// Helper function to find creator by slug
export const getCreatorBySlug = (slug) => {
  return creatorsData.find(creator => creator.slug === slug);
};