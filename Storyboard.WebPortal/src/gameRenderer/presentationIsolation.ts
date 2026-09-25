import type { PresentationCueCatalogDocument } from "./presentationCue/resolveMovementCueDuration";

export type PresentationIsolationCategory =
  | "movement"
  | "roomTransition"
  | "appearance"
  | "styledPointEffect"
  | "text";

export interface PresentationIsolationSettings {
  enabled: boolean;
  categories: Record<PresentationIsolationCategory, boolean>;
}

export interface PresentationIsolationCategoryOption {
  key: PresentationIsolationCategory;
  label: string;
  catalogCategory: string;
}

export const DEFAULT_PRESENTATION_ISOLATION_SETTINGS: PresentationIsolationSettings = {
  enabled: true,
  categories: {
    movement: true,
    roomTransition: true,
    appearance: true,
    styledPointEffect: true,
    text: true
  }
};

const APPROVED_PRESENTATION_ISOLATION_CATEGORIES: readonly PresentationIsolationCategoryOption[] = [
  { key: "movement", label: "Movement", catalogCategory: "Movement" },
  { key: "roomTransition", label: "Room Transition", catalogCategory: "RoomTransition" },
  { key: "appearance", label: "Appearance", catalogCategory: "Appearance" },
  { key: "styledPointEffect", label: "Styled Point Effect", catalogCategory: "StyledPointEffect" },
  { key: "text", label: "Text", catalogCategory: "Text" }
];

export function normalizePresentationCategory(value: string): string {
  return value.trim().replace(/[\s_-]/g, "").toLowerCase();
}

export function resolvePresentationIsolationCategoryOptions(
  catalog: PresentationCueCatalogDocument | null
): PresentationIsolationCategoryOption[] {
  const catalogCategories = new Map<string, string>();
  for (const effect of catalog?.effects ?? []) {
    const category = (effect.category ?? "").trim();
    const normalizedCategory = normalizePresentationCategory(category);
    if (normalizedCategory && !catalogCategories.has(normalizedCategory)) {
      catalogCategories.set(normalizedCategory, category);
    }
  }

  const matched = APPROVED_PRESENTATION_ISOLATION_CATEGORIES
    .filter((option) => catalogCategories.has(normalizePresentationCategory(option.catalogCategory)))
    .map((option) => ({
      ...option,
      catalogCategory: catalogCategories.get(normalizePresentationCategory(option.catalogCategory)) ?? option.catalogCategory
    }));

  // Keep the control surface usable while the session catalog is still loading.
  return matched.length > 0 ? matched : APPROVED_PRESENTATION_ISOLATION_CATEGORIES.map((option) => ({ ...option }));
}

export function isPresentationCategoryEnabled(
  settings: PresentationIsolationSettings,
  category: string | PresentationIsolationCategory
): boolean {
  if (!settings.enabled) {
    return false;
  }

  const normalizedCategory = normalizePresentationCategory(category);
  const option = APPROVED_PRESENTATION_ISOLATION_CATEGORIES.find((candidate) => {
    return normalizePresentationCategory(candidate.key) === normalizedCategory
      || normalizePresentationCategory(candidate.catalogCategory) === normalizedCategory;
  });

  return option ? settings.categories[option.key] : true;
}
