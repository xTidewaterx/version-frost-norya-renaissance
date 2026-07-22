'use client';

import React, { useState } from 'react';
import { SignInUser } from './SignIn';
import { RegisterUser } from './RegisterUser';
import { GoogleSignIn } from './GoogleSignIn';

export default function AuthPage() {
  const [authFlow, setAuthFlow] = useState('select');
  const [selectedRole, setSelectedRole] = useState('kunde');

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Konto</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Min Profil</h1>
          <p className="mt-2 text-sm text-slate-600">
            Velg hvordan du vil fortsette.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Kontotype
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('kunde')}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                  selectedRole === 'kunde'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                Kunde
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('selger')}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                  selectedRole === 'selger'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                Selger
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {selectedRole === 'selger'
                ? 'Som selger kan du publisere produkter og motta betalinger via Stripe Connect.'
                : 'Som kunde kan du kjøpe produkter og følge skapere.'}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => setAuthFlow('login')}
              className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white"
            >
              Logg inn
            </button>
            <button
              onClick={() => setAuthFlow('register')}
              className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white"
            >
              Opprett konto
            </button>
            <button
              onClick={() => setAuthFlow('google')}
              className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white"
            >
              Fortsett med Google
            </button>
          </div>

          {authFlow !== 'select' && (
            <button
              onClick={() => setAuthFlow('select')}
              className="mt-6 text-left text-xs font-medium text-slate-500 underline underline-offset-2"
            >
              ← Velg noe annet
            </button>
          )}
        </div>

        {authFlow === 'login' && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <SignInUser defaultRole={selectedRole} />
          </div>
        )}

        {authFlow === 'register' && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <RegisterUser defaultRole={selectedRole} />
          </div>
        )}

        {authFlow === 'google' && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <GoogleSignIn role={selectedRole} />
          </div>
        )}
      </div>
    </main>
  );
}
