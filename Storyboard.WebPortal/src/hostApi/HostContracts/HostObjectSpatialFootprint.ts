export interface HostObjectSpatialFootprint {
  cellX: number;
  cellY: number;
  sizeXCells?: number;
  sizeYCells?: number;
  footprintCenterXpx?: number;
  footprintCenterYpx?: number;
  cornerStyle?: "sharp" | "rounded";
  elevationCells?: number;
}
