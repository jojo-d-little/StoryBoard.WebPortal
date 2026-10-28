import { describe, expect, it, vi } from "vitest";
import { Assets, type Texture } from "pixi.js";
import type { TopDownEffects, CatalogParticleEffect, CatalogParticleRecipe } from "@jojo-d-little/storyboard-particles";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import { ParticleEffectSceneController } from "./ParticleEffectSceneController";

function stream(id: string, surgeOnly = false, burstCount?: number) {
  return {
    id,
    textureId: "smoke",
    layer: "pre-light" as const,
    ratePerSecond: 0,
    surgeOnly,
    ...(burstCount === undefined ? {} : { burstCount }),
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
      streams: [stream("spark", true, 5), stream("continuous", false)]
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

function buildEffects(onBurst?: (request: { count: number; streamId?: string }, emit: () => void) => void) {
  const stats = {
    liveParticles: 0,
    emittedParticles: 0,
    droppedParticles: 0,
    activeEmitters: 0,
    atmosphereFields: 0,
    stains: 0,
    allocationFailures: { particleCapacity: 0, stainCapacity: 0, total: 0 }
  };
  return {
    clear: vi.fn(),
    setRoomGeometry: vi.fn(),
    registerCatalogEffect: vi.fn(),
    upsertCatalogEffect: vi.fn(),
    remove: vi.fn(),
    emitBurst: vi.fn((request: { count: number; streamId?: string }) => {
      const emit = () => {
        stats.liveParticles += request.count;
        stats.emittedParticles += request.count;
      };
      if (onBurst) onBurst(request, emit);
      else emit();
    }),
    getStats: vi.fn(() => ({ ...stats, allocationFailures: { ...stats.allocationFailures } })),
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

  it("accepts RoomId-free bursts without room-membership filtering and deduplicates IDs", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const burst = {
      id: "burst-1", sourceObjectId: "source-1",
      effectKey: catalogEffect.effectKey, x: 25, y: 35, quantityMultiplier: 1, enabled: true, order: 0, tuning: {}
    };
    controller.reconcile(scene({ particleEffectBursts: [burst, burst] }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(1);
    expect(effects.emitBurst).toHaveBeenCalledWith(expect.objectContaining({
      id: "burst-1:spark:0", effectId: catalogEffect.effectKey, streamId: "spark", xPx: 25, yPx: 35
    }));

    controller.reconcile(scene({ roomId: "room-2", particleEffectBursts: [{ ...burst, id: "delivered-after-room-swap" }] }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(2);
    expect(diagnostics).not.toHaveBeenCalledWith("warning", expect.stringContaining("late particle burst"), expect.anything());
  });

  it("reports per-stream emission statistics and accepts distinct sources at their current anchors", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const bursts = [
      { id: "burst-a", sourceObjectId: "source-a", effectKey: catalogEffect.effectKey, x: 25, y: 35, quantityMultiplier: 1, enabled: true, order: 0, tuning: {} },
      { id: "burst-b", sourceObjectId: "source-b", effectKey: catalogEffect.effectKey, x: 120, y: 90, quantityMultiplier: 1, enabled: true, order: 0, tuning: {} }
    ];

    controller.reconcile(scene({ particleEffectBursts: bursts }));

    expect(effects.emitBurst).toHaveBeenCalledTimes(2);
    expect(effects.emitBurst).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "burst-a:spark:0", xPx: 25, yPx: 35 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "burst-b:spark:0", xPx: 120, yPx: 90 }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Particle burst stream emission result.", expect.objectContaining({
      burstId: "burst-a", streamId: "spark", requestedCount: 5, emittedParticleCount: 5, liveParticleCount: 5, outcome: "emitted"
    }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Accepted particle burst occurrence.", expect.objectContaining({
      burstId: "burst-b", sourceObjectId: "source-b", outcome: "all-streams-completed"
    }));
  });

  it("uses the canonical count resolver once per stream, including its rounding and zero rules", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const burst = (id: string, quantityMultiplier: number) => ({
      id, sourceObjectId: "source", effectKey: catalogEffect.effectKey,
      quantityMultiplier, x: 20, y: 30, enabled: true, order: 0, tuning: {}
    });

    controller.reconcile(scene({ particleEffectBursts: [burst("half", 0.5), burst("normal", 1), burst("double", 2)] }));

    expect(effects.emitBurst).toHaveBeenCalledTimes(3);
    expect(effects.emitBurst).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "half:spark:0", count: 3 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "normal:spark:0", count: 5 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: "double:spark:0", count: 10 }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Particle burst stream emission result.", expect.objectContaining({
      burstId: "half", baselineBurstCount: 5, quantityMultiplier: 0.5, requestedCount: 3, emittedParticleCount: 3
    }));

    controller.reconcile(scene({ particleEffectBursts: [burst("zero", 0)] }));
    controller.reconcile(scene({ particleEffectBursts: [burst("zero", 0)] }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(3);
    expect(diagnostics).toHaveBeenCalledWith("info", "Particle burst stream resolved to zero particles.", expect.objectContaining({
      burstId: "zero", requestedCount: 0, outcome: "zero-count-completed"
    }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Accepted particle burst occurrence.", expect.objectContaining({
      burstId: "zero", outcome: "all-streams-completed"
    }));
  });

  it("completes independent surge streams with their own recipe counts", () => {
    const effects = buildEffects();
    const controller = new ParticleEffectSceneController(effects);
    const multipleStreams = {
      ...catalogEffect,
      particleEffect: {
        ...catalogEffect.particleEffect,
        recipe: { ...(catalogEffect.particleEffect.recipe as CatalogParticleRecipe), streams: [
          stream("spark", true, 2), stream("shard", true, 4), stream("continuous", false)
        ] }
      }
    } as CatalogParticleEffect;

    controller.reconcile(scene({
      particleEffectCatalog: [multipleStreams],
      particleEffectBursts: [{ id: "multi", sourceObjectId: "source", effectKey: multipleStreams.effectKey, quantityMultiplier: 0.5, x: 7, y: 9, enabled: true, order: 0, tuning: {} }]
    }));

    expect(effects.emitBurst).toHaveBeenCalledTimes(2);
    expect(effects.emitBurst).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "multi:spark:0", count: 1 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "multi:shard:0", count: 2 }));
  });

  it("does not re-emit a completed stream when another stream retries", () => {
    let failShardOnce = true;
    const effects = buildEffects((request, emit) => {
      if (request.streamId === "shard" && failShardOnce) {
        failShardOnce = false;
        throw new Error("shard texture unavailable");
      }
      emit();
    });
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const multipleStreams = {
      ...catalogEffect,
      particleEffect: {
        ...catalogEffect.particleEffect,
        recipe: { ...(catalogEffect.particleEffect.recipe as CatalogParticleRecipe), streams: [
          stream("spark", true, 2), stream("shard", true, 3)
        ] }
      }
    } as CatalogParticleEffect;
    const burst = {
      id: "independent-stream-retry", sourceObjectId: "source", effectKey: multipleStreams.effectKey,
      quantityMultiplier: 1, x: 7, y: 9, enabled: true, order: 0, tuning: {}
    };
    const burstScene = scene({ particleEffectCatalog: [multipleStreams], particleEffectBursts: [burst] });

    controller.reconcile(burstScene);
    controller.reconcile(burstScene);

    expect(effects.emitBurst).toHaveBeenCalledTimes(3);
    expect(effects.emitBurst).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "independent-stream-retry:spark:0", count: 2 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "independent-stream-retry:shard:0", count: 3 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: "independent-stream-retry:shard:1", count: 3 }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Accepted particle burst occurrence.", expect.objectContaining({
      burstId: "independent-stream-retry", outcome: "all-streams-completed"
    }));
  });

  it("treats an invalid recipe count as terminal and does not retry it", () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const invalidEffect = {
      ...catalogEffect,
      particleEffect: {
        ...catalogEffect.particleEffect,
        recipe: { ...(catalogEffect.particleEffect.recipe as CatalogParticleRecipe), streams: [stream("spark", true, Number.MAX_SAFE_INTEGER + 1)] }
      }
    } as CatalogParticleEffect;
    const invalidBurst = { id: "invalid", sourceObjectId: "source", effectKey: invalidEffect.effectKey, x: 0, y: 0, quantityMultiplier: 1, enabled: true, order: 0, tuning: {} };
    const invalidScene = scene({ particleEffectCatalog: [invalidEffect], particleEffectBursts: [invalidBurst] });

    controller.reconcile(invalidScene);
    controller.reconcile(invalidScene);

    expect(effects.emitBurst).not.toHaveBeenCalled();
    expect(diagnostics).toHaveBeenCalledWith("warning", expect.stringContaining("terminal invalid count"), expect.objectContaining({
      burstId: "invalid", outcome: "terminal-invalid-count"
    }));
  });

  it("keeps a failed burst retryable and logs the exception", () => {
    const effects = buildEffects();
    const emitBurst = vi.mocked(effects.emitBurst);
    emitBurst.mockImplementationOnce(() => { throw new Error("texture group failed"); });
    const diagnostics = vi.fn();
    const controller = new ParticleEffectSceneController(effects, diagnostics);
    const burst = {
      id: "retry-burst", sourceObjectId: "source-1",
      effectKey: catalogEffect.effectKey, x: 25, y: 35, quantityMultiplier: 1, enabled: true, order: 0, tuning: {}
    };
    const burstScene = scene({ particleEffectBursts: [burst] });

    controller.reconcile(burstScene);
    controller.reconcile(burstScene);

    expect(emitBurst).toHaveBeenCalledTimes(2);
    expect((emitBurst.mock.calls[0][0] as { id: string }).id).toBe("retry-burst:spark:0");
    expect((emitBurst.mock.calls[1][0] as { id: string }).id).toBe("retry-burst:spark:1");
    expect(diagnostics).toHaveBeenCalledWith("warning", expect.stringContaining("remains retryable"), expect.objectContaining({
      burstId: "retry-burst", error: "texture group failed", outcome: "failed"
    }));
    expect(diagnostics).toHaveBeenCalledWith("info", "Accepted particle burst occurrence.", expect.objectContaining({ burstId: "retry-burst" }));
  });

  it("retains a burst across a custom-image load after a later scene snapshot omits it", async () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    let resolveImage!: (url: string | null) => void;
    const loadImage = vi.fn(() => new Promise<string | null>((resolve) => { resolveImage = resolve; }));
    const controller = new ParticleEffectSceneController(effects, diagnostics, loadImage);
    const burst = {
      id: "custom-burst", sourceObjectId: "source-1", quantityMultiplier: 0.5,
      effectKey: catalogEffect.effectKey, x: 25, y: 35, enabled: true, order: 0, tuning: {}
    };
    const mappedScene = scene({
      particleEffectImageMappings: [{ effectKey: catalogEffect.effectKey, imageSlot: "spark", relativeLocator: "custom/spark.png" }],
      particleEffectBursts: [burst]
    });

    controller.reconcile(mappedScene);
    expect(effects.emitBurst).not.toHaveBeenCalled();
    controller.reconcile(scene({
      particleEffectImageMappings: mappedScene.particleEffectImageMappings,
      particleEffectBursts: []
    }));
    resolveImage(null);
    await vi.waitFor(() => expect(effects.emitBurst).toHaveBeenCalledTimes(1));
    expect(diagnostics).toHaveBeenCalledWith("info", "Deferred particle burst while custom art loads.", expect.objectContaining({ burstId: "custom-burst" }));
    expect(effects.emitBurst).toHaveBeenCalledWith(expect.objectContaining({ effectId: catalogEffect.effectKey, xPx: 25, yPx: 35, count: 3 }));
    controller.dispose();
  });

  it("processes packaged siblings and independently retains multiple cold-art bursts across an empty snapshot", async () => {
    const effects = buildEffects() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    effects.registerPointStyle = vi.fn();
    const textureA = { destroy: vi.fn() } as unknown as Texture;
    const textureB = { destroy: vi.fn() } as unknown as Texture;
    const loadTexture = vi.spyOn(Assets, "load").mockImplementation((url) => Promise.resolve(
      String(url).includes("AA==") ? textureA : textureB
    ) as never);
    const resolves = new Map<string, (url: string | null) => void>();
    const loadImage = vi.fn((locator: string) => new Promise<string | null>((resolve) => resolves.set(locator, resolve)));
    const controller = new ParticleEffectSceneController(effects as unknown as TopDownEffects, undefined, loadImage);
    const customA = { ...catalogEffect, effectKey: "point.test.custom-a" } as CatalogParticleEffect;
    const customB = { ...catalogEffect, effectKey: "point.test.custom-b" } as CatalogParticleEffect;
    const packaged = { ...catalogEffect, effectKey: "point.test.packaged" } as CatalogParticleEffect;
    const mappings = [
      { effectKey: customA.effectKey, imageSlot: "spark", relativeLocator: "custom/a.png" },
      { effectKey: customB.effectKey, imageSlot: "spark", relativeLocator: "custom/b.png" }
    ];
    const burst = (id: string, effectKey: string, quantityMultiplier: number) => ({
      id, sourceObjectId: id, effectKey, x: 100, y: 100, quantityMultiplier,
      enabled: true, order: 0, tuning: {}
    });
    const batchScene = scene({
      particleEffectCatalog: [customA, packaged, customB],
      particleEffectImageMappings: mappings,
      particleEffectBursts: [
        burst("custom-a", customA.effectKey, 0.5),
        burst("packaged-ready", packaged.effectKey, 1),
        burst("custom-b", customB.effectKey, 2),
        burst("custom-a", customA.effectKey, 0.5),
        burst("packaged-ready", packaged.effectKey, 1)
      ]
    });
    const emptySnapshot = scene({
      particleEffectCatalog: [customA, packaged, customB],
      particleEffectImageMappings: mappings,
      particleEffectBursts: []
    });

    controller.reconcile(batchScene);
    expect(loadImage).toHaveBeenCalledTimes(2);
    expect(effects.emitBurst).toHaveBeenCalledTimes(1);
    expect(effects.emitBurst).toHaveBeenCalledWith(expect.objectContaining({ id: "packaged-ready:spark:0", count: 5 }));
    controller.reconcile(emptySnapshot);

    resolves.get("custom/b.png")!("data:image/png;base64,AQ==");
    await vi.waitFor(() => expect(effects.emitBurst).toHaveBeenCalledTimes(2));
    resolves.get("custom/a.png")!("data:image/png;base64,AA==");
    await vi.waitFor(() => expect(effects.emitBurst).toHaveBeenCalledTimes(3));
    controller.reconcile(batchScene);

    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "custom-b:spark:0", count: 10 }));
    expect(effects.emitBurst).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: "custom-a:spark:0", count: 3 }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(3);
    controller.dispose();
    loadTexture.mockRestore();
  });

  it("uses packaged fallback after cold-art failure without losing or duplicating a ready sibling", async () => {
    const effects = buildEffects();
    const diagnostics = vi.fn();
    const loadImage = vi.fn(async () => null);
    const controller = new ParticleEffectSceneController(effects, diagnostics, loadImage);
    const custom = { ...catalogEffect, effectKey: "point.test.custom-fallback" } as CatalogParticleEffect;
    const packaged = { ...catalogEffect, effectKey: "point.test.packaged-fallback-sibling" } as CatalogParticleEffect;
    const mappings = [{ effectKey: custom.effectKey, imageSlot: "spark", relativeLocator: "custom/missing.png" }];
    const bursts = [
      { id: "fallback-custom", sourceObjectId: "custom-source", effectKey: custom.effectKey, x: 20, y: 30, quantityMultiplier: 0.5, enabled: true, order: 0, tuning: {} },
      { id: "ready-sibling", sourceObjectId: "packaged-source", effectKey: packaged.effectKey, x: 40, y: 50, quantityMultiplier: 1, enabled: true, order: 0, tuning: {} }
    ];
    const mixedScene = scene({ particleEffectCatalog: [custom, packaged], particleEffectImageMappings: mappings, particleEffectBursts: bursts });

    controller.reconcile(mixedScene);
    expect(effects.emitBurst).toHaveBeenCalledTimes(1);
    expect(effects.emitBurst).toHaveBeenCalledWith(expect.objectContaining({ id: "ready-sibling:spark:0", count: 5 }));
    await vi.waitFor(() => expect(effects.emitBurst).toHaveBeenCalledTimes(2));
    controller.reconcile(mixedScene);

    expect(effects.emitBurst).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "fallback-custom:spark:0", count: 3 }));
    expect(effects.emitBurst).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith("warning", expect.stringContaining("packaged image slots"), expect.anything());
    controller.dispose();
  });

  it("does not emit a deferred event when the surface is disposed before image completion", async () => {
    const effects = buildEffects() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    effects.registerPointStyle = vi.fn();
    const texture = { destroy: vi.fn() } as unknown as Texture;
    const loadTexture = vi.spyOn(Assets, "load").mockResolvedValue(texture as never);
    let resolveImage!: (url: string | null) => void;
    const loadImage = vi.fn(() => new Promise<string | null>((resolve) => { resolveImage = resolve; }));
    const controller = new ParticleEffectSceneController(effects as unknown as TopDownEffects, undefined, loadImage);
    const burst = {
      id: "disposed-cold-art", sourceObjectId: "source", effectKey: catalogEffect.effectKey,
      x: 20, y: 30, quantityMultiplier: 1, enabled: true, order: 0, tuning: {}
    };

    controller.reconcile(scene({
      particleEffectImageMappings: [{ effectKey: catalogEffect.effectKey, imageSlot: "spark", relativeLocator: "custom/disposed.png" }],
      particleEffectBursts: [burst]
    }));
    controller.dispose();
    resolveImage("data:image/png;base64,AA==");
    await vi.waitFor(() => expect(loadTexture).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(effects.emitBurst).not.toHaveBeenCalled();
    expect(effects.dispose).toHaveBeenCalledTimes(1);
    loadTexture.mockRestore();
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
