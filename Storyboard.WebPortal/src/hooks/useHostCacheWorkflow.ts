import { useCallback, useState } from "react";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import {
  type WebPortalAssetCacheStats,
  webPortalAssetCache
} from "../cache/webPortalAssetCache";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostCacheWorkflowOptions {
  addDiagnostic: AddDiagnostic;
}

interface UseHostCacheWorkflowResult {
  cacheStats: WebPortalAssetCacheStats;
  refreshCacheStats: () => void;
  resetCacheStats: () => void;
  clearMemoryCache: () => void;
  clearPersistentCache: () => Promise<void>;
}

export function useHostCacheWorkflow(
  options: UseHostCacheWorkflowOptions
): UseHostCacheWorkflowResult {
  const [cacheStats, setCacheStats] = useState<WebPortalAssetCacheStats>(() => webPortalAssetCache.getStatsSnapshot());

  const refreshCacheStats = useCallback((): void => {
    setCacheStats(webPortalAssetCache.getStatsSnapshot());
  }, []);

  const resetCacheStats = useCallback((): void => {
    webPortalAssetCache.resetStats();
    refreshCacheStats();
    options.addDiagnostic("info", "asset-cache", "Reset cache counters requested.");
  }, [options, refreshCacheStats]);

  const clearMemoryCache = useCallback((): void => {
    webPortalAssetCache.clearMemory();
    refreshCacheStats();
    options.addDiagnostic("info", "asset-cache", "Cleared memory cache requested.");
  }, [options, refreshCacheStats]);

  const clearPersistentCache = useCallback(async (): Promise<void> => {
    await webPortalAssetCache.clearPersistent();
    refreshCacheStats();
    options.addDiagnostic("info", "asset-cache", "Cleared IndexedDB cache store requested.");
  }, [options, refreshCacheStats]);

  return {
    cacheStats,
    refreshCacheStats,
    resetCacheStats,
    clearMemoryCache,
    clearPersistentCache
  };
}
