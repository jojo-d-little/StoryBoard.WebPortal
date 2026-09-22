export type PortalLaunchMode = "normal" | "devsimulator";
export type PortalPresentationVariant = "standard" | "development";

export interface PortalLaunchContext {
  mode: PortalLaunchMode;
  presentationVariant: PortalPresentationVariant;
  username: string;
}

export function readPortalLaunchContext(search: string = window.location.search): PortalLaunchContext {
  const params = new URLSearchParams(search);
  const mode = (params.get("mode") || "").trim().toLowerCase() === "devsimulator"
    ? "devsimulator"
    : "normal";

  return {
    mode,
    presentationVariant: mode === "devsimulator" ? "development" : "standard",
    username: (params.get("username") || "").trim()
  };
}
