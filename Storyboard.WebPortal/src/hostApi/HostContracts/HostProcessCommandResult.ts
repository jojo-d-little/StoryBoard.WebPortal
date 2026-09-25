import type { HostPendingClarificationRequest } from "./HostPendingClarificationRequest";
import type { HostProcessCommandResultCode } from "./HostProcessCommandResultCode";

export interface HostProcessCommandResult {
  commandId: string;
  commandText: string;
  commandCorrelationId: number;
  rawCommandText: string;
  resultCode: HostProcessCommandResultCode;
  clarificationRequired: boolean;
  pendingClarification: HostPendingClarificationRequest | null;
  success: boolean;
  matchedCommand: boolean;
  diagnostics: string[];
}
