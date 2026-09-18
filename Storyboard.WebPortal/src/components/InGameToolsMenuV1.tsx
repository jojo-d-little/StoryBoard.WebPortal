import type { JSX } from "react";
import waypointEnterIcon from "../assets/icons/in-game-tools/waypoint-enter.svg";
import waypointConfirmIcon from "../assets/icons/in-game-tools/waypoint-confirm.svg";
import waypointUndoIcon from "../assets/icons/in-game-tools/waypoint-undo.svg";
import waypointClearIcon from "../assets/icons/in-game-tools/waypoint-clear.svg";
import waypointCancelIcon from "../assets/icons/in-game-tools/waypoint-cancel.svg";

export type GameplayInteractionSubstate = "DefaultClick" | "WaypointMoveSetup";

interface InGameToolsMenuV1Props {
  substate: GameplayInteractionSubstate;
  waypointCount: number;
  waypointSubmitInFlight?: boolean;
  onEnterWaypointMoveSetup: () => void;
  onCancelWaypointMoveSetup: () => void;
  onConfirmWaypointMove: () => void;
  onUndoLastWaypoint: () => void;
  onClearWaypoints: () => void;
}

export function InGameToolsMenuV1(props: InGameToolsMenuV1Props): JSX.Element {
  const isWaypointMode = props.substate === "WaypointMoveSetup";
  const hasWaypoints = props.waypointCount > 0;
  const waypointSubmitInFlight = props.waypointSubmitInFlight === true;

  return (
    <section className="in-game-tools-menu" aria-label="In-game tools">
      <div className="in-game-tools-menu__toolbar" role="toolbar" aria-label="In-game tools actions">
        {!isWaypointMode ? (
          <button
            type="button"
            className="in-game-tools-menu__icon-button"
            aria-label="Waypoint Move"
            title="Enter waypoint move setup"
            onClick={props.onEnterWaypointMoveSetup}
          >
            <img src={waypointEnterIcon} alt="" aria-hidden="true" draggable={false} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="in-game-tools-menu__icon-button"
              aria-label="Confirm"
              onClick={props.onConfirmWaypointMove}
              disabled={!hasWaypoints || waypointSubmitInFlight}
              title={
                !hasWaypoints
                  ? "Add at least one waypoint before confirm."
                  : waypointSubmitInFlight
                    ? "Waypoint submit in progress."
                    : "Confirm waypoint move."
              }
            >
              <img src={waypointConfirmIcon} alt="" aria-hidden="true" draggable={false} />
            </button>
            <button
              type="button"
              className="in-game-tools-menu__icon-button"
              aria-label="Undo Last"
              onClick={props.onUndoLastWaypoint}
              disabled={!hasWaypoints}
              title={!hasWaypoints ? "No waypoint to undo." : "Undo last waypoint."}
            >
              <img src={waypointUndoIcon} alt="" aria-hidden="true" draggable={false} />
            </button>
            <button
              type="button"
              className="in-game-tools-menu__icon-button"
              aria-label="Clear Draft"
              onClick={props.onClearWaypoints}
              disabled={!hasWaypoints}
              title={!hasWaypoints ? "No waypoints to clear." : "Clear all drafted waypoints."}
            >
              <img src={waypointClearIcon} alt="" aria-hidden="true" draggable={false} />
            </button>
            <button
              type="button"
              className="in-game-tools-menu__icon-button"
              aria-label="Cancel"
              title="Cancel waypoint move setup"
              onClick={props.onCancelWaypointMoveSetup}
            >
              <img src={waypointCancelIcon} alt="" aria-hidden="true" draggable={false} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
