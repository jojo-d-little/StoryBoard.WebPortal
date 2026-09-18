import { createGameRenderer, type GameRenderSceneSnapshot, type GameRendererDiagnosticsEvent } from "../index";

type SpeedTierResult = {
  observedMs: Record<string, number>;
  orderedFastMediumSlow: boolean;
  startedCount: number;
  completedCount: number;
};

declare global {
  interface Window {
    __movementSpeedTierReady?: boolean;
    __movementSpeedTierResult?: SpeedTierResult;
  }
}

function svgDataUrl(fill: string, width: number, height: number, label?: string): string {
  const text = label
    ? `<text x='50%' y='54%' text-anchor='middle' font-family='Segoe UI' font-size='18' fill='rgba(255,255,255,0.9)'>${label}</text>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/>${text}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) {
  throw new Error("Missing mount element for movement speed tier harness.");
}

type Runner = {
  id: string;
  y: number;
  color: string;
  label: string;
  durationMs: number;
};

const runners: Runner[] = [
  { id: "runner-fast", y: 220, color: "#16a34a", label: "F", durationMs: 900 },
  { id: "runner-medium", y: 320, color: "#f59e0b", label: "M", durationMs: 1500 },
  { id: "runner-slow", y: 420, color: "#ef4444", label: "S", durationMs: 2500 }
];

const startTimesById = new Map<string, number>();
const completionTimesById = new Map<string, number>();
const preparedIds = new Set<string>();
let updatesScheduled = false;

function nowMs(): number {
  return performance.now();
}

function maybeScheduleMovementBurst(renderer: ReturnType<typeof createGameRenderer>): void {
  if (updatesScheduled || preparedIds.size < runners.length) {
    return;
  }

  updatesScheduled = true;
  renderer.updateScene(buildScene(500));
}

function onDiagnostic(renderer: ReturnType<typeof createGameRenderer>, event: GameRendererDiagnosticsEvent): void {
  if (event.category !== "scene") {
    return;
  }

  if (event.message === "Room object sprite prepared.") {
    const details = (event.details ?? {}) as { objectId?: string };
    if (details.objectId && runners.some((runner) => runner.id === details.objectId)) {
      preparedIds.add(details.objectId);
      maybeScheduleMovementBurst(renderer);
    }
    return;
  }

  if (event.message === "Animating room object movement from cue timing.") {
    const details = (event.details ?? {}) as { objectId?: string };
    const objectId = details.objectId ?? "";
    if (!objectId || startTimesById.has(objectId)) {
      return;
    }

    startTimesById.set(objectId, nowMs());
    return;
  }

  if (event.message === "Room object movement animation completed.") {
    const details = (event.details ?? {}) as { objectId?: string };
    const objectId = details.objectId ?? "";
    if (!objectId || completionTimesById.has(objectId)) {
      return;
    }

    completionTimesById.set(objectId, nowMs());
  }
}

function buildScene(targetX: number): GameRenderSceneSnapshot {
  return {
    roomId: "movement-speed-tier-room",
    roomLabel: "Movement Speed Tier Room",
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [
      {
        id: "down",
        slot: "Down",
        asset: { assetPath: svgDataUrl("#1f2937", 800, 600, "Speed Tiers") },
        offsetX: 0,
        offsetY: 0,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 1
      }
    ],
    roomObjects: runners.map((runner) => ({
      objectId: runner.id,
      objectName: runner.id,
      asset: { assetPath: svgDataUrl(runner.color, 56, 56, runner.label) },
      x: targetX,
      y: runner.y,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1000,
      presentationCues: [],
      movementDurationMs: runner.durationMs
    }))
  };
}

const renderer = createGameRenderer(mount, {
  diagnosticsSink: (event) => onDiagnostic(renderer, event)
});
renderer.resize(800, 600);
renderer.updateScene(buildScene(80));

// Safety fallback if diagnostics are delayed under heavy browser load.
window.setTimeout(() => {
  maybeScheduleMovementBurst(renderer);
}, 1200);

window.setTimeout(() => {
  const observedMs: Record<string, number> = {};
  for (const runner of runners) {
    const start = startTimesById.get(runner.id);
    const end = completionTimesById.get(runner.id);
    if (start !== undefined && end !== undefined) {
      observedMs[runner.id] = Math.max(0, Math.round(end - start));
    }
  }

  const fast = observedMs["runner-fast"];
  const medium = observedMs["runner-medium"];
  const slow = observedMs["runner-slow"];
  const orderedFastMediumSlow = Number.isFinite(fast)
    && Number.isFinite(medium)
    && Number.isFinite(slow)
    && fast < medium
    && medium < slow;

  window.__movementSpeedTierResult = {
    observedMs,
    orderedFastMediumSlow,
    startedCount: startTimesById.size,
    completedCount: completionTimesById.size
  };
  window.__movementSpeedTierReady = true;
}, 4200);
