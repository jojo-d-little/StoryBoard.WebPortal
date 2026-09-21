import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRenderSceneSnapshot, GameRendererRoomTransitionState } from "../gameRenderer";
import { mapHostPresentationToSceneSnapshot, mapHostSessionDataToSceneSnapshot } from "../gameRenderer/adapters";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { HostApiClient } from "../hostApi/client";
import type { HostCommandSoundCue, HostRuntimePresentationBaseline, HostSessionDataEnvelope } from "../hostApi/HostContracts";
import { useSessionDeltaPolling } from "./useSessionDeltaPolling";
import { buildAssetCacheKey, webPortalAssetCache } from "../cache/webPortalAssetCache";
import type { PresentationCueCatalogDocument } from "../gameRenderer/presentationCue/resolveMovementCueDuration";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;
const ROOM_TRANSITION_POLLING_PAUSE_WATCHDOG_MS = 30000;

export interface HostRendererSessionWorkflowResult {
  reportRoomTransitionState: (state: GameRendererRoomTransitionState) => void;
  roomTransitionPreparationEpoch: number;
  roomTransitionActive: boolean;
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
  applyMovementCueDurations: (scene: GameRenderSceneSnapshot) => GameRenderSceneSnapshot;
  getCurrentPresentationCueCatalog: () => PresentationCueCatalogDocument | null;
  presentationCueCatalogSource: "none" | "cache" | "network";
  getHudOverlayEntries: () => GameRenderSceneSnapshot["hudOverlayEntries"];
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
  sessionDeltaResetEpoch: number;
  consumeSessionDeltaPhasePresentation: (sessionData: HostSessionDataEnvelope) => void;
  consumeSessionDeltaEcho: (sessionData: HostSessionDataEnvelope) => void;
  consumeSessionDeltaSoundCues: (sessionData: HostSessionDataEnvelope) => void;
  refreshCacheStats: () => void;
  addDiagnostic: AddDiagnostic;
}

function extractContentTypeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1] ?? "application/octet-stream";
}

