import type { JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";

interface IdentityBootstrapStatusV1Props {
  hostWorkflow: HostWorkflowState;
}

export function IdentityBootstrapStatusV1(props: IdentityBootstrapStatusV1Props): JSX.Element {
  const signedIn = Boolean(props.hostWorkflow.credentialHandle);

  return (
    <section className="identity-bootstrap-status-v1" aria-label="Identity bootstrap status">
      <h3>{signedIn ? "Identity Ready" : "Identity Check"}</h3>
      <p className="subtitle">
        {signedIn ? "Credentials are available and bootstrap checks can continue." : "Waiting for credentials during bootstrap."}
      </p>
      <p>principal: {props.hostWorkflow.principalName || "Guest"}</p>
      <p>operation: {props.hostWorkflow.hostOperationKey}</p>
      <p>phase: {props.hostWorkflow.hostOperationPhase}</p>
    </section>
  );
}
