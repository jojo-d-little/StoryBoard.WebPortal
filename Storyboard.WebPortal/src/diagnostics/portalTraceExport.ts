import type { PortalTraceEvent } from "./portalTrace";

export type PortalTraceExportFormat = "text" | "ndjson";
export type PortalTraceExportView = "complete-buffer" | "visible-filtered";
export type PortalTraceCompleteness = "empty" | "complete-buffer" | "truncated";

export interface PortalTraceExportMetadata {
  format: "portal-trace";
  formatVersion: "1.0";
  exportView: PortalTraceExportView;
  buildIdentity: string;
  captureStartedUtc?: string;
  captureStoppedUtc?: string;
  profile: string;
  scope: string[];
  bufferEntryCount: number;
  exportedEntryCount: number;
  droppedCount: number;
  completeness: PortalTraceCompleteness;
  sessionIds: string[];
  gameIds: string[];
}

export interface PortalTraceExportMetadataInput {
  buildIdentity: string;
  captureStartedUtc?: string;
  captureStoppedUtc?: string;
  profile: string;
  scope: string[];
  droppedCount: number;
}

function uniqueCorrelationValues(entries: PortalTraceEvent[], key: "sessionId" | "gameId"): string[] {
  return [...new Set(entries
    .map((entry) => entry.correlation?.[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0))]
    .sort();
}

function resolveCompleteness(entryCount: number, droppedCount: number): PortalTraceCompleteness {
  if (entryCount === 0) {
    return "empty";
  }

  return droppedCount > 0 ? "truncated" : "complete-buffer";
}

export function buildPortalTraceExportMetadata(
  entries: PortalTraceEvent[],
  input: PortalTraceExportMetadataInput,
  exportView: PortalTraceExportView = "complete-buffer"
): PortalTraceExportMetadata {
  return {
    format: "portal-trace",
    formatVersion: "1.0",
    exportView,
    buildIdentity: input.buildIdentity,
    ...(input.captureStartedUtc ? { captureStartedUtc: input.captureStartedUtc } : {}),
    ...(input.captureStoppedUtc ? { captureStoppedUtc: input.captureStoppedUtc } : {}),
    profile: input.profile,
    scope: [...input.scope].sort(),
    bufferEntryCount: entries.length,
    exportedEntryCount: entries.length,
    droppedCount: Math.max(0, input.droppedCount),
    completeness: resolveCompleteness(entries.length, input.droppedCount),
    sessionIds: uniqueCorrelationValues(entries, "sessionId"),
    gameIds: uniqueCorrelationValues(entries, "gameId")
  };
}

export function derivePortalTraceExportMetadata(
  entries: PortalTraceEvent[],
  base: PortalTraceExportMetadata,
  exportView: PortalTraceExportView
): PortalTraceExportMetadata {
  return {
    ...base,
    exportView,
    exportedEntryCount: entries.length,
    completeness: resolveCompleteness(base.bufferEntryCount, base.droppedCount),
    sessionIds: uniqueCorrelationValues(entries, "sessionId"),
    gameIds: uniqueCorrelationValues(entries, "gameId")
  };
}

export function orderPortalTraceEntries(entries: PortalTraceEvent[]): PortalTraceEvent[] {
  return [...entries].sort((left, right) => left.sequence - right.sequence);
}

export function formatPortalTraceEntryText(entry: PortalTraceEvent): string[] {
  const sourceAndCategory = `${entry.source}/${entry.category}`;
  const eventLabel = entry.phase ? `${entry.event}/${entry.phase}` : entry.event;
  const durationLabel = entry.durationMs === undefined ? "" : ` (${entry.durationMs}ms)`;
  const header = `[${entry.timestampUtc}] #${entry.sequence} [${entry.severity.toUpperCase()}] ${sourceAndCategory} ${eventLabel}${durationLabel}: ${entry.message}`;
  if (!entry.details && !entry.correlation) {
    return [header];
  }

  const detailLines = JSON.stringify({
    ...(entry.correlation ? { correlation: entry.correlation } : {}),
    ...(entry.details ? { details: entry.details } : {})
  }, null, 2)
    .split(/\r?\n/)
    .map((line) => `  ${line}`);
  return [header, ...detailLines];
}

function formatMetadataText(metadata: PortalTraceExportMetadata): string[] {
  return [
    "Portal Trace Export",
    `format=${metadata.format}/${metadata.formatVersion}`,
    `export.view=${metadata.exportView}`,
    `build=${metadata.buildIdentity}`,
    `capture.start=${metadata.captureStartedUtc ?? "(none)"}`,
    `capture.stop=${metadata.captureStoppedUtc ?? "(none)"}`,
    `profile=${metadata.profile}`,
    `scope=${metadata.scope.length > 0 ? metadata.scope.join(",") : "(none)"}`,
    `buffer.entries=${metadata.bufferEntryCount}`,
    `exported.entries=${metadata.exportedEntryCount}`,
    `dropped=${metadata.droppedCount}`,
    `completeness=${metadata.completeness}`,
    `session.ids=${metadata.sessionIds.length > 0 ? metadata.sessionIds.join(",") : "(none)"}`,
    `game.ids=${metadata.gameIds.length > 0 ? metadata.gameIds.join(",") : "(none)"}`,
    ""
  ];
}

export function formatPortalTraceText(entries: PortalTraceEvent[], metadata: PortalTraceExportMetadata): string {
  return [
    ...formatMetadataText(metadata),
    ...orderPortalTraceEntries(entries).flatMap(formatPortalTraceEntryText)
  ].join("\n") + "\n";
}

export function formatPortalTraceNdjson(entries: PortalTraceEvent[], metadata: PortalTraceExportMetadata): string {
  const metadataRecord = JSON.stringify({ recordType: "metadata", ...metadata });
  const eventRecords = orderPortalTraceEntries(entries).map((entry) => JSON.stringify({ recordType: "event", ...entry }));
  return [metadataRecord, ...eventRecords].join("\n") + "\n";
}

export function formatPortalTraceExport(
  entries: PortalTraceEvent[],
  metadata: PortalTraceExportMetadata,
  format: PortalTraceExportFormat
): string {
  return format === "ndjson"
    ? formatPortalTraceNdjson(entries, metadata)
    : formatPortalTraceText(entries, metadata);
}
