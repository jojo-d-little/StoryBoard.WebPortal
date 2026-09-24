import { useEffect, useMemo, useRef, useState } from "react";
import type { PortalTraceEvent, PortalTraceSeverity } from "../diagnostics/portalTrace";

export type DiagnosticsLevel = PortalTraceSeverity;
export type DiagnosticsEntry = PortalTraceEvent;

interface DiagnosticsConsoleProps {
  enabled: boolean;
  entries: DiagnosticsEntry[];
  categoryFilters?: Record<string, boolean>;
  onClear: () => void;
}

type ExportStatus =
  | { level: "info" | "warn"; message: string }
  | null;

function formatEntry(entry: DiagnosticsEntry): string[] {
  const sourceAndCategory = `${entry.source}/${entry.category}`;
  const eventLabel = entry.phase ? `${entry.event}/${entry.phase}` : entry.event;
  const durationLabel = entry.durationMs === undefined ? "" : ` (${entry.durationMs}ms)`;
  const header = `[${entry.timestampUtc}] #${entry.sequence} [${entry.severity.toUpperCase()}] ${sourceAndCategory} ${eventLabel}${durationLabel}: ${entry.message}`;
  if (!entry.details && !entry.correlation) {
    return [header];
  }

  const detailLines = JSON.stringify({
    ...(entry.correlation ? { correlation: entry.correlation } : {}),
    ...(entry.details ? { details: entry.details } : {})
  }, null, 2)
    .split(/\r?\n/)
    .map((line) => `  ${line}`);
  return [header, ...detailLines];
}

export function DiagnosticsConsole(props: DiagnosticsConsoleProps): JSX.Element {
  const terminalRef = useRef<HTMLPreElement | null>(null);
  const [showInfo, setShowInfo] = useState<boolean>(true);
  const [showWarn, setShowWarn] = useState<boolean>(true);
  const [showError, setShowError] = useState<boolean>(true);
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);

  const filteredEntries = useMemo(() => {
    return props.entries.filter((entry) => {
      if (props.categoryFilters && props.categoryFilters[entry.category] === false) {
        return false;
      }

      if (entry.severity === "info") {
        return showInfo;
      }

      if (entry.severity === "warn") {
        return showWarn;
      }

      return showError;
    });
  }, [props.categoryFilters, props.entries, showInfo, showWarn, showError]);

  const terminalText = useMemo(() => {
    if (filteredEntries.length === 0) {
      return "";
    }

    const chronologicalEntries = [...filteredEntries].reverse();
    return chronologicalEntries.flatMap((entry) => formatEntry(entry)).join("\n");
  }, [filteredEntries]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalText]);

  const canExport = terminalText.trim().length > 0;

  function buildExportText(): string {
    return `${terminalText}\n`;
  }

  async function copyToClipboard(): Promise<void> {
    if (!canExport) {
      setExportStatus({ level: "warn", message: "No diagnostics to copy." });
      return;
    }

    const payload = buildExportText();

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

      setExportStatus({ level: "info", message: `Copied ${filteredEntries.length} diagnostics entries.` });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      setExportStatus({ level: "warn", message: `Copy failed: ${errorText}` });
    }
  }

  function formatTimestampForFileName(date: Date): string {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }

  function saveToFile(): void {
    if (!canExport) {
      setExportStatus({ level: "warn", message: "No diagnostics to save." });
      return;
    }

    const payload = buildExportText();
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fileName = `diagnostics-${formatTimestampForFileName(new Date())}.log`;

    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportStatus({ level: "info", message: `Saved ${filteredEntries.length} diagnostics entries to ${fileName}.` });
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  return (
    <section className="results diagnostics-console">
      <div className="events">
        <h2>Diagnostics Console</h2>
        <label>
          <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} />
          INFO
        </label>
        <label>
          <input type="checkbox" checked={showWarn} onChange={(e) => setShowWarn(e.target.checked)} />
          WARN
        </label>
        <label>
          <input type="checkbox" checked={showError} onChange={(e) => setShowError(e.target.checked)} />
          ERROR
        </label>
        <button type="button" onClick={() => void copyToClipboard()} disabled={!canExport}>Copy</button>
        <button type="button" onClick={saveToFile} disabled={!canExport}>Save</button>
        <button type="button" onClick={props.onClear}>Clear</button>
      </div>

      {exportStatus ? (
        <p className={`subtitle diagnostics-export-status ${exportStatus.level === "warn" ? "is-warning" : "is-info"}`}>
          {exportStatus.message}
        </p>
      ) : null}

      {!props.enabled ? <p className="subtitle">Trace capture is stopped. Existing entries remain available.</p> : null}

      {props.entries.length === 0 ? (
        <p className="subtitle">No diagnostics captured yet.</p>
      ) : filteredEntries.length === 0 ? (
        <p className="subtitle">No diagnostics match the active level filters.</p>
      ) : (
        <pre className="diagnostics-terminal" ref={terminalRef}>{terminalText}</pre>
      )}
    </section>
  );
}
