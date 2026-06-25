'use client';

import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const ColorDot = ({ color, className = '' }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${className}`} style={{ backgroundColor: color }} />
);

export default function PaymentInfo({ activeTheme }) {
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
      refreshAccountStatus(paymentInfo.stripeConnectId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [paymentInfo]);

  const refreshAccountStatus = async (accountId) => {
    try {
      const res = await fetch('/api/stripe/retrieve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (res.ok) {
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
      }
    } catch (err) {
      console.error('Failed to refresh account status:', err);
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
    await refreshAccountStatus(paymentInfo.stripeConnectId);
    setLoadingStatus(false);
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

  const getStatusBadge = () => {
    if (!accountStatus && paymentInfo?.stripeConnectId) {
      return <span className="text-sm font-medium text-slate-500">Ukjent</span>;
    }
    if (!accountStatus) return null;

    const { details_submitted, charges_enabled, payouts_enabled } = accountStatus;

    if (details_submitted && charges_enabled && payouts_enabled) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          Fullt aktiv
        </span>
      );
    }

    if (details_submitted && charges_enabled) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
          Under verifisering
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
        Krever handling
      </span>
    );
  };

  if (loading) {
    return (
      <div className="pt-2">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
          <ColorDot color={themeColor} />
          Inntektskilde
        </div>
        <p className="text-sm text-slate-600">Laster betalingsinformasjon...</p>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
        <ColorDot color={themeColor} />
        Inntektskilde
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">Betalingsinformasjon</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Koble til Stripe Connect for å motta betalinger direkte. NORYA tar en liten del av omsetningen som plattformgebyr.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>
        </div>
      )}

      {paymentInfo?.stripeConnectId ? (
        <div className="mt-7">
          <div className="grid gap-5 border-t border-slate-900/8 pt-5 md:grid-cols-3">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                Status
              </div>
              {getStatusBadge()}
            </div>

            {paymentInfo.email && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Stripe E-post
                </div>
                <div className="text-sm font-medium text-slate-900">{paymentInfo.email}</div>
              </div>
            )}

            {paymentInfo.connectedAt && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Tilkoblet siden
                </div>
                <div className="text-sm font-medium text-slate-900">
                  {new Date(paymentInfo.connectedAt).toLocaleDateString('no-NO')}
                </div>
              </div>
            )}

            {accountStatus && (
              <div className="md:col-span-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                    Konto detaljer
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Detaljer sendt</p>
                      <p className={`text-sm font-semibold ${accountStatus.details_submitted ? 'text-emerald-700' : 'text-red-600'}`}>
                        {String(accountStatus.details_submitted)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Betalinger aktivert</p>
                      <p className={`text-sm font-semibold ${accountStatus.charges_enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                        {String(accountStatus.charges_enabled)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Utbetalinger aktivert</p>
                      <p className={`text-sm font-semibold ${accountStatus.payouts_enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                        {String(accountStatus.payouts_enabled)}
                      </p>
                    </div>
                  </div>
                  {(accountStatus.requirements_currently_due || accountStatus.requirements_due || []).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500">Gjenstående krav nå:</p>
                      <p className="text-sm font-medium text-red-600">
                        {(accountStatus.requirements_currently_due || accountStatus.requirements_due || []).join(', ')}
                      </p>
                    </div>
                  )}
                  {accountStatus.requirements_eventually_due && accountStatus.requirements_eventually_due.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500">Fremtidige krav:</p>
                      <p className="text-sm font-medium text-amber-600">
                        {accountStatus.requirements_eventually_due.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-white">
            <button
              onClick={handleRefreshStatus}
              disabled={loadingStatus}
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingStatus ? 'Oppdaterer...' : 'Oppdater status'}
            </button>
            {accountStatus?.needsDocumentVerification && (
              <button
                onClick={async () => {
                  setConnecting(true);
                  setError(null);
                  try {
                    const url = await getDocumentOnboardingLink(paymentInfo.stripeConnectId);
                    window.location.href = url;
                  } catch (err) {
                    setError(err.message || 'Kunne ikke åpne Stripe-dokumentopplasting.');
                  } finally {
                    setConnecting(false);
                  }
                }}
                disabled={connecting}
                className="flex-1 rounded-full border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connecting ? 'Åpner...' : 'Last opp KYC-dokumenter'}
              </button>
            )}
            <a
              href={`https://dashboard.stripe.com/express/${paymentInfo.stripeConnectId}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90"
              style={{ backgroundColor: themeColor, borderColor: themeColor }}
            >
              Stripe Dashboard
            </a>
            <button
              onClick={handleDisconnect}
              className="flex-1 rounded-full border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              Koble Fra
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <button
            onClick={startStripeOnboarding}
            disabled={connecting}
            className="w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: themeColor, borderColor: themeColor }}
          >
            {connecting ? 'Kobler til...' : 'Koble til Stripe Connect'}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Du trenger en Stripe Connect-konto for å motta betalinger. Hvis du ikke har en, opprettes den underveis.
          </p>
        </div>
      )}

      <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Når du kobler til Stripe Connect, kan kundene dine sikkert betale for produktene dine. Pengene overføres direkte til din Stripe-konto, og NORYA tar en liten_prosent av hver ordre som plattformgebyr.
      </div>
    </div>
  );
}
