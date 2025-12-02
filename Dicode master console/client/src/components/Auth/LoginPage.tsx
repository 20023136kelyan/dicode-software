'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle(rememberMe);
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
      await signInWithEmail(email, password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Login Form */}
      <div className="flex w-full flex-col justify-between bg-white px-8 py-10 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Image
            src="/dicode_logo.png"
            alt="DiCode logo"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">DiCode</span>
            <span className="text-xl font-light text-slate-400">Suite</span>
      </div>
            </div>

        {/* Form Section */}
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-slate-900">Welcome Back</h1>
            <p className="mt-2 text-slate-500">
              Enter your email and password to access your account.
            </p>
              </div>

              {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-5">
            <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
                placeholder="you@company.com"
                  />
                </div>

            <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
              <div className="relative">
                  <input
                    id="password"
                  type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
                    placeholder="••••••••"
                  />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-600">Remember Me</span>
              </label>
              <button type="button" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                Forgot Your Password?
              </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
              className="w-full rounded-full bg-slate-900 py-3.5 text-base font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
              {loading ? 'Please wait...' : 'Log In'}
                </button>
              </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-sm text-slate-400">Or Login With</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleGlyph />
              <span>Google</span>
            </button>
            <button
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-400 opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M14.94 4.88c-.08.05-1.52.87-1.52 2.67 0 2.08 1.83 2.82 1.89 2.84-.01.05-.29 1.01-0.97 2-.59.86-1.2 1.71-2.16 1.71-.94 0-1.19-.55-2.28-.55-1.06 0-1.44.57-2.31.57-.88 0-1.5-.8-2.19-1.78-.82-1.16-1.49-2.97-1.49-4.68 0-2.75 1.79-4.21 3.54-4.21.93 0 1.71.61 2.29.61.56 0 1.43-.65 2.49-.65.4 0 1.84.04 2.79 1.38l-.08.09zM11.39 2.29c.43-.51.73-1.22.73-1.93 0-.1-.01-.2-.02-.28-.7.03-1.53.47-2.03 1.05-.39.45-.76 1.16-.76 1.88 0 .11.02.22.03.25.05.01.14.02.22.02.63 0 1.4-.42 1.83-.99z"/>
              </svg>
              <span>Apple</span>
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don't Have An Account?{' '}
            <a href="mailto:it@dicode.com" className="font-medium text-slate-900 hover:underline">
              Contact DiCode IT Team
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Copyright © 2025 DiCode Software GmbH.</span>
          <button className="hover:text-slate-600">Privacy Policy</button>
        </div>
      </div>

      {/* Right Panel - Hero Section */}
      <div className="relative hidden w-1/2 items-center justify-center bg-white p-8 lg:flex">
        {/* Rounded container */}
        <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-slate-800 p-12 flex flex-col justify-center">
          {/* Subtle grid pattern */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 via-slate-800 to-slate-900 rounded-[32px]" />

          {/* Content */}
          <div className="relative z-10 max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">
            DiCode's internal suite for campaign management.
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Manage behavior campaigns, generate AI videos, and collaborate with your team. All in one place.
          </p>
          </div>

          {/* Dashboard Preview Mockup */}
          <div className="relative z-10 mt-10 animate-float-subtle">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-700/30 shadow-2xl backdrop-blur-sm">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-slate-600/30 bg-slate-700/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-slate-500/50" />
                  <div className="h-3 w-3 rounded-full bg-slate-500/50" />
                  <div className="h-3 w-3 rounded-full bg-slate-500/50" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-slate-600/30 px-3 py-1 text-xs text-slate-400">
                  suite.dicode.com/campaigns
                </div>
              </div>
              
              {/* Dashboard content */}
              <div className="flex">
                {/* Sidebar mockup */}
                <div className="w-16 border-r border-slate-600/30 bg-slate-700/40 p-3">
                  <div className="mb-4 h-8 w-8 rounded-lg bg-slate-500/30 animate-pulse-slow" />
                  <div className="space-y-3">
                    <div className="h-6 w-6 rounded-md bg-white/20" />
                    <div className="h-6 w-6 rounded-md bg-slate-500/30" />
                    <div className="h-6 w-6 rounded-md bg-slate-500/30" />
                    <div className="h-6 w-6 rounded-md bg-slate-500/30" />
                  </div>
                </div>
                
                {/* Main content area */}
                <div className="flex-1 p-4">
                  {/* Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-5 w-32 rounded bg-slate-500/40" />
                    <div className="h-8 w-24 rounded-lg bg-white/20 animate-pulse-slow" />
                  </div>
                  
                  {/* Stats row */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-600/30 p-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                      <div className="mb-2 h-3 w-12 rounded bg-slate-500/40" />
                      <div className="h-6 w-16 rounded bg-emerald-400/40 animate-shimmer" />
                    </div>
                    <div className="rounded-xl bg-slate-600/30 p-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                      <div className="mb-2 h-3 w-12 rounded bg-slate-500/40" />
                      <div className="h-6 w-12 rounded bg-sky-400/40 animate-shimmer" style={{ animationDelay: '0.5s' }} />
                    </div>
                    <div className="rounded-xl bg-slate-600/30 p-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                      <div className="mb-2 h-3 w-12 rounded bg-slate-500/40" />
                      <div className="h-6 w-14 rounded bg-amber-400/40 animate-shimmer" style={{ animationDelay: '1s' }} />
                    </div>
                  </div>
                  
                  {/* Campaign cards */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-600/20 p-3 animate-slide-in-right" style={{ animationDelay: '0.4s' }}>
                      <div className="h-10 w-10 rounded-lg bg-slate-500/40" />
                      <div className="flex-1">
                        <div className="mb-1 h-3 w-24 rounded bg-slate-400/40" />
                        <div className="h-2 w-32 rounded bg-slate-500/30" />
                      </div>
                      <div className="h-5 w-16 rounded-full bg-emerald-400/30 animate-pulse-slow" />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-slate-600/20 p-3 animate-slide-in-right" style={{ animationDelay: '0.5s' }}>
                      <div className="h-10 w-10 rounded-lg bg-slate-500/40" />
                      <div className="flex-1">
                        <div className="mb-1 h-3 w-28 rounded bg-slate-400/40" />
                        <div className="h-2 w-36 rounded bg-slate-500/30" />
                      </div>
                      <div className="h-5 w-14 rounded-full bg-amber-400/30 animate-pulse-slow" style={{ animationDelay: '0.3s' }} />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-slate-600/20 p-3 animate-slide-in-right" style={{ animationDelay: '0.6s' }}>
                      <div className="h-10 w-10 rounded-lg bg-slate-500/40" />
                      <div className="flex-1">
                        <div className="mb-1 h-3 w-20 rounded bg-slate-400/40" />
                        <div className="h-2 w-28 rounded bg-slate-500/30" />
                      </div>
                      <div className="h-5 w-16 rounded-full bg-emerald-400/30 animate-pulse-slow" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative floating elements */}
            <div className="absolute -right-4 -top-4 h-16 w-24 rounded-xl border border-slate-600/30 bg-slate-700/30 backdrop-blur-sm animate-float-1" />
            <div className="absolute -bottom-4 -left-4 h-20 w-32 rounded-xl border border-slate-600/30 bg-slate-700/30 backdrop-blur-sm animate-float-2" />
          </div>

          {/* Bottom stats or trust indicators */}
          <div className="relative z-10 mt-12 flex items-center gap-6">
            <div>
              <p className="text-xl font-semibold text-white">Campaigns</p>
              <p className="text-sm text-slate-400">Design & publish</p>
            </div>
            <div className="h-10 w-px bg-slate-600" />
            <div>
              <p className="text-xl font-semibold text-white">Video Gen</p>
              <p className="text-sm text-slate-400">AI-powered</p>
            </div>
            <div className="h-10 w-px bg-slate-600" />
            <div>
              <p className="text-xl font-semibold text-white">Assets</p>
              <p className="text-sm text-slate-400">Centralized library</p>
            </div>
            <div className="h-10 w-px bg-slate-600" />
            <div>
              <p className="text-xl font-semibold text-white">Access</p>
              <p className="text-sm text-slate-400">Team control</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
