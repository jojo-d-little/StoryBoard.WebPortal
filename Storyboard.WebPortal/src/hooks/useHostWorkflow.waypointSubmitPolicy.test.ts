/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import type { HostProcessCommandResult } from "../hostApi/HostContracts";
import {
  buildWaypointSubmitCommandText,
  resolveIllegalWaypointActionReason,
  shouldEmitThrottledWarning,
  shouldClearWaypointDraftAfterSubmit
} from "./useHostWorkflow";

function buildResult(resultCode: HostProcessCommandResult["resultCode"]): HostProcessCommandResult {
  return {
    commandId: "cmd-1",
    commandText: "submitwaypoints",
    commandCorrelationId: 1,
    rawCommandText: "submitwaypoints",
    resultCode,
    clarificationRequired: false,
    pendingClarification: null,
    success: resultCode === "Success",
    matchedCommand: true,
    diagnostics: []
  };
}

describe("useHostWorkflow waypoint submit policy", () => {
  it("builds submit command with normalized waypoint tuple arguments", () => {
    const command = buildWaypointSubmitCommandText("submitwaypoints", [
      { x: 12.4, y: 19.8 },
      { x: 0.2, y: -7.4 }
    ]);

    expect(command).toBe("submitwaypoints (12,20) (0,0)");
  });

  it("returns bare verb when there are no waypoint points", () => {
    const command = buildWaypointSubmitCommandText("submitwaypoints", []);
    expect(command).toBe("submitwaypoints");
  });

  it("clears waypoint draft only on Success result code", () => {
    expect(shouldClearWaypointDraftAfterSubmit(buildResult("Success"))).toBe(true);
    expect(shouldClearWaypointDraftAfterSubmit(buildResult("Failure"))).toBe(false);
    expect(shouldClearWaypointDraftAfterSubmit(buildResult("ClarificationRequired"))).toBe(false);
    expect(shouldClearWaypointDraftAfterSubmit(null)).toBe(false);
  });

  it("classifies illegal waypoint actions outside waypoint mode", () => {
    const reason = resolveIllegalWaypointActionReason("submit-waypoint-draft", {
      activeSessionId: "session-1",
      hasRendererBridge: true,
      substate: "DefaultClick"
    });

    expect(reason).toBe("Current substate is not WaypointMoveSetup.");
  });

  it("classifies unknown gameplay substate for waypoint actions", () => {
    const reason = resolveIllegalWaypointActionReason("clear-waypoint-draft", {
      activeSessionId: "session-1",
      hasRendererBridge: true,
      substate: "UnexpectedState"
    });

    expect(reason).toBe("Unknown gameplay substate 'UnexpectedState'.");
  });

  it("allows enter-waypoint-mode from default substate when prerequisites are present", () => {
    const reason = resolveIllegalWaypointActionReason("enter-waypoint-mode", {
      activeSessionId: "session-1",
      hasRendererBridge: true,
      substate: "DefaultClick"
    });

    expect(reason).toBeNull();
  });

  it("throttles warning emission by window", () => {
    expect(shouldEmitThrottledWarning(undefined, 1_000, 5_000)).toBe(true);
    expect(shouldEmitThrottledWarning(1_000, 5_999, 5_000)).toBe(false);
    expect(shouldEmitThrottledWarning(1_000, 6_000, 5_000)).toBe(true);
  });
});
