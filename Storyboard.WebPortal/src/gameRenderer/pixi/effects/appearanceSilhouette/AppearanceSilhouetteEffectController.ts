import type { GameRenderAppearanceSilhouetteStyle } from "../../../contracts/sceneTypes";
import type { GameRendererDiagnosticsSink } from "../../../diagnostics/RendererDiagnostics";
import type { ObjectEffectController } from "../contracts/ObjectEffectController";
import { resolveHostRelativeAffine } from "../shared/relativeAffine";
import { Container, Filter, Sprite, defaultFilterVert, type BLEND_MODES } from "pixi.js";

interface SilhouetteSpriteBundle {
  passName: string;
  passIndex: number;
  renderContainer: Container;
  rootSprite: Sprite;
  maskSprite?: Sprite;
  maskFilter?: Filter;
}

interface RuntimeSilhouettePassStyle {
  name: string;
  blendMode: "normal" | "vivid" | "neon";
  colorHexStops: string[];
  scaleMultiplierStops: number[];
  alphaStops: number[];
}

interface AppearanceSilhouetteState {
  objectId: string;
  objectName: string;
  transformHost: Container;
  sourceSprite: Sprite;
  silhouettes: SilhouetteSpriteBundle[];
  passStyles: RuntimeSilhouettePassStyle[];
  style: GameRenderAppearanceSilhouetteStyle;
  pulseStartAtMs: number;
}

export type AppearanceSilhouetteEffectController = ObjectEffectController<GameRenderAppearanceSilhouetteStyle>;

interface CreateAppearanceSilhouetteEffectControllerOptions {
  roomObjectLayer: Container;
  diagnostics?: GameRendererDiagnosticsSink;
}

function resolveBlendMode(value: RuntimeSilhouettePassStyle["blendMode"]): BLEND_MODES {
  if (value === "neon") {
    return "add";
  }

  if (value === "vivid") {
    return "screen";
  }

  return "normal";
}

function resolveMaskAlphaMode(value: GameRenderAppearanceSilhouetteStyle["maskAlphaMode"]): "soft" | "binary" {
  return value === "binary" ? "binary" : "soft";
}

function resolveMaskAlphaCutoff(value: GameRenderAppearanceSilhouetteStyle["maskAlphaCutoff"]): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, Number(value)));
}

function createSilhouetteAlphaFilter(useBinaryAlpha: boolean, alphaCutoff: number): Filter {
  return Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: `
        in vec2 vTextureCoord;
        out vec4 finalColor;

        uniform sampler2D uTexture;
        uniform float uBinaryMode;
        uniform float uCutoff;
        uniform vec3 uColor;
        uniform float uOpacity;

        void main(void) {
          vec4 texel = texture(uTexture, vTextureCoord);
          float alpha = texel.a;
          if (uBinaryMode > 0.5) {
            alpha = texel.a > uCutoff ? 1.0 : 0.0;
          }

          // Source RGB is intentionally ignored for silhouette color independence.
          float outAlpha = alpha * uOpacity;
          finalColor = vec4(uColor * outAlpha, outAlpha);
        }
      `
    },
    resources: {
      silhouetteUniforms: {
        uBinaryMode: { value: useBinaryAlpha ? 1 : 0, type: "f32" },
        uCutoff: { value: resolveMaskAlphaCutoff(alphaCutoff), type: "f32" },
        uColor: { value: [1, 1, 1], type: "vec3<f32>" },
        uOpacity: { value: 1, type: "f32" }
      }
    }
  });
}

function applySolidMaskFilterState(bundle: SilhouetteSpriteBundle, color: number, opacity: number): void {
  if (!bundle.maskFilter) {
    return;
  }

  const uniforms = (bundle.maskFilter.resources as {
    silhouetteUniforms?: {
      uniforms?: {
        uColor?: [number, number, number] | number[];
        uOpacity?: number;
      };
    };
  } | undefined)?.silhouetteUniforms?.uniforms;

  if (!uniforms) {
    return;
  }

  const red = ((color >> 16) & 0xff) / 255;
  const green = ((color >> 8) & 0xff) / 255;
  const blue = (color & 0xff) / 255;
  uniforms.uColor = [red, green, blue];
  uniforms.uOpacity = Math.min(1, Math.max(0, opacity));
}

