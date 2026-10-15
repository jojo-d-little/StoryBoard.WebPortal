import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionPresentationData } from "./HostSessionPresentationData";

export interface HostAttachSessionResult {
  result: HostResultEnvelope;
  sessionId: string;
  attached: boolean;
  initialPresentation?: HostSessionPresentationData | null;
}
