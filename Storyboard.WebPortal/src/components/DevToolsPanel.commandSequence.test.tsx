// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DevToolsPanel } from "./DevToolsPanel";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS } from "../gameRenderer/presentationIsolation";
import { CommandOutcomeChannel } from "../utils/commandCompletionTracking";
import type { HostProcessCommandResultCode } from "../hostApi/HostContracts";

type Props = ComponentProps<typeof DevToolsPanel>;
type SubmitResult = { resultCode: HostProcessCommandResultCode; commandCorrelationId: number } | null;

const SESSION = "session-1";

interface Harness {
  channel: CommandOutcomeChannel;
  sent: string[];
  submit: ReturnType<typeof vi.fn>;
  rerender: (overrides: Partial<Props>) => void;
  unmount: () => void;
}

function baseProps(overrides: Partial<Props>): Props {
  return {
    effectiveSlotModes: {},
    cacheStats: {
      lookupRequests: 0, memoryHits: 0, indexedDbHits: 0, memoryEntryCount: 0, memoryBytes: 0,
      indexedDbEntryCount: 0, indexedDbBytes: 0, networkFetches: 0, misses: 0, writes: 0,
      memoryEvictions: 0, indexedDbEvictions: 0, ttlExpirations: 0, parseFailures: 0, indexedDbErrors: 0
    },
    pollIntervalMs: 100,
    heartbeatEveryNPolls: 10,
    presentationIsolationSettings: DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
    presentationIsolationCategoryOptions: [],
    sessionRecording: { playbackStatus: null },
    activeSessionId: SESSION,
    sessionDeltaRevision: 0,
    ...overrides
  } as unknown as Props;
}

/**
 * Renders the panel with a scripted submitCommand: each call takes the next responder, which may
 * publish channel events (e.g. an early completion) before returning the HTTP result.
 */
