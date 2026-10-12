import { createGameRenderer, type GameRenderSceneSnapshot } from "../index";
import { createSceneObjectsFromRoomObjects } from "../scene/sceneObjects";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS } from "../presentationIsolation";

type AlphaMode = "none" | "soft" | "binary" | "binary-above-cutoff";

declare global {
  interface Window {
    __alphaMaskHarness?: { setMode: (mode: AlphaMode) => void };
    __alphaMaskReady?: boolean;
  }
}

const textureCanvas = document.createElement("canvas");
textureCanvas.width = 96;
textureCanvas.height = 32;
const context = textureCanvas.getContext("2d");
if (!context) throw new Error("2D canvas is required for the alpha mask fixture.");
context.fillStyle = "rgba(255, 255, 255, 0.5)";
context.fillRect(32, 0, 32, 32);
context.fillStyle = "rgba(255, 255, 255, 1)";
context.fillRect(64, 0, 32, 32);
const assetPath = textureCanvas.toDataURL("image/png");

const mount = document.getElementById("mount");
if (!mount) throw new Error("Alpha mask mount is missing.");
const renderer = createGameRenderer(mount, {
  presentationIsolationSettings: {
    ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
    lightingEnabled: false
  }
});
renderer.resize(128, 128);

function scene(mode: AlphaMode): GameRenderSceneSnapshot {
  return {
    roomId: "alpha-mask-room",
    roomLabel: `Alpha mask ${mode}`,
    displayMode: "composed",
    bounds: { width: 128, height: 128 },
    directionalOverlays: [],
    objectsById: createSceneObjectsFromRoomObjects([{
      objectId: "masked-object",
      objectName: "Masked Object",
      asset: { assetPath },
      x: 16,
      y: 48,
      rotationDegrees: 0,
      scale: 1,
      zOrder: 1,
      presentationCues: [],
      appearanceSilhouetteStyle: mode === "none" ? undefined : {
        maskAlphaMode: mode === "soft" ? "soft" : "binary",
        maskAlphaCutoff: mode === "binary-above-cutoff" ? 0.6 : 0.4,
        passes: [{
          name: "red-mask",
          blendMode: "normal",
          colorHexStops: ["#FF0000"],
          scaleMultiplierStops: [1.01],
          alphaStops: [1]
        }]
      }
    }])
  };
}

window.__alphaMaskHarness = { setMode: (mode) => renderer.updateScene(scene(mode)) };
window.__alphaMaskHarness.setMode("none");
window.__alphaMaskReady = true;
