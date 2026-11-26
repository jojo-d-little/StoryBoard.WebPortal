/**
 * One transient terminal-completion occurrence for a root player command whose initial
 * HostProcessCommandResult was Started (including after clarification). Published after the
 * command's action chain is terminal and the runtime command-busy guard is released. It never
 * describes a prerequisite step, timer, output line or presentation cue, and does not acknowledge
 * client-side animation or audio completion.
 */
export interface HostCommandCompletion {
  /** Original positive correlation id of the root command; replayed occurrences repeat it. */
  commandCorrelationId: number;
  /** Terminal outcome; nonterminal outcomes are never reported here. */
  resultCode: "Success" | "Failure";
  /** Display-only context for a Failure; never parse it as a machine status. */
  failureMessage?: string | null;
}
