export type HostProcessCommandResultCode =
  | "Success"
  | "ClarificationRequired"
  | "NoMatch"
  | "CorrelationIdCommandMismatch"
  | "ClarificationAnswerMismatch"
  | "ClarificationStateStale"
  | "DuplicateCorrelationId"
  | "Started"
  | "Failure";
