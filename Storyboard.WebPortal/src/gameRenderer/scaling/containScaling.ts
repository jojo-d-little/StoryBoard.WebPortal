export interface ContainScalePolicy {
  maxScale: number;
  softMinScale: number;
  allowBelowSoftMinWhenNeeded: boolean;
}

export interface ContainScaleTransform {
  roomWidth: number;
  roomHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
}

export interface ViewportPointToRoomPointResult {
  viewportX: number;
  viewportY: number;
  roomX: number;
  roomY: number;
  insideRoom: boolean;
}

export const DEFAULT_CONTAIN_SCALE_POLICY: ContainScalePolicy = {
  maxScale: 2,
  softMinScale: 0.5,
  allowBelowSoftMinWhenNeeded: true
};

function normalizePositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function sanitizePolicy(policy: ContainScalePolicy): ContainScalePolicy {
  const maxScale = normalizePositive(policy.maxScale, DEFAULT_CONTAIN_SCALE_POLICY.maxScale);
  const softMinScale = normalizePositive(policy.softMinScale, DEFAULT_CONTAIN_SCALE_POLICY.softMinScale);

  return {
    maxScale: Math.max(softMinScale, maxScale),
    softMinScale,
    allowBelowSoftMinWhenNeeded: policy.allowBelowSoftMinWhenNeeded
  };
}

export function computeContainScale(
  roomWidthInput: number,
  roomHeightInput: number,
  viewportWidthInput: number,
  viewportHeightInput: number,
  policyInput: ContainScalePolicy = DEFAULT_CONTAIN_SCALE_POLICY
): number {
  const roomWidth = normalizePositive(roomWidthInput, 1);
  const roomHeight = normalizePositive(roomHeightInput, 1);
  const viewportWidth = normalizePositive(viewportWidthInput, 1);
  const viewportHeight = normalizePositive(viewportHeightInput, 1);
  const policy = sanitizePolicy(policyInput);

  const rawScale = Math.min(viewportWidth / roomWidth, viewportHeight / roomHeight);
  const cappedScale = Math.min(rawScale, policy.maxScale);
  if (policy.allowBelowSoftMinWhenNeeded && rawScale < policy.softMinScale) {
    return Math.max(0.0001, cappedScale);
  }

  return Math.max(policy.softMinScale, cappedScale);
}

export function computeContainTransform(
  roomWidthInput: number,
  roomHeightInput: number,
  viewportWidthInput: number,
  viewportHeightInput: number,
  policyInput: ContainScalePolicy = DEFAULT_CONTAIN_SCALE_POLICY
): ContainScaleTransform {
  const roomWidth = normalizePositive(roomWidthInput, 1);
  const roomHeight = normalizePositive(roomHeightInput, 1);
  const viewportWidth = normalizePositive(viewportWidthInput, 1);
  const viewportHeight = normalizePositive(viewportHeightInput, 1);
  const scale = computeContainScale(roomWidth, roomHeight, viewportWidth, viewportHeight, policyInput);
  const renderedWidth = roomWidth * scale;
  const renderedHeight = roomHeight * scale;
  const offsetX = (viewportWidth - renderedWidth) / 2;
  const offsetY = (viewportHeight - renderedHeight) / 2;

  return {
    roomWidth,
    roomHeight,
    viewportWidth,
    viewportHeight,
    scale,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight
  };
}

export function mapViewportPointToRoomPoint(
  transform: ContainScaleTransform,
  viewportX: number,
  viewportY: number
): ViewportPointToRoomPointResult {
  const roomXUnclamped = (viewportX - transform.offsetX) / transform.scale;
  const roomYUnclamped = (viewportY - transform.offsetY) / transform.scale;
  const insideRoom = roomXUnclamped >= 0
    && roomXUnclamped <= transform.roomWidth
    && roomYUnclamped >= 0
    && roomYUnclamped <= transform.roomHeight;

  return {
    viewportX,
    viewportY,
    roomX: Math.min(transform.roomWidth, Math.max(0, roomXUnclamped)),
    roomY: Math.min(transform.roomHeight, Math.max(0, roomYUnclamped)),
    insideRoom
  };
}