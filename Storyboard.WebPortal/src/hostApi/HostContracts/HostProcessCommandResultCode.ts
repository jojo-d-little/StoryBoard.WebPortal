export type HostProcessCommandResultCode =
  | "Success"
  | "ClarificationRequired"
  | "NoMatch"
  | "CorrelationIdCommandMismatch"
  | "ClarificationAnswerMismatch"
  | "ClarificationStateStale"
  | "DuplicateCorrelationId"
  | "Failure";
