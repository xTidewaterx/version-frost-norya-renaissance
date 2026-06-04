'use client';

import { useEffect, useState } from 'react';

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false);
            setIsMobileMenuOpen(false);
          } else {
            setIsVisible(true);
          }

          setLastScrollY(currentScrollY);
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const navLinks = [
    { name: 'Skapere', href: '/creators' },
    { name: 'Profil', href: '#profile' },
    { name: 'Om oss', href: '#about' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-6">
        <div className="flex justify-between items-center">
          {/* Logo - Left */}
   <a href="#" className="flex items-center gap-3 group">
  <img
    src="/images/NORYA-logo.png"
    alt="NORYA"
    className="h-10 w-auto transition-transform duration-500 group-hover:scale-105"
  />
  <span className="font-merriweather text-2xl tracking-[0.15em] text-[#f5f0e1] font-normal">
    NORYA
  </span>
</a>


          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="font-sans text-sm uppercase tracking-widest text-[#f5f0e1] hover:text-[#c9a227] transition-colors duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Mobile Hamburger - Right */}
          <button
            className="md:hidden text-[#f5f0e1] focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span
                className={`block h-0.5 w-full bg-current transform transition-all duration-300 ${
                  isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-full bg-current transition-all duration-300 ${
                  isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`block h-0.5 w-full bg-current transform transition-all duration-300 ${
                  isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-500 ease-out ${
            isMobileMenuOpen ? 'max-h-64 opacity-100 mt-6' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-4 py-4 border-t border-[#c9a227]/30">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="font-sans text-sm uppercase tracking-widest text-[#f5f0e1] hover:text-[#c9a227] transition-colors duration-300 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
