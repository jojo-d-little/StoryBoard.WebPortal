import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isPresentationCategoryEnabled,
  resolvePresentationIsolationCategoryOptions
} from "./presentationIsolation";

describe("presentation isolation settings", () => {
  it("defaults every approved category to enabled", () => {
    expect(DEFAULT_PRESENTATION_ISOLATION_SETTINGS).toEqual({
      enabled: true,
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
      categories: {
        ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories,
        roomTransition: false
      }
    };

    expect(isPresentationCategoryEnabled(settings, "RoomTransition")).toBe(false);
    expect(isPresentationCategoryEnabled(settings, "room_transition")).toBe(false);
    expect(isPresentationCategoryEnabled({ ...settings, enabled: false }, "Movement")).toBe(false);
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
