import { describe, expect, it, vi } from "vitest";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import type { ParticleEffectSceneController } from "./ParticleEffectSceneController";
import { reconcileInitializedParticleControllers } from "./reconcileInitializedParticleControllers";

function scene(roomId: string): GameRenderSceneSnapshot {
  return { roomId, displayMode: "composed", bounds: { width: 640, height: 400 }, directionalOverlays: [], objectsById: {} };
}

describe("reconcileInitializedParticleControllers", () => {
  it("routes the initial current scene to active when initialization wins the snapshot publication race", () => {
    const active = { reconcile: vi.fn() } as unknown as ParticleEffectSceneController;
    const staging = { reconcile: vi.fn() } as unknown as ParticleEffectSceneController;
    const current = scene("room-1");

    reconcileInitializedParticleControllers(active, staging, null, current);

    expect(active.reconcile).toHaveBeenCalledWith(current);
    expect(staging.reconcile).not.toHaveBeenCalled();
  });

  it("keeps a known active room on active and routes an incoming room to staging", () => {
    const active = { reconcile: vi.fn() } as unknown as ParticleEffectSceneController;
    const staging = { reconcile: vi.fn() } as unknown as ParticleEffectSceneController;
    const outgoing = scene("room-1");
    const incoming = scene("room-2");

    reconcileInitializedParticleControllers(active, staging, outgoing, incoming);

    expect(active.reconcile).toHaveBeenCalledWith(outgoing);
    expect(staging.reconcile).toHaveBeenCalledWith(incoming);
  });
});
