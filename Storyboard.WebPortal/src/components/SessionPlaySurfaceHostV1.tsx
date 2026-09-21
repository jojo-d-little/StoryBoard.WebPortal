import { useCallback } from "react";
import type { GameRendererRoomPoint } from "../gameRenderer";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import { SessionPlaySurfaceRendererV1 } from "./SessionPlaySurfaceRendererV1";

interface SessionPlaySurfaceHostV1Props {
  hostWorkflow: HostWorkflowState;
}

export function SessionPlaySurfaceHostV1(props: SessionPlaySurfaceHostV1Props): JSX.Element {
  const hasManualDismissHudOverlay = props.hostWorkflow.hudOverlayEntries.some((entry) => entry.isManualDismiss);

  const handleWaypointPointSelected = useCallback((point: GameRendererRoomPoint): void => {
    props.hostWorkflow.appendWaypointDraftPoint(point);
  }, [props.hostWorkflow]);

  const handleCommandPointSelected = useCallback((point: GameRendererRoomPoint, insideRoom: boolean): void => {
    const pointClickedCommand = props.hostWorkflow.buildPointClickedCommand(point.x, point.y);
    props.hostWorkflow.reportPlaySurfaceCommandDispatch(pointClickedCommand, {
      roomX: point.x,
      roomY: point.y,
      insideRoom
    });
    void props.hostWorkflow.submitCommand(pointClickedCommand, { suppressClientEcho: true });
  }, [props.hostWorkflow]);

  return (
    <SessionPlaySurfaceRendererV1
      activeSessionId={props.hostWorkflow.activeSessionId}
      sceneSnapshot={props.hostWorkflow.rendererSceneSnapshot}
      roomTransitionPreparationEpoch={props.hostWorkflow.roomTransitionPreparationEpoch}
      gameplayInteractionSubstate={props.hostWorkflow.gameplayInteractionSubstate}
      waypointDraftCount={props.hostWorkflow.waypointDraftCount}
      waypointPointPlacementCueStyle={props.hostWorkflow.waypointPointPlacementCueStyle}
      hasManualDismissHudOverlay={hasManualDismissHudOverlay}
      onDismissHudOverlay={props.hostWorkflow.dismissHudOverlay}
      onRegisterWaypointInteractionRendererBridge={props.hostWorkflow.registerWaypointInteractionRendererBridge}
      onReportRendererDiagnostic={props.hostWorkflow.reportRendererDiagnostic}
      onReportRoomTransitionState={props.hostWorkflow.reportRendererRoomTransitionState}
      onReportRendererScaleMetrics={props.hostWorkflow.reportRendererScaleMetrics}
      onReportRendererLastClickPoint={props.hostWorkflow.reportRendererLastClickPoint}
      onWaypointPointSelected={handleWaypointPointSelected}
      onCommandPointSelected={handleCommandPointSelected}
    />
  );
}
