import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRenderSceneSnapshot, GameRendererRoomTransitionState } from "../gameRenderer";
import { mapHostPresentationToSceneSnapshot, mapHostSessionDataToSceneSnapshot } from "../gameRenderer/adapters";
import { mapRenderableRoomObjects, selectRenderableRoomObjects } from "../gameRenderer/scene/sceneObjects";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { HostApiClient } from "../hostApi/client";
import type { HostCommandSoundCue, HostSessionPresentationData } from "../hostApi/HostContracts";
import { useSessionDeltaPolling } from "./useSessionDeltaPolling";
import { buildAssetCacheKey, webPortalAssetCache } from "../cache/webPortalAssetCache";
import type { PresentationCueCatalogDocument } from "../gameRenderer/contracts/presentationEffects";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;
const ROOM_TRANSITION_POLLING_PAUSE_WATCHDOG_MS = 30000;

export interface HostRendererSessionWorkflowResult {
  reportRoomTransitionState: (state: GameRendererRoomTransitionState) => void;
  roomTransitionPreparationEpoch: number;
  roomTransitionActive: boolean;
  sessionDeltaRevision: number;
  loadParticleEffectImage: (relativeLocator: string) => Promise<string | null>;
}

function isMovementCueCategory(value: string): boolean {
  return value.trim().toLowerCase() === "movement";
}

function summarizeMovementCueEffects(presentationCues: Array<{ category: string; effectKey: string }>): string[] {
  return presentationCues
    .filter((cue) => isMovementCueCategory(cue.category))
    .map((cue) => cue.effectKey.trim())
    .filter((effectKey) => effectKey.length > 0);
}

function toNonNegativeInt(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value ?? 0));
}

function isAppearanceCueCategory(value: string): boolean {
  return value.trim().toLowerCase() === "appearance";
}

function normalizeCueToken(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isRoomTransitionCue(cue: { cueType?: string; category?: string }): boolean {
  if (normalizeCueToken(cue.cueType) === "roomtransition") {
    return true;
  }

  const normalizedCategory = normalizeCueToken(cue.category);
  if (!normalizedCategory) {
    return false;
  }

  return normalizedCategory.replace(/\s+/g, "") === "roomtransition";
}

function buildSoundCueTraceKey(cue: HostCommandSoundCue): string {
  return `${cue.commandCorrelationId}:${cue.actionId}:${cue.sequenceIndex}:${cue.soundEffectLane}:${cue.soundEffectKey}`;
}

interface UseHostRendererSessionWorkflowOptions {
  hostApiClient: HostApiClient;
  credentialHandle: string;
  activeSessionId: string;
  selectedGameId: string;
  selectedGameKey: string;
  presentationCueCatalogRevision: number;
  rendererSceneSnapshot: GameRenderSceneSnapshot | null;
  setRendererSceneSnapshot: (snapshot: GameRenderSceneSnapshot | null) => void;
  applyPresentationCues: (scene: GameRenderSceneSnapshot) => GameRenderSceneSnapshot;
  getCurrentPresentationCueCatalog: () => PresentationCueCatalogDocument | null;
  ensurePresentationCueCatalogReady: () => Promise<PresentationCueCatalogDocument>;
  presentationCueCatalogSource: "none" | "cache" | "network";
  particleAssetWarmupEnabled?: boolean;
  getHudOverlayEntries: () => GameRenderSceneSnapshot["hudOverlayEntries"];
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
  sessionDeltaResetEpoch: number;
  onGameplayChange?: () => void;
  consumeSessionDeltaPhasePresentation: (sessionData: HostSessionPresentationData) => void;
  consumeSessionDeltaEcho: (sessionData: HostSessionPresentationData) => void;
  consumeSessionDeltaSoundCues: (sessionData: HostSessionPresentationData, isBaseline?: boolean) => void;
  refreshCacheStats: () => void;
  addDiagnostic: AddDiagnostic;
}

function extractContentTypeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1] ?? "application/octet-stream";
}

function buildParticleEffectCatalog(catalog: PresentationCueCatalogDocument | null): GameRenderSceneSnapshot["particleEffectCatalog"] {
  return (catalog?.effects ?? [])
    .filter((effect) => effect.category === "ParticleEffect" && effect.particleEffect)
    .map((effect) => ({
      category: "ParticleEffect" as const,
      effectKey: effect.effectKey ?? "",
      displayName: effect.displayName ?? effect.effectKey ?? "",
      particleEffect: effect.particleEffect!
    }));
}

function summarizeParticleInstances(scene: GameRenderSceneSnapshot): {
  objectInstanceCount: number;
  enabledObjectInstanceCount: number;
  roomInstanceCount: number;
  enabledRoomInstanceCount: number;
  effectKeys: string[];
} {
  const objectEffects = Object.values(scene.objectsById)
    .map((object) => object.particleEffect)
    .filter((effect): effect is NonNullable<typeof effect> => Boolean(effect));
  const roomEffects = scene.environmentalParticleEffects ?? [];
  return {
    objectInstanceCount: objectEffects.length,
    enabledObjectInstanceCount: objectEffects.filter((effect) => effect.enabled).length,
    roomInstanceCount: roomEffects.length,
    enabledRoomInstanceCount: roomEffects.filter((effect) => effect.enabled).length,
    effectKeys: [...new Set([...objectEffects, ...roomEffects].map((effect) => effect.effectKey))].sort()
  };
}

function summarizeHostParticleInstances(baseline: HostSessionPresentationData): {
  roomId: string | null;
  renderableRoomObjectCount: number;
  objectInstanceCount: number;
  enabledObjectInstanceCount: number;
  objectEffects: Array<{ objectId: string; effectKey: string; isProducing: boolean; x: number; y: number }>;
  roomInstanceCount: number;
  enabledRoomInstanceCount: number;
  roomEffects: Array<{ instanceId: string; effectKey: string; isProducing: boolean; renderOrder: number }>;
} {
  const room = baseline.roomChange?.newRoom;
  const objects = room?.renderableRoomObjects ?? [];
  const objectEffects = objects.flatMap((object) => object.particleEffect ? [{
    objectId: object.objectId,
    effectKey: object.particleEffect.effectKey,
    isProducing: object.particleEffect.isProducing,
    x: object.particleEffect.x,
    y: object.particleEffect.y
  }] : []);
  const roomEffects = room?.environmentalParticleEffects ?? [];
  return {
    roomId: room?.roomId ?? null,
    renderableRoomObjectCount: objects.length,
    objectInstanceCount: objectEffects.length,
    enabledObjectInstanceCount: objectEffects.filter((effect) => effect.isProducing).length,
    objectEffects,
    roomInstanceCount: roomEffects.length,
    enabledRoomInstanceCount: roomEffects.filter((effect) => effect.isProducing).length,
    roomEffects: roomEffects.map((effect) => ({
      instanceId: effect.instanceId,
      effectKey: effect.effectKey,
      isProducing: effect.isProducing,
      renderOrder: effect.renderOrder
    }))
  };
}

