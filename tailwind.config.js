/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./sections/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        xl: "1280px",
        "2xl": "1440px",
      },
    },

    extend: {
      // -----------------------------
      // FONT FAMILIES (Next.js variables)
      // -----------------------------
      fontFamily: {
        playfair: ["var(--font-playfair)"],
        inter: ["var(--font-inter)"],
        baskerville: ["var(--font-baskerville)"],
        prata: ["var(--font-prata)"],
        cormorant: ["var(--font-cormorant)"],
        lora: ["var(--font-lora)"],
      },

      // -----------------------------
      // BRAND COLORS (Nordic luxury)
      // -----------------------------
      colors: {
        sand: {
          light: "#faf8f5",
          DEFAULT: "#f3efe9",
          dark: "#e8e2d8",
        },
        ink: {
          light: "#2a2a2a",
          DEFAULT: "#1a1a1a",
          dark: "#0f0f0f",
        },
        gold: {
          light: "#d8c7a1",
          DEFAULT: "#c2a878",
          dark: "#9c875f",
        },
      },

      // -----------------------------
      // TYPOGRAPHY TUNING
      // -----------------------------
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.02em",
        wide: "0.02em",
        wider: "0.04em",
      },

      lineHeight: {
        snug: "1.15",
        relaxed: "1.6",
      },

      // -----------------------------
      // SHADOWS (soft luxury)
      // -----------------------------
      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.06)",
        subtle: "0 2px 10px rgba(0,0,0,0.04)",
      },

      // -----------------------------
      // BORDER RADIUS
      // -----------------------------
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },

  plugins: [],
};
