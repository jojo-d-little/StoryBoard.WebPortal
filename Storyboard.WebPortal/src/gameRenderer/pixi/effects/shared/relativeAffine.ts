import type { Container } from "pixi.js";

export interface RelativeAffine {
  // Matrix term for local X basis projected to parent X.
  a: number;
  // Matrix term for local X basis projected to parent Y.
  b: number;
  // Matrix term for local Y basis projected to parent X.
  c: number;
  // Matrix term for local Y basis projected to parent Y.
  d: number;
  // Translation along parent X.
  tx: number;
  // Translation along parent Y.
  ty: number;
}

export function resolveRelativeAffine(layer: Container, target: Container): RelativeAffine {
  const layerMatrix = layer.worldTransform;
  const targetMatrix = target.worldTransform;
  const determinant = (layerMatrix.a * layerMatrix.d) - (layerMatrix.b * layerMatrix.c);
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 0.000001) {
    return {
      a: targetMatrix.a,
      b: targetMatrix.b,
      c: targetMatrix.c,
      d: targetMatrix.d,
      tx: targetMatrix.tx,
      ty: targetMatrix.ty
    };
  }

  const inverseA = layerMatrix.d / determinant;
  const inverseB = -layerMatrix.b / determinant;
  const inverseC = -layerMatrix.c / determinant;
  const inverseD = layerMatrix.a / determinant;
  const inverseTx = ((layerMatrix.c * layerMatrix.ty) - (layerMatrix.d * layerMatrix.tx)) / determinant;
  const inverseTy = ((layerMatrix.b * layerMatrix.tx) - (layerMatrix.a * layerMatrix.ty)) / determinant;

  return {
    a: (inverseA * targetMatrix.a) + (inverseC * targetMatrix.b),
    b: (inverseB * targetMatrix.a) + (inverseD * targetMatrix.b),
    c: (inverseA * targetMatrix.c) + (inverseC * targetMatrix.d),
    d: (inverseB * targetMatrix.c) + (inverseD * targetMatrix.d),
    tx: (inverseA * targetMatrix.tx) + (inverseC * targetMatrix.ty) + inverseTx,
    ty: (inverseB * targetMatrix.tx) + (inverseD * targetMatrix.ty) + inverseTy
  };
}

export function resolveHostRelativeAffine(parentLayer: Container, transformHost: Container): RelativeAffine {
  if (transformHost.parent === parentLayer) {
    const rotation = Number((transformHost as unknown as { rotation?: number }).rotation ?? 0);
    const scaleXRaw = Number((transformHost as unknown as { scale?: { x?: number } }).scale?.x ?? 1);
    const scaleYRaw = Number((transformHost as unknown as { scale?: { y?: number } }).scale?.y ?? 1);
    const scaleX = Number.isFinite(scaleXRaw) ? scaleXRaw : 1;
    const scaleY = Number.isFinite(scaleYRaw) ? scaleYRaw : 1;
    const posXRaw = Number((transformHost as unknown as { position?: { x?: number } }).position?.x ?? 0);
    const posYRaw = Number((transformHost as unknown as { position?: { y?: number } }).position?.y ?? 0);
    const posX = Number.isFinite(posXRaw) ? posXRaw : 0;
    const posY = Number.isFinite(posYRaw) ? posYRaw : 0;
    const pivotXRaw = Number((transformHost as unknown as { pivot?: { x?: number } }).pivot?.x ?? 0);
    const pivotYRaw = Number((transformHost as unknown as { pivot?: { y?: number } }).pivot?.y ?? 0);
    const pivotX = Number.isFinite(pivotXRaw) ? pivotXRaw : 0;
    const pivotY = Number.isFinite(pivotYRaw) ? pivotYRaw : 0;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const a = cos * scaleX;
    const b = sin * scaleX;
    const c = -sin * scaleY;
    const d = cos * scaleY;
    const tx = posX - ((pivotX * a) + (pivotY * c));
    const ty = posY - ((pivotX * b) + (pivotY * d));

    return { a, b, c, d, tx, ty };
  }

  return resolveRelativeAffine(parentLayer, transformHost);
}
