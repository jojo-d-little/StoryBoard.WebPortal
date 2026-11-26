import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostProcessCommandResult } from "../hostApi/HostContracts";
import { armCommandCompletionWatch, CommandOutcomeChannel, type CommandWaitPhase } from "./commandCompletionTracking";

const SESSION = "session-1";

function response(resultCode: HostProcessCommandResult["resultCode"], commandCorrelationId = 7): HostProcessCommandResult {
  return {
    commandId: "",
    commandText: "",
    commandCorrelationId,
    rawCommandText: "",
    resultCode,
    clarificationRequired: resultCode === "ClarificationRequired",
    pendingClarification: null,
    success: resultCode === "Success" || resultCode === "Started",
    matchedCommand: true,
    diagnostics: []
  };
}

function completion(commandCorrelationId: number, resultCode: "Success" | "Failure", failureMessage?: string) {
  return { kind: "completion" as const, sessionId: SESSION, completion: { commandCorrelationId, resultCode, failureMessage } };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("armCommandCompletionWatch", () => {
  it("treats an immediate Success as complete without any later event", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    await expect(watch.waitForTerminal({ initial: response("Success"), timeoutMs: 1000 })).resolves.toEqual({ kind: "success" });
    watch.dispose();
    expect(channel.listenerCount).toBe(0);
  });

  it.each(["Failure", "NoMatch", "ClarificationStateStale"] as const)("stops on an immediate %s", async (code) => {
    const watch = armCommandCompletionWatch(new CommandOutcomeChannel(), SESSION);
    await expect(watch.waitForTerminal({ initial: response(code), timeoutMs: 1000 }))
      .resolves.toEqual({ kind: "failure", message: `Command returned ${code}.` });
    watch.dispose();
  });

  it("waits for the correlated completion after Started, ignoring unrelated ones and other sessions", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const phases: CommandWaitPhase[] = [];
    let settled = false;
    const outcome = watch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000, onPhase: (phase) => phases.push(phase) })
      .then((value) => { settled = true; return value; });
    channel.publish(completion(6, "Success"));
    channel.publish({ kind: "completion", sessionId: "other", completion: { commandCorrelationId: 7, resultCode: "Success" } });
    channel.publish({ kind: "outcomeLost", sessionId: "other", reason: "Other session ended." });
    await Promise.resolve();
    expect(settled).toBe(false);
    channel.publish(completion(7, "Success"));
    channel.publish(completion(7, "Failure"));
    await expect(outcome).resolves.toEqual({ kind: "success" });
    expect(phases).toEqual(["awaitingCompletion"]);
    watch.dispose();
  });

  it("reports a delayed final failure with its message", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const outcome = watch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000 });
    channel.publish(completion(7, "Failure", "The green suitcase does not fit."));
    await expect(outcome).resolves.toEqual({ kind: "failure", message: "The green suitcase does not fit." });
    watch.dispose();
  });

  it("keeps a completion that arrives before the HTTP response", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    channel.publish(completion(3, "Success"));
    channel.publish(completion(7, "Success"));
    await expect(watch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000 })).resolves.toEqual({ kind: "success" });
    watch.dispose();
  });

  it("pauses for a delayed clarification, never treats it as completion, then waits for the final outcome", async () => {
    vi.useFakeTimers();
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const phases: CommandWaitPhase[] = [];
    let result: unknown;
    void watch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000, onPhase: (phase) => phases.push(phase) })
      .then((value) => { result = value; });
    channel.publish({ kind: "clarificationPrompt", sessionId: SESSION, commandCorrelationId: 7 });
    // The timeout is suspended while the player decides.
    await vi.advanceTimersByTimeAsync(5000);
    expect(result).toBeUndefined();
    channel.publish({ kind: "clarificationResponse", sessionId: SESSION, commandCorrelationId: 7, response: response("Started") });
    await vi.advanceTimersByTimeAsync(500);
    expect(result).toBeUndefined();
    channel.publish(completion(7, "Success"));
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ kind: "success" });
    expect(phases).toEqual(["awaitingCompletion", "awaitingClarificationAnswer", "awaitingCompletion"]);
    watch.dispose();
  });

  it("completes an immediate clarification once the answer succeeds", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const phases: CommandWaitPhase[] = [];
    const outcome = watch.waitForTerminal({ initial: response("ClarificationRequired"), timeoutMs: 10, onPhase: (phase) => phases.push(phase) });
    channel.publish({ kind: "clarificationResponse", sessionId: SESSION, commandCorrelationId: 8, response: response("Success", 8) });
    channel.publish({ kind: "clarificationResponse", sessionId: SESSION, commandCorrelationId: 7, response: response("Success") });
    await expect(outcome).resolves.toEqual({ kind: "success" });
    expect(phases).toEqual(["awaitingClarificationAnswer"]);
    watch.dispose();
  });

  it("stops as unknown when a clarification answer is rejected as stale", async () => {
    const channel = new CommandOutcomeChannel();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const outcome = watch.waitForTerminal({ initial: response("ClarificationRequired"), timeoutMs: 10 });
    channel.publish({ kind: "clarificationResponse", sessionId: SESSION, commandCorrelationId: 7, response: response("ClarificationStateStale") });
    await expect(outcome).resolves.toEqual({ kind: "unknown", message: "Clarification answer was rejected (ClarificationStateStale)." });
    watch.dispose();
  });

  it("stops as unknown on lost history, and on timeout without advancing", async () => {
    const channel = new CommandOutcomeChannel();
    const lostWatch = armCommandCompletionWatch(channel, SESSION);
    const lost = lostWatch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000 });
    channel.publish({ kind: "outcomeLost", sessionId: SESSION, reason: "Resync required." });
    await expect(lost).resolves.toEqual({ kind: "unknown", message: "Resync required. The outcome is unknown." });
    lostWatch.dispose();

    vi.useFakeTimers();
    const timeoutWatch = armCommandCompletionWatch(channel, SESSION);
    const timedOut = timeoutWatch.waitForTerminal({ initial: response("Started"), timeoutMs: 250 });
    await vi.advanceTimersByTimeAsync(250);
    await expect(timedOut).resolves.toEqual({ kind: "unknown", message: "No completion was received within 250 ms; the outcome is unknown." });
    channel.publish(completion(7, "Success"));
    timeoutWatch.dispose();
    expect(channel.listenerCount).toBe(0);
  });

  it("cancels on abort or dispose and removes its subscription", async () => {
    const channel = new CommandOutcomeChannel();
    const abort = new AbortController();
    const watch = armCommandCompletionWatch(channel, SESSION);
    const outcome = watch.waitForTerminal({ initial: response("Started"), timeoutMs: 1000, signal: abort.signal });
    abort.abort();
    await expect(outcome).resolves.toEqual({ kind: "cancelled" });
    watch.dispose();

    const disposed = armCommandCompletionWatch(channel, SESSION);
    const pending = disposed.waitForTerminal({ initial: response("Started"), timeoutMs: 1000 });
    disposed.dispose();
    await expect(pending).resolves.toEqual({ kind: "cancelled" });
    expect(channel.listenerCount).toBe(0);
  });

  it("does not wait on a Started response without a usable correlation id", async () => {
    const watch = armCommandCompletionWatch(new CommandOutcomeChannel(), SESSION);
    await expect(watch.waitForTerminal({ initial: response("Started", 0), timeoutMs: 1000 }))
      .resolves.toMatchObject({ kind: "unknown" });
    watch.dispose();
  });
});
