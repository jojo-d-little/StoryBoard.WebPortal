import type { HostClarificationAnswer } from "./HostClarificationAnswer";
import type { HostRequestContext } from "./HostRequestContext";

export type HostGameDiagnosticsLevel = "None" | "Low" | "Medium" | "High";

export interface HostProcessCommandRequest {
  context: HostRequestContext;
  commandCorrelationId: number;
  rawCommandText: string;
  diagnosticsLevel: HostGameDiagnosticsLevel;
  clarificationAnswers: HostClarificationAnswer[];
}