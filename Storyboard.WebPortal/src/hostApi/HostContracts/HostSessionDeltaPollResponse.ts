import type { HostSessionDataEnvelope } from "./HostSessionDataEnvelope";
import type { HostSessionDeltaPollResultCode } from "./HostSessionDeltaPollResultCode";

export interface HostSessionDeltaPollResponse {
  resultCode: HostSessionDeltaPollResultCode;
  sessionData: HostSessionDataEnvelope | null;
  sessionDeltaWatermark: string;
  diagnostics: string[];
}
