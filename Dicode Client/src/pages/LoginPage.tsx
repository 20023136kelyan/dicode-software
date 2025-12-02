import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, UserCheck, Users, CheckCircle } from 'lucide-react';
import type { UserRole } from '@/types';

const roleOptions: { label: string; value: UserRole; icon: React.ReactNode }[] = [
  {
    label: 'Admin',
    value: 'admin',
    icon: <UserCheck size={18} />,
  },
  {
    label: 'Employee',
    value: 'employee',
    icon: <Users size={18} />,
  },
];

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

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>('admin');
  const [rememberMe, setRememberMe] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setRoleError('Please choose whether you are logging in as an admin or employee.');
      return;
    }
    setRoleError(null);
    setLoginError(null);
    setIsLoading(true);
    try {
      await login(email, password, selectedRole, rememberMe);
    } catch (error: any) {
      console.error('Login failed:', error);
      setLoginError(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!loginWithGoogle) return;
    if (!selectedRole) {
      setRoleError('Please choose whether you are logging in as an admin or employee.');
      return;
    }
    setRoleError(null);
    setLoginError(null);
    setIsLoading(true);
    try {
      await loginWithGoogle(selectedRole, rememberMe);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      console.error('Google login failed:', error);
      setLoginError(error.message || 'Google sign in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#04060A]">
      {/* Left Panel - Login Form */}
      <div className="flex w-full flex-col justify-between px-8 py-10 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Logo */}
        <div className="flex items-center gap-4">
            <img
              src="/dicode_logo.png"
            alt="DiCode logo"
            className="h-14 w-14 object-contain"
            />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">DiCode</span>
            <span className="text-xl font-light text-white/50">Client</span>
          </div>
          </div>

        {/* Form Section */}
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white">Welcome Back</h1>
            <p className="mt-2 text-white/60">
              Enter your credentials to access your coaching platform.
            </p>
              </div>

              {successMessage && (
            <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4 flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-400">{successMessage}</p>
            </div>
          )}

          {loginError && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {loginError}
                </div>
              )}

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/80 mb-2">Workspace</label>
                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-full border border-white/10">
                    {roleOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => {
                          setSelectedRole(option.value);
                          setRoleError(null);
                        }}
                  className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                          selectedRole === option.value
                            ? 'bg-white text-[#04060A] shadow-[0_10px_30px_rgba(255,255,255,0.2)]'
                      : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {roleError && <p className="text-xs text-red-400 mt-2">{roleError}</p>}
                </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 transition-colors focus:border-[#F7B500] focus:ring-2 focus:ring-[#F7B500]/30 focus:outline-none"
                    placeholder="you@company.com"
                  />
                </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-white/80">
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/40 transition-colors focus:border-[#F7B500] focus:ring-2 focus:ring-[#F7B500]/30 focus:outline-none"
                    placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
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
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#F7B500] focus:ring-[#F7B500]/50"
                />
                <span className="text-sm text-white/60">Remember Me</span>
              </label>
              <button type="button" className="text-sm font-medium text-white/60 hover:text-white">
                Forgot Your Password?
              </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
              className="w-full rounded-full bg-[#F7B500] py-3.5 text-base font-semibold text-[#04060A] transition-all hover:bg-[#E5A500] disabled:cursor-not-allowed disabled:opacity-70 shadow-[0_15px_45px_rgba(247,181,0,0.25)]"
                >
              {isLoading ? 'Please wait...' : 'Log In'}
                </button>
              </form>

              {loginWithGoogle && selectedRole === 'admin' && (
                <>
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-sm text-white/40">Or Login With</span>
                <span className="h-px flex-1 bg-white/10" />
                    </div>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 font-medium text-[#202124] transition-colors hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <GoogleGlyph />
                <span>Google</span>
                  </button>
                </>
              )}

          <p className="mt-8 text-center text-sm text-white/50">
            Don't Have An Account?{' '}
            <span className="font-medium text-white/80">
              Contact Your Organization Admin
            </span>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-white/40">
          <span>Copyright © 2025 DiCode Software GmbH.</span>
          <button className="hover:text-white/60">Privacy Policy</button>
        </div>
      </div>

      {/* Right Panel - Hero Section */}
      <div className="relative hidden w-1/2 items-center justify-center p-8 lg:flex">
        {/* Rounded container with gradient background */}
        <div className="relative h-full w-full overflow-hidden rounded-[32px] p-12 flex flex-col justify-center">
          {/* Gradient background matching the original */}
          <div className="absolute inset-0 bg-[#04060A]" />
          <div className="absolute -top-1/3 -left-1/4 w-[80%] h-[80%] bg-[#F7B500]/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[60%] h-[60%] bg-purple-500/10 blur-[100px] rounded-full" />
          <div className="absolute inset-0 border border-white/5 rounded-[32px]" />

          {/* Content */}
          <div className="relative z-10 max-w-xl">
            <h2 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">
              Your behavioral coaching platform.
            </h2>
            <p className="mt-4 text-lg text-white/60">
              Track progress, complete assessments, and develop your leadership skills. All in one place.
            </p>
          </div>

          {/* Illustration */}
          <div className="relative z-10 mt-8 flex items-center justify-center">
            <img 
              src="/assets/illustration_login.png" 
              alt="Person working on laptop" 
              className="h-auto w-full max-w-xs object-contain animate-float-subtle"
            />
          </div>

          {/* Bottom features */}
          <div className="relative z-10 mt-12 flex items-center gap-6">
            <div>
              <p className="text-xl font-semibold text-white">Assessments</p>
              <p className="text-sm text-white/40">Track progress</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-xl font-semibold text-white">Coaching</p>
              <p className="text-sm text-white/40">AI-powered</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-xl font-semibold text-white">Reports</p>
              <p className="text-sm text-white/40">Detailed insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
