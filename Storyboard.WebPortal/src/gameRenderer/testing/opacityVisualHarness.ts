import {
  createGameRenderer,
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  type GameRenderPresentationCue,
  type GameRenderSceneSnapshot,
  type PresentationIsolationSettings
} from "../index";
import { resolveObjectVisualEffects } from "../presentationCue/resolveObjectVisualEffects";

interface OpacityVisualHarness {
  setAppearanceEnabled: (enabled: boolean) => void;
  setDisappearanceEnabled: (enabled: boolean) => void;
  setSituationalScale: (scale: number) => void;
  setTiming: () => void;
  dispose: () => void;
}

declare global {
  interface Window {
    __opacityHarness?: OpacityVisualHarness;
    __opacityReady?: boolean;
  }
}

const mount = document.querySelector<HTMLElement>("#mount");
const toggle = document.querySelector<HTMLInputElement>("#appearance-toggle");
const disappearanceToggle = document.querySelector<HTMLInputElement>("#disappearance-toggle");
if (!mount || !toggle || !disappearanceToggle) throw new Error("Opacity visual fixture markup is incomplete.");

const catalog = {
  effects: [
    { category: "Appearance", effectKey: "appearance.fade.in", opacityStyle: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 2000, transition: "linear" }] } },
    { category: "Appearance", effectKey: "appearance.flicker.in", opacityStyle: { initialAlpha: 0, steps: [
      { alpha: 1, durationMs: 90, transition: "immediate" }, { alpha: 0, durationMs: 70, transition: "immediate" },
      { alpha: 0.6, durationMs: 140, transition: "linear" }, { alpha: 0.1, durationMs: 60, transition: "immediate" },
      { alpha: 1, durationMs: 250, transition: "linear" }
    ] } },
    { category: "Disappearance", effectKey: "disappearance.fade.out", opacityStyle: { initialAlpha: 1, steps: [{ alpha: 0, durationMs: 2000, transition: "linear" }] } },
    { category: "Disappearance", effectKey: "disappearance.flicker.out", opacityStyle: { initialAlpha: 1, steps: [
      { alpha: 0, durationMs: 90, transition: "immediate" }, { alpha: 1, durationMs: 70, transition: "immediate" },
      { alpha: 0.4, durationMs: 140, transition: "linear" }, { alpha: 0.9, durationMs: 60, transition: "immediate" },
      { alpha: 0, durationMs: 250, transition: "linear" }
    ] } },
    { category: "Scale", effectKey: "scale.grow.visual", scaleStyle: { targetScaleMultiplier: 1.35, transitionDurationMs: 2000 } }
  ]
};

const now = performance.now();
const cuesByName: Record<string, GameRenderPresentationCue[]> = {
  fadeIn: [
    { category: "Appearance", effectKey: "appearance.fade.in", activationId: "activation-fade-in", activationStartAtMs: now - 1000 },
    { category: "Scale", effectKey: "scale.grow.visual", activationId: "activation-scale", activationStartAtMs: now - 1000 }
  ],
  flickerIn: [{ category: "Appearance", effectKey: "appearance.flicker.in", activationId: "activation-flicker-in", activationStartAtMs: now - 120 }],
  fadeOut: [{ category: "Disappearance", effectKey: "disappearance.fade.out", activationId: "activation-fade-out", activationStartAtMs: now - 1000 }],
  flickerOut: [{ category: "Disappearance", effectKey: "disappearance.flicker.out", activationId: "activation-flicker-out", activationStartAtMs: now - 250 }],
  selectedDoor: [{ category: "Appearance", effectKey: "appearance.fade.in", activationId: "activation-fade-in", activationStartAtMs: now - 1000 }],
  optedOut: []
};

