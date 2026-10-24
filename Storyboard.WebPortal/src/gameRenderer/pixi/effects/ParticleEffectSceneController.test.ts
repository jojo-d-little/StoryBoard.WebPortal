import { describe, expect, it, vi } from "vitest";
import { Assets, type Texture } from "pixi.js";
import type { TopDownEffects, CatalogParticleEffect, CatalogParticleRecipe } from "@jojo-d-little/storyboard-particles";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import { ParticleEffectSceneController } from "./ParticleEffectSceneController";

function stream(id: string, surgeOnly = false) {
  return {
    id,
    textureId: "smoke",
    layer: "pre-light" as const,
    ratePerSecond: 0,
    surgeOnly,
    spawn: { kind: "point" as const, radiusPx: 0 },
    lifeMinSeconds: 1,
    lifeMaxSeconds: 1,
    velocityXMinPxPerSecond: 0,
    velocityXMaxPxPerSecond: 0,
    velocityYMinPxPerSecond: 0,
    velocityYMaxPxPerSecond: 0,
    startWidthPx: 2,
    startHeightPx: 2,
    startColor: "#ffffff"
  };
}

const catalogEffect = {
  category: "ParticleEffect",
  effectKey: "point.test.sparks",
  displayName: "Sparks",
  particleEffect: {
    recipe: {
      renderingMode: "point",
      family: "sparks",
      lifecycle: { transitionTimeMs: 0, removalDurationMs: null },
      streams: [stream("spark", true), stream("continuous", false)]
    },
    imageSlots: { spark: "spark-glow" }
  }
} as CatalogParticleEffect;

function scene(overrides: Partial<GameRenderSceneSnapshot> = {}): GameRenderSceneSnapshot {
  return {
    roomId: "room-1",
    displayMode: "composed",
    bounds: { width: 640, height: 400 },
    directionalOverlays: [],
    objectsById: {},
    particleEffectCatalog: [catalogEffect],
    ...overrides
  };
}

function buildEffects() {
  return {
    clear: vi.fn(),
    setRoomGeometry: vi.fn(),
    registerCatalogEffect: vi.fn(),
    upsertCatalogEffect: vi.fn(),
    remove: vi.fn(),
    emitBurst: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn()
  } as unknown as TopDownEffects;
}

