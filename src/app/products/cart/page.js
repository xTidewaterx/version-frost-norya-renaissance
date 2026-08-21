
'use client';

import { useCart } from "react-use-cart";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Image from "next/image";
import { useAuth } from "../../auth/authContext";
import { buyerEmailStore } from "../../utils/buyerEmailStore";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Helper: ensure pickupPoint is valid and contains numeric id
 * - Accepts the raw object from the UI / Bring API
 * - Returns normalized pickupPoint or null if invalid
 */
function normalizePickupPoint(pickupPointFromUi) {
  if (!pickupPointFromUi) return null;

  const id = pickupPointFromUi.id;
  if (id == null) return null;

  const idStr = String(id).trim();
  // Bring expects numeric IDs. If the UI provided a non-numeric id (like "MANNED"), treat as invalid.
  if (!/^\d+$/.test(idStr)) {
    console.warn("[checkout] pickupPoint.id is not numeric, ignoring pickupPoint:", idStr);
    return null;
  }

  return {
    id: idStr,
    name: pickupPointFromUi.name || "",
    address: {
      street: pickupPointFromUi.address?.street || pickupPointFromUi.street || "",
      postalCode: pickupPointFromUi.address?.postalCode || pickupPointFromUi.postalCode || "",
      city: pickupPointFromUi.address?.city || pickupPointFromUi.city || "",
      countryCode: pickupPointFromUi.address?.countryCode || pickupPointFromUi.countryCode || "NO",
    },
    type: pickupPointFromUi.type || pickupPointFromUi.pickupPointType || null,
  };
}

/**
 * Build shipping object to send to backend
 * Matches the backend normalizeShipping shape
 */
function buildShippingPayload({ shippingOption, addressForm, pickupPointFromUi, customerData }) {
  const pickupPoint = normalizePickupPoint(pickupPointFromUi);

  const shipping = {
    id: shippingOption?.id || "standard",
    name: shippingOption?.name || "Standard frakt (2-4 dager)",
    cost: shippingOption?.cost || 0,
    // keep the type if UI provides it (e.g., "MANNED", "MAILBOX")
    pickupPointType:
      pickupPointFromUi?.type ||
      pickupPointFromUi?.pickupPointType ||
      (pickupPoint ? pickupPoint.type || "MANNED" : null),
    // include pickupPoint only when valid numeric id present
    ...(pickupPoint ? { pickupPoint } : {}),
    // top-level address fields (useful for fallback)
    address: addressForm?.address || null,
    postalCode: addressForm?.postalCode || null,
    city: addressForm?.city || null,
    country: addressForm?.country || "NO",
    // customerData normalized
    customerData: customerData
      ? {
          name: customerData.name || "",
          email: customerData.email || "",
          phone: customerData.phone || "",
          street: customerData.street || addressForm?.address || "",
          streetNumber: customerData.streetNumber || "",
          city: customerData.city || addressForm?.city || "",
          postcode: customerData.postcode || addressForm?.postalCode || "",
          country: customerData.country || addressForm?.country || "NO",
        }
      : null,
  };

  return shipping;
}

/**
 * Build items payload: omit sellerAccountId when undefined
 */
function buildItemsPayload(cartItems) {
  return cartItems.map((it) => {
    const base = {
      id: it.id,
      name: it.name,
      quantity: Math.max(1, Number(it.quantity) || 1),
    };
    if (it.sellerAccountId != null) {
      base.sellerAccountId = it.sellerAccountId;
    }
    return base;
  });
}

/* -------------------------
   Checkout UI component
   ------------------------- */

