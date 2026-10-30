import { Container, Filter, Sprite, Texture } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameRenderAppearanceColorOverlayTimelineEffect } from "../../../contracts/presentationEffects/GameRenderResolvedObjectEffect";
import { AppearanceColorOverlayTimelineController } from "./AppearanceColorOverlayTimelineController";

const effect: GameRenderAppearanceColorOverlayTimelineEffect = {
  effectKey: "appearance.overlay.lightning",
  activationId: "shared-activation",
  timelineStartAtMs: 0,
  kind: "appearanceColorOverlayTimelineStyle",
  style: {
    maskPolicy: "sourceCoverage",
    blendMode: "add",
    frames: [
      { atMs: 0, color: "#ffffff", strength: 1 },
      { atMs: 100, color: "#ffffff", strength: 0 }
    ]
  }
};

describe("AppearanceColorOverlayTimelineController", () => {
  afterEach(() => vi.restoreAllMocks());

  it("completes shared activations independently for each object target", () => {
    vi.spyOn(Filter, "from").mockReturnValue({
      resources: { overlayUniforms: { uniforms: { uColor: [1, 1, 1], uStrength: 0 } } },
      destroy: vi.fn()
    } as unknown as Filter);
    const controller = new AppearanceColorOverlayTimelineController();
    const parentHost = new Container();
    const childHost = new Container();
    controller.apply("parent", parentHost, new Sprite(Texture.WHITE), effect);
    controller.apply("child", childHost, new Sprite(Texture.WHITE), effect);
    expect(parentHost.children).toHaveLength(1);
    expect(childHost.children).toHaveLength(1);

    controller.remove("parent");
    expect(parentHost.children).toHaveLength(0);
    expect(childHost.children).toHaveLength(1);
    controller.tick(50);
    expect(childHost.children).toHaveLength(1);
    controller.tick(120);
    controller.tick(120);
    expect(childHost.children).toHaveLength(0);
  });
});
