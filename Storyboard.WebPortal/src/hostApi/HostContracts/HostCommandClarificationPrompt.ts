import type { HostPendingClarificationRequest } from "./HostPendingClarificationRequest";

export interface HostCommandClarificationPrompt {
  commandCorrelationId: number;
  pendingClarification: HostPendingClarificationRequest;
}
