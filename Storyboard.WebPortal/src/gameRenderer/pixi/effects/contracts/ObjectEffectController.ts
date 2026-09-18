import type { Container, Sprite } from "pixi.js";

export interface ObjectEffectController<TStyle> {
  applyForObject: (
    objectId: string,
    objectName: string,
    transformHost: Container,
    sprite: Sprite,
    style: TStyle | undefined
  ) => void;
  syncObjectTransform: (objectId: string, transformHost: Container, sprite: Sprite) => void;
  tick: (nowMs: number) => void;
  removeObject: (objectId: string) => void;
  clear: () => void;
}
