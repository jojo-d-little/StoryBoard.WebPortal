export type PortalLaunchMode = "normal" | "devsimulator";

export interface PortalLaunchContext {
  mode: PortalLaunchMode;
  username: string;
  autoStartSession: boolean;
}

function readTrueFlag(params: URLSearchParams, name: string): boolean {
  const value = (params.get(name) || "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function readPortalLaunchContext(search: string = window.location.search): PortalLaunchContext {
  const params = new URLSearchParams(search);
  const mode = (params.get("mode") || "").trim().toLowerCase() === "devsimulator"
    ? "devsimulator"
    : "normal";

  return {
    mode,
    username: (params.get("username") || "").trim(),
    autoStartSession: readTrueFlag(params, "autoStartSession")
  };
}
