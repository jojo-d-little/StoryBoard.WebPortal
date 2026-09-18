import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createGameRenderer, type GameRenderSceneSnapshot, type GameRendererDiagnosticsEvent } from "../gameRenderer";
import type { GameRendererRoomPoint } from "../gameRenderer";
import { computeContainTransform, mapViewportPointToRoomPoint } from "../gameRenderer/scaling/containScaling";
import type {
  GameplayInteractionSubstate,
  RendererLastClickPoint,
  RendererScaleMetrics
} from "../hooks/useHostWorkflow";
import type { ResolvedStyledPointEffect } from "../gameRenderer/presentationCue/resolveMovementCueDuration";

interface WaypointInteractionRendererBridge {
  setInteractionMode: (mode: "CommandClick" | "WaypointMoveSetup") => void;
  appendWaypointDraft: (point: GameRendererRoomPoint) => number;
  getWaypointsSnapshot: () => readonly GameRendererRoomPoint[];
  clearWaypoints: () => void;
  removeLastWaypoint: () => boolean;
}

interface SessionPlaySurfaceRendererV1Props {
  activeSessionId: string;
  sceneSnapshot: GameRenderSceneSnapshot | null;
  gameplayInteractionSubstate: GameplayInteractionSubstate;
  waypointDraftCount: number;
  waypointPointPlacementCueStyle: ResolvedStyledPointEffect | null;
  hasManualDismissHudOverlay: boolean;
  onDismissHudOverlay: () => void;
  onRegisterWaypointInteractionRendererBridge: (bridge: WaypointInteractionRendererBridge | null) => void;
  onReportRendererDiagnostic: (event: GameRendererDiagnosticsEvent) => void;
  onReportRendererScaleMetrics: (metrics: RendererScaleMetrics | null) => void;
  onReportRendererLastClickPoint: (clickPoint: RendererLastClickPoint | null) => void;
  onWaypointPointSelected: (point: GameRendererRoomPoint) => void;
  onCommandPointSelected: (point: GameRendererRoomPoint, insideRoom: boolean) => void;
}

function createFallbackScene(): GameRenderSceneSnapshot {
  return {
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [],
    roomObjects: []
  };
}

