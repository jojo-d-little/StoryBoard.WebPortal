import type { HostPendingClarificationRequest } from "./HostPendingClarificationRequest";

export type HostProcessCommandResultCode =
  | "Success"
  | "ClarificationRequired"
  | "NoMatch"
  | "CorrelationIdCommandMismatch"
  | "ClarificationAnswerMismatch"
  | "ClarificationStateStale"
  | "DuplicateCorrelationId"
  | "Failure";

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