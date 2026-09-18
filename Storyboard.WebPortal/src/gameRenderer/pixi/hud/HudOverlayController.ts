import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import type { Ticker } from "pixi.js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";

interface HudThemeColors {
  outlineColor: number;
  backgroundColor: number;
  textColor: number;
  manualDismissButtonColor: number;
  headerFontFamily: string;
  bodyFontFamily: string;
}

interface HudOverlayCardState {
  id: string;
  card: Container;
  movingContainer: Container;
  entry: NonNullable<GameRenderSceneSnapshot["hudOverlayEntries"]>[number];
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollMode: "none" | "auto" | "manual";
  scrollSpeedPxPerSec: number;
  scrollStartOffsetY: number;
  scrollEndOffsetY: number;
  fadeEnabled: boolean;
  motionInMs: number;
  motionOutMs: number;
  fadeInElapsedMs: number;
  fadeOutElapsedMs: number;
  isExiting: boolean;
}

export interface HudOverlayController {
  readonly layer: Container;
  clear: () => void;
  reconcile: (scene: GameRenderSceneSnapshot, viewportWidth: number, viewportHeight: number) => void;
  update: (ticker: Ticker) => void;
}

export function areHudOverlayEntriesEquivalent(
  leftEntries: GameRenderSceneSnapshot["hudOverlayEntries"],
  rightEntries: GameRenderSceneSnapshot["hudOverlayEntries"]
): boolean {
  const leftHudEntries = leftEntries ?? [];
  const rightHudEntries = rightEntries ?? [];

  if (leftHudEntries.length !== rightHudEntries.length) {
    return false;
  }

  for (let index = 0; index < leftHudEntries.length; index += 1) {
    const leftHud = leftHudEntries[index];
    const rightHud = rightHudEntries[index];
    if (leftHud.id !== rightHud.id
      || leftHud.text !== rightHud.text
      || leftHud.titleText !== rightHud.titleText
      || leftHud.bodyText !== rightHud.bodyText
      || leftHud.cueEffectKey !== rightHud.cueEffectKey
      || leftHud.isManualDismiss !== rightHud.isManualDismiss
      || leftHud.scrollMode !== rightHud.scrollMode
      || leftHud.scrollSpeedPxPerSec !== rightHud.scrollSpeedPxPerSec
      || leftHud.layoutMode !== rightHud.layoutMode
      || leftHud.backdropMode !== rightHud.backdropMode
      || leftHud.backdropOpacity !== rightHud.backdropOpacity
      || leftHud.panelOpacity !== rightHud.panelOpacity
      || leftHud.panelBorderThicknessPx !== rightHud.panelBorderThicknessPx
      || leftHud.titleFontSizePx !== rightHud.titleFontSizePx
      || leftHud.bodyFontSizePx !== rightHud.bodyFontSizePx
      || leftHud.transitionStyle !== rightHud.transitionStyle
      || leftHud.motionInMs !== rightHud.motionInMs
      || leftHud.motionOutMs !== rightHud.motionOutMs) {
      return false;
    }
  }

  return true;
}

function parseThemeHexColor(value: string, fallback: number): number {
  const normalized = value.trim();
  const match = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!match) {
    return fallback;
  }

  const parsed = Number.parseInt(match[1], 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveThemeFontFamily(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function resolveHudThemeColors(): HudThemeColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    outlineColor: parseThemeHexColor(styles.getPropertyValue("--theme-color-hud-outline"), 0x94a3b8),
    backgroundColor: parseThemeHexColor(styles.getPropertyValue("--theme-color-hud-background"), 0x0f172a),
    textColor: parseThemeHexColor(styles.getPropertyValue("--theme-color-hud-text"), 0xf9fafb),
    manualDismissButtonColor: parseThemeHexColor(styles.getPropertyValue("--theme-color-hud-manual-dismiss-button"), 0x1d4ed8),
    headerFontFamily: resolveThemeFontFamily(
      styles.getPropertyValue("--theme-font-family-hud-header"),
      "Cascadia Mono, Consolas, Courier New, monospace"
    ),
    bodyFontFamily: resolveThemeFontFamily(
      styles.getPropertyValue("--theme-font-family-hud-body"),
      "Source Sans 3, Segoe UI, sans-serif"
    )
  };
}

