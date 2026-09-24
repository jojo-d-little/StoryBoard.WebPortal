import { describe, expect, it } from "vitest";
import type { PortalTraceEvent } from "./portalTrace";
import {
  buildPortalTraceExportMetadata,
  derivePortalTraceExportMetadata,
  formatPortalTraceNdjson,
  formatPortalTraceText
} from "./portalTraceExport";

function buildEntry(sequence: number, overrides: Partial<PortalTraceEvent> = {}): PortalTraceEvent {
  return {
    sequence,
    timestampUtc: `2026-09-24T12:00:0${sequence}.000Z`,
    source: "transport",
    category: "transport",
    severity: "info",
    event: "host-api-request",
    message: `request-${sequence}`,
    correlation: {
      sessionId: "session-1",
      gameId: "game-1"
    },
    ...overrides
  };
}

function buildMetadata(entries: PortalTraceEvent[], droppedCount = 0) {
  return buildPortalTraceExportMetadata(entries, {
    buildIdentity: "storyboard-webportal@0.1.3",
    captureStartedUtc: "2026-09-24T12:00:00.000Z",
    captureStoppedUtc: "2026-09-24T12:01:00.000Z",
    profile: "Focused",
    scope: ["transport", "commands"],
    droppedCount
  });
}

describe("Portal trace export", () => {
  it("exports complete readable text in sequence order with metadata", () => {
    const entries = [buildEntry(2), buildEntry(1)];
    const text = formatPortalTraceText(entries, buildMetadata(entries));

    expect(text).toContain("export.view=complete-buffer");
    expect(text).toContain("build=storyboard-webportal@0.1.3");
    expect(text).toContain("capture.start=2026-09-24T12:00:00.000Z");
    expect(text).toContain("buffer.entries=2");
    expect(text.indexOf("request-1")).toBeLessThan(text.indexOf("request-2"));
  });

  it("exports one NDJSON record per event after a metadata record", () => {
    const entries = [buildEntry(1), buildEntry(2)];
    const lines = formatPortalTraceNdjson(entries, buildMetadata(entries)).trim().split("\n");
    const metadata = JSON.parse(lines[0]);
    const firstEvent = JSON.parse(lines[1]);

    expect(metadata).toMatchObject({ recordType: "metadata", format: "portal-trace", exportedEntryCount: 2 });
    expect(firstEvent).toMatchObject({ recordType: "event", sequence: 1, event: "host-api-request" });
    expect(lines).toHaveLength(3);
  });

  it("labels filtered output separately and preserves truncation disclosure", () => {
    const entries = [buildEntry(1), buildEntry(2)];
    const base = buildMetadata(entries, 3);
    const filtered = derivePortalTraceExportMetadata([entries[1]], base, "visible-filtered");
    const text = formatPortalTraceText([entries[1]], filtered);

    expect(filtered.exportView).toBe("visible-filtered");
    expect(filtered.bufferEntryCount).toBe(2);
    expect(filtered.exportedEntryCount).toBe(1);
    expect(filtered.completeness).toBe("truncated");
    expect(text).toContain("export.view=visible-filtered");
    expect(text).toContain("dropped=3");
  });

  it("marks an empty capture explicitly", () => {
    const metadata = buildMetadata([]);

    expect(metadata.completeness).toBe("empty");
    expect(metadata.exportedEntryCount).toBe(0);
    expect(formatPortalTraceText([], metadata)).toContain("completeness=empty");
  });
});
