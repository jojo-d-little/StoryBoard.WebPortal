import { useState, type JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";

interface InterruptionRecoveryV1Props {
  hostWorkflow: HostWorkflowState;
}

export function InterruptionRecoveryV1(props: InterruptionRecoveryV1Props): JSX.Element {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <section className="config-feature-placeholder interruption-recovery-v1" aria-label="Session disconnected recovery">
      <h3>Connection Lost</h3>
      <p className="subtitle">Your session disconnected. Reconnect now or return to the lobby.</p>
      <p>sessionId: {props.hostWorkflow.activeSessionId || props.hostWorkflow.selectedSessionId || "(none)"}</p>
      <p>status: {props.hostWorkflow.hostStatus}</p>

      <div className="events">
        <button type="button" onClick={props.hostWorkflow.reconnectActiveSession} disabled={props.hostWorkflow.hostBusy}>
          Reconnect Now
        </button>
        <button type="button" onClick={props.hostWorkflow.returnToLobby} disabled={props.hostWorkflow.hostBusy}>
          Return To Lobby
        </button>
        <button type="button" onClick={() => setShowDetails((value) => !value)}>
          {showDetails ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {showDetails ? (
        <div className="interruption-recovery-details">
          <p>operation: {props.hostWorkflow.hostOperationKey}</p>
          <p>phase: {props.hostWorkflow.hostOperationPhase}</p>
          <p>credentialHandle: {props.hostWorkflow.credentialHandle || "(none)"}</p>
          <p>principal: {props.hostWorkflow.principalName || "Guest"}</p>
        </div>
      ) : null}
    </section>
  );
}
