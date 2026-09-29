export interface HostResultEnvelope {
  success: boolean;
  code: string;
  message?: string;
  diagnostics?: string[];
  diagnosticsMessages: string[];
  correlationId?: string;
  occurredUtc?: string;
  retryable?: boolean;
  actorPrincipalId?: string;
  actionName?: string;
  actionUtc?: string;
}
