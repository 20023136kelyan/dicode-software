import { useAuth } from "@/contexts/AuthContext";
import {
  getAssetsByUser,
  getRankedAssetsByUser,
} from "@/lib/firestore";
import type { Asset } from "@/lib/types";
import {
  getAssetSearchText,
  getAssetUsageScore,
} from "@/utils/assets";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface UseAssetsOptions {
  limit?: number;
}

export interface UseAssetsResult {
  assets: Asset[];
  rankedAssets: Asset[];
  filteredAssets: Asset[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  refresh: () => Promise<void>;
  hasAssets: boolean;
}

const DEFAULT_LIMIT = 48;

export function useAssets(options: UseAssetsOptions = {}): UseAssetsResult {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [rankedAssets, setRankedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const limit = options.limit ?? DEFAULT_LIMIT;

  const loadAssets = useCallback(async () => {
    if (!user?.uid) {
      setAssets([]);
      setRankedAssets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [allAssets, ranked] = await Promise.all([
        getAssetsByUser(user.uid),
        getRankedAssetsByUser(user.uid, { limit }),
      ]);

      setAssets(allAssets);
      setRankedAssets(ranked);
    } catch (err) {
      console.error("Failed to load assets", err);
      setError(
        err instanceof Error ? err.message : "Unable to load assets right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [limit, user?.uid]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const baseList = useMemo(() => {
    if (rankedAssets.length) {
      return rankedAssets;
    }
    return assets;
  }, [assets, rankedAssets]);

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) {
      return baseList;
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchPool = assets.length ? assets : baseList;
    return searchPool
      .filter((asset) =>
        getAssetSearchText(asset).includes(normalizedQuery),
      )
      .sort((a, b) => getAssetUsageScore(b) - getAssetUsageScore(a));
  }, [assets, baseList, searchQuery]);

  const refresh = useCallback(async () => {
    await loadAssets();
  }, [loadAssets]);

  return {
    assets,
    rankedAssets: baseList,
    filteredAssets,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
    hasAssets: assets.length > 0 || rankedAssets.length > 0,
  };
}

