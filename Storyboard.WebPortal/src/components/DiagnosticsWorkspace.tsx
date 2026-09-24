import type { JSX } from "react";
import type { PortalTraceSource } from "../diagnostics/portalTrace";

export type DiagnosticsProfile = "Off" | "Focused" | "Normal" | "Verbose" | "Custom";

export interface DiagnosticsWorkspaceScopeOption {
  source: PortalTraceSource;
  label: string;
  enabled: boolean;
}

export interface DiagnosticsWorkspaceCategoryOption {
  category: string;
  label: string;
  enabled: boolean;
}

export interface DiagnosticsWorkspaceProps {
  capturing: boolean;
  profile: DiagnosticsProfile;
  scopeOptions: DiagnosticsWorkspaceScopeOption[];
  categoryOptions: DiagnosticsWorkspaceCategoryOption[];
  entryCount: number;
  droppedCount: number;
  captureStartedUtc?: string;
  captureStoppedUtc?: string;
  consoleVisible: boolean;
  onStartTrace: () => void;
  onStopTrace: () => void;
  onShowConsole: () => void;
  onHideConsole: () => void;
  onClear: () => void;
  onProfileChange: (profile: DiagnosticsProfile) => void;
  onScopeEnabledChange: (source: PortalTraceSource, enabled: boolean) => void;
  onCategoryEnabledChange: (category: string, enabled: boolean) => void;
}

function formatBoundary(value?: string): string {
  return value || "(none)";
}

export function DiagnosticsWorkspace(props: DiagnosticsWorkspaceProps): JSX.Element {
  const captureState = props.capturing
    ? props.droppedCount > 0 ? "Truncated" : "Capturing"
    : props.captureStoppedUtc ? "Stopped" : "Off";

  return (
    <section className="diagnostics-workspace" aria-label="Diagnostics workspace">
      <h3>Diagnostics</h3>
      <p className="subtitle">Capture and inspect Portal client trace without changing backend diagnostics behavior.</p>

      <div className="diagnostics-workspace-status" data-testid="diagnostics-capture-status">
        <strong>{captureState}</strong>
        <span>entries={props.entryCount}</span>
        <span>profile={props.profile}</span>
        <span>{props.droppedCount > 0 ? `dropped=${props.droppedCount}` : "dropped=0"}</span>
      </div>

      <div className="events diagnostics-workspace-actions">
        <button type="button" onClick={props.onStartTrace} disabled={props.capturing}>Start Trace</button>
        <button type="button" onClick={props.onStopTrace} disabled={!props.capturing}>Stop Trace</button>
        <button type="button" onClick={props.onShowConsole} disabled={props.consoleVisible}>Show Console</button>
        <button type="button" onClick={props.onHideConsole} disabled={!props.consoleVisible}>Hide Console</button>
        <button type="button" onClick={props.onClear} disabled={props.entryCount === 0}>Clear</button>
      </div>

      <div className="meta diagnostics-workspace-meta">
        <span>capture.start={formatBoundary(props.captureStartedUtc)}</span>
        <span>capture.stop={formatBoundary(props.captureStoppedUtc)}</span>
        <span>console={props.consoleVisible ? "visible" : "hidden"}</span>
      </div>

      <label>
        Trace Profile
        <select
          aria-label="Trace Profile"
          value={props.profile}
          onChange={(event) => props.onProfileChange(event.target.value as DiagnosticsProfile)}
        >
          <option value="Off">Off</option>
          <option value="Focused">Focused</option>
          <option value="Normal">Normal</option>
          <option value="Verbose">Verbose</option>
          <option value="Custom">Custom</option>
        </select>
      </label>

      <details>
        <summary>Advanced capture scope</summary>
        <div className="diagnostics-category-table" aria-label="Diagnostics capture scope">
          {props.scopeOptions.map((option) => (
            <label className="diagnostics-category-table-row" key={`diagnostics-scope:${option.source}`}>
              <span className="diagnostics-category-key" title={option.label}>{option.label}</span>
              <input
                type="checkbox"
                checked={option.enabled}
                onChange={(event) => props.onScopeEnabledChange(option.source, event.target.checked)}
                aria-label={`Capture ${option.label}`}
              />
            </label>
          ))}
        </div>
      </details>

      <details>
        <summary>Category display filters</summary>
        <div className="diagnostics-category-table" aria-label="Diagnostics category display filters">
          {props.categoryOptions.map((option) => (
            <label className="diagnostics-category-table-row" key={`diagnostics-filter:${option.category}`}>
              <span className="diagnostics-category-key" title={option.label}>{option.category}</span>
              <input
                type="checkbox"
                checked={option.enabled}
                onChange={(event) => props.onCategoryEnabledChange(option.category, event.target.checked)}
                aria-label={`Display ${option.category}`}
              />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
