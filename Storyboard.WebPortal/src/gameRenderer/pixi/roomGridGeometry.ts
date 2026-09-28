export interface RoomGridLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const MAX_GRID_LINES = 10_000;

function positionsThroughBoundary(extent: number, spacing: number): number[] {
  const positions: number[] = [];
  const interiorCount = Math.floor((extent - Number.EPSILON) / spacing);
  for (let index = 0; index <= interiorCount; index += 1) {
    positions.push(index * spacing);
  }
  if (positions[positions.length - 1] !== extent) {
    positions.push(extent);
  }
  return positions;
}

export function buildRoomGridLines(
  widthPx: number,
  heightPx: number,
  cellSizePx: number
): RoomGridLine[] | null {
  if (!Number.isInteger(widthPx) || widthPx <= 0
    || !Number.isInteger(heightPx) || heightPx <= 0
    || !Number.isFinite(cellSizePx) || cellSizePx <= 0) {
    return null;
  }

  if (Math.ceil(widthPx / cellSizePx) + Math.ceil(heightPx / cellSizePx) + 2 > MAX_GRID_LINES) {
    return null;
  }

  const verticalPositions = positionsThroughBoundary(widthPx, cellSizePx);
  const horizontalPositions = positionsThroughBoundary(heightPx, cellSizePx);

  return [
    ...verticalPositions.map((x): RoomGridLine => ({ fromX: x, fromY: 0, toX: x, toY: heightPx })),
    ...horizontalPositions.map((y): RoomGridLine => ({ fromX: 0, fromY: y, toX: widthPx, toY: y }))
  ];
}
