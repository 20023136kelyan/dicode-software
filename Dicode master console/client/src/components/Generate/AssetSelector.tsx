'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { Asset, AssetType } from '@/lib/types';
import { getAssetsByUser, incrementAssetUsage, createAsset } from '@/lib/firestore';
import { ChevronDownIcon, BookmarkIcon, PlusIcon } from '@heroicons/react/24/outline';

interface AssetSelectorProps {
  type: AssetType;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  required?: boolean;
  className?: string;
}

export default function AssetSelector({
  type,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  className = '',
}: AssetSelectorProps) {
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user, type]);

  const loadAssets = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await getAssetsByUser(user.uid, type);
      setAssets(data);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = async (asset: Asset) => {
    onChange(asset.description);
    setShowDropdown(false);

    // Increment usage count
    try {
      await incrementAssetUsage(asset.id);
      // Reload assets to reflect updated usage count
      await loadAssets();
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  const handleSaveAsset = async () => {
    if (!user || !value || !assetName) return;

    setSaving(true);
    try {
      await createAsset(user.uid, {
        type,
        name: assetName,
        description: value,
      });
      await loadAssets();
      setShowSaveDialog(false);
      setAssetName('');
      showSuccess('Asset Saved', 'New asset has been created successfully.');
    } catch (error) {
      console.error('Error saving asset:', error);
      showError('Save Failed', 'Failed to save asset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'character': return 'Character';
      case 'environment': return 'Environment';
      case 'lighting': return 'Lighting';
      case 'camera': return 'Camera Angle';
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1 px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 rounded-lg text-xs font-medium text-sky-300 transition-all"
              title="Save to Asset Store"
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              Save
            </button>
          )}
          {assets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs font-medium text-purple-300 transition-all"
            >
              <ChevronDownIcon className="w-3.5 h-3.5" />
              Load ({assets.length})
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-gray-900 transition-all hover:bg-gray-50 placeholder-gray-400 min-h-[150px] resize-none"
          placeholder={placeholder}
          required={required}
        />

        {/* Asset Dropdown */}
        {showDropdown && assets.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-gray-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <>
                <div className="p-2 bg-gray-700/50 border-b border-white/5">
                  <p className="text-xs font-medium text-gray-400">
                    Select from {getTypeLabel()} Assets
                  </p>
                </div>
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleSelectAsset(asset)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all border-b border-white/5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-200 text-sm">{asset.name}</span>
                      {asset.metadata.usageCount && asset.metadata.usageCount > 0 && (
                        <span className="text-xs text-gray-400">
                          {asset.metadata.usageCount}x
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {asset.description}
                    </p>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-white/10 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-200 mb-4">
              Save to Asset Store
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Asset Name
              </label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-gray-200"
                placeholder={`E.g., "My ${getTypeLabel()}"`}
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description Preview
              </label>
              <p className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl p-3 max-h-32 overflow-y-auto">
                {value}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setAssetName('');
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsset}
                disabled={saving || !assetName}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
