import { createGameRenderer, type GameRenderSceneSnapshot } from "../index";

function svgDataUrl(fill: string, width: number, height: number, label?: string): string {
  const text = label
    ? `<text x='50%' y='54%' text-anchor='middle' font-family='Segoe UI' font-size='24' fill='rgba(255,255,255,0.85)'>${label}</text>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/>${text}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) {
  throw new Error("Missing mount element for object visual baseline harness.");
}

const renderer = createGameRenderer(mount);
renderer.resize(800, 600);

const scene: GameRenderSceneSnapshot = {
  roomId: "object-visual-baseline-room",
  roomLabel: "Object Visual Baseline Room",
  displayMode: "composed",
  bounds: {
    width: 800,
    height: 600
  },
  directionalOverlays: [
    {
      id: "down",
      slot: "Down",
      asset: { assetPath: svgDataUrl("#283548", 800, 600, "Room") },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1
    }
  ],
  roomObjects: [
    {
      objectId: "crate",
      objectName: "Crate",
      asset: { assetPath: svgDataUrl("#2563eb", 92, 92, "C") },
      x: 170,
      y: 290,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1001,
      presentationCues: []
    },
    {
      objectId: "key",
      objectName: "Key",
      asset: { assetPath: svgDataUrl("#eab308", 56, 56, "K") },
      x: 260,
      y: 346,
      rotationDegrees: -20,
      scale: 0.9,
      zOrder: 1002,
      presentationCues: []
    },
    {
      objectId: "door",
      objectName: "Door",
      asset: { assetPath: svgDataUrl("#16a34a", 120, 220, "D") },
      x: 620,
      y: 210,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1000,
      presentationCues: []
    },
    {
      objectId: "backpack",
      objectName: "Backpack",
      asset: { assetPath: svgDataUrl("#d946ef", 82, 82, "B") },
      x: 420,
      y: 298,
      rotationDegrees: 12,
      scale: 0.95,
      zOrder: 1003,
      presentationCues: []
    }
  ]
};

renderer.updateScene(scene);

window.setTimeout(() => {
  (window as Window & { __baselineReady?: boolean }).__baselineReady = true;
}, 120);