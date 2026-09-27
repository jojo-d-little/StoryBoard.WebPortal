export interface HostObjectSpatialFootprint {
  cellX: number;
  cellY: number;
  sizeXCells?: number;
  sizeYCells?: number;
  shape?: "rectangle" | "rounded-rectangle";
  elevationCells?: number;
}
