import {
  mapCatalogStreamOverrides,
  adaptCatalogParticleEffect,
  resolveCatalogRecipe,
  resolveBurstCount,
  resolveWindVector,
  TopDownEffects,
  type CatalogParticleEffect,
  type CatalogResolvedTuning,
  type CatalogRecipe
} from "@jojo-d-little/storyboard-particles";
import type { GameRenderParticleEffect, GameRenderParticleBurst } from "../../contracts/presentationEffects";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import { Assets, type Texture } from "pixi.js";

type Diagnostic = (level: "warning" | "info", message: string, details?: unknown) => void;
const sharedTextureUsers = new WeakMap<Texture, number>();

interface ParticleInstanceState {
  definition: CatalogParticleEffect;
  target: GameRenderParticleEffect;
  fromTuning: CatalogResolvedTuning;
  displayedTuning: CatalogResolvedTuning;
  transitionStartMs: number;
  transitionDurationMs: number;
}

function packageInstanceId(kind: "object" | "room", id: string): string {
  return `${kind}:${id}`;
}

function colorChannel(color: string, channel: number): number | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return null;
  return Number.parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16);
}

function interpolateColor(from: string, to: string, progress: number): string {
  const fromChannels = [0, 1, 2].map((channel) => colorChannel(from, channel));
  const toChannels = [0, 1, 2].map((channel) => colorChannel(to, channel));
  if (fromChannels.some((channel) => channel === null) || toChannels.some((channel) => channel === null)) {
    return progress >= 1 ? to : from;
  }
  return `#${fromChannels.map((channel, index) => Math.round(channel! + ((toChannels[index]! - channel!) * progress))
    .toString(16).padStart(2, "0")).join("")}`;
}

function baselineControl(recipe: CatalogRecipe, name: string): unknown {
  if (["EmissionRateMultiplier", "LifetimeMultiplier", "SizeMultiplier", "SpawnRadiusMultiplier", "CoverageMultiplier", "OpacityMultiplier", "WindSpeedMultiplier"].includes(name)) return 1;
  if (name === "WindDirectionOffsetDegrees") return 0;
  if (name === "WindDirectionDegrees") return recipe.renderingMode === "overlay" ? recipe.windDirectionDegrees : -1;
  if (name === "WindSpeedPxPerSecond") return recipe.renderingMode === "overlay" ? recipe.windSpeedPxPerSecond : 0;
  if (name === "Tint") return recipe.renderingMode === "overlay" ? recipe.tint : undefined;
  if (name === "DirectionDegrees") return recipe.renderingMode === "stain" ? recipe.directionDegrees : undefined;
  if (name === "Colors") {
    if (recipe.renderingMode === "stain") return { primary: recipe.colors.primary, secondary: recipe.colors.secondary };
    if (recipe.renderingMode === "point" || recipe.renderingMode === "room") {
      const stream = recipe.streams.find((candidate) => candidate.colorBinding?.control === "Colors");
      if (stream) return { primary: stream.startColor, secondary: stream.endColor ?? stream.startColor };
    }
  }
  return undefined;
}

