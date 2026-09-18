import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResolvedPlan, ResolvedSlot, TemplateSlotGridPlacement, UiSlotDefinition } from "../orchestration/types";

type CollapseEdge = "left" | "right" | "top" | "bottom";

interface DragState {
  active: boolean;
  slotKey: string | null;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

interface ConfigDrivenLayoutPreviewProps {
  plan: ResolvedPlan;
  slotDefinitions: Record<string, UiSlotDefinition>;
  templateStyleText?: string;
  templateRootClassName?: string;
  templateRootDataSkeleton?: string;
  templateSlotGridPlacements?: Record<string, TemplateSlotGridPlacement>;
  templateSlotClassNames?: Record<string, string>;
  showSlotTechnicalDetailsDefault: boolean;
  slotTechnicalDetailsOverrides: Record<string, boolean>;
  onRequestSlotModeChange?: (slotKey: string, mode: ResolvedSlot["mode"]) => void;
  renderFeature: (slot: ResolvedSlot) => JSX.Element | null;
}

interface NonModalOffset {
  x: number;
  y: number;
}

const NON_MODAL_RIGHT_INSET_PX = 16;
const NON_MODAL_TOP_INSET_PX = 16;

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function parseNonNegativeInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function getSlot(plan: ResolvedPlan, slotKey: string): ResolvedSlot | undefined {
  return plan.slots.find((slot) => slot.slotKey === slotKey);
}

function getSlotMode(plan: ResolvedPlan, slotKey: string): ResolvedSlot["mode"] | "hidden" {
  return getSlot(plan, slotKey)?.mode ?? "hidden";
}

function getSlotDisplayLabel(slotKey: string): string {
  return slotKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function renderSlot(
  plan: ResolvedPlan,
  slotKey: string,
  label: string,
  renderFeature: (slot: ResolvedSlot) => JSX.Element | null,
  isExpanded: boolean,
  onToggleExpanded: (slot: string) => void,
  showTechnicalDetails: boolean,
  collapseToEdge: CollapseEdge,
  fillCell: boolean = false
): JSX.Element | null {
  const slot = getSlot(plan, slotKey);
  const mode = slot?.mode ?? "hidden";
  const isCollapsed = mode === "collapsed";
  const collapseAxis = collapseToEdge === "left" || collapseToEdge === "right" ? "vertical" : "horizontal";
  const isTrailingEdge = collapseToEdge === "right" || collapseToEdge === "bottom";
  const stateClass = mode === "hidden" ? "hidden" : mode === "collapsed" ? "collapsed" : "visible";
  const renderedFeature = slot ? renderFeature(slot) : null;
  const showCollapsedIndicatorOnly = isCollapsed && !isExpanded;
  const showTechnicalDetailsContent = showTechnicalDetails && !showCollapsedIndicatorOnly;

  if (mode === "hidden") {
    return null;
  }

  // Suppress empty wrappers in normal view to prevent phantom layout occupancy.
  if (!showTechnicalDetails && !renderedFeature && !slot?.featureKey) {
    return null;
  }

  return (
    <article
      className={`storyboard-ui-component-slot ${fillCell ? "fill-cell" : ""} ${stateClass} ${isExpanded ? "expanded" : ""} ${showTechnicalDetails ? "technical" : "clean"}`}
      data-mode={mode}
      data-slot-key={slotKey}
      data-collapse-edge={collapseToEdge}
      data-collapse-axis={collapseAxis}
    >
      {showTechnicalDetailsContent ? <h3>{label}</h3> : null}
      {showTechnicalDetailsContent ? <p className="config-slot-meta">slot={slotKey} | mode={mode}</p> : null}
      {showTechnicalDetailsContent ? <p className="config-slot-meta">feature={slot?.featureKey ?? "(none)"} | implementation={slot?.implementationKey ?? "(none)"}</p> : null}

      {isCollapsed ? (() => {
        const collapsedIndicator = (
          <button
            type="button"
            className={`storyboard-collapsed-indicator axis-${collapseAxis} edge-${collapseToEdge} ${isExpanded ? "expanded" : ""}`.trim()}
            aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={isExpanded}
            title={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(slotKey);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleExpanded(slotKey);
              }
            }}
          />
        );

        if (!isExpanded || !isTrailingEdge) {
          return (
            <>
              {collapsedIndicator}
              {isExpanded ? renderedFeature : null}
            </>
          );
        }

        return (
          <>
            {renderedFeature}
            {collapsedIndicator}
          </>
        );
      })() : renderedFeature}
    </article>
  );
}

