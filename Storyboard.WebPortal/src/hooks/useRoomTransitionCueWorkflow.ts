import { useEffect, useMemo, useRef, useState } from "react";
import type { GameRenderSceneSnapshot } from "../gameRenderer";
import type { GameRenderTravelDirection } from "../gameRenderer/contracts/sceneTypes";
import { mapRenderableRoomObjects } from "../gameRenderer/scene/sceneObjects";
import {
  resolveAppearanceOutlineStyle,
  resolveAppearanceSilhouetteStyle,
  resolveCatalogCueDurationMs,
  resolveCatalogRoomTransitionMode,
  resolveMovementCueDurationMs,
  resolveCatalogStyledPointEffect,
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
  addDiagnostic?: (level: "info" | "warn" | "error", category: string, message: string, details?: unknown) => void;
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
  const pointCueDiagnosticSignaturesRef = useRef(new Map<string, string>());
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

    const appearanceResolvedScene = mapRenderableRoomObjects(scene, (roomObject) => {
      const presentationCues = roomObject.presentationCues.map((cue) => {
        if (!cue.activationId || cue.category.trim()) {
          return cue;
        }

        const effect = catalog?.effects?.find((candidate) => {
          return stringEqualsIgnoreCase(candidate.effectKey ?? "", cue.effectKey);
        });
        return effect?.category ? { ...cue, category: effect.category } : cue;
      });

      return {
        ...roomObject,
        presentationCues,
        movementDurationMs: roomObject.movementDurationMs
          ?? resolveMovementCueDurationMs(presentationCues, catalog),
        appearanceOutlineStyle: resolveAppearanceOutlineStyle(presentationCues, catalog),
        appearanceSilhouetteStyle: resolveAppearanceSilhouetteStyle(presentationCues, catalog)
      };
    });

    const resolvedScene: GameRenderSceneSnapshot = {
      ...appearanceResolvedScene,
      objectsById: Object.fromEntries(Object.entries(appearanceResolvedScene.objectsById).map(([objectId, object]) => {
        const footprint = object.lighting?.spatialFootprint;
        const objectX = object.sprite?.x;
        const objectY = object.sprite?.y;
        const hasCenter = Number.isFinite(footprint?.footprintCenterXpx)
          && Number.isFinite(footprint?.footprintCenterYpx)
          && Number.isFinite(objectX)
          && Number.isFinite(objectY);
        const styledPointEffects = object.presentationCues.flatMap((cue) => {
          const category = cue.category.trim().replace(/[\s_-]/g, "").toLowerCase();
          if (category !== "styledpointeffect") {
            return [];
          }

          const catalogEffect = catalog?.effects?.find((candidate) => {
            return stringEqualsIgnoreCase(candidate.effectKey ?? "", cue.effectKey);
          });
          const style = cue.activationId
            ? resolveCatalogStyledPointEffect(catalog, cue.effectKey)
            : null;
          const accepted = Boolean(style && cue.activationId && hasCenter);
          const diagnosticDetails = {
            roomId: scene.roomId,
            objectId,
            objectName: object.objectName,
            effectKey: cue.effectKey,
            activationId: cue.activationId,
            cueCategory: cue.category,
            catalogCategory: catalogEffect?.category,
            catalogEffectFound: Boolean(catalogEffect),
            styledPointDefinitionFound: Boolean(catalogEffect?.styledPointEffect),
            styleResolved: Boolean(style),
            hasActivationId: Boolean(cue.activationId),
            hasFootprintCenter: hasCenter,
            footprintCenterXpx: footprint?.footprintCenterXpx,
            footprintCenterYpx: footprint?.footprintCenterYpx,
            objectX,
            objectY,
            outcome: accepted ? "queued-for-renderer" : "not-queued",
            rejectionReason: accepted
              ? undefined
              : !cue.activationId
                ? "missing-activation-id"
                : !catalogEffect
                  ? "catalog-entry-not-found"
                  : !catalogEffect.styledPointEffect
                    ? "styled-point-definition-missing"
                    : !style
                      ? "styled-point-style-invalid"
                      : "footprint-center-missing"
          };
          const diagnosticKey = `${objectId}:${cue.activationId || cue.effectKey}`;
          const diagnosticSignature = JSON.stringify(diagnosticDetails);
          if (pointCueDiagnosticSignaturesRef.current.get(diagnosticKey) !== diagnosticSignature) {
            pointCueDiagnosticSignaturesRef.current.set(diagnosticKey, diagnosticSignature);
            options.addDiagnostic?.("info", "presentation-cues", "Resolved active object point cue in Portal scene workflow.", diagnosticDetails);
          }
          if (!accepted || !style || !cue.activationId) {
            return [];
          }

          return [{
            activationId: cue.activationId,
            effectKey: cue.effectKey,
            footprintCenterXpx: footprint!.footprintCenterXpx!,
            footprintCenterYpx: footprint!.footprintCenterYpx!,
            objectX: objectX!,
            objectY: objectY!,
            style: {
              ...style,
              clearPolicy: "manual-removal" as const,
              lifetimeMs: undefined,
              cooldownMs: undefined
            }
          }];
        });

        return [objectId, { ...object, styledPointEffects }];
      }))
    };

    return {
      ...resolvedScene,
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
