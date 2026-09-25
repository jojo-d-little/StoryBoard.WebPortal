import { PORTAL_TRACE_SOURCES, type DiagnosticsProfilesConfig } from "../diagnostics/traceProfiles";

export interface WebPortalSettings {
  devToolsDefaults: {
    pollIntervalMs: number;
    heartbeatEveryNPolls: number;
    echoOutputRetentionLines: number;
  };
  diagnosticsProfiles: DiagnosticsProfilesConfig;
  audioDefaults: {
    requireUserGestureToUnlock: boolean;
    lanes: {
      sfx: {
        muted: boolean;
        volumePercent: number;
      };
      ambient: {
        muted: boolean;
        volumePercent: number;
      };
    };
  };
  roomTransitionDefaults: {
    enabled: boolean;
    cueCategory: string;
    cueEffectKey: string;
    cueEffectKeyOverridesByTravelDirection: Partial<Record<RoomTransitionTravelDirection, string>>;
    respectTravelDirection: boolean;
    fallbackDurationMs: number;
  };
  waypointDefaults: {
    pointPlacementCueEffectKey: string;
  };
  uiCommandVerbs: {
    waypointSubmit: string;
    pointClicked: string;
  };
  presentationCueCatalogRelativeLocator: string;
}

type RoomTransitionTravelDirection =
  | "North"
  | "NorthEast"
  | "East"
  | "SouthEast"
  | "South"
  | "SouthWest"
  | "West"
  | "NorthWest"
  | "Up"
  | "Down";

const ROOM_TRANSITION_TRAVEL_DIRECTIONS: RoomTransitionTravelDirection[] = [
  "North",
  "NorthEast",
  "East",
  "SouthEast",
  "South",
  "SouthWest",
  "West",
  "NorthWest",
  "Up",
  "Down"
];

export const DEFAULT_WEB_PORTAL_SETTINGS: WebPortalSettings = {
  devToolsDefaults: {
    pollIntervalMs: 750,
    heartbeatEveryNPolls: 100,
    echoOutputRetentionLines: 400
  },
  diagnosticsProfiles: {
    defaultProfile: "Normal",
    profiles: {
      Focused: {
        label: "Focused",
        description: "Commands, transport, session, polling, and failures.",
        captureSources: ["authentication", "discovery", "session", "transport", "commands", "polling", "failure"],
        displayCategories: ["auth", "command", "discovery", "transport", "session", "session-delta", "host-operation", "state"],
        heartbeatEveryNPolls: 200
      },
      Normal: {
        label: "Normal",
        description: "Normal operational Portal troubleshooting coverage.",
        captureSources: ["authentication", "discovery", "session", "transport", "commands", "polling", "renderer", "presentation", "orchestration", "failure"],
        displayCategories: ["auth", "command", "contracts", "discovery", "host-operation", "transport", "session", "session-delta", "session-echo", "session-render", "presentation-cues", "movement-cues", "timing-sync", "state", "renderer-scene", "renderer-asset", "renderer-frame", "renderer-lifecycle"],
        heartbeatEveryNPolls: 100
      },
      Verbose: {
        label: "Verbose",
        description: "All approved Portal trace sources with a faster heartbeat for active investigation.",
        captureSources: ["authentication", "discovery", "session", "transport", "commands", "polling", "renderer", "presentation", "audio", "assets", "orchestration", "failure"],
        displayCategories: ["auth", "command", "contracts", "discovery", "host-operation", "transport", "session", "session-delta", "session-echo", "session-render", "session-audio", "asset-cache", "presentation-cues", "movement-cues", "timing-sync", "state", "renderer-scene", "renderer-asset", "renderer-frame", "renderer-lifecycle"],
        heartbeatEveryNPolls: 100
      }
    }
  },
  audioDefaults: {
    requireUserGestureToUnlock: true,
    lanes: {
      sfx: {
        muted: false,
        volumePercent: 100
      },
      ambient: {
        muted: false,
        volumePercent: 100
      }
    }
  },
  roomTransitionDefaults: {
    enabled: true,
    cueCategory: "RoomTransition",
    cueEffectKey: "room.transition.slide.directional.medium",
    cueEffectKeyOverridesByTravelDirection: {
      Up: "room.transition.fade.cross.medium",
      Down: "room.transition.fade.cross.medium"
    },
    respectTravelDirection: true,
    fallbackDurationMs: 840
  },
  waypointDefaults: {
    pointPlacementCueEffectKey: "waypoint.point.place.pulse.medium"
  },
  uiCommandVerbs: {
    waypointSubmit: "submitwaypoints",
    pointClicked: "pointclicked"
  },
  presentationCueCatalogRelativeLocator: "assets/PresentationCues/presentation-effects.catalog.json"
};

