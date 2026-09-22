import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrchestrationContracts } from "../orchestration/types";
import { HostApiClient } from "../hostApi/client";
import type { GameRenderSceneSnapshot } from "../gameRenderer";
import type { GameRendererRoomPoint } from "../gameRenderer";
import type { GameRenderTravelDirection } from "../gameRenderer/contracts/sceneTypes";
import type { GameRendererDiagnosticsEvent, GameRendererRoomTransitionState } from "../gameRenderer";
import type {
  HostDiscoveredGame,
  HostGameDetailsDescriptor,
  HostPendingClarificationRequest,
  HostProcessCommandResult,
  HostSessionDescriptor
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { useSessionEchoWorkflow } from "./useSessionEchoWorkflow";
import { useHostOperationWorkflow } from "./useHostOperationWorkflow";
import { useHostSessionWorkflow } from "./useHostSessionWorkflow";
import { useHostCommandWorkflow } from "./useHostCommandWorkflow";
import { useHostAuthDiscoveryWorkflow } from "./useHostAuthDiscoveryWorkflow";
import { useHostSignOutWorkflow } from "./useHostSignOutWorkflow";
import { useHostRendererSessionWorkflow } from "./useHostRendererSessionWorkflow";
import { useHostSoundCueWorkflow } from "./useHostSoundCueWorkflow";
import { useHostRendererReportingWorkflow } from "./useHostRendererReportingWorkflow";
import { useHostStateTransitionWorkflow } from "./useHostStateTransitionWorkflow";
import { useHostGameSelectionWorkflow } from "./useHostGameSelectionWorkflow";
import { useHostCacheWorkflow } from "./useHostCacheWorkflow";
import {
  useRoomTransitionCueWorkflow,
  type RoomTransitionCatalogStatus,
  type RoomTransitionCueOption
} from "./useRoomTransitionCueWorkflow";
import { usePresentationCueCatalogWorkflow } from "./usePresentationCueCatalogWorkflow";
import { resolveHostTextPresentationCue } from "../gameRenderer/presentationCue/resolveMovementCueDuration";
import {
  useSessionPhasePresentationWorkflow,
  type HudOverlayEntry
} from "./useSessionPhasePresentationWorkflow";
import {
  type WebPortalAssetCacheStats
} from "../cache/webPortalAssetCache";
import {
  resolveCatalogStyledPointEffect,
  type ResolvedStyledPointEffect
} from "../gameRenderer/presentationCue/resolveMovementCueDuration";
import type { PortalStartupAudioStatus } from "./usePortalStartupAudioGate";

export type HostOperationKey =
  | "none"
  | "auth"
  | "principal"
  | "discovery"
  | "sessionStart"
  | "sessionList"
  | "sessionJoin"
  | "sessionLeave"
  | "sessionReconnect"
  | "command";

export type HostOperationPhase = "Idle" | "Running" | "Failed";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostWorkflowOptions {
  baseUrlOverride: string;
  developmentBootstrap: {
    username: string;
  } | null;
  startupAudioStatus: PortalStartupAudioStatus;
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
  echoOutputRetentionLines: number;
  audioDefaults: {
    requireUserGestureToUnlock: boolean;
    lanes: {
      sfx: {
        muted: boolean;
        volumePercent: number;
      };
      ambient: {
        muted: boolean;
        volumePercent: number;
      };
    };
  };
  roomTransitionDefaults: {
    enabled: boolean;
    cueCategory: string;
    cueEffectKey: string;
    cueEffectKeyOverridesByTravelDirection: Partial<Record<GameRenderTravelDirection, string>>;
    respectTravelDirection: boolean;
    fallbackDurationMs: number;
  };
  waypointDefaults: {
    pointPlacementCueEffectKey: string;
  };
  uiCommandVerbs: {
    waypointSubmit: string;
    pointClicked: string;
  };
  presentationCueCatalogRelativeLocator: string;
  contracts: OrchestrationContracts | null;
  state: string;
  states: string[];
  onStateChange: (nextState: string) => void;
  addDiagnostic: AddDiagnostic;
}

export interface RendererScaleMetrics {
  roomWidth: number;
  roomHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

export interface RendererLastClickPoint {
  clientX: number;
  clientY: number;
  viewportX: number;
  viewportY: number;
  roomX: number;
  roomY: number;
  insideRoom: boolean;
}

export type GameplayInteractionSubstate = "DefaultClick" | "WaypointMoveSetup";

export type WaypointActionKind =
  | "enter-waypoint-mode"
  | "cancel-waypoint-mode"
  | "clear-waypoint-draft"
  | "undo-waypoint-point"
  | "append-waypoint-point"
  | "submit-waypoint-draft";

interface WaypointInteractionRendererBridge {
  setInteractionMode: (mode: "CommandClick" | "WaypointMoveSetup") => void;
  appendWaypointDraft: (point: GameRendererRoomPoint) => number;
  getWaypointsSnapshot: () => readonly GameRendererRoomPoint[];
  clearWaypoints: () => void;
  removeLastWaypoint: () => boolean;
}

export function buildWaypointSubmitCommandText(
  commandVerb: string,
  points: readonly GameRendererRoomPoint[]
): string {
  const normalizedVerb = commandVerb.trim();
  if (points.length === 0) {
    return normalizedVerb;
  }

  const pointTokens = points
    .map((point) => {
      const normalizedX = Math.max(0, Math.round(point.x));
      const normalizedY = Math.max(0, Math.round(point.y));
      return `(${normalizedX},${normalizedY})`;
    })
    .join(" ");

  return `${normalizedVerb} ${pointTokens}`;
}

export function shouldClearWaypointDraftAfterSubmit(result: HostProcessCommandResult | null): boolean {
  return result?.resultCode === "Success";
}

export interface HostWorkflowState {
  developmentBootstrapActive: boolean;
  authUsername: string;
  setAuthUsername: (value: string) => void;
  authPassword: string;
  setAuthPassword: (value: string) => void;
  credentialHandle: string;
  principalName: string;
  discoverGames: HostDiscoveredGame[];
  selectedGameId: string;
  selectedGameKey: string;
  setSelectedGame: (gameId: string, gameKey: string) => void;
  requestedSessionName: string;
  setRequestedSessionName: (value: string) => void;
  requestedJoinPolicy: string;
  setRequestedJoinPolicy: (value: string) => void;
  sessions: HostSessionDescriptor[];
  selectedSessionId: string;
  setSelectedSessionId: (sessionId: string) => void;
  activeSessionId: string;
  activeSessionIsOwner: boolean;
  hostStatus: string;
  hostBusy: boolean;
  hostOperationKey: HostOperationKey;
  hostOperationPhase: HostOperationPhase;
  rendererSceneSnapshot: GameRenderSceneSnapshot | null;
  rendererScaleMetrics: RendererScaleMetrics | null;
  rendererLastClickPoint: RendererLastClickPoint | null;
  lastPlaySurfaceDispatch: string;
  hudOverlayEntries: HudOverlayEntry[];
  dismissHudOverlay: () => void;
  reportRendererScaleMetrics: (metrics: RendererScaleMetrics | null) => void;
  reportRendererLastClickPoint: (clickPoint: RendererLastClickPoint | null) => void;
  reportRendererDiagnostic: (event: GameRendererDiagnosticsEvent) => void;
  reportRendererRoomTransitionState: (state: GameRendererRoomTransitionState) => void;
  roomTransitionPreparationEpoch: number;
  sessionOutputLines: string[];
  pendingCommandClarification: HostPendingClarificationRequest | null;
  lastCommandResult: HostProcessCommandResult | null;
  submitCommand: (rawCommandText: string, options?: { suppressClientEcho?: boolean }) => Promise<HostProcessCommandResult | null>;
  buildPointClickedCommand: (roomX: number, roomY: number) => string;
  reportPlaySurfaceCommandDispatch: (commandText: string, details?: {
    roomX?: number;
    roomY?: number;
    insideRoom?: boolean;
  }) => void;
  submitClarificationAnswer: (selectedObjectScopeNodeId: string) => Promise<void>;
  clearSessionOutputLines: () => void;
  signOut: () => void;
  signInToHost: () => Promise<void>;
  fetchCurrentPrincipal: () => Promise<void>;
  fetchDiscoveredGames: () => Promise<void>;
  fetchGameDetails: (gameId: string, gameKey: string) => Promise<HostGameDetailsDescriptor | null>;
  fetchGamePreviewImageDataUrl: (relativeLocator: string, gameId: string, gameKey: string) => Promise<string | null>;
  startSessionFromSelectedGame: () => Promise<void>;
  startSessionForGame: (gameId: string, gameKey: string) => Promise<void>;
  listHostSessions: () => Promise<void>;
  joinSelectedSession: () => Promise<void>;
  joinSessionById: (sessionId: string) => Promise<void>;
  leaveActiveSession: () => Promise<void>;
  quitActiveSession: () => Promise<void>;
  reconnectActiveSession: () => Promise<void>;
  returnToLobby: () => void;
  triggerStateEvent: (eventName: string) => void;
  cacheStats: WebPortalAssetCacheStats;
  resetCacheStats: () => void;
  clearMemoryCache: () => void;
  clearPersistentCache: () => Promise<void>;
  audioUnlockRequired: boolean;
  setAudioUnlockRequired: (value: boolean) => void;
  requestAudioUnlock: () => void;
  soundCueStatus: {
    isAudioUnlocked: boolean;
    pendingUnlockCueCount: number;
    autoplayBlockedCount: number;
  };
  sfxMuted: boolean;
  setSfxMuted: (value: boolean) => void;
  sfxVolumePercent: number;
  setSfxVolumePercent: (value: number) => void;
  ambientMuted: boolean;
  setAmbientMuted: (value: boolean) => void;
  ambientVolumePercent: number;
  setAmbientVolumePercent: (value: number) => void;
  roomTransitionCueOptions: RoomTransitionCueOption[];
  selectedRoomTransitionCueEffectKey: string;
  setSelectedRoomTransitionCueEffectKey: (effectKey: string) => void;
  roomTransitionCatalogStatus: RoomTransitionCatalogStatus;
  waypointPointPlacementCueEffectKey: string;
  waypointPointPlacementCueStyle: ResolvedStyledPointEffect | null;
  gameplayInteractionSubstate: GameplayInteractionSubstate;
  waypointDraftCount: number;
  enterWaypointMoveSetup: () => void;
  cancelWaypointMoveSetup: () => void;
  clearWaypointDraft: () => void;
  undoLastWaypointDraftPoint: () => void;
  submitWaypointDraft: () => Promise<void>;
  registerWaypointInteractionRendererBridge: (bridge: WaypointInteractionRendererBridge | null) => void;
  appendWaypointDraftPoint: (point: GameRendererRoomPoint) => void;
}

const DEFAULT_ECHO_OUTPUT_RETENTION_LINES = 400;
const MIN_ECHO_OUTPUT_RETENTION_LINES = 50;
const MAX_ECHO_OUTPUT_RETENTION_LINES = 5000;
const WAYPOINT_WARNING_THROTTLE_MS = 5000;

export function isKnownGameplayInteractionSubstate(value: string): value is GameplayInteractionSubstate {
  return value === "DefaultClick" || value === "WaypointMoveSetup";
}

export function shouldEmitThrottledWarning(
  lastEmittedAtMs: number | undefined,
  nowMs: number,
  throttleWindowMs: number = WAYPOINT_WARNING_THROTTLE_MS
): boolean {
  if (lastEmittedAtMs === undefined) {
    return true;
  }

  return nowMs - lastEmittedAtMs >= throttleWindowMs;
}

export function resolveIllegalWaypointActionReason(
  action: WaypointActionKind,
  context: {
    activeSessionId: string;
    hasRendererBridge: boolean;
    substate: string;
  }
): string | null {
  if (!context.activeSessionId) {
    return "No active session.";
  }

  if (!context.hasRendererBridge) {
    return "Renderer bridge is unavailable.";
  }

  if (!isKnownGameplayInteractionSubstate(context.substate)) {
    return `Unknown gameplay substate '${context.substate}'.`;
  }

  const inWaypointMode = context.substate === "WaypointMoveSetup";
  if (action === "enter-waypoint-mode") {
    return null;
  }

  if (!inWaypointMode) {
    return "Current substate is not WaypointMoveSetup.";
  }

  return null;
}

function normalizeEchoOutputRetentionLines(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ECHO_OUTPUT_RETENTION_LINES;
  }

  const rounded = Math.round(value);
  return Math.max(
    MIN_ECHO_OUTPUT_RETENTION_LINES,
    Math.min(MAX_ECHO_OUTPUT_RETENTION_LINES, rounded)
  );
}

function formatDiagnostics(messages: string[]): string {
  const flattened = messages.map((x) => x.trim()).filter((x) => x.length > 0);
  if (flattened.length === 0) {
    return "";
  }

  return ` (${flattened.join(" | ")})`;
}

export function useHostWorkflow(options: UseHostWorkflowOptions): HostWorkflowState {
  const echoOutputRetentionLines = normalizeEchoOutputRetentionLines(options.echoOutputRetentionLines);
  const [authUsername, setAuthUsername] = useState<string>(() => options.developmentBootstrap?.username || "admin");
  const [authPassword, setAuthPassword] = useState<string>(() => options.developmentBootstrap ? "" : "admin");
  const [credentialHandle, setCredentialHandle] = useState<string>("");
  const [principalName, setPrincipalName] = useState<string>("");
  const [discoverGames, setDiscoverGames] = useState<HostDiscoveredGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [selectedGameKey, setSelectedGameKey] = useState<string>("");
  const [requestedSessionName, setRequestedSessionName] = useState<string>("WebPortal Session");
  const [requestedJoinPolicy, setRequestedJoinPolicy] = useState<string>("ownerOnly");
  const [sessions, setSessions] = useState<HostSessionDescriptor[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [activeSessionIsOwner, setActiveSessionIsOwner] = useState<boolean>(false);
  const [rendererSceneSnapshot, setRendererSceneSnapshot] = useState<GameRenderSceneSnapshot | null>(null);
  const [rendererScaleMetrics, setRendererScaleMetrics] = useState<RendererScaleMetrics | null>(null);
  const [rendererLastClickPoint, setRendererLastClickPoint] = useState<RendererLastClickPoint | null>(null);
  const [lastPlaySurfaceDispatch, setLastPlaySurfaceDispatch] = useState<string>("(none)");
  const [audioUnlockRequired, setAudioUnlockRequired] = useState<boolean>(
    options.audioDefaults.requireUserGestureToUnlock
      && options.startupAudioStatus !== "enabled"
      && options.startupAudioStatus !== "muted"
  );
  const [sfxMuted, setSfxMuted] = useState<boolean>(options.audioDefaults.lanes.sfx.muted);
  const [sfxVolumePercent, setSfxVolumePercent] = useState<number>(options.audioDefaults.lanes.sfx.volumePercent);
  const [ambientMuted, setAmbientMuted] = useState<boolean>(options.audioDefaults.lanes.ambient.muted);
  const [ambientVolumePercent, setAmbientVolumePercent] = useState<number>(options.audioDefaults.lanes.ambient.volumePercent);
  const [gameplayInteractionSubstate, setGameplayInteractionSubstate] = useState<GameplayInteractionSubstate>("DefaultClick");
  const [waypointDraftCount, setWaypointDraftCount] = useState<number>(0);
  const [waypointRendererBridge, setWaypointRendererBridge] = useState<WaypointInteractionRendererBridge | null>(null);
  const waypointWarningLastEmittedByCodeRef = useRef<Map<string, number>>(new Map());
  const developmentBootstrapSignInStartedRef = useRef<boolean>(false);
  const developmentBootstrapDiscoveryStartedRef = useRef<boolean>(false);
  const developmentBootstrapSessionStartedRef = useRef<boolean>(false);

  const {
    cacheStats,
    refreshCacheStats,
    resetCacheStats,
    clearMemoryCache,
    clearPersistentCache
  } = useHostCacheWorkflow({
    addDiagnostic: options.addDiagnostic
  });

  const hostApiClient = useMemo(() => {
    return new HostApiClient({
      baseUrl: options.baseUrlOverride || undefined
    });
  }, [options.baseUrlOverride]);

  const {
    presentationCueCatalogRevision,
    presentationCueCatalogSource,
    presentationCueCatalogError,
    getCurrentPresentationCueCatalog,
    clearPresentationCueCatalog
  } = usePresentationCueCatalogWorkflow({
    credentialHandle,
    hostApiClient,
    selectedGameId,
    selectedGameKey,
    presentationCueCatalogRelativeLocator: options.presentationCueCatalogRelativeLocator,
    addDiagnostic: options.addDiagnostic,
    onCacheStatsChanged: refreshCacheStats
  });

  const waypointPointPlacementCueEffectKey = options.waypointDefaults.pointPlacementCueEffectKey.trim();
  const waypointSubmitCommandVerb = options.uiCommandVerbs.waypointSubmit.trim();
  const pointClickedCommandVerb = options.uiCommandVerbs.pointClicked.trim();
  const waypointPointPlacementCueStyle = useMemo(() => {
    if (!waypointPointPlacementCueEffectKey) {
      return null;
    }

    return resolveCatalogStyledPointEffect(
      getCurrentPresentationCueCatalog(),
      waypointPointPlacementCueEffectKey
    );
  }, [getCurrentPresentationCueCatalog, waypointPointPlacementCueEffectKey, presentationCueCatalogRevision]);

  const {
    roomTransitionCueOptions,
    selectedRoomTransitionCueEffectKey,
    setSelectedRoomTransitionCueEffectKey,
    roomTransitionCatalogStatus,
    applyMovementCueDurations
  } = useRoomTransitionCueWorkflow({
    roomTransitionDefaults: options.roomTransitionDefaults,
    presentationCueCatalogRelativeLocator: options.presentationCueCatalogRelativeLocator,
    selectedGameId,
    selectedGameKey,
    presentationCueCatalogRevision,
    presentationCueCatalogSource,
    presentationCueCatalogError,
    rendererSceneSnapshot,
    getCurrentPresentationCueCatalog
  });

  const {
    sessionOutputLines,
    sessionDeltaResetEpoch,
    clearSessionOutputLines,
    appendSessionOutputLines,
    appendClientCommandEcho,
    consumeSessionDeltaEcho,
    resetEchoForSessionAttach: resetSessionEchoForAttach
  } = useSessionEchoWorkflow({
    activeSessionId,
    echoOutputRetentionLines,
    addDiagnostic: options.addDiagnostic
  });

  const {
    hudOverlayEntries,
    consumeSessionDeltaPhasePresentation,
    dismissHudOverlay,
    resetPhasePresentationForSessionAttach,
    clearPhasePresentationState
  } = useSessionPhasePresentationWorkflow({
    activeSessionId,
    addDiagnostic: options.addDiagnostic,
    appendSessionOutputLines,
    resolveTextPresentationCue: (step) => {
      const catalog = getCurrentPresentationCueCatalog();
      return resolveHostTextPresentationCue(step, catalog);
    }
  });

  const {
    hostStatus,
    setHostStatus,
    hostBusy,
    hostOperationKey,
    hostOperationPhase,
    beginHostOperation,
    completeHostOperation,
    failHostOperation,
    resetHostOperationState
  } = useHostOperationWorkflow({
    addDiagnostic: options.addDiagnostic
  });

  const {
    pendingCommandClarification,
    lastCommandResult,
    submitCommand,
    submitClarificationAnswer,
    clearPendingCommandState,
    resetCommandWorkflowState
  } = useHostCommandWorkflow({
    credentialHandle,
    activeSessionId,
    hostApiClient,
    beginHostOperation,
    completeHostOperation,
    failHostOperation,
    setHostStatus,
    appendClientCommandEcho,
    addDiagnostic: options.addDiagnostic
  });

  const {
    reportRendererDiagnostic,
    reportRendererScaleMetrics,
    reportRendererLastClickPoint
  } = useHostRendererReportingWorkflow({
    addDiagnostic: options.addDiagnostic,
    setRendererScaleMetrics,
    setRendererLastClickPoint
  });

  const {
    consumeSessionDeltaSoundCues,
    requestAudioUnlock,
    soundCueStatus
  } = useHostSoundCueWorkflow({
    hostApiClient,
    credentialHandle,
    activeSessionId,
    selectedGameId,
    selectedGameKey,
    audioUnlockRequired,
    audioLanes: {
      sfx: {
        muted: sfxMuted || options.startupAudioStatus === "muted",
        volumePercent: sfxVolumePercent
      },
      ambient: {
        muted: ambientMuted || options.startupAudioStatus === "muted",
        volumePercent: ambientVolumePercent
      }
    },
    addDiagnostic: options.addDiagnostic
  });

  useEffect(() => {
    if (options.startupAudioStatus === "enabled" || options.startupAudioStatus === "muted") {
      setAudioUnlockRequired(false);
    }
  }, [options.startupAudioStatus]);

  const {
    reportRoomTransitionState: reportRendererRoomTransitionState,
    roomTransitionPreparationEpoch,
    roomTransitionActive
  } = useHostRendererSessionWorkflow({
    hostApiClient,
    credentialHandle,
    activeSessionId,
    selectedGameId,
    selectedGameKey,
    presentationCueCatalogRevision,
    rendererSceneSnapshot,
    setRendererSceneSnapshot,
    applyMovementCueDurations,
    getCurrentPresentationCueCatalog,
    presentationCueCatalogSource,
    getHudOverlayEntries: () => hudOverlayEntries.map((entry) => ({
      id: entry.id,
      text: entry.text,
      titleText: entry.titleText,
      bodyText: entry.bodyText,
      cueEffectKey: entry.cueEffectKey,
      isManualDismiss: entry.isManualDismiss,
      scrollMode: entry.scrollMode,
      scrollSpeedPxPerSec: entry.scrollSpeedPxPerSec,
      layoutMode: entry.layoutMode,
      backdropMode: entry.backdropMode,
      backdropOpacity: entry.backdropOpacity,
      panelOpacity: entry.panelOpacity,
      panelBorderThicknessPx: entry.panelBorderThicknessPx,
      titleFontSizePx: entry.titleFontSizePx,
      bodyFontSizePx: entry.bodyFontSizePx,
      transitionStyle: entry.transitionStyle,
      motionInMs: entry.motionInMs,
      motionOutMs: entry.motionOutMs
    })),
    pollIntervalMs: options.pollIntervalMs,
    heartbeatEveryNPolls: options.heartbeatEveryNPolls,
    sessionDeltaResetEpoch,
    consumeSessionDeltaPhasePresentation,
    consumeSessionDeltaEcho,
    consumeSessionDeltaSoundCues,
    refreshCacheStats,
    addDiagnostic: options.addDiagnostic
  });

  const submitCommandWhenRendererReady = useCallback(async (
    rawCommandText: string,
    submitOptions?: { suppressClientEcho?: boolean }
  ): Promise<HostProcessCommandResult | null> => {
    if (roomTransitionActive) {
      options.addDiagnostic("warn", "command", "Command submission was blocked by an active room transition.", {
        commandText: rawCommandText,
        activeSessionId: activeSessionId || "(none)"
      });
      return null;
    }

    return submitCommand(rawCommandText, submitOptions);
  }, [activeSessionId, options, roomTransitionActive, submitCommand]);

  const {
    tryTransitionByEvents,
    triggerStateEvent
  } = useHostStateTransitionWorkflow({
    contracts: options.contracts,
    state: options.state,
    states: options.states,
    onStateChange: options.onStateChange,
    addDiagnostic: options.addDiagnostic
  });

  const {
    resetSessionSelections,
    startSessionFromSelectedGame,
    startSessionForGame,
    listHostSessions,
    joinSelectedSession,
    joinSessionById,
    leaveActiveSession,
    quitActiveSession,
    reconnectActiveSession,
    returnToLobby
  } = useHostSessionWorkflow({
    startupAudioReady: options.startupAudioStatus === "enabled" || options.startupAudioStatus === "muted",
    credentialHandle,
    selectedGameId,
    selectedGameKey,
    requestedSessionName,
    requestedJoinPolicy,
    selectedSessionId,
    activeSessionId,
    activeSessionIsOwner,
    hostApiClient,
    setSessions,
    setSelectedSessionId,
    setActiveSessionId,
    setActiveSessionIsOwner,
    setSelectedGameId,
    setSelectedGameKey,
    setRendererLastClickPoint: (value) => setRendererLastClickPoint(value),
    setRendererSceneSnapshot: (value) => setRendererSceneSnapshot(value),
    setRendererScaleMetrics: (value) => setRendererScaleMetrics(value),
    clearPendingCommandState,
    resetSessionEchoForAttach,
    resetSessionPhasePresentationForAttach: resetPhasePresentationForSessionAttach,
    tryTransitionByEvents,
    beginHostOperation,
    completeHostOperation,
    failHostOperation,
    setHostStatus,
    addDiagnostic: options.addDiagnostic,
    formatDiagnostics
  });

  const {
    signInToHost,
    fetchCurrentPrincipal,
    fetchDiscoveredGames,
    fetchGameDetails,
    fetchGamePreviewImageDataUrl
  } = useHostAuthDiscoveryWorkflow({
    credentialHandle,
    authUsername,
    authPassword,
    principalName,
    hostApiClient,
    setCredentialHandle,
    setPrincipalName,
    setDiscoverGames,
    setSelectedGameId,
    setSelectedGameKey,
    resetSessionSelections,
    tryTransitionByEvents,
    beginHostOperation,
    completeHostOperation,
    failHostOperation,
    setHostStatus,
    addDiagnostic: options.addDiagnostic,
    formatDiagnostics
  });

  const { signOut } = useHostSignOutWorkflow({
    clearPresentationCueCatalog,
    refreshCacheStats,
    setCredentialHandle,
    setPrincipalName,
    setDiscoverGames,
    setSelectedGameId,
    setSelectedGameKey,
    setRequestedSessionName,
    setRequestedJoinPolicy,
    resetSessionSelections,
    clearPendingCommandState,
    clearSessionOutputLines,
    clearPhasePresentationState,
    setRendererSceneSnapshot,
    setRendererScaleMetrics,
    setRendererLastClickPoint,
    resetCommandWorkflowState,
    resetHostOperationState,
    setHostStatus,
    setSelectedRoomTransitionCueEffectKey,
    tryTransitionByEvents,
    addDiagnostic: options.addDiagnostic
  });

  const { setSelectedGame } = useHostGameSelectionWorkflow({
    selectedGameId,
    selectedGameKey,
    clearPresentationCueCatalog,
    refreshCacheStats,
    setSelectedRoomTransitionCueEffectKey,
    setSelectedGameId,
    setSelectedGameKey
  });

  useEffect(() => {
    if (!options.developmentBootstrap || !options.contracts || credentialHandle || developmentBootstrapSignInStartedRef.current) {
      return;
    }

    developmentBootstrapSignInStartedRef.current = true;
    options.addDiagnostic("info", "auth", "Starting development Portal bootstrap sign-in.", {
      mode: "devsimulator",
      username: authUsername
    });
    void signInToHost();
  }, [authUsername, credentialHandle, options.addDiagnostic, options.contracts, options.developmentBootstrap, signInToHost]);

  useEffect(() => {
    if (!options.developmentBootstrap || !credentialHandle || developmentBootstrapDiscoveryStartedRef.current) {
      return;
    }

    developmentBootstrapDiscoveryStartedRef.current = true;
    options.addDiagnostic("info", "discovery", "Starting development Portal bootstrap discovery.", {
      mode: "devsimulator"
    });
    void fetchDiscoveredGames();
  }, [credentialHandle, fetchDiscoveredGames, options.addDiagnostic, options.developmentBootstrap]);

  useEffect(() => {
    if (!options.developmentBootstrap || !credentialHandle || !options.startupAudioStatus || options.startupAudioStatus === "checking" || options.startupAudioStatus === "needs-user-action" || options.startupAudioStatus === "denied" || activeSessionId || developmentBootstrapSessionStartedRef.current) {
      return;
    }

    if (hostOperationKey !== "discovery" || hostOperationPhase !== "Idle") {
      return;
    }

    if (discoverGames.length === 0) {
      developmentBootstrapSessionStartedRef.current = true;
      setHostStatus("Development bootstrap found no enabled games.");
      options.addDiagnostic("error", "discovery", "Development bootstrap could not select a game because discovery returned no enabled games.", {
        mode: "devsimulator",
        count: 0
      });
      return;
    }

    if (discoverGames.length !== 1) {
      developmentBootstrapSessionStartedRef.current = true;
      setHostStatus("Development bootstrap requires exactly one enabled game.");
      options.addDiagnostic("error", "discovery", "Development bootstrap stopped because discovery returned more than one enabled game.", {
        mode: "devsimulator",
        count: discoverGames.length
      });
      return;
    }

    const game = discoverGames[0];
    developmentBootstrapSessionStartedRef.current = true;
    options.addDiagnostic("info", "session", "Development bootstrap starting the discovered game session.", {
      mode: "devsimulator",
      gameId: game.gameId,
      gameKey: game.gameKey
    });
    void startSessionForGame(game.gameId, game.gameKey);
  }, [activeSessionId, credentialHandle, discoverGames, hostOperationKey, hostOperationPhase, options.addDiagnostic, options.developmentBootstrap, options.startupAudioStatus, setHostStatus, startSessionForGame]);

  useEffect(() => {
    setRendererSceneSnapshot((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        hudOverlayEntries: hudOverlayEntries.map((entry) => ({
          id: entry.id,
          text: entry.text,
          titleText: entry.titleText,
          bodyText: entry.bodyText,
          cueEffectKey: entry.cueEffectKey,
          isManualDismiss: entry.isManualDismiss,
          scrollMode: entry.scrollMode,
          scrollSpeedPxPerSec: entry.scrollSpeedPxPerSec,
          layoutMode: entry.layoutMode,
          backdropMode: entry.backdropMode,
          backdropOpacity: entry.backdropOpacity,
          panelOpacity: entry.panelOpacity,
          panelBorderThicknessPx: entry.panelBorderThicknessPx,
          titleFontSizePx: entry.titleFontSizePx,
          bodyFontSizePx: entry.bodyFontSizePx,
          transitionStyle: entry.transitionStyle,
          motionInMs: entry.motionInMs,
          motionOutMs: entry.motionOutMs
        }))
      };
    });
  }, [hudOverlayEntries]);

  const reportPlaySurfaceCommandDispatch = useCallback((commandText: string, details?: {
    roomX?: number;
    roomY?: number;
    insideRoom?: boolean;
  }): void => {
    const roomX = Number.isFinite(details?.roomX) ? Number(details?.roomX).toFixed(1) : "?";
    const roomY = Number.isFinite(details?.roomY) ? Number(details?.roomY).toFixed(1) : "?";
    const zone = details?.insideRoom === false ? "outside" : "inside";
    setLastPlaySurfaceDispatch(`${commandText} @ (${roomX},${roomY}) ${zone}`);
    setHostStatus(`Dispatching playfield command: ${commandText}`);
    options.addDiagnostic("info", "command", "Play surface command dispatch requested.", {
      commandText,
      roomX: details?.roomX,
      roomY: details?.roomY,
      insideRoom: details?.insideRoom,
      activeSessionId: activeSessionId || "(none)",
      hostBusy,
      hostOperationKey,
      hostOperationPhase
    });
  }, [activeSessionId, hostBusy, hostOperationKey, hostOperationPhase, options, setHostStatus]);

  const registerWaypointInteractionRendererBridge = useCallback((bridge: WaypointInteractionRendererBridge | null): void => {
    setWaypointRendererBridge(bridge);
    if (!bridge) {
      setWaypointDraftCount(0);
      return;
    }

    setWaypointDraftCount(bridge.getWaypointsSnapshot().length);
  }, []);

  const emitWaypointTransitionWarning = useCallback((
    warningCode: string,
    action: WaypointActionKind,
    reason: string
  ): void => {
    const nowMs = Date.now();
    const lastEmittedAtMs = waypointWarningLastEmittedByCodeRef.current.get(warningCode);
    if (!shouldEmitThrottledWarning(lastEmittedAtMs, nowMs)) {
      return;
    }

    waypointWarningLastEmittedByCodeRef.current.set(warningCode, nowMs);
    options.addDiagnostic("warn", "interaction", "Ignored illegal waypoint interaction action.", {
      warningCode,
      action,
      reason,
      activeSessionId: activeSessionId || "(none)",
      hasRendererBridge: waypointRendererBridge !== null,
      substate: gameplayInteractionSubstate
    });
  }, [activeSessionId, gameplayInteractionSubstate, options, waypointRendererBridge]);

  const validateWaypointAction = useCallback((action: WaypointActionKind): boolean => {
    const reason = resolveIllegalWaypointActionReason(action, {
      activeSessionId,
      hasRendererBridge: waypointRendererBridge !== null,
      substate: gameplayInteractionSubstate
    });

    if (!reason) {
      return true;
    }

    emitWaypointTransitionWarning(
      `waypoint-action:${action}:${reason}`,
      action,
      reason
    );
    return false;
  }, [activeSessionId, emitWaypointTransitionWarning, gameplayInteractionSubstate, waypointRendererBridge]);

  const enterWaypointMoveSetup = useCallback((): void => {
    if (!validateWaypointAction("enter-waypoint-mode")) {
      return;
    }

    setGameplayInteractionSubstate("WaypointMoveSetup");
    waypointRendererBridge?.setInteractionMode("WaypointMoveSetup");
    setWaypointDraftCount(waypointRendererBridge?.getWaypointsSnapshot().length ?? 0);
  }, [validateWaypointAction, waypointRendererBridge]);

  const cancelWaypointMoveSetup = useCallback((): void => {
    if (!validateWaypointAction("cancel-waypoint-mode")) {
      return;
    }

    waypointRendererBridge?.clearWaypoints();
    waypointRendererBridge?.setInteractionMode("CommandClick");
    setWaypointDraftCount(0);
    setGameplayInteractionSubstate("DefaultClick");
  }, [validateWaypointAction, waypointRendererBridge]);

  const clearWaypointDraft = useCallback((): void => {
    if (!validateWaypointAction("clear-waypoint-draft")) {
      return;
    }

    waypointRendererBridge?.clearWaypoints();
    setWaypointDraftCount(waypointRendererBridge?.getWaypointsSnapshot().length ?? 0);
  }, [validateWaypointAction, waypointRendererBridge]);

  const undoLastWaypointDraftPoint = useCallback((): void => {
    if (!validateWaypointAction("undo-waypoint-point")) {
      return;
    }

    waypointRendererBridge?.removeLastWaypoint();
    setWaypointDraftCount(waypointRendererBridge?.getWaypointsSnapshot().length ?? 0);
  }, [validateWaypointAction, waypointRendererBridge]);

  const appendWaypointDraftPoint = useCallback((point: GameRendererRoomPoint): void => {
    if (!validateWaypointAction("append-waypoint-point")) {
      return;
    }

    const nextCount = waypointRendererBridge?.appendWaypointDraft(point);
    if (typeof nextCount === "number") {
      setWaypointDraftCount(nextCount);
    }
  }, [validateWaypointAction, waypointRendererBridge]);

  const buildSubmitWaypointCommand = useCallback((): string => {
    const points = waypointRendererBridge?.getWaypointsSnapshot() ?? [];
    return buildWaypointSubmitCommandText(waypointSubmitCommandVerb, points);
  }, [waypointRendererBridge, waypointSubmitCommandVerb]);

  const submitWaypointDraft = useCallback(async (): Promise<void> => {
    if (!validateWaypointAction("submit-waypoint-draft")) {
      return;
    }

    const waypointCount = waypointRendererBridge?.getWaypointsSnapshot().length ?? 0;
    if (waypointCount <= 0) {
      return;
    }

    const outboundCommandText = buildSubmitWaypointCommand();
    options.addDiagnostic("info", "command", "Submitting waypoint draft command from tools UI.", {
      commandText: outboundCommandText,
      waypointCount,
      activeSessionId: activeSessionId || "(none)"
    });

    const result = await submitCommandWhenRendererReady(outboundCommandText, { suppressClientEcho: true });
    if (!shouldClearWaypointDraftAfterSubmit(result)) {
      return;
    }

    waypointRendererBridge?.clearWaypoints();
    setWaypointDraftCount(waypointRendererBridge?.getWaypointsSnapshot().length ?? 0);
  }, [activeSessionId, buildSubmitWaypointCommand, options, submitCommandWhenRendererReady, validateWaypointAction, waypointRendererBridge]);

  const buildPointClickedCommand = useCallback((roomX: number, roomY: number): string => {
    const normalizedX = Math.max(0, Math.round(roomX));
    const normalizedY = Math.max(0, Math.round(roomY));
    return `${pointClickedCommandVerb} (${normalizedX},${normalizedY})`;
  }, [pointClickedCommandVerb]);

  useEffect(() => {
    if (activeSessionId) {
      return;
    }

    setGameplayInteractionSubstate("DefaultClick");
    setWaypointDraftCount(0);
  }, [activeSessionId]);

  return {
    developmentBootstrapActive: options.developmentBootstrap !== null,
    authUsername,
    setAuthUsername,
    authPassword,
    setAuthPassword,
    credentialHandle,
    principalName,
    discoverGames,
    selectedGameId,
    selectedGameKey,
    setSelectedGame,
    requestedSessionName,
    setRequestedSessionName,
    requestedJoinPolicy,
    setRequestedJoinPolicy,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    activeSessionId,
    activeSessionIsOwner,
    hostStatus,
    hostBusy,
    hostOperationKey,
    hostOperationPhase,
    rendererSceneSnapshot,
    rendererScaleMetrics,
    rendererLastClickPoint,
    lastPlaySurfaceDispatch,
    hudOverlayEntries,
    dismissHudOverlay,
    reportRendererScaleMetrics,
    reportRendererLastClickPoint,
    reportRendererDiagnostic,
    reportRendererRoomTransitionState,
    roomTransitionPreparationEpoch,
    sessionOutputLines,
    pendingCommandClarification,
    lastCommandResult,
    submitCommand: submitCommandWhenRendererReady,
    buildPointClickedCommand,
    reportPlaySurfaceCommandDispatch,
    submitClarificationAnswer,
    clearSessionOutputLines,
    signOut,
    signInToHost,
    fetchCurrentPrincipal,
    fetchDiscoveredGames,
    fetchGameDetails,
    fetchGamePreviewImageDataUrl,
    startSessionFromSelectedGame,
    startSessionForGame,
    listHostSessions,
    joinSelectedSession,
    joinSessionById,
    leaveActiveSession,
    quitActiveSession,
    reconnectActiveSession,
    returnToLobby,
    triggerStateEvent,
    cacheStats,
    resetCacheStats,
    clearMemoryCache,
    clearPersistentCache,
    audioUnlockRequired,
    setAudioUnlockRequired,
    requestAudioUnlock,
    soundCueStatus,
    sfxMuted,
    setSfxMuted,
    sfxVolumePercent,
    setSfxVolumePercent,
    ambientMuted,
    setAmbientMuted,
    ambientVolumePercent,
    setAmbientVolumePercent,
    roomTransitionCueOptions,
    selectedRoomTransitionCueEffectKey,
    setSelectedRoomTransitionCueEffectKey,
    roomTransitionCatalogStatus,
    waypointPointPlacementCueEffectKey,
    waypointPointPlacementCueStyle,
    gameplayInteractionSubstate,
    waypointDraftCount,
    enterWaypointMoveSetup,
    cancelWaypointMoveSetup,
    clearWaypointDraft,
    undoLastWaypointDraftPoint,
    submitWaypointDraft,
    registerWaypointInteractionRendererBridge,
    appendWaypointDraftPoint
  };
}
