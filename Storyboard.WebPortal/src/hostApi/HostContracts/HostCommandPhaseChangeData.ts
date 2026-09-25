import type { HostCommandPhaseSummary } from "./HostCommandPhaseSummary";
import type { HostCommandPresentationCueText } from "./HostCommandPresentationCueText";

export interface HostCommandPhaseChangeData {
  reason: string;
  oldPhase?: HostCommandPhaseSummary;
  newPhase?: HostCommandPhaseSummary;
  isResume?: boolean;
  changedBook?: boolean;
  changedChapter?: boolean;
  changedPage?: boolean;
  orderedTextPresentationSteps?: HostCommandPresentationCueText[];
}