function toRuntimePassStyles(style: GameRenderAppearanceSilhouetteStyle): RuntimeSilhouettePassStyle[] {
  return style.passes
    .filter((pass) => pass.enabled !== false)
    .map((pass, index) => {
      return {
        name: (pass.name ?? "").trim() || `pass-${index + 1}`,
        blendMode: pass.blendMode ?? "normal",
        colorHexStops: pass.colorHexStops,
        scaleMultiplierStops: pass.scaleMultiplierStops,
        alphaStops: pass.alphaStops ?? []
      } satisfies RuntimeSilhouettePassStyle;
    });
}

function tryParseHexColor(colorHex: string | undefined): number | null {
  const normalized = (colorHex ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized.slice(1), 16);
}

function sampleStops(stops: number[], phase: number): number {
  if (stops.length === 0) {
    return 0;
  }

  if (stops.length === 1) {
    return stops[0];
  }

  const segmentCount = stops.length - 1;
  const scaled = phase * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const localT = scaled - index;
  const from = stops[index];
  const to = stops[index + 1];
  return from + ((to - from) * localT);
}

function foldPulsePhase(phase: number): number {
  return phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
}

function sampleColor(stops: number[], phase: number): number {
  if (stops.length === 0) {
    return 0xffffff;
  }

  if (stops.length === 1) {
    return stops[0];
  }

  const segmentCount = stops.length - 1;
  const scaled = phase * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const localT = scaled - index;

  const from = stops[index];
  const to = stops[index + 1];

  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;

  const mixedR = Math.round(fromR + ((toR - fromR) * localT));
  const mixedG = Math.round(fromG + ((toG - fromG) * localT));
  const mixedB = Math.round(fromB + ((toB - fromB) * localT));

  return (mixedR << 16) | (mixedG << 8) | mixedB;
}

function sampleColorPingPong(stops: number[], phase: number): number {
  if (stops.length <= 1) {
    return sampleColor(stops, phase);
  }

  return sampleColor(stops, foldPulsePhase(phase));
}

function areNumberArraysEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function isValidStyle(style: GameRenderAppearanceSilhouetteStyle | undefined): style is GameRenderAppearanceSilhouetteStyle {
  if (!style) {
    return false;
  }

  const passStyles = toRuntimePassStyles(style);
  if (passStyles.length === 0) {
    return false;
  }

  for (const passStyle of passStyles) {
    const parsedColorStops = passStyle.colorHexStops.map((stop) => tryParseHexColor(stop));
    if (parsedColorStops.some((stop) => stop === null)) {
      return false;
    }

    if (!passStyle.scaleMultiplierStops.every((scale) => Number.isFinite(scale) && scale > 1)) {
      return false;
    }

    if (!passStyle.alphaStops.every((alpha) => Number.isFinite(alpha) && alpha >= 0 && alpha <= 1)) {
      return false;
    }
  }

  if (style.maskAlphaMode && style.maskAlphaMode !== "soft" && style.maskAlphaMode !== "binary") {
    return false;
  }

  if (style.maskAlphaCutoff !== undefined
    && (!Number.isFinite(style.maskAlphaCutoff) || style.maskAlphaCutoff < 0 || style.maskAlphaCutoff > 1)) {
    return false;
  }

  return true;
}

function resolveEffectParent(transformHost: Container, fallback: Container): Container {
  return (transformHost.parent as Container | null) ?? fallback;
}

function ensureSilhouetteParent(bundle: SilhouetteSpriteBundle, desiredParent: Container): void {
  if (bundle.renderContainer.parent === desiredParent) {
    return;
  }

  if (bundle.renderContainer.parent) {
    bundle.renderContainer.parent.removeChild(bundle.renderContainer);
  }

  desiredParent.addChild(bundle.renderContainer);
}

