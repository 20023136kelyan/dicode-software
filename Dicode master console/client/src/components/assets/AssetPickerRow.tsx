'use client';

import Link from 'next/link';
import { AssetCard } from './AssetCard';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Asset } from '@/lib/types';
import { useAssets } from '@/hooks/useAssets';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`asset-skeleton-${index}`}
              className="h-32 min-w-[220px] animate-pulse rounded-2xl border border-border/40 bg-muted/40"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load assets
          </p>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      );
    }

    if (!filteredAssets.length) {
      if (!hasAssets) {
        return (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No reusable assets yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create assets once and drag them into any prompt for consistent visuals.
            </p>
            <Link
              href="/assets"
              className="mt-4 inline-flex rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Go to asset library
            </Link>
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No assets match “{searchQuery}”.
        </div>
      );
    }

    return (
      <div className="flex gap-3 overflow-x-auto py-4 px-1">
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
        'rounded-3xl border border-border/60 bg-card/80 px-4 py-5',
        className
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reusable assets
          </p>
          <p className="text-sm text-muted-foreground">
            Click an asset to add it to your prompt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                rankedAssets.length ? 'Search assets…' : 'Loading assets…'
              }
              className="h-9 w-full rounded-full border border-border/60 bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-0"
            />
          </div>
          <Link
            href="/assets"
            className="text-xs font-semibold text-sky-600 hover:text-sky-500"
          >
            Manage
          </Link>
        </div>
      </div>
      {renderContent()}
    </section>
  );
}

