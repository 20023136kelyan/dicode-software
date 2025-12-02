'use client';

import type { Asset } from '@/lib/types';
import { getAssetTypeConfig } from '@/utils/assets';
import { cn } from '@/lib/utils';

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
  const description =
    asset.description?.trim() || 'No description provided yet.';

  const handleClick = () => {
    if (disabled) return;
    onSelect?.(asset);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      data-asset-id={asset.id}
      className={cn(
        'group min-w-[220px] max-w-[260px] flex-shrink-0 rounded-2xl border bg-card/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        config.borderClass,
        selected ? 'ring-2 ring-offset-2 ring-sky-400' : 'ring-0',
        disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            config.badgeClass
          )}
        >
          {config.label}
        </span>
        {usage > 0 ? (
          <span className="text-xs text-muted-foreground">
            Used {usage}x
          </span>
        ) : null}
      </div>

      <p className="mb-2 text-sm font-semibold leading-tight text-foreground">
        {asset.name}
      </p>
      <p className="line-clamp-3 text-xs text-muted-foreground">{description}</p>
    </div>
  );
};

AssetCard.displayName = 'AssetCard';
