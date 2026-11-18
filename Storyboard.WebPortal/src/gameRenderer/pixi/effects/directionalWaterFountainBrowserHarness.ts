import { Application, Graphics } from "pixi.js";
import {
  mapCatalogStreamOverrides,
  resolveCatalogRecipe,
  TopDownEffects,
  type CatalogParticleEffect,
  type CatalogResolvedTuning
} from "@jojo-d-little/storyboard-particles";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import directionalEffectsFixture from "../../../../visual-tests/fixtures/directional-water-fountain/effects.json";
import { ParticleEffectSceneController } from "./ParticleEffectSceneController";

type PixelFrame = { pixels: Uint8Array; width: number; height: number };
type BurstRecord = { effectKey?: string; streamId?: string; requestedCount?: number; outcome?: string };
type EmitterCase = { id: string; x: number; y: number; tuning: CatalogResolvedTuning };

const definitions = directionalEffectsFixture as unknown as CatalogParticleEffect[];
const fountain = definitions.find((effect) => effect.effectKey === "particle.water-fountain")!;
const arcing = definitions.find((effect) => effect.effectKey === "particle.electrical-arcing")!;
const fountainEmitters: EmitterCase[] = [
  { id: "fountain-northwest", x: 414, y: 376, tuning: { DirectionDegrees: 315, AccelerationXPxPerSecond2: -45, AccelerationYPxPerSecond2: -75, EmissionTimingJitterPercent: 0, Colors: { primary: "#62e8ff", secondary: "#e4fbff" } } },
  { id: "fountain-northeast", x: 486, y: 376, tuning: { DirectionDegrees: 45, AccelerationXPxPerSecond2: 45, AccelerationYPxPerSecond2: -55, EmissionTimingJitterPercent: 35, Colors: { primary: "#b6ff6a", secondary: "#f2ffd7" } } },
  { id: "fountain-southwest", x: 414, y: 424, tuning: { DirectionDegrees: 225, AccelerationXPxPerSecond2: -30, AccelerationYPxPerSecond2: 70, EmissionTimingJitterPercent: 0, Colors: { primary: "#ff9b70", secondary: "#ffe2cc" } } },
  { id: "fountain-southeast", x: 486, y: 424, tuning: { DirectionDegrees: 135, AccelerationXPxPerSecond2: 70, AccelerationYPxPerSecond2: 45, EmissionTimingJitterPercent: 55, Colors: { primary: "#d59cff", secondary: "#f3e0ff" } } }
];
const arcTuning: CatalogResolvedTuning = {
  EmissionRateMultiplier: 1,
  LifetimeMultiplier: 1,
  SizeMultiplier: 1,
  SpawnRadiusMultiplier: 1,
  Colors: { primary: "#fff36a", secondary: "#42eaff" },
  DirectionDegrees: 0,
  EmissionTimingJitterPercent: 50,
  AccelerationXPxPerSecond2: 0,
  AccelerationYPxPerSecond2: 0
};

function makeSnapshot(
  emitters: EmitterCase[],
  arcTuningValue: CatalogResolvedTuning,
  bursts: GameRenderSceneSnapshot["particleEffectBursts"] = [],
  disabledEmitterIds: ReadonlySet<string> = new Set(),
  includeInstances = true
): GameRenderSceneSnapshot {
  const objectsById = Object.fromEntries(emitters.map((emitter, index) => [emitter.id, {
    objectId: emitter.id,
    objectName: emitter.id,
    activePresentationCues: [],
    particleEffect: {
      id: `${emitter.id}-instance`,
      effectKey: fountain.effectKey,
      x: emitter.x,
      y: emitter.y,
      enabled: !disabledEmitterIds.has(emitter.id),
      order: index,
      tuning: emitter.tuning
    }
  }]));
  if (includeInstances) {
    objectsById.arcing = {
      objectId: "arcing",
      objectName: "Electrical Arc",
      activePresentationCues: [],
      particleEffect: {
        id: "arc-instance",
        effectKey: arcing.effectKey,
        x: 780,
        y: 400,
        enabled: true,
        order: emitters.length,
        tuning: arcTuningValue
      }
    };
  }
  return {
    roomId: "directional-water-effects",
    displayMode: "composed",
    bounds: { width: 900, height: 620 },
    directionalOverlays: [],
    particleEffectCatalog: definitions,
    particleEffectImageMappings: [{
      effectKey: fountain.effectKey,
      imageSlot: "rain-ripple",
      relativeLocator: "Project/Effects/Fountain/custom-ripple.png"
    }],
    objectsById: includeInstances ? objectsById : {},
    particleEffectBursts: bursts ?? []
  };
}

