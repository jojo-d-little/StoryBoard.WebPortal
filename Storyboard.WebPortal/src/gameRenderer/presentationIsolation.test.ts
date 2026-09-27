import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isLightingPresentationEnabled,
  isPresentationCategoryEnabled,
  resolvePresentationIsolationCategoryOptions
} from "./presentationIsolation";

describe("presentation isolation settings", () => {
  it("defaults every approved category to enabled", () => {
    expect(DEFAULT_PRESENTATION_ISOLATION_SETTINGS).toEqual({
      enabled: true,
      lightingEnabled: false,
      categories: {
        movement: true,
        roomTransition: true,
        appearance: true,
        styledPointEffect: true,
        text: true
      }
    });
  });

  it("recognizes catalog category spellings and keeps global suppression authoritative", () => {
    const settings = {
      enabled: true,
      lightingEnabled: false,
      categories: {
        ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories,
        roomTransition: false
      }
    };

    expect(isPresentationCategoryEnabled(settings, "RoomTransition")).toBe(false);
    expect(isPresentationCategoryEnabled(settings, "room_transition")).toBe(false);
    expect(isPresentationCategoryEnabled({ ...settings, enabled: false }, "Movement")).toBe(false);
  });

  it("gates lighting behind both its own checkbox and the master effects switch", () => {
    const lightingRequested = {
      ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
      lightingEnabled: true
    };

    expect(isLightingPresentationEnabled(lightingRequested)).toBe(true);
    expect(isLightingPresentationEnabled({ ...lightingRequested, enabled: false })).toBe(false);
    expect(isLightingPresentationEnabled(DEFAULT_PRESENTATION_ISOLATION_SETTINGS)).toBe(false);
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
});
