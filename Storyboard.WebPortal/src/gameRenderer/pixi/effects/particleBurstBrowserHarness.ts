import { Application, Graphics } from "pixi.js";
import { TopDownEffects, type CatalogParticleEffect } from "@jojo-d-little/storyboard-particles";
import { ParticleEffectSceneController } from "./ParticleEffectSceneController";

type ExtractedPixelFrame = { pixels: Uint8Array; width: number; height: number };

const sparkEffect: CatalogParticleEffect = {
  category: "ParticleEffect",
  effectKey: "particle.electrical-sparks",
  displayName: "electrical-sparks",
  particleEffect: {
    imageSlots: { fragment: "fragment" },
    recipe: {
      renderingMode: "point",
      family: "electrical-sparks",
      lifecycle: { transitionTimeMs: 0, removalDurationMs: null },
      streams: [{
        id: "particles",
        textureId: "fragment",
        layer: "post-light",
        blendMode: "add",
        ratePerSecond: 0,
        surgeOnly: true,
        burstCount: 16,
        spawn: { kind: "point", radiusPx: 1 },
        lifeMinSeconds: 0.12,
        lifeMaxSeconds: 0.3,
        velocityXMinPxPerSecond: -75,
        velocityXMaxPxPerSecond: 75,
        velocityYMinPxPerSecond: -75,
        velocityYMaxPxPerSecond: 75,
        startWidthPx: 4,
        startHeightPx: 2,
        endWidthPx: 1,
        endHeightPx: 1,
        startColor: "#fff7b0",
        endColor: "#4feaff",
        startAlpha: 1,
        endAlpha: 0,
        occludeByCells: true,
        isWindBlown: true,
        colorBinding: { control: "Colors", mode: "transition" }
      }]
    }
  }
};