describe("ParticleEffectSceneController", () => {
  it("registers recipes and reconciles object and room instances with stable namespaced IDs", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    controller.reconcile(scene({
      objectsById: {
        "object-1": {
          objectId: "object-1",
          objectName: "Torch",
          activePresentationCues: [],
          particleEffect: {
            id: "object-1", effectKey: catalogEffect.effectKey,
            x: 12, y: 24, enabled: true, order: 30, tuning: { EmissionRateMultiplier: 2 }
          }
        }
      },
      environmentalParticleEffects: [{
        id: "room-effect-1", effectKey: catalogEffect.effectKey,
        enabled: true, order: 4, tuning: {}
      }]
    }));

    expect(effects.setRoomGeometry).toHaveBeenCalledWith({ widthPx: 640, heightPx: 400, cellSizePx: 1 });
    expect(effects.registerCatalogEffect).toHaveBeenCalledWith(catalogEffect);
    expect(effects.upsertCatalogEffect).toHaveBeenCalledWith(expect.objectContaining({
      id: "object:object-1", xPx: 12, yPx: 24, order: 30,
      tuning: { EmissionRateMultiplier: 2 }
    }));
    expect(effects.upsertCatalogEffect).toHaveBeenCalledWith(expect.objectContaining({ id: "room:room-effect-1", order: 4 }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Particle effect scene reconciled.", expect.objectContaining({
      registeredCatalogEffectCount: 1,
      requestedInstanceCount: 2,
      activeRequestedInstanceCount: 2,
      acceptedInstanceCount: 2,
      acceptedEnabledInstanceCount: 2,
      geometry: { width: 640, height: 400, ready: true }
    }));

    controller.reconcile(scene());
    expect(effects.remove).toHaveBeenCalledWith("object:object-1");
    expect(effects.remove).toHaveBeenCalledWith("room:room-effect-1");
  });

  it("demand loads a mapped image for only its effect and falls back to packaged art after a miss", async () => {
    const effects = buildEffects();
    const loadImage = vi.fn(async () => null);
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics, loadImage);
    const mappedScene = scene({
      particleEffectImageMappings: [{ effectKey: catalogEffect.effectKey, imageSlot: "spark", relativeLocator: "custom/spark.png" }],
      objectsById: {
        "object-1": {
          objectId: "object-1", objectName: "Torch", activePresentationCues: [],
          particleEffect: { id: "object-1", effectKey: catalogEffect.effectKey, enabled: true, order: 1, tuning: {} }
        },
        "object-2": { objectId: "object-2", objectName: "Lantern", activePresentationCues: [] }
      }
    });

    controller.reconcile(mappedScene);
    expect(loadImage).toHaveBeenCalledWith("custom/spark.png");
    expect(effects.upsertCatalogEffect).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(effects.upsertCatalogEffect).toHaveBeenCalledWith(expect.objectContaining({ id: "object:object-1" })));
    expect(diagnostics).toHaveBeenCalledWith("warning", expect.stringContaining("packaged image slots"), expect.anything());
    controller.dispose();
  });

  it("reuses one decoded texture when multiple mapped slots share a locator", async () => {
    const effects = buildEffects() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    effects.registerPointStyle = vi.fn();
    const texture = { destroy: vi.fn() } as unknown as Texture;
    const loadTexture = vi.spyOn(Assets, "load").mockResolvedValue(texture as never);
    const loadImage = vi.fn(async () => "data:image/png;base64,AA==");
    const controller = new ParticleEffectSceneController(effects as unknown as TopDownEffects, undefined, loadImage);
    const multiSlotEffect = {
      ...catalogEffect,
      particleEffect: { ...catalogEffect.particleEffect, imageSlots: { spark: "spark-glow", smoke: "smoke-soft" } }
    } as CatalogParticleEffect;
    controller.reconcile(scene({
      particleEffectCatalog: [multiSlotEffect],
      particleEffectImageMappings: [
        { effectKey: catalogEffect.effectKey, imageSlot: "spark", relativeLocator: "custom/shared.png" },
        { effectKey: catalogEffect.effectKey, imageSlot: "smoke", relativeLocator: "custom/shared.png" }
      ],
      environmentalParticleEffects: [{ id: "effect-1", effectKey: catalogEffect.effectKey, enabled: true, order: 0, tuning: {} }]
    }));
    await vi.waitFor(() => expect(effects.registerPointStyle).toHaveBeenCalled());
    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(loadTexture).toHaveBeenCalledTimes(1);
    const overrides = effects.registerPointStyle.mock.calls[0][1] as Record<string, Texture>;
    expect(overrides["spark-glow"]).toBe(texture);
    expect(overrides["smoke-soft"]).toBe(texture);
    controller.dispose();
    expect(texture.destroy).toHaveBeenCalledTimes(1);
    loadTexture.mockRestore();
  });

  it("deduplicates burst IDs, emits only surge-only streams, and diagnoses late room events", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const burst = {
      id: "burst-1", sourceObjectId: "source-1", roomId: "room-1",
      effectKey: catalogEffect.effectKey, x: 25, y: 35, enabled: true, order: 0, tuning: {}
    };
    controller.reconcile(scene({ particleEffectBursts: [burst, burst] }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(1);
    expect(effects.emitBurst).toHaveBeenCalledWith(expect.objectContaining({
      id: "burst-1:spark", effectId: catalogEffect.effectKey, streamId: "spark", xPx: 25, yPx: 35
    }));

    controller.reconcile(scene({ particleEffectBursts: [{ ...burst, id: "late-1", roomId: "room-old" }] }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith("warning", expect.stringContaining("late particle burst"), expect.anything());
  });

  it("interpolates changed controls from current values over the recipe transition duration", () => {
    const effects = buildEffects();
    const controller = new ParticleEffectSceneController(effects);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const transitioningRecipe = {
      ...catalogEffect,
      particleEffect: {
        ...catalogEffect.particleEffect,
        recipe: { ...(catalogEffect.particleEffect.recipe as CatalogParticleRecipe), lifecycle: { transitionTimeMs: 1000 } }
      }
    } as CatalogParticleEffect;
    const object = (multiplier: number) => ({
      objectId: "object-1", objectName: "Torch", activePresentationCues: [],
      particleEffect: {
        id: "object-1", effectKey: transitioningRecipe.effectKey,
        enabled: true, order: 0, tuning: { EmissionRateMultiplier: multiplier }
      }
    });
    controller.reconcile(scene({ particleEffectCatalog: [transitioningRecipe], objectsById: { "object-1": object(1) } }));
    controller.reconcile(scene({ particleEffectCatalog: [transitioningRecipe], objectsById: { "object-1": object(3) } }));
    controller.update(1.5);

    expect(effects.upsertCatalogEffect).toHaveBeenLastCalledWith(expect.objectContaining({
      id: "object:object-1",
      tuning: { EmissionRateMultiplier: 2 }
    }));
    now.mockRestore();
  });
});