function syncSilhouetteTransform(
  fallbackLayer: Container,
  state: AppearanceSilhouetteState,
  silhouetteBundle: SilhouetteSpriteBundle
): void {
  silhouetteBundle.renderContainer.visible = false;
  const silhouette = silhouetteBundle.rootSprite;
  const silhouetteMask = silhouetteBundle.maskSprite;
  const source = state.sourceSprite;
  const parentLayer = resolveEffectParent(state.transformHost, fallbackLayer);
  ensureSilhouetteParent(silhouetteBundle, parentLayer);
  const relative = resolveHostRelativeAffine(parentLayer, state.transformHost);
  const centerX = (relative.a * (source.texture.width * 0.5)) + (relative.c * (source.texture.height * 0.5)) + relative.tx;
  const centerY = (relative.b * (source.texture.width * 0.5)) + (relative.d * (source.texture.height * 0.5)) + relative.ty;
  const hostRotation = Math.atan2(relative.b, relative.a);

  // Keep silhouette immediately under its source object so stacked supports stay below it.
  silhouetteBundle.renderContainer.zIndex = state.transformHost.zIndex - (0.001 + (silhouetteBundle.passIndex * 0.0001));
  silhouette.anchor.set(0.5, 0.5);
  silhouette.position.set(centerX, centerY);
  silhouette.rotation = hostRotation;
  silhouette.zIndex = 0;

  if (silhouetteMask) {
    silhouetteMask.anchor.set(0.5, 0.5);
    silhouetteMask.position.set(centerX, centerY);
    silhouetteMask.rotation = hostRotation;
    silhouetteMask.zIndex = 0.01;
  }

  silhouetteBundle.renderContainer.visible = true;
}

function applyStaticState(roomObjectLayer: Container, state: AppearanceSilhouetteState): void {
  for (let index = 0; index < state.silhouettes.length; index += 1) {
    const silhouette = state.silhouettes[index];
    const passStyle = state.passStyles[index];
    if (!passStyle) {
      continue;
    }

    const baseColor = tryParseHexColor(passStyle.colorHexStops[0]);
    if (baseColor !== null) {
      applySolidMaskFilterState(silhouette, baseColor, passStyle.alphaStops[0] ?? 0.68);
    }

    silhouette.rootSprite.blendMode = resolveBlendMode(passStyle.blendMode);

    const baseScaleMultiplier = passStyle.scaleMultiplierStops[0] ?? 1.04;
    const parentLayer = resolveEffectParent(state.transformHost, roomObjectLayer);
    ensureSilhouetteParent(silhouette, parentLayer);
    const relative = resolveHostRelativeAffine(parentLayer, state.transformHost);
    const hostScaleX = Math.sqrt((relative.a * relative.a) + (relative.b * relative.b));
    const hostScaleY = Math.sqrt((relative.c * relative.c) + (relative.d * relative.d));
    silhouette.rootSprite.scale.set(
      hostScaleX * baseScaleMultiplier,
      hostScaleY * baseScaleMultiplier
    );

    silhouette.rootSprite.alpha = 1;
    syncSilhouetteTransform(roomObjectLayer, state, silhouette);
  }
}

function destroySilhouette(bundle: SilhouetteSpriteBundle): void {
  if (bundle.renderContainer.parent) {
    bundle.renderContainer.parent.removeChild(bundle.renderContainer);
  }

  bundle.maskFilter?.destroy();
  bundle.renderContainer.destroy({ children: true });
}

function createSilhouetteSprite(
  parentLayer: Container,
  sourceSprite: Sprite,
  style: GameRenderAppearanceSilhouetteStyle,
  passStyle: RuntimeSilhouettePassStyle,
  passIndex: number
): SilhouetteSpriteBundle {
  const renderContainer = new Container();
  renderContainer.sortableChildren = true;
  renderContainer.visible = false;

  const alphaFilter = createSilhouetteAlphaFilter(resolveMaskAlphaMode(style.maskAlphaMode) === "binary", style.maskAlphaCutoff ?? 0.5);
  const silhouetteSprite = new Sprite(sourceSprite.texture);
  silhouetteSprite.anchor.set(0.5, 0.5);
  silhouetteSprite.position.set(0, 0);
  silhouetteSprite.rotation = sourceSprite.rotation;
  silhouetteSprite.alpha = 1;
  silhouetteSprite.zIndex = 0;
  silhouetteSprite.filters = [alphaFilter];

  renderContainer.addChild(silhouetteSprite);
  parentLayer.addChild(renderContainer);

  return {
    passName: passStyle.name,
    passIndex,
    renderContainer,
    rootSprite: silhouetteSprite,
    maskFilter: alphaFilter
  };
}