export function ConfigDrivenLayoutPreview(props: ConfigDrivenLayoutPreviewProps): JSX.Element {
  const [expandedCollapsedSlots, setExpandedCollapsedSlots] = useState<Record<string, boolean>>({});
  const [nonModalOffsets, setNonModalOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [isDraggingNonModal, setIsDraggingNonModal] = useState<boolean>(false);
  const [undockedNonModalSlotKeyInMainWindow, setUndockedNonModalSlotKeyInMainWindow] = useState<string | null>(null);
  const overlayStageRef = useRef<HTMLDivElement | null>(null);
  const nonModalLayerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nonModalDragStateRef = useRef<DragState>({
    active: false,
    slotKey: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  });
  const templateRootClassName = props.templateRootClassName?.trim() ?? "";
  const previewRootClassName = ["storyboard-ui-layout-root", templateRootClassName].filter(Boolean).join(" ");
  const undockedWindowRef = useRef<Window | null>(null);
  const undockedWindowPollRef = useRef<number | null>(null);
  const previousDockedSlotModesRef = useRef<Record<string, ResolvedSlot["mode"]>>({});

  const undockedSlotParam = new URLSearchParams(window.location.search).get("undocked") ?? "";

  function getSlotPresentation(slotKey: string): "overlay-modal" | "overlay-nonmodal" | "overlay-toast" | "inline" {
    return props.slotDefinitions[slotKey]?.behaviorHints?.presentation ?? "inline";
  }

  const isOverlaySlot = (slotKey: string): boolean => {
    const presentation = getSlotPresentation(slotKey);
    return presentation === "overlay-modal" || presentation === "overlay-nonmodal" || presentation === "overlay-toast";
  };

  const overlaySlots = props.plan.slots
    .filter((slot) => isOverlaySlot(slot.slotKey))
    .map((slot) => {
      const slotDefinition = props.slotDefinitions[slot.slotKey];
      const presentation = getSlotPresentation(slot.slotKey);
      const stackOrder = slotDefinition?.behaviorHints?.stackOrder
        ?? (presentation === "overlay-toast" ? 950 : presentation === "overlay-modal" ? 900 : 880);

      return {
        slot,
        slotDefinition,
        presentation,
        stackOrder,
        backdrop: slotDefinition?.behaviorHints?.backdrop ?? "none",
        role: slotDefinition?.behaviorHints?.role
          ?? (presentation === "overlay-modal"
            ? "dialog-layer"
            : presentation === "overlay-toast"
              ? "toast-layer"
              : "nonmodal-layer")
      };
    });

  const activeModalOverlaySlots = overlaySlots.filter((entry) => entry.presentation === "overlay-modal" && entry.slot.mode !== "hidden");
  const activeNonModalOverlaySlots = overlaySlots.filter((entry) => entry.presentation === "overlay-nonmodal" && entry.slot.mode !== "hidden");
  const activeToastOverlaySlots = overlaySlots.filter((entry) => entry.presentation === "overlay-toast" && entry.slot.mode !== "hidden");

  const activeDimModalOverlaySlots = activeModalOverlaySlots.filter((entry) => entry.backdrop === "dim");
  const backdropStackOrder = activeDimModalOverlaySlots.length > 0
    ? Math.max(...activeDimModalOverlaySlots.map((entry) => entry.stackOrder)) - 1
    : 0;

  const activeUndockedNonModalOverlaySlot = activeNonModalOverlaySlots.find((entry) => entry.slot.slotKey === undockedSlotParam) ?? null;
  const isUndockedNonModal = Boolean(activeUndockedNonModalOverlaySlot);
  const nonOverlaySlots = props.plan.slots.filter((slot) => !isOverlaySlot(slot.slotKey));
  const activeDockedNonModalOverlaySlots = activeNonModalOverlaySlots
    .filter((entry) => entry.slot.slotKey !== undockedNonModalSlotKeyInMainWindow)
    .filter((entry) => !isUndockedNonModal || entry.slot.slotKey !== undockedSlotParam);

  function getConstrainedNonModalOffset(slotKey: string, requestedOffset: NonModalOffset): NonModalOffset {
    const overlayStage = overlayStageRef.current;
    const overlayLayer = nonModalLayerRefs.current[slotKey];
    if (!overlayStage || !overlayLayer) {
      return requestedOffset;
    }

    const stageRect = overlayStage.getBoundingClientRect();
    const layerRect = overlayLayer.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0 || layerRect.width <= 0 || layerRect.height <= 0) {
      return requestedOffset;
    }

    const requestedFinalX = requestedOffset.x;
    const requestedFinalY = requestedOffset.y;

    const anchorLeft = stageRect.width - NON_MODAL_RIGHT_INSET_PX - layerRect.width;
    const maxSafeLeft = Math.max(0, stageRect.width - layerRect.width);
    const minLeft = 0;
    const maxLeft = maxSafeLeft;
    const minFinalX = minLeft - anchorLeft;
    const maxFinalX = maxLeft - anchorLeft;

    const anchorTop = NON_MODAL_TOP_INSET_PX;
    const minTop = 0;
    const maxSafeTop = Math.max(0, stageRect.height - layerRect.height);
    const maxTop = maxSafeTop;
    const minFinalY = minTop - anchorTop;
    const maxFinalY = maxTop - anchorTop;

    const constrainedFinalX = clamp(requestedFinalX, minFinalX, maxFinalX);
    const constrainedFinalY = clamp(requestedFinalY, minFinalY, maxFinalY);

    return {
      x: constrainedFinalX,
      y: constrainedFinalY
    };
  }

  function getCenteredNonModalOffset(slotKey: string): NonModalOffset {
    const overlayStage = overlayStageRef.current;
    const overlayLayer = nonModalLayerRefs.current[slotKey];
    if (!overlayStage || !overlayLayer) {
      return { x: 0, y: 0 };
    }

    const stageRect = overlayStage.getBoundingClientRect();
    const layerRect = overlayLayer.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0 || layerRect.width <= 0 || layerRect.height <= 0) {
      return { x: 0, y: 0 };
    }

    const anchorLeft = stageRect.width - NON_MODAL_RIGHT_INSET_PX - layerRect.width;
    const anchorTop = NON_MODAL_TOP_INSET_PX;
    const centeredLeft = Math.max(0, (stageRect.width - layerRect.width) / 2);
    const centeredTop = Math.max(0, (stageRect.height - layerRect.height) / 2);

    return getConstrainedNonModalOffset(slotKey, {
      x: centeredLeft - anchorLeft,
      y: centeredTop - anchorTop
    });
  }

  const activeDockedNonModalSlotKeys = activeDockedNonModalOverlaySlots.map((entry) => entry.slot.slotKey);
  const activeDockedNonModalSlotStateSignature = activeDockedNonModalOverlaySlots
    .map((entry) => `${entry.slot.slotKey}:${entry.slot.mode}`)
    .sort()
    .join("|");

  useEffect(() => {
    const previousModes = previousDockedSlotModesRef.current;
    const nextModes: Record<string, ResolvedSlot["mode"]> = {};
    let newlyVisibleSlotKey: string | null = null;

    for (const entry of activeDockedNonModalOverlaySlots) {
      const slotKey = entry.slot.slotKey;
      const mode = entry.slot.mode;
      nextModes[slotKey] = mode;

      if (mode === "visible" && previousModes[slotKey] !== "visible") {
        newlyVisibleSlotKey = slotKey;
      }
    }

    previousDockedSlotModesRef.current = nextModes;
    if (!newlyVisibleSlotKey) {
      return;
    }

    const slotKeyToCenter = newlyVisibleSlotKey;
    setNonModalOffsets((previous) => {
      const centeredOffset = getCenteredNonModalOffset(slotKeyToCenter);
      const currentOffset = previous[slotKeyToCenter];
      if (currentOffset && currentOffset.x === centeredOffset.x && currentOffset.y === centeredOffset.y && Object.keys(previous).length === 1) {
        return previous;
      }

      return {
        [slotKeyToCenter]: centeredOffset
      };
    });
  }, [activeDockedNonModalOverlaySlots, getCenteredNonModalOffset]);

  const constrainActiveNonModalOffsets = useCallback((): void => {
    if (activeDockedNonModalSlotKeys.length === 0) {
      return;
    }

    setNonModalOffsets((previous) => {
      let changed = false;
      const next = { ...previous };

      for (let index = 0; index < activeDockedNonModalSlotKeys.length; index += 1) {
        const slotKey = activeDockedNonModalSlotKeys[index];
        const hasExistingOffset = previous[slotKey] !== undefined;
        const currentOffset = hasExistingOffset ? previous[slotKey] as NonModalOffset : { x: 0, y: 0 };
        const constrainedOffset = getConstrainedNonModalOffset(slotKey, currentOffset);

        if (!hasExistingOffset || constrainedOffset.x !== currentOffset.x || constrainedOffset.y !== currentOffset.y) {
          next[slotKey] = constrainedOffset;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [activeDockedNonModalSlotKeys, getConstrainedNonModalOffset]);

  const hasExplicitTemplatePlacements = Object.keys(props.templateSlotGridPlacements ?? {}).length > 0;

  const fallbackPlacements = nonOverlaySlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, slot, index) => {
    accumulator[slot.slotKey] = {
      rowStart: Math.floor(index / 4) + 1,
      colStart: (index % 4) + 1,
      rowSpan: 1,
      colSpan: 1
    };
    return accumulator;
  }, {});

  const slotPlacements = nonOverlaySlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, slot) => {
    const placement = props.templateSlotGridPlacements?.[slot.slotKey] ?? fallbackPlacements[slot.slotKey];
    if (placement) {
      accumulator[slot.slotKey] = placement;
    }

    return accumulator;
  }, {});

  function regionsOverlap(
    rowStartA: number,
    rowSpanA: number,
    colStartA: number,
    colSpanA: number,
    rowStartB: number,
    rowSpanB: number,
    colStartB: number,
    colSpanB: number
  ): boolean {
    const rowEndA = rowStartA + rowSpanA - 1;
    const rowEndB = rowStartB + rowSpanB - 1;
    const colEndA = colStartA + colSpanA - 1;
    const colEndB = colStartB + colSpanB - 1;

    const rowOverlap = rowStartA <= rowEndB && rowStartB <= rowEndA;
    const colOverlap = colStartA <= colEndB && colStartB <= colEndA;
    return rowOverlap && colOverlap;
  }

  function toGridStyle(placement: TemplateSlotGridPlacement): CSSProperties {
    return {
      gridRow: `${placement.rowStart} / span ${placement.rowSpan}`,
      gridColumn: `${placement.colStart} / span ${placement.colSpan}`
    };
  }

  function getCollapsedReservationPlacement(slotKey: string, basePlacement: TemplateSlotGridPlacement): TemplateSlotGridPlacement {
    const slotMode = getSlotMode(props.plan, slotKey);
    if (slotMode !== "collapsed" || expandedCollapsedSlots[slotKey]) {
      return basePlacement;
    }

    const collapseToEdge = getSlotCollapseToEdge(slotKey);
    const rowEnd = basePlacement.rowStart + basePlacement.rowSpan - 1;
    const columnEnd = basePlacement.colStart + basePlacement.colSpan - 1;

    if (collapseToEdge === "left") {
      return {
        rowStart: basePlacement.rowStart,
        rowSpan: basePlacement.rowSpan,
        colStart: basePlacement.colStart,
        colSpan: 1
      };
    }

    if (collapseToEdge === "right") {
      return {
        rowStart: basePlacement.rowStart,
        rowSpan: basePlacement.rowSpan,
        colStart: columnEnd,
        colSpan: 1
      };
    }

    if (collapseToEdge === "top") {
      return {
        rowStart: basePlacement.rowStart,
        rowSpan: 1,
        colStart: basePlacement.colStart,
        colSpan: basePlacement.colSpan
      };
    }

    return {
      rowStart: rowEnd,
      rowSpan: 1,
      colStart: basePlacement.colStart,
      colSpan: basePlacement.colSpan
    };
  }

  function shouldParticipateInGridLayout(slot: ResolvedSlot): boolean {
    if (slot.mode === "hidden") {
      return false;
    }

    if (!slot.featureKey) {
      return false;
    }

    if (hasExplicitTemplatePlacements && !props.templateSlotGridPlacements?.[slot.slotKey]) {
      return false;
    }

    return true;
  }

  const gridLayoutSlots = nonOverlaySlots
    .map((slot) => {
      const placement = slotPlacements[slot.slotKey];
      if (!placement || !shouldParticipateInGridLayout(slot)) {
        return null;
      }

      const isCollapsedUnexpanded = slot.mode === "collapsed" && !expandedCollapsedSlots[slot.slotKey];

      return {
        slot,
        basePlacement: placement,
        isCollapsedUnexpanded,
        isLayoutOccupied: slot.mode !== "collapsed" || Boolean(expandedCollapsedSlots[slot.slotKey])
      };
    })
    .filter((entry): entry is {
      slot: ResolvedSlot;
      basePlacement: TemplateSlotGridPlacement;
      isCollapsedUnexpanded: boolean;
      isLayoutOccupied: boolean;
    } => Boolean(entry));

  const maxGridRow = gridLayoutSlots.reduce((currentMax, entry) => {
    const placement = entry.basePlacement;
    const placementEndRow = placement.rowStart + placement.rowSpan - 1;
    return placementEndRow > currentMax ? placementEndRow : currentMax;
  }, 0);

  const maxGridColumn = gridLayoutSlots.reduce((currentMax, entry) => {
    const placement = entry.basePlacement;
    const placementEndColumn = placement.colStart + placement.colSpan - 1;
    return placementEndColumn > currentMax ? placementEndColumn : currentMax;
  }, 0);

  const collapsedReservationPlacements = gridLayoutSlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, entry) => {
    accumulator[entry.slot.slotKey] = getCollapsedReservationPlacement(entry.slot.slotKey, entry.basePlacement);
    return accumulator;
  }, {});

  function isBlockedByOtherGridSlot(
    slotKey: string,
    rowStart: number,
    rowSpan: number,
    colStart: number,
    colSpan: number,
    placements: Record<string, TemplateSlotGridPlacement>
  ): boolean {
    for (const [otherSlotKey, otherPlacement] of Object.entries(placements)) {
      if (otherSlotKey === slotKey) {
        continue;
      }

      if (
        regionsOverlap(
          rowStart,
          rowSpan,
          colStart,
          colSpan,
          otherPlacement.rowStart,
          otherPlacement.rowSpan,
          otherPlacement.colStart,
          otherPlacement.colSpan
        )
      ) {
        return true;
      }
    }

    return false;
  }

  const collapsedEffectivePlacements = gridLayoutSlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, entry) => {
    const slotKey = entry.slot.slotKey;
    const collapseToEdge = getSlotCollapseToEdge(slotKey);
    let placement = collapsedReservationPlacements[slotKey];

    if (entry.isCollapsedUnexpanded && (collapseToEdge === "left" || collapseToEdge === "right") && maxGridRow > 0) {
      while (placement.rowStart + placement.rowSpan - 1 < maxGridRow) {
        const nextRowStart = placement.rowStart + placement.rowSpan;
        const blocked = isBlockedByOtherGridSlot(
          slotKey,
          nextRowStart,
          1,
          placement.colStart,
          placement.colSpan,
          collapsedReservationPlacements
        );

        if (blocked) {
          break;
        }

        placement = {
          ...placement,
          rowSpan: placement.rowSpan + 1
        };
      }
    }

    accumulator[slotKey] = placement;
    return accumulator;
  }, {});

  const reflowOccupancyPlacements = gridLayoutSlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, entry) => {
    const slotKey = entry.slot.slotKey;
    accumulator[slotKey] = entry.isCollapsedUnexpanded
      ? collapsedEffectivePlacements[slotKey]
      : entry.basePlacement;
    return accumulator;
  }, {});

  const effectiveRenderPlacements = gridLayoutSlots.reduce<Record<string, TemplateSlotGridPlacement>>((accumulator, entry) => {
    const slotKey = entry.slot.slotKey;
    if (!entry.isLayoutOccupied || maxGridColumn <= 0) {
      accumulator[slotKey] = reflowOccupancyPlacements[slotKey];
      return accumulator;
    }

    const initialPlacement = entry.basePlacement;
    let effectiveRowStart = initialPlacement.rowStart;
    let effectiveRowSpan = initialPlacement.rowSpan;
    let effectiveColumnStart = initialPlacement.colStart;
    let effectiveColumnSpan = initialPlacement.colSpan;

    while (effectiveColumnStart > 1) {
      const previousColumnStart = effectiveColumnStart - 1;
      const blocked = isBlockedByOtherGridSlot(
        slotKey,
        effectiveRowStart,
        effectiveRowSpan,
        previousColumnStart,
        1,
        reflowOccupancyPlacements
      );

      if (blocked) {
        break;
      }

      effectiveColumnStart = previousColumnStart;
      effectiveColumnSpan += 1;
    }

    while (effectiveColumnStart + effectiveColumnSpan - 1 < maxGridColumn) {
      const nextColumnStart = effectiveColumnStart + effectiveColumnSpan;
      const blocked = isBlockedByOtherGridSlot(
        slotKey,
        effectiveRowStart,
        effectiveRowSpan,
        nextColumnStart,
        1,
        reflowOccupancyPlacements
      );

      if (blocked) {
        break;
      }

      effectiveColumnSpan += 1;
    }

    if (maxGridRow > 0) {
      while (effectiveRowStart + effectiveRowSpan - 1 < maxGridRow) {
        const nextRowStart = effectiveRowStart + effectiveRowSpan;
        const blocked = isBlockedByOtherGridSlot(
          slotKey,
          nextRowStart,
          1,
          effectiveColumnStart,
          effectiveColumnSpan,
          reflowOccupancyPlacements
        );

        if (blocked) {
          break;
        }

        effectiveRowSpan += 1;
      }
    }

    accumulator[slotKey] = {
      rowStart: effectiveRowStart,
      rowSpan: effectiveRowSpan,
      colStart: effectiveColumnStart,
      colSpan: effectiveColumnSpan
    };
    return accumulator;
  }, {});

  function getLayoutStageStyle(): CSSProperties | undefined {
    const collapsedSlots = gridLayoutSlots.filter((entry) => entry.isCollapsedUnexpanded);
    if (collapsedSlots.length === 0) {
      return undefined;
    }

    const style: CSSProperties = {};
    let hasOverrides = false;

    const nonCollapsedLayoutPlacements = gridLayoutSlots
      .filter((entry) => entry.isLayoutOccupied)
      .map((entry) => entry.basePlacement);

    for (const entry of collapsedSlots) {
      const slotKey = entry.slot.slotKey;
      const placement = collapsedEffectivePlacements[slotKey];
      if (!placement) {
        continue;
      }

      const collapseToEdge = getSlotCollapseToEdge(slotKey);
      const rowEnd = placement.rowStart + placement.rowSpan - 1;
      const columnEnd = placement.colStart + placement.colSpan - 1;

      if (collapseToEdge === "left") {
        let blocked = false;
        for (const otherPlacement of nonCollapsedLayoutPlacements) {
          const overlaps = regionsOverlap(
            placement.rowStart,
            placement.rowSpan,
            placement.colStart,
            1,
            otherPlacement.rowStart,
            otherPlacement.rowSpan,
            otherPlacement.colStart,
            otherPlacement.colSpan
          );

          if (overlaps) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          (style as Record<string, string>)[`--storyboard-ui-grid-col-${placement.colStart}`] = "var(--theme-size-collapsed-component-thickness)";
          hasOverrides = true;
        }
      } else if (collapseToEdge === "right") {
        let blocked = false;
        for (const otherPlacement of nonCollapsedLayoutPlacements) {
          const overlaps = regionsOverlap(
            placement.rowStart,
            placement.rowSpan,
            columnEnd,
            1,
            otherPlacement.rowStart,
            otherPlacement.rowSpan,
            otherPlacement.colStart,
            otherPlacement.colSpan
          );

          if (overlaps) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          (style as Record<string, string>)[`--storyboard-ui-grid-col-${columnEnd}`] = "var(--theme-size-collapsed-component-thickness)";
          hasOverrides = true;
        }
      } else if (collapseToEdge === "top") {
        let blocked = false;
        for (const otherPlacement of nonCollapsedLayoutPlacements) {
          const overlaps = regionsOverlap(
            placement.rowStart,
            1,
            placement.colStart,
            placement.colSpan,
            otherPlacement.rowStart,
            otherPlacement.rowSpan,
            otherPlacement.colStart,
            otherPlacement.colSpan
          );

          if (overlaps) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          (style as Record<string, string>)[`--storyboard-ui-grid-row-${placement.rowStart}`] = "var(--theme-size-collapsed-component-thickness)";
          hasOverrides = true;
        }
      } else {
        let blocked = false;
        for (const otherPlacement of nonCollapsedLayoutPlacements) {
          const overlaps = regionsOverlap(
            rowEnd,
            1,
            placement.colStart,
            placement.colSpan,
            otherPlacement.rowStart,
            otherPlacement.rowSpan,
            otherPlacement.colStart,
            otherPlacement.colSpan
          );

          if (overlaps) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          (style as Record<string, string>)[`--storyboard-ui-grid-row-${rowEnd}`] = "var(--theme-size-collapsed-component-thickness)";
          hasOverrides = true;
        }
      }
    }

    return hasOverrides ? style : undefined;
  }

  useEffect(() => {
    setExpandedCollapsedSlots({});
  }, [props.plan.experienceState, props.plan.compositionProfileKey, props.plan.skeletonLayoutKey]);

  const slotModeSignature = props.plan.slots
    .map((slot) => `${slot.slotKey}:${slot.mode}`)
    .sort()
    .join("|");

  useEffect(() => {
    setExpandedCollapsedSlots({});
  }, [slotModeSignature]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      constrainActiveNonModalOffsets();
    });

    // Some overlays report zero bounds on the first frame after mode transitions.
    // Re-apply constraints briefly so late layout settles still snap back into view.
    let remainingRetries = 12;
    const retryTimer = window.setInterval(() => {
      constrainActiveNonModalOffsets();
      remainingRetries -= 1;
      if (remainingRetries <= 0) {
        window.clearInterval(retryTimer);
      }
    }, 125);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(retryTimer);
    };
  }, [activeDockedNonModalSlotStateSignature, constrainActiveNonModalOffsets]);

  useEffect(() => {
    function handleWindowResize(): void {
      constrainActiveNonModalOffsets();
    }

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [constrainActiveNonModalOffsets]);

  useEffect(() => {
    function clearUndockedPoll(): void {
      if (undockedWindowPollRef.current !== null) {
        window.clearInterval(undockedWindowPollRef.current);
        undockedWindowPollRef.current = null;
      }
    }

    function handleMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as { type?: string; slotKey?: string } | undefined;
      if (data?.type === "NON_MODAL_DOCK_BACK") {
        setUndockedNonModalSlotKeyInMainWindow((previous) => (
          data.slotKey && previous === data.slotKey ? null : previous
        ));
        clearUndockedPoll();
      }

      if (data?.type === "NON_MODAL_CLOSE" && data.slotKey) {
        requestCloseOverlaySlot(data.slotKey);
        setUndockedNonModalSlotKeyInMainWindow((previous) => (
          previous === data.slotKey ? null : previous
        ));
        clearUndockedPoll();
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearUndockedPoll();
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent): void {
      const dragState = nonModalDragStateRef.current;
      if (!dragState.active) {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      if (!dragState.slotKey) {
        return;
      }

      setNonModalOffsets((previous) => ({
        ...previous,
        [dragState.slotKey as string]: {
          x: dragState.startOffsetX + deltaX,
          y: dragState.startOffsetY + deltaY
        }
      }));
    }

    function stopDragging(pointerId: number | null): void {
      const dragState = nonModalDragStateRef.current;
      if (!dragState.active) {
        return;
      }

      if (pointerId !== null && dragState.pointerId !== null && pointerId !== dragState.pointerId) {
        return;
      }

      dragState.active = false;
      dragState.slotKey = null;
      dragState.pointerId = null;
      setIsDraggingNonModal(false);
    }

    function handlePointerUp(event: PointerEvent): void {
      stopDragging(event.pointerId);
    }

    function handlePointerCancel(event: PointerEvent): void {
      stopDragging(event.pointerId);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  function toggleExpanded(slotKey: string): void {
    setExpandedCollapsedSlots((previous) => ({
      ...previous,
      [slotKey]: !previous[slotKey]
    }));
  }

  function requestCloseOverlaySlot(slotKey: string): void {
    props.onRequestSlotModeChange?.(slotKey, "hidden");
  }

  function shouldShowSlotTechnicalDetails(slotKey: string): boolean {
    if (Object.prototype.hasOwnProperty.call(props.slotTechnicalDetailsOverrides, slotKey)) {
      return Boolean(props.slotTechnicalDetailsOverrides[slotKey]);
    }

    return props.showSlotTechnicalDetailsDefault;
  }

  function getSlotCollapseToEdge(slotKey: string): CollapseEdge {
    return props.slotDefinitions[slotKey]?.behaviorHints?.collapseToEdge ?? "top";
  }

  function beginNonModalDrag(slotKey: string, event: ReactPointerEvent<HTMLButtonElement>): void {
    const currentOffset = nonModalOffsets[slotKey] ?? { x: 0, y: 0 };
    const constrainedOffset = getConstrainedNonModalOffset(slotKey, currentOffset);

    if (constrainedOffset.x !== currentOffset.x || constrainedOffset.y !== currentOffset.y) {
      setNonModalOffsets((previous) => ({
        ...previous,
        [slotKey]: constrainedOffset
      }));
    }

    const dragState = nonModalDragStateRef.current;
    dragState.active = true;
    dragState.slotKey = slotKey;
    dragState.pointerId = event.pointerId;
    dragState.startClientX = event.clientX;
    dragState.startClientY = event.clientY;
    dragState.startOffsetX = constrainedOffset.x;
    dragState.startOffsetY = constrainedOffset.y;

    setIsDraggingNonModal(true);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function openUndockedNonModalWindow(slotKey: string): void {
    const undockedUrl = new URL(window.location.href);
    undockedUrl.searchParams.set("rm", "config");
    undockedUrl.searchParams.set(slotKey, "visible");
    undockedUrl.searchParams.set("undocked", slotKey);

    const desiredWidth = 720;
    const desiredHeight = 920;
    const screenAvailWidth = window.screen.availWidth || desiredWidth;
    const screenAvailHeight = window.screen.availHeight || desiredHeight;
    const popupWidth = Math.max(420, Math.min(desiredWidth, screenAvailWidth));
    const popupHeight = Math.max(520, Math.min(desiredHeight, screenAvailHeight));

    const maxLeftWithinScreen = Math.max(0, screenAvailWidth - popupWidth);
    const maxTopWithinScreen = Math.max(0, screenAvailHeight - popupHeight);
    const centeredLeft = Math.round((screenAvailWidth - popupWidth) / 2);
    const centeredTop = Math.round((screenAvailHeight - popupHeight) / 2);

    const requestedLeft = parseNonNegativeInt(undockedUrl.searchParams.get("undockedLeft") ?? "");
    const requestedTop = parseNonNegativeInt(undockedUrl.searchParams.get("undockedTop") ?? "");
    const popupLeft = clamp(requestedLeft ?? centeredLeft, 0, maxLeftWithinScreen);
    const popupTop = clamp(requestedTop ?? centeredTop, 0, maxTopWithinScreen);

    undockedUrl.searchParams.set("undockedLeft", popupLeft.toString());
    undockedUrl.searchParams.set("undockedTop", popupTop.toString());

    const popup = window.open(
      `${undockedUrl.pathname}${undockedUrl.search}${undockedUrl.hash}`,
      `storyboard-nonmodal-undocked-${slotKey}`,
      `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      setUndockedNonModalSlotKeyInMainWindow(null);
      return;
    }

    setUndockedNonModalSlotKeyInMainWindow(slotKey);
    undockedWindowRef.current = popup;

    try {
      popup.resizeTo(popupWidth, popupHeight);
      popup.moveTo(popupLeft, popupTop);
    } catch {
      // Some browsers can block move/resize calls; rely on window.open features when blocked.
    }

    if (undockedWindowPollRef.current !== null) {
      window.clearInterval(undockedWindowPollRef.current);
      undockedWindowPollRef.current = null;
    }

    undockedWindowPollRef.current = window.setInterval(() => {
      const undockedWindow = undockedWindowRef.current;
      if (!undockedWindow || undockedWindow.closed) {
        setUndockedNonModalSlotKeyInMainWindow(null);

        if (undockedWindowPollRef.current !== null) {
          window.clearInterval(undockedWindowPollRef.current);
          undockedWindowPollRef.current = null;
        }

        undockedWindowRef.current = null;
      }
    }, 400);

    popup?.focus();
  }

  function dockBackToMainWindow(slotKey: string): void {
    const dockedUrl = new URL(window.location.href);
    dockedUrl.searchParams.delete("undocked");

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "NON_MODAL_DOCK_BACK", slotKey }, window.location.origin);
        window.opener.focus();
      } catch {
        // Ignore cross-window focus errors.
      }

      window.close();
      return;
    }

    window.location.replace(`${dockedUrl.pathname}${dockedUrl.search}${dockedUrl.hash}`);
  }

  function closeUndockedNonModalWindow(slotKey: string): void {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "NON_MODAL_CLOSE", slotKey }, window.location.origin);
        window.opener.focus();
      } catch {
        // Ignore cross-window focus errors.
      }

      window.close();
      return;
    }

    requestCloseOverlaySlot(slotKey);
  }

  const placedExpandedNonOverlaySlots = gridLayoutSlots
    .filter((entry) => entry.isLayoutOccupied)
    .map((entry) => ({ slot: entry.slot, placement: effectiveRenderPlacements[entry.slot.slotKey] }))
    .filter((entry): entry is { slot: ResolvedSlot; placement: TemplateSlotGridPlacement } => Boolean(entry.placement))
    .sort((a, b) => {
      if (a.placement.rowStart !== b.placement.rowStart) {
        return a.placement.rowStart - b.placement.rowStart;
      }

      return a.placement.colStart - b.placement.colStart;
    });

  const placedCollapsedNonOverlaySlots = gridLayoutSlots
    .filter((entry) => entry.isCollapsedUnexpanded)
    .map((entry) => ({ slot: entry.slot, placement: collapsedEffectivePlacements[entry.slot.slotKey] }))
    .filter((entry): entry is { slot: ResolvedSlot; placement: TemplateSlotGridPlacement } => Boolean(entry.placement))
    .sort((a, b) => {
      if (a.placement.rowStart !== b.placement.rowStart) {
        return a.placement.rowStart - b.placement.rowStart;
      }

      return a.placement.colStart - b.placement.colStart;
    });

  return (
    <section
      className={`${previewRootClassName} ${isUndockedNonModal ? "is-undocked" : ""}`.trim()}
      data-skeleton={props.templateRootDataSkeleton ?? props.plan.skeletonLayoutKey}
      data-skeleton-layout={props.plan.skeletonLayoutKey}
    >
      {props.templateStyleText ? <style>{props.templateStyleText}</style> : null}

      {isUndockedNonModal ? (
        <div className="undocked-panel-stage">
          {activeUndockedNonModalOverlaySlot ? (
            <div className="nonmodal-shell undocked">
              <div className="nonmodal-toolbar">
                <button
                  type="button"
                  className="nonmodal-dock-button"
                  onClick={() => dockBackToMainWindow(activeUndockedNonModalOverlaySlot.slot.slotKey)}
                >
                  Dock Back
                </button>
                <button
                  type="button"
                  className="nonmodal-dock-button"
                  onClick={() => closeUndockedNonModalWindow(activeUndockedNonModalOverlaySlot.slot.slotKey)}
                >
                  Close
                </button>
              </div>
              {renderSlot(
                props.plan,
                activeUndockedNonModalOverlaySlot.slot.slotKey,
                getSlotDisplayLabel(activeUndockedNonModalOverlaySlot.slot.slotKey),
                props.renderFeature,
                Boolean(expandedCollapsedSlots[activeUndockedNonModalOverlaySlot.slot.slotKey]),
                toggleExpanded,
                shouldShowSlotTechnicalDetails(activeUndockedNonModalOverlaySlot.slot.slotKey),
                getSlotCollapseToEdge(activeUndockedNonModalOverlaySlot.slot.slotKey)
              )}
            </div>
          ) : (
            <p className="subtitle">Non-modal layer is currently hidden for this state/profile.</p>
          )}
        </div>
      ) : null}

      {isUndockedNonModal ? null : (
        <div className="storyboard-ui-layout-stage" style={getLayoutStageStyle()}>
          <div className="storyboard-ui-layout-grid">
            {placedExpandedNonOverlaySlots.map(({ slot, placement }) => {
              const content = renderSlot(
                props.plan,
                slot.slotKey,
                getSlotDisplayLabel(slot.slotKey),
                props.renderFeature,
                Boolean(expandedCollapsedSlots[slot.slotKey]),
                toggleExpanded,
                shouldShowSlotTechnicalDetails(slot.slotKey),
                getSlotCollapseToEdge(slot.slotKey),
                true
              );

              if (!content) {
                return null;
              }

              const templateClassName = props.templateSlotClassNames?.[slot.slotKey] ?? "";
              const slotKindClass = props.slotDefinitions[slot.slotKey]?.kind
                ? `slot-kind-${props.slotDefinitions[slot.slotKey].kind}`
                : "";

              return (
                <div
                  key={slot.slotKey}
                  className={`storyboard-ui-grid-cell ${templateClassName} ${slotKindClass} slot-${slot.slotKey} slot-mode-${getSlotMode(props.plan, slot.slotKey)}`.trim()}
                  data-slot-key={slot.slotKey}
                  data-slot-kind={props.slotDefinitions[slot.slotKey]?.kind ?? "unknown"}
                  style={toGridStyle(placement)}
                >
                  {content}
                </div>
              );
            })}

            {placedCollapsedNonOverlaySlots.map(({ slot, placement }) => {
              const content = renderSlot(
                props.plan,
                slot.slotKey,
                getSlotDisplayLabel(slot.slotKey),
                props.renderFeature,
                Boolean(expandedCollapsedSlots[slot.slotKey]),
                toggleExpanded,
                shouldShowSlotTechnicalDetails(slot.slotKey),
                getSlotCollapseToEdge(slot.slotKey),
                true
              );

              if (!content) {
                return null;
              }

              const templateClassName = props.templateSlotClassNames?.[slot.slotKey] ?? "";
              const slotKindClass = props.slotDefinitions[slot.slotKey]?.kind
                ? `slot-kind-${props.slotDefinitions[slot.slotKey].kind}`
                : "";

              return (
                <div
                  key={`collapsed-${slot.slotKey}`}
                  className={`storyboard-ui-grid-cell ${templateClassName} ${slotKindClass} slot-${slot.slotKey} slot-mode-${getSlotMode(props.plan, slot.slotKey)}`.trim()}
                  data-slot-key={slot.slotKey}
                  data-slot-kind={props.slotDefinitions[slot.slotKey]?.kind ?? "unknown"}
                  style={toGridStyle(placement)}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <div className="config-overlay-stage" ref={overlayStageRef}>
            {activeDimModalOverlaySlots.length > 0 ? <div className="config-overlay-backdrop" aria-hidden="true" style={{ zIndex: backdropStackOrder }} /> : null}

            {activeModalOverlaySlots.map((entry) => (
              <div
                key={`modal-${entry.slot.slotKey}`}
                className="config-overlay-layer modal-layer layout-overlay-modal"
                data-slot-key={entry.slot.slotKey}
                data-slot-role={entry.role}
                style={{ zIndex: entry.stackOrder }}
              >
                <div className="nonmodal-toolbar">
                  <button
                    type="button"
                    className="nonmodal-undock-button"
                    onClick={() => requestCloseOverlaySlot(entry.slot.slotKey)}
                    aria-label={`Close ${getSlotDisplayLabel(entry.slot.slotKey)}`}
                  >
                    Close
                  </button>
                </div>
                {renderSlot(
                  props.plan,
                  entry.slot.slotKey,
                  getSlotDisplayLabel(entry.slot.slotKey),
                  props.renderFeature,
                  Boolean(expandedCollapsedSlots[entry.slot.slotKey]),
                  toggleExpanded,
                  shouldShowSlotTechnicalDetails(entry.slot.slotKey),
                  getSlotCollapseToEdge(entry.slot.slotKey)
                )}
              </div>
            ))}

            {activeDockedNonModalOverlaySlots
              .map((entry) => {
                const slotKey = entry.slot.slotKey;
                const nonModalOffset = nonModalOffsets[slotKey] ?? { x: 0, y: 0 };
                const constrainedOffset = getConstrainedNonModalOffset(slotKey, nonModalOffset);

                return (
                  <div
                    key={`nonmodal-${slotKey}`}
                    className="config-overlay-layer nonmodal-layer layout-overlay-nonmodal"
                    data-slot-key={slotKey}
                    data-slot-role={entry.role}
                    ref={(element) => {
                      nonModalLayerRefs.current[slotKey] = element;
                    }}
                    style={{
                      zIndex: entry.stackOrder,
                      transform: `translate(${constrainedOffset.x}px, ${constrainedOffset.y}px)`
                    }}
                  >
                    <div className="nonmodal-shell">
                      <div className="nonmodal-toolbar">
                        <button
                          type="button"
                          className={`nonmodal-drag-handle ${isDraggingNonModal && nonModalDragStateRef.current.slotKey === slotKey ? "dragging" : ""}`}
                          onPointerDown={(event) => beginNonModalDrag(slotKey, event)}
                          aria-label={`Drag ${getSlotDisplayLabel(slotKey)}`}
                        >
                          Drag
                        </button>
                        <button
                          type="button"
                          className="nonmodal-undock-button"
                          onClick={() => openUndockedNonModalWindow(slotKey)}
                          aria-label={`Undock ${getSlotDisplayLabel(slotKey)}`}
                        >
                          Undock
                        </button>
                        <button
                          type="button"
                          className="nonmodal-undock-button"
                          onClick={() => requestCloseOverlaySlot(slotKey)}
                          aria-label={`Close ${getSlotDisplayLabel(slotKey)}`}
                        >
                          Close
                        </button>
                      </div>
                      {renderSlot(
                        props.plan,
                        slotKey,
                        getSlotDisplayLabel(slotKey),
                        props.renderFeature,
                        Boolean(expandedCollapsedSlots[slotKey]),
                        toggleExpanded,
                        shouldShowSlotTechnicalDetails(slotKey),
                        getSlotCollapseToEdge(slotKey)
                      )}
                    </div>
                  </div>
                );
              })}

            {activeToastOverlaySlots.map((entry) => (
              <div
                key={`toast-${entry.slot.slotKey}`}
                className="config-overlay-layer toast-layer layout-overlay-toast"
                data-slot-key={entry.slot.slotKey}
                data-slot-role={entry.role}
                style={{ zIndex: entry.stackOrder }}
              >
                {renderSlot(
                  props.plan,
                  entry.slot.slotKey,
                  getSlotDisplayLabel(entry.slot.slotKey),
                  props.renderFeature,
                  Boolean(expandedCollapsedSlots[entry.slot.slotKey]),
                  toggleExpanded,
                  shouldShowSlotTechnicalDetails(entry.slot.slotKey),
                  getSlotCollapseToEdge(entry.slot.slotKey)
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