type WebPortalSettingsDocument = {
  devToolsDefaults?: {
    pollIntervalMs?: number;
    heartbeatEveryNPolls?: number;
    echoOutputRetentionLines?: number;
  };
  diagnosticsProfiles?: Partial<DiagnosticsProfilesConfig>;
  audioDefaults?: {
    requireUserGestureToUnlock?: boolean;
    lanes?: {
      sfx?: {
        muted?: boolean;
        volumePercent?: number;
      };
      ambient?: {
        muted?: boolean;
        volumePercent?: number;
      };
    };
  };
  roomTransitionDefaults?: {
    enabled?: boolean;
    cueCategory?: string;
    cueEffectKey?: string;
    cueEffectKeyOverridesByTravelDirection?: Partial<Record<RoomTransitionTravelDirection, string>>;
    respectTravelDirection?: boolean;
    fallbackDurationMs?: number;
  };
  waypointDefaults?: {
    pointPlacementCueEffectKey?: string;
  };
  uiCommandVerbs?: {
    waypointSubmit?: string;
    pointClicked?: string;
  };
  presentationCueCatalogRelativeLocator?: string;
};

function coerceCueEffectKeyOverridesByTravelDirection(
  value: unknown,
  fallback: Partial<Record<RoomTransitionTravelDirection, string>>
): Partial<Record<RoomTransitionTravelDirection, string>> {
  const result: Partial<Record<RoomTransitionTravelDirection, string>> = {};
  const source = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;

  for (const direction of ROOM_TRANSITION_TRAVEL_DIRECTIONS) {
    const candidate = coerceNonEmptyString(source?.[direction], "");
    if (candidate) {
      result[direction] = candidate;
    }
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  return { ...fallback };
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function coerceNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function coercePositiveInteger(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const rounded = Math.round(numericValue);
  return rounded > 0 ? rounded : fallback;
}

function coercePercentage(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const rounded = Math.round(numericValue);
  return Math.max(0, Math.min(100, rounded));
}

function sanitizeSettings(document: WebPortalSettingsDocument): WebPortalSettings {
  const configuredProfiles = document.diagnosticsProfiles?.profiles;
  const knownTraceSources = new Set(PORTAL_TRACE_SOURCES);
  const diagnosticsProfiles = {
    defaultProfile: document.diagnosticsProfiles?.defaultProfile && document.diagnosticsProfiles.defaultProfile in DEFAULT_WEB_PORTAL_SETTINGS.diagnosticsProfiles.profiles
      ? document.diagnosticsProfiles.defaultProfile
      : DEFAULT_WEB_PORTAL_SETTINGS.diagnosticsProfiles.defaultProfile,
    profiles: { ...DEFAULT_WEB_PORTAL_SETTINGS.diagnosticsProfiles.profiles }
  } as DiagnosticsProfilesConfig;

  for (const profileKey of Object.keys(diagnosticsProfiles.profiles) as Array<keyof DiagnosticsProfilesConfig["profiles"]>) {
    const configured = configuredProfiles?.[profileKey];
    if (!configured) {
      continue;
    }

    diagnosticsProfiles.profiles[profileKey] = {
      ...diagnosticsProfiles.profiles[profileKey],
      ...(typeof configured.label === "string" && configured.label.trim() ? { label: configured.label.trim() } : {}),
      ...(typeof configured.description === "string" && configured.description.trim() ? { description: configured.description.trim() } : {}),
      ...(Array.isArray(configured.captureSources) ? {
        captureSources: configured.captureSources
          .filter((source): source is DiagnosticsProfilesConfig["profiles"][typeof profileKey]["captureSources"][number] => typeof source === "string" && knownTraceSources.has(source as DiagnosticsProfilesConfig["profiles"][typeof profileKey]["captureSources"][number]))
      } : {}),
      ...(Array.isArray(configured.displayCategories) ? { displayCategories: configured.displayCategories.filter((category): category is string => typeof category === "string").map((category) => category.trim().toLowerCase()).filter(Boolean) } : {}),
      ...(typeof configured.heartbeatEveryNPolls === "number" ? { heartbeatEveryNPolls: coercePositiveInteger(configured.heartbeatEveryNPolls, diagnosticsProfiles.profiles[profileKey].heartbeatEveryNPolls) } : {})
    };
  }

  return {
    devToolsDefaults: {
      pollIntervalMs: coercePositiveInteger(
        document.devToolsDefaults?.pollIntervalMs,
        DEFAULT_WEB_PORTAL_SETTINGS.devToolsDefaults.pollIntervalMs
      ),
      heartbeatEveryNPolls: coercePositiveInteger(
        document.devToolsDefaults?.heartbeatEveryNPolls,
        DEFAULT_WEB_PORTAL_SETTINGS.devToolsDefaults.heartbeatEveryNPolls
      ),
      echoOutputRetentionLines: coercePositiveInteger(
        document.devToolsDefaults?.echoOutputRetentionLines,
        DEFAULT_WEB_PORTAL_SETTINGS.devToolsDefaults.echoOutputRetentionLines
      )
    },
    diagnosticsProfiles,
    audioDefaults: {
      requireUserGestureToUnlock: coerceBoolean(
        document.audioDefaults?.requireUserGestureToUnlock,
        DEFAULT_WEB_PORTAL_SETTINGS.audioDefaults.requireUserGestureToUnlock
      ),
      lanes: {
        sfx: {
          muted: coerceBoolean(
            document.audioDefaults?.lanes?.sfx?.muted,
            DEFAULT_WEB_PORTAL_SETTINGS.audioDefaults.lanes.sfx.muted
          ),
          volumePercent: coercePercentage(
            document.audioDefaults?.lanes?.sfx?.volumePercent,
            DEFAULT_WEB_PORTAL_SETTINGS.audioDefaults.lanes.sfx.volumePercent
          )
        },
        ambient: {
          muted: coerceBoolean(
            document.audioDefaults?.lanes?.ambient?.muted,
            DEFAULT_WEB_PORTAL_SETTINGS.audioDefaults.lanes.ambient.muted
          ),
          volumePercent: coercePercentage(
            document.audioDefaults?.lanes?.ambient?.volumePercent,
            DEFAULT_WEB_PORTAL_SETTINGS.audioDefaults.lanes.ambient.volumePercent
          )
        }
      }
    },
    roomTransitionDefaults: {
      enabled: coerceBoolean(
        document.roomTransitionDefaults?.enabled,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.enabled
      ),
      cueCategory: coerceNonEmptyString(
        document.roomTransitionDefaults?.cueCategory,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.cueCategory
      ),
      cueEffectKey: coerceNonEmptyString(
        document.roomTransitionDefaults?.cueEffectKey,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.cueEffectKey
      ),
      cueEffectKeyOverridesByTravelDirection: coerceCueEffectKeyOverridesByTravelDirection(
        document.roomTransitionDefaults?.cueEffectKeyOverridesByTravelDirection,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.cueEffectKeyOverridesByTravelDirection
      ),
      respectTravelDirection: coerceBoolean(
        document.roomTransitionDefaults?.respectTravelDirection,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.respectTravelDirection
      ),
      fallbackDurationMs: coercePositiveInteger(
        document.roomTransitionDefaults?.fallbackDurationMs,
        DEFAULT_WEB_PORTAL_SETTINGS.roomTransitionDefaults.fallbackDurationMs
      )
    },
    waypointDefaults: {
      pointPlacementCueEffectKey: coerceNonEmptyString(
        document.waypointDefaults?.pointPlacementCueEffectKey,
        DEFAULT_WEB_PORTAL_SETTINGS.waypointDefaults.pointPlacementCueEffectKey
      )
    },
    uiCommandVerbs: {
      waypointSubmit: coerceNonEmptyString(
        document.uiCommandVerbs?.waypointSubmit,
        DEFAULT_WEB_PORTAL_SETTINGS.uiCommandVerbs.waypointSubmit
      ),
      pointClicked: coerceNonEmptyString(
        document.uiCommandVerbs?.pointClicked,
        DEFAULT_WEB_PORTAL_SETTINGS.uiCommandVerbs.pointClicked
      )
    },
    presentationCueCatalogRelativeLocator: coerceNonEmptyString(
      document.presentationCueCatalogRelativeLocator,
      DEFAULT_WEB_PORTAL_SETTINGS.presentationCueCatalogRelativeLocator
    )
  };
}

function resolveSettingsUrl(): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return `${baseUrl.replace(/\/?$/, "/")}webportal-settings.v1.json`;
}

export async function loadWebPortalSettings(): Promise<WebPortalSettings> {
  try {
    const response = await fetch(resolveSettingsUrl(), { cache: "no-store" });
    if (!response.ok) {
      return DEFAULT_WEB_PORTAL_SETTINGS;
    }

    const raw = (await response.json()) as WebPortalSettingsDocument;
    return sanitizeSettings(raw);
  } catch {
    return DEFAULT_WEB_PORTAL_SETTINGS;
  }
}
