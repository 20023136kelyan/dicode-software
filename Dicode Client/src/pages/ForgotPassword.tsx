import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // Call Cloud Function to send beautiful password reset email
      const requestPasswordReset = httpsCallable(functions, 'requestPasswordReset');
      await requestPasswordReset({ email: email.trim() });
      setSuccess(true);
    } catch (error: any) {
      console.error('[ForgotPassword] Failed to send reset email:', error);

      // The Cloud Function always returns success for security
      // Only show error for actual network/function errors
      if (error.code === 'functions/unavailable') {
        setError('Service temporarily unavailable. Please try again later.');
      } else if (error.code === 'functions/invalid-argument') {
        setError('Please enter a valid email address');
      } else {
        // For any other error, still show success to prevent email enumeration
        setSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#04060A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img
              src="/dicode_logo.png"
              alt="DiCode logo"
              className="h-12 w-12 object-contain"
            />
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-white">DiCode</span>
              <span className="text-xl font-light text-white/50">Client</span>
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Check Your Email</h2>
            <p className="text-white/60 mb-6">
              If an account exists for <strong className="text-white">{email}</strong>, 
              you'll receive a password reset link shortly.
            </p>
            <p className="text-sm text-white/40 mb-6">
              Don't see it? Check your spam folder or try again.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-full bg-[#F7B500] py-3 text-base font-semibold text-[#04060A] transition-all hover:bg-[#E5A500]"
              >
                Return to Login
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="w-full rounded-full border border-white/10 py-3 text-base font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
              >
                Try Another Email
              </button>
            </div>
          </div>

          {/* Note about Google accounts */}
          <p className="text-center text-sm text-white/40 mt-6">
            Signed up with Google? Use the Google sign-in button on the login page instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/dicode_logo.png"
            alt="DiCode logo"
            className="h-12 w-12 object-contain"
          />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">DiCode</span>
            <span className="text-xl font-light text-white/50">Client</span>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Login</span>
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-2">Forgot Password?</h1>
          <p className="text-white/60">
            No worries! Enter your email and we'll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-white/80">
              Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-white placeholder:text-white/40 transition-colors focus:border-[#F7B500] focus:ring-2 focus:ring-[#F7B500]/30 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[#F7B500] py-3.5 text-base font-semibold text-[#04060A] transition-all hover:bg-[#E5A500] disabled:cursor-not-allowed disabled:opacity-70 shadow-[0_15px_45px_rgba(247,181,0,0.25)]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-[#04060A]/30 border-t-[#04060A] rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        {/* Info about Google accounts */}
        <p className="mt-6 text-sm text-white/50">
          <strong className="text-white/70">Signed up with Google?</strong>{' '}
          Password reset doesn't apply. Use the Google sign-in button on the login page.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;

