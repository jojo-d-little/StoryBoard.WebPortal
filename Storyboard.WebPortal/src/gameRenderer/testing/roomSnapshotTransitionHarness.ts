import { createGameRenderer, type GameRenderSceneSnapshot } from "../index";

function svgDataUrl(fill: string, width: number, height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function oversizedStripedRoomDataUrl(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'>
    <rect x='0' y='0' width='1200' height='600' fill='#1d4ed8'/>
    <rect x='580' y='0' width='40' height='600' fill='#00ff00'/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) {
  throw new Error("Missing mount element for room snapshot transition harness.");
}

let midpointScheduled = false;
const requestedMode = new URLSearchParams(window.location.search).get("mode");
const transitionMode = requestedMode === "fade-blackout" ? "fade-blackout" : "slide";
const renderer = createGameRenderer(mount, {
  onRoomTransitionStateChanged: (state) => {
    if (state === "complete" && midpointScheduled) {
      window.setTimeout(() => {
        (window as Window & { __snapshotTransitionComplete?: boolean }).__snapshotTransitionComplete = true;
      }, 300);
    }

    if (state !== "running" || midpointScheduled) {
      return;
    }

    midpointScheduled = true;
    window.setTimeout(() => {
      (window as Window & { __snapshotTransitionReady?: boolean }).__snapshotTransitionReady = true;
    }, 1000);
  }
});
renderer.resize(800, 600);

const outgoing: GameRenderSceneSnapshot = {
  roomId: "outgoing-room",
  displayMode: "composed",
  bounds: { width: 800, height: 600 },
  directionalOverlays: [{
    id: "outgoing-background",
    slot: "Down",
    asset: { assetPath: svgDataUrl("#991b1b", 800, 600) },
    offsetX: 0,
    offsetY: 0,
    rotationDegrees: 0,
    scale: 1,
    zOrder: 1
  }],
  roomObjects: [{
    objectId: "intentional-overflow",
    objectName: "Intentional Overflow",
    asset: { assetPath: svgDataUrl("#ff00ff", 200, 180) },
    x: 760,
    y: 210,
    rotationDegrees: 0,
    scale: 1,
    zOrder: 1000,
    presentationCues: []
  }]
};

const incoming: GameRenderSceneSnapshot = {
  roomId: "incoming-room",
  displayMode: "composed",
  bounds: { width: 800, height: 600 },
  directionalOverlays: [{
    id: "incoming-background",
    slot: "Center",
    asset: { assetPath: oversizedStripedRoomDataUrl() },
    offsetX: 0,
    offsetY: 0,
    rotationDegrees: 0,
    scale: 1,
    zOrder: 1
  }],
  roomObjects: [{
    objectId: "incoming-cyan",
    objectName: "Incoming Cyan",
    asset: { assetPath: svgDataUrl("#00ffff", 120, 90) },
    x: 80,
    y: 70,
    rotationDegrees: 0,
    scale: 1,
    zOrder: 100,
    presentationCues: [],
    movementDurationMs: 1000
  }, {
    objectId: "incoming-yellow",
    objectName: "Incoming Yellow",
    asset: { assetPath: svgDataUrl("#ffff00", 100, 140) },
    x: 560,
    y: 350,
    rotationDegrees: 0,
    scale: 1,
    zOrder: 200,
    presentationCues: []
  }],
  moveLegTelemetry: [{
    targetObjectId: "incoming-cyan",
    targetObjectName: "Incoming Cyan",
    legIndex: 0,
    requestedDirection: "East",
    requestedDistanceInCells: 1,
    appliedDistanceInCells: 1,
    success: true,
    resultCode: "MovedFullDistance",
    fromX: 0,
    fromY: 0,
    toX: 300,
    toY: 0,
    travelVisualizationMode: "LegByLeg"
  }, {
    targetObjectId: "incoming-cyan",
    targetObjectName: "Incoming Cyan",
    legIndex: 1,
    requestedDirection: "South",
    requestedDistanceInCells: 1,
    appliedDistanceInCells: 1,
    success: true,
    resultCode: "MovedFullDistance",
    fromX: 300,
    fromY: 0,
    toX: 300,
    toY: 200,
    travelVisualizationMode: "LegByLeg"
  }],
  roomTransition: {
    mode: transitionMode,
    travelDirection: "East",
    durationMs: 4000,
    cueEffectKey: "room.transition.snapshot-regression"
  }
};

renderer.updateScene(outgoing);
window.setTimeout(() => {
  renderer.prepareRoomTransitionSnapshot();
  renderer.updateScene(incoming);
}, 300);
