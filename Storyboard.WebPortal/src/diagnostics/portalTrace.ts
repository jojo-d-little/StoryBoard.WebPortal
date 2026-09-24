export type PortalTraceSeverity = "info" | "warn" | "error";

export type PortalTraceSource =
  | "authentication"
  | "discovery"
  | "session"
  | "transport"
  | "commands"
  | "polling"
  | "renderer"
  | "presentation"
  | "audio"
  | "assets"
  | "orchestration"
  | "failure";

export interface PortalTraceCorrelation {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  gameId?: string;
  commandCorrelationId?: number | string;
  sessionDeltaWatermark?: string;
  gameTick?: number | string;
}

export interface PortalTraceEvent {
  sequence: number;
  timestampUtc: string;
  source: PortalTraceSource;
  category: string;
  severity: PortalTraceSeverity;
  event: string;
  phase?: string;
  message: string;
  durationMs?: number;
  correlation?: PortalTraceCorrelation;
  details?: Record<string, unknown>;
}

export interface PortalTraceEventInput {
  level: PortalTraceSeverity;
  category: string;
  message: string;
  details?: unknown;
  timestampUtc?: string;
  event?: string;
  phase?: string;
  durationMs?: number;
}

export interface PortalTraceRetentionResult {
  entries: PortalTraceEvent[];
  droppedCount: number;
}

const SENSITIVE_DETAIL_KEY = /(?:password|passphrase|bearer|credential(?:handle|material)?|access.?token|refresh.?token|secret|idempotency.?key|payload(?:bytes)?|data.?url)/i;
const CORRELATION_KEY_ALIASES: Record<keyof PortalTraceCorrelation, string[]> = {
  correlationId: ["correlationid"],
  requestId: ["requestid"],
  sessionId: ["sessionid"],
  gameId: ["gameid"],
  commandCorrelationId: ["commandcorrelationid"],
  sessionDeltaWatermark: ["sessiondeltawatermark", "watermark", "towatermark"],
  gameTick: ["gametick"]
};

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalNumberOrString(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return readOptionalString(value);
}

function sanitizeDetailValue(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key && SENSITIVE_DETAIL_KEY.test(key)) {
    return "[REDACTED]";
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetailValue(item, undefined, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const sanitizedValue = sanitizeDetailValue(entryValue, entryKey, seen);
    if (sanitizedValue !== undefined) {
      sanitized[entryKey] = sanitizedValue;
    }
  }

  return sanitized;
}

function toStructuredDetails(details: unknown): Record<string, unknown> | undefined {
  if (details === undefined) {
    return undefined;
  }

  const sanitized = sanitizeDetailValue(details, undefined, new WeakSet<object>());
  if (sanitized === undefined) {
    return undefined;
  }

  if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    return sanitized as Record<string, unknown>;
  }

  return { value: sanitized };
}

function readCorrelation(details: unknown): PortalTraceCorrelation | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const values = new Map<string, unknown>();
  for (const [key, value] of Object.entries(details)) {
    values.set(normalizeKey(key), value);
  }

  const correlation: PortalTraceCorrelation = {};
  for (const [field, aliases] of Object.entries(CORRELATION_KEY_ALIASES) as Array<[keyof PortalTraceCorrelation, string[]]>) {
    const value = aliases
      .map((alias) => values.get(alias))
      .find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");

    if (field === "commandCorrelationId" || field === "gameTick") {
      const normalized = readOptionalNumberOrString(value);
      if (normalized !== undefined) {
        correlation[field] = normalized;
      }
      continue;
    }

    const normalized = readOptionalString(value);
    if (normalized !== undefined) {
      correlation[field] = normalized;
    }
  }

  return Object.keys(correlation).length > 0 ? correlation : undefined;
}

function readDetailString(details: unknown, key: string): string | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const normalizedKey = normalizeKey(key);
  const value = Object.entries(details).find(([entryKey]) => normalizeKey(entryKey) === normalizedKey)?.[1];
  return readOptionalString(value);
}

function readDetailNumber(details: unknown, key: string): number | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const normalizedKey = normalizeKey(key);
  const value = Object.entries(details).find(([entryKey]) => normalizeKey(entryKey) === normalizedKey)?.[1];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function inferSource(category: string, severity: PortalTraceSeverity): PortalTraceSource {
  const normalizedCategory = category.trim().toLowerCase();

  if (normalizedCategory === "auth") {
    return "authentication";
  }

  if (normalizedCategory === "discovery") {
    return "discovery";
  }

  if (normalizedCategory === "session" || normalizedCategory === "session-echo") {
    return "session";
  }

  if (normalizedCategory === "session-delta") {
    return "polling";
  }

  if (normalizedCategory === "command") {
    return "commands";
  }

  if (normalizedCategory === "host-operation" || normalizedCategory === "transport") {
    return "transport";
  }

  if (normalizedCategory.startsWith("renderer-") || normalizedCategory === "session-render") {
    return "renderer";
  }

  if (normalizedCategory === "presentation-cues" || normalizedCategory === "movement-cues" || normalizedCategory === "timing-sync") {
    return "presentation";
  }

  if (normalizedCategory === "session-audio") {
    return "audio";
  }

  if (normalizedCategory === "asset-cache" || normalizedCategory === "assets") {
    return "assets";
  }

  if (normalizedCategory === "contracts" || normalizedCategory === "state" || normalizedCategory === "interaction") {
    return "orchestration";
  }

  return severity === "error" ? "failure" : "orchestration";
}

export function normalizePortalTraceEvent(input: PortalTraceEventInput, sequence: number): PortalTraceEvent {
  const category = input.category.trim().toLowerCase() || "uncategorized";
  const details = toStructuredDetails(input.details);
  const event = readOptionalString(input.event) ?? readDetailString(input.details, "event") ?? category;
  const phase = readOptionalString(input.phase) ?? readDetailString(input.details, "phase");
  const rawDurationMs = input.durationMs ?? readDetailNumber(input.details, "durationMs");
  const durationMs = Number.isFinite(rawDurationMs)
    ? Math.max(0, Math.round(rawDurationMs as number))
    : undefined;

  return {
    sequence: Math.max(1, Math.floor(sequence)),
    timestampUtc: input.timestampUtc ?? new Date().toISOString(),
    source: inferSource(category, input.level),
    category,
    severity: input.level,
    event,
    ...(phase ? { phase } : {}),
    message: input.message,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(readCorrelation(input.details) ? { correlation: readCorrelation(input.details) } : {}),
    ...(details ? { details } : {})
  };
}

export function appendPortalTraceEvent(
  entries: PortalTraceEvent[],
  entry: PortalTraceEvent,
  maxEntries: number
): PortalTraceRetentionResult {
  const normalizedMaxEntries = Math.max(1, Math.floor(maxEntries));
  const nextEntries = [entry, ...entries];
  const droppedCount = Math.max(0, nextEntries.length - normalizedMaxEntries);

  return {
    entries: nextEntries.slice(0, normalizedMaxEntries),
    droppedCount
  };
}
