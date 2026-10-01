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

export type DiagnosticsProfileKey = string;

export interface DiagnosticsTraceProfile {
  label: string;
  description: string;
  captureSources: PortalTraceSource[];
  displayCategories: string[];
  heartbeatEveryNPolls: number;
  logAllWarnings: boolean;
  logAllErrors: boolean;
}

export interface DiagnosticsProfilesConfig {
  defaultProfile: string;
  profiles: Record<string, DiagnosticsTraceProfile>;
}
