import {
  createGameRenderer,
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  type GameRenderSceneSnapshot,
  type PresentationIsolationSettings
} from "../index";

type FixtureMode = "compact" | "workshop" | "supply-closet" | "stress" | "ambient-only" | "phase-high" | "removed" | "zero" | "legacy";

interface LightingVisualHarness {
  setLightingEnabled: (enabled: boolean) => void;
  setGridEnabled: (enabled: boolean) => void;
  setMode: (mode: FixtureMode) => void;
  moveCrate: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

declare global {
  interface Window {
    __lightingHarness?: LightingVisualHarness;
    __lightingReady?: boolean;
  }
}

function svgDataUrl(fill: string, width: number, height: number, mark = ""): string {
  const label = mark
    ? `<text x='50%' y='55%' text-anchor='middle' font-family='Segoe UI' font-size='${Math.min(width, height) / 2}px' fill='#ffffff'>${mark}</text>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' rx='10' fill='${fill}'/>${label}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mount = document.querySelector<HTMLElement>("#mount");
const lightingToggle = document.querySelector<HTMLInputElement>("#lighting-toggle");
const gridToggle = document.querySelector<HTMLInputElement>("#lighting-grid-toggle");
const fixtureName = document.querySelector<HTMLOutputElement>("#fixture-name");
if (!mount || !lightingToggle || !gridToggle || !fixtureName) {
  throw new Error("Lighting visual fixture markup is incomplete.");
}

let settings: PresentationIsolationSettings = {
  ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  lightingEnabled: new URLSearchParams(window.location.search).get("lighting") !== "off",
  categories: { ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories }
};
lightingToggle.checked = settings.lightingEnabled;
const renderer = createGameRenderer(mount, {
  presentationIsolationSettings: settings
});

function makeScene(mode: FixtureMode, roomId = "lighting-compact"): GameRenderSceneSnapshot {
  const workshop = mode === "workshop";
  const supplyCloset = mode === "supply-closet";
  const stress = mode === "stress";
  const width = stress ? 1600 : 800;
  const height = stress ? 1200 : 600;
  const cellSizePx = 40;
  const ambient = mode === "phase-high" ? 0.68 : workshop || supplyCloset ? 0.7 : stress ? 0.26 : 0.2;
  const objectsById: GameRenderSceneSnapshot["objectsById"] = {};

  if (workshop) {
    // Authored lighting values from the WorkshopTutorial Atrium RoomLight and runtime room.
    // The fixture uses a synthetic host-resolved object position.
    objectsById.roomLight = {
      objectId: "roomLight",
      objectName: "WorkshopTutorial RoomLight",
      presentationCues: [],
      lighting: {
        pointLight: {
          x: 420,
          y: 322,
          radiusPx: 800,
          intensityScale: 1,
          color: "#F7F798",
          outerColor: "#F5F5D5",
          motionMode: "static"
        }
      }
    };
  } else if (supplyCloset) {
    // Authored Brass Key point light and zero-strength occlusion from WorkshopTutorial.
    objectsById.brassKey = {
      objectId: "brassKey",
      objectName: "WorkshopTutorial Brass Key",
      presentationCues: [],
      sprite: {
        asset: { assetPath: svgDataUrl("#d5a318", 56, 56, "K") },
        x: 300,
        y: 250,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 20
      },
      lighting: {
        pointLight: {
          x: 351,
          y: 290,
          radiusPx: 399,
          motionMode: "flicker",
          color: "#F2D411",
          outerColor: "#FAEA80",
          gradientExponent: 4.01,
          intensityScale: 1.01,
          flickerAmount: 0.72,
          flickerHz: 14.33,
          flickerStyle: "flame"
        },
        lightOcclusion: { strength: 0 }
      }
    };
  } else if (stress) {
    for (let index = 0; index < 32; index += 1) {
      const column = index % 8;
      const row = Math.floor(index / 8);
      const x = 130 + column * 185;
      const y = 135 + row * 250;
      const id = `workshop-light-${index}`;
      const isBlocker = index % 2 === 0;
      objectsById[id] = {
        objectId: id,
        objectName: `Workshop light ${index + 1}`,
        presentationCues: [],
        lighting: {
          pointLight: {
            x: x + 40,
            y: y + 40,
            radiusPx: 210,
            intensityScale: 0.9,
            color: index % 2 === 0 ? "#ffc96a" : "#6fc9ff",
            motionMode: "static"
          },
          ...(isBlocker ? {
            spatialFootprint: {
              cellX: Math.floor(x / cellSizePx),
              cellY: Math.floor(y / cellSizePx),
              sizeXCells: 2,
              sizeYCells: 2,
              cornerStyle: index % 4 === 0 ? "rounded" : "sharp"
            } as const,
            lightOcclusion: { strength: 0.8 }
          } : {})
        },
        ...(isBlocker ? {
          sprite: {
            asset: { assetPath: svgDataUrl("#8b5e3c", 80, 80, "") },
            x,
            y,
            rotationDegrees: 0,
            scale: 1,
            zOrder: 100 + index
          }
        } : {})
      };
    }
  } else if (mode !== "ambient-only" && mode !== "legacy") {
    if (mode !== "removed") {
      objectsById.crate = {
        objectId: "crate",
        objectName: "Lit crate",
        presentationCues: [],
        sprite: {
          asset: { assetPath: svgDataUrl("#a94f25", 80, 80, "C") },
          x: 280,
          y: 240,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 20
        },
        lighting: {
          pointLight: {
            x: 320,
            y: 275,
            radiusPx: 240,
            intensityScale: mode === "zero" ? 0 : 1.25,
            color: "#ffd078",
            motionMode: "static"
          },
          spatialFootprint: {
            cellX: 7,
            cellY: 6,
            sizeXCells: 2,
            sizeYCells: 2,
            cornerStyle: "sharp"
          },
          lightOcclusion: { strength: mode === "zero" ? 0 : 1 }
        }
      };
      objectsById.lantern = {
        objectId: "lantern",
        objectName: "Light-only lantern",
        presentationCues: [],
        lighting: {
          pointLight: {
            x: 565,
            y: 155,
            radiusPx: 175,
            intensityScale: mode === "zero" ? 0 : 1.1,
            color: "#74caff",
            motionMode: "static"
          }
        }
      };
    }
  }

  const scene: GameRenderSceneSnapshot = {
    roomId,
    roomLabel: workshop
      ? "WorkshopTutorial Atrium light fixture"
      : supplyCloset ? "WorkshopTutorial Supply Closet light fixture" : stress ? "Lighting stress workload" : "Compact lighting fixture",
    displayMode: "composed",
    bounds: { width, height },
    directionalOverlays: [{
      id: "room-floor",
      slot: "Down",
      asset: { assetPath: svgDataUrl("#59616a", width, height) },
      offsetX: 0,
      offsetY: 0,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 0
    }],
    objectsById,
    ...(mode === "legacy" ? {} : {
      lighting: {
        cellSizePx,
        pointLightDefaults: workshop || supplyCloset
          ? {
            radiusPx: 150,
            intensityScale: 1,
            color: "#E2CB5E",
            outerColor: "#FBF706",
            gradientExponent: 4,
            lightHeightCells: 4,
            swayAmountPx: 20,
            swayHz: 1,
            swayDirectionDeg: 45,
            flickerAmount: 0.7,
            flickerHz: 10,
            flickerStyle: "flame"
          }
          : { radiusPx: 160, intensityScale: 1 },
        ambientLighting: { ambient, ambientColor: workshop ? "#F7EDCB" : supplyCloset ? "#FFFFFF" : "#dce7ff" }
      }
    })
  };
  return scene;
}

let currentMode: FixtureMode = "compact";
let currentRoomId = "lighting-compact";
renderer.resize(mount.clientWidth, mount.clientHeight);
let currentScene = makeScene(currentMode, currentRoomId);
renderer.updateScene(currentScene);

function setLightingEnabled(enabled: boolean): void {
  settings = { ...settings, lightingEnabled: enabled };
  lightingToggle!.checked = enabled;
  renderer.setPresentationIsolationSettings(settings);
}

function setGridEnabled(enabled: boolean): void {
  settings = { ...settings, lightingGridEnabled: enabled };
  gridToggle!.checked = enabled;
  renderer.setPresentationIsolationSettings(settings);
}

function setMode(mode: FixtureMode): void {
  currentMode = mode;
  if (mode === "workshop" || mode === "supply-closet" || mode === "stress") currentRoomId = `lighting-${mode}`;
  else if (currentRoomId !== "lighting-compact") currentRoomId = "lighting-compact";
  fixtureName!.value = mode;
  currentScene = makeScene(mode, currentRoomId);
  renderer.updateScene(currentScene);
}

function moveCrate(): void {
  const crate = currentScene.objectsById.crate;
  const pointLight = crate?.lighting?.pointLight;
  const spatialFootprint = crate?.lighting?.spatialFootprint;
  if (!crate?.sprite || !pointLight || !spatialFootprint || !crate.lighting) return;
  const previousLighting = crate.lighting;
  currentScene = {
    ...currentScene,
    objectsById: {
      ...currentScene.objectsById,
      crate: {
        ...crate,
        sprite: { ...crate.sprite, x: 520 },
        lighting: {
          ...previousLighting,
          pointLight: { ...pointLight, x: pointLight.x + 240 },
          spatialFootprint: { ...spatialFootprint, cellX: spatialFootprint.cellX + 6 }
        },
        lightingTransitionFrom: previousLighting,
        movementDurationMs: 1600
      }
    }
  };
  renderer.updateScene(currentScene);
}

lightingToggle.addEventListener("change", () => setLightingEnabled(lightingToggle.checked));
gridToggle.addEventListener("change", () => setGridEnabled(gridToggle.checked));
window.addEventListener("resize", () => renderer.resize(mount.clientWidth, mount.clientHeight));

window.__lightingHarness = {
  setLightingEnabled,
  setGridEnabled,
  setMode,
  moveCrate,
  resize: (width, height) => {
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    renderer.resize(width, height);
  },
  dispose: () => renderer.dispose()
};

window.setTimeout(() => {
  window.__lightingReady = Boolean(mount.querySelector("canvas"));
}, 700);
