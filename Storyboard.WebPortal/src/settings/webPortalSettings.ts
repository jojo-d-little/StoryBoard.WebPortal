export interface WebPortalSettings {
  devToolsDefaults: {
    pollIntervalMs: number;
    heartbeatEveryNPolls: number;
    echoOutputRetentionLines: number;
  };
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
