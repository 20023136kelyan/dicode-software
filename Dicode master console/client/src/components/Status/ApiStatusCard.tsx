'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkApiKey } from '@/lib/api';

export default function ApiStatusCard() {
  const { user } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await checkApiKey();
        setIsConfigured(result.configured);
      } catch (error) {
        console.error('Error checking API key:', error);
        setIsConfigured(false);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkStatus();
    } else {
      setLoading(false);
      setIsConfigured(false);
    }
  }, [user]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div
          className={`relative w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            loading
              ? 'bg-yellow-400'
              : isConfigured
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              : 'bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.4)]'
          }`}
        >
          {isConfigured && !loading && (
            <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
          )}
        </div>
        <span className={`text-sm font-medium transition-colors ${
          loading ? 'text-gray-500' : isConfigured ? 'text-emerald-600' : 'text-red-600'
        }`}>
          {loading
            ? 'Checking connection...'
            : isConfigured
            ? 'API Key Configured'
            : 'API Key Not Configured'}
        </span>
        {loading && (
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin ml-auto" />
        )}
      </div>
      {!loading && !isConfigured && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-700 leading-relaxed">
            Please configure your OpenAI API key in the backend to generate videos.
          </p>
        </div>
      )}
      {!loading && isConfigured && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <p className="text-xs text-emerald-700 leading-relaxed">
            Connected and ready to generate videos.
          </p>
        </div>
      )}
    </div>
  );
}
