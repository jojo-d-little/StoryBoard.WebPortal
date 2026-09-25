import type { PortalTraceSource } from "./portalTrace";
import type { DiagnosticsProfile, DiagnosticsWorkspaceScopeOption } from "../components/DiagnosticsWorkspace";
import type { DiagnosticsProfilesConfig } from "./traceProfiles";

export const PORTAL_TRACE_SCOPE_OPTIONS: Array<{ source: PortalTraceSource; label: string }> = [
  { source: "authentication", label: "Authentication" },
  { source: "discovery", label: "Discovery" },
  { source: "session", label: "Session lifecycle" },
  { source: "transport", label: "Transport and requests" },
  { source: "commands", label: "Commands and clarification" },
  { source: "polling", label: "Polling and deltas" },
  { source: "renderer", label: "Renderer" },
  { source: "presentation", label: "Presentation and effects" },
  { source: "audio", label: "Audio" },
  { source: "assets", label: "Assets and cache" },
  { source: "orchestration", label: "Client and orchestration" },
  { source: "failure", label: "Failures" }
];

const ALL_SOURCES = PORTAL_TRACE_SCOPE_OPTIONS.map((option) => option.source);

export function getDiagnosticsProfileScope(
  profile: Exclude<DiagnosticsProfile, "Custom">,
  profiles: DiagnosticsProfilesConfig
): Record<PortalTraceSource, boolean> {
  const enabledSources = profile === "Off"
    ? []
    : profiles.profiles[profile]?.captureSources ?? ALL_SOURCES;

  return Object.fromEntries(
    ALL_SOURCES.map((source) => [source, enabledSources.includes(source)])
  ) as Record<PortalTraceSource, boolean>;
}

export function buildDiagnosticsScopeOptions(
  scope: Record<PortalTraceSource, boolean>
): DiagnosticsWorkspaceScopeOption[] {
  return PORTAL_TRACE_SCOPE_OPTIONS.map((option) => ({
    ...option,
    enabled: scope[option.source] ?? false
  }));
}
