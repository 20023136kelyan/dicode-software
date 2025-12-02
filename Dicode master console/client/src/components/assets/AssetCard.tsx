'use client';

import type { Asset } from '@/lib/types';
import { getAssetTypeConfig } from '@/utils/assets';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface AssetCardProps {
  asset: Asset;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (asset: Asset) => void;
  className?: string;
}

export const AssetCard = ({
  asset,
  selected,
  disabled,
  onSelect,
  className,
}: AssetCardProps) => {
  const config = getAssetTypeConfig(asset.type);
  const usage = asset.metadata.usageCount ?? 0;

  const handleClick = () => {
    if (disabled) return;
    onSelect?.(asset);
  };

  // Map asset types to slate-based colors for consistency
  const typeColors: Record<string, { bg: string; text: string; border: string; selectedBg: string }> = {
    character: { 
      bg: 'bg-violet-50', 
      text: 'text-violet-700', 
      border: 'border-violet-200',
      selectedBg: 'bg-violet-100'
    },
    environment: { 
      bg: 'bg-emerald-50', 
      text: 'text-emerald-700', 
      border: 'border-emerald-200',
      selectedBg: 'bg-emerald-100'
    },
    lighting: { 
      bg: 'bg-amber-50', 
      text: 'text-amber-700', 
      border: 'border-amber-200',
      selectedBg: 'bg-amber-100'
    },
    camera: { 
      bg: 'bg-sky-50', 
      text: 'text-sky-700', 
      border: 'border-sky-200',
      selectedBg: 'bg-sky-100'
    },
  };

  const colors = typeColors[asset.type] || typeColors.character;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-asset-id={asset.id}
      className={cn(
        'group relative min-w-[160px] max-w-[200px] flex-shrink-0 rounded-xl border p-3 text-left transition-all',
        selected 
          ? `${colors.selectedBg} ${colors.border} ring-2 ring-slate-900 ring-offset-1` 
          : `bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm`,
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Type badge */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            colors.bg,
            colors.text
          )}
        >
          {config.label}
        </span>
        {usage > 0 && (
          <span className="text-[10px] text-slate-400">{usage}×</span>
        )}
      </div>

      {/* Asset name */}
      <p className="text-sm font-medium leading-tight text-slate-900 line-clamp-2">
        {asset.name}
      </p>
    </button>
  );
};

AssetCard.displayName = 'AssetCard';
