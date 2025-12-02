'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Home } from 'lucide-react';

export default function AuthButton() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="space-y-2">
        {/* User Info */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-sm font-semibold text-white">
            {(user.displayName || user.email)?.[0].toUpperCase()}
          </div>
          <span className="text-sm text-gray-700 flex-1 truncate text-left">{user.displayName || user.email}</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl transition-all flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span className="flex-1 text-left">Back to Suite</span>
          </button>
          <button
            onClick={signOut}
            className="w-full px-4 py-2.5 text-sm text-red-600 hover:text-red-700 bg-white hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="flex-1 text-left">Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="w-full btn-primary px-4 py-3 rounded-xl flex items-center gap-3 text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Sign in with Google
    </button>
  );
}
