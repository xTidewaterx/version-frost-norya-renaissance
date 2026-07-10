"use client";

import { useEffect, useState, useRef } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1Ijoiam9oYW5teWhyZSIsImEiOiJjbXE5N2Fta2cwMDNjMnRxeW9pa2IzcTZ5In0.KV1cijqQExo9fwrdPI8TnA";

export default function HenteStedPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/search-js/v1.5.0/web.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (cancelled) return;
      if (window.mapboxsearch) {
        window.mapboxsearch.accessToken = MAPBOX_TOKEN;
        window.mapboxsearch.autofill({
          accessToken: MAPBOX_TOKEN,
          options: { country: "no", language: "no" },
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      if (script.parentNode) document.head.removeChild(script);
    };
  }, []);

  async function fetchSuggestions(value) {
    if (!value || value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?country=no&language=no&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setSearching(false);
    }
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setQuery(value);
    setAddressSelected(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(value), 300);
  }

  function handleSelectSuggestion(feature) {
    setQuery(feature.place_name || feature.text || "");
    setShowSuggestions(false);
    setAddressSelected(true);

    const ctx = feature.context || [];
    const getText = (prefix) => {
      const item = ctx.find((c) => typeof c?.id === "string" && c.id.startsWith(prefix));
      return item?.text || "";
    };

    const extractedPostalCode = getText("postcode");
    const extractedCity = getText("place") || getText("region");
    
    setPostalCode(extractedPostalCode);
    setCity(extractedCity);

    if (extractedPostalCode) {
      fetchPickupPoints(extractedPostalCode);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (listRef.current && !listRef.current.contains(e.target) && e.target !== inputRef.current) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchPickupPoints(postalCodeValue) {
    const postalValue = postalCodeValue?.trim();
    if (!postalValue) {
      setError("Postnummer er påkrevd.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ postalCode: postalValue });
      const res = await fetch(`/api/pickup-points?${params}`);
      const data = await res.json();

      if (res.ok && data.pickupPoints) {
        setPickupPoints(data.pickupPoints);
      } else {
        setError(data.error || "Kunne ikke hente hentesteder.");
        setPickupPoints([]);
      }
    } catch {
      setError("Kunne ikke kontakte serveren.");
      setPickupPoints([]);
    } finally {
      setLoading(false);
    }
  }

  const typeLabels = {
    MANNED: "Betjent hentested",
    LOCKER: "Pakkeboks",
  };

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex w-full max-w-5xl flex-col items-center py-24 px-8">
        <div className="w-full">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 mb-2">Finn hentested</h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-10">Søk etter hentesteder nær deg ved å skrive en adresse.</p>

          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="address" className="block text-sm font-medium text-black dark:text-zinc-50">Adresse</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="address"
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Start å skrive en adresse..."
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-black placeholder-zinc-400 transition-colors focus:border-black/30 focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/10 dark:bg-black dark:text-white dark:placeholder-zinc-500 dark:focus:border-white/20 dark:focus:ring-white/10"
                />
                {searching && (
                  <div className="absolute right-3 top-3 text-xs text-zinc-400">Søker...</div>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <ul
                    ref={listRef}
                    className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-black"
                  >
                    {suggestions.map((s) => (
                      <li
                        key={s.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectSuggestion(s)}
                        className="cursor-pointer px-4 py-3 text-sm text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      >
                        <div className="font-medium">{s.place_name || s.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {addressSelected && (
              <div className="space-y-4 border-t border-black/10 pt-5 dark:border-white/10">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="postalCode" className="block text-sm font-medium text-black dark:text-zinc-50">Postnummer</label>
                    <input
                      id="postalCode"
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="0000"
                      className="w-full rounded-xl border border-black/10 bg-zinc-100 px-4 py-3 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="city" className="block text-sm font-medium text-black dark:text-zinc-50">Sted</label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="f.eks. Oslo"
                      className="w-full rounded-xl border border-black/10 bg-zinc-100 px-4 py-3 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchPickupPoints(postalCode)}
                  disabled={loading}
                  className="rounded-full bg-black px-6 py-3 text-base font-medium text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
                >
                  {loading ? "Søker..." : "Finn hentested"}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-6 w-full rounded-2xl border border-red-300 bg-red-50 p-6 text-left dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="mt-10 w-full">
              {searched && !loading && pickupPoints.length === 0 && !error && (
                <div className="w-full rounded-2xl border border-black/10 bg-zinc-50 p-6 text-left dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Ingen hentesteder funnet for dette postnummeret.</p>
                </div>
              )}

              {pickupPoints.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                    {pickupPoints.length} hentested{pickupPoints.length !== 1 ? "er" : ""} funnet
                  </h2>
                  {pickupPoints.map((pp) => (
                    <div
                      key={pp.id}
                      className="w-full rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-black dark:text-zinc-50">{pp.name || pp.id}</h3>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {pp.address || pp.street || pp.name || pp.id}, {pp.postalCode || ""} {pp.city || ""}
                          </p>
                          {pp.distanceInKm && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                              {pp.distanceInKm} km ({pp.durationInMinutes} min kjøring)
                            </p>
                          )}
                          {pp.openingHours && pp.openingHours.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                                Åpningstider
                              </summary>
                              <ul className="mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                                {pp.openingHours.map((oh, i) => (
                                  <li key={i}>
                                    {oh.day}: {oh.opening} - {oh.closing}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            pp.pickupPointType === "LOCKER"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          }`}>
                            {typeLabels[pp.pickupPointType] || pp.pickupPointType}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPickupPoint(pp);
                              try {
                                localStorage.setItem("norya_selected_pickup_point", JSON.stringify(pp));
                                if (window.history.length > 1) {
                                  window.history.back();
                                } else {
                                  window.location.href = "/products/cart";
                                }
                              } catch (e) {}
                            }}
                            className={`mt-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedPickupPoint?.id === pp.id
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-zinc-100 text-black hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                            }`}
                          >
                            {selectedPickupPoint?.id === pp.id ? "Valgt" : "Velg"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedPickupPoint && (
                    <div className="mt-6 w-full rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black">
                      <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2">Valgt hentested</h3>
                      <p className="text-sm font-medium text-black dark:text-zinc-50">{selectedPickupPoint.name || selectedPickupPoint.id}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {selectedPickupPoint.address || selectedPickupPoint.street || selectedPickupPoint.name || selectedPickupPoint.id}, {selectedPickupPoint.postalCode || ""} {selectedPickupPoint.city || ""}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}