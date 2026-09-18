import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { FeatureRenderDensity, FeatureRenderOrientation } from "../orchestration/types";

interface CommandHandlerV1Props {
  hostWorkflow: HostWorkflowState;
  orientation: FeatureRenderOrientation;
  density: FeatureRenderDensity;
  onCommandSubmitCompleted?: () => void;
}

export function CommandHandlerV1(props: CommandHandlerV1Props): JSX.Element {
  const [commandText, setCommandText] = useState<string>("");

  const pendingClarification = props.hostWorkflow.pendingCommandClarification;
  const commandBusy = props.hostWorkflow.hostOperationKey === "command" && props.hostWorkflow.hostOperationPhase === "Running";
  const canEditCommand = Boolean(props.hostWorkflow.activeSessionId);
  const canSubmitCommand = Boolean(props.hostWorkflow.activeSessionId) && !commandBusy;
  const outputListRef = useRef<HTMLOListElement | null>(null);

  const sessionOutputLines = props.hostWorkflow.sessionOutputLines;

  useEffect(() => {
    const list = outputListRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [sessionOutputLines.length]);

  async function handleSubmitCommand(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = commandText.trim();
    if (!value) {
      return;
    }

    try {
      await props.hostWorkflow.submitCommand(value);
      setCommandText("");
    } finally {
      props.onCommandSubmitCompleted?.();
    }
  }

  async function handleClarificationSelection(selectedObjectScopeNodeId: string): Promise<void> {
    await props.hostWorkflow.submitClarificationAnswer(selectedObjectScopeNodeId);
  }

  return (
    <section className={`config-feature-placeholder command-handler command-handler-${props.orientation} command-handler-${props.density}`}>
      <form onSubmit={(event) => void handleSubmitCommand(event)} className="command-handler-form">
        <div className="command-handler-command-row">
          <input
            id="command-handler-v1-input"
            type="text"
            aria-label="Command"
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder="Type a command (for example: look)"
            disabled={!canEditCommand}
          />
          <button type="submit" className="command-handler-send" disabled={!canSubmitCommand || commandText.trim().length === 0}>Send</button>
        </div>
      </form>

      {!props.hostWorkflow.activeSessionId ? (
        <p className="subtitle">Join or start a session to send commands.</p>
      ) : null}

      {pendingClarification ? (
        <section className="command-handler-clarification">
          <h5>Clarification Required</h5>
          <p>{pendingClarification.promptText || "Select one option to continue command processing."}</p>
          <ul className="command-handler-clarification-list">
            {pendingClarification.candidates.map((candidate) => (
              <li key={candidate.objectScopeNodeId}>
                <button
                  type="button"
                  onClick={() => void handleClarificationSelection(candidate.objectScopeNodeId)}
                  disabled={commandBusy}
                >
                  {candidate.displayNameInGame || candidate.objectScopeNodeId}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="command-handler-output" aria-label="Command output">
        <div className="command-handler-output-tools">
          <button
            type="button"
            className="command-handler-clear"
            onClick={() => props.hostWorkflow.clearSessionOutputLines()}
            disabled={sessionOutputLines.length === 0}
            aria-label="Clear echo output"
            title="Clear echo output"
          >
            Clear
          </button>
        </div>
        {sessionOutputLines.length === 0 ? (
          <p className="subtitle">No output yet.</p>
        ) : (
          <ol className="command-handler-output-list" ref={outputListRef}>
            {sessionOutputLines.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