export async function runParticleBurstBrowserHarness(): Promise<{
  changedPixelsNearBurst: number;
  changedPixelsAtMovedAnchor: number;
  changedPixelsAtSecondSource: number;
  changedPixelsTotal: number;
  statsAfterDuplicateDelivery: ReturnType<TopDownEffects["getStats"]>;
  statsAfterZeroCount: ReturnType<TopDownEffects["getStats"]>;
  changedPixelsAfterNaturalDecay: number;
  statsAfterEmit: ReturnType<TopDownEffects["getStats"]>;
  statsAfterDecay: ReturnType<TopDownEffects["getStats"]>;
  statsAfterCustomArtBurst: ReturnType<TopDownEffects["getStats"]>;
  customArtChangedPixels: number;
  mixedStatsAfterBatch: ReturnType<TopDownEffects["getStats"]>;
  mixedStatsAfterCustomReady: ReturnType<TopDownEffects["getStats"]>;
  mixedPackagedPixelsAfterBatch: number;
  mixedCustomPixelsAfterReady: number;
  mixedPackagedPixelsAfterReady: number;
  mixedBurstFrameDataUrl: string;
  pixelBufferLength: number;
  rendererCanvasDimensions: { width: number; height: number };
  extractedCenterRgba: number[];
  effectLayerState: { preLightChildren: number; postLightChildren: number; postLightVisible: boolean };
  burstFrameDataUrl: string;
  diagnostics: Array<{ level: "warning" | "info"; message: string; details?: unknown }>;
}> {
  const app = new Application();
  await app.init({
    width: 640,
    height: 400,
    backgroundColor: 0x101820,
    antialias: true,
    preference: "webgl"
  });
  app.ticker.stop();
  document.body.appendChild(app.canvas);

  const effects = await TopDownEffects.create({ seed: 37 });
  const background = new Graphics().rect(0, 0, 640, 400).fill(0x101820);
  app.stage.addChild(background, effects.preLight, effects.postLight);
  const diagnostics: Array<{ level: "warning" | "info"; message: string; details?: unknown }> = [];
  const controller = new ParticleEffectSceneController(effects, (level, message, details) => {
    diagnostics.push({ level, message, details });
  });
  const snapshot = (bursts: Array<{ id: string; sourceObjectId: string; effectKey: string; x: number; y: number; quantityMultiplier?: number; enabled: boolean; order: number; tuning: Record<string, never> }> = []) => ({
    roomId: "burst-room",
    displayMode: "composed" as const,
    bounds: { width: 640, height: 400 },
    directionalOverlays: [],
    objectsById: {},
    particleEffectCatalog: [sparkEffect],
    particleEffectBursts: bursts.map((burst) => ({ ...burst, quantityMultiplier: burst.quantityMultiplier ?? 1 }))
  });

  controller.reconcile(snapshot());
  app.renderer.render(app.stage);
  const before = app.renderer.extract.pixels({ target: app.stage }) as unknown as ExtractedPixelFrame;
  const firstBurst = {
    id: "browser-burst-1",
    sourceObjectId: "sample-sparks-a",
    effectKey: sparkEffect.effectKey,
    x: 180,
    y: 180,
    quantityMultiplier: 0.5,
    enabled: true,
    order: 0,
    tuning: {}
  };
  controller.reconcile(snapshot([firstBurst, {
    ...firstBurst,
    id: "browser-burst-moved-anchor",
    x: 240,
    quantityMultiplier: 1
  }, {
    ...firstBurst,
    id: "browser-burst-second-source",
    sourceObjectId: "sample-sparks-b",
    x: 500,
    quantityMultiplier: 2
  }, firstBurst]));
  controller.update(0);
  controller.update(0.05);
  app.renderer.render(app.stage);
  const after = app.renderer.extract.pixels({ target: app.stage }) as unknown as ExtractedPixelFrame;
  const statsAfterEmit = effects.getStats();

  const countChangedPixelsNearAgainst = (pixels: ExtractedPixelFrame, baseline: ExtractedPixelFrame, centerX: number, centerY: number): number => {
    let count = 0;
    for (let y = centerY - 40; y <= centerY + 40; y += 1) {
      for (let x = centerX - 40; x <= centerX + 40; x += 1) {
        const index = (y * 640 + x) * 4;
        const currentPixels = pixels.pixels;
        const baselinePixels = baseline.pixels;
        if (currentPixels[index] !== baselinePixels[index]
          || currentPixels[index + 1] !== baselinePixels[index + 1]
          || currentPixels[index + 2] !== baselinePixels[index + 2]
          || currentPixels[index + 3] !== baselinePixels[index + 3]) {
          count += 1;
        }
      }
    }
    return count;
  };
  const countChangedPixelsNear = (pixels: ExtractedPixelFrame, centerX: number, centerY: number): number =>
    countChangedPixelsNearAgainst(pixels, before, centerX, centerY);
  const changedPixelsNearBurst = countChangedPixelsNear(after, 180, 180);
  const changedPixelsAtMovedAnchor = countChangedPixelsNear(after, 240, 180);
  const changedPixelsAtSecondSource = countChangedPixelsNear(after, 500, 180);
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = after.width;
  frameCanvas.height = after.height;
  const frameContext = frameCanvas.getContext("2d");
  if (!frameContext) throw new Error("Could not create a 2D canvas for the extracted Pixi frame.");
  frameContext.putImageData(new ImageData(new Uint8ClampedArray(after.pixels), after.width, after.height), 0, 0);
  const burstFrameDataUrl = frameCanvas.toDataURL("image/png");
  const statsAfterDuplicateDelivery = effects.getStats();

  for (const timeSeconds of [0.25, 0.5, 0.75, 1, 1.25]) controller.update(timeSeconds);
  app.renderer.render(app.stage);
  const statsAfterDecay = effects.getStats();
  const afterDecay = app.renderer.extract.pixels({ target: app.stage }) as unknown as ExtractedPixelFrame;
  controller.reconcile(snapshot([{ ...firstBurst, id: "browser-burst-zero", quantityMultiplier: 0 }]));
  const statsAfterZeroCount = effects.getStats();
  const customArtCanvas = document.createElement("canvas");
  customArtCanvas.width = 4;
  customArtCanvas.height = 4;
  const customArtContext = customArtCanvas.getContext("2d");
  if (!customArtContext) throw new Error("Could not create the custom particle art fixture.");
  customArtContext.fillStyle = "#ff00ff";
  customArtContext.fillRect(0, 0, 4, 4);
  const customEffects = await TopDownEffects.create({ seed: 73 });
  app.stage.addChild(customEffects.preLight, customEffects.postLight);
  const customDiagnostics: typeof diagnostics = [];
  const customController = new ParticleEffectSceneController(
    customEffects,
    (level, message, details) => customDiagnostics.push({ level, message, details }),
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return customArtCanvas.toDataURL("image/png");
    }
  );
  const customBurst = { ...firstBurst, id: "browser-custom-art-burst", x: 320, y: 200 };
  customController.reconcile({
    ...snapshot([customBurst]),
    particleEffectImageMappings: [{
      effectKey: sparkEffect.effectKey,
      imageSlot: "fragment",
      relativeLocator: "custom/spark.png"
    }]
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  customController.update(0.05);
  app.renderer.render(app.stage);
  const customFrame = app.renderer.extract.pixels({ target: app.stage }) as unknown as ExtractedPixelFrame;
  const customArtChangedPixels = countChangedPixelsNear(customFrame, 320, 200);
  const statsAfterCustomArtBurst = customEffects.getStats();
  diagnostics.push(...customDiagnostics);

  const mixedApp = new Application();
  await mixedApp.init({ width: 640, height: 400, backgroundColor: 0x101820, antialias: true, preference: "webgl" });
  mixedApp.ticker.stop();
  document.body.appendChild(mixedApp.canvas);
  const mixedEffects = await TopDownEffects.create({ seed: 89 });
  const mixedBackground = new Graphics().rect(0, 0, 640, 400).fill(0x101820);
  mixedApp.stage.addChild(mixedBackground, mixedEffects.preLight, mixedEffects.postLight);
  const mixedDiagnostics: typeof diagnostics = [];
  let resolveColdImage!: (dataUrl: string | null) => void;
  const mixedController = new ParticleEffectSceneController(
    mixedEffects,
    (level, message, details) => mixedDiagnostics.push({ level, message, details }),
    async () => new Promise<string | null>((resolve) => { resolveColdImage = resolve; })
  );
  const customSparkEffect: CatalogParticleEffect = { ...sparkEffect, effectKey: "particle.browser-cold-custom-sparks" };
  const packagedSparkEffect: CatalogParticleEffect = { ...sparkEffect, effectKey: "particle.browser-packaged-sparks" };
  const mixedSnapshot = (bursts: Array<{ id: string; sourceObjectId: string; effectKey: string; x: number; y: number; quantityMultiplier: number; enabled: boolean; order: number; tuning: Record<string, never> }> = []) => ({
    roomId: "mixed-burst-room",
    displayMode: "composed" as const,
    bounds: { width: 640, height: 400 },
    directionalOverlays: [],
    objectsById: {},
    particleEffectCatalog: [customSparkEffect, packagedSparkEffect],
    particleEffectImageMappings: [{
      effectKey: customSparkEffect.effectKey,
      imageSlot: "fragment",
      relativeLocator: "custom/cold-spark.png"
    }],
    particleEffectBursts: bursts
  });
  const coldCustomBurst = {
    id: "browser-mixed-cold-custom", sourceObjectId: "sample-custom-source",
    effectKey: customSparkEffect.effectKey, x: 180, y: 200,
    quantityMultiplier: 0.5, enabled: true, order: 0, tuning: {}
  };
  const packagedBurst = {
    id: "browser-mixed-packaged", sourceObjectId: "sample-packaged-source",
    effectKey: packagedSparkEffect.effectKey, x: 470, y: 200,
    quantityMultiplier: 1, enabled: true, order: 0, tuning: {}
  };
  mixedController.reconcile(mixedSnapshot());
  mixedApp.renderer.render(mixedApp.stage);
  const mixedBefore = mixedApp.renderer.extract.pixels({ target: mixedApp.stage }) as unknown as ExtractedPixelFrame;
  const mixedBursts = [coldCustomBurst, packagedBurst, coldCustomBurst, packagedBurst];
  mixedController.reconcile(mixedSnapshot(mixedBursts));
  const mixedStatsAfterBatch = mixedEffects.getStats();
  mixedController.reconcile(mixedSnapshot());
  mixedController.update(0.05);
  mixedApp.renderer.render(mixedApp.stage);
  const mixedPackagedFrame = mixedApp.renderer.extract.pixels({ target: mixedApp.stage }) as unknown as ExtractedPixelFrame;
  const mixedPackagedPixelsAfterBatch = countChangedPixelsNearAgainst(mixedPackagedFrame, mixedBefore, 470, 200);
  resolveColdImage(customArtCanvas.toDataURL("image/png"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  mixedController.reconcile(mixedSnapshot(mixedBursts));
  mixedController.update(0.1);
  mixedApp.renderer.render(mixedApp.stage);
  const mixedReadyFrame = mixedApp.renderer.extract.pixels({ target: mixedApp.stage }) as unknown as ExtractedPixelFrame;
  const mixedCustomPixelsAfterReady = countChangedPixelsNearAgainst(mixedReadyFrame, mixedBefore, 180, 200);
  const mixedPackagedPixelsAfterReady = countChangedPixelsNearAgainst(mixedReadyFrame, mixedBefore, 470, 200);
  const mixedFrameCanvas = document.createElement("canvas");
  mixedFrameCanvas.width = mixedReadyFrame.width;
  mixedFrameCanvas.height = mixedReadyFrame.height;
  const mixedFrameContext = mixedFrameCanvas.getContext("2d");
  if (!mixedFrameContext) throw new Error("Could not create a 2D canvas for the mixed burst frame.");
  mixedFrameContext.putImageData(new ImageData(new Uint8ClampedArray(mixedReadyFrame.pixels), mixedReadyFrame.width, mixedReadyFrame.height), 0, 0);
  const mixedBurstFrameDataUrl = mixedFrameCanvas.toDataURL("image/png");
  const mixedStatsAfterCustomReady = mixedEffects.getStats();
  diagnostics.push(...mixedDiagnostics);

  return {
    changedPixelsNearBurst,
    changedPixelsAtMovedAnchor,
    changedPixelsAtSecondSource,
    changedPixelsTotal: after.pixels.reduce((count, value, index) => {
      if (index % 4 === 3) return count;
      return count + (value === before.pixels[index] ? 0 : 1);
    }, 0),
    statsAfterDuplicateDelivery,
    statsAfterZeroCount,
    changedPixelsAfterNaturalDecay: countChangedPixelsNear(afterDecay, 180, 180)
      + countChangedPixelsNear(afterDecay, 240, 180)
      + countChangedPixelsNear(afterDecay, 500, 180),
    statsAfterEmit,
    statsAfterDecay,
    statsAfterCustomArtBurst,
    customArtChangedPixels,
    mixedStatsAfterBatch,
    mixedStatsAfterCustomReady,
    mixedPackagedPixelsAfterBatch,
    mixedCustomPixelsAfterReady,
    mixedPackagedPixelsAfterReady,
    mixedBurstFrameDataUrl,
    pixelBufferLength: after.pixels.length,
    rendererCanvasDimensions: { width: after.width, height: after.height },
    extractedCenterRgba: Array.from(after.pixels.slice((180 * after.width + 180) * 4, (180 * after.width + 180) * 4 + 4)),
    effectLayerState: { preLightChildren: effects.preLight.children.length, postLightChildren: effects.postLight.children.length, postLightVisible: effects.postLight.visible },
    burstFrameDataUrl,
    diagnostics
  };
}
