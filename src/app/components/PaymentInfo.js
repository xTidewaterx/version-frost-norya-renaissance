'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { loadConnectAndInitialize } from '@stripe/connect-js';

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
  const [showOnboarding, setShowOnboarding] = useState(false);

  const auth = getAuth();
  const db = getFirestore();
  const themeColor = activeTheme?.accent || '#1f4a58';
  const onboardingRef = useRef(null);
  const stripeConnectRef = useRef(null);

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
      }
    } catch (err) {
      console.error('Failed to refresh account status:', err);
    }
  };

  const startExistingOnboarding = async () => {
    if (!currentUser?.uid || !paymentInfo?.stripeConnectId || typeof window === 'undefined') {
      setError('Du må være logget inn med en eksisterende Stripe-konto.');
      return;
    }

    setConnecting(true);
    setError(null);
    setShowOnboarding(true);

    try {
      const res = await fetch('/api/stripe/account-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: paymentInfo.stripeConnectId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke gjenopprette Stripe onboarding.');
      }

      if (!data.client_secret) {
        throw new Error('Mangler påkrevde data fra Stripe.');
      }

      const clientSecretRef = { current: data.client_secret };

      const stripeConnect = await loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret: async () => clientSecretRef.current,
      });

      stripeConnectRef.current = stripeConnect;

      const element = stripeConnectRef.current.create('account-onboarding');

      if (onboardingRef.current) {
        onboardingRef.current.innerHTML = '';
        onboardingRef.current.appendChild(element);
      }
    } catch (err) {
      console.error('Embedded onboarding error:', err);
      setError(err.message || 'Feil ved oppstart av Stripe onboarding.');
      setShowOnboarding(false);
    } finally {
      setConnecting(false);
    }
  };

  const startEmbeddedOnboarding = async () => {
    if (!currentUser?.uid || typeof window === 'undefined') {
      setError('Du må være logget inn.');
      return;
    }

    setConnecting(true);
    setError(null);
    setShowOnboarding(true);

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

      if (!data.client_secret || !data.accountId) {
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

      const clientSecretRef = { current: data.client_secret };

      const stripeConnect = await loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret: async () => clientSecretRef.current,
      });

      stripeConnectRef.current = stripeConnect;

      const element = stripeConnectRef.current.create('account-onboarding');

      if (onboardingRef.current) {
        onboardingRef.current.innerHTML = '';
        onboardingRef.current.appendChild(element);
      }
    } catch (err) {
      console.error('Embedded onboarding error:', err);
      setError(err.message || 'Feil ved tilkobling av Stripe.');
      setShowOnboarding(false);
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

      stripeConnectRef.current?.unmount();

      if (onboardingRef.current) {
        onboardingRef.current.innerHTML = '';
      }

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
      return (
        <div>
          <span className="text-sm font-medium text-slate-500">Ukjent</span>
          <p className="mt-1 text-xs text-slate-500">Oppdater status for å se kontoinformasjon.</p>
        </div>
      );
    }
    if (!accountStatus) return null;

    const { details_submitted, charges_enabled, payouts_enabled, needsBankAccount, needsTosAcceptance } = accountStatus;

    if (details_submitted && charges_enabled && payouts_enabled) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          Fullt aktiv
        </span>
      );
    }

    const issues = [];
    if (!details_submitted) issues.push('detaljer ikke sendt');
    if (!charges_enabled) issues.push('betalinger ikke aktivert');
    if (!payouts_enabled) issues.push('utbetalinger ikke aktivert');
    if (needsBankAccount) issues.push('mangler bankkonto');
    if (needsTosAcceptance) issues.push('mangler godkjenning av vilkår');

    const issueCount = issues.length;

    return (
      <div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
          issueCount <= 2 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
        }`}>
          {issueCount <= 2 ? 'Under verifisering' : 'Krever handling'}
        </span>
        <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
          {issues.slice(0, 4).map((issue, idx) => (
            <li key={idx}>{issue}</li>
          ))}
        </ul>
      </div>
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
                  {accountStatus.requirements_due && accountStatus.requirements_due.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500">Gjenstående krav:</p>
                      <p className="text-sm font-medium text-red-600">
                        {accountStatus.requirements_due.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleRefreshStatus}
              disabled={loadingStatus}
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingStatus ? 'Oppdaterer...' : 'Oppdater status'}
            </button>
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

          {accountStatus && (accountStatus.requirements_due?.length > 0 || !accountStatus.details_submitted) && (
            <div className="mt-6">
              <button
                onClick={startExistingOnboarding}
                disabled={connecting}
                className="w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
              >
                {connecting ? 'Åpner onboarding...' : 'Fullfør Stripe onboarding'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Fullfør onboarding for å legge til bankkonto og godkjenne vilkår for å motta betalinger.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-7">
          <button
            onClick={startEmbeddedOnboarding}
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

      {showOnboarding && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">Onboarding-skjema:</p>
          <div ref={onboardingRef} className="rounded-xl border border-slate-200 bg-white p-2" />
        </div>
      )}

      <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Når du kobler til Stripe Connect, kan kundene dine sikkert betale for produktene dine. Pengene overføres direkte til din Stripe-konto, og NORYA tar en liten_prosent av hver ordre som plattformgebyr.
      </div>
    </div>
  );
}
