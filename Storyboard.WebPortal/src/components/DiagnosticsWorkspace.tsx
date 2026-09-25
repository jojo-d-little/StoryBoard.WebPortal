import { useState } from "react";
import type { JSX } from "react";
import type { PortalTraceEvent, PortalTraceSource } from "../diagnostics/portalTrace";
import {
  formatPortalTraceExport,
  type PortalTraceExportFormat,
  type PortalTraceExportMetadata
} from "../diagnostics/portalTraceExport";
import type { DiagnosticsProfileKey } from "../diagnostics/traceProfiles";

export type DiagnosticsProfile = "Off" | DiagnosticsProfileKey | "Custom";

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
  entries: PortalTraceEvent[];
  exportMetadata: PortalTraceExportMetadata;
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

type ExportStatus =
  | { level: "info" | "warn"; message: string }
  | null;

function formatTimestampForFileName(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function DiagnosticsWorkspace(props: DiagnosticsWorkspaceProps): JSX.Element {
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);
  const captureState = props.capturing
    ? props.droppedCount > 0 ? "Truncated" : "Capturing"
    : props.captureStoppedUtc ? "Stopped" : "Off";

  async function copyFullExport(format: PortalTraceExportFormat): Promise<void> {
    if (props.entries.length === 0) {
      setExportStatus({ level: "warn", message: "No diagnostics to export." });
      return;
    }

    const payload = formatPortalTraceExport(props.entries, props.exportMetadata, format);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = payload;
        fallback.setAttribute("readonly", "readonly");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.focus();
        fallback.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(fallback);
        if (!copied) {
          throw new Error("Copy command was not accepted by the browser.");
        }
      }

      setExportStatus({
        level: "info",
        message: `Copied complete ${format === "ndjson" ? "NDJSON" : "text"} export (${props.entries.length} entries).`
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      setExportStatus({ level: "warn", message: `Copy failed: ${errorText}` });
    }
  }

  function saveFullExport(format: PortalTraceExportFormat): void {
    if (props.entries.length === 0) {
      setExportStatus({ level: "warn", message: "No diagnostics to export." });
      return;
    }

    const payload = formatPortalTraceExport(props.entries, props.exportMetadata, format);
    const extension = format === "ndjson" ? "ndjson" : "log";
    const mimeType = format === "ndjson" ? "application/x-ndjson" : "text/plain";
    const fileName = `portal-trace-${formatTimestampForFileName(new Date())}.${extension}`;
    const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportStatus({ level: "info", message: `Saved complete ${format === "ndjson" ? "NDJSON" : "text"} export to ${fileName}.` });
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

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

      <div className="events diagnostics-workspace-actions" role="group" aria-label="Complete trace export">
        <button type="button" onClick={() => void copyFullExport("text")} disabled={props.entryCount === 0}>Copy Full Trace</button>
        <button type="button" onClick={() => saveFullExport("text")} disabled={props.entryCount === 0}>Save Full Text</button>
        <button type="button" onClick={() => saveFullExport("ndjson")} disabled={props.entryCount === 0}>Save Full NDJSON</button>
      </div>

      {exportStatus ? (
        <p className={`subtitle diagnostics-export-status ${exportStatus.level === "warn" ? "is-warning" : "is-info"}`}>
          {exportStatus.message}
        </p>
      ) : null}

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