async function setup(
  fileText: string,
  responders: Array<(channel: CommandOutcomeChannel, id: number) => SubmitResult | Promise<SubmitResult>>,
  overrides: Partial<Props> = {},
  mode: "automatic" | "manual" = "automatic"
): Promise<Harness> {
  const channel = new CommandOutcomeChannel();
  const sent: string[] = [];
  let nextId = 100;
  const submit = vi.fn(async (command: string) => {
    sent.push(command);
    const id = ++nextId;
    const responder = responders.shift();
    if (!responder) throw new Error(`Unexpected command: ${command}`);
    return responder(channel, id);
  });
  let props = baseProps({ submitCommand: submit, commandOutcomeChannel: channel, ...overrides });
  const view = render(<DevToolsPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Command Sequence" }));
  fireEvent.change(screen.getByLabelText("Playback mode"), { target: { value: mode } });
  const input = screen.getByLabelText("Load command file");
  const file = new File([fileText], "sequence.txt", { type: "text/plain" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  await screen.findByText(/commands loaded/);
  return {
    channel,
    sent,
    submit,
    unmount: () => view.unmount(),
    rerender: (next) => {
      props = { ...props, ...next };
      view.rerender(<DevToolsPanel {...props} />);
    }
  };
}

const started = (_: CommandOutcomeChannel, id: number): SubmitResult => ({ resultCode: "Started", commandCorrelationId: id });
const success = (_: CommandOutcomeChannel, id: number): SubmitResult => ({ resultCode: "Success", commandCorrelationId: id });

function complete(channel: CommandOutcomeChannel, id: number, resultCode: "Success" | "Failure" = "Success", failureMessage?: string): void {
  act(() => {
    channel.publish({ kind: "completion", sessionId: SESSION, completion: { commandCorrelationId: id, resultCode, failureMessage } });
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function status(): string {
  return screen.getByRole("status").textContent ?? "";
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DevToolsPanel command sequence with complete", () => {
  it("submits each line only after the previous command completed, ignoring unrelated and duplicate completions", async () => {
    const h = await setup(
      "stack yellow suitcase on trunk | complete\nstack green suitcase on yellow suitcase | Complete\nlook | COMPLETE",
      [started, started, success]
    );
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(status()).toMatch(/Waiting for command 1 of 3 to complete \(line 1, correlation 101\)/));

    complete(h.channel, 55);
    act(() => h.channel.publish({ kind: "outcomeLost", sessionId: "other-session", reason: "x" }));
    await flush();
    expect(h.sent).toEqual(["stack yellow suitcase on trunk"]);

    complete(h.channel, 101);
    await waitFor(() => expect(status()).toMatch(/Waiting for command 2 of 3 to complete \(line 2, correlation 102\)/));
    complete(h.channel, 101); // duplicate replay of the prior completion must not advance line 2
    await flush();
    expect(h.sent).toHaveLength(2);

    complete(h.channel, 102);
    await waitFor(() => expect(status()).toMatch(/Finished: 3 commands sent and the last command completed\./));
    expect(h.sent).toEqual(["stack yellow suitcase on trunk", "stack green suitcase on yellow suitcase", "look"]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(h.channel.listenerCount).toBe(0);
  });

  it("keeps a completion delivered before the HTTP response", async () => {
    const h = await setup("open door | complete\nlook | complete", [
      (channel, id) => {
        channel.publish({ kind: "completion", sessionId: SESSION, completion: { commandCorrelationId: id, resultCode: "Success" } });
        return { resultCode: "Started", commandCorrelationId: id };
      },
      success
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(status()).toMatch(/Finished: 2 commands sent/));
    expect(h.sent).toEqual(["open door", "look"]);
  });

  it("does not report the sequence finished until the final Started line completes", async () => {
    const h = await setup("go north | complete", [started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(status()).toMatch(/Waiting for command 1 of 1 to complete/));
    await flush();
    expect(status()).not.toMatch(/Finished/);
    expect(screen.getByRole("button", { name: "Stop Playback" })).not.toBeDisabled();
    complete(h.channel, 101);
    await waitFor(() => expect(status()).toMatch(/Finished: 1 commands sent and the last command completed/));
  });

  it("stops on a delayed final failure with the line and reason", async () => {
    const h = await setup("stack yellow suitcase on trunk | complete\nstack green suitcase on yellow suitcase | complete\nlook | 0", [started, started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.sent).toHaveLength(1));
    complete(h.channel, 101);
    await waitFor(() => expect(h.sent).toHaveLength(2));
    complete(h.channel, 102, "Failure", "The green suitcase cannot be stacked there");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Command on line 2 failed: The green suitcase cannot be stacked there. Playback stopped."
    );
    expect(h.sent).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Play Commands" })).not.toBeDisabled();
  });

  it("stops on an immediate failure", async () => {
    const h = await setup("fly | complete\nlook | complete", [
      (_, id) => ({ resultCode: "NoMatch", commandCorrelationId: id })
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Command on line 1 failed: Command returned NoMatch. Playback stopped.");
    expect(h.sent).toEqual(["fly"]);
  });

  it("waits through a delayed clarification and its answer, then the final outcome", async () => {
    const h = await setup("push trunk | complete\nlook | complete", [started, success]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.sent).toHaveLength(1));
    act(() => h.channel.publish({ kind: "clarificationPrompt", sessionId: SESSION, commandCorrelationId: 101 }));
    await waitFor(() => expect(status()).toMatch(/Waiting for a clarification answer for command 1 of 2 \(line 1\)\. Answer the prompt to continue\./));
    act(() => h.channel.publish({
      kind: "clarificationResponse",
      sessionId: SESSION,
      commandCorrelationId: 101,
      response: {
        commandId: "", commandText: "", commandCorrelationId: 101, rawCommandText: "push trunk",
        resultCode: "Started", clarificationRequired: false, pendingClarification: null,
        success: true, matchedCommand: true, diagnostics: []
      }
    }));
    await waitFor(() => expect(status()).toMatch(/Waiting for command 1 of 2 to complete/));
    expect(h.sent).toHaveLength(1);
    complete(h.channel, 101);
    await waitFor(() => expect(status()).toMatch(/Finished: 2 commands sent/));
  });

  it("waits for the answer to an immediate clarification", async () => {
    const h = await setup("take key | complete", [(_, id) => ({ resultCode: "ClarificationRequired", commandCorrelationId: id })]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(status()).toMatch(/Waiting for a clarification answer/));
    act(() => h.channel.publish({
      kind: "clarificationResponse",
      sessionId: SESSION,
      commandCorrelationId: 101,
      response: {
        commandId: "", commandText: "", commandCorrelationId: 101, rawCommandText: "take key",
        resultCode: "Success", clarificationRequired: false, pendingClarification: null,
        success: true, matchedCommand: true, diagnostics: []
      }
    }));
    await waitFor(() => expect(status()).toMatch(/Finished: 1 commands sent/));
  });

  it("stops as unknown on resync and never advances", async () => {
    const h = await setup("go west | complete\nlook | complete", [started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.sent).toHaveLength(1));
    act(() => h.channel.publish({ kind: "outcomeLost", sessionId: SESSION, reason: "Session history was lost and a baseline resync was required." }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Command on line 1: Session history was lost and a baseline resync was required. The outcome is unknown. Playback stopped; inspect the game state before restarting."
    );
    complete(h.channel, 101);
    await flush();
    expect(h.sent).toHaveLength(1);
  });

  it("stops as unknown on timeout and never advances", async () => {
    const h = await setup("go west | complete\nlook | complete", [started], { commandCompletionTimeoutMs: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Command on line 1: No completion was received within 30 ms; the outcome is unknown.");
    expect(h.sent).toHaveLength(1);
    expect(h.channel.listenerCount).toBe(0);
  });

  it("stops as unknown when the session changes during a wait", async () => {
    const h = await setup("go west | complete\nlook | complete", [started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.sent).toHaveLength(1));
    act(() => h.rerender({ activeSessionId: "session-2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Command on line 1: The session changed or ended. The outcome is unknown.");
    expect(h.sent).toHaveLength(1);
  });

  it("stop cancels the wait and removes its subscription", async () => {
    const h = await setup("go west | complete\nlook | complete", [started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.channel.listenerCount).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Stop Playback" }));
    await waitFor(() => expect(h.channel.listenerCount).toBe(0));
    complete(h.channel, 101);
    await flush();
    expect(status()).toBe("Playback stopped.");
    expect(h.sent).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("unmount cancels the wait and removes its subscription", async () => {
    const h = await setup("go west | complete", [started]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await waitFor(() => expect(h.channel.listenerCount).toBe(1));
    h.unmount();
    await flush();
    expect(h.channel.listenerCount).toBe(0);
    complete(h.channel, 101);
    await flush();
    expect(h.sent).toHaveLength(1);
  });

  it("advances one completed command at a time in manual mode", async () => {
    const h = await setup("go west | complete\nlook | 500", [started, started], {}, "manual");
    expect(status()).toMatch(/Next command: go west \(advances when complete\)/);
    fireEvent.click(screen.getByRole("button", { name: "Next Command" }));
    await waitFor(() => expect(status()).toMatch(/Waiting for command 1 of 2 to complete/));
    expect(screen.getByRole("button", { name: "Next Command" })).toBeDisabled();
    complete(h.channel, 101);
    await waitFor(() => expect(status()).toMatch(/Command 1 complete\. Click Next Command when ready\. Next command: look \(recommended pause: 500 ms\)/));

    // Numeric manual line keeps its existing behavior and does not claim a Started command finished the sequence.
    fireEvent.click(screen.getByRole("button", { name: "Next Command" }));
    await waitFor(() => expect(status()).toMatch(/Command 2 accepted\. All commands sent\./));
    expect(h.sent).toEqual(["go west", "look"]);
  });
});

describe("DevToolsPanel command sequence numeric timing", () => {
  it("keeps the delta wait and file pause, and does not wait for completion of Started commands", async () => {
    const h = await setup("go west | 300\nlook | 0", [started, success]);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(h.sent).toEqual(["go west"]);
    // Delta deadline is max(200, 2 * pollIntervalMs) = 200 ms, then the 300 ms file pause.
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(h.sent).toEqual(["go west"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(h.sent).toEqual(["go west", "look"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(status()).toMatch(/Finished sending 2 commands\./);
    expect(h.channel.listenerCount).toBe(0);
  });

  it("still stops a numeric line on a non-success result", async () => {
    const h = await setup("take key | 0\nlook | 0", [(_, id) => ({ resultCode: "ClarificationRequired", commandCorrelationId: id })]);
    fireEvent.click(screen.getByRole("button", { name: "Play Commands" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Command on line 1 did not complete successfully (ClarificationRequired).");
    expect(h.sent).toHaveLength(1);
  });
});
