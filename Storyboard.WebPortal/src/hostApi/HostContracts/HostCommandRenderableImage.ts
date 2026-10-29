export interface HostCommandRenderableImage {
  imagePath: string;
  anchorX: number;
  anchorY: number;
  iconOffsetX: number;
  iconOffsetY: number;
  situationalScalePivotOffsetXPx?: number;
  situationalScalePivotOffsetYPx?: number;
  x: number;
  y: number;
  rotationDegrees: number;
  scale: number;
  additionalSituationalScale?: number;
}
