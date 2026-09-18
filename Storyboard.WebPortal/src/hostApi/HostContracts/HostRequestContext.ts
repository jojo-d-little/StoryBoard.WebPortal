export interface HostRequestContext {
  requestId: string;
  correlationId: string;
  principalHandle: string;
  tenantId: string;
  orgId: string;
  sessionId: string | null;
  clientSentUtc: string;
  idempotencyKey: string;
  traceFlags: string;
}
