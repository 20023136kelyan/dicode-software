import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, UserCheck, Users, CheckCircle } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    // Check for success message from password reset
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 5 seconds
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
      await login(email, password, selectedRole);
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
      await loginWithGoogle(selectedRole);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      console.error('Google login failed:', error);
      setLoginError(error.message || 'Google sign in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div className="min-h-screen bg-[#04060A] text-white relative overflow-hidden">
      <div className="absolute -top-1/3 -left-1/4 w-[60vw] h-[60vw] bg-primary/10 blur-3xl rounded-full" />
      <div className="absolute bottom-0 right-0 w-[45vw] h-[45vw] bg-purple-500/5 blur-3xl rounded-full" />
      <div className="relative z-10 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl flex flex-col items-center gap-10 text-center">
          <div className="space-y-4">
            <img
              src="/dicode_logo.png"
              alt="DI Code logo"
              className="h-12 w-auto mx-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            />
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Behavioral Coaching</p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white">{greeting}</h1>
          </div>

          <div className="w-full max-w-md bg-[#0C0F17]/90 border border-white/5 rounded-3xl p-8 shadow-[0_20px_60px_rgba(3,6,16,0.6)] backdrop-blur-xl text-left">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Choose access</p>
                <h2 className="text-2xl font-semibold text-white">Sign in to DiCode</h2>
              </div>

              {successMessage && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-green-400 text-sm">{successMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/80">Workspace</label>
                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-full border border-white/10">
                    {roleOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => {
                          setSelectedRole(option.value);
                          setRoleError(null);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                          selectedRole === option.value
                            ? 'bg-white text-[#04060A] shadow-[0_10px_30px_rgba(255,255,255,0.2)]'
                            : 'text-white/70'
                        }`}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {roleError && <p className="text-xs text-red-400 mt-2">{roleError}</p>}
                  {loginError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 mt-4">
                      <p className="text-red-400 text-sm">{loginError}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2 text-white/80">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input w-full bg-white/[0.04] border-white/10 focus:border-primary focus:ring-primary/30"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2 text-white/80">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full bg-white/[0.04] border-white/10 focus:border-primary focus:ring-primary/30"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3 rounded-2xl shadow-[0_15px_45px_rgba(245,188,29,0.35)]"
                >
                  <LogIn size={20} />
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {loginWithGoogle && selectedRole === 'admin' && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-[#0C0F17] text-white/50">OR</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white text-[#202124] py-3 font-medium hover:bg-white/95 transition-colors"
                  >
                    <GoogleGlyph />
                    <span>Continue with Google</span>
                  </button>
                </>
              )}

              {selectedRole === 'employee' && (
                <p className="text-sm text-white/50 text-center mt-4">
                  Don't have an account? Contact your organization's IT or admin to get invited.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
