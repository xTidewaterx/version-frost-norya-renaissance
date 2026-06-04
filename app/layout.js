import {
  Playfair_Display,
  Inter,
  Libre_Baskerville,
  Cormorant_Garamond,
  Prata,
  Lora,
  Merriweather,
} from "next/font/google";
import "./globals.css";

export const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const prata = Prata({
  variable: "--font-prata",
  subsets: ["latin"],
  weight: ["400"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "NORYA — Norwegian Handcrafted Luxury",
  description:
    "Exquisite handcrafted Nordic products made by master artisans in Norway. Where tradition meets timeless elegance.",
  keywords: "Norwegian craft, luxury, handmade, Nordic design, artisan",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="no"
      className={`${merriweather.variable} ${prata.variable} ${playfair.variable} ${inter.variable} ${libreBaskerville.variable} ${cormorant.variable} ${lora.variable}`}
    >
      <body className="min-h-screen antialiased bg-[#faf8f5] text-[#1a1a1a]">
        {children}
      </body>
    </html>
  );
}