function CheckoutForm({ onBack, shippingOption, items }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');
    setMessage('');

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/success` },
    });

    if (submitError) {
      setError(submitError.message);
      console.error("❌ Payment error:", submitError);
    }
    setLoading(false);
  };

  if (!stripe || !elements) {
    return <p className="text-red-600">Payment setup failed. Please refresh the page.</p>;
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalSum = subtotal + shippingOption.cost;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8 p-6 bg-glacial-white rounded-xl border border-border-cool">
        <h3 className="font-manrope text-ice-deep mb-4">Orderoversikt</h3>

        <div className="space-y-2 mb-4 pb-4 border-b border-border-cool">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-ice-medium">
              <span>{item.quantity}x {item.name}</span>
              <span>{((item.price * item.quantity) / 100).toFixed(2)} NOK</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-4 pb-4 border-b border-border-cool">
          <div className="flex justify-between text-charcoal-text">
            <span className="font-manrope font-bold">Subtotal:</span>
            <span className="font-manrope">{(subtotal / 100).toFixed(2)} NOK</span>
          </div>
          <div className="flex justify-between text-charcoal-text">
            <span className="font-manrope font-bold">Frakt:</span>
            <span className="font-manrope">{(shippingOption.cost / 100).toFixed(2)} NOK</span>
          </div>
        </div>

        <div className="flex justify-between text-lg font-manrope font-bold">
          <span>Total:</span>
          <span className="text-norwegian-gold font-manrope">{(totalSum / 100).toFixed(2)} NOK</span>
        </div>

        <div className="mt-4 pt-4 border-t border-border-cool">
          <p className="text-sm font-manrope font-bold text-charcoal-text mb-2">Leveringsalternativ:</p>
          <p className="text-sm text-ice-medium font-manrope">{shippingOption.name}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-border-cool">
        <h3 className="font-manrope text-ice-deep mb-4">Betalingsmetode</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <PaymentElement />
          <button
            type="submit"
            disabled={!stripe || loading}
            className="w-full bg-norwegian-gold text-ice-deep font-manrope font-bold py-3 rounded-lg hover:bg-yellow-300 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Behandler betaling…" : "Fullfør betaling"}
          </button>
          {message && <div className="text-green-600 mt-2 font-manrope text-sm">{message}</div>}
          {error && <div className="text-red-600 mt-2 text-sm font-manrope">{error}</div>}
        </form>
      </div>

      <button
        onClick={onBack}
        className="mt-6 text-ice-medium underline hover:text-ice-deep font-manrope text-sm"
      >
        ← Tilbake til frakt
      </button>
    </div>
  );
}

export default function CartPage() {
  const { items: cartItems, removeItem, updateItemQuantity, emptyCart, isInitialized, setItems } = useCart();
  const { user } = useAuth();

  const [currentItems, setCurrentItems] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const syncedRef = useRef(false);
  const [shippingOption, setShippingOption] = useState({
    id: 'standard',
    name: 'Standard frakt (2-4 dager)',
    cost: 9900,
  });
  const [processingPickupPoint, setProcessingPickupPoint] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState(() => buyerEmailStore.get() || "");
  const [selectedPickupPoint, setSelectedPickupPoint] = useState(null); // raw pickup point object from UI/API
  const [addressForm, setAddressForm] = useState({ address: "", postalCode: "", city: "", country: "NO" });
  const [customerData, setCustomerData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user?.email) {
      buyerEmailStore.set(user.email);
      if (!buyerEmail) {
        setBuyerEmail(user.email);
      }
    }
  }, [user, buyerEmail]);

  const getBuyerEmail = useCallback(() => {
    return user?.email || buyerEmailStore.get() || "";
  }, [user]);

  useEffect(() => {
    if (!isClient || syncedRef.current) return;

    try {
      const raw = localStorage.getItem("react-use-cart");
      const lsItems = JSON.parse(raw)?.items || [];

      if (lsItems.length > 0) {
        setItems(lsItems);
        setCurrentItems(lsItems);
        console.log("✅ Cart synced from localStorage:", lsItems);
      }
      syncedRef.current = true;
    } catch (err) {
      console.error("❌ Failed to sync cart from localStorage:", err);
      syncedRef.current = true;
    }
  }, [isClient, setItems]);

  useEffect(() => {
    setCurrentItems(cartItems || []);
  }, [cartItems]);

  // Restore saved pickup point (if any) and proceed
  useEffect(() => {
    try {
      const savedPickupPoint = localStorage.getItem("norya_selected_pickup_point");
      const savedShipping = localStorage.getItem("norya_shipping");
      if (savedPickupPoint && (cartItems || []).length > 0) {
        setProcessingPickupPoint(true);
        setCheckoutStep(2); // show loading
        const pp = JSON.parse(savedPickupPoint);
        const shippingData = savedShipping ? JSON.parse(savedShipping) : {};

        // Build a raw pickup point object preserving Bring numeric id if present
        const pickupPointObj = {
          id: pp.id,
          name: pp.name,
          address: pp.address || pp.street || null,
          postalCode: pp.postalCode || pp.postal_code || pp.postal || null,
          city: pp.city || null,
          countryCode: pp.countryCode || pp.country || "NO",
          type: pp.type || pp.pickupPointType || null,
        };

        setSelectedPickupPoint(pickupPointObj);

        const shipping = {
          id: pp.id || "bring-pickup",
          name: pp.name || "Bring Pakke i Posten",
          cost: 9900,
          address: pickupPointObj.address,
          city: pickupPointObj.city,
          postalCode: pickupPointObj.postalCode,
          pickupPointType: pickupPointObj.type,
          customerData: shippingData.customerData || shippingData,
        };
        setShippingOption(shipping);
        localStorage.removeItem("norya_selected_pickup_point");
        // call proceed to payment with shippingOption that includes pickupPoint raw object
        handleProceedToPayment(shipping, pickupPointObj);
      }
    } catch (e) {
      console.warn("[cart] failed to restore saved pickup point:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems.length]); // run when cart items are available

  const subtotal = (cartItems || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const totalSum = subtotal + (shippingOption?.cost || 0);

  /**
   * Proceed to payment: builds payload and calls /api/checkout_sessions
   * shippingOverride: optional shipping object (used when restoring pickup point)
   * pickupPointOverride: optional raw pickup point object (from Bring API)
   */
  const handleProceedToPayment = useCallback(async (shippingOverride = null, pickupPointOverride = null) => {
    setLoadingSecret(true);
    setIsProcessing(true);

    try {
      const lineItems = (cartItems || []).map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price, // client-side only; server resolves price
        sellerAccountId: item.sellerAccountId, // may be undefined; server will omit if undefined
      }));

      const activeShippingOption = shippingOverride || shippingOption;
      const effectiveEmail = getBuyerEmail();
      const sellerEmail = user?.stripeConnectEmail || user?.email || process.env.NEXT_PUBLIC_SELLER_EMAIL || "";

      console.log("🧾 [checkout] auth user email:", user?.email);
      console.log("🧾 [checkout] store email:", buyerEmailStore.get());
      console.log("📤 [checkout] sending request | effectiveEmail:", effectiveEmail, "| sellerEmail:", sellerEmail, "| items:", lineItems.length, "| shipping:", activeShippingOption.id);
      console.log("📤 [checkout] full shipping payload (raw):", JSON.stringify(activeShippingOption));

      // Build normalized shipping payload expected by backend
      const shippingPayload = buildShippingPayload({
        shippingOption: activeShippingOption,
        addressForm,
        pickupPointFromUi: pickupPointOverride || selectedPickupPoint,
        customerData,
      });

      // Build items payload and ensure we don't send undefined sellerAccountId
      const itemsPayload = buildItemsPayload(lineItems);

      console.log("[checkout] final payload preview:", { items: itemsPayload, shipping: shippingPayload, email: effectiveEmail });

      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload, shipping: shippingPayload, email: effectiveEmail, sellerEmail }),
      });

      const data = await res.json();

      console.log("📥 Checkout response status:", res.status);
      console.log("📥 Checkout response data:", data);

      if (!res.ok) {
        console.error("❌ API returned error status:", res.status);
        console.error("❌ API error:", data.error || data);
        alert(`Feil: ${data.error || "Ukjent feil ved betaling"}`);
        setLoadingSecret(false);
        setIsProcessing(false);
        return;
      }

      if (data.client_secret) {
        setClientSecret(data.client_secret);
        setCheckoutStep(3);
        console.log("✅ Payment Intent created and ready");
      } else {
        console.error("No client_secret returned:", data);
        alert("Feil ved initialisering av betaling. Prøv igjen.");
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      alert("Feil ved initialisering av betaling. Prøv igjen.");
    } finally {
      setLoadingSecret(false);
      setIsProcessing(false);
    }
  }, [cartItems, shippingOption, selectedPickupPoint, addressForm, customerData, user, getBuyerEmail]);

  const handleProceedToShipping = () => {
    if ((cartItems || []).length === 0) {
      alert("Handlekurven er tom");
      return;
    }
    console.log("🛒 [cart] proceeding to shipping | buyerEmail:", buyerEmail);
    window.location.href = "/hentested";
  };

  const cardTransition = { duration: 0.4, ease: "easeInOut" };
  const containerStyle = {
    perspective: 2000,
    transformStyle: "preserve-3d",
    width: "100%",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-glacial-white via-arctic-mist to-glacial-white flex justify-center items-center px-6 py-10">
      <div style={containerStyle} className="flex justify-center w-full">
        <AnimatePresence mode="wait">
          {checkoutStep === 1 && (
            <motion.div
              key="cart"
              initial={{ rotateY: 0, scale: 1, rotateX: 0 }}
              animate={{ rotateY: 0, scale: 1, rotateX: 0 }}
              exit={{ rotateY: 180, rotateX: 5, scale: 0.97, opacity: 0.95 }}
              transition={cardTransition}
              className="grid lg:grid-cols-2 w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-border-cool"
              style={{ backfaceVisibility: "hidden", transformOrigin: "center" }}
            >
              <div className="p-8 md:p-10">
                <h1 className="text-3xl font-manrope font-bold text-ice-deep mb-8 text-center tracking-wide">
                  Handlekurv
                </h1>

                {currentItems.length === 0 ? (
                  <p className="text-center text-charcoal-text font-manrope font-bold">Handlekurven er tom.</p>
                ) : (
                  <div key={`items-${currentItems.length}-${currentItems.map(i => i.id).join('-')}`} className="space-y-8">
                    {currentItems.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-y-4 justify-between border-b border-border-cool pb-5">
                        <div className="flex items-center space-x-4">
                          <div className="relative w-20 h-20">
                            <Image
                              src={item.images?.[0] || "/placeholder.png"}
                              alt={item.name}
                              fill
                              className="object-cover rounded-xl border border-border-cool shadow-sm"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-manrope font-bold text-ice-deep text-lg">{item.name}</p>
                            {item.artist && (
                              <p className="text-charcoal-text text-sm font-manrope italic">av {item.artist}</p>
                            )}
                            <p className="text-charcoal-text text-sm font-bold mt-1">
                              {((item.price || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} NOK
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => updateItemQuantity(item.id, Math.max(0, (item.quantity || 1) - 1))}
                            className="px-3 py-1 bg-arctic-mist text-ice-deep rounded-md hover:bg-norwegian-ice transition"
                          >
                            −
                          </button>
                          <span className="font-semibold text-ice-deep">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQuantity(item.id, (item.quantity || 1) + 1)}
                            className="px-3 py-1 bg-arctic-mist text-ice-deep rounded-md hover:bg-norwegian-ice transition"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="px-4 py-1 text-sm bg-norwegian-gold text-ice-deep font-manrope font-bold rounded-md hover:bg-yellow-300 transition"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-ice-deep text-glacial-white p-8 md:p-10 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-manrope font-bold text-glacial-white mb-6">Oppsummering</h2>

                  <div className="mb-6">
                    <p className="text-arctic-mist mb-2 font-manrope font-bold">Frakt:</p>
                    <p className="text-glacial-white text-sm font-manrope">{shippingOption.name}</p>
                    <p className="text-norwegian-gold font-bold mt-1 font-manrope">{((shippingOption.cost || 0)/100).toFixed(2)} NOK</p>
                  </div>

                  <div className="flex justify-between text-lg font-manrope font-bold border-t border-border-cool pt-4">
                    <span>Subtotal:</span>
                    <span className="text-norwegian-gold font-manrope">
                      {(subtotal / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} NOK
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-manrope font-bold mt-2">
                    <span>Frakt:</span>
                    <span className="text-norwegian-gold font-manrope">
                      {(shippingOption.cost / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} NOK
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-manrope font-bold mt-2 border-t border-border-cool pt-2">
                    <span>Total:</span>
                    <span className="text-norwegian-gold font-manrope">
                      {(totalSum / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} NOK
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border-cool">
                    <label htmlFor="buyerEmail" className="block text-sm font-manrope font-bold text-charcoal-text mb-2">E-post for ordrebekreftelse</label>
                    <input
                      id="buyerEmail"
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => { setBuyerEmail(e.target.value); buyerEmailStore.set(e.target.value); }}
                      placeholder="din@epost.no"
                      required
                      className="w-full rounded-xl border border-black/10 bg-zinc-100 px-4 py-3 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-10 space-y-4">
                  <button
                    onClick={() => handleProceedToPayment(null, selectedPickupPoint)}
                    disabled={(cartItems || []).length === 0 || isProcessing}
                    className="w-full bg-norwegian-gold text-ice-deep font-manrope font-bold py-3 rounded-lg hover:bg-yellow-300 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Behandler..." : "Gå til betaling →"}
                  </button>
                  <button
                    onClick={() => { emptyCart(); setCurrentItems([]); }}
                    className="w-full bg-white/10 text-glacial-white py-3 rounded-lg hover:bg-white/20 transition font-manrope font-bold"
                  >
                    Tøm handlekurv
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {checkoutStep === 2 && (
            <div
              key="processing"
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center justify-center border border-border-cool"
            >
              <p className="text-charcoal-text text-lg font-manrope font-bold mb-4">Behandler frakt og betaling...</p>
            </div>
          )}

          {checkoutStep === 3 && clientSecret && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ rotateY: 90, rotateX: 5, scale: 0.97, opacity: 0.95 }}
              transition={cardTransition}
              className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-border-cool"
            >
              <Elements stripe={stripePromise} options={{ clientSecret, locale: 'nb' }}>
                <CheckoutForm
                  onBack={() => setCheckoutStep(1)}
                  shippingOption={shippingOption}
                  items={cartItems}
                />
              </Elements>
            </motion.div>
          )}

          {checkoutStep === 3 && !clientSecret && (
            <motion.div
              key="loading"
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center justify-center border border-border-cool"
            >
              <p className="text-charcoal-text text-lg font-manrope font-bold">Forbereder betaling…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
