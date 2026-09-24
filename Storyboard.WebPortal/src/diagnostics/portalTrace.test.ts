import { describe, expect, it } from "vitest";
import {
  appendPortalTraceEvent,
  normalizePortalTraceEvent,
  type PortalTraceEvent
} from "./portalTrace";

function createEvent(category: string, sequence: number): PortalTraceEvent {
  return normalizePortalTraceEvent({
    level: "info",
    category,
    message: `${category} event`,
    timestampUtc: "2026-09-23T12:00:00.000Z"
  }, sequence);
}

describe("portal trace event model", () => {
  it("maps source categories and preserves correlation metadata", () => {
    const event = normalizePortalTraceEvent({
      level: "info",
      category: "session-delta",
      message: "Delta received.",
      details: {
        correlationId: "corr-1",
        requestId: "req-1",
        sessionId: "session-1",
        gameId: "game-1",
        commandCorrelationId: 42,
        toWatermark: "17",
        gameTick: 8,
        phase: "complete",
        durationMs: 23
      },
      timestampUtc: "2026-09-23T12:00:00.000Z"
    }, 7);

    expect(event).toMatchObject({
      sequence: 7,
      timestampUtc: "2026-09-23T12:00:00.000Z",
      source: "polling",
      category: "session-delta",
      event: "session-delta",
      phase: "complete",
      correlation: {
        correlationId: "corr-1",
        requestId: "req-1",
        sessionId: "session-1",
        gameId: "game-1",
        commandCorrelationId: 42,
        sessionDeltaWatermark: "17",
        gameTick: 8
      }
    });
    expect(event.durationMs).toBe(23);
    expect(event.details?.durationMs).toBe(23);
  });

  it.each([
    ["auth", "authentication"],
    ["discovery", "discovery"],
    ["session", "session"],
    ["transport", "transport"],
    ["command", "commands"],
    ["renderer-scene", "renderer"],
    ["presentation-cues", "presentation"],
    ["session-audio", "audio"],
    ["asset-cache", "assets"],
    ["contracts", "orchestration"]
  ] as const)("maps %s to the %s source", (category, source) => {
    expect(createEvent(category, 1).source).toBe(source);
  });

  it("redacts sensitive detail keys and omits empty optional fields", () => {
    const event = normalizePortalTraceEvent({
      level: "error",
      category: "unknown-failure",
      message: "Request failed.",
      details: {
        password: "do-not-export",
        credentialHandle: "do-not-export",
        nested: { bearerToken: "do-not-export" },
        safeValue: "retain"
      }
    }, 2);

    expect(event.source).toBe("failure");
    expect(event.correlation).toBeUndefined();
    expect(event.details).toEqual({
      password: "[REDACTED]",
      credentialHandle: "[REDACTED]",
      nested: { bearerToken: "[REDACTED]" },
      safeValue: "retain"
    });
    expect(event.phase).toBeUndefined();
    expect(event.durationMs).toBeUndefined();
  });
});

describe("portal trace retention", () => {
  it("keeps the newest entries and reports dropped entries", () => {
    const first = createEvent("auth", 1);
    const second = createEvent("session", 2);
    const third = createEvent("command", 3);

    const retained = appendPortalTraceEvent([second, first], third, 2);

    expect(retained.entries.map((entry) => entry.sequence)).toEqual([3, 2]);
    expect(retained.droppedCount).toBe(1);
  });
});
