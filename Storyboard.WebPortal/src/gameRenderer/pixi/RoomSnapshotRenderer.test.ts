import { describe, expect, it, vi } from "vitest";
import { Container, Graphics, type Renderer, type Texture } from "pixi.js";
import { captureRoomTexture } from "./RoomSnapshotRenderer";

describe("captureRoomTexture", () => {
  it("captures the requested bounded frame and restores the live surface", () => {
    const surface = new Container();
    const mask = new Graphics();
    surface.mask = mask;
    surface.visible = false;
    surface.alpha = 0.4;
    surface.position.set(25, 40);
    const destroy = vi.fn();
    const texture = { destroy } as unknown as Texture;
    const generateTexture = vi.fn().mockImplementation(() => {
      // Pixi's real renderer promotes a directly rendered container to a render group.
      surface.enableRenderGroup();
      return texture;
    });
    const renderer = { generateTexture } as unknown as Renderer;

    const captured = captureRoomTexture(renderer, surface, {
      roomId: "room-1",
      width: 800,
      height: 600,
      resolutionScale: 2
    });

    expect(generateTexture).toHaveBeenCalledWith(expect.objectContaining({
      target: surface,
      resolution: 2,
      antialias: true
    }));
    const request = generateTexture.mock.calls[0]?.[0] as { frame?: { x: number; y: number; width: number; height: number } };
    expect(request.frame).toMatchObject({ x: 0, y: 0, width: 800, height: 600 });
    expect(surface.mask).toBe(mask);
    expect(surface.visible).toBe(false);
    expect(surface.alpha).toBe(0.4);
    expect(surface.position.x).toBe(25);
    expect(surface.position.y).toBe(40);
    expect(surface.isRenderGroup).toBe(false);

    captured.dispose();
    captured.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledWith(true);
  });

  it("caps oversized capture requests to the configured texture budget", () => {
    const surface = new Container();
    const texture = { destroy: vi.fn() } as unknown as Texture;
    const generateTexture = vi.fn().mockReturnValue(texture);
    const renderer = { generateTexture } as unknown as Renderer;

    const captured = captureRoomTexture(renderer, surface, {
      roomId: "large-room",
      width: 8000,
      height: 4000,
      resolutionScale: 2
    });

    expect(captured.resolution).toBeLessThanOrEqual(4096 / 8000);
    captured.dispose();
  });

  it("also caps capture resolution to the active renderer texture limit", () => {
    const surface = new Container();
    const texture = { destroy: vi.fn() } as unknown as Texture;
    const generateTexture = vi.fn().mockReturnValue(texture);
    const renderer = {
      generateTexture,
      gl: {
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter: vi.fn().mockReturnValue(1024)
      }
    } as unknown as Renderer;

    const captured = captureRoomTexture(renderer, surface, {
      roomId: "gpu-limited-room",
      width: 2000,
      height: 1000,
      resolutionScale: 2
    });

    expect(captured.resolution).toBeLessThanOrEqual(1024 / 2000);
    captured.dispose();
  });
});
