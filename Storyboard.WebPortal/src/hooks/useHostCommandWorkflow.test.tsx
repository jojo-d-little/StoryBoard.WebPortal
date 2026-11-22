/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostSessionPresentationData } from "../hostApi/HostContracts";
import type { HostApiClient } from "../hostApi/client";
import { useHostCommandWorkflow } from "./useHostCommandWorkflow";

function makeCommandResult(resultCode: "Started" | "Success") {
  return {
    commandId: "cmd-1",
    commandText: "push trunk south",
    commandCorrelationId: 42,
    rawCommandText: "push trunk south",
    resultCode,
    clarificationRequired: false,
    pendingClarification: null,
    success: resultCode === "Success",
    matchedCommand: true,
    diagnostics: []
  } as const;
}

function makeSessionData(commandCorrelationId = 42): HostSessionPresentationData {
  return {
    roomObjectChanges: [],
    activeRoomObjectName: "",
    activeRoomObjectSelectionCueEffectKey: "",
    secondaryActiveRoomObjectName: "",
    secondaryActiveRoomObjectSelectionCueEffectKey: "",
    soundCues: [],
    outputLines: [],
    diagnostics: [],
    sessionDeltaWatermark: "12",
    clarificationPrompt: {
      commandCorrelationId,
      pendingClarification: {
        slotId: "exit",
        ambiguousPhraseText: "south",
        promptText: "Which exit?",
        candidates: [{
          objectScopeNodeId: "exit-1",
          displayNameInGame: "South passage",
          candidateScopeParentName: "Room",
          contextLabel: ""
        }]
      }
    }
  };
}

describe("useHostCommandWorkflow delayed clarification", () => {
  it("keeps immediate clarification on the existing response path", async () => {
    const processCommand = vi.fn().mockResolvedValue({
      commandId: "cmd-1",
      commandText: "open door",
      commandCorrelationId: 27,
      rawCommandText: "open door",
      resultCode: "ClarificationRequired",
      clarificationRequired: true,
      pendingClarification: {
        slotId: "door",
        ambiguousPhraseText: "door",
        promptText: "Which door?",
        candidates: [{
          objectScopeNodeId: "door-1",
          displayNameInGame: "Oak door",
          candidateScopeParentName: "Room",
          contextLabel: ""
        }]
      },
      success: false,
      matchedCommand: true,
      diagnostics: []
    });
    const options = {
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      hostApiClient: { processCommand } as unknown as HostApiClient,
      beginHostOperation: vi.fn(() => true),
      completeHostOperation: vi.fn(),
      failHostOperation: vi.fn(),
      setHostStatus: vi.fn(),
      appendClientCommandEcho: vi.fn(),
      addDiagnostic: vi.fn()
    };
    const { result } = renderHook(() => useHostCommandWorkflow(options));

    await act(async () => { await result.current.submitCommand("open door"); });
    expect(result.current.pendingCommandClarification?.promptText).toBe("Which door?");
    expect(processCommand).toHaveBeenCalledTimes(1);
  });

  it("routes a later prompt through the existing answer request and ignores its replay", async () => {
    const processCommand = vi.fn()
      .mockResolvedValueOnce(makeCommandResult("Started"))
      .mockResolvedValueOnce(makeCommandResult("Success"));
    const options = {
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      hostApiClient: { processCommand } as unknown as HostApiClient,
      beginHostOperation: vi.fn(() => true),
      completeHostOperation: vi.fn(),
      failHostOperation: vi.fn(),
      setHostStatus: vi.fn(),
      appendClientCommandEcho: vi.fn(),
      addDiagnostic: vi.fn()
    };
    const { result } = renderHook(() => useHostCommandWorkflow(options));

    await act(async () => { await result.current.submitCommand("push trunk south"); });
    expect(result.current.lastCommandResult?.resultCode).toBe("Started");
    expect(result.current.pendingCommandClarification).toBeNull();

    act(() => {
      result.current.consumeDelayedClarificationPrompt(makeSessionData());
      result.current.consumeDelayedClarificationPrompt(makeSessionData());
    });
    expect(result.current.pendingCommandClarification?.promptText).toBe("Which exit?");

    await act(async () => { await result.current.submitClarificationAnswer("exit-1"); });
    expect(processCommand).toHaveBeenCalledTimes(2);
    expect(processCommand.mock.calls[1]).toEqual([
      "cred-1", "session-1", 42, "push trunk south",
      [{ slotId: "exit", selectedObjectScopeNodeId: "exit-1" }], "Low"
    ]);
  });

  it("keeps a prompt delivered before the accepted-start response resolves", async () => {
    let resolveCommand!: (value: ReturnType<typeof makeCommandResult>) => void;
    const firstResponse = new Promise<ReturnType<typeof makeCommandResult>>((resolve) => { resolveCommand = resolve; });
    const processCommand = vi.fn().mockReturnValue(firstResponse);
    const options = {
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      hostApiClient: { processCommand } as unknown as HostApiClient,
      beginHostOperation: vi.fn(() => true),
      completeHostOperation: vi.fn(),
      failHostOperation: vi.fn(),
      setHostStatus: vi.fn(),
      appendClientCommandEcho: vi.fn(),
      addDiagnostic: vi.fn()
    };
    const { result } = renderHook(() => useHostCommandWorkflow(options));
    let submission!: Promise<unknown>;

    await act(async () => {
      submission = result.current.submitCommand("push trunk south");
      await Promise.resolve();
    });
    const commandCorrelationId = processCommand.mock.calls[0][2] as number;
    act(() => result.current.consumeDelayedClarificationPrompt(makeSessionData(commandCorrelationId)));
    expect(result.current.pendingCommandClarification?.promptText).toBe("Which exit?");

    await act(async () => {
      resolveCommand(makeCommandResult("Started"));
      await submission;
    });
    expect(result.current.pendingCommandClarification?.promptText).toBe("Which exit?");
  });

  it("does not surface a delayed prompt after command state has been cleared", async () => {
    const processCommand = vi.fn().mockResolvedValue(makeCommandResult("Started"));
    const options = {
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      hostApiClient: { processCommand } as unknown as HostApiClient,
      beginHostOperation: vi.fn(() => true),
      completeHostOperation: vi.fn(),
      failHostOperation: vi.fn(),
      setHostStatus: vi.fn(),
      appendClientCommandEcho: vi.fn(),
      addDiagnostic: vi.fn()
    };
    const { result } = renderHook(() => useHostCommandWorkflow(options));

    await act(async () => { await result.current.submitCommand("push trunk south"); });
    act(() => {
      result.current.clearPendingCommandState();
      result.current.consumeDelayedClarificationPrompt(makeSessionData());
    });

    expect(result.current.pendingCommandClarification).toBeNull();
    expect(processCommand).toHaveBeenCalledTimes(1);
  });
});
