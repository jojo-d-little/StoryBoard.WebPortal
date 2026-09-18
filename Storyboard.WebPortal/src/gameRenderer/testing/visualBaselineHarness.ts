import { createGameRenderer, type GameRenderSceneSnapshot } from "../index";

function svgDataUrl(fill: string, width: number, height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.getElementById("mount");
if (!mount) {
  throw new Error("Missing mount element for visual baseline harness.");
}

const renderer = createGameRenderer(mount);
renderer.resize(800, 600);

const scene: GameRenderSceneSnapshot = {
  roomId: "visual-baseline-room",
  roomLabel: "Visual Baseline Room",
  displayMode: "composed",
  bounds: {
    width: 800,
    height: 600
  },
  roomObjects: [],
  directionalOverlays: [
    {
      id: "down",
      slot: "Down",
      asset: { assetPath: svgDataUrl("#283548", 800, 600) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1
    },
    {
      id: "north",
      slot: "North",
      asset: { assetPath: svgDataUrl("#9b2c2c", 560, 120) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 180,
      scale: 1,
      zOrder: 2
    },
    {
      id: "east",
      slot: "East",
      asset: { assetPath: svgDataUrl("#0f766e", 120, 420) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 180,
      scale: 1,
      zOrder: 3
    },
    {
      id: "south",
      slot: "South",
      asset: { assetPath: svgDataUrl("#7c2d12", 560, 120) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 4
    },
    {
      id: "west",
      slot: "West",
      asset: { assetPath: svgDataUrl("#14532d", 120, 420) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 5
    },
    {
      id: "ne",
      slot: "NorthEast",
      asset: { assetPath: svgDataUrl("#eab308", 120, 120) },
      offsetX: 24,
      offsetY: -31,
      rotationDegrees: 90,
      scale: 1,
      zOrder: 6
    },
    {
      id: "se",
      slot: "SouthEast",
      asset: { assetPath: svgDataUrl("#d946ef", 120, 120) },
      offsetX: 25,
      offsetY: 25,
      rotationDegrees: 180,
      scale: 1,
      zOrder: 7
    },
    {
      id: "sw",
      slot: "SouthWest",
      asset: { assetPath: svgDataUrl("#2563eb", 120, 120) },
      offsetX: -25,
      offsetY: 25,
      rotationDegrees: -90,
      scale: 1,
      zOrder: 8
    },
    {
      id: "nw",
      slot: "NorthWest",
      asset: { assetPath: svgDataUrl("#f59e0b", 120, 120) },
      offsetX: -26,
      offsetY: -24,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 9
    }
  ]
};

renderer.updateScene(scene);

window.setTimeout(() => {
  (window as Window & { __baselineReady?: boolean }).__baselineReady = true;
}, 120);
