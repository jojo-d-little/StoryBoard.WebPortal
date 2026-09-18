import type { JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { FeatureRenderDensity, FeatureRenderOrientation } from "../orchestration/types";

export type AuthSignInWorkflow = Pick<
  HostWorkflowState,
  "authUsername"
  | "setAuthUsername"
  | "authPassword"
  | "setAuthPassword"
  | "hostBusy"
  | "credentialHandle"
  | "signInToHost"
  | "fetchCurrentPrincipal"
>;

export interface AuthSignInV1Props {
  hostWorkflow: AuthSignInWorkflow;
  orientation: FeatureRenderOrientation;
  density: FeatureRenderDensity;
}

export function AuthSignInV1(props: AuthSignInV1Props): JSX.Element {
  const { hostWorkflow, orientation, density } = props;
  const fieldsClassName = orientation === "horizontal" && density === "regular"
    ? "grid"
    : "auth-sign-in-fields-vertical";
  const eventsClassName = orientation === "horizontal"
    ? "events"
    : "events auth-sign-in-events-vertical";

  return (
    <section className={`config-feature-placeholder auth-sign-in auth-sign-in-${orientation} auth-sign-in-${density}`}>
      <h4>Sign In</h4>
      <div className={fieldsClassName}>
        <label>
          Username
          <input
            value={hostWorkflow.authUsername}
            onChange={(e) => hostWorkflow.setAuthUsername(e.target.value)}
            disabled={hostWorkflow.hostBusy}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={hostWorkflow.authPassword}
            onChange={(e) => hostWorkflow.setAuthPassword(e.target.value)}
            disabled={hostWorkflow.hostBusy}
          />
        </label>
      </div>
      <div className={eventsClassName}>
        <button type="button" onClick={hostWorkflow.signInToHost} disabled={hostWorkflow.hostBusy}>Sign In</button>
        <button type="button" onClick={hostWorkflow.fetchCurrentPrincipal} disabled={hostWorkflow.hostBusy || !hostWorkflow.credentialHandle}>Current Principal</button>
      </div>
    </section>
  );
}
