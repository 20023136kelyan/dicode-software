'use client';

import Link from 'next/link';
import { AssetCard } from './AssetCard';
import { Search, RefreshCw, Plus } from 'lucide-react';
import type { Asset } from '@/lib/types';
import { useAssets } from '@/hooks/useAssets';
import { cn } from '@/lib/utils';

export interface AssetPickerRowProps {
  selectedAssetIds?: string[];
  onAssetSelect?: (asset: Asset) => void;
  className?: string;
}

export function AssetPickerRow({
  selectedAssetIds = [],
  onAssetSelect,
  className,
}: AssetPickerRowProps) {
  const {
    filteredAssets,
    rankedAssets,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
    hasAssets,
  } = useAssets({ limit: 60 });

  const handleRetry = () => {
    void refresh();
  };

  // Fixed height for content area to match asset card height (h-24 = 96px + padding)
  const contentMinHeight = 'min-h-[112px]';

  const renderContent = () => {
    if (loading) {
      return (
        <div className={`flex items-center gap-3 overflow-hidden ${contentMinHeight}`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`asset-skeleton-${index}`}
              className="h-24 min-w-[180px] animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className={`flex items-center justify-center gap-4 rounded-xl border border-dashed border-rose-200 bg-rose-50 px-6 ${contentMinHeight}`}>
          <div className="text-center">
            <p className="text-sm font-medium text-rose-700">Failed to load assets</p>
            <p className="mt-1 text-xs text-rose-600">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      );
    }

    if (!filteredAssets.length) {
      if (!hasAssets) {
        return (
          <div className={`flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 ${contentMinHeight}`}>
            <div>
              <p className="text-sm font-medium text-slate-700">No reusable assets yet</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Create assets for consistent characters, environments, and more.
              </p>
            </div>
            <Link
              href="/assets"
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Create asset
            </Link>
          </div>
        );
      }

      return (
        <div className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 ${contentMinHeight}`}>
          <p className="text-sm text-slate-500">No assets match "{searchQuery}"</p>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent ${contentMinHeight}`}>
        {filteredAssets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onSelect={onAssetSelect}
            selected={selectedAssetIds.includes(asset.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-900">Assets</h3>
          {rankedAssets.length > 0 && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {rankedAssets.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={rankedAssets.length ? 'Search...' : 'Loading...'}
              className="h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
            />
          </div>
          <Link
            href="/assets"
            className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
          >
            Manage
          </Link>
        </div>
      </div>
      {renderContent()}
    </section>
  );
}
