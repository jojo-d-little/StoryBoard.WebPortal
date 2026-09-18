import { useEffect, useMemo, useState } from "react";
import type { GameRenderSceneSnapshot } from "../gameRenderer";
import type { GameRenderTravelDirection } from "../gameRenderer/contracts/sceneTypes";
import {
  resolveAppearanceOutlineStyle,
  resolveAppearanceSilhouetteStyle,
  resolveCatalogCueDurationMs,
  resolveCatalogRoomTransitionMode,
  resolveMovementCueDurationMs,
  type PresentationCueCatalogDocument
} from "../gameRenderer/presentationCue/resolveMovementCueDuration";

export interface RoomTransitionCueOption {
  effectKey: string;
  displayName: string;
  durationMs?: number;
  mode?: "slide" | "fade" | "fade-blackout";
}

export interface RoomTransitionCatalogStatus {
  loaded: boolean;
  source: "none" | "cache" | "network";
  relativeLocator: string;
  gameId: string;
  gameKey: string;
  effectCount: number;
  roomTransitionCount: number;
  selectedCueEffectKey: string;
  selectedCueDurationMs?: number;
  usingFallbackDuration: boolean;
  lastError?: string;
}

interface UseRoomTransitionCueWorkflowOptions {
  roomTransitionDefaults: {
    enabled: boolean;
    cueCategory: string;
    cueEffectKey: string;
    cueEffectKeyOverridesByTravelDirection: Partial<Record<GameRenderTravelDirection, string>>;
    respectTravelDirection: boolean;
    fallbackDurationMs: number;
  };
  presentationCueCatalogRelativeLocator: string;
  selectedGameId: string;
  selectedGameKey: string;
  presentationCueCatalogRevision: number;
  presentationCueCatalogSource: "none" | "cache" | "network";
  presentationCueCatalogError: string;
  rendererSceneSnapshot: GameRenderSceneSnapshot | null;
  getCurrentPresentationCueCatalog: () => PresentationCueCatalogDocument | null;
}

interface UseRoomTransitionCueWorkflowResult {
  roomTransitionCueOptions: RoomTransitionCueOption[];
  selectedRoomTransitionCueEffectKey: string;
  setSelectedRoomTransitionCueEffectKey: (effectKey: string) => void;
  roomTransitionCatalogStatus: RoomTransitionCatalogStatus;
  applyMovementCueDurations: (scene: GameRenderSceneSnapshot) => GameRenderSceneSnapshot;
}

