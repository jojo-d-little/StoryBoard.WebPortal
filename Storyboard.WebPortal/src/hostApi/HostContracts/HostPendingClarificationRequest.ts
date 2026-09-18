import type { HostClarificationCandidate } from "./HostClarificationCandidate";

export interface HostPendingClarificationRequest {
  slotId: string;
  ambiguousPhraseText: string;
  promptText: string;
  candidates: HostClarificationCandidate[];
}