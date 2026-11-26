import type { HostCommandCompletion, HostProcessCommandResult } from "../hostApi/HostContracts";

/**
 * Command-outcome facts observed by the Portal, published in the order they were processed.
 * - completion: a terminal `commandCompletions` entry, published after its session update was applied.
 * - clarificationPrompt: a delayed clarification prompt was accepted for a command.
 * - clarificationResponse: the HTTP response to a clarification answer.
 * - outcomeLost: delivery continuity was lost (resync, session change/reset/end), so pending
 *   outcomes for that session can no longer be established.
 */
export type CommandOutcomeEvent =
  | { kind: "completion"; sessionId: string; completion: HostCommandCompletion }
  | { kind: "clarificationPrompt"; sessionId: string; commandCorrelationId: number }
  | { kind: "clarificationResponse"; sessionId: string; commandCorrelationId: number; response: HostProcessCommandResult }
  | { kind: "outcomeLost"; sessionId: string; reason: string };

type CommandOutcomeListener = (event: CommandOutcomeEvent) => void;

export class CommandOutcomeChannel {
  private readonly listeners = new Set<CommandOutcomeListener>();

  subscribe(listener: CommandOutcomeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: CommandOutcomeEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

export type CommandTerminalOutcome =
  | { kind: "success" }
  | { kind: "failure"; message: string }
  | { kind: "unknown"; message: string }
  | { kind: "cancelled" };

export type CommandWaitPhase = "awaitingCompletion" | "awaitingClarificationAnswer";

export interface CommandCompletionWaitInput {
  /** The initial HTTP response for the submitted command. */
  initial: Pick<HostProcessCommandResult, "resultCode" | "commandCorrelationId">;
  /** Bound on waiting for a completion; suspended while a clarification answer is awaited. */
  timeoutMs: number;
  signal?: AbortSignal;
  onPhase?: (phase: CommandWaitPhase, commandCorrelationId: number) => void;
}

export interface CommandCompletionWatch {
  waitForTerminal(input: CommandCompletionWaitInput): Promise<CommandTerminalOutcome>;
  dispose(): void;
}

const IMMEDIATE_FAILURE_CODES = new Set(["Failure", "NoMatch"]);

/**
 * Starts recording outcome events for a session *before* a command is submitted, so a completion
 * or prompt delivered by a session update ahead of the HTTP response is not missed. Call
 * `waitForTerminal` with the response, then `dispose` (also safe if never awaited).
 */
export function armCommandCompletionWatch(channel: CommandOutcomeChannel, sessionId: string): CommandCompletionWatch {
  const buffered: CommandOutcomeEvent[] = [];
  let liveHandler: ((event: CommandOutcomeEvent) => void) | null = null;
  let disposeWait: (() => void) | null = null;
  const unsubscribe = channel.subscribe((event) => {
    if (event.sessionId !== sessionId) return;
    if (liveHandler) {
      liveHandler(event);
    } else {
      buffered.push(event);
    }
  });

  function dispose(): void {
    unsubscribe();
    liveHandler = null;
    disposeWait?.();
    disposeWait = null;
    buffered.length = 0;
  }

  function waitForTerminal(input: CommandCompletionWaitInput): Promise<CommandTerminalOutcome> {
    const { initial } = input;
    const code = initial.resultCode;
    if (code === "Success") return Promise.resolve({ kind: "success" });
    if (code !== "Started" && code !== "ClarificationRequired") {
      return Promise.resolve({ kind: "failure", message: `Command returned ${code}.` });
    }

    const correlationId = initial.commandCorrelationId;
    if (!Number.isSafeInteger(correlationId) || correlationId <= 0) {
      return Promise.resolve({ kind: "unknown", message: `Command returned ${code} without a usable correlation id.` });
    }

    if (input.signal?.aborted) return Promise.resolve({ kind: "cancelled" });

    return new Promise<CommandTerminalOutcome>((resolve) => {
      let settled = false;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      const clearTimer = (): void => {
        if (timerId !== null) clearTimeout(timerId);
        timerId = null;
      };
      const onAbort = (): void => finish({ kind: "cancelled" });
      const cleanup = (): void => {
        clearTimer();
        input.signal?.removeEventListener("abort", onAbort);
        liveHandler = null;
      };
      function finish(outcome: CommandTerminalOutcome): void {
        if (settled) return;
        settled = true;
        cleanup();
        disposeWait = null;
        resolve(outcome);
      }
      function enterPhase(phase: CommandWaitPhase): void {
        clearTimer();
        if (phase === "awaitingCompletion") {
          timerId = setTimeout(() => finish({
            kind: "unknown",
            message: `No completion was received within ${input.timeoutMs} ms; the outcome is unknown.`
          }), Math.max(0, input.timeoutMs));
        }
        input.onPhase?.(phase, correlationId);
      }

      function handle(event: CommandOutcomeEvent): void {
        if (settled) return;
        switch (event.kind) {
          case "outcomeLost":
            finish({ kind: "unknown", message: `${event.reason} The outcome is unknown.` });
            return;
          case "completion":
            if (event.completion.commandCorrelationId !== correlationId) return;
            finish(event.completion.resultCode === "Success"
              ? { kind: "success" }
              : { kind: "failure", message: event.completion.failureMessage?.trim() || "Command failed." });
            return;
          case "clarificationPrompt":
            if (event.commandCorrelationId === correlationId) enterPhase("awaitingClarificationAnswer");
            return;
          case "clarificationResponse": {
            if (event.commandCorrelationId !== correlationId) return;
            const answerCode = event.response.resultCode;
            if (answerCode === "Success") finish({ kind: "success" });
            else if (answerCode === "Started") enterPhase("awaitingCompletion");
            else if (answerCode === "ClarificationRequired") enterPhase("awaitingClarificationAnswer");
            else if (IMMEDIATE_FAILURE_CODES.has(answerCode)) finish({ kind: "failure", message: `Clarification answer returned ${answerCode}.` });
            else finish({ kind: "unknown", message: `Clarification answer was rejected (${answerCode}).` });
            return;
          }
        }
      }

      input.signal?.addEventListener("abort", onAbort, { once: true });
      disposeWait = () => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve({ kind: "cancelled" });
        }
      };
      enterPhase(code === "Started" ? "awaitingCompletion" : "awaitingClarificationAnswer");
      liveHandler = handle;
      const pending = buffered.splice(0, buffered.length);
      for (const event of pending) handle(event);
    });
  }

  return { waitForTerminal, dispose };
}
