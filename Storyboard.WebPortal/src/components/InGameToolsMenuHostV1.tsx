import type { JSX } from "react";
import type { FeatureRenderDensity, FeatureRenderOrientation } from "../orchestration/types";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import { InGameToolsMenuV1 } from "./InGameToolsMenuV1";

interface InGameToolsMenuHostV1Props {
  orientation: FeatureRenderOrientation;
  density: FeatureRenderDensity;
  hostWorkflow: HostWorkflowState;
}

export function InGameToolsMenuHostV1(props: InGameToolsMenuHostV1Props): JSX.Element {
  void props.orientation;
  void props.density;
  const waypointSubmitInFlight = props.hostWorkflow.hostOperationKey === "command"
    && props.hostWorkflow.hostOperationPhase === "Running";

  function confirmWaypointMoveSetup(): void {
    void props.hostWorkflow.submitWaypointDraft();
  }

  return (
    <section className="config-feature-placeholder in-game-tools-menu-host">
      <InGameToolsMenuV1
        substate={props.hostWorkflow.gameplayInteractionSubstate}
        waypointCount={props.hostWorkflow.waypointDraftCount}
        waypointSubmitInFlight={waypointSubmitInFlight}
        onEnterWaypointMoveSetup={props.hostWorkflow.enterWaypointMoveSetup}
        onCancelWaypointMoveSetup={props.hostWorkflow.cancelWaypointMoveSetup}
        onConfirmWaypointMove={confirmWaypointMoveSetup}
        onUndoLastWaypoint={props.hostWorkflow.undoLastWaypointDraftPoint}
        onClearWaypoints={props.hostWorkflow.clearWaypointDraft}
      />
    </section>
  );
}
