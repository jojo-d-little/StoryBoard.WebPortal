import type { HostClarificationAnswer } from "./HostClarificationAnswer";
import type { HostRequestContext } from "./HostRequestContext";
import type { HostGameDiagnosticsLevel } from "./HostGameDiagnosticsLevel";

export interface HostProcessCommandRequest {
  context: HostRequestContext;
  commandCorrelationId: number;
  rawCommandText: string;
  diagnosticsLevel: HostGameDiagnosticsLevel;
  clarificationAnswers: HostClarificationAnswer[];
}