function changedPixelsNear(current: PixelFrame, baseline: PixelFrame, centerX: number, centerY: number): number {
  let changed = 0;
  const radius = 55;
  for (let y = Math.max(0, centerY - radius); y < Math.min(current.height, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x < Math.min(current.width, centerX + radius); x += 1) {
      const index = (y * current.width + x) * 4;
      if (current.pixels[index] !== baseline.pixels[index]
        || current.pixels[index + 1] !== baseline.pixels[index + 1]
        || current.pixels[index + 2] !== baseline.pixels[index + 2]) changed += 1;
    }
  }
  return changed;
}

function toDataUrl(frame: PixelFrame): string {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a canvas for the directional particle frame.");
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0);
  return canvas.toDataURL("image/png");
}

function resolveEmitterMappings(emitters: EmitterCase[]) {
  const recipe = fountain.particleEffect.recipe;
  if (recipe.renderingMode !== "point") throw new Error("The fountain fixture must use a point-particle recipe.");
  return emitters.map(({ id, x, y, tuning }) => {
    const effective = resolveCatalogRecipe(recipe, tuning);
    const mapped = mapCatalogStreamOverrides(recipe, effective, tuning);
    const streamValues = Object.fromEntries(recipe.streams.map((stream) => [stream.id, {
      surgeOnly: stream.surgeOnly === true,
      accelerationX: mapped[stream.id].accelerationXPxPerSecond2 ?? stream.accelerationXPxPerSecond2 ?? 0,
      accelerationY: mapped[stream.id].accelerationYPxPerSecond2 ?? stream.accelerationYPxPerSecond2 ?? 0
    }]));
    const continuous = recipe.streams.find((stream) => stream.surgeOnly !== true)!;
    const continuousOverride = mapped[continuous.id];
    const authoredVelocityX = (continuous.velocityXMinPxPerSecond + continuous.velocityXMaxPxPerSecond) / 2;
    const authoredVelocityY = (continuous.velocityYMinPxPerSecond + continuous.velocityYMaxPxPerSecond) / 2;
    const rotation = continuousOverride.velocityRotationRadians ?? 0;
    const velocityX = authoredVelocityX * Math.cos(rotation) - authoredVelocityY * Math.sin(rotation);
    const velocityY = authoredVelocityX * Math.sin(rotation) + authoredVelocityY * Math.cos(rotation);
    const t = 0.5;
    const trajectoryAtHalfSecond = {
      x: x + (velocityX * t) + (0.5 * (continuousOverride.accelerationXPxPerSecond2 ?? continuous.accelerationXPxPerSecond2 ?? 0) * t * t),
      y: y + (velocityY * t) + (0.5 * (continuousOverride.accelerationYPxPerSecond2 ?? continuous.accelerationYPxPerSecond2 ?? 0) * t * t)
    };
    return { id, direction: tuning.DirectionDegrees, accelerationX: tuning.AccelerationXPxPerSecond2, accelerationY: tuning.AccelerationYPxPerSecond2, streams: streamValues, trajectoryAtHalfSecond };
  });
}

