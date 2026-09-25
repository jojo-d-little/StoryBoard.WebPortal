import type { HostCommandPhaseNodeSummary } from "./HostCommandPhaseNodeSummary";

export interface HostCommandPhaseSummary {
  phaseId: string;
  pathDisplayName: string;
  book: HostCommandPhaseNodeSummary;
  chapter: HostCommandPhaseNodeSummary;
  page: HostCommandPhaseNodeSummary;
}
