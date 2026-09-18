/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostProcessCommandResult } from "../hostApi/HostContracts";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import {
  buildWaypointSubmitCommandText,
  shouldClearWaypointDraftAfterSubmit
} from "../hooks/useHostWorkflow";
import { InGameToolsMenuHostV1 } from "./InGameToolsMenuHostV1";
import { SessionPlaySurfaceHostV1 } from "./SessionPlaySurfaceHostV1";

vi.mock("./SessionPlaySurfaceRendererV1", async () => {
  const React = await import("react");

  function SessionPlaySurfaceRendererV1(props: {
    gameplayInteractionSubstate: "DefaultClick" | "WaypointMoveSetup";
    onWaypointPointSelected: (point: { x: number; y: number }) => void;
    onCommandPointSelected: (point: { x: number; y: number }, insideRoom: boolean) => void;
  }): JSX.Element {
    const clickIndexRef = React.useRef(0);

    return (
      <button
        type="button"
        aria-label="Surface Click"
        onClick={() => {
          const scriptedPoints = [
            { x: 12.4, y: 19.8 },
            { x: 0.2, y: -7.4 }
          ];
          const point = scriptedPoints[Math.min(clickIndexRef.current, scriptedPoints.length - 1)];
          clickIndexRef.current += 1;

          if (props.gameplayInteractionSubstate === "WaypointMoveSetup") {
            props.onWaypointPointSelected(point);
            return;
          }

          props.onCommandPointSelected(point, true);
        }}
      >
        Surface Click
      </button>
    );
  }

  return { SessionPlaySurfaceRendererV1 };
});

type SubmittedCommandRecord = {
  commandText: string;
  suppressClientEcho: boolean;
};

function buildSuccessfulResult(rawCommandText: string): HostProcessCommandResult {
  return {
    commandId: "cmd-1",
    commandText: rawCommandText,
    commandCorrelationId: 1,
    rawCommandText,
    resultCode: "Success",
    clarificationRequired: false,
    pendingClarification: null,
    success: true,
    matchedCommand: true,
    diagnostics: []
  };
}

function buildHarnessHostWorkflow(
  submittedCommands: SubmittedCommandRecord[]
): HostWorkflowState {
  let gameplayInteractionSubstate: "DefaultClick" | "WaypointMoveSetup" = "DefaultClick";
  let waypointDraft: Array<{ x: number; y: number }> = [];

  const submitCommand = async (
    rawCommandText: string,
    options?: { suppressClientEcho?: boolean }
  ): Promise<HostProcessCommandResult | null> => {
    submittedCommands.push({
      commandText: rawCommandText,
      suppressClientEcho: options?.suppressClientEcho === true
    });

    return buildSuccessfulResult(rawCommandText);
  };

  const hostWorkflow = {
    gameplayInteractionSubstate,
    waypointDraftCount: waypointDraft.length,
    hostOperationKey: "none",
    hostOperationPhase: "Idle",
    activeSessionId: "session-1",
    rendererSceneSnapshot: null,
    waypointPointPlacementCueStyle: null,
    hudOverlayEntries: [],
    dismissHudOverlay: () => {},
    registerWaypointInteractionRendererBridge: () => {},
    reportRendererDiagnostic: () => {},
    reportRendererScaleMetrics: () => {},
    reportRendererLastClickPoint: () => {},
    buildPointClickedCommand: (roomX: number, roomY: number) => {
      const normalizedX = Math.max(0, Math.round(roomX));
      const normalizedY = Math.max(0, Math.round(roomY));
      return `pointclicked (${normalizedX},${normalizedY})`;
    },
    reportPlaySurfaceCommandDispatch: () => {},
    submitCommand,
    enterWaypointMoveSetup: () => {
      gameplayInteractionSubstate = "WaypointMoveSetup";
      hostWorkflow.gameplayInteractionSubstate = gameplayInteractionSubstate;
    },
    cancelWaypointMoveSetup: () => {
      waypointDraft = [];
      hostWorkflow.waypointDraftCount = waypointDraft.length;
      gameplayInteractionSubstate = "DefaultClick";
      hostWorkflow.gameplayInteractionSubstate = gameplayInteractionSubstate;
    },
    clearWaypointDraft: () => {
      waypointDraft = [];
      hostWorkflow.waypointDraftCount = waypointDraft.length;
    },
    undoLastWaypointDraftPoint: () => {
      waypointDraft = waypointDraft.slice(0, -1);
      hostWorkflow.waypointDraftCount = waypointDraft.length;
    },
    appendWaypointDraftPoint: (point: { x: number; y: number }) => {
      waypointDraft = [...waypointDraft, point];
      hostWorkflow.waypointDraftCount = waypointDraft.length;
    },
    submitWaypointDraft: async () => {
      if (waypointDraft.length === 0) {
        return;
      }

      const outboundCommandText = buildWaypointSubmitCommandText("submitwaypoints", waypointDraft);
      const result = await submitCommand(outboundCommandText, { suppressClientEcho: true });
      if (!shouldClearWaypointDraftAfterSubmit(result)) {
        return;
      }

      waypointDraft = [];
      hostWorkflow.waypointDraftCount = waypointDraft.length;
    }
  } as unknown as HostWorkflowState;

  return hostWorkflow;
}

describe("Waypoint click-to-submit flow", () => {
  it("collects points, suppresses pointclicked in waypoint mode, submits rounded tuples, and clears on success", async () => {
    const submittedCommands: SubmittedCommandRecord[] = [];
    const hostWorkflow = buildHarnessHostWorkflow(submittedCommands);

    const { rerender } = render(
      <>
        <InGameToolsMenuHostV1 hostWorkflow={hostWorkflow} orientation="vertical" density="regular" />
        <SessionPlaySurfaceHostV1 hostWorkflow={hostWorkflow} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Waypoint Move" }));
    rerender(
      <>
        <InGameToolsMenuHostV1 hostWorkflow={hostWorkflow} orientation="vertical" density="regular" />
        <SessionPlaySurfaceHostV1 hostWorkflow={hostWorkflow} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Surface Click" }));
    fireEvent.click(screen.getByRole("button", { name: "Surface Click" }));
    rerender(
      <>
        <InGameToolsMenuHostV1 hostWorkflow={hostWorkflow} orientation="vertical" density="regular" />
        <SessionPlaySurfaceHostV1 hostWorkflow={hostWorkflow} />
      </>
    );

    expect(submittedCommands).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(submittedCommands).toHaveLength(1);
    });

    expect(submittedCommands[0]).toEqual({
      commandText: "submitwaypoints (12,20) (0,0)",
      suppressClientEcho: true
    });
    expect(submittedCommands.some((entry) => entry.commandText.startsWith("pointclicked"))).toBe(false);

    rerender(
      <>
        <InGameToolsMenuHostV1 hostWorkflow={hostWorkflow} orientation="vertical" density="regular" />
        <SessionPlaySurfaceHostV1 hostWorkflow={hostWorkflow} />
      </>
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
