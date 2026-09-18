import { useEffect, useRef, useState } from "react";
import { HostApiClient } from "../hostApi/client";
import { buildAssetCacheKey, webPortalAssetCache } from "../cache/webPortalAssetCache";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import type { PresentationCueCatalogDocument } from "../gameRenderer/presentationCue/resolveMovementCueDuration";

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
  clearPresentationCueCatalog: () => void;
}

function parseCatalogDocument(rawText: string): PresentationCueCatalogDocument | null {
  try {
    return JSON.parse(rawText) as PresentationCueCatalogDocument;
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

  function bumpPresentationCueCatalogRevision(): void {
    setPresentationCueCatalogRevision((value) => value + 1);
  }

  function getCurrentPresentationCueCatalog(): PresentationCueCatalogDocument | null {
    const relativeLocator = options.presentationCueCatalogRelativeLocator.trim();
    if (!relativeLocator) {
      return null;
    }

    const cacheKey = `${options.selectedGameId}|${options.selectedGameKey}|${relativeLocator}`;
    return presentationCueCatalogCacheRef.current.get(cacheKey) ?? null;
  }

  function clearPresentationCueCatalog(): void {
    presentationCueCatalogCacheRef.current.clear();
    bumpPresentationCueCatalogRevision();
    setPresentationCueCatalogSource("none");
    setPresentationCueCatalogError("");
  }

  useEffect(() => {
    const relativeLocator = options.presentationCueCatalogRelativeLocator.trim();
    if (!options.credentialHandle || !relativeLocator) {
      return;
    }

    const cacheKey = `${options.selectedGameId}|${options.selectedGameKey}|${relativeLocator}`;
    if (presentationCueCatalogCacheRef.current.has(cacheKey)) {
      return;
    }

    let cancelled = false;

    const fetchCatalog = async (): Promise<void> => {
      try {
        const assetCacheKey = buildAssetCacheKey({
          gameId: options.selectedGameId,
          gameKey: options.selectedGameKey,
          relativeLocator,
          kind: "cue-catalog-json"
        });

        const cachedLookup = await webPortalAssetCache.get(assetCacheKey);
        options.onCacheStatsChanged();
        let catalog = cachedLookup.entry?.value
          ? parseCatalogDocument(cachedLookup.entry.value)
          : null;
        options.onCacheStatsChanged();

        if (catalog) {
          if (cancelled) {
            return;
          }

          presentationCueCatalogCacheRef.current.set(cacheKey, catalog);
          bumpPresentationCueCatalogRevision();
          setPresentationCueCatalogSource("cache");
          setPresentationCueCatalogError("");
          const effectCount = Array.isArray(catalog.effects) ? catalog.effects.length : 0;
          options.addDiagnostic("info", "asset-cache", "Loaded presentation cue catalog from cache.", {
            source: cachedLookup.source,
            gameId: options.selectedGameId || "(none)",
            gameKey: options.selectedGameKey || "(none)",
            relativeLocator,
            effectCount
          });
          return;
        }

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

        if (cancelled) {
          return;
        }

        if (!catalog) {
          setPresentationCueCatalogSource("none");
          setPresentationCueCatalogError("Catalog payload unavailable or failed to parse.");
          options.addDiagnostic("warn", "presentation-cues", "Presentation cue catalog asset was not available from host asset API.", {
            relativeLocator,
            gameId: options.selectedGameId || "(none)",
            gameKey: options.selectedGameKey || "(none)"
          });
          return;
        }

        const effectCount = Array.isArray(catalog.effects) ? catalog.effects.length : 0;
        if (textPayload?.text) {
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
        bumpPresentationCueCatalogRevision();
        setPresentationCueCatalogSource("network");
        setPresentationCueCatalogError("");
        options.addDiagnostic("info", "presentation-cues", "Loaded presentation cue catalog via host asset API.", {
          relativeLocator,
          gameId: options.selectedGameId || "(none)",
          gameKey: options.selectedGameKey || "(none)",
          schemaVersion: catalog.schemaVersion || "(unknown)",
          effectCount
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        setPresentationCueCatalogSource("none");
        setPresentationCueCatalogError(err instanceof Error ? err.message : String(err));

        options.addDiagnostic("warn", "presentation-cues", "Failed to retrieve presentation cue catalog via host asset API.", {
          relativeLocator,
          gameId: options.selectedGameId || "(none)",
          gameKey: options.selectedGameKey || "(none)",
          message: err instanceof Error ? err.message : String(err)
        });
      }
    };

    void fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, [
    options.credentialHandle,
    options.hostApiClient,
    options.selectedGameId,
    options.selectedGameKey,
    options.presentationCueCatalogRelativeLocator,
    options.addDiagnostic,
    options.onCacheStatsChanged
  ]);

  return {
    presentationCueCatalogRevision,
    presentationCueCatalogSource,
    presentationCueCatalogError,
    getCurrentPresentationCueCatalog,
    clearPresentationCueCatalog
  };
}