function arePassStylesEquivalent(left: RuntimeSilhouettePassStyle[], right: RuntimeSilhouettePassStyle[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftPass = left[index];
    const rightPass = right[index];

    if (leftPass.name !== rightPass.name
      || leftPass.blendMode !== rightPass.blendMode
      || !areStringArraysEqual(leftPass.colorHexStops, rightPass.colorHexStops)
      || !areNumberArraysEqual(leftPass.scaleMultiplierStops, rightPass.scaleMultiplierStops)
      || !areNumberArraysEqual(leftPass.alphaStops, rightPass.alphaStops)) {
      return false;
    }
  }

  return true;
}

export function createAppearanceSilhouetteEffectController(
  options: CreateAppearanceSilhouetteEffectControllerOptions
): AppearanceSilhouetteEffectController {
  const statesByObjectId = new Map<string, AppearanceSilhouetteState>();

  function emit(level: "debug" | "info" | "warning" | "error", message: string, details?: unknown): void {
    options.diagnostics?.({
      category: "scene",
      level,
      message,
      details
    });
  }

  function removeObject(objectId: string): void {
    const existing = statesByObjectId.get(objectId);
    if (!existing) {
      return;
    }

    statesByObjectId.delete(objectId);
    for (const silhouette of existing.silhouettes) {
      destroySilhouette(silhouette);
    }

    emit("debug", "Removed appearance silhouette cue from room object.", {
      objectId: existing.objectId,
      objectName: existing.objectName
    });
  }

  return {
    applyForObject: (objectId, objectName, transformHost, sprite, style) => {
      if (!isValidStyle(style)) {
        removeObject(objectId);
        return;
      }

      const passStyles = toRuntimePassStyles(style);
      if (passStyles.length === 0) {
        removeObject(objectId);
        return;
      }

      let state = statesByObjectId.get(objectId);
      const requiresSilhouetteRecreate = state
        && (
          state.silhouettes.length !== passStyles.length
          || (
            resolveMaskAlphaMode(state.style.maskAlphaMode) !== resolveMaskAlphaMode(style.maskAlphaMode)
            || resolveMaskAlphaCutoff(state.style.maskAlphaCutoff) !== resolveMaskAlphaCutoff(style.maskAlphaCutoff)
          )
        );

      if (requiresSilhouetteRecreate && state) {
        for (const silhouette of state.silhouettes) {
          destroySilhouette(silhouette);
        }
        statesByObjectId.delete(objectId);
        state = undefined;
      }

      if (!state) {
        const effectParent = resolveEffectParent(transformHost, options.roomObjectLayer);
        const silhouettes = passStyles.map((passStyle, index) => {
          return createSilhouetteSprite(effectParent, sprite, style, passStyle, index);
        });

        state = {
          objectId,
          objectName,
          transformHost,
          sourceSprite: sprite,
          silhouettes,
          passStyles,
          style: {
            maskAlphaMode: style.maskAlphaMode,
            maskAlphaCutoff: style.maskAlphaCutoff,
            pulseMs: style.pulseMs,
            passes: style.passes
          },
          pulseStartAtMs: performance.now()
        };

        statesByObjectId.set(objectId, state);

        emit("debug", "Applied appearance silhouette cue to room object.", {
          objectId,
          objectName,
          passCount: passStyles.length,
          passes: passStyles,
          maskAlphaMode: style.maskAlphaMode ?? "soft",
          maskAlphaCutoff: style.maskAlphaCutoff ?? 0,
          effectiveMaskSource: resolveMaskAlphaMode(style.maskAlphaMode) === "binary"
            ? "generated-gpu-binary"
            : "source-soft",
          hardEdgeAttachedPassNames: silhouettes.filter((entry) => Boolean(entry.maskFilter)).map((entry) => entry.passName),
          pulseMs: style.pulseMs ?? "(none)"
        });
      } else {
        const previousStyle = state.style;
        state.objectName = objectName;
        state.transformHost = transformHost;
        state.sourceSprite = sprite;
        state.passStyles = passStyles;
        state.style = {
          maskAlphaMode: style.maskAlphaMode,
          maskAlphaCutoff: style.maskAlphaCutoff,
          pulseMs: style.pulseMs,
          passes: style.passes
        };

        for (const silhouette of state.silhouettes) {
          ensureSilhouetteParent(silhouette, resolveEffectParent(state.transformHost, options.roomObjectLayer));
          if (silhouette.rootSprite.texture !== sprite.texture) {
            silhouette.rootSprite.texture = sprite.texture;
          }
        }

        const styleChanged = resolveMaskAlphaMode(previousStyle.maskAlphaMode) !== resolveMaskAlphaMode(state.style.maskAlphaMode)
          || resolveMaskAlphaCutoff(previousStyle.maskAlphaCutoff) !== resolveMaskAlphaCutoff(state.style.maskAlphaCutoff)
          || previousStyle.pulseMs !== state.style.pulseMs
          || !arePassStylesEquivalent(toRuntimePassStyles(previousStyle), passStyles);

        if (styleChanged) {
          emit("debug", "Updated appearance silhouette cue style for room object.", {
            objectId,
            objectName,
            previousMaskAlphaMode: previousStyle.maskAlphaMode ?? "soft",
            nextMaskAlphaMode: state.style.maskAlphaMode ?? "soft",
            previousMaskAlphaCutoff: previousStyle.maskAlphaCutoff ?? 0,
            nextMaskAlphaCutoff: state.style.maskAlphaCutoff ?? 0,
            previousPulseMs: previousStyle.pulseMs ?? "(none)",
            nextPulseMs: state.style.pulseMs ?? "(none)",
            previousPasses: toRuntimePassStyles(previousStyle),
            nextPasses: passStyles,
            hardEdgeAttachedPassNames: state.silhouettes.filter((entry) => Boolean(entry.maskFilter)).map((entry) => entry.passName)
          });
        }
      }

      applyStaticState(options.roomObjectLayer, state);
    },
    syncObjectTransform: (objectId, transformHost, sprite) => {
      const state = statesByObjectId.get(objectId);
      if (!state) {
        return;
      }

      state.transformHost = transformHost;
      state.sourceSprite = sprite;
      for (const silhouette of state.silhouettes) {
        syncSilhouetteTransform(options.roomObjectLayer, state, silhouette);
      }
    },
    tick: (nowMs) => {
      for (const state of statesByObjectId.values()) {
        const pulseMs = state.style.pulseMs ?? 0;

        for (let index = 0; index < state.silhouettes.length; index += 1) {
          const silhouette = state.silhouettes[index];
          const passStyle = state.passStyles[index];
          if (!passStyle) {
            continue;
          }

          const colorStops = passStyle.colorHexStops
            .map((stop) => tryParseHexColor(stop))
            .filter((stop): stop is number => stop !== null);
          const scaleStops = passStyle.scaleMultiplierStops;
          const alphaStops = passStyle.alphaStops;

          if (pulseMs > 0) {
            const elapsed = Math.max(0, nowMs - state.pulseStartAtMs);
            const phase = (elapsed % pulseMs) / pulseMs;
            const pulsePhase = foldPulsePhase(phase);
            const nextColor = sampleColorPingPong(colorStops, phase);
            const nextScaleMultiplier = sampleStops(scaleStops, pulsePhase);
            const parentLayer = resolveEffectParent(state.transformHost, options.roomObjectLayer);
            const relative = resolveHostRelativeAffine(parentLayer, state.transformHost);
            const hostScaleX = Math.sqrt((relative.a * relative.a) + (relative.b * relative.b));
            const hostScaleY = Math.sqrt((relative.c * relative.c) + (relative.d * relative.d));
            const fallbackPulseAlpha = 0.5 + (0.25 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)));
            const nextAlpha = alphaStops.length === 1
              ? alphaStops[0]
              : (alphaStops.length >= 2 ? sampleStops(alphaStops, pulsePhase) : fallbackPulseAlpha);

            applySolidMaskFilterState(silhouette, nextColor, nextAlpha);

            silhouette.rootSprite.scale.set(
              hostScaleX * nextScaleMultiplier,
              hostScaleY * nextScaleMultiplier
            );

            silhouette.rootSprite.alpha = 1;
          } else {
            applyStaticState(options.roomObjectLayer, state);
          }

          syncSilhouetteTransform(options.roomObjectLayer, state, silhouette);
        }
      }
    },
    removeObject,
    clear: () => {
      for (const objectId of [...statesByObjectId.keys()]) {
        const state = statesByObjectId.get(objectId);
        if (!state) {
          continue;
        }

        statesByObjectId.delete(objectId);
        for (const silhouette of state.silhouettes) {
          destroySilhouette(silhouette);
        }
      }
    }
  };
}
