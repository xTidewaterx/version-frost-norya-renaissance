"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

export default function ShippingForm({ onShippingSelected }) {
  const [step, setStep] = useState(1);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [emailError, setEmailError] = useState("");
  const [query, setQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [loadingPickupPoints, setLoadingPickupPoints] = useState(false);
  const [pickupError, setPickupError] = useState(null);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState(null);
  const [searched, setSearched] = useState(false);
  const typingTimeout = useRef(null);
  const postalCodeTimeout = useRef(null);

  const [shippingData, setShippingData] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    streetNumber: "",
    city: "",
    postcode: "",
    country: "NO",
  });

  function normalizeCountryCode(countryInput) {
    if (!countryInput) return "NO";
    const input = countryInput.toString().trim().toUpperCase();
    const countryMap = {
      'DANMARK': 'DK', 'DENMARK': 'DK', 'NORGE': 'NO', 'NORWAY': 'NO',
      'SVERIGE': 'SE', 'SWEDEN': 'SE', 'FINLAND': 'FI', 'SUOMI': 'FI',
      'DK': 'DK', 'NO': 'NO', 'SE': 'SE', 'FI': 'FI',
    };
    return countryMap[input] || input.slice(0, 2).toUpperCase() || "NO";
  }

  async function fetchSuggestions(q) {
    if (q.length < 2) return setAddressSuggestions([]);
    try {
      const res = await fetch(`/api/address?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data)) setAddressSuggestions(data.slice(0, 6));
      else setAddressSuggestions([]);
    } catch {
      setAddressSuggestions([]);
    }
  }

  function handleSelect(s) {
    setQuery(s.display_name || "");
    setAddressSuggestions([]);

    let extractedPostalCode = "";
    let extractedCity = "";
    let extractedCountry = "NO";

    if (s.address) {
      extractedPostalCode = s.address.postcode || s.address.postal_code || s.address.zipcode || "";
      extractedCity = s.address.city || s.address.town || s.address.village || "";
      extractedCountry = normalizeCountryCode(s.address.country_code || s.address.country || "NO");
    }

    if (!extractedPostalCode) {
      const postcodeMatch = s.display_name?.match(/\b(\d{4})\b/);
      if (postcodeMatch) extractedPostalCode = postcodeMatch[1];
    }

    setShippingData(prev => ({
      ...prev,
      street: s.address?.road || s.address?.name || "",
      streetNumber: s.address?.house_number || "",
      city: extractedCity,
      postcode: extractedPostalCode,
      country: extractedCountry,
    }));

    setPostalCode(extractedPostalCode);
    setCity(extractedCity);

    if (extractedPostalCode && extractedPostalCode.length >= 4) {
      fetchPickupPoints(extractedPostalCode, extractedCountry);
    }
  }

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => fetchSuggestions(value), 400);
  }

  function setPostalCode(postalCode) {
    setShippingData(prev => ({ ...prev, postcode: postalCode }));
  }

  function setCity(city) {
    setShippingData(prev => ({ ...prev, city: city }));
  }

  async function fetchPickupPoints(postalCode, countryCode = "NO") {
    const postalValue = postalCode?.trim();
    if (!postalValue) {
      setPickupError("Postnummer er påkrevd.");
      return;
    }
    setLoadingPickupPoints(true);
    setPickupError(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ postalCode: postalValue });
      const res = await fetch(`/api/pickup-points?${params}`);
      const data = await res.json();

      if (res.ok && data.pickupPoints) {
        setPickupPoints(data.pickupPoints);
      } else {
        setPickupError(data.error || "Kunne ikke hente hentesteder.");
        setPickupPoints([]);
      }
    } catch {
      setPickupError("Kunne ikke kontakte serveren.");
      setPickupPoints([]);
    } finally {
      setLoadingPickupPoints(false);
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function goToShipping() {
    const trimmedEmail = userInfo.email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Skriv inn en gyldig e-postadresse.");
      return;
    }
    setEmailError("");
    setShippingData(prev => ({ ...prev, ...userInfo, email: trimmedEmail }));
    setStep(2);
  }

  function handleSave() {
    const normalizedCountry = normalizeCountryCode(shippingData.country);
    const finalShippingData = { ...shippingData, country: normalizedCountry };
    setShippingData(finalShippingData);
    setStep(3);
    try { localStorage.setItem("norya_shipping", JSON.stringify(finalShippingData)); } catch (e) {}
    fetchPickupPoints(finalShippingData.postcode, normalizedCountry);
  }

  function handleSelectPickupPoint(pp) {
    setSelectedPickupPoint(pp);
    setStep(4);
  }

  function confirmAndProceed() {
    if (selectedPickupPoint && typeof onShippingSelected === "function") {
      const selection = {
        id: selectedPickupPoint.id,
        name: selectedPickupPoint.name,
        cost: 9900,
        address: selectedPickupPoint.address,
        city: selectedPickupPoint.city,
        postalCode: selectedPickupPoint.postalCode,
        pickupPointType: selectedPickupPoint.pickupPointType,
        customerData: shippingData,
      };
      onShippingSelected(selection);
    }
  }

  const inputClasses = "w-full p-3 rounded-xl border border-border-cool bg-white text-charcoal-text placeholder-gray-500 focus:ring-2 focus:ring-ice-deep focus:outline-none transition-all duration-300 font-manrope";
  const cardClasses = "rounded-3xl shadow-2xl bg-white p-8 space-y-6 text-charcoal-text";
  const buttonClasses = "w-full bg-ice-deep hover:bg-ice-medium text-glacial-white p-4 rounded-2xl font-manrope font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]";

  const typeLabels = {
    MANNED: "Betjent hentested",
    LOCKER: "Pakkeboks",
  };

  useEffect(() => {
    try {
      const savedShipping = localStorage.getItem("norya_shipping");
      if (savedShipping) {
        setShippingData(prev => ({ ...prev, ...JSON.parse(savedShipping) }));
      }
      const savedPickupPoint = localStorage.getItem("norya_selected_pickup_point");
      if (savedPickupPoint) {
        setSelectedPickupPoint(JSON.parse(savedPickupPoint));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (selectedPickupPoint) {
      try {
        localStorage.setItem("norya_selected_pickup_point", JSON.stringify(selectedPickupPoint));
        setStep(4);
      } catch (e) {}
    }
  }, [selectedPickupPoint]);

  return (
    <div className="max-w-xl mx-auto p-6">
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClasses}>
          <h2 className="text-2xl font-playfair font-bold text-ice-deep tracking-wide">Dine detaljer</h2>
          <div>
            <label className="font-oswald font-bold">Navn</label>
            <input className={inputClasses} value={userInfo.name} onChange={e => setUserInfo({ ...userInfo, name: e.target.value })} />
          </div>
          <div>
            <label className="font-oswald font-bold">E-post</label>
            <input
              type="email"
              autoComplete="email"
              className={inputClasses}
              value={userInfo.email}
              onChange={e => {
                setUserInfo({ ...userInfo, email: e.target.value });
                if (emailError) setEmailError("");
              }}
            />
            {emailError && <p className="mt-2 text-sm text-red-600">{emailError}</p>}
          </div>
          <button onClick={goToShipping} className={buttonClasses}>Neste</button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClasses}>
          <h2 className="text-2xl font-playfair font-bold text-ice-deep tracking-wide">Fraktinformasjon</h2>
          <div>
            <label className="font-oswald font-bold">Telefonnummer</label>
            <input className={inputClasses} value={shippingData.phone} onChange={e => setShippingData({ ...shippingData, phone: e.target.value })} />
          </div>
          <div>
            <label className="font-oswald font-bold">Adresse</label>
            <input className={inputClasses} value={query} onChange={handleChange} placeholder="Skriv inn adresse..." />
          </div>
          {addressSuggestions.length > 0 && (
            <motion.ul initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-arctic-mist border border-border-cool rounded-xl shadow-md p-2 space-y-1 max-h-64 overflow-y-auto">
              {addressSuggestions.map(s => {
                const postcode = s.address?.postcode || '';
                const city = s.address?.city || s.address?.town || '';
                const secondaryInfo = [postcode, city].filter(Boolean).join(', ');
                return (
                  <li
                    key={s.place_id}
                    onClick={() => handleSelect(s)}
                    className="p-3 hover:bg-norwegian-ice cursor-pointer rounded-lg transition-all border-l-4 border-transparent hover:border-ice-deep"
                  >
                    <div className="font-lora text-charcoal-text">{s.display_name}</div>
                    {secondaryInfo && <div className="text-xs text-charcoal-text mt-1">{secondaryInfo}</div>}
                  </li>
                );
              })}
            </motion.ul>
          )}
          <div>
            <label className="font-raleway">Postnummer</label>
            <input
              className={inputClasses}
              value={shippingData.postcode}
              onChange={e => {
                const newPostcode = e.target.value;
                setShippingData(prev => ({ ...prev, postcode: newPostcode }));
                if (postalCodeTimeout.current) clearTimeout(postalCodeTimeout.current);
                postalCodeTimeout.current = setTimeout(() => {
                  if (newPostcode.length >= 4) {
                    fetchPickupPoints(newPostcode, shippingData.country);
                  }
                }, 500);
              }}
              placeholder="Skriv inn postnummer..."
            />
          </div>
          <div>
            <label className="font-raleway">By</label>
            <input className={inputClasses} value={shippingData.city} onChange={e => setShippingData({ ...shippingData, city: e.target.value })} />
          </div>
          <div>
            <label className="font-raleway">Land</label>
            <select className={inputClasses} value={shippingData.country} onChange={e => setShippingData({ ...shippingData, country: e.target.value })}>
              <option value="NO">Norway (NO)</option>
              <option value="DK">Denmark (DK)</option>
              <option value="SE">Sweden (SE)</option>
              <option value="FI">Finland (FI)</option>
            </select>
          </div>
          <button onClick={handleSave} className={buttonClasses}>Lagre</button>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClasses}>
          <h2 className="text-2xl font-playfair font-bold text-ice-deep tracking-wide">Velg hentested</h2>
          {Object.entries(shippingData).map(([key, value]) => (
            <div key={key} className="border-b border-border-cool pb-2">
              <strong className="capitalize font-raleway">{key}:</strong> <span className="font-lora">{value}</span>
            </div>
          ))}
          <div className="mt-4">
            <p className="mb-2 font-raleway">Velg en hentested fra listen under:</p>
            {loadingPickupPoints ? (
              <p className="text-charcoal-text font-lora">Søker etter tilgjengelige hentesteder...</p>
            ) : pickupError ? (
              <p className="text-red-600 font-lora">Feil: {pickupError}</p>
            ) : searched && pickupPoints.length === 0 ? (
              <p className="text-charcoal-text font-lora">Ingen hentesteder funnet for postnummeret.</p>
            ) : (
              <div className="space-y-2">
                {pickupPoints.map(pp => (
                  <button
                    key={pp.id}
                    onClick={() => handleSelectPickupPoint(pp)}
                    className="w-full p-4 bg-arctic-mist rounded-xl text-left hover:bg-norwegian-ice transition"
                  >
                    <div className="font-lora font-medium">{pp.name || pp.id}</div>
                    <div className="text-sm text-charcoal-text">{pp.address || pp.street}, {pp.postalCode} {pp.city}</div>
                    {pp.distanceInKm && (
                      <div className="text-xs text-charcoal-text mt-1">{pp.distanceInKm} km unna</div>
                    )}
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                      pp.pickupPointType === "LOCKER"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {typeLabels[pp.pickupPointType] || pp.pickupPointType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {step === 4 && selectedPickupPoint && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClasses}>
          <h2 className="text-2xl font-playfair font-bold text-ice-deep tracking-wide">Bekreft fraktvalg</h2>
          <div className="bg-arctic-mist p-4 rounded-lg border border-border-cool space-y-3">
            <div>
              <label className="text-sm font-raleway font-medium text-charcoal-text">Hentested:</label>
              <p className="text-lg font-playfair text-charcoal-text">{selectedPickupPoint.name || selectedPickupPoint.id}</p>
            </div>
            <div>
              <label className="text-sm font-raleway font-medium text-charcoal-text">Adresse:</label>
              <p className="text-sm font-lora text-charcoal-text">{selectedPickupPoint.address}, {selectedPickupPoint.postalCode} {selectedPickupPoint.city}</p>
            </div>
            <div>
              <label className="text-sm font-raleway font-medium text-charcoal-text">Fraktpris:</label>
              <p className="text-lg font-playfair text-charcoal-text">99,00 NOK</p>
            </div>
          </div>
          <div className="space-y-2 pt-4">
            <button onClick={confirmAndProceed} className={buttonClasses}>
              Fortsett til betaling →
            </button>
            <button onClick={() => setStep(3)} className="w-full bg-arctic-mist hover:bg-norwegian-ice text-charcoal-text p-4 rounded-2xl font-raleway font-semibold transition">
              ← Velg annet sted
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}