function svgDataUrl(fill: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect x="2" y="2" width="156" height="116" rx="12" fill="${fill}" stroke="#f8fafc" stroke-width="4"/><text x="80" y="68" text-anchor="middle" font-family="Segoe UI" font-size="18" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const rows = [
  ["fadeIn", "Fade In + Scale", "#0891b2", 70, 150],
  ["flickerIn", "Flicker In", "#7c3aed", 300, 150],
  ["fadeOut", "Fade Out", "#ea580c", 530, 150],
  ["flickerOut", "Flicker Out", "#be123c", 760, 150],
  ["selectedDoor", "Selected Door Part", "#15803d", 300, 390],
  ["optedOut", "Opted-out Control", "#475569", 530, 390]
] as const;

const objects = Object.fromEntries(rows.map(([id, name, color, x, y]) => {
  const cues = cuesByName[id];
  return [id, {
    objectId: id,
    objectName: name,
    sprite: {
      asset: { assetPath: svgDataUrl(color, name) },
      x,
      y,
      rotationDegrees: id === "fadeIn" ? -8 : 0,
      scale: 1,
      imageTransparency: 0.25,
      additionalSituationalScale: 1,
      situationalScalePivotOffsetFromImageXPx: 30,
      situationalScalePivotOffsetFromImageYPx: 45,
      zOrder: 1
    },
    activePresentationCues: cues,
    resolvedObjectEffects: resolveObjectVisualEffects(cues, catalog)
  }];
}));

let scene: GameRenderSceneSnapshot = {
  roomId: "appearance-disappearance-visual-fixture",
  displayMode: "composed",
  bounds: { width: 1024, height: 768 },
  directionalOverlays: [],
  objectsById: objects
};

let settings: PresentationIsolationSettings = {
  ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  categories: { ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories }
};
const renderer = createGameRenderer(mount, { presentationIsolationSettings: settings });
renderer.resize(mount.clientWidth, mount.clientHeight);
renderer.updateScene(scene);

function setAppearanceEnabled(enabled: boolean): void {
  settings = { ...settings, categories: { ...settings.categories, appearance: enabled } };
  toggle!.checked = enabled;
  renderer.setPresentationIsolationSettings(settings);
}

function setDisappearanceEnabled(enabled: boolean): void {
  settings = { ...settings, categories: { ...settings.categories, disappearance: enabled } };
  disappearanceToggle!.checked = enabled;
  renderer.setPresentationIsolationSettings(settings);
}

function setSituationalScale(scale: number): void {
  const objectsById = Object.fromEntries(Object.entries(scene.objectsById).map(([id, object]) => [id, {
    ...object,
    sprite: object.sprite ? { ...object.sprite, additionalSituationalScale: scale } : undefined
  }]));
  scene = { ...scene, objectsById };
  renderer.updateScene(scene);
}

function setTiming(): void {
  const startedAt = performance.now();
  const elapsedByEffect: Record<string, number> = {
    "appearance.fade.in": 800,
    "scale.grow.visual": 800,
    "appearance.flicker.in": 450,
    "disappearance.fade.out": 3000,
    "disappearance.flicker.out": 240
  };
  const objectsById = Object.fromEntries(Object.entries(scene.objectsById).map(([id, object]) => {
    const activePresentationCues = object.activePresentationCues.map((cue) => ({
      ...cue,
      activationStartAtMs: startedAt - (elapsedByEffect[cue.effectKey] ?? 0)
    }));
    return [id, {
      ...object,
      activePresentationCues,
      resolvedObjectEffects: resolveObjectVisualEffects(activePresentationCues, catalog)
    }];
  }));
  scene = { ...scene, objectsById };
  renderer.updateScene(scene);
}

toggle.addEventListener("change", () => setAppearanceEnabled(toggle.checked));
disappearanceToggle.addEventListener("change", () => setDisappearanceEnabled(disappearanceToggle.checked));
window.addEventListener("resize", () => renderer.resize(mount!.clientWidth, mount!.clientHeight));
window.__opacityHarness = { setAppearanceEnabled, setDisappearanceEnabled, setSituationalScale, setTiming, dispose: () => renderer.dispose() };
window.setTimeout(() => { window.__opacityReady = Boolean(mount!.querySelector("canvas")); }, 700);
