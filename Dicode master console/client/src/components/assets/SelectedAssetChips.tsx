'use client';

import type { Asset } from '@/lib/types';
import { getAssetTypeConfig } from '@/utils/assets';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SelectedAssetChipsProps {
  assets: Asset[];
  onRemove?: (assetId: string) => void;
  className?: string;
}

export function SelectedAssetChips({ assets, onRemove, className }: SelectedAssetChipsProps) {
  if (!assets.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {assets.map((asset) => {
        const config = getAssetTypeConfig(asset.type);
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onRemove?.(asset.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              config.chipClass,
              config.chipTextClass
            )}
          >
            <span className="truncate">{asset.name}</span>
            <X className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}

