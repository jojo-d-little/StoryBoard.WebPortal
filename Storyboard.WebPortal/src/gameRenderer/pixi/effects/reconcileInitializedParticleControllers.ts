import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import type { ParticleEffectSceneController } from "./ParticleEffectSceneController";

export function reconcileInitializedParticleControllers(
  activeController: ParticleEffectSceneController | null,
  stagingController: ParticleEffectSceneController | null,
  activeSurfaceScene: GameRenderSceneSnapshot | null,
  currentScene: GameRenderSceneSnapshot | null
): void {
  // During startup, the active room render can finish just before its snapshot is
  // published. In that window there is no staging room: currentScene belongs to active.
  const activeScene = activeSurfaceScene ?? currentScene;
  if (activeScene) activeController?.reconcile(activeScene);

  if (activeSurfaceScene && currentScene && currentScene.roomId !== activeSurfaceScene.roomId) {
    stagingController?.reconcile(currentScene);
  }
}
