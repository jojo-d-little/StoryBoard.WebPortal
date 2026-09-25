import type { PortalTraceSource } from "./portalTrace";

export const PORTAL_TRACE_SOURCES: readonly PortalTraceSource[] = [
  "authentication",
  "discovery",
  "session",
  "transport",
  "commands",
  "polling",
  "renderer",
  "presentation",
  "audio",
  "assets",
  "orchestration",
  "failure"
];

export const DIAGNOSTICS_PROFILE_KEYS = ["Focused", "Normal", "Verbose"] as const;
export type DiagnosticsProfileKey = typeof DIAGNOSTICS_PROFILE_KEYS[number];

export interface DiagnosticsTraceProfile {
  label: string;
  description: string;
  captureSources: PortalTraceSource[];
  displayCategories: string[];
  heartbeatEveryNPolls: number;
}

export interface DiagnosticsProfilesConfig {
  defaultProfile: DiagnosticsProfileKey;
  profiles: Record<DiagnosticsProfileKey, DiagnosticsTraceProfile>;
}
