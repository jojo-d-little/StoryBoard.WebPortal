import type { HostPointLightDefaults } from "./HostPointLightDefaults";

export interface HostSessionPresentationSettings {
  cellSizePx: number;
  pointLightDefaults?: HostPointLightDefaults | null;
}
