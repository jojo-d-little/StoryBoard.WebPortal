import { useCallback, useEffect, useRef, useState } from "react";
import { HostApiClient } from "../hostApi/client";
import { buildAssetCacheKey, webPortalAssetCache } from "../cache/webPortalAssetCache";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import type { PresentationCueCatalogDocument } from "../gameRenderer/contracts/presentationEffects";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UsePresentationCueCatalogWorkflowOptions {
  credentialHandle: string;
  hostApiClient: HostApiClient;
  selectedGameId: string;
  selectedGameKey: string;
  presentationCueCatalogRelativeLocator: string;
  addDiagnostic: AddDiagnostic;
  onCacheStatsChanged: () => void;
}

interface UsePresentationCueCatalogWorkflowResult {
  presentationCueCatalogRevision: number;
  presentationCueCatalogSource: "none" | "cache" | "network";
  presentationCueCatalogError: string;
  getCurrentPresentationCueCatalog: () => PresentationCueCatalogDocument | null;
  ensurePresentationCueCatalogReady: () => Promise<PresentationCueCatalogDocument>;
  clearPresentationCueCatalog: () => void;
}

function parseCatalogDocument(rawText: string): PresentationCueCatalogDocument | null {
  try {
    const parsed = JSON.parse(rawText) as PresentationCueCatalogDocument;
    return parsed && typeof parsed === "object" && Array.isArray(parsed.effects) ? parsed : null;
  } catch {
    webPortalAssetCache.recordParseFailure();
    return null;
  }
}

export function usePresentationCueCatalogWorkflow(
  options: UsePresentationCueCatalogWorkflowOptions
): UsePresentationCueCatalogWorkflowResult {
  const [presentationCueCatalogRevision, setPresentationCueCatalogRevision] = useState<number>(0);
  const [presentationCueCatalogSource, setPresentationCueCatalogSource] = useState<"none" | "cache" | "network">("none");
  const [presentationCueCatalogError, setPresentationCueCatalogError] = useState<string>("");
  const presentationCueCatalogCacheRef = useRef<Map<string, PresentationCueCatalogDocument>>(new Map());
  const loadJobsRef = useRef<Map<string, Promise<PresentationCueCatalogDocument>>>(new Map());
  const currentCacheKeyRef = useRef("");
  const relativeLocator = options.presentationCueCatalogRelativeLocator.trim();
  const cacheKey = `${options.selectedGameId}|${options.selectedGameKey}|${relativeLocator}`;
  currentCacheKeyRef.current = cacheKey;

  const getCurrentPresentationCueCatalog = useCallback((): PresentationCueCatalogDocument | null => {
    if (!relativeLocator) return null;
    return presentationCueCatalogCacheRef.current.get(cacheKey) ?? null;
  }, [cacheKey, relativeLocator]);

  const ensurePresentationCueCatalogReady = useCallback(async (): Promise<PresentationCueCatalogDocument> => {
    if (!relativeLocator) throw new Error("Presentation cue catalog locator is not configured.");
    if (!options.credentialHandle || (!options.selectedGameId && !options.selectedGameKey)) {
      throw new Error("Presentation cue catalog cannot load before Host credentials and game identity are available.");
    }
    const cachedCatalog = presentationCueCatalogCacheRef.current.get(cacheKey);
    if (cachedCatalog) return cachedCatalog;
    const existingJob = loadJobsRef.current.get(cacheKey);
    if (existingJob) return existingJob;

    const job = (async (): Promise<PresentationCueCatalogDocument> => {
      const assetCacheKey = buildAssetCacheKey({
        gameId: options.selectedGameId,
        gameKey: options.selectedGameKey,
        relativeLocator,
        kind: "cue-catalog-json"
      });
      try {
        const cachedLookup = await webPortalAssetCache.get(assetCacheKey);
        options.onCacheStatsChanged();
        let catalog = cachedLookup.entry?.value ? parseCatalogDocument(cachedLookup.entry.value) : null;
        let source: "cache" | "network" = "cache";
        if (!catalog) {
          webPortalAssetCache.recordNetworkFetch();
          options.onCacheStatsChanged();
          const textPayload = await options.hostApiClient.getAssetText(
            options.credentialHandle,
            relativeLocator,
            options.selectedGameId,
            options.selectedGameKey
          );
          catalog = textPayload?.text ? parseCatalogDocument(textPayload.text) : null;
          options.onCacheStatsChanged();
          source = "network";
          if (!catalog || !textPayload?.text) throw new Error("Catalog payload unavailable or failed to parse.");
          await webPortalAssetCache.set({
            cacheKey: assetCacheKey,
            gameId: options.selectedGameId,
            gameKey: options.selectedGameKey,
            relativeLocator,
            kind: "cue-catalog-json",
            contentType: textPayload.contentType,
            value: textPayload.text
          });
          options.onCacheStatsChanged();
        }

        presentationCueCatalogCacheRef.current.set(cacheKey, catalog);
        if (currentCacheKeyRef.current === cacheKey) {
          setPresentationCueCatalogRevision((revision) => revision + 1);
          setPresentationCueCatalogSource(source);
          setPresentationCueCatalogError("");
        }
        options.addDiagnostic("info", "presentation-cues", source === "cache"
          ? "Loaded presentation cue catalog from cache."
          : "Loaded presentation cue catalog via Host asset API.", {
          source,
          gameId: options.selectedGameId || "(none)",
          gameKey: options.selectedGameKey || "(none)",
          relativeLocator,
          schemaVersion: catalog.schemaVersion || "(unknown)",
          effectCount: catalog.effects?.length ?? 0
        });
        return catalog;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (currentCacheKeyRef.current === cacheKey) {
          setPresentationCueCatalogSource("none");
          setPresentationCueCatalogError(message);
        }
        options.addDiagnostic("error", "session-startup", "Required presentation cue catalog failed to load.", {
          gameId: options.selectedGameId || "(none)",
          gameKey: options.selectedGameKey || "(none)",
          relativeLocator,
          message
        });
        throw error;
      }
    })();
    loadJobsRef.current.set(cacheKey, job);
    try {
      return await job;
    } finally {
      if (loadJobsRef.current.get(cacheKey) === job) loadJobsRef.current.delete(cacheKey);
    }
  }, [cacheKey, options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.onCacheStatsChanged,
    options.selectedGameId, options.selectedGameKey, relativeLocator]);

  const clearPresentationCueCatalog = useCallback((): void => {
    presentationCueCatalogCacheRef.current.clear();
    loadJobsRef.current.clear();
    setPresentationCueCatalogRevision((revision) => revision + 1);
    setPresentationCueCatalogSource("none");
    setPresentationCueCatalogError("");
  }, []);

  useEffect(() => {
    if (!options.credentialHandle || !relativeLocator) return;
    void ensurePresentationCueCatalogReady().catch(() => undefined);
  }, [ensurePresentationCueCatalogReady, options.credentialHandle, relativeLocator]);

  return {
    presentationCueCatalogRevision,
    presentationCueCatalogSource,
    presentationCueCatalogError,
    getCurrentPresentationCueCatalog,
    ensurePresentationCueCatalogReady,
    clearPresentationCueCatalog
  };
}
