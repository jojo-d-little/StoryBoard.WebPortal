export interface PresentationCueSourceProjectionInput {
  sourceX: number;
  sourceY: number;
  anchorX: number;
  anchorY: number;
  rotationRadians: number;
  artworkFitScale: number;
  pivotLocalX: number;
  pivotLocalY: number;
  cueScale: number;
  shakeLocalX: number;
  shakeLocalY: number;
}

/** Projects an attached source through the Scale/Shake cue layers only. Host-resolved situational geometry is already in sourceX/sourceY. */
export function projectPresentationCueSource(input: PresentationCueSourceProjectionInput): { x: number; y: number } {
  const cos = Math.cos(input.rotationRadians);
  const sin = Math.sin(input.rotationRadians);
  const pivotOffsetX = input.pivotLocalX * input.artworkFitScale;
  const pivotOffsetY = input.pivotLocalY * input.artworkFitScale;
  const pivotX = input.anchorX + pivotOffsetX * cos - pivotOffsetY * sin;
  const pivotY = input.anchorY + pivotOffsetX * sin + pivotOffsetY * cos;
  const shakeX = input.shakeLocalX * input.artworkFitScale;
  const shakeY = input.shakeLocalY * input.artworkFitScale;
  return {
    x: pivotX + ((input.sourceX - pivotX) * input.cueScale) + shakeX * cos - shakeY * sin,
    y: pivotY + ((input.sourceY - pivotY) * input.cueScale) + shakeX * sin + shakeY * cos
  };
}