function stringEqualsIgnoreCase(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function normalizeTravelDirection(direction: string | undefined): GameRenderTravelDirection | undefined {
  switch ((direction ?? "").trim().toLowerCase()) {
    case "north":
      return "North";
    case "northeast":
      return "NorthEast";
    case "east":
      return "East";
    case "southeast":
      return "SouthEast";
    case "south":
      return "South";
    case "southwest":
      return "SouthWest";
    case "west":
      return "West";
    case "northwest":
      return "NorthWest";
    case "up":
      return "Up";
    case "down":
      return "Down";
    default:
      return undefined;
  }
}

function tryResolveCatalogEffectKey(
  catalog: PresentationCueCatalogDocument | null,
  category: string,
  effectKey: string | undefined
): string | undefined {
  const requestedEffectKey = (effectKey ?? "").trim();
  if (!catalog?.effects || requestedEffectKey.length === 0) {
    return undefined;
  }

  for (const effect of catalog.effects) {
    const effectCategory = (effect.category ?? "").trim();
    const catalogEffectKey = (effect.effectKey ?? "").trim();
    if (!effectCategory || !catalogEffectKey) {
      continue;
    }

    if (!stringEqualsIgnoreCase(effectCategory, category)) {
      continue;
    }

    if (stringEqualsIgnoreCase(catalogEffectKey, requestedEffectKey)) {
      return catalogEffectKey;
    }
  }

  return undefined;
}

export function useRoomTransitionCueWorkflow(
  options: UseRoomTransitionCueWorkflowOptions
): UseRoomTransitionCueWorkflowResult {
  const [selectedRoomTransitionCueEffectKey, setSelectedRoomTransitionCueEffectKey] = useState<string>("");

  function resolveConfiguredRoomTransitionCueEffectKey(
    travelDirection: GameRenderTravelDirection | undefined,
    sceneCueEffectKey: string | undefined,
    catalog: PresentationCueCatalogDocument | null
  ): string {
    const manuallySelectedCueEffectKey = selectedRoomTransitionCueEffectKey.trim();
    if (manuallySelectedCueEffectKey.length > 0) {
      return manuallySelectedCueEffectKey;
    }

    const runtimeCueEffectKey = tryResolveCatalogEffectKey(
      catalog,
      options.roomTransitionDefaults.cueCategory,
      sceneCueEffectKey
    );
    if (runtimeCueEffectKey) {
      return runtimeCueEffectKey;
    }

    if (!options.roomTransitionDefaults.respectTravelDirection || !travelDirection) {
      return options.roomTransitionDefaults.cueEffectKey;
    }

    const overrideCueEffectKey = options.roomTransitionDefaults.cueEffectKeyOverridesByTravelDirection[travelDirection]?.trim();
    if (overrideCueEffectKey) {
      return overrideCueEffectKey;
    }

    return options.roomTransitionDefaults.cueEffectKey;
  }

  const roomTransitionCueOptions = useMemo<RoomTransitionCueOption[]>(() => {
    const catalog = options.getCurrentPresentationCueCatalog();
    if (!catalog?.effects || catalog.effects.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const optionsList: RoomTransitionCueOption[] = [];
    for (const effect of catalog.effects) {
      const category = (effect.category ?? "").trim();
      const effectKey = (effect.effectKey ?? "").trim();
      if (!category || !effectKey) {
        continue;
      }

      if (!stringEqualsIgnoreCase(category, options.roomTransitionDefaults.cueCategory)) {
        continue;
      }

      const dedupeKey = effectKey.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      optionsList.push({
        effectKey,
        displayName: (effect.displayName ?? "").trim() || effectKey,
        durationMs: resolveCatalogCueDurationMs(catalog, category, effectKey),
        mode: resolveCatalogRoomTransitionMode(catalog, category, effectKey)
      });
    }

    return optionsList;
  }, [
    options.getCurrentPresentationCueCatalog,
    options.roomTransitionDefaults.cueCategory,
    options.roomTransitionDefaults.cueEffectKey,
    options.roomTransitionDefaults.fallbackDurationMs,
    options.presentationCueCatalogRelativeLocator,
    options.selectedGameId,
    options.selectedGameKey,
    options.presentationCueCatalogRevision
  ]);

  const roomTransitionCatalogStatus = useMemo<RoomTransitionCatalogStatus>(() => {
    const catalog = options.getCurrentPresentationCueCatalog();
    const effects = catalog?.effects ?? [];
    const roomTransitionEffects = effects.filter((effect) => {
      const category = (effect.category ?? "").trim();
      return category.length > 0 && stringEqualsIgnoreCase(category, options.roomTransitionDefaults.cueCategory);
    });

    const activeTravelDirection = options.roomTransitionDefaults.respectTravelDirection
      ? normalizeTravelDirection(options.rendererSceneSnapshot?.roomTransition?.travelDirection)
      : undefined;
    const selectedCueEffectKey = resolveConfiguredRoomTransitionCueEffectKey(
      activeTravelDirection,
      options.rendererSceneSnapshot?.roomTransition?.cueEffectKey,
      catalog
    );
    const selectedCueDurationMs = resolveCatalogCueDurationMs(
      catalog,
      options.roomTransitionDefaults.cueCategory,
      selectedCueEffectKey
    );

    return {
      loaded: Boolean(catalog),
      source: options.presentationCueCatalogSource,
      relativeLocator: options.presentationCueCatalogRelativeLocator,
      gameId: options.selectedGameId,
      gameKey: options.selectedGameKey,
      effectCount: effects.length,
      roomTransitionCount: roomTransitionEffects.length,
      selectedCueEffectKey,
      selectedCueDurationMs,
      usingFallbackDuration: options.roomTransitionDefaults.enabled && selectedCueDurationMs === undefined,
      lastError: options.presentationCueCatalogError || undefined
    };
  }, [
    options.presentationCueCatalogError,
    options.getCurrentPresentationCueCatalog,
    options.presentationCueCatalogRelativeLocator,
    options.presentationCueCatalogSource,
    options.rendererSceneSnapshot,
    options.roomTransitionDefaults.cueCategory,
    options.roomTransitionDefaults.cueEffectKey,
    options.roomTransitionDefaults.cueEffectKeyOverridesByTravelDirection,
    options.roomTransitionDefaults.enabled,
    options.roomTransitionDefaults.respectTravelDirection,
    options.selectedGameId,
    options.selectedGameKey,
    selectedRoomTransitionCueEffectKey
  ]);

  useEffect(() => {
    if (roomTransitionCueOptions.length === 0) {
      return;
    }

    if (selectedRoomTransitionCueEffectKey.trim().length === 0) {
      return;
    }

    const hasSelected = roomTransitionCueOptions.some((option) => {
      return stringEqualsIgnoreCase(option.effectKey, selectedRoomTransitionCueEffectKey);
    });

    if (!hasSelected) {
      setSelectedRoomTransitionCueEffectKey(roomTransitionCueOptions[0].effectKey);
    }
  }, [roomTransitionCueOptions, selectedRoomTransitionCueEffectKey]);

  function applyMovementCueDurations(scene: GameRenderSceneSnapshot): GameRenderSceneSnapshot {
    const catalog = options.getCurrentPresentationCueCatalog();
    const transition = scene.roomTransition;
    const transitionTravelDirection = options.roomTransitionDefaults.respectTravelDirection
      ? normalizeTravelDirection(transition?.travelDirection)
      : undefined;
    const configuredCueEffectKey = resolveConfiguredRoomTransitionCueEffectKey(
      transitionTravelDirection,
      transition?.cueEffectKey,
      catalog
    );
    const configuredRoomTransitionMode = resolveCatalogRoomTransitionMode(
      catalog,
      options.roomTransitionDefaults.cueCategory,
      configuredCueEffectKey
    );
    const configuredRoomTransitionDurationMs = options.roomTransitionDefaults.enabled
      ? resolveCatalogCueDurationMs(
          catalog,
          options.roomTransitionDefaults.cueCategory,
          configuredCueEffectKey
        )
        ?? options.roomTransitionDefaults.fallbackDurationMs
      : undefined;

    return {
      ...scene,
      roomObjects: scene.roomObjects.map((roomObject) => ({
        ...roomObject,
        movementDurationMs: roomObject.movementDurationMs
          ?? resolveMovementCueDurationMs(roomObject.presentationCues, catalog),
        appearanceOutlineStyle: resolveAppearanceOutlineStyle(roomObject.presentationCues, catalog),
        appearanceSilhouetteStyle: resolveAppearanceSilhouetteStyle(roomObject.presentationCues, catalog)
      })),
      roomTransition: transition
        ? {
            ...transition,
            travelDirection: options.roomTransitionDefaults.respectTravelDirection
              ? transition.travelDirection
              : undefined,
            durationMs: configuredRoomTransitionDurationMs,
            cueCategory: options.roomTransitionDefaults.cueCategory,
            cueEffectKey: configuredCueEffectKey,
            mode: configuredRoomTransitionMode
          }
        : undefined
    };
  }

  return {
    roomTransitionCueOptions,
    selectedRoomTransitionCueEffectKey,
    setSelectedRoomTransitionCueEffectKey,
    roomTransitionCatalogStatus,
    applyMovementCueDurations
  };
}
