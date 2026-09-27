export interface HostObjectSpatialFootprint {
  cellX: number;
  cellY: number;
  sizeXCells?: number;
  sizeYCells?: number;
  cornerStyle?: "sharp" | "rounded";
  elevationCells?: number;
}
