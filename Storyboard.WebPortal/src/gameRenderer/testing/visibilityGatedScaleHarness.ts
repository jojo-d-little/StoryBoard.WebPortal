import { createGameRenderer, type GameRenderSceneSnapshot } from "../index";
import { createSceneObjectsFromRoomObjects } from "../scene/sceneObjects";

declare global {
  interface Window {
    __visibilityGatedScale?: {
      ready: boolean;
      transitionState: string;
      reconcileStagedDelta: (revision: number) => void;
    };
  }
}

function svgDataUrl(fill: string, width: number, height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) throw new Error("Missing mount element for visibility-gated scale harness.");

const harness = { ready: false, transitionState: "", reconcileStagedDelta: (_revision: number) => {} };
window.__visibilityGatedScale = harness;
const renderer = createGameRenderer(mount, {
  onRoomTransitionStateChanged: (state) => { harness.transitionState = state; }
});
renderer.resize(800, 600);

const outgoing: GameRenderSceneSnapshot = {
  roomId: "scale-source",
  displayMode: "composed",
  bounds: { width: 800, height: 600 },
  directionalOverlays: [{
    id: "source-background", slot: "Center", asset: { assetPath: svgDataUrl("#18253b", 800, 600) },
    offsetX: 0, offsetY: 0, rotationDegrees: 0, scale: 1, zOrder: 0
  }],
  objectsById: createSceneObjectsFromRoomObjects([{
    objectId: "source-marker", objectName: "Source Marker", asset: { assetPath: svgDataUrl("#54708d", 160, 120) },
    x: 320, y: 240, rotationDegrees: 0, scale: 1, zOrder: 1, activePresentationCues: []
  }])
};

function incoming(revision: number): GameRenderSceneSnapshot {
  return {
    roomId: "scale-destination",
    roomLabel: `Destination update ${revision}`,
    displayMode: "composed",
    bounds: { width: 800, height: 600 },
    directionalOverlays: [{
      id: "destination-background", slot: "Center", asset: { assetPath: svgDataUrl("#102d38", 800, 600) },
      offsetX: 0, offsetY: 0, rotationDegrees: 0, scale: 1, zOrder: 0
    }],
    objectsById: createSceneObjectsFromRoomObjects([{
      objectId: "arrival-rider", objectName: "Arrival Rider", asset: { assetPath: svgDataUrl("#ffcc33", 100, 80) },
      x: 350, y: 260, rotationDegrees: 0, scale: 1, zOrder: 2,
      activePresentationCues: [
        { category: "Scale", effectKey: "scale.half.immediate", activationId: "arrival-half", activationStartAtMs: 0 },
        { category: "Scale", effectKey: "scale.grow.slow.deep", activationId: "arrival-grow", activationStartAtMs: 0 }
      ],
      resolvedObjectEffects: [
        { kind: "scaleStyle", effectKey: "scale.half.immediate", activationId: "arrival-half", activationStartAtMs: 0,
          style: { targetScaleMultiplier: 0.5, transitionDurationMs: 0 } },
        { kind: "scaleStyle", effectKey: "scale.grow.slow.deep", activationId: "arrival-grow", activationStartAtMs: 0,
          style: { targetScaleMultiplier: 2, transitionDurationMs: 5000 } }
      ]
    }]),
    roomTransition: { mode: "fade", durationMs: 5000 }
  };
}

harness.reconcileStagedDelta = (revision) => renderer.updateScene(incoming(revision));
const presentInitialRoom = () => {
  if (!mount.querySelector("canvas")) {
    window.requestAnimationFrame(presentInitialRoom);
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    renderer.updateScene(outgoing);
    window.setTimeout(() => {
      harness.ready = true;
      renderer.updateScene(incoming(0));
    }, 300);
  }));
};
presentInitialRoom();
