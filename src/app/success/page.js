import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#faf7f1] via-[#f5efe3] to-[#e8dec8] p-6">
        <div className="w-full max-w-md rounded-2xl bg-white/85 backdrop-blur-md shadow-xl border border-white/70 px-8 py-10 text-center">
          <p className="text-lg font-medium text-[#2d2a26]">Laster...</p>
        </div>
      </div>
    }>
      <SuccessClient />
    </Suspense>
  );
}
