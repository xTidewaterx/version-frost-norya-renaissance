'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from 'react-use-cart';
import { useAuth } from '../auth/authContext';
import { buyerEmailStore } from '../utils/buyerEmailStore';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard frakt (2-4 dager)', price: 50 },
  { id: 'express', label: 'Ekspressfrakt (1-2 dager)', price: 150 },
];

function CheckoutForm({ clientSecret, selectedShipping }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
      },
    });

    if (error) setMessage(error.message);
    setLoading(false);
  };

  if (!stripe || !elements) {
    return <p className="text-red-600">Betalingsoppsett feilet. Oppdater siden og prøv igjen.</p>;
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement />
        <button
          type="submit"
          disabled={!stripe || loading}
          className="w-full bg-black text-white py-3 rounded-xl font-semibold"
        >
          {loading ? 'Behandler…' : 'Betal nå'}
        </button>
        {message && <div className="text-red-600 mt-2">{message}</div>}
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  const { items, isEmpty } = useCart();
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState(SHIPPING_OPTIONS[0]);
  const [buyerEmail, setBuyerEmail] = useState(() => buyerEmailStore.get() || "");

  useEffect(() => {
    if (user?.email) {
      buyerEmailStore.set(user.email);
      if (!buyerEmail) {
        setBuyerEmail(user.email);
      }
    }
  }, [user, buyerEmail]);

  const getBuyerEmail = () => user?.email || buyerEmailStore.get() || "";

  // Calculate subtotal of cart in cents
  const subtotalCents = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCents = subtotalCents + selectedShipping.price * 100;

  useEffect(() => {
    if (isEmpty) return;

    const fetchClientSecret = async () => {
      setLoadingSecret(true);
      try {
        const lineItems = items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          name: item.name,
        }));

         console.log("📤 [checkout] sending request | email:", getBuyerEmail(), "| items:", lineItems.length);
         console.log("🧾 [checkout] full buyerEmail state before fetch:", buyerEmail);
         const effectiveEmail = getBuyerEmail();

         const res = await fetch('/api/checkout_sessions', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             items: lineItems,
             shipping: { cost: selectedShipping.price * 100, method: selectedShipping.id },
             email: effectiveEmail,
           }),
         });

        const data = await res.json();
        console.log("📥 [checkout] response:", data);

        if (data.client_secret) {
          setClientSecret(data.client_secret);
        } else {
          console.error('No client_secret returned:', data);
        }
      } catch (err) {
        console.error('Error creating payment intent:', err);
      } finally {
        setLoadingSecret(false);
      }
    };

    fetchClientSecret();
  }, [items, selectedShipping, isEmpty, buyerEmail, user]);

// Optional: log whenever clientSecret changes
useEffect(() => {
  if (clientSecret) console.log("Current clientSecret in state:", clientSecret);
}, [clientSecret]);


  if (isEmpty) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Your cart is empty.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ice-deep flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-6 text-glacial-white">Kasse</h1>

{/* Cart summary */}
       <div className="w-full max-w-md mb-6 bg-glacial-white rounded-xl shadow p-6">
         {items.map((item) => (
           <div key={item.id} className="flex items-center justify-between mb-2">
             <div>
               <p className="font-medium text-charcoal-text">{item.name}</p>
               <p className="text-sm text-muted-text">x{item.quantity}</p>
             </div>
             <p className="text-charcoal-text">{(item.price / 100).toFixed(2)} NOK</p>
           </div>
         ))}
         <hr className="my-4 border-yellow-500" />
         <p className="text-lg font-semibold text-charcoal-text">Delsum: {(subtotalCents / 100).toFixed(2)} NOK</p>

{/* Shipping selector */}
         <div className="mt-4">
           <label className="block mb-2 font-medium text-charcoal-text">Fraktmetode</label>
           <select
             value={selectedShipping.id}
             onChange={(e) =>
               setSelectedShipping(
                 SHIPPING_OPTIONS.find(option => option.id === e.target.value)
               )
             }
             className="w-full p-2 border border-border-cool rounded-lg text-charcoal-text"
           >
            {SHIPPING_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label} (+{(option.price).toFixed(0)} NOK)
              </option>
            ))}
          </select>
        </div>

<p className="mt-4 text-lg font-semibold text-charcoal-text">
           Totalt: {(totalCents / 100).toFixed(2)} NOK
         </p>
       </div>

       {loadingSecret && <p className="text-arctic-mist mb-4">Forbereder betaling…</p>}
{clientSecret && (
  <>
    {console.log("Mounting Elements with clientSecret:", clientSecret)}
    <Elements stripe={stripePromise} options={{ clientSecret, locale: 'nb' }}>
      <CheckoutForm selectedShipping={selectedShipping} />
    </Elements>
  </>
)}

    </main>
  );
}
