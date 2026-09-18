import { createGameRenderer, type GameRenderSceneSnapshot, type GameRendererDiagnosticsEvent } from "../index";

type MovementStressResult = {
  animationStarts: number;
  resetDetected: boolean;
  samples: Array<{ fromX: number; toX: number; durationMs: number }>;
};

declare global {
  interface Window {
    __movementStressReady?: boolean;
    __movementStressResult?: MovementStressResult;
  }
}

function svgDataUrl(fill: string, width: number, height: number, label?: string): string {
  const text = label
    ? `<text x='50%' y='54%' text-anchor='middle' font-family='Segoe UI' font-size='20' fill='rgba(255,255,255,0.9)'>${label}</text>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/>${text}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) {
  throw new Error("Missing mount element for movement stress harness.");
}

const movementSamples: Array<{ fromX: number; toX: number; durationMs: number }> = [];
let resetDetected = false;
let lastFromX = Number.NEGATIVE_INFINITY;
let runnerSpritePrepared = false;
let updatesScheduled = false;

function onDiagnostic(event: GameRendererDiagnosticsEvent): void {
  if (event.category === "scene" && event.message === "Room object sprite prepared.") {
    const details = (event.details ?? {}) as { objectId?: string };
    if (details.objectId === "runner") {
      runnerSpritePrepared = true;
    }
  }

  if (event.category !== "scene" || event.message !== "Animating room object movement from cue timing.") {
    return;
  }

  const details = (event.details ?? {}) as {
    objectId?: string;
    fromX?: number;
    toX?: number;
    movementDurationMs?: number;
  };

  if (details.objectId !== "runner") {
    return;
  }

  const fromX = Number(details.fromX);
  const toX = Number(details.toX);
  const durationMs = Number(details.movementDurationMs);
  if (!Number.isFinite(fromX) || !Number.isFinite(toX) || !Number.isFinite(durationMs)) {
    return;
  }

  movementSamples.push({ fromX, toX, durationMs });

  // In this scenario all targets move rightward; a big backward fromX reset indicates stale-origin snap risk.
  if (fromX + 8 < lastFromX) {
    resetDetected = true;
  }
  lastFromX = Math.max(lastFromX, fromX);
}

const renderer = createGameRenderer(mount, {
  diagnosticsSink: onDiagnostic
});
renderer.resize(800, 600);

function buildScene(runnerX: number): GameRenderSceneSnapshot {
  return {
    roomId: "movement-stress-room",
    roomLabel: "Movement Stress Room",
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [
      {
        id: "down",
        slot: "Down",
        asset: { assetPath: svgDataUrl("#1f2937", 800, 600, "Stress") },
        offsetX: 0,
        offsetY: 0,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 1
      }
    ],
    roomObjects: [
      {
        objectId: "runner",
        objectName: "Runner",
        asset: { assetPath: svgDataUrl("#e11d48", 56, 56, "R") },
        x: runnerX,
        y: 320,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 1001,
        presentationCues: [],
        movementDurationMs: 900
      }
    ]
  };
}

renderer.updateScene(buildScene(80));

const targets = [140, 200, 260, 320, 380, 440];
const retargetIntervalMs = 90;

function scheduleRetargetUpdates(): void {
  if (updatesScheduled) {
    return;
  }

  updatesScheduled = true;
  targets.forEach((targetX, index) => {
    window.setTimeout(() => {
      renderer.updateScene(buildScene(targetX));
    }, retargetIntervalMs * index);
  });
}

const readinessCheckHandle = window.setInterval(() => {
  if (runnerSpritePrepared) {
    window.clearInterval(readinessCheckHandle);
    scheduleRetargetUpdates();
  }
}, 25);

// Safety fallback: if diagnostics are delayed, still schedule updates after a longer warm-up.
window.setTimeout(() => {
  window.clearInterval(readinessCheckHandle);
  scheduleRetargetUpdates();
}, 1200);

window.setTimeout(() => {
  window.__movementStressResult = {
    animationStarts: movementSamples.length,
    resetDetected,
    samples: movementSamples.slice()
  };
  window.__movementStressReady = true;
}, 3200);
