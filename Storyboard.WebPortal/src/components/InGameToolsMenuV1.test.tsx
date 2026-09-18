/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InGameToolsMenuV1 } from "./InGameToolsMenuV1";

afterEach(() => {
  cleanup();
});

describe("InGameToolsMenuV1", () => {
  it("renders compact default mode with waypoint entry button only", () => {
    render(
      <InGameToolsMenuV1
        substate="DefaultClick"
        waypointCount={0}
        waypointSubmitInFlight={false}
        onEnterWaypointMoveSetup={vi.fn()}
        onCancelWaypointMoveSetup={vi.fn()}
        onConfirmWaypointMove={vi.fn()}
        onUndoLastWaypoint={vi.fn()}
        onClearWaypoints={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Waypoint Move" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo Last" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("renders waypoint controls only in WaypointMoveSetup mode", () => {
    render(
      <InGameToolsMenuV1
        substate="WaypointMoveSetup"
        waypointCount={0}
        waypointSubmitInFlight={false}
        onEnterWaypointMoveSetup={vi.fn()}
        onCancelWaypointMoveSetup={vi.fn()}
        onConfirmWaypointMove={vi.fn()}
        onUndoLastWaypoint={vi.fn()}
        onClearWaypoints={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Waypoint Move" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo Last" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("enables waypoint actions when there are drafted waypoints", () => {
    const onUndoLastWaypoint = vi.fn();
    const onClearWaypoints = vi.fn();
    const onConfirmWaypointMove = vi.fn();

    render(
      <InGameToolsMenuV1
        substate="WaypointMoveSetup"
        waypointCount={2}
        waypointSubmitInFlight={false}
        onEnterWaypointMoveSetup={vi.fn()}
        onCancelWaypointMoveSetup={vi.fn()}
        onConfirmWaypointMove={onConfirmWaypointMove}
        onUndoLastWaypoint={onUndoLastWaypoint}
        onClearWaypoints={onClearWaypoints}
      />
    );

    const undoButton = screen.getByRole("button", { name: "Undo Last" });
    const clearButton = screen.getByRole("button", { name: "Clear Draft" });
    const confirmButton = screen.getByRole("button", { name: "Confirm" });

    expect(undoButton).toBeEnabled();
    expect(clearButton).toBeEnabled();
    expect(confirmButton).toBeEnabled();

    fireEvent.click(undoButton);
    fireEvent.click(clearButton);
    fireEvent.click(confirmButton);

    expect(onUndoLastWaypoint).toHaveBeenCalledTimes(1);
    expect(onClearWaypoints).toHaveBeenCalledTimes(1);
    expect(onConfirmWaypointMove).toHaveBeenCalledTimes(1);
  });

  it("disables confirm while waypoint submit is in flight", () => {
    const onConfirmWaypointMove = vi.fn();

    render(
      <InGameToolsMenuV1
        substate="WaypointMoveSetup"
        waypointCount={2}
        waypointSubmitInFlight={true}
        onEnterWaypointMoveSetup={vi.fn()}
        onCancelWaypointMoveSetup={vi.fn()}
        onConfirmWaypointMove={onConfirmWaypointMove}
        onUndoLastWaypoint={vi.fn()}
        onClearWaypoints={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirmWaypointMove).toHaveBeenCalledTimes(0);
  });
});