export function useHostRendererSessionWorkflow(options: UseHostRendererSessionWorkflowOptions): HostRendererSessionWorkflowResult {
  const [baselineSyncReady, setBaselineSyncReady] = useState<boolean>(false);
  const [baselineWatermark, setBaselineWatermark] = useState<string>("");
  const [roomTransitionPreparationEpoch, setRoomTransitionPreparationEpoch] = useState<number>(0);
  const [roomTransitionActive, setRoomTransitionActive] = useState<boolean>(false);
  const sceneHydrationGenerationRef = useRef<number>(0);
  const rendererSceneSnapshotRef = useRef<GameRenderSceneSnapshot | null>(options.rendererSceneSnapshot);
  const applyMovementCueDurationsRef = useRef(options.applyMovementCueDurations);
  const getCurrentPresentationCueCatalogRef = useRef(options.getCurrentPresentationCueCatalog);
  const presentationCueCatalogSourceRef = useRef(options.presentationCueCatalogSource);
  const getHudOverlayEntriesRef = useRef(options.getHudOverlayEntries);
  const consumeSessionDeltaPhasePresentationRef = useRef(options.consumeSessionDeltaPhasePresentation);
  const consumeSessionDeltaEchoRef = useRef(options.consumeSessionDeltaEcho);
  const consumeSessionDeltaSoundCuesRef = useRef(options.consumeSessionDeltaSoundCues);
  const addDiagnosticRef = useRef(options.addDiagnostic);
  const presentationCueCatalogRevisionRef = useRef<number>(options.presentationCueCatalogRevision);
  const pollingPausedForRoomTransitionRef = useRef<boolean>(false);
  const pollingPauseWatchdogRef = useRef<number | null>(null);
  const deferredPhasePresentationRef = useRef<HostSessionDataEnvelope[]>([]);

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
    applyMovementCueDurationsRef.current = options.applyMovementCueDurations;
  }, [options.applyMovementCueDurations]);

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

    const resolvedScene = applyMovementCueDurationsRef.current(currentScene);
    options.setRendererSceneSnapshot({
      ...resolvedScene,
      hudOverlayEntries: getHudOverlayEntriesRef.current()
    });

    addDiagnosticRef.current("info", "presentation-cues", "Re-applied scene cue styles after presentation catalog revision changed.", {
      previousRevision,
      nextRevision,
      roomId: resolvedScene.roomId || "(unknown)",
      roomObjectCount: resolvedScene.roomObjects.length
    });
  }, [options.presentationCueCatalogRevision, options.setRendererSceneSnapshot]);

  const emitMovementCueResolutionDiagnostics = useCallback((
    source: "baseline" | "delta",
    previousScene: GameRenderSceneSnapshot | null,
    resolvedScene: GameRenderSceneSnapshot,
    sessionData: HostSessionDataEnvelope | null
  ): void => {
    if (source !== "delta") {
      return;
    }

    const changedById = new Map((sessionData?.roomObjectChanges ?? []).map((change) => [change.objectId, change]));
    if (changedById.size === 0) {
      return;
    }

    const previousById = new Map((previousScene?.roomObjects ?? []).map((roomObject) => [roomObject.objectId, roomObject]));
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

    for (const roomObject of resolvedScene.roomObjects) {
      const change = changedById.get(roomObject.objectId);
      if (!change) {
        continue;
      }

      const previous = previousById.get(roomObject.objectId);
      const moved = previous
        ? previous.x !== roomObject.x || previous.y !== roomObject.y
        : change.changeKind !== "Removed";

      if (!moved) {
        continue;
      }

      const movementCueEffectKeys = summarizeMovementCueEffects(roomObject.presentationCues);
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
    sessionData: HostSessionDataEnvelope | null
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

    for (const roomObject of resolvedScene.roomObjects) {
      if (source === "delta" && changedObjectIds.size > 0 && !changedObjectIds.has(roomObject.objectId)) {
        continue;
      }

      for (const cue of roomObject.presentationCues) {
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
    sessionData: HostSessionDataEnvelope | null
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
    sessionData: HostSessionDataEnvelope
  ): void => {
    const changedById = new Map((sessionData.roomObjectChanges ?? []).map((change) => [change.objectId, change]));
    const previousById = new Map((previousScene?.roomObjects ?? []).map((roomObject) => [roomObject.objectId, roomObject]));

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

    for (const roomObject of resolvedScene.roomObjects) {
      if (!changedById.has(roomObject.objectId)) {
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
        movementCueEffectKeys: summarizeMovementCueEffects(roomObject.presentationCues)
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
    const uniqueAssetPaths = Array.from(new Set(
      [
        ...scene.directionalOverlays.map((overlay) => overlay.asset.assetPath.trim()),
        ...scene.roomObjects.map((roomObject) => roomObject.asset.assetPath.trim())
      ]
        .filter((path) => path.length > 0 && !path.startsWith("data:") && !path.startsWith("blob:"))
    ));

    if (uniqueAssetPaths.length === 0) {
      options.setRendererSceneSnapshot({
        ...scene,
        hudOverlayEntries: getHudOverlayEntriesRef.current()
      });
      return;
    }

    if (!options.credentialHandle) {
      options.setRendererSceneSnapshot({
        ...scene,
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
        ...scene,
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
        addDiagnosticRef.current("warn", "session-render", "Failed to resolve directional image asset for renderer.", {
          source,
          roomId: scene.roomId || "(unknown)",
          assetPath,
          cacheKey: assetCacheKey
        });
        continue;
      }

      resolvedByPath.set(assetPath, dataUrl);
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
    }

    if (generation !== sceneHydrationGenerationRef.current) {
      return;
    }

    const hydratedScene: GameRenderSceneSnapshot = {
      ...scene,
      directionalOverlays: scene.directionalOverlays.map((overlay) => {
        const resolved = resolvedByPath.get(overlay.asset.assetPath.trim());
        return {
          ...overlay,
          asset: {
            ...overlay.asset,
            assetPath: resolved || overlay.asset.assetPath
          }
        };
      }),
      roomObjects: scene.roomObjects.map((roomObject) => {
        const resolved = resolvedByPath.get(roomObject.asset.assetPath.trim());
        return {
          ...roomObject,
          asset: {
            ...roomObject.asset,
            assetPath: resolved || roomObject.asset.assetPath
          }
        };
      })
    };

    options.setRendererSceneSnapshot({
      ...hydratedScene,
      hudOverlayEntries: getHudOverlayEntriesRef.current()
    });

    if (missingAssetPaths.length > 0) {
      addDiagnosticRef.current("warn", "session-render", "One or more directional assets could not be resolved for rendering.", {
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
      roomObjectCount: hydratedScene.roomObjects.length
    });
  }, [
    options.credentialHandle,
    options.hostApiClient,
    options.refreshCacheStats,
    options.selectedGameId,
    options.selectedGameKey,
    options.setRendererSceneSnapshot
  ]);

  const applySessionBaseline = useCallback(async (
    baseline: HostRuntimePresentationBaseline,
    source: "startup" | "resync"
  ): Promise<void> => {
    const baselineWatermark = (baseline.sessionDeltaWatermark ?? "").trim();
    setBaselineWatermark(baselineWatermark);

    const baselineSnapshot = mapHostPresentationToSceneSnapshot(baseline);
    const baselineTextStepCount = baseline.orderedTextPresentationSteps?.length ?? 0;
    const baselineSessionData: HostSessionDataEnvelope = {
      sessionDeltaWatermark: baseline.sessionDeltaWatermark,
      roomObjectChanges: [],
      soundCues: baseline.soundCues,
      outputLines: [],
      diagnostics: [],
      roomChange: baseline.roomChange,
      phaseChange: baseline.phaseChange,
      orderedTextPresentationSteps: baseline.orderedTextPresentationSteps ?? [],
      authoredRenderWidth: baseline.authoredRenderWidth,
      authoredRenderHeight: baseline.authoredRenderHeight,
      hasRoomChange: Boolean(baseline.roomChange),
      hasPhaseChange: Boolean(baseline.phaseChange)
    };

    if (baseline.soundCues.length > 0) {
      consumeSessionDeltaSoundCuesRef.current(baselineSessionData);
    }

    if (baselineTextStepCount > 0) {
      consumeSessionDeltaPhasePresentationRef.current(baselineSessionData);
    }

    if (!baselineSnapshot) {
      addDiagnosticRef.current("warn", "session-render", "Session baseline did not include a room scene payload.", {
        source,
        sessionId: options.activeSessionId,
        watermark: baseline.sessionDeltaWatermark || "(none)"
      });
      return;
    }

    const resolvedSnapshot = applyMovementCueDurationsRef.current(baselineSnapshot);
    emitMovementCueResolutionDiagnostics("baseline", null, resolvedSnapshot, null);
    emitAppearanceCueResolutionDiagnostics("baseline", resolvedSnapshot, null);
    emitRoomTransitionCueResolutionDiagnostics("baseline", resolvedSnapshot, baselineSessionData);
    void hydrateSceneSnapshotAssets(resolvedSnapshot, "baseline");
    addDiagnosticRef.current("info", "session-render", "Hydrated renderer scene from session baseline.", {
      source,
      sessionId: options.activeSessionId,
      roomId: baselineSnapshot.roomId || "(unknown)",
      overlayCount: baselineSnapshot.directionalOverlays.length,
      roomObjectCount: baselineSnapshot.roomObjects.length,
      baselineTextStepCount,
      watermark: baseline.sessionDeltaWatermark || "(none)"
    });
  }, [
    emitAppearanceCueResolutionDiagnostics,
    emitMovementCueResolutionDiagnostics,
    emitRoomTransitionCueResolutionDiagnostics,
    hydrateSceneSnapshotAssets,
    options.activeSessionId
  ]);

  useEffect(() => {
    if (!options.credentialHandle || !options.activeSessionId) {
      setBaselineSyncReady(false);
      setBaselineWatermark("");
      return;
    }

    let cancelled = false;
    setBaselineSyncReady(false);
    setBaselineWatermark("");

    const hydrateFromBaseline = async (): Promise<void> => {
      try {
        const baseline = await options.hostApiClient.getSessionBaseline(options.credentialHandle, options.activeSessionId, "Low");
        if (cancelled) {
          return;
        }

        await applySessionBaseline(baseline, "startup");
        setBaselineSyncReady(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setBaselineSyncReady(true);

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
  }, [options.credentialHandle, options.activeSessionId, options.hostApiClient, applySessionBaseline]);

  const handleSessionDataUpdate = useCallback((sessionData: HostSessionDataEnvelope): void => {
    if (sessionData.hasRoomChange) {
      assertRoomTransitionPollingPause("accepted-room-change-delta");
      setRoomTransitionPreparationEpoch((value) => value + 1);
      deferredPhasePresentationRef.current.push(sessionData);
    } else {
      consumeSessionDeltaPhasePresentationRef.current(sessionData);
    }
    consumeSessionDeltaSoundCuesRef.current(sessionData);
    const previousSnapshot = rendererSceneSnapshotRef.current;
    const nextSnapshot = mapHostSessionDataToSceneSnapshot(sessionData, previousSnapshot);
    if (nextSnapshot) {
      const resolvedSnapshot = applyMovementCueDurationsRef.current(nextSnapshot);
      emitMovementCueResolutionDiagnostics("delta", previousSnapshot, resolvedSnapshot, sessionData);
      emitAppearanceCueResolutionDiagnostics("delta", resolvedSnapshot, sessionData);
      emitRoomTransitionCueResolutionDiagnostics("delta", resolvedSnapshot, sessionData);
      emitTimingSyncDiagnostics(previousSnapshot, resolvedSnapshot, sessionData);
      void hydrateSceneSnapshotAssets(resolvedSnapshot, "delta").catch((error) => {
        addDiagnosticRef.current("warn", "session-render", "Failed to hydrate delta scene assets.", {
          roomId: resolvedSnapshot.roomId || "(unknown)",
          message: error instanceof Error ? error.message : String(error)
        });
        if (sessionData.hasRoomChange) {
          releaseRoomTransitionPollingPause("room-change-hydration-failed");
        }
      });
    } else if (sessionData.hasRoomChange) {
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
    onResyncBaseline: async (baseline) => {
      await applySessionBaseline(baseline, "resync");
    },
    addDiagnostic: options.addDiagnostic
  });

  return {
    reportRoomTransitionState,
    roomTransitionPreparationEpoch,
    roomTransitionActive
  };
}
