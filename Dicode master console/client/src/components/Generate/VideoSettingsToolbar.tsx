'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkApiKey } from '@/lib/api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface VideoSettingsToolbarProps {
  activeTab: 'generate' | 'remix';
  onTabChange: (tab: 'generate' | 'remix') => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  model: string;
  onModelChange: (model: string) => void;
}

export default function VideoSettingsToolbar({
  activeTab,
  onTabChange,
  quality,
  onQualityChange,
  model,
  onModelChange,
}: VideoSettingsToolbarProps) {
  const { user, getAuthToken } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [showStatusTooltip, setShowStatusTooltip] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

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
  }, [user, getAuthToken]);

  const handleMouseEnter = () => {
    const timeout = setTimeout(() => {
      setShowStatusTooltip(true);
    }, 500); // Show tooltip after 500ms hover
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setShowStatusTooltip(false);
  };

  const getStatusColor = () => {
    if (loading) return 'bg-yellow-400';
    if (isConfigured) return 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
    return 'bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.4)]';
  };

  const getStatusText = () => {
    if (loading) return 'Checking API connection...';
    if (isConfigured) return 'API Key Configured - Ready to generate';
    return 'API Key Not Configured - Please configure in backend';
  };

  const modelDisplayName = model === 'sora-2-pro' ? 'Sora 2 Pro' : 'Sora 2';
  const qualityLabel = quality === '720x1280' ? 'Portrait' : 'High Res Portrait';
  const qualityResolution = quality === '720x1280' ? '720x1280' : '1024x1792';

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: Model and Quality dropdowns */}
      <div className="flex items-center gap-2">
        {/* Model Selector with Status Indicator */}
        <div className="relative">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium text-gray-700 transition-all"
          >
            <div className={`relative w-2 h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}>
              {isConfigured && !loading && (
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
              )}
            </div>
            <span>{modelDisplayName}</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>

          {/* Status Tooltip */}
          {showStatusTooltip && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-50 animate-fadeIn">
              <p className="leading-relaxed">{getStatusText()}</p>
              <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45" />
            </div>
          )}

          {/* Model Dropdown */}
          {showModelDropdown && (
            <div className="absolute top-full mt-2 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-10 animate-fadeIn">
              <button
                onClick={() => {
                  onModelChange('sora-2-pro');
                  setShowModelDropdown(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                  model === 'sora-2-pro'
                    ? 'bg-sky-50 text-sky-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Sora 2 Pro
              </button>
              <button
                onClick={() => {
                  onModelChange('sora-2');
                  setShowModelDropdown(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                  model === 'sora-2'
                    ? 'bg-sky-50 text-sky-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Sora 2
              </button>
            </div>
          )}
        </div>

        {/* Quality Selector */}
        <div className="relative">
          <button
            onClick={() => setShowQualityDropdown(!showQualityDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium text-gray-700 transition-all"
          >
            <span>{qualityLabel}</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>

          {/* Quality Dropdown */}
          {showQualityDropdown && (
            <div className="absolute top-full mt-2 right-0 w-52 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-10 animate-fadeIn">
              <button
                onClick={() => {
                  onQualityChange('720x1280');
                  setShowQualityDropdown(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                  quality === '720x1280'
                    ? 'bg-sky-50 text-sky-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Portrait</div>
                <div className="text-xs text-gray-500">720x1280</div>
              </button>
              <button
                onClick={() => {
                  onQualityChange('1024x1792');
                  setShowQualityDropdown(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                  quality === '1024x1792'
                    ? 'bg-sky-50 text-sky-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">High Res Portrait</div>
                <div className="text-xs text-gray-500">1024x1792</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Tab Switcher */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
        <button
          onClick={() => onTabChange('generate')}
          className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'generate'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          Generate
        </button>
        <button
          onClick={() => onTabChange('remix')}
          className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'remix'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          Remix
        </button>
      </div>
    </div>
  );
}