function transitionTuning(from: CatalogResolvedTuning, target: CatalogResolvedTuning, recipe: CatalogRecipe, progress: number): CatalogResolvedTuning {
  if (progress >= 1) return target;
  const result: Record<string, unknown> = {};
  const left = from as Record<string, unknown>;
  const right = target as Record<string, unknown>;
  for (const name of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const fromValue = left[name] ?? baselineControl(recipe, name);
    const toValue = right[name] ?? baselineControl(recipe, name);
    if (typeof fromValue === "number" && typeof toValue === "number") {
      result[name] = fromValue + ((toValue - fromValue) * progress);
    } else if (name === "Colors" && fromValue && toValue
      && typeof fromValue === "object" && typeof toValue === "object") {
      const fromColors = fromValue as { primary?: string; secondary?: string };
      const toColors = toValue as { primary?: string; secondary?: string };
      result[name] = {
        primary: interpolateColor(fromColors.primary ?? "#ffffff", toColors.primary ?? "#ffffff", progress),
        secondary: interpolateColor(fromColors.secondary ?? fromColors.primary ?? "#ffffff", toColors.secondary ?? toColors.primary ?? "#ffffff", progress)
      };
    } else if (toValue !== undefined) {
      result[name] = toValue;
    }
  }
  if ((recipe.renderingMode === "point" || recipe.renderingMode === "room" || recipe.renderingMode === "overlay")
    && ("WindSpeedPxPerSecond" in left || "WindSpeedPxPerSecond" in right
      || "WindDirectionDegrees" in left || "WindDirectionDegrees" in right
      || "WindSpeedMultiplier" in left || "WindSpeedMultiplier" in right
      || "WindDirectionOffsetDegrees" in left || "WindDirectionOffsetDegrees" in right)) {
    const fromWind = resolveWindVector(recipe, from);
    const toWind = resolveWindVector(recipe, target);
    const x = fromWind.x + ((toWind.x - fromWind.x) * progress);
    const y = fromWind.y + ((toWind.y - fromWind.y) * progress);
    const speed = Math.hypot(x, y);
    result.WindSpeedPxPerSecond = speed;
    result.WindDirectionDegrees = speed <= 0.000001 ? -1 : (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    delete result.WindSpeedMultiplier;
    delete result.WindDirectionOffsetDegrees;
  }
  return result as CatalogResolvedTuning;
}

export class ParticleEffectSceneController {
  private readonly effects: TopDownEffects;
  private readonly diagnostics?: Diagnostic;
  private readonly registeredKeys = new Set<string>();
  private readonly activeIds = new Set<string>();
  private readonly instanceStates = new Map<string, ParticleInstanceState>();
  private readonly objectAnchorOverrides = new Map<string, { x: number; y: number }>();
  private readonly seenBurstIds = new Set<string>();
  private readonly pendingBursts = new Map<string, GameRenderParticleBurst>();
  private readonly completedBurstStreamIds = new Map<string, Set<string>>();
  private readonly burstStreamAttemptCounts = new Map<string, number>();
  private currentRoomId = "";
  private geometryKey = "";
  private geometryReady = false;
  private readonly loadImage?: (relativeLocator: string) => Promise<string | null>;
  private readonly pendingImageLoads = new Map<string, Promise<boolean>>();
  private readonly readyImageMappings = new Map<string, string>();
  private readonly failedImageMappings = new Set<string>();
  private latestScene: GameRenderSceneSnapshot | null = null;
  private readonly ownedTextures = new Set<Texture>();
  private readonly textureLoadJobs = new Map<string, Promise<Texture>>();
  private readonly decodedTexturesByLocator = new Map<string, Texture>();
  private lastReconcileDiagnosticSignature = "";
  private enabled = true;
  private disposed = false;

  constructor(effects: TopDownEffects, diagnostics?: Diagnostic, loadImage?: (relativeLocator: string) => Promise<string | null>) {
    this.effects = effects;
    this.diagnostics = diagnostics;
    this.loadImage = loadImage;
  }

  reconcile(scene: GameRenderSceneSnapshot): void {
    this.latestScene = scene;
    if (!this.enabled) return;
    const roomId = scene.roomId ?? "";
    let enteredRoom = false;
    const nextGeometryKey = `${scene.bounds.width}:${scene.bounds.height}:${scene.lighting?.cellSizePx ?? 0}`;
    if (roomId !== this.currentRoomId) {
      this.effects.clear();
      this.activeIds.clear();
      this.instanceStates.clear();
      this.currentRoomId = roomId;
      this.geometryKey = "";
      this.geometryReady = false;
      enteredRoom = true;
    }
    if (nextGeometryKey !== this.geometryKey) {
      this.effects.setRoomGeometry({
        widthPx: scene.bounds.width,
        heightPx: scene.bounds.height,
        cellSizePx: scene.lighting?.cellSizePx ?? 1
      });
      this.geometryKey = nextGeometryKey;
      this.geometryReady = true;
      this.activeIds.clear();
      if (enteredRoom) this.instanceStates.clear();
    }

    const catalog = new Map((scene.particleEffectCatalog ?? []).map((effect) => [effect.effectKey, effect]));
    for (const effect of catalog.values()) {
      if (this.registeredKeys.has(effect.effectKey)) continue;
      try {
        this.effects.registerCatalogEffect(effect);
        this.registeredKeys.add(effect.effectKey);
      } catch (error) {
        this.diagnostics?.("warning", "Could not register a particle catalog recipe.", {
          effectKey: effect.effectKey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const requested = new Map<string, GameRenderParticleEffect>();
    for (const object of Object.values(scene.objectsById)) {
      if (object.particleEffect) {
        requested.set(packageInstanceId("object", object.objectId), object.particleEffect);
      }
    }
    for (const effect of scene.environmentalParticleEffects ?? []) {
      requested.set(packageInstanceId("room", effect.id), effect);
    }

    const validIds = new Set<string>();
    const nowMs = performance.now();
    for (const [id, effect] of requested) {
      if (!this.registeredKeys.has(effect.effectKey)) {
        this.effects.remove(id);
        this.diagnostics?.("warning", "A particle effect instance references an unavailable catalog recipe.", {
          roomId,
          instanceId: effect.id,
          effectKey: effect.effectKey
        });
        continue;
      }
      const imageLoad = this.ensureCustomImages(effect.effectKey, catalog.get(effect.effectKey)!, scene);
      if (imageLoad) {
        this.effects.remove(id);
        this.instanceStates.delete(id);
        continue;
      }
      try {
        this.setInstanceTarget(id, effect, catalog.get(effect.effectKey)!, nowMs, enteredRoom);
        validIds.add(id);
      } catch (error) {
        this.effects.remove(id);
        this.diagnostics?.("warning", "Could not reconcile a particle effect instance.", {
          roomId,
          instanceId: effect.id,
          effectKey: effect.effectKey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    for (const id of this.activeIds) {
      if (!validIds.has(id)) {
        this.effects.remove(id);
        this.instanceStates.delete(id);
      }
    }
    this.activeIds.clear();
    for (const id of validIds) this.activeIds.add(id);

    // The Portal capture sink resolves lazy details only after checking that the
    // current capture/category filters accept this event. Reconcile can run on
    // every delta, so keep sorting/counting/serializing out of uncaptured frames.
    this.diagnostics?.("info", "Particle effect scene reconciled.", () => {
      const diagnosticState = {
        roomId,
        geometry: { width: scene.bounds.width, height: scene.bounds.height, ready: this.geometryReady },
        registeredCatalogEffectCount: this.registeredKeys.size,
        catalogEffectKeys: [...this.registeredKeys].sort(),
        requestedInstanceCount: requested.size,
        activeRequestedInstanceCount: [...requested.values()].filter((effect) => effect.enabled).length,
        acceptedInstanceCount: validIds.size,
        acceptedEnabledInstanceCount: [...validIds].filter((id) => requested.get(id)?.enabled).length,
        pendingCustomImageLoadCount: this.pendingImageLoads.size,
        burstCount: scene.particleEffectBursts?.length ?? 0
      };
      const diagnosticSignature = JSON.stringify(diagnosticState);
      if (diagnosticSignature === this.lastReconcileDiagnosticSignature) return undefined;
      this.lastReconcileDiagnosticSignature = diagnosticSignature;
      return diagnosticState;
    });

    this.flushPendingBursts();
    this.consumeBursts(scene.particleEffectBursts ?? [], catalog);
  }

  update(timeSeconds: number): void {
    if (!this.enabled || !this.geometryReady) return;

    const nowMs = timeSeconds * 1000;
    for (const [id, state] of this.instanceStates) {
      const recipe = state.definition.particleEffect.recipe;
      const progress = state.transitionDurationMs <= 0
        ? 1
        : Math.min(1, Math.max(0, (nowMs - state.transitionStartMs) / state.transitionDurationMs));
      state.displayedTuning = transitionTuning(state.fromTuning, state.target.tuning, recipe, progress);
      if (progress >= 1) state.fromTuning = state.target.tuning;
      const objectAnchor = id.startsWith("object:")
        ? this.objectAnchorOverrides.get(id.slice("object:".length))
        : undefined;
      this.upsert(id, state.target, state.displayedTuning, objectAnchor);
    }
    this.effects.update(timeSeconds);

  }

  startTimingAt(nowMs: number): void {
    for (const state of this.instanceStates.values()) state.transitionStartMs = nowMs;
  }

  clearRoom(): void {
    this.effects.clear();
    this.activeIds.clear();
    this.instanceStates.clear();
    this.geometryKey = "";
    this.geometryReady = false;
    this.objectAnchorOverrides.clear();
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clearRoom();
  }

  setObjectAnchorOverrides(anchors: ReadonlyMap<string, { x: number; y: number }>): void {
    this.objectAnchorOverrides.clear();
    for (const [objectId, anchor] of anchors) this.objectAnchorOverrides.set(objectId, anchor);
  }

  dispose(): void {
    this.disposed = true;
    this.latestScene = null;
    this.effects.dispose();
    for (const texture of this.ownedTextures) {
      const users = sharedTextureUsers.get(texture) ?? 1;
      if (users <= 1) {
        sharedTextureUsers.delete(texture);
        texture.destroy(true);
      } else {
        sharedTextureUsers.set(texture, users - 1);
      }
    }
    this.ownedTextures.clear();
    this.activeIds.clear();
    this.registeredKeys.clear();
    this.seenBurstIds.clear();
    this.pendingBursts.clear();
    this.completedBurstStreamIds.clear();
    this.burstStreamAttemptCounts.clear();
    this.readyImageMappings.clear();
    this.failedImageMappings.clear();
    this.pendingImageLoads.clear();
    this.textureLoadJobs.clear();
    this.decodedTexturesByLocator.clear();
    this.lastReconcileDiagnosticSignature = "";
  }

  private ensureCustomImages(effectKey: string, definition: CatalogParticleEffect, scene: GameRenderSceneSnapshot): boolean {
    const mappings = (scene.particleEffectImageMappings ?? []).filter((mapping) => mapping.effectKey === effectKey);
    const usable = mappings.filter((mapping) => !!definition.particleEffect.imageSlots?.[mapping.imageSlot]);
    if (usable.length === 0 || !this.loadImage) return false;
    const fingerprint = usable.map((mapping) => `${mapping.imageSlot}=${mapping.relativeLocator}`).sort().join("|");
    const readyKey = `${effectKey}\u0000${fingerprint}`;
    if (this.readyImageMappings.has(readyKey)) return false;
    if (this.failedImageMappings.has(readyKey)) return false;
    if (this.pendingImageLoads.has(readyKey)) return true;
    const job = (async (): Promise<boolean> => {
      const overrides: Record<string, Texture> = {};
      try {
        for (const mapping of usable) {
          let texture = this.decodedTexturesByLocator.get(mapping.relativeLocator);
          if (!texture) {
            let textureJob = this.textureLoadJobs.get(mapping.relativeLocator);
            if (!textureJob) {
              textureJob = (async (): Promise<Texture> => {
                const dataUrl = await this.loadImage!(mapping.relativeLocator);
                if (!dataUrl) throw new Error(`GetAsset returned no image for ${mapping.relativeLocator}.`);
                return Assets.load<Texture>(dataUrl);
              })();
              this.textureLoadJobs.set(mapping.relativeLocator, textureJob);
              void textureJob.then(
                () => this.textureLoadJobs.delete(mapping.relativeLocator),
                () => this.textureLoadJobs.delete(mapping.relativeLocator)
              );
            }
            texture = await textureJob;
            this.decodedTexturesByLocator.set(mapping.relativeLocator, texture);
          }
          if (this.disposed) return false;
          if (!this.ownedTextures.has(texture)) {
            this.ownedTextures.add(texture);
            sharedTextureUsers.set(texture, (sharedTextureUsers.get(texture) ?? 0) + 1);
          }
          overrides[definition.particleEffect.imageSlots![mapping.imageSlot]] = texture;
        }
        const adapted = adaptCatalogParticleEffect(definition);
        if (this.disposed) return false;
        if (adapted.pointStyle) this.effects.registerPointStyle(adapted.pointStyle, overrides);
        if (adapted.roomStyle) this.effects.registerRoomEffect(adapted.roomStyle, overrides);
        this.readyImageMappings.set(readyKey, fingerprint);
        return true;
      } catch (error) {
        this.diagnostics?.("warning", "Could not load custom particle art; packaged image slots remain active.", {
          effectKey,
          mappings: usable.map(({ imageSlot, relativeLocator }) => ({ imageSlot, relativeLocator })),
          error: error instanceof Error ? error.message : String(error)
        });
        this.failedImageMappings.add(readyKey);
        return false;
      } finally {
        this.pendingImageLoads.delete(readyKey);
        if (this.latestScene) {
          this.reconcile(this.latestScene);
        }
      }
    })();
    this.pendingImageLoads.set(readyKey, job);
    return true;
  }

  private consumeBursts(
    bursts: GameRenderParticleBurst[],
    catalog: Map<string, CatalogParticleEffect>
  ): void {
    for (const burst of bursts) {
      if (this.seenBurstIds.has(burst.id)) {
        this.diagnostics?.("info", "Rejected duplicate particle burst delivery.", {
          burstId: burst.id,
          effectKey: burst.effectKey,
          sourceObjectId: burst.sourceObjectId,
          reason: "already-emitted"
        });
        continue;
      }
      if (this.pendingBursts.has(burst.id)) continue;
      const definition = catalog.get(burst.effectKey);
      const recipe = definition?.particleEffect.recipe;
      if (!recipe || (recipe.renderingMode !== "point" && recipe.renderingMode !== "room")) {
        this.diagnostics?.("warning", "Ignored a particle burst whose recipe is unavailable or not burst-capable.", {
          burstId: burst.id,
          effectKey: burst.effectKey
        });
        continue;
      }
      const eligibleStreams = recipe.streams.filter((stream) => stream.surgeOnly === true);
      if (eligibleStreams.length === 0) {
        this.diagnostics?.("warning", "Ignored a particle burst with no surge-only recipe streams.", {
          burstId: burst.id,
          effectKey: burst.effectKey
        });
        continue;
      }
      if (this.ensureCustomImages(burst.effectKey, definition!, this.latestScene!)) {
        this.pendingBursts.set(burst.id, burst);
        this.diagnostics?.("info", "Deferred particle burst while custom art loads.", {
          burstId: burst.id,
          effectKey: burst.effectKey,
          sourceObjectId: burst.sourceObjectId,
          streamIds: eligibleStreams.map((stream) => stream.id),
          reason: "custom-image-load-pending"
        });
        continue;
      }

      if (!this.emitBurstStreams(burst, recipe, eligibleStreams)) {
        this.pendingBursts.set(burst.id, burst);
      }
    }
  }

  private flushPendingBursts(): void {
    if (this.pendingBursts.size === 0 || !this.latestScene) return;
    const scene = this.latestScene;
    const catalog = new Map((scene.particleEffectCatalog ?? []).map((effect) => [effect.effectKey, effect]));
    for (const [burstId, burst] of [...this.pendingBursts]) {
      const recipe = catalog.get(burst.effectKey)?.particleEffect.recipe;
      if (!recipe || (recipe.renderingMode !== "point" && recipe.renderingMode !== "room")) {
        this.pendingBursts.delete(burstId);
        this.completedBurstStreamIds.delete(burstId);
        this.diagnostics?.("warning", "Rejected deferred particle burst because its recipe is unavailable.", {
          burstId,
          effectKey: burst.effectKey,
          reason: "recipe-unavailable-after-custom-image-load"
        });
        continue;
      }
      const eligibleStreams = recipe.streams.filter((stream) => stream.surgeOnly === true);
      if (this.ensureCustomImages(burst.effectKey, catalog.get(burst.effectKey)!, scene)) continue;
      if (this.emitBurstStreams(burst, recipe, eligibleStreams)) {
        this.pendingBursts.delete(burstId);
      }
    }
  }

  private emitBurstStreams(
    burst: GameRenderParticleBurst,
    recipe: CatalogRecipe & { renderingMode: "point" | "room" },
    eligibleStreams: typeof recipe.streams
  ): boolean {
    if (eligibleStreams.length === 0) return false;
    const tunedRecipe = resolveCatalogRecipe(recipe, burst.tuning);
    const overrides = mapCatalogStreamOverrides(recipe, tunedRecipe, burst.tuning);
    let allStreamsCompleted = true;
    let completedStreams = this.completedBurstStreamIds.get(burst.id);
    if (!completedStreams) {
      completedStreams = new Set<string>();
      this.completedBurstStreamIds.set(burst.id, completedStreams);
    }
    const resolvedCounts: Record<string, number | null> = {};
    for (const stream of eligibleStreams) {
      if (completedStreams.has(stream.id)) continue;
      const attemptKey = `${burst.id}:${stream.id}`;
      const attempt = this.burstStreamAttemptCounts.get(attemptKey) ?? 0;
      let requestedCount: number;
      try {
        requestedCount = resolveBurstCount(stream.burstCount, burst.quantityMultiplier ?? 1);
      } catch (error) {
        resolvedCounts[stream.id] = null;
        completedStreams.add(stream.id);
        this.diagnostics?.("warning", "Particle burst stream has a terminal invalid count; it will not be retried.", {
          burstId: burst.id,
          sourceObjectId: burst.sourceObjectId,
          effectKey: burst.effectKey,
          streamId: stream.id,
          baselineBurstCount: stream.burstCount ?? 1,
          quantityMultiplier: burst.quantityMultiplier ?? 1,
          error: error instanceof Error ? error.message : String(error),
          outcome: "terminal-invalid-count"
        });
        continue;
      }
      resolvedCounts[stream.id] = requestedCount;
      if (requestedCount === 0) {
        completedStreams.add(stream.id);
        this.diagnostics?.("info", "Particle burst stream resolved to zero particles.", {
          burstId: burst.id,
          sourceObjectId: burst.sourceObjectId,
          effectKey: burst.effectKey,
          streamId: stream.id,
          baselineBurstCount: stream.burstCount ?? 1,
          quantityMultiplier: burst.quantityMultiplier ?? 1,
          requestedCount,
          outcome: "zero-count-completed"
        });
        continue;
      }
      let before: ReturnType<TopDownEffects["getStats"]> | undefined;
      try {
        before = this.effects.getStats();
        this.effects.emitBurst({
          id: `${burst.id}:${stream.id}:${attempt}`,
          effectId: burst.effectKey,
          xPx: burst.x ?? 0,
          yPx: burst.y ?? 0,
          count: requestedCount,
          streamId: stream.id,
          streamOverrides: overrides
        });
        const after = this.effects.getStats();
        const emittedParticleCount = after.emittedParticles - before.emittedParticles;
        const droppedParticleCount = after.droppedParticles - before.droppedParticles;
        const liveParticleCount = after.liveParticles - before.liveParticles;
        const processedParticleCount = emittedParticleCount + droppedParticleCount;
        const processed = processedParticleCount === requestedCount;
        allStreamsCompleted &&= processed;
        if (processed) {
          completedStreams.add(stream.id);
          this.burstStreamAttemptCounts.delete(attemptKey);
        } else {
          this.burstStreamAttemptCounts.set(attemptKey, attempt + 1);
        }
        this.diagnostics?.(processed ? "info" : "warning", "Particle burst stream emission result.", {
          burstId: burst.id,
          sourceObjectId: burst.sourceObjectId,
          effectKey: burst.effectKey,
          streamId: stream.id,
          baselineBurstCount: stream.burstCount ?? 1,
          quantityMultiplier: burst.quantityMultiplier ?? 1,
          requestedCount,
          emittedParticleCount,
          droppedParticleCount,
          liveParticleCount,
          runtimeStats: after,
          outcome: !processed ? "incomplete" : droppedParticleCount > 0
            ? emittedParticleCount > 0 ? "partially-capacity-dropped" : "capacity-dropped"
            : "emitted"
        });
      } catch (error) {
        const terminal = error instanceof RangeError || error instanceof TypeError;
        allStreamsCompleted &&= terminal;
        if (terminal) {
          completedStreams.add(stream.id);
          this.burstStreamAttemptCounts.delete(attemptKey);
        } else {
          this.burstStreamAttemptCounts.set(attemptKey, attempt + 1);
        }
        this.diagnostics?.("warning", terminal
          ? "Particle burst stream request was rejected terminally; it will not be retried."
          : "Particle burst stream emission threw an exception; the burst remains retryable.", {
          burstId: burst.id,
          sourceObjectId: burst.sourceObjectId,
          effectKey: burst.effectKey,
          streamId: stream.id,
          baselineBurstCount: stream.burstCount ?? 1,
          quantityMultiplier: burst.quantityMultiplier ?? 1,
          requestedCount,
          runtimeStatsBeforeEmission: before,
          error: error instanceof Error ? error.message : String(error),
          outcome: terminal ? "terminal-rejection" : "failed"
        });
      }
    }
    if (allStreamsCompleted && completedStreams.size === eligibleStreams.length) {
      this.seenBurstIds.add(burst.id);
      this.pendingBursts.delete(burst.id);
      this.completedBurstStreamIds.delete(burst.id);
      if (this.seenBurstIds.size > 4096) {
        const first = this.seenBurstIds.values().next().value;
        if (first) this.seenBurstIds.delete(first);
      }
      this.diagnostics?.("info", "Accepted particle burst occurrence.", {
        burstId: burst.id,
        sourceObjectId: burst.sourceObjectId,
        effectKey: burst.effectKey,
        streamIds: eligibleStreams.map((stream) => stream.id),
        quantityMultiplier: burst.quantityMultiplier ?? 1,
        requestedCounts: resolvedCounts,
        x: burst.x,
        y: burst.y,
        outcome: "all-streams-completed"
      });
      return true;
    }
    return false;
  }

  private setInstanceTarget(
    id: string,
    target: GameRenderParticleEffect,
    definition: CatalogParticleEffect,
    nowMs: number,
    immediate: boolean
  ): void {
    const existing = this.instanceStates.get(id);
    if (!existing || existing.target.effectKey !== target.effectKey || immediate) {
      const state: ParticleInstanceState = {
        definition,
        target,
        fromTuning: target.tuning,
        displayedTuning: target.tuning,
        transitionStartMs: nowMs,
        transitionDurationMs: 0
      };
      this.instanceStates.set(id, state);
      this.upsert(id, target, target.tuning);
      return;
    }

    const current = transitionTuning(existing.fromTuning, existing.target.tuning, existing.definition.particleEffect.recipe,
      existing.transitionDurationMs <= 0 ? 1 : Math.min(1, Math.max(0, (nowMs - existing.transitionStartMs) / existing.transitionDurationMs)));
    const tuningChanged = JSON.stringify(existing.target.tuning) !== JSON.stringify(target.tuning);
    existing.definition = definition;
    existing.target = target;
    existing.displayedTuning = current;
    if (tuningChanged) {
      existing.fromTuning = current;
      existing.transitionStartMs = nowMs;
      existing.transitionDurationMs = definition.particleEffect.recipe.lifecycle?.transitionTimeMs ?? 0;
    }
    this.upsert(id, target, current);
  }

  private upsert(
    id: string,
    target: GameRenderParticleEffect,
    tuning: CatalogResolvedTuning,
    anchorOverride?: { x: number; y: number }
  ): void {
    this.effects.upsertCatalogEffect({
      id,
      effectKey: target.effectKey,
      ...(anchorOverride ? { xPx: anchorOverride.x, yPx: anchorOverride.y } : target.x === undefined ? {} : { xPx: target.x }),
      ...(anchorOverride ? {} : target.y === undefined ? {} : { yPx: target.y }),
      enabled: target.enabled,
      order: target.order,
      tuning
    });
  }
}