export function useHostRendererSessionWorkflow(options: UseHostRendererSessionWorkflowOptions): HostRendererSessionWorkflowResult {
  const [baselineSyncReady, setBaselineSyncReady] = useState<boolean>(false);
  const [baselineWatermark, setBaselineWatermark] = useState<string>("");
  const [roomTransitionPreparationEpoch, setRoomTransitionPreparationEpoch] = useState<number>(0);
  const [roomTransitionActive, setRoomTransitionActive] = useState<boolean>(false);
  const [sessionDeltaRevision, setSessionDeltaRevision] = useState<number>(0);
  const sceneHydrationGenerationRef = useRef<number>(0);
  const rendererSceneSnapshotRef = useRef<GameRenderSceneSnapshot | null>(options.rendererSceneSnapshot);
  const setRendererSceneSnapshotRef = useRef(options.setRendererSceneSnapshot);
  setRendererSceneSnapshotRef.current = options.setRendererSceneSnapshot;
  const applyPresentationCuesRef = useRef(options.applyPresentationCues);
  const getCurrentPresentationCueCatalogRef = useRef(options.getCurrentPresentationCueCatalog);
  const presentationCueCatalogSourceRef = useRef(options.presentationCueCatalogSource);
  const getHudOverlayEntriesRef = useRef(options.getHudOverlayEntries);
  const consumeSessionDeltaPhasePresentationRef = useRef(options.consumeSessionDeltaPhasePresentation);
  const consumeSessionDeltaEchoRef = useRef(options.consumeSessionDeltaEcho);
  const consumeSessionDeltaSoundCuesRef = useRef(options.consumeSessionDeltaSoundCues);
  const addDiagnosticRef = useRef(options.addDiagnostic);
  const ensurePresentationCueCatalogReadyRef = useRef(options.ensurePresentationCueCatalogReady);
  const presentationCueCatalogRevisionRef = useRef<number>(options.presentationCueCatalogRevision);
  const pollingPausedForRoomTransitionRef = useRef<boolean>(false);
  const pollingPauseWatchdogRef = useRef<number | null>(null);
  const deferredPhasePresentationRef = useRef<HostSessionPresentationData[]>([]);
  const particleAssetWarmupJobsRef = useRef<Map<string, Promise<void>>>(new Map());

  const waitForSessionGlobalAssets = useCallback(async (): Promise<PresentationCueCatalogDocument> => {
    addDiagnosticRef.current("info", "session-startup", "Waiting for required session global assets.", {
      sessionId: options.activeSessionId,
      assets: ["presentation-cue-catalog"]
    });
    const catalog = await ensurePresentationCueCatalogReadyRef.current();
    addDiagnosticRef.current("info", "session-startup", "Required session global assets are ready.", {
      sessionId: options.activeSessionId,
      assets: ["presentation-cue-catalog"]
    });
    return catalog;
  }, [options.activeSessionId]);

  const warmDiscoveredParticleAssets = useCallback(async (scene: GameRenderSceneSnapshot): Promise<void> => {
    if (!options.credentialHandle || !options.activeSessionId) return;
    const roomId = scene.roomId ?? "";
    if (!roomId) return;
    const warmupKey = `${options.activeSessionId}:${roomId}`;
    const existingJob = particleAssetWarmupJobsRef.current.get(warmupKey);
    if (existingJob) return existingJob;

    const job = (async (): Promise<void> => {
      webPortalAssetCache.recordNetworkFetch();
      options.refreshCacheStats();
      const discovery = await options.hostApiClient.discoverAssets(options.credentialHandle, options.activeSessionId, "Ancestors");
      if (!discovery.result.success) {
        throw new Error(`Asset discovery failed (${discovery.resultCode}).`);
      }
      const mappedSlots = new Set((scene.particleEffectImageMappings ?? []).map((mapping) =>
        `${mapping.effectKey.toLowerCase()}\u0000${mapping.imageSlot.toLowerCase()}`));
      const customImageCandidates = discovery.candidates.filter((candidate) => {
        const association = candidate.particleEffectAssociation;
        return candidate.assetType === "Image" && !!association
          && mappedSlots.has(`${association.effectKey.toLowerCase()}\u0000${association.imageSlot.toLowerCase()}`);
      });
      let cachedCount = 0;
      let fetchedCount = 0;
      for (const candidate of customImageCandidates) {
        const locator = candidate.relativeLocator.trim();
        if (!locator) continue;
        if (candidate.missing) {
          addDiagnosticRef.current("warn", "asset-discovery", "Discovered custom particle art is missing from the game assets.", {
            roomId,
            relativeLocator: locator,
            particleEffectAssociation: candidate.particleEffectAssociation
          });
          continue;
        }
        const cacheKey = buildAssetCacheKey({
          gameId: options.selectedGameId,
          gameKey: options.selectedGameKey,
          relativeLocator: locator,
          kind: "image-data-url"
        });
        const cached = await webPortalAssetCache.get(cacheKey);
        if (cached.entry?.value) {
          cachedCount += 1;
          continue;
        }
        const dataUrl = await options.hostApiClient.getAssetPreviewDataUrl(
          options.credentialHandle,
          locator,
          options.selectedGameId,
          options.selectedGameKey
        );
        if (!dataUrl) {
          addDiagnosticRef.current("warn", "asset-discovery", "Could not load discovered custom particle art; packaged defaults remain available.", {
            roomId,
            relativeLocator: locator
          });
          continue;
        }
        webPortalAssetCache.recordNetworkFetch();
        options.refreshCacheStats();
        await webPortalAssetCache.set({
          cacheKey,
          gameId: options.selectedGameId,
          gameKey: options.selectedGameKey,
          relativeLocator: locator,
          kind: "image-data-url",
          contentType: extractContentTypeFromDataUrl(dataUrl),
          value: dataUrl
        });
        fetchedCount += 1;
      }
      options.refreshCacheStats();
      addDiagnosticRef.current("info", "asset-discovery", "Warmed discovered custom particle art in the Portal asset cache.", {
        roomId,
        candidateCount: customImageCandidates.length,
        cachedCount,
        fetchedCount,
        truncated: discovery.truncated
      });
    })();
    particleAssetWarmupJobsRef.current.set(warmupKey, job);
    try {
      await job;
    } catch (error) {
      particleAssetWarmupJobsRef.current.delete(warmupKey);
      addDiagnosticRef.current("warn", "asset-discovery", "Could not warm discovered particle art; demand loading remains available.", {
        roomId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [options.activeSessionId, options.credentialHandle, options.hostApiClient, options.refreshCacheStats, options.selectedGameId, options.selectedGameKey]);

  const loadParticleEffectImage = useCallback(async (relativeLocator: string): Promise<string | null> => {
    const locator = relativeLocator.trim();
    if (!locator || !options.credentialHandle || !options.activeSessionId) return null;
    const cacheKey = buildAssetCacheKey({ gameId: options.selectedGameId, gameKey: options.selectedGameKey, relativeLocator: locator, kind: "image-data-url" });
    const cached = await webPortalAssetCache.get(cacheKey);
    if (cached.entry?.value) return cached.entry.value;
    const dataUrl = await options.hostApiClient.getAssetPreviewDataUrl(options.credentialHandle, locator, options.selectedGameId, options.selectedGameKey);
    if (!dataUrl) return null;
    webPortalAssetCache.recordNetworkFetch();
    options.refreshCacheStats();
    await webPortalAssetCache.set({ cacheKey, gameId: options.selectedGameId, gameKey: options.selectedGameKey, relativeLocator: locator,
      kind: "image-data-url", contentType: extractContentTypeFromDataUrl(dataUrl), value: dataUrl });
    return dataUrl;
  }, [options.activeSessionId, options.credentialHandle, options.hostApiClient, options.refreshCacheStats, options.selectedGameId, options.selectedGameKey]);

  const releaseRoomTransitionPollingPause = useCallback((reason: string): void => {
    if (pollingPauseWatchdogRef.current !== null) {
      window.clearTimeout(pollingPauseWatchdogRef.current);
      pollingPauseWatchdogRef.current = null;
    }

    const wasPaused = pollingPausedForRoomTransitionRef.current;
    pollingPausedForRoomTransitionRef.current = false;
    setRoomTransitionActive(false);
    const deferred = deferredPhasePresentationRef.current.splice(0);
    for (const sessionData of deferred) {
      consumeSessionDeltaPhasePresentationRef.current(sessionData);
    }

    if (wasPaused) {
      addDiagnosticRef.current("info", "session-delta", "Released room-transition polling pause.", {
        reason,
        deferredPhasePresentationCount: deferred.length
      });
    }
  }, []);

  const assertRoomTransitionPollingPause = useCallback((reason: string): void => {
    if (!pollingPausedForRoomTransitionRef.current) {
      pollingPausedForRoomTransitionRef.current = true;
      setRoomTransitionActive(true);
      addDiagnosticRef.current("info", "session-delta", "Paused session delta polling for room transition.", {
        reason,
        watchdogMs: ROOM_TRANSITION_POLLING_PAUSE_WATCHDOG_MS
      });
    }

    if (pollingPauseWatchdogRef.current !== null) {
      window.clearTimeout(pollingPauseWatchdogRef.current);
    }
    pollingPauseWatchdogRef.current = window.setTimeout(() => {
      pollingPauseWatchdogRef.current = null;
      addDiagnosticRef.current("warn", "session-delta", "Room-transition polling pause watchdog elapsed; resuming polling.", {
        watchdogMs: ROOM_TRANSITION_POLLING_PAUSE_WATCHDOG_MS
      });
      releaseRoomTransitionPollingPause("watchdog");
    }, ROOM_TRANSITION_POLLING_PAUSE_WATCHDOG_MS);
  }, [releaseRoomTransitionPollingPause]);

  const reportRoomTransitionState = useCallback((state: GameRendererRoomTransitionState): void => {
    addDiagnosticRef.current("info", "session-delta", "Renderer reported room-transition lifecycle state.", {
      state,
      pollingPauseActive: pollingPausedForRoomTransitionRef.current,
      deferredPhasePresentationCount: deferredPhasePresentationRef.current.length,
      destinationRoomId: rendererSceneSnapshotRef.current?.roomId || "(unknown)"
    });
    if (state === "preparing" || state === "running") {
      assertRoomTransitionPollingPause(`renderer-${state}`);
      return;
    }

    releaseRoomTransitionPollingPause(`renderer-${state}`);
  }, [assertRoomTransitionPollingPause, releaseRoomTransitionPollingPause]);

  useEffect(() => {
    rendererSceneSnapshotRef.current = options.rendererSceneSnapshot;
  }, [options.rendererSceneSnapshot]);

  useEffect(() => {
    applyPresentationCuesRef.current = options.applyPresentationCues;
  }, [options.applyPresentationCues]);

  useEffect(() => {
    getCurrentPresentationCueCatalogRef.current = options.getCurrentPresentationCueCatalog;
  }, [options.getCurrentPresentationCueCatalog]);

  useEffect(() => {
    presentationCueCatalogSourceRef.current = options.presentationCueCatalogSource;
  }, [options.presentationCueCatalogSource]);

  useEffect(() => {
    getHudOverlayEntriesRef.current = options.getHudOverlayEntries;
  }, [options.getHudOverlayEntries]);

  useEffect(() => {
    consumeSessionDeltaPhasePresentationRef.current = options.consumeSessionDeltaPhasePresentation;
  }, [options.consumeSessionDeltaPhasePresentation]);

  useEffect(() => {
    consumeSessionDeltaEchoRef.current = options.consumeSessionDeltaEcho;
  }, [options.consumeSessionDeltaEcho]);

  useEffect(() => {
    consumeSessionDeltaSoundCuesRef.current = options.consumeSessionDeltaSoundCues;
  }, [options.consumeSessionDeltaSoundCues]);

  useEffect(() => {
    addDiagnosticRef.current = options.addDiagnostic;
  }, [options.addDiagnostic]);
  useEffect(() => {
    ensurePresentationCueCatalogReadyRef.current = options.ensurePresentationCueCatalogReady;
  }, [options.ensurePresentationCueCatalogReady]);

  useEffect(() => {
    return () => {
      if (pollingPauseWatchdogRef.current !== null) {
        window.clearTimeout(pollingPauseWatchdogRef.current);
        pollingPauseWatchdogRef.current = null;
      }
      pollingPausedForRoomTransitionRef.current = false;
      deferredPhasePresentationRef.current.length = 0;
    };
  }, []);

  useEffect(() => {
    const previousRevision = presentationCueCatalogRevisionRef.current;
    const nextRevision = options.presentationCueCatalogRevision;
    presentationCueCatalogRevisionRef.current = nextRevision;

    if (nextRevision === previousRevision) {
      return;
    }

    const currentScene = rendererSceneSnapshotRef.current;
    if (!currentScene) {
      return;
    }

    const resolvedScene = applyPresentationCuesRef.current(currentScene);
    options.setRendererSceneSnapshot({
      ...resolvedScene,
      particleEffectCatalog: buildParticleEffectCatalog(getCurrentPresentationCueCatalogRef.current()),
      hudOverlayEntries: getHudOverlayEntriesRef.current()
    });

    addDiagnosticRef.current("info", "presentation-cues", "Re-applied scene cue styles after presentation catalog revision changed.", {
      previousRevision,
      nextRevision,
      roomId: resolvedScene.roomId || "(unknown)",
      roomObjectCount: selectRenderableRoomObjects(resolvedScene).length
    });
  }, [options.presentationCueCatalogRevision, options.setRendererSceneSnapshot]);

  const emitMovementCueResolutionDiagnostics = useCallback((
    source: "baseline" | "delta",
    previousScene: GameRenderSceneSnapshot | null,
    resolvedScene: GameRenderSceneSnapshot,
    sessionData: HostSessionPresentationData | null
  ): void => {
    if (source !== "delta") {
      return;
    }

    const changedById = new Map((sessionData?.roomObjectChanges ?? []).map((change) => [change.objectId, change]));
    if (changedById.size === 0) {
      return;
    }

    const previousById = new Map((previousScene ? selectRenderableRoomObjects(previousScene) : []).map((roomObject) => [roomObject.objectId, roomObject]));
    const diagnosticsRows: Array<{
      objectId: string;
      objectName: string;
      previousX?: number;
      previousY?: number;
      nextX: number;
      nextY: number;
      movementCueEffectKeys: string[];
      movementDurationMs?: number;
      movementFrames?: number;
      status: "animated" | "instant-no-cue" | "instant-unresolved-cue" | "instant-zero-duration-cue";
    }> = [];

    for (const roomObject of selectRenderableRoomObjects(resolvedScene)) {
      const change = changedById.get(roomObject.objectId);
      if (!change || (change.changeKind !== "Added" && change.changeKind !== "Updated")) {
        continue;
      }

      const previous = previousById.get(roomObject.objectId);
      const moved = previous
        ? previous.x !== roomObject.x || previous.y !== roomObject.y
        : true;

      if (!moved) {
        continue;
      }

      const movementCueEffectKeys = summarizeMovementCueEffects(roomObject.activePresentationCues);
      const resolvedDurationMs = roomObject.movementDurationMs;
      const roundedDurationMs = resolvedDurationMs === undefined ? undefined : Math.max(0, Math.round(resolvedDurationMs));

      let status: "animated" | "instant-no-cue" | "instant-unresolved-cue" | "instant-zero-duration-cue" = "animated";
      if (roundedDurationMs === undefined) {
        status = movementCueEffectKeys.length === 0
          ? "instant-no-cue"
          : "instant-unresolved-cue";
      } else if (roundedDurationMs <= 0) {
        status = "instant-zero-duration-cue";
      }

      diagnosticsRows.push({
        objectId: roomObject.objectId,
        objectName: roomObject.objectName,
        previousX: previous?.x,
        previousY: previous?.y,
        nextX: roomObject.x,
        nextY: roomObject.y,
        movementCueEffectKeys,
        movementDurationMs: roundedDurationMs,
        movementFrames: roomObject.movementFrames,
        status
      });
    }

    if (diagnosticsRows.length === 0) {
      return;
    }

    const instantRows = diagnosticsRows.filter((entry) => entry.status !== "animated");
    const level: DiagnosticsLevel = instantRows.length > 0 ? "warn" : "info";

    addDiagnosticRef.current(level, "movement-cues", "Movement cue resolution summary for session delta.", {
      source,
      watermark: sessionData?.sessionDeltaWatermark?.trim() || "(none)",
      changedObjectCount: diagnosticsRows.length,
      animatedCount: diagnosticsRows.length - instantRows.length,
      instantCount: instantRows.length,
      rows: diagnosticsRows
    });
  }, []);

  const emitAppearanceCueResolutionDiagnostics = useCallback((
    source: "baseline" | "delta",
    resolvedScene: GameRenderSceneSnapshot,
    sessionData: HostSessionPresentationData | null
  ): void => {
    const catalog = getCurrentPresentationCueCatalogRef.current();
    const appearanceEffects = (catalog?.effects ?? []).filter((effect) => {
      return normalizeCueToken(effect.category) === "appearance";
    });
    const appearanceEffectKeys = new Set(appearanceEffects.map((effect) => normalizeCueToken(effect.effectKey)));
    const changedObjectIds = new Set((sessionData?.roomObjectChanges ?? []).map((change) => change.objectId));
    const unresolvedRows: Array<{
      objectId: string;
      objectName: string;
      cueEffectKey: string;
      cueCategory: string;
      reason: "catalog-effect-key-not-found";
    }> = [];

    for (const roomObject of selectRenderableRoomObjects(resolvedScene)) {
      if (source === "delta" && changedObjectIds.size > 0 && !changedObjectIds.has(roomObject.objectId)) {
        continue;
      }

      for (const cue of roomObject.activePresentationCues) {
        if (!isAppearanceCueCategory(cue.category)) {
          continue;
        }

        const cueEffectKey = cue.effectKey.trim();
        if (!cueEffectKey) {
          continue;
        }

        if (!appearanceEffectKeys.has(normalizeCueToken(cueEffectKey))) {
          unresolvedRows.push({
            objectId: roomObject.objectId,
            objectName: roomObject.objectName,
            cueEffectKey,
            cueCategory: cue.category,
            reason: "catalog-effect-key-not-found"
          });
        }
      }
    }

    if (unresolvedRows.length === 0) {
      return;
    }

    addDiagnosticRef.current("warn", "presentation-cues", "Appearance presentation cue requested but not found in loaded catalog.", {
      source,
      watermark: sessionData?.sessionDeltaWatermark?.trim() || "(none)",
      catalogLoaded: Boolean(catalog),
      catalogSource: presentationCueCatalogSourceRef.current,
      appearanceCatalogEffectCount: appearanceEffects.length,
      unresolvedCount: unresolvedRows.length,
      rows: unresolvedRows
    });
  }, []);

  const emitRoomTransitionCueResolutionDiagnostics = useCallback((
    source: "baseline" | "delta",
    resolvedScene: GameRenderSceneSnapshot,
    sessionData: HostSessionPresentationData | null
  ): void => {
    const roomChange = sessionData?.roomChange;
    if (!roomChange?.presentationCues || roomChange.presentationCues.length === 0) {
      return;
    }

    const requestedRoomTransitionCue = roomChange.presentationCues.find((cue) => {
      if (!isRoomTransitionCue(cue)) {
        return false;
      }

      return cue.effectKey.trim().length > 0;
    });
    const requestedCueEffectKey = requestedRoomTransitionCue?.effectKey?.trim() ?? "";
    if (!requestedCueEffectKey) {
      return;
    }

    const catalog = getCurrentPresentationCueCatalogRef.current();
    const roomTransitionEffects = (catalog?.effects ?? []).filter((effect) => {
      return normalizeCueToken(effect.category) === "roomtransition";
    });
    const roomTransitionEffectKeys = new Set(roomTransitionEffects.map((effect) => normalizeCueToken(effect.effectKey)));
    const requestedFoundInCatalog = roomTransitionEffectKeys.has(normalizeCueToken(requestedCueEffectKey));
    if (requestedFoundInCatalog) {
      return;
    }

    const appliedCueEffectKey = resolvedScene.roomTransition?.cueEffectKey?.trim() ?? "";

    addDiagnosticRef.current("warn", "presentation-cues", "Room-transition cue requested by runtime was not found in loaded catalog; using fallback transition settings.", {
      source,
      roomId: resolvedScene.roomId || "(unknown)",
      watermark: sessionData?.sessionDeltaWatermark?.trim() || "(none)",
      requestedCueEffectKey,
      appliedCueEffectKey: appliedCueEffectKey || "(none)",
      travelDirection: roomChange.travelDirection || "(none)",
      catalogLoaded: Boolean(catalog),
      catalogSource: presentationCueCatalogSourceRef.current,
      roomTransitionCatalogEffectCount: roomTransitionEffects.length,
      fallbackReason: "catalog-effect-key-not-found"
    });
  }, []);

  const emitTimingSyncDiagnostics = useCallback((
    previousScene: GameRenderSceneSnapshot | null,
    resolvedScene: GameRenderSceneSnapshot,
    sessionData: HostSessionPresentationData
  ): void => {
    const changedById = new Map((sessionData.roomObjectChanges ?? []).map((change) => [change.objectId, change]));
    const previousById = new Map((previousScene ? selectRenderableRoomObjects(previousScene) : []).map((roomObject) => [roomObject.objectId, roomObject]));

    const movementRows: Array<{
      objectId: string;
      objectName: string;
      fromX?: number;
      fromY?: number;
      toX: number;
      toY: number;
      movementDurationMs?: number;
      movementFrames?: number;
      movementCueEffectKeys: string[];
    }> = [];

    for (const roomObject of selectRenderableRoomObjects(resolvedScene)) {
      const change = changedById.get(roomObject.objectId);
      if (!change || (change.changeKind !== "Added" && change.changeKind !== "Updated")) {
        continue;
      }

      const previous = previousById.get(roomObject.objectId);
      const moved = previous
        ? previous.x !== roomObject.x || previous.y !== roomObject.y
        : true;
      if (!moved) {
        continue;
      }

      movementRows.push({
        objectId: roomObject.objectId,
        objectName: roomObject.objectName,
        fromX: previous?.x,
        fromY: previous?.y,
        toX: roomObject.x,
        toY: roomObject.y,
        movementDurationMs: roomObject.movementDurationMs,
        movementFrames: roomObject.movementFrames,
        movementCueEffectKeys: summarizeMovementCueEffects(roomObject.activePresentationCues)
      });
    }

    const soundCueRows = (sessionData.soundCues ?? []).map((cue) => {
      const startDelayMs = toNonNegativeInt(cue.startDelayMs);
      const sourceDurationMs = toNonNegativeInt(cue.sourceDurationMs);
      const maxPlayDurationMs = toNonNegativeInt(cue.maxPlayDurationMs);
      const plannedSinglePassDurationMs = sourceDurationMs > 0
        ? sourceDurationMs
        : undefined;
      return {
        traceKey: buildSoundCueTraceKey(cue),
        operation: cue.operation,
        commandCorrelationId: cue.commandCorrelationId,
        actionId: cue.actionId,
        sequenceIndex: cue.sequenceIndex,
        lane: cue.soundEffectLane,
        soundEffectKey: cue.soundEffectKey,
        startDelayMs,
        sourceDurationMs: plannedSinglePassDurationMs,
        maxPlayDurationMs: maxPlayDurationMs > 0 ? maxPlayDurationMs : undefined,
        plannedStopOffsetMs: maxPlayDurationMs > 0
          ? startDelayMs + maxPlayDurationMs
          : plannedSinglePassDurationMs
            ? startDelayMs + plannedSinglePassDurationMs
            : undefined,
        repeatMode: cue.repeatMode,
        repeatDurationMs: cue.repeatDurationMs,
        repeatCount: cue.repeatCount,
        repeatIntervalMs: cue.repeatIntervalMs,
        repeatCooldownMs: cue.repeatCooldownMs
      };
    });

    if (movementRows.length === 0 && soundCueRows.length === 0) {
      return;
    }

    const maxMovementDurationMs = movementRows.reduce((maxValue, row) => Math.max(maxValue, toNonNegativeInt(row.movementDurationMs)), 0);
    const maxSoundPlannedStopOffsetMs = soundCueRows.reduce((maxValue, row) => Math.max(maxValue, toNonNegativeInt(row.plannedStopOffsetMs)), 0);

    addDiagnosticRef.current("info", "timing-sync", "Delta timing ledger for movement and sound cues.", {
      watermark: sessionData.sessionDeltaWatermark?.trim() || "(none)",
      recordedAtMs: Date.now(),
      roomId: resolvedScene.roomId || "(unknown)",
      changedRoomObjectCount: sessionData.roomObjectChanges.length,
      movementRowCount: movementRows.length,
      soundCueRowCount: soundCueRows.length,
      maxMovementDurationMs,
      maxSoundPlannedStopOffsetMs,
      movementRows,
      soundCueRows
    });
  }, []);

  const hydrateSceneSnapshotAssets = useCallback(async (
    scene: GameRenderSceneSnapshot,
    source: "baseline" | "delta"
  ): Promise<void> => {
    const generation = ++sceneHydrationGenerationRef.current;
    if (options.particleAssetWarmupEnabled) {
      void warmDiscoveredParticleAssets(scene).catch((error) => {
        addDiagnosticRef.current("warn", "asset-discovery", "Particle asset warm-up failed; continuing with the room scene and packaged particle art.", {
          roomId: scene.roomId || "(unknown)",
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
    const particleEffectCatalog = scene.particleEffectCatalog
      ?? buildParticleEffectCatalog(getCurrentPresentationCueCatalogRef.current());
    const sceneWithCatalog = { ...scene, particleEffectCatalog };
    const uniqueAssetPaths = Array.from(new Set(
      [
        ...sceneWithCatalog.directionalOverlays.map((overlay) => overlay.asset.assetPath.trim()),
        ...selectRenderableRoomObjects(sceneWithCatalog).map((roomObject) => roomObject.asset.assetPath.trim())
      ]
        .filter((path) => path.length > 0 && !path.startsWith("data:") && !path.startsWith("blob:"))
    ));

    if (uniqueAssetPaths.length === 0) {
      options.setRendererSceneSnapshot({
        ...sceneWithCatalog,
        hudOverlayEntries: getHudOverlayEntriesRef.current()
      });
      return;
    }

    if (!options.credentialHandle) {
      options.setRendererSceneSnapshot({
        ...sceneWithCatalog,
        hudOverlayEntries: getHudOverlayEntriesRef.current()
      });
      addDiagnosticRef.current("warn", "session-render", "Skipping asset hydration because credential handle is missing.", {
        source,
        roomId: scene.roomId || "(unknown)",
        assetCount: uniqueAssetPaths.length
      });
      return;
    }

    if (!options.selectedGameId && !options.selectedGameKey) {
      options.setRendererSceneSnapshot({
        ...sceneWithCatalog,
        hudOverlayEntries: getHudOverlayEntriesRef.current()
      });
      addDiagnosticRef.current("warn", "session-render", "Skipping asset hydration because selected game identity is missing.", {
        source,
        roomId: scene.roomId || "(unknown)",
        assetCount: uniqueAssetPaths.length
      });
      return;
    }

    const resolvedByPath = new Map<string, string>();
    const missingAssetPaths: string[] = [];

    for (const assetPath of uniqueAssetPaths) {
      const assetCacheKey = buildAssetCacheKey({
        gameId: options.selectedGameId,
        gameKey: options.selectedGameKey,
        relativeLocator: assetPath,
        kind: "image-data-url"
      });

      try {
        const cachedLookup = await webPortalAssetCache.get(assetCacheKey);
        options.refreshCacheStats();

        if (cachedLookup.entry?.value) {
          resolvedByPath.set(assetPath, cachedLookup.entry.value);
          addDiagnosticRef.current("info", "asset-cache", "Resolved renderer asset from cache.", {
            source: cachedLookup.source,
            cacheKey: assetCacheKey,
            assetPath,
            roomId: scene.roomId || "(unknown)"
          });
          continue;
        }
      } catch (error) {
        addDiagnosticRef.current("warn", "asset-cache", "Could not read renderer image asset cache; fetching from Host.", {
          source,
          roomId: scene.roomId || "(unknown)",
          assetPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      try {
        webPortalAssetCache.recordNetworkFetch();
        options.refreshCacheStats();

        const dataUrl = await options.hostApiClient.getAssetPreviewDataUrl(
          options.credentialHandle,
          assetPath,
          options.selectedGameId,
          options.selectedGameKey
        );

        if (!dataUrl) {
          missingAssetPaths.push(assetPath);
          addDiagnosticRef.current("warn", "session-render", "Failed to resolve image asset for renderer.", {
            source,
            roomId: scene.roomId || "(unknown)",
            assetPath,
            cacheKey: assetCacheKey
          });
          continue;
        }

        resolvedByPath.set(assetPath, dataUrl);
        try {
          await webPortalAssetCache.set({
            cacheKey: assetCacheKey,
            gameId: options.selectedGameId,
            gameKey: options.selectedGameKey,
            relativeLocator: assetPath,
            kind: "image-data-url",
            contentType: extractContentTypeFromDataUrl(dataUrl),
            value: dataUrl
          });
          options.refreshCacheStats();
        } catch (error) {
          addDiagnosticRef.current("warn", "asset-cache", "Could not cache renderer image asset.", {
            source,
            roomId: scene.roomId || "(unknown)",
            assetPath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error) {
        missingAssetPaths.push(assetPath);
        addDiagnosticRef.current("warn", "session-render", "Failed to resolve image asset for renderer.", {
          source,
          roomId: scene.roomId || "(unknown)",
          assetPath,
          cacheKey: assetCacheKey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (generation !== sceneHydrationGenerationRef.current) {
      return;
    }

    const hydratedScene = mapRenderableRoomObjects({
      ...sceneWithCatalog,
      directionalOverlays: sceneWithCatalog.directionalOverlays.map((overlay) => {
        const resolved = resolvedByPath.get(overlay.asset.assetPath.trim());
        return {
          ...overlay,
          asset: {
            ...overlay.asset,
            assetPath: resolved || overlay.asset.assetPath
          }
        };
      })
    }, (roomObject) => {
      const resolved = resolvedByPath.get(roomObject.asset.assetPath.trim());
      return {
        ...roomObject,
        asset: {
          ...roomObject.asset,
          assetPath: resolved || roomObject.asset.assetPath
        }
      };
    });

    options.setRendererSceneSnapshot({
      ...hydratedScene,
      hudOverlayEntries: getHudOverlayEntriesRef.current()
    });

    if (missingAssetPaths.length > 0) {
      addDiagnosticRef.current("warn", "session-render", "One or more image assets could not be resolved for rendering.", {
        source,
        roomId: scene.roomId || "(unknown)",
        missingAssetCount: missingAssetPaths.length,
        missingAssetPaths
      });
    }

    addDiagnosticRef.current("info", "session-render", "Applied hydrated scene assets for renderer.", {
      source,
      roomId: hydratedScene.roomId || "(unknown)",
      resolvedAssetCount: resolvedByPath.size,
      missingAssetCount: missingAssetPaths.length,
      overlayCount: hydratedScene.directionalOverlays.length,
      roomObjectCount: selectRenderableRoomObjects(hydratedScene).length,
      particleInstances: summarizeParticleInstances(hydratedScene),
      particleCatalogEffectCount: hydratedScene.particleEffectCatalog?.length ?? 0
    });
  }, [
    options.credentialHandle,
    options.hostApiClient,
    options.refreshCacheStats,
    options.selectedGameId,
    options.selectedGameKey,
    options.setRendererSceneSnapshot,
    options.particleAssetWarmupEnabled,
    warmDiscoveredParticleAssets
  ]);

  useEffect(() => {
    if (!options.particleAssetWarmupEnabled || !options.rendererSceneSnapshot) return;
    void warmDiscoveredParticleAssets(options.rendererSceneSnapshot).catch((error) => {
      addDiagnosticRef.current("warn", "asset-discovery", "Particle asset warm-up failed; the room scene remains available.", {
        roomId: options.rendererSceneSnapshot?.roomId || "(unknown)",
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, [options.particleAssetWarmupEnabled, options.rendererSceneSnapshot, warmDiscoveredParticleAssets]);

  const applySessionBaseline = useCallback(async (
    baseline: HostSessionPresentationData,
    source: "startup" | "resync",
    readyCatalog?: PresentationCueCatalogDocument
  ): Promise<void> => {
    const startupCatalog = readyCatalog ?? await waitForSessionGlobalAssets();
    const baselineWatermark = (baseline.sessionDeltaWatermark ?? "").trim();
    setBaselineWatermark(baselineWatermark);

    const baselineSnapshot = mapHostPresentationToSceneSnapshot(baseline);
    const baselineTextStepCount = baseline.phaseChange?.orderedTextPresentationSteps?.length ?? 0;
    const baselineSessionData = baseline;

    if (baselineSnapshot) {
      const hostObjectEffects = (baseline.roomChange?.newRoom?.renderableRoomObjects ?? [])
        .map((object) => object.particleEffect)
        .filter((effect) => Boolean(effect));
      addDiagnosticRef.current("info", "session-render", "Mapped particle effect instances from Host baseline.", {
        source,
        roomId: baselineSnapshot.roomId,
        hostObjectInstanceCount: hostObjectEffects.length,
        hostEnabledObjectInstanceCount: hostObjectEffects.filter((effect) => effect?.isProducing).length,
        ...summarizeParticleInstances(baselineSnapshot)
      });
    }

    consumeSessionDeltaSoundCuesRef.current(baselineSessionData, true);

    if (baselineTextStepCount > 0) {
      consumeSessionDeltaPhasePresentationRef.current(baselineSessionData);
    }

    if (!baselineSnapshot) {
      setRendererSceneSnapshotRef.current(null);
      addDiagnosticRef.current("warn", "session-render", "Session baseline did not include a room scene payload.", {
        source,
        sessionId: options.activeSessionId,
        watermark: baseline.sessionDeltaWatermark || "(none)"
      });
      return;
    }

    const resolvedSnapshot = {
      ...applyPresentationCuesRef.current(baselineSnapshot),
      particleEffectCatalog: buildParticleEffectCatalog(startupCatalog)
    };
    addDiagnosticRef.current("info", "session-render", "Prepared particle effect instances for baseline scene hydration.", {
      source,
      roomId: resolvedSnapshot.roomId,
      ...summarizeParticleInstances(resolvedSnapshot),
      catalogEffectCount: resolvedSnapshot.particleEffectCatalog?.length ?? 0
    });
    emitMovementCueResolutionDiagnostics("baseline", null, resolvedSnapshot, null);
    emitAppearanceCueResolutionDiagnostics("baseline", resolvedSnapshot, null);
    emitRoomTransitionCueResolutionDiagnostics("baseline", resolvedSnapshot, baselineSessionData);
    await hydrateSceneSnapshotAssets(resolvedSnapshot, "baseline");
    addDiagnosticRef.current("info", "session-render", "Hydrated renderer scene from session baseline.", {
      source,
      sessionId: options.activeSessionId,
      roomId: baselineSnapshot.roomId || "(unknown)",
      overlayCount: baselineSnapshot.directionalOverlays.length,
      roomObjectCount: selectRenderableRoomObjects(baselineSnapshot).length,
      baselineTextStepCount,
      watermark: baseline.sessionDeltaWatermark || "(none)",
      particleHandoff: {
        hostPayload: summarizeHostParticleInstances(baseline),
        mappedSnapshot: summarizeParticleInstances(baselineSnapshot),
        cueProcessedSnapshot: summarizeParticleInstances(resolvedSnapshot)
      }
    });
  }, [
    emitAppearanceCueResolutionDiagnostics,
    emitMovementCueResolutionDiagnostics,
    emitRoomTransitionCueResolutionDiagnostics,
    hydrateSceneSnapshotAssets,
    waitForSessionGlobalAssets,
    options.activeSessionId,
    options.setRendererSceneSnapshot
  ]);
  const applySessionBaselineRef = useRef(applySessionBaseline);
  applySessionBaselineRef.current = applySessionBaseline;

  useEffect(() => {
    if (!options.credentialHandle || !options.activeSessionId) {
      setBaselineSyncReady(false);
      setBaselineWatermark("");
      setRendererSceneSnapshotRef.current(null);
      return;
    }

    let cancelled = false;
    setBaselineSyncReady(false);
    setBaselineWatermark("");
    setRendererSceneSnapshotRef.current(null);

    const hydrateFromBaseline = async (): Promise<void> => {
      try {
        const startupCatalog = await waitForSessionGlobalAssets();
        if (cancelled) return;
        const baseline = await options.hostApiClient.getSessionBaseline(options.credentialHandle, options.activeSessionId, "Low");
        if (cancelled) {
          return;
        }

        addDiagnosticRef.current("info", "session-render", "Received Host baseline particle payload before Portal scene mapping.", {
          sessionId: options.activeSessionId,
          baselineWatermark: baseline.sessionDeltaWatermark ?? "",
          hasRoomChange: Boolean(baseline.roomChange),
          hasNewRoom: Boolean(baseline.roomChange?.newRoom),
          hostParticleInstances: summarizeHostParticleInstances(baseline)
        });

        await applySessionBaselineRef.current(baseline, "startup", startupCatalog);
        setBaselineSyncReady(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setBaselineSyncReady(false);

        addDiagnosticRef.current("warn", "session-render", "Failed to hydrate renderer scene from session baseline.", {
          sessionId: options.activeSessionId,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    };

    void hydrateFromBaseline();

    return () => {
      cancelled = true;
    };
  }, [options.credentialHandle, options.activeSessionId, options.hostApiClient, waitForSessionGlobalAssets]);

  const handleSessionDataUpdate = useCallback((sessionData: HostSessionPresentationData): void => {
    setSessionDeltaRevision((revision) => revision + 1);
    const hasRoomUpdate = Boolean(sessionData.roomChange);
    const previousSnapshot = rendererSceneSnapshotRef.current;
    const previousRoomId = previousSnapshot?.roomId?.trim() ?? "";
    const reportedRoomId = sessionData.roomChange?.newRoom?.roomId?.trim()
      || sessionData.roomChange?.currentRoom?.roomId?.trim()
      || "";
    const isRoomTransition = Boolean(previousRoomId && reportedRoomId && reportedRoomId !== previousRoomId);
    if (isRoomTransition) {
      assertRoomTransitionPollingPause("accepted-room-change-delta");
      setRoomTransitionPreparationEpoch((value) => value + 1);
      deferredPhasePresentationRef.current.push(sessionData);
    } else {
      if (hasRoomUpdate) {
        addDiagnosticRef.current("info", "session-delta", "Applied room update without starting a room transition.", {
          roomUpdateKind: sessionData.roomChange?.currentRoom ? "currentRoom" : "newRoom",
          previousRoomId: previousRoomId || "(unknown)",
          reportedRoomId: reportedRoomId || "(unknown)",
          roomIdMatchesDisplayedRoom: Boolean(previousRoomId && reportedRoomId && previousRoomId === reportedRoomId)
        });
      }
      consumeSessionDeltaPhasePresentationRef.current(sessionData);
    }
    consumeSessionDeltaSoundCuesRef.current(sessionData);
    const nextSnapshot = mapHostSessionDataToSceneSnapshot(sessionData, previousSnapshot);
    if (isRoomTransition) {
      addDiagnosticRef.current("info", "session-delta", "Accepted room-change delta and mapped its destination scene.", {
        watermark: sessionData.sessionDeltaWatermark,
        previousRoomId: previousSnapshot?.roomId || "(unknown)",
        destinationRoomId: nextSnapshot?.roomId || "(unavailable)",
        roomChangeRoomId: sessionData.roomChange?.newRoom?.roomId || "(unspecified)",
        roomObjectChangeCount: sessionData.roomObjectChanges.length,
        hasDestinationScene: Boolean(nextSnapshot)
      });
    }
    const activeCueChanges = sessionData.roomObjectChanges.flatMap((change) => {
      if (change.changeKind === "Hidden" || change.changeKind === "Removed") {
        return [];
      }
      const rawActiveCues = change.renderableRoomObject?.activePresentationCues;
      if (rawActiveCues === undefined) {
        return [];
      }

      const mappedObject = nextSnapshot?.objectsById[change.objectId];
      return [{
        objectId: change.objectId,
        objectName: change.objectName,
        rawActiveCues,
        mappedActivePresentationCues: mappedObject?.activePresentationCues ?? [],
        footprintCenterXpx: change.renderableRoomObject?.spatialFootprint?.footprintCenterXpx,
        footprintCenterYpx: change.renderableRoomObject?.spatialFootprint?.footprintCenterYpx,
        mappedFootprintCenterXpx: mappedObject?.lighting?.spatialFootprint?.footprintCenterXpx,
        mappedFootprintCenterYpx: mappedObject?.lighting?.spatialFootprint?.footprintCenterYpx,
        mappedSpriteX: mappedObject?.sprite?.x,
        mappedSpriteY: mappedObject?.sprite?.y
      }];
    });
    if (activeCueChanges.length > 0) {
      addDiagnosticRef.current("info", "session-render", "Mapped authoritative active presentation cues from Host session delta into the renderer scene.", {
        watermark: sessionData.sessionDeltaWatermark,
        activeCueChanges
      });
    }
    if (nextSnapshot) {
      const resolvedSnapshot = applyPresentationCuesRef.current(nextSnapshot);
      emitMovementCueResolutionDiagnostics("delta", previousSnapshot, resolvedSnapshot, sessionData);
      emitAppearanceCueResolutionDiagnostics("delta", resolvedSnapshot, sessionData);
      emitRoomTransitionCueResolutionDiagnostics("delta", resolvedSnapshot, sessionData);
      emitTimingSyncDiagnostics(previousSnapshot, resolvedSnapshot, sessionData);
      void hydrateSceneSnapshotAssets(resolvedSnapshot, "delta").catch((error) => {
        addDiagnosticRef.current("warn", "session-render", "Failed to hydrate delta scene assets.", {
          roomId: resolvedSnapshot.roomId || "(unknown)",
          message: error instanceof Error ? error.message : String(error)
        });
        if (isRoomTransition) {
          releaseRoomTransitionPollingPause("room-change-hydration-failed");
        }
      });
    } else if (isRoomTransition) {
      releaseRoomTransitionPollingPause("room-change-without-renderable-scene");
    }
    consumeSessionDeltaEchoRef.current(sessionData);
  }, [
    emitAppearanceCueResolutionDiagnostics,
    assertRoomTransitionPollingPause,
    emitMovementCueResolutionDiagnostics,
    emitRoomTransitionCueResolutionDiagnostics,
    emitTimingSyncDiagnostics,
    hydrateSceneSnapshotAssets,
    releaseRoomTransitionPollingPause
  ]);

  useSessionDeltaPolling({
    hostApiClient: options.hostApiClient,
    credentialHandle: options.credentialHandle,
    sessionId: options.activeSessionId,
    initialWatermark: baselineWatermark,
    resetEpoch: options.sessionDeltaResetEpoch,
    settings: {
      pollIntervalMs: options.pollIntervalMs,
      heartbeatEveryNPolls: options.heartbeatEveryNPolls
    },
    enabled: baselineSyncReady,
    isPaused: () => pollingPausedForRoomTransitionRef.current,
    onSessionData: handleSessionDataUpdate,
    onGameplayChange: options.onGameplayChange,
    onResyncBaseline: async (baseline) => {
      await applySessionBaseline(baseline, "resync");
    },
    addDiagnostic: options.addDiagnostic
  });

  return {
    reportRoomTransitionState,
    roomTransitionPreparationEpoch,
    roomTransitionActive,
    sessionDeltaRevision,
    loadParticleEffectImage
  };
}
