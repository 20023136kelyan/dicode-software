'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path
      d="M17.64 9.2045C17.64 8.56682 17.5827 7.95273 17.4764 7.36364H9V10.8455H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.561V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z"
      fill="#4285F4"
    />
    <path
      d="M9 18C11.43 18 13.4673 17.1945 14.9564 15.8195L12.0477 13.561C11.2414 14.1015 10.2114 14.4205 9 14.4205C6.65591 14.4205 4.67136 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.96409 10.71C3.78409 10.1695 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83045 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.57955C10.3214 3.57955 11.4982 4.03409 12.4209 4.91591L15.0205 2.31636C13.4632 0.861818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67136 5.16273 6.65591 3.57955 9 3.57955Z"
      fill="#EA4335"
    />
  </svg>
);

const BrandTile = () => (
  <div className="flex items-center gap-4">
    <Image
      src="/dicode_logo.png"
      alt="DiCode logo"
      width={64}
      height={64}
      className="h-16 w-16 object-contain"
      priority
    />
    <div>
      <p className="text-xs uppercase tracking-[0.6em] text-slate-400">DiCode internal suite</p>
      <p className="text-sm text-slate-500">Employees only</p>
    </div>
  </div>
);

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const authHeadline = 'Sign in to DiCode Suite';
  const authSubline = 'Secure entry to campaign ops, AI copilots, knowledge hubs, and more.';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-1/3 -left-16 h-72 w-72 rounded-full bg-rose-200/30 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[22rem] w-[22rem] rounded-full bg-indigo-200/30 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.5),_transparent)]" />
      </div>

      <div className="relative z-10 px-6 py-16 lg:px-12">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-8 text-center lg:text-left">
            <div className="flex flex-col items-center gap-5 lg:items-start">
              <BrandTile />
              <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                {greeting}, welcome to DiCode’s internal software suite.
              </h1>
            </div>

            <p className="mx-auto max-w-2xl text-base text-slate-600 lg:mx-0">
              This portal houses every DiCode employee workflow—campaign management, AI storytelling, enablement tools,
              and operational dashboards—so your teams stay aligned in one secure control room.
            </p>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Workspace access</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{authHeadline}</h2>
                  <p className="text-sm text-slate-600">{authSubline}</p>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleGlyph />
                <span>{loading ? 'Please wait...' : 'Continue with Google'}</span>
              </button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-slate-300">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#F5BC1D] focus:ring-2 focus:ring-[#F5BC1D]/30 focus:outline-none"
                    placeholder="you@dicode.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#F5BC1D] focus:ring-2 focus:ring-[#F5BC1D]/30 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#F5BC1D] py-3 text-base font-semibold text-slate-900 transition hover:bg-[#e0a915] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Please wait...' : 'Sign in'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500">
                Need access? Contact the DiCode IT onboarding team to provision your account.
              </p>

              <p className="text-center text-xs text-slate-400">
                Internal use only. Contact DiCode IT Security if you need help logging in.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
