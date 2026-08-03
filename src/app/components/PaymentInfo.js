'use client';

import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const ColorDot = ({ color, className = '' }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${className}`} style={{ backgroundColor: color }} />
);

export default function PaymentInfo({ activeTheme, userRole }) {
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const auth = getAuth();
  const db = getFirestore();
  const themeColor = activeTheme?.accent || '#1f4a58';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    const loadPaymentInfo = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data()?.stripeConnectId) {
          const info = {
            stripeConnectId: userSnap.data().stripeConnectId,
            connectedAt: userSnap.data().stripeConnectAt,
            email: userSnap.data().stripeConnectEmail,
          };
          setPaymentInfo(info);
          await refreshAccountStatus(info.stripeConnectId);
        }
      } catch (err) {
        console.error('Error loading payment info:', err);
        setError('Kunne ikke laste betalingsinformasjon.');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentInfo();
  }, [currentUser, db]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stripeParam = urlParams.get('stripe');
    if (stripeParam === 'success' && paymentInfo?.stripeConnectId) {
      refreshAccountStatus(paymentInfo.stripeConnectId).then((data) => {
        if (data?.needsDocumentVerification) {
          simulateVerificationIfNeeded(paymentInfo.stripeConnectId);
        } else if (data?.needsBankAccount || data?.needsTosAcceptance) {
          setSuccess('Du må fullføre onboarding for å legge til bankkonto og akseptere vilkår.');
        }
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [paymentInfo]);

  const refreshAccountStatus = async (accountId) => {
    const res = await fetch('/api/stripe/retrieve-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : null;

    console.log('🔍 [PaymentInfo] refresh status:', res.status, 'accountId:', accountId);

    if (!res.ok) {
      const rawText = data ? JSON.stringify(data) : 'empty response';
      console.error('❌ [PaymentInfo] refresh failed:', res.status, rawText);
      const message = data?.error || 'Kunne ikke hente kontostatus.';
      const fallback = message.includes('does not have access')
        ? 'Denne Stripe-kontoen har ikke tilgang til denne Connect-kontoen. Sjekk at STRIPE_SECRET_KEY i .env.local tilhører riktig Stripe-konto.'
        : message;
      throw new Error(fallback);
    }

    if (!data) {
      throw new Error('Uventet svar fra Stripe-tjenesten.');
    }

    setAccountStatus(data);
    console.log("📊 Stripe account status refreshed:", {
      accountId,
      details_submitted: data.details_submitted,
      charges_enabled: data.charges_enabled,
      payouts_enabled: data.payouts_enabled,
      needsDocumentVerification: data.needsDocumentVerification,
    });

    if (data.charges_enabled && data.payouts_enabled) {
      console.log("🎉 CONNECT ACCOUNT FULLY VERIFIED - Ready to receive payouts");
    }

    return data;
  };

  const simulateVerificationIfNeeded = async (accountId) => {
    if (!accountStatus?.needsDocumentVerification) {
      return;
    }

    try {
      console.log("🔵 [simulate] attempting simulated verification for test account:", accountId);
      const res = await fetch('/api/stripe/simulate-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("❌ [simulate] failed:", data);
        return;
      }

      console.log("✅ [simulate] verification simulated:", data);
      setSuccess('Test-verifisering simulert. Oppdaterer status...');

      // Re-fetch status after simulation
      const refreshed = await refreshAccountStatus(accountId);

      if (refreshed.charges_enabled && refreshed.payouts_enabled) {
        setSuccess('🎉 Konto er nå fullt verifisert i testmodus.');
      }
    } catch (err) {
      console.error("❌ [simulate] error:", err);
    }
  };

  const getDocumentOnboardingLink = async (accountId) => {
    const res = await fetch('/api/stripe/onboarding-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Kunne ikke generere onboarding-link.');
    }

    if (!data.onboardingUrl) {
      throw new Error('Ingen KYC-dokumenter mangler for denne kontoen.');
    }

    return data.onboardingUrl;
  };

const startStripeOnboarding = async () => {
    if (!currentUser?.uid) {
      setError('Du må være logget inn.');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/create-account-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke starte Stripe onboarding.');
      }

      if (!data.url || !data.accountId) {
        throw new Error('Mangler påkrevde data fra Stripe.');
      }

      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          stripeConnectId: data.accountId,
          stripeConnectEmail: currentUser.email,
          stripeConnectAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setPaymentInfo({
        stripeConnectId: data.accountId,
        connectedAt: new Date().toISOString(),
        email: currentUser.email,
      });

      window.location.href = data.url;
    } catch (err) {
      console.error('Stripe onboarding error:', err);
      setError(err.message || 'Feil ved tilkobling av Stripe.');
    } finally {
      setConnecting(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!paymentInfo?.stripeConnectId) return;
    setLoadingStatus(true);
    setError(null);
    try {
      const data = await refreshAccountStatus(paymentInfo.stripeConnectId);
      if (data?.needsDocumentVerification) {
        await simulateVerificationIfNeeded(paymentInfo.stripeConnectId);
      }
    } catch (err) {
      console.error('Failed to refresh account status:', err);
      setError('Kunne ikke oppdatere status. Prøv igjen senere.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser?.uid || !paymentInfo?.stripeConnectId) return;

    if (!window.confirm('Er du sikker på at du vil koble fra Stripe? Du vil ikke motta betalinger før du kobler til igjen.')) {
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        stripeConnectId: null,
        stripeConnectAt: null,
        stripeConnectEmail: null,
      });

      setPaymentInfo(null);
      setAccountStatus(null);
      setSuccess('Stripe kontoen er koblet fra.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error disconnecting Stripe:', err);
      setError('Kunne ikke koble fra Stripe.');
    }
  };

const StatusDot = ({ color }) => (
  <span
    className="inline-block h-2 w-2 rounded-full shadow-sm"
    style={{ backgroundColor: color }}
  />
);

const getStatusBadge = () => {
  if (!accountStatus && paymentInfo?.stripeConnectId) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot color="#94a3b8" />
        <span className="text-sm font-medium text-slate-500">Ukjent</span>
      </div>
    );
  }
  if (!accountStatus) return null;

  const { details_submitted, charges_enabled, payouts_enabled } = accountStatus;

  if (details_submitted && charges_enabled && payouts_enabled) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot color="#10b981" />
        <span className="text-sm font-semibold text-emerald-700">
          Fullt aktiv
        </span>
      </div>
    );
  }

  if (details_submitted && charges_enabled) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot color="#f59e0b" />
        <span className="text-sm font-semibold text-amber-700">
          Under verifisering
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <StatusDot color="#ef4444" />
      <span className="text-sm font-semibold text-red-700">
        Krever handling
      </span>
    </div>
  );
};

if (loading) {
  return (
    <div className="pt-2 animate-fadeIn">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
        <StatusDot color={themeColor} />
        Inntektskilde
      </div>
      <p className="text-sm text-slate-600">Laster betalingsinformasjon...</p>
    </div>
  );
}

return userRole === 'seller' ? (
  <div className="pt-6 pb-10 animate-fadeIn py-12 px-6 ">
    {/* Header */}
    <div className="py-12 px-6 mb-8 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em]"
         style={{ color: themeColor }}>
      <StatusDot color={themeColor} />
      Inntektskilde
    </div>

    <div className="mb-10">
      <h2 className="text-4xl font-semibold text-slate-900 tracking-tight">
        Betalingsinformasjon
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
        Koble til Stripe Connect for å motta betalinger direkte. NORYA tar en liten del av omsetningen som plattformgebyr.
      </p>
    </div>

    {/* Alerts */}
    {error && (
      <div className="mt-6 rounded-xl border-l-4 border-red-400 bg-red-50/80 px-5 py-4 text-sm text-red-700 shadow-sm">
        {error}
      </div>
    )}

    {success && (
      <div className="mt-6 rounded-xl border-l-4 border-emerald-400 bg-emerald-50/80 px-5 py-4 text-sm text-emerald-700 shadow-sm">
        {success}
      </div>
    )}

    {/* Connected */}
    {paymentInfo?.stripeConnectId ? (
      <div className="mt-10 space-y-10">

        {/* Status Cards */}
        <div className="grid gap-8 border-t border-slate-900/10 pt-8 md:grid-cols-3">

          <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 p-6 shadow-sm">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
              Status
            </div>
            {getStatusBadge()}
          </div>

          {paymentInfo.email && (
            <div className="rounded-2xl bg-emerald-50/40 backdrop-blur-xl border border-emerald-200 p-6 shadow-sm">
              <div className="mb-3 text-xs uppercase tracking-[0.22em] text-emerald-700">
                Stripe E‑post
              </div>
              <div className="text-sm font-medium text-slate-900">
                {paymentInfo.email}
              </div>
            </div>
          )}

          {paymentInfo.connectedAt && (
            <div className="rounded-2xl bg-sky-50/40 backdrop-blur-xl border border-sky-200 p-6 shadow-sm">
              <div className="mb-3 text-xs uppercase tracking-[0.22em] text-sky-700">
                Tilkoblet siden
              </div>
              <div className="text-sm font-medium text-slate-900">
                {new Date(paymentInfo.connectedAt).toLocaleDateString('no-NO')}
              </div>
            </div>
          )}

          {/* Account Details */}
          {accountStatus && (
            <div className="md:col-span-3">
              <div className="rounded-2xl bg-slate-50/80 backdrop-blur-xl border border-slate-200 p-8 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.22em]"
                   style={{ color: themeColor }}>
                  Konto detaljer
                </p>

                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  {[
                    { label: "Detaljer sendt", value: accountStatus.details_submitted },
                    { label: "Betalinger aktivert", value: accountStatus.charges_enabled },
                    { label: "Utbetalinger aktivert", value: accountStatus.payouts_enabled },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl bg-white/70 p-4 shadow-sm">
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p
                        className={`text-sm font-semibold ${
                          item.value ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {String(item.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Requirements */}
                {(accountStatus.requirements_currently_due || []).length > 0 && (
                  <div className="mt-6 rounded-xl border-l-4 border-amber-400 bg-amber-50/60 p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Gjenstående krav nå:</p>
                    <p className="text-sm font-medium text-red-600">
                      {accountStatus.requirements_currently_due.map(req => {
                        if (req === 'external_account') return 'Bankkonto (external_account)';
                        if (req === 'tos_acceptance.date') return 'Vilkårsaccept - dato (tos_acceptance.date)';
                        if (req === 'tos_acceptance.ip') return 'Vilkårsaccept - IP (tos_acceptance.ip)';
                        if (req.startsWith('individual.verification.document')) return 'Identitetsdokument';
                        return req;
                      }).join(", ")}
                    </p>
                  </div>
                )}

                {accountStatus.requirements_eventually_due?.length > 0 && (
                  <div className="mt-4 rounded-xl border-l-4 border-amber-400 bg-amber-50/60 p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Fremtidige krav:</p>
                    <p className="text-sm font-medium text-amber-600">
                      {accountStatus.requirements_eventually_due.map(req => {
                        if (req === 'external_account') return 'Bankkonto (external_account)';
                        if (req === 'tos_acceptance.date') return 'Vilkårsaccept - dato (tos_acceptance.date)';
                        if (req === 'tos_acceptance.ip') return 'Vilkårsaccept - IP (tos_acceptance.ip)';
                        if (req.startsWith('individual.verification.document')) return 'Identitetsdokument';
                        return req;
                      }).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 text-white">

          <button
            onClick={handleRefreshStatus}
            disabled={loadingStatus}
            className="flex-1 rounded-full border border-slate-300 bg-white px-5 py-4 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingStatus ? "Oppdaterer..." : "Oppdater status"}
          </button>

          {(accountStatus?.needsBankAccount || accountStatus?.needsTosAcceptance) && (
            <button
              onClick={startStripeOnboarding}
              disabled={connecting}
              className="flex-1 rounded-full border border-amber-300 bg-amber-50 px-5 py-4 text-center text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
            >
              {connecting ? "Åpner..." : "Fullfør onboarding"}
            </button>
          )}

          {accountStatus?.needsDocumentVerification && (
            <button
              onClick={async () => {
                setConnecting(true);
                setError(null);
                try {
                  const url = await getDocumentOnboardingLink(paymentInfo.stripeConnectId);
                  window.location.href = url;
                } catch (err) {
                  setError(err.message || "Kunne ikke åpne Stripe-dokumentopplasting.");
                } finally {
                  setConnecting(false);
                }
              }}
              disabled={connecting}
              className="flex-1 rounded-full border border-amber-300 bg-amber-50 px-5 py-4 text-center text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
            >
              {connecting ? "Åpner..." : "Last opp KYC‑dokumenter"}
            </button>
          )}

          <a
            href={`https://dashboard.stripe.com/express/${paymentInfo.stripeConnectId}/login`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full px-5 py-4 text-center text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
            style={{ backgroundColor: themeColor }}
          >
            Stripe Dashboard
          </a>

          <button
            onClick={handleDisconnect}
            className="flex-1 rounded-full border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
          >
            Koble Fra
          </button>
        </div>
      </div>
    ) : (
      /* Not connected */
      <div className="mt-10">
        <button
          onClick={startStripeOnboarding}
          disabled={connecting}
          className="w-full rounded-full px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {connecting ? "Kobler til..." : "Koble til Stripe Connect"}
        </button>

        <p className="mt-4 text-xs text-slate-500">
          Du trenger en Stripe Connect‑konto for å motta betalinger. Hvis du ikke har en, opprettes den underveis.
        </p>
      </div>
    )}

    {/* Footer */}
    <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-6 text-sm text-slate-700 shadow-sm">
      Når du kobler til Stripe Connect, kan kundene dine sikkert betale for produktene dine. Pengene overføres direkte til din Stripe‑konto, og NORYA tar en liten prosent av hver ordre som plattformgebyr.
    </div>
  </div>
) : null;

}