function createHudOverlayCard(
  entry: NonNullable<GameRenderSceneSnapshot["hudOverlayEntries"]>[number],
  viewportWidthPx: number,
  viewportHeightPx: number,
  themeColors: HudThemeColors
): {
  card: Container;
  movingContainer: Container;
  cardWidth: number;
  cardHeight: number;
  scrollStartOffsetY: number;
  scrollEndOffsetY: number;
} {
  const card = new Container();
  const movingContainer = new Container();
  const layoutMode = entry.layoutMode ?? "edge-card";
  const titleText = (entry.titleText ?? "").trim();
  const bodyTextValue = (entry.bodyText ?? "").trim();
  const scrollMode = entry.scrollMode ?? "none";

  if (layoutMode === "fullscreen") {
    const panelPaddingX = 22;
    const panelPaddingTop = 18;
    const panelPaddingBottom = 16;
    const panelWidth = Math.max(320, Math.min(920, Math.round(viewportWidthPx * 0.78)));
    const titleFontSize = Math.max(12, Math.round(entry.titleFontSizePx ?? 34));
    const bodyFontSize = Math.max(12, Math.round(entry.bodyFontSizePx ?? 24));
    const titleStyle = new TextStyle({
      fontFamily: themeColors.headerFontFamily,
      fontSize: titleFontSize,
      lineHeight: Math.round(titleFontSize * 1.2),
      fill: themeColors.textColor,
      wordWrap: true,
      wordWrapWidth: panelWidth - (panelPaddingX * 2)
    });
    const bodyStyle = new TextStyle({
      fontFamily: themeColors.bodyFontFamily,
      fontSize: bodyFontSize,
      lineHeight: Math.round(bodyFontSize * 1.28),
      fill: themeColors.textColor,
      wordWrap: true,
      wordWrapWidth: panelWidth - (panelPaddingX * 2)
    });
    const hasTitle = titleText.length > 0;
    const resolvedBodyText = bodyTextValue || (!hasTitle ? entry.text : "");
    const titleNode = hasTitle ? new Text({ text: titleText, style: titleStyle }) : null;
    const bodyNode = resolvedBodyText ? new Text({ text: resolvedBodyText, style: bodyStyle }) : null;
    const hintStyle = new TextStyle({
      fontFamily: themeColors.headerFontFamily,
      fontSize: 13,
      fill: themeColors.textColor
    });
    const manualHintText = entry.isManualDismiss
      ? new Text({ text: "click to continue", style: hintStyle })
      : null;

    let panelContentHeight = panelPaddingTop + panelPaddingBottom;
    if (titleNode) {
      panelContentHeight += titleNode.height;
    }
    if (titleNode && bodyNode) {
      panelContentHeight += 14;
    }
    if (bodyNode) {
      panelContentHeight += bodyNode.height;
    }
    if (manualHintText) {
      panelContentHeight += manualHintText.height + 14;
    }

    const panelHeight = Math.max(220, Math.round(panelContentHeight));
    const panelX = Math.round((viewportWidthPx - panelWidth) / 2);
    const panelY = Math.round((viewportHeightPx - panelHeight) / 2);
    const backdropOpacity = Math.max(0, Math.min(1, entry.backdropOpacity ?? 0.5));
    const backdropColor = entry.backdropMode === "solid"
      ? themeColors.backgroundColor
      : 0x000000;
    const panelOpacity = Math.max(0, Math.min(1, entry.panelOpacity ?? 0.95));
    const panelBorderThicknessPx = Math.max(0, entry.panelBorderThicknessPx ?? 2);

    const backdrop = new Graphics()
      .rect(0, 0, viewportWidthPx, viewportHeightPx)
      .fill({ color: backdropColor, alpha: backdropOpacity });

    const panel = new Graphics();
    if (panelOpacity > 0 || panelBorderThicknessPx > 0) {
      panel.roundRect(panelX, panelY, panelWidth, panelHeight, 14);
    }
    if (panelOpacity > 0) {
      panel.fill({ color: themeColors.backgroundColor, alpha: panelOpacity });
    }
    if (panelBorderThicknessPx > 0) {
      panel.stroke({ width: panelBorderThicknessPx, color: themeColors.outlineColor, alpha: 0.95 });
    }

    let textY = panelY + panelPaddingTop;
    if (titleNode) {
      titleNode.position.set(panelX + panelPaddingX, textY);
      textY += titleNode.height + 14;
    }
    if (bodyNode) {
      bodyNode.position.set(panelX + panelPaddingX, textY);
    }

    if (manualHintText) {
      manualHintText.alpha = 0.95;
      manualHintText.position.set(
        panelX + panelWidth - manualHintText.width - panelPaddingX,
        panelY + panelHeight - manualHintText.height - 10
      );
    }

    card.addChild(backdrop);
    card.addChild(movingContainer);
    movingContainer.addChild(panel);
    if (titleNode) {
      movingContainer.addChild(titleNode);
    }
    if (bodyNode) {
      movingContainer.addChild(bodyNode);
    }
    if (manualHintText) {
      movingContainer.addChild(manualHintText);
    }

    const scrollStartOffsetY = scrollMode === "auto"
      ? Math.max(0, viewportHeightPx - panelY + 16)
      : 0;
    const scrollEndOffsetY = scrollMode === "auto"
      ? -(panelY + panelHeight + 24)
      : 0;
    movingContainer.position.set(0, scrollStartOffsetY);

    return {
      card,
      movingContainer,
      cardWidth: panelWidth,
      cardHeight: panelHeight,
      scrollStartOffsetY,
      scrollEndOffsetY
    };
  }

  const cardMaxWidth = Math.max(220, Math.min(360, viewportWidthPx * 0.4));
  const bodyStyle = new TextStyle({
    fontFamily: themeColors.bodyFontFamily,
    fontSize: Math.max(12, Math.round(entry.bodyFontSizePx ?? 16)),
    lineHeight: 21,
    fill: themeColors.textColor,
    wordWrap: true,
    wordWrapWidth: cardMaxWidth - 22
  });

  const edgeBodyText = bodyTextValue || entry.text;
  const bodyText = new Text({ text: edgeBodyText, style: bodyStyle });
  bodyText.position.set(10, 10);

  const hintStyle = new TextStyle({
    fontFamily: themeColors.headerFontFamily,
    fontSize: 11,
    fill: themeColors.textColor
  });
  const manualHintText = entry.isManualDismiss
    ? new Text({ text: "continue  >>", style: hintStyle })
    : null;
  if (manualHintText) {
    manualHintText.alpha = 0.95;
  }

  const cardWidth = cardMaxWidth;
  const hintHeight = manualHintText ? (manualHintText.height + 12) : 0;
  const cardHeight = Math.max(58, bodyText.height + 20 + hintHeight);

  const panel = new Graphics()
    .roundRect(0, 0, cardWidth, cardHeight, 9)
    .fill({ color: themeColors.backgroundColor, alpha: 0.9 })
    .stroke({ width: 1, color: themeColors.outlineColor, alpha: 0.9 });

  if (manualHintText) {
    const hintBandTop = Math.max(34, cardHeight - (manualHintText.height + 12));
    panel
      .roundRect(0, hintBandTop, cardWidth, cardHeight - hintBandTop, 9)
      .fill({ color: themeColors.manualDismissButtonColor, alpha: 0.45 });
    manualHintText.position.set(cardWidth - manualHintText.width - 10, cardHeight - manualHintText.height - 7);
  }

  movingContainer.addChild(panel);
  movingContainer.addChild(bodyText);
  if (manualHintText) {
    movingContainer.addChild(manualHintText);
  }
  card.addChild(movingContainer);

  return {
    card,
    movingContainer,
    cardWidth,
    cardHeight,
    scrollStartOffsetY: 0,
    scrollEndOffsetY: 0
  };
}

export function createHudOverlayController(isDisposed: () => boolean): HudOverlayController {
  const layer = new Container();
  layer.sortableChildren = true;
  const hudOverlayCardStatesById = new Map<string, HudOverlayCardState>();

  function clear(): void {
    hudOverlayCardStatesById.clear();
    layer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });
  }

  function reconcile(scene: GameRenderSceneSnapshot, viewportWidth: number, viewportHeight: number): void {
    const entries = scene.hudOverlayEntries ?? [];
    const themeColors = resolveHudThemeColors();
    const nextEntriesById = new Map(entries.map((entry) => [entry.id, entry]));

    for (const entry of entries) {
      const existing = hudOverlayCardStatesById.get(entry.id);
      const fadeEnabled = entry.transitionStyle === "fade";
      const nextMotionInMs = Math.max(0, Math.round(entry.motionInMs ?? 0));
      const nextMotionOutMs = Math.max(0, Math.round(entry.motionOutMs ?? 0));
      const requiresRecreate = !existing
        || existing.entry.text !== entry.text
        || existing.entry.titleText !== entry.titleText
        || existing.entry.bodyText !== entry.bodyText
        || existing.entry.cueEffectKey !== entry.cueEffectKey
        || existing.entry.isManualDismiss !== entry.isManualDismiss
        || existing.entry.scrollMode !== entry.scrollMode
        || existing.entry.scrollSpeedPxPerSec !== entry.scrollSpeedPxPerSec
        || existing.entry.layoutMode !== entry.layoutMode
        || existing.entry.backdropMode !== entry.backdropMode
        || existing.entry.backdropOpacity !== entry.backdropOpacity
        || existing.entry.panelOpacity !== entry.panelOpacity
        || existing.entry.panelBorderThicknessPx !== entry.panelBorderThicknessPx
        || existing.entry.titleFontSizePx !== entry.titleFontSizePx
        || existing.entry.bodyFontSizePx !== entry.bodyFontSizePx
        || existing.viewportWidth !== viewportWidth
        || existing.viewportHeight !== viewportHeight;

      if (requiresRecreate) {
        if (existing) {
          layer.removeChild(existing.card);
          existing.card.destroy({ children: true });
          hudOverlayCardStatesById.delete(entry.id);
        }

        const created = createHudOverlayCard(entry, viewportWidth, viewportHeight, themeColors);
        created.card.zIndex = 10_000;
        created.card.alpha = fadeEnabled && nextMotionInMs > 0 ? 0 : 1;
        layer.addChild(created.card);

        hudOverlayCardStatesById.set(entry.id, {
          id: entry.id,
          card: created.card,
          movingContainer: created.movingContainer,
          entry,
          cardWidth: created.cardWidth,
          cardHeight: created.cardHeight,
          viewportWidth,
          viewportHeight,
          scrollMode: entry.scrollMode ?? "none",
          scrollSpeedPxPerSec: Math.max(1, entry.scrollSpeedPxPerSec ?? 50),
          scrollStartOffsetY: created.scrollStartOffsetY,
          scrollEndOffsetY: created.scrollEndOffsetY,
          fadeEnabled,
          motionInMs: nextMotionInMs,
          motionOutMs: nextMotionOutMs,
          fadeInElapsedMs: 0,
          fadeOutElapsedMs: 0,
          isExiting: false
        });
        continue;
      }

      if (!existing) {
        continue;
      }

      existing.entry = entry;
      existing.scrollMode = entry.scrollMode ?? "none";
      existing.scrollSpeedPxPerSec = Math.max(1, entry.scrollSpeedPxPerSec ?? 50);
      existing.fadeEnabled = fadeEnabled;
      existing.motionInMs = nextMotionInMs;
      existing.motionOutMs = nextMotionOutMs;
      if (existing.isExiting && nextEntriesById.has(existing.id)) {
        existing.isExiting = false;
        existing.fadeOutElapsedMs = 0;
      }
    }

    for (const [id, state] of hudOverlayCardStatesById) {
      if (nextEntriesById.has(id) || state.isExiting) {
        continue;
      }

      if (!state.fadeEnabled || state.motionOutMs <= 0) {
        layer.removeChild(state.card);
        state.card.destroy({ children: true });
        hudOverlayCardStatesById.delete(id);
        continue;
      }

      state.isExiting = true;
      state.fadeOutElapsedMs = 0;
    }

    let currentY = 14;
    for (const entry of entries) {
      const state = hudOverlayCardStatesById.get(entry.id);
      if (!state) {
        continue;
      }

      if ((state.entry.layoutMode ?? "edge-card") === "fullscreen") {
        state.card.position.set(0, 0);
        continue;
      }

      state.card.position.set(Math.max(8, viewportWidth - state.cardWidth - 14), currentY);
      currentY += state.cardHeight + 8;
    }
  }

  function update(ticker: Ticker): void {
    if (hudOverlayCardStatesById.size === 0 || isDisposed()) {
      return;
    }

    const deltaMs = Math.max(0, ticker.deltaMS);
    for (const [id, state] of hudOverlayCardStatesById) {
      if (state.scrollMode === "auto" && !state.isExiting) {
        if (state.movingContainer.position.y > state.scrollEndOffsetY) {
          const deltaY = (state.scrollSpeedPxPerSec * deltaMs) / 1000;
          state.movingContainer.position.y = Math.max(
            state.scrollEndOffsetY,
            state.movingContainer.position.y - deltaY
          );
        }
      }

      if (state.isExiting) {
        if (!state.fadeEnabled || state.motionOutMs <= 0) {
          layer.removeChild(state.card);
          state.card.destroy({ children: true });
          hudOverlayCardStatesById.delete(id);
          continue;
        }

        state.fadeOutElapsedMs += deltaMs;
        const progress = Math.min(1, state.fadeOutElapsedMs / state.motionOutMs);
        state.card.alpha = 1 - progress;

        if (progress >= 1) {
          layer.removeChild(state.card);
          state.card.destroy({ children: true });
          hudOverlayCardStatesById.delete(id);
        }

        continue;
      }

      if (!state.fadeEnabled || state.motionInMs <= 0) {
        state.card.alpha = 1;
        continue;
      }

      state.fadeInElapsedMs += deltaMs;
      const progress = Math.min(1, state.fadeInElapsedMs / state.motionInMs);
      state.card.alpha = progress;
    }
  }

  return {
    layer,
    clear,
    reconcile,
    update
  };
}
