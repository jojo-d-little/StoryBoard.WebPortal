/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortalTraceEvent } from "../diagnostics/portalTrace";
import { DiagnosticsWorkspace, type DiagnosticsWorkspaceProps } from "./DiagnosticsWorkspace";

afterEach(() => {
  cleanup();
});

const testEntries: PortalTraceEvent[] = Array.from({ length: 4 }, (_, index) => ({
  sequence: index + 1,
  timestampUtc: "2026-09-23T17:00:00.000Z",
  source: "commands",
  category: "command",
  severity: "info",
  event: "test-event",
  message: `test-${index + 1}`
}));

function buildProps(overrides: Partial<DiagnosticsWorkspaceProps> = {}): DiagnosticsWorkspaceProps {
  return {
    capturing: true,
    profile: "Normal",
    scopeOptions: [
      { source: "commands", label: "Commands and clarification", enabled: true },
      { source: "renderer", label: "Renderer", enabled: true }
    ],
    categoryOptions: [
      { category: "command", label: "Command", enabled: true }
    ],
    entryCount: 4,
    entries: testEntries,
    exportMetadata: {
      format: "portal-trace",
      formatVersion: "1.0",
      exportView: "complete-buffer",
      buildIdentity: "storyboard-webportal@0.1.3",
      profile: "Normal",
      scope: ["commands", "renderer"],
      bufferEntryCount: 4,
      exportedEntryCount: 4,
      droppedCount: 1,
      completeness: "truncated",
      sessionIds: [],
      gameIds: []
    },
    droppedCount: 1,
    captureStartedUtc: "2026-09-23T17:00:00.000Z",
    captureStoppedUtc: undefined,
    consoleVisible: false,
    onStartTrace: vi.fn(),
    onStopTrace: vi.fn(),
    onShowConsole: vi.fn(),
    onHideConsole: vi.fn(),
    onClear: vi.fn(),
    onProfileChange: vi.fn(),
    onScopeEnabledChange: vi.fn(),
    onCategoryEnabledChange: vi.fn(),
    ...overrides
  };
}

describe("DiagnosticsWorkspace", () => {
  it("shows capture status, boundary, profile, count, and truncation", () => {
    render(<DiagnosticsWorkspace {...buildProps()} />);

    expect(screen.getByTestId("diagnostics-capture-status")).toHaveTextContent("Truncated");
    expect(screen.getByText("entries=4")).toBeInTheDocument();
    expect(screen.getByText("profile=Normal")).toBeInTheDocument();
    expect(screen.getByText("dropped=1")).toBeInTheDocument();
    expect(screen.getByText("capture.start=2026-09-23T17:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Trace" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop Trace" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show Console" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Hide Console" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Complete trace export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Full Trace" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save Full Text" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save Full NDJSON" })).toBeEnabled();
  });

  it("routes direct trace, visibility, clear, profile, scope, and filter actions", () => {
    const props = buildProps({ capturing: false, consoleVisible: true });
    const view = render(<DiagnosticsWorkspace {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Trace" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Console" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    view.rerender(<DiagnosticsWorkspace {...props} capturing={true} consoleVisible={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop Trace" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Trace Profile" }), { target: { value: "Focused" } });
    fireEvent.click(screen.getByText("Advanced capture scope"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Capture Renderer" }));
    fireEvent.click(screen.getByText("Category display filters"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Display command" }));

    expect(props.onStartTrace).toHaveBeenCalledTimes(1);
    expect(props.onStopTrace).toHaveBeenCalledTimes(1);
    expect(props.onHideConsole).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(props.onProfileChange).toHaveBeenCalledWith("Focused");
    expect(props.onScopeEnabledChange).toHaveBeenCalledWith("renderer", false);
    expect(props.onCategoryEnabledChange).toHaveBeenCalledWith("command", false);
  });

  it("keeps stop and visibility controls independent", () => {
    const onStopTrace = vi.fn();
    const onShowConsole = vi.fn();
    const props = buildProps({ capturing: true, consoleVisible: false, onStopTrace, onShowConsole });
    render(<DiagnosticsWorkspace {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Stop Trace" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Console" }));

    expect(onStopTrace).toHaveBeenCalledTimes(1);
    expect(onShowConsole).toHaveBeenCalledTimes(1);
  });
});
