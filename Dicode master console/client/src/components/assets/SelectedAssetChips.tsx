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

  // Map asset types to colors
  const typeColors: Record<string, { bg: string; text: string; hover: string }> = {
    character: { bg: 'bg-violet-100', text: 'text-violet-700', hover: 'hover:bg-violet-200' },
    environment: { bg: 'bg-emerald-100', text: 'text-emerald-700', hover: 'hover:bg-emerald-200' },
    lighting: { bg: 'bg-amber-100', text: 'text-amber-700', hover: 'hover:bg-amber-200' },
    camera: { bg: 'bg-sky-100', text: 'text-sky-700', hover: 'hover:bg-sky-200' },
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-xs text-slate-400 mr-1">Using:</span>
      {assets.map((asset) => {
        const config = getAssetTypeConfig(asset.type);
        const colors = typeColors[asset.type] || typeColors.character;
        
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onRemove?.(asset.id)}
            className={cn(
              'group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
              colors.bg,
              colors.text,
              colors.hover
            )}
          >
            <span className="max-w-[120px] truncate">{asset.name}</span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        );
      })}
    </div>
  );
}
