'use client';

import { useAuth } from '@/contexts/AuthContext';
import AuthButton from '@/components/Auth/AuthButton';

export default function TopBar() {
  const { user } = useAuth();

  return (
    <div className="h-16 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <span className="text-lg font-bold text-white">C</span>
          </div>
          <h1 className="text-xl font-bold text-white">Campaign Builder</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-7 h-7 rounded-lg"
              />
            )}
            <span className="text-sm font-medium text-gray-300">{user.displayName}</span>
          </div>
        )}
        <AuthButton />
      </div>
    </div>
  );
}