export function SessionPlaySurfaceRendererV1(props: SessionPlaySurfaceRendererV1Props): JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createGameRenderer> | null>(null);
  const lastViewportSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastScaleMetricsRef = useRef<string>("");
  const waypointEffectHandleStackRef = useRef<string[]>([]);
  const waypointEffectSequenceRef = useRef<number>(0);
  const scene = useMemo(() => props.sceneSnapshot ?? createFallbackScene(), [props.sceneSnapshot]);

  function cancelWaypointDraftEffectHandle(handleKey: string): void {
    rendererRef.current?.applyStyledPointEffectIntent({
      intent: "cancel",
      handleKey
    });
  }

  function cancelAllWaypointDraftEffects(): void {
    const handles = waypointEffectHandleStackRef.current;
    while (handles.length > 0) {
      const handle = handles.pop();
      if (!handle) {
        continue;
      }

      cancelWaypointDraftEffectHandle(handle);
    }
  }

  useEffect(() => {
    if (!props.activeSessionId) {
      props.onRegisterWaypointInteractionRendererBridge(null);
      cancelAllWaypointDraftEffects();
      waypointEffectSequenceRef.current = 0;
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      return;
    }

    if (!mountRef.current || rendererRef.current) {
      return;
    }

    rendererRef.current = createGameRenderer(mountRef.current, {
      diagnosticsSink: (event: GameRendererDiagnosticsEvent) => {
        props.onReportRendererDiagnostic(event);
        console.debug("[gameRenderer]", event.level, event.category, event.message, event.details);
      }
    });

    props.onRegisterWaypointInteractionRendererBridge(rendererRef.current);

    return () => {
      cancelAllWaypointDraftEffects();
      waypointEffectSequenceRef.current = 0;
      props.onRegisterWaypointInteractionRendererBridge(null);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [props.activeSessionId]);

  useEffect(() => {
    if (!rendererRef.current) {
      return;
    }

    rendererRef.current.setInteractionMode(
      props.gameplayInteractionSubstate === "WaypointMoveSetup"
        ? "WaypointMoveSetup"
        : "CommandClick"
    );

    if (props.gameplayInteractionSubstate !== "WaypointMoveSetup") {
      cancelAllWaypointDraftEffects();
      waypointEffectSequenceRef.current = 0;
    }
  }, [props.gameplayInteractionSubstate]);

  useEffect(() => {
    const targetCount = Math.max(0, props.waypointDraftCount);
    const handles = waypointEffectHandleStackRef.current;
    while (handles.length > targetCount) {
      const handle = handles.pop();
      if (!handle) {
        continue;
      }

      cancelWaypointDraftEffectHandle(handle);
    }
  }, [props.waypointDraftCount]);

  useEffect(() => {
    if (!props.activeSessionId || !mountRef.current || !rendererRef.current) {
      props.onReportRendererScaleMetrics(null);
      props.onReportRendererLastClickPoint(null);
      lastViewportSizeRef.current = null;
      lastScaleMetricsRef.current = "";
      return;
    }

    const mountElement = mountRef.current;
    const reportRendererScaleMetrics = props.onReportRendererScaleMetrics;

    const applySize = (): void => {
      const width = Math.max(1, Math.floor(mountElement.clientWidth));
      const height = Math.max(1, Math.floor(mountElement.clientHeight));

      const lastSize = lastViewportSizeRef.current;
      if (lastSize && lastSize.width === width && lastSize.height === height) {
        return;
      }

      lastViewportSizeRef.current = { width, height };
      rendererRef.current?.resize(width, height);

      const roomWidth = Math.max(1, Math.floor(scene.bounds.width));
      const roomHeight = Math.max(1, Math.floor(scene.bounds.height));
      const transform = computeContainTransform(roomWidth, roomHeight, width, height);

      const metricsKey = `${roomWidth}x${roomHeight}|${width}x${height}|${transform.scale.toFixed(5)}`;
      if (metricsKey === lastScaleMetricsRef.current) {
        return;
      }

      lastScaleMetricsRef.current = metricsKey;

      reportRendererScaleMetrics({
        roomWidth,
        roomHeight,
        viewportWidth: width,
        viewportHeight: height,
        scale: transform.scale
      });
    };

    applySize();

    const observer = new ResizeObserver(() => {
      applySize();
    });

    observer.observe(mountElement);

    return () => {
      observer.disconnect();
    };
  }, [
    props.activeSessionId,
    props.onReportRendererLastClickPoint,
    props.onReportRendererScaleMetrics,
    scene.bounds.height,
    scene.bounds.width
  ]);

  useEffect(() => {
    if (!rendererRef.current || !props.activeSessionId) {
      return;
    }

    rendererRef.current.updateScene(scene);
  }, [props.activeSessionId, scene]);

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }

    if (props.hasManualDismissHudOverlay) {
      props.onDismissHudOverlay();
    }

    const mountElement = mountRef.current;
    if (!mountElement) {
      return;
    }

    const rect = mountElement.getBoundingClientRect();
    const viewportX = event.clientX - rect.left;
    const viewportY = event.clientY - rect.top;

    const transform = computeContainTransform(
      scene.bounds.width,
      scene.bounds.height,
      Math.max(1, Math.floor(rect.width)),
      Math.max(1, Math.floor(rect.height))
    );

    const translatedPoint = mapViewportPointToRoomPoint(transform, viewportX, viewportY);

    props.onReportRendererLastClickPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      viewportX,
      viewportY,
      roomX: translatedPoint.roomX,
      roomY: translatedPoint.roomY,
      insideRoom: translatedPoint.insideRoom
    });

    if (props.gameplayInteractionSubstate === "WaypointMoveSetup") {
      if (props.waypointPointPlacementCueStyle) {
        const handleKey = `waypoint-point:draft:${waypointEffectSequenceRef.current}`;
        waypointEffectSequenceRef.current += 1;
        waypointEffectHandleStackRef.current.push(handleKey);

        rendererRef.current?.applyStyledPointEffectIntent({
          intent: "show",
          handleKey,
          roomX: translatedPoint.roomX,
          roomY: translatedPoint.roomY,
          style: {
            ...props.waypointPointPlacementCueStyle,
            clearPolicy: "manual-removal",
            lifetimeMs: undefined,
            cooldownMs: undefined
          }
        });
      }

      props.onWaypointPointSelected({
        x: translatedPoint.roomX,
        y: translatedPoint.roomY
      });
      return;
    }

    props.onCommandPointSelected({
      x: translatedPoint.roomX,
      y: translatedPoint.roomY
    }, translatedPoint.insideRoom);
  }

  return (
    <section className="session-play-surface-v1">
      <div className="session-play-surface-v1__stage" ref={mountRef} onPointerDown={handleSurfacePointerDown} />
    </section>
  );
}