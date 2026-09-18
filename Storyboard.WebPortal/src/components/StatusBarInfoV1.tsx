import type { JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";

interface StatusBarInfoV1Props {
  state: string;
  hostWorkflow: HostWorkflowState;
}

export function StatusBarInfoV1(props: StatusBarInfoV1Props): JSX.Element {
  const sessionId = props.hostWorkflow.activeSessionId || "(none)";
  const principal = props.hostWorkflow.principalName || "(guest)";
  const phase = props.hostWorkflow.hostOperationPhase;
  const operation = props.hostWorkflow.hostOperationKey;
  const scaleMetrics = props.hostWorkflow.rendererScaleMetrics;
  const lastClickPoint = props.hostWorkflow.rendererLastClickPoint;
  const lastDispatch = props.hostWorkflow.lastPlaySurfaceDispatch;

  const scaleLabel = scaleMetrics
    ? `${(scaleMetrics.scale * 100).toFixed(1)}%`
    : "(n/a)";

  const roomLabel = scaleMetrics
    ? `${scaleMetrics.roomWidth}x${scaleMetrics.roomHeight}`
    : "(n/a)";

  const viewportLabel = scaleMetrics
    ? `${scaleMetrics.viewportWidth}x${scaleMetrics.viewportHeight}`
    : "(n/a)";

  const rawClickLabel = lastClickPoint
    ? `(${lastClickPoint.viewportX.toFixed(1)}, ${lastClickPoint.viewportY.toFixed(1)})`
    : "(n/a)";

  const roomClickLabel = lastClickPoint
    ? `(${lastClickPoint.roomX.toFixed(1)}, ${lastClickPoint.roomY.toFixed(1)})`
    : "(n/a)";

  const clickInsideLabel = lastClickPoint
    ? (lastClickPoint.insideRoom ? "inside" : "outside")
    : "(n/a)";

  return (
    <section className="storyboard-statusbar" aria-label="Application status bar">
      <div className="storyboard-statusbar-row">
        <span className="storyboard-statusbar-chip">state={props.state}</span>
        <span className="storyboard-statusbar-chip">principal={principal}</span>
        <span className="storyboard-statusbar-chip">session={sessionId}</span>
        <span className="storyboard-statusbar-chip">operation={operation}</span>
        <span className="storyboard-statusbar-chip">phase={phase}</span>
        <span className="storyboard-statusbar-chip">room={roomLabel}</span>
        <span className="storyboard-statusbar-chip">viewport={viewportLabel}</span>
        <span className="storyboard-statusbar-chip">scale={scaleLabel}</span>
        <span className="storyboard-statusbar-chip">click.raw={rawClickLabel}</span>
        <span className="storyboard-statusbar-chip">click.room={roomClickLabel}</span>
        <span className="storyboard-statusbar-chip">click.zone={clickInsideLabel}</span>
        <span className="storyboard-statusbar-chip">click.lastDispatch={lastDispatch}</span>
      </div>
      <p className="storyboard-statusbar-message">{props.hostWorkflow.hostStatus}</p>
    </section>
  );
}