export async function runDirectionalWaterFountainBrowserHarness(): Promise<{
  packageVersion: string;
  continuousEmittedParticles: number;
  emitterChangedPixels: number[];
  arcingChangedPixels: number;
  customImageLocators: string[];
  emitterMappings: ReturnType<typeof resolveEmitterMappings>;
  retunedEmitterMappings: ReturnType<typeof resolveEmitterMappings>;
  burstRecords: BurstRecord[];
  duplicateBurstRejected: boolean;
  replayBurstAccepted: boolean;
  disabledEmitterRemainsIsolated: boolean;
  activeEmittersAfterRemoval: number;
  removedSceneEmissionDelta: number;
  frameDataUrl: string;
}> {
  const app = new Application();
  await app.init({ width: 900, height: 620, backgroundColor: 0x0d1721, antialias: true, preference: "webgl" });
  app.ticker.stop();
  document.body.appendChild(app.canvas);
  const effects = await TopDownEffects.create({ seed: 41023 });
  const upsertRequests: Array<{ id: string; enabled: boolean }> = [];
  const upsertCatalogEffect = effects.upsertCatalogEffect.bind(effects);
  effects.upsertCatalogEffect = (request) => {
    upsertRequests.push({ id: request.id, enabled: request.enabled !== false });
    upsertCatalogEffect(request);
  };
  const background = new Graphics().rect(0, 0, 900, 620).fill(0x0d1721);
  const floor = new Graphics().rect(0, 400, 900, 220).fill(0x152431);
  const basin = new Graphics().circle(450, 400, 62).fill(0x286176);
  const fountainCore = new Graphics().circle(450, 400, 22).fill(0x58d8ef);
  const arcPad = new Graphics().circle(780, 404, 24).fill(0x554d20);
  const emitterPads = fountainEmitters.map(({ x, y }, index) => new Graphics().circle(x, y, 7).fill([0x62e8ff, 0xb6ff6a, 0xff9b70, 0xd59cff][index]));
  app.stage.addChild(background, floor, basin, fountainCore, arcPad, ...emitterPads, effects.preLight, effects.postLight);

  const customImageLocators: string[] = [];
  const customArtCanvas = document.createElement("canvas");
  customArtCanvas.width = 12;
  customArtCanvas.height = 12;
  const customArtContext = customArtCanvas.getContext("2d");
  if (!customArtContext) throw new Error("Could not create the custom fountain art fixture.");
  customArtContext.fillStyle = "#5ce1ff";
  customArtContext.beginPath();
  customArtContext.ellipse(6, 6, 3, 5, 0, 0, Math.PI * 2);
  customArtContext.fill();
  const diagnostics: Array<{ message: string; details?: unknown }> = [];
  const controller = new ParticleEffectSceneController(effects, (_level, message, details) => {
    diagnostics.push({ message, details: typeof details === "function" ? (details as () => unknown)() : details });
  }, async (relativeLocator) => {
    customImageLocators.push(relativeLocator);
    return customArtCanvas.toDataURL("image/png");
  });

  controller.reconcile(makeSnapshot(fountainEmitters, arcTuning));
  await new Promise((resolve) => setTimeout(resolve, 40));
  controller.reconcile(makeSnapshot(fountainEmitters, arcTuning));
  app.renderer.render(app.stage);
  const baseline = app.renderer.extract.pixels({ target: app.stage }) as unknown as PixelFrame;
  for (let frame = 0; frame <= 90; frame += 1) {
    controller.update(frame / 60);
    if (frame % 10 === 0) app.renderer.render(app.stage);
  }
  app.renderer.render(app.stage);
  const continuousFrame = app.renderer.extract.pixels({ target: app.stage }) as unknown as PixelFrame;
  const continuousEmittedParticles = effects.getStats().emittedParticles;
  const emitterChangedPixels = fountainEmitters.map(({ x, y }) => changedPixelsNear(continuousFrame, baseline, x, y - 48));
  const arcingChangedPixels = changedPixelsNear(continuousFrame, baseline, 780, 350);
  const emitterMappings = resolveEmitterMappings(fountainEmitters);

  const retunedEmitters = fountainEmitters.map((emitter, index) => index === 0
    ? { ...emitter, tuning: { ...emitter.tuning, DirectionDegrees: 0, AccelerationXPxPerSecond2: 85, AccelerationYPxPerSecond2: -90 } }
    : emitter);
  controller.reconcile(makeSnapshot(retunedEmitters, arcTuning));
  controller.update(20);
  const retunedEmitterMappings = resolveEmitterMappings(retunedEmitters);

  const fountainBursts = retunedEmitters.map((emitter, index) => ({
    id: `fixture-${emitter.id}-surge-1`, sourceObjectId: emitter.id, effectKey: fountain.effectKey,
    x: emitter.x, y: emitter.y, quantityMultiplier: 1, enabled: true, order: index,
    tuning: emitter.tuning
  }));
  const arcBurst = {
    id: "fixture-arc-surge-1", sourceObjectId: "arcing", effectKey: arcing.effectKey,
    x: 780, y: 400, quantityMultiplier: 1, enabled: true, order: 4, tuning: arcTuning
  };
  const bursts = [...fountainBursts, arcBurst];
  controller.reconcile(makeSnapshot(retunedEmitters, arcTuning, bursts));
  const firstBurstRecords = diagnostics
    .filter(({ message }) => message === "Particle burst stream emission result.")
    .map(({ details }) => details as BurstRecord);
  controller.reconcile(makeSnapshot(retunedEmitters, arcTuning, bursts));
  const duplicateBurstRejected = diagnostics.some(({ message, details }) =>
    message === "Rejected duplicate particle burst delivery."
    && (details as { burstId?: string } | undefined)?.burstId === bursts[0].id);

  const replayBursts = bursts.map((burst) => ({ ...burst, id: `${burst.id}-replay` }));
  const replayEmittedBefore = effects.getStats().emittedParticles;
  controller.reconcile(makeSnapshot(retunedEmitters, arcTuning, replayBursts));
  controller.reconcile(makeSnapshot(retunedEmitters, arcTuning, replayBursts));
  const replayBurstAccepted = effects.getStats().emittedParticles >= replayEmittedBefore + 56;

  const disabledSnapshot = makeSnapshot(retunedEmitters, arcTuning, [], new Set([retunedEmitters[0].id]));
  controller.reconcile(disabledSnapshot);
  const disabledEmitter = upsertRequests.slice().reverse().find(({ id }) => id === `object:${retunedEmitters[0].id}`);
  const disabledEmitterRemainsIsolated = disabledEmitter?.enabled === false
    && retunedEmitters.slice(1).every(({ id }) => upsertRequests.slice().reverse().find((request) => request.id === `object:${id}`)?.enabled === true);
  controller.reconcile(makeSnapshot([], arcTuning, [], new Set(), false));
  const emittedBeforeRemovedUpdate = effects.getStats().emittedParticles;
  controller.update(21);
  const removedSceneEmissionDelta = effects.getStats().emittedParticles - emittedBeforeRemovedUpdate;
  const activeEmittersAfterRemoval = effects.getStats().activeEmitters;

  const frameDataUrl = toDataUrl(continuousFrame);
  controller.dispose();
  effects.dispose();
  app.destroy(true);

  return {
    packageVersion: "1.0.4",
    continuousEmittedParticles,
    emitterChangedPixels,
    arcingChangedPixels,
    customImageLocators,
    emitterMappings,
    retunedEmitterMappings,
    burstRecords: firstBurstRecords,
    duplicateBurstRejected,
    replayBurstAccepted,
    disabledEmitterRemainsIsolated,
    activeEmittersAfterRemoval,
    removedSceneEmissionDelta,
    frameDataUrl
  };
}
