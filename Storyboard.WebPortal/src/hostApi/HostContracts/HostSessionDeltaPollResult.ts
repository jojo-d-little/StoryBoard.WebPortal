import type { HostSessionPresentationData } from "./HostSessionPresentationData";
import type { HostSessionDeltaPollResultCode } from "./HostSessionDeltaPollResultCode";

export interface HostSessionDeltaPollResult {
  resultCode: HostSessionDeltaPollResultCode;
  sessionData: HostSessionPresentationData | null;
  diagnostics: string[];
  isNoOp?: boolean;
}
