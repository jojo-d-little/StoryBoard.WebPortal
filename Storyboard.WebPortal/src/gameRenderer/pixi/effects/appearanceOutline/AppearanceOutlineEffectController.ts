import type { GameRenderAppearanceOutlineStyle } from "../../../contracts/sceneTypes";
import type { GameRendererDiagnosticsSink } from "../../../diagnostics/RendererDiagnostics";
import type { ObjectEffectController } from "../contracts/ObjectEffectController";
import { resolveRelativeAffine } from "../shared/relativeAffine";
import { Graphics, type Container, type Sprite } from "pixi.js";

interface AppearanceOutlineState {
  objectId: string;
  objectName: string;
  transformHost: Container;
  sprite: Sprite;
  graphics: Graphics;
  style: GameRenderAppearanceOutlineStyle;
  pulseStartAtMs: number;
}

export type AppearanceOutlineEffectController = ObjectEffectController<GameRenderAppearanceOutlineStyle>;

interface CreateAppearanceOutlineEffectControllerOptions {
  roomObjectLayer: Container;
  diagnostics?: GameRendererDiagnosticsSink;
}

function tryParseHexColor(colorHex: string | undefined): number | null {
  const normalized = (colorHex ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized.slice(1), 16);
}

function isValidStyle(style: GameRenderAppearanceOutlineStyle | undefined): style is GameRenderAppearanceOutlineStyle {
  if (!style) {
    return false;
  }

  const parsedColor = tryParseHexColor(style.outlineColorHex);
  return parsedColor !== null && style.outlineThickness > 0;
}

function syncGraphicsTransformWithSprite(state: AppearanceOutlineState): void {
  const relative = resolveRelativeAffine(state.graphics.parent as Container, state.transformHost);
  const scaleX = Math.sqrt((relative.a * relative.a) + (relative.b * relative.b));
  const scaleY = Math.sqrt((relative.c * relative.c) + (relative.d * relative.d));
  const rotation = Math.atan2(relative.b, relative.a);

  state.graphics.position.set(relative.tx, relative.ty);
  state.graphics.scale.set(scaleX, scaleY);
  state.graphics.rotation = rotation;
  state.graphics.zIndex = state.transformHost.zIndex + 0.25;
}

function redrawOutline(state: AppearanceOutlineState): void {
  const parsedColor = tryParseHexColor(state.style.outlineColorHex);
  if (parsedColor === null) {
    return;
  }

  const thickness = state.style.outlineThickness;
  const texture = state.sprite.texture;
  const width = Math.max(1, texture.width);
  const height = Math.max(1, texture.height);
  const inset = Math.max(1, Math.round(thickness / 2));

  state.graphics
    .clear()
    .roundRect(inset, inset, Math.max(1, width - inset * 2), Math.max(1, height - inset * 2), Math.max(4, inset * 2))
    .stroke({ width: thickness, color: parsedColor, alpha: 0.92 });
}

export function createAppearanceOutlineEffectController(
  options: CreateAppearanceOutlineEffectControllerOptions
): AppearanceOutlineEffectController {
  const statesByObjectId = new Map<string, AppearanceOutlineState>();

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
    if (existing.graphics.parent) {
      existing.graphics.parent.removeChild(existing.graphics);
    }
    existing.graphics.destroy();

    emit("debug", "Removed appearance outline cue from room object.", {
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

      const normalizedStyle: GameRenderAppearanceOutlineStyle = {
        outlineColorHex: style.outlineColorHex,
        outlineThickness: style.outlineThickness,
        pulseMs: style.pulseMs
      };

      let state = statesByObjectId.get(objectId);
      if (!state) {
        const graphics = new Graphics();
        options.roomObjectLayer.addChild(graphics);

        state = {
          objectId,
          objectName,
          transformHost,
          sprite,
          graphics,
          style: normalizedStyle,
          pulseStartAtMs: performance.now()
        };

        statesByObjectId.set(objectId, state);

        emit("debug", "Applied appearance outline cue to room object.", {
          objectId,
          objectName,
          colorHex: style.outlineColorHex,
          thickness: style.outlineThickness,
          pulseMs: style.pulseMs ?? "(none)"
        });
      } else {
        state.objectName = objectName;
        state.transformHost = transformHost;
        state.sprite = sprite;
        state.style = normalizedStyle;
      }

      redrawOutline(state);
      syncGraphicsTransformWithSprite(state);
    },
    syncObjectTransform: (objectId, transformHost, sprite) => {
      const state = statesByObjectId.get(objectId);
      if (!state) {
        return;
      }

      state.transformHost = transformHost;
      state.sprite = sprite;
      syncGraphicsTransformWithSprite(state);
    },
    tick: (nowMs) => {
      for (const state of statesByObjectId.values()) {
        const pulseMs = state.style.pulseMs ?? 0;
        if (pulseMs > 0) {
          const elapsed = Math.max(0, nowMs - state.pulseStartAtMs);
          const phase = (elapsed % pulseMs) / pulseMs;
          state.graphics.alpha = 0.52 + (0.42 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)));
        } else {
          state.graphics.alpha = 0.92;
        }

        syncGraphicsTransformWithSprite(state);
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
        if (state.graphics.parent) {
          state.graphics.parent.removeChild(state.graphics);
        }
        state.graphics.destroy();
      }
    }
  };
}
