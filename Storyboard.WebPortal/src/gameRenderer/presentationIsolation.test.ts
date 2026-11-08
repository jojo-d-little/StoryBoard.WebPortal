import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isLightingPresentationEnabled,
  isPresentationCategoryEnabled,
  normalizePresentationIsolationSettings,
  resolvePresentationIsolationCategoryOptions
} from "./presentationIsolation";

describe("presentation isolation settings", () => {
  it("defaults every approved category to enabled", () => {
    expect(DEFAULT_PRESENTATION_ISOLATION_SETTINGS).toEqual({
      enabled: true,
      lightingEnabled: true,
      particleEffectsEnabled: true,
      lightingGridEnabled: false,
      categories: {
        movement: true,
        roomTransition: true,
        scale: true,
        shake: true,
        highlight: true,
        colorOverlay: true,
        appearance: true,
        disappearance: true,
        styledPointEffect: true,
        text: true
      }
    });
  });

  it("recognizes catalog category spellings and keeps global suppression authoritative", () => {
    const settings = {
      enabled: true,
      lightingEnabled: true,
      particleEffectsEnabled: true,
      lightingGridEnabled: false,
      categories: {
        ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories,
        roomTransition: false
      }
    };

    expect(isPresentationCategoryEnabled(settings, "RoomTransition")).toBe(false);
    expect(isPresentationCategoryEnabled(settings, "room_transition")).toBe(false);
    expect(isPresentationCategoryEnabled({ ...settings, enabled: false }, "Movement")).toBe(false);
  });

  it("fills newly added isolation categories when normalizing older saved settings", () => {
    const normalized = normalizePresentationIsolationSettings({ categories: { movement: false } });
    expect(normalized.categories.movement).toBe(false);
    expect(normalized.categories.appearance).toBe(true);
    expect(normalized.categories.disappearance).toBe(true);
  });

  it("defaults lighting on while keeping its checkbox and the master effects switch authoritative", () => {
    const lightingRequested = {
      ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
      lightingEnabled: true
    };

    expect(isLightingPresentationEnabled(lightingRequested)).toBe(true);
    expect(isLightingPresentationEnabled({ ...lightingRequested, enabled: false })).toBe(false);
    expect(isLightingPresentationEnabled({ ...lightingRequested, lightingEnabled: false })).toBe(false);
    expect(isLightingPresentationEnabled(DEFAULT_PRESENTATION_ISOLATION_SETTINGS)).toBe(true);
  });

  it("uses approved categories found in the loaded catalog", () => {
    const options = resolvePresentationIsolationCategoryOptions({
      effects: [
        { category: "Movement", effectKey: "movement.walk" },
        { category: "Room Transition", effectKey: "room.fade" },
        { category: "Unsupported Future Category", effectKey: "future.effect" }
      ]
    });

    expect(options.map((option) => option.key)).toEqual(["movement", "roomTransition"]);
    expect(options[1]?.catalogCategory).toBe("Room Transition");
  });

  it("keeps the four new cue categories independently controllable", () => {
    const categories = { ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories, shake: false };
    const settings = { ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS, categories };
    expect(isPresentationCategoryEnabled(settings, "Scale")).toBe(true);
    expect(isPresentationCategoryEnabled(settings, "Shake")).toBe(false);
    expect(isPresentationCategoryEnabled(settings, "Highlight")).toBe(true);
    expect(isPresentationCategoryEnabled(settings, "ColorOverlay")).toBe(true);
    expect(isPresentationCategoryEnabled(settings, "Appearance")).toBe(true);
    expect(isPresentationCategoryEnabled({ ...settings, categories: { ...settings.categories, appearance: false } }, "Appearance")).toBe(false);
    expect(isPresentationCategoryEnabled(settings, "Disappearance")).toBe(true);
    const options = resolvePresentationIsolationCategoryOptions({ effects: [
      { category: "Scale", effectKey: "scale.grow.large" },
      { category: "Shake", effectKey: "shake.large.fast" },
      { category: "Highlight", effectKey: "appearance.selection.outline.cyan" },
      { category: "ColorOverlay", effectKey: "appearance.overlay.lightning" },
      { category: "Appearance", effectKey: "appearance.fade.in" },
      { category: "Disappearance", effectKey: "disappearance.fade.out" }
    ] });
    expect(options.map((option) => option.catalogCategory)).toEqual(["Scale", "Shake", "Highlight", "ColorOverlay", "Appearance", "Disappearance"]);
  });
});
