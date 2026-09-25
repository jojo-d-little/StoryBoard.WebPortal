import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import packageJson from "../package.json";
import { loadOrchestrationContracts } from "./orchestration/loader";
import { resolveShellPlan, tryTransition } from "./orchestration/resolver";
import type { OrchestrationContracts, ResolvedSlot, SlotMode, ThemeContract } from "./orchestration/types";
import { ConfigDrivenLayoutPreview } from "./components/ConfigDrivenLayoutPreview";
import { DevToolsPanel } from "./components/DevToolsPanel";
import { DiagnosticsConsole, type DiagnosticsEntry, type DiagnosticsLevel } from "./components/DiagnosticsConsole";
import type { DiagnosticsWorkspaceProps, DiagnosticsProfile } from "./components/DiagnosticsWorkspace";
import { appendPortalTraceEvent, normalizePortalTraceEvent } from "./diagnostics/portalTrace";
import { buildDiagnosticsScopeOptions, getDiagnosticsProfileScope } from "./diagnostics/diagnosticsScope";
import type { PortalTraceSource } from "./diagnostics/portalTrace";
import type { DiagnosticsProfileKey } from "./diagnostics/traceProfiles";
import { buildPortalTraceExportMetadata, type PortalTraceExportMetadata } from "./diagnostics/portalTraceExport";
import { ConfigSlotFeatureRenderer } from "./components/ConfigSlotFeatureRenderer";
import { useHostWorkflow } from "./hooks/useHostWorkflow";
import { usePortalStartupAudioGate } from "./hooks/usePortalStartupAudioGate";
import { PortalStartupSplash } from "./components/PortalStartupSplash";
import { readPortalLaunchContext } from "./launch/portalLaunchContext";
import { resolveTechnicalFeatureComponent } from "./orchestration/technicalFeatureImplementations";
import { DEFAULT_WEB_PORTAL_SETTINGS, type WebPortalSettings } from "./settings/webPortalSettings";
import {
  resolveEffectiveOverrides,
  type QueryOverrides
} from "./overrides/overrideResolution";

const DEV_TOOLS_STORAGE_KEYS = {
  diagnosticsEnabled: "shellLab.devTools.diagnosticsEnabled",
  diagnosticsVerbose: "shellLab.devTools.diagnosticsVerbose",
  diagnosticsCategoryFilters: "shellLab.devTools.diagnosticsCategoryFilters",
  pollingSettingsOverrideEnabled: "shellLab.devTools.pollingSettingsOverrideEnabled",
  hostApiBaseUrlOverride: "shellLab.devTools.hostApiBaseUrlOverride",
  maxDiagnosticsEntries: "shellLab.devTools.maxDiagnosticsEntries",
  diagnosticsProfile: "shellLab.devTools.diagnosticsProfile",
  diagnosticsScope: "shellLab.devTools.diagnosticsScope",
  pollIntervalMs: "shellLab.devTools.pollIntervalMs",
  heartbeatEveryNPolls: "shellLab.devTools.heartbeatEveryNPolls"
} as const;
type QuerySlotMode = Extract<SlotMode, "hidden" | "visible">;
const LIVE_LAYOUT_CONTROLS_CHANNEL = "shellLab.liveLayoutControls";
const LIVE_THEME_COLORS_CHANNEL = "shellLab.liveThemeColors";
const LIVE_DIAGNOSTICS_CHANNEL = "shellLab.liveDiagnostics";

type SlotModeOverrides = Record<string, SlotMode>;
type SlotTechnicalDetailsOverrides = Record<string, boolean>;
type PreviewContext = {
  experienceState: string;
  formFactorKey: string;
  compositionProfileKey: string;
  skeletonLayoutKey: string;
};
type ThemeColorTokens = ThemeContract["tokens"]["color"];
type ThemeColorTokenKey = keyof ThemeColorTokens;
type ThemeTypographyTokens = ThemeContract["tokens"]["typography"];
type ThemeTypographyTokenKey = keyof ThemeTypographyTokens;

const THEME_COLOR_VARIABLES: Record<ThemeColorTokenKey, string> = {
  chromePrimary: "--theme-color-chrome-primary",
  accentPrimary: "--theme-color-accent-primary",
  primaryText: "--theme-color-primary-text",
  surfaceBackground: "--theme-color-surface-background",
  panelBackground: "--theme-color-panel-background",
  borderPrimary: "--theme-color-border-primary",
  controlBackground: "--theme-color-control-background",
  controlBackgroundActive: "--theme-color-control-background-active",
  controlText: "--theme-color-control-text",
  surfaceMuted: "--theme-color-surface-muted",
  collapsedOutlineColor: "--theme-color-collapsed-outline",
  collapsedFillColor: "--theme-color-collapsed-fill",
  secondaryText: "--theme-color-secondary-text",
  statusSuccessText: "--theme-color-status-success-text",
  statusWarningText: "--theme-color-status-warning-text",
  statusErrorText: "--theme-color-status-error-text",
  echoMessageTextColor: "--theme-color-echo-message-text",
  echoMessageBackgroundColor: "--theme-color-echo-message-background",
  hudOutlineColor: "--theme-color-hud-outline",
  hudBackgroundColor: "--theme-color-hud-background",
  hudTextColor: "--theme-color-hud-text",
  hudManualDismissButtonColor: "--theme-color-hud-manual-dismiss-button"
};

const DEFAULT_THEME_COLORS: ThemeColorTokens = {
  chromePrimary: "#223A5E",
  accentPrimary: "#E6A817",
  primaryText: "#111827",
  surfaceBackground: "#F7F8FA",
  panelBackground: "#FFFFFF",
  borderPrimary: "#C8CDD6",
  controlBackground: "#F3F4F7",
  controlBackgroundActive: "#DFE6F3",
  controlText: "#223A5E",
  surfaceMuted: "#F5F7FB",
  collapsedOutlineColor: "#8BA5D1",
  collapsedFillColor: "#E6EDF9",
  secondaryText: "#4B5563",
  statusSuccessText: "#1F8A4C",
  statusWarningText: "#B7791F",
  statusErrorText: "#B83232",
  echoMessageTextColor: "#111827",
  echoMessageBackgroundColor: "#F5F7FB",
  hudOutlineColor: "#94A3B8",
  hudBackgroundColor: "#0F172A",
  hudTextColor: "#F9FAFB",
  hudManualDismissButtonColor: "#1D4ED8"
};

const DEFAULT_THEME_TYPOGRAPHY: ThemeTypographyTokens = {
  textFontFamilyPrimary: "\"Source Sans 3\", \"Segoe UI\", sans-serif",
  textFontFamilyDisplay: "\"Merriweather\", Georgia, serif",
  hudFontFamilyHeader: "\"Cascadia Mono\", \"Consolas\", \"Courier New\", monospace",
  hudFontFamilyBody: "\"Source Sans 3\", \"Segoe UI\", sans-serif"
};

const RESERVED_QUERY_PARAM_NAMES = new Set(["ff", "cp", "sk", "mode", "username", "autoStartSession"]);

type DiagnosticCategoryOption = {
  category: string;
  label: string;
};

const DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS: DiagnosticCategoryOption[] = [
  { category: "auth", label: "Auth" },
  { category: "command", label: "Command" },
  { category: "contracts", label: "Contracts" },
  { category: "discovery", label: "Discovery" },
  { category: "host-operation", label: "Host Operation" },
  { category: "transport", label: "Transport" },
  { category: "session", label: "Session" },
  { category: "session-delta", label: "Session Delta" },
  { category: "session-echo", label: "Session Echo" },
  { category: "session-render", label: "Session Render" },
  { category: "session-audio", label: "Session Audio" },
  { category: "asset-cache", label: "Asset Cache" },
  { category: "presentation-cues", label: "Presentation Cues" },
  { category: "movement-cues", label: "Movement Cues" },
  { category: "timing-sync", label: "Timing Sync" },
  { category: "state", label: "State" },
  { category: "renderer-scene", label: "Renderer Scene" },
  { category: "renderer-asset", label: "Renderer Asset" },
  { category: "renderer-frame", label: "Renderer Frame" },
  { category: "renderer-lifecycle", label: "Renderer Lifecycle" }
];

const DEFAULT_DIAGNOSTIC_CATEGORY_LABEL_BY_KEY = new Map(
  DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS.map((option) => [option.category, option.label])
);

const PORTAL_BUILD_IDENTITY = `${packageJson.name}@${packageJson.version}`;

function getQueryParam(name: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(name);
  return value ?? undefined;
}

function readQueryOverrides(): QueryOverrides {
  return {
    ff: getQueryParam("ff") ?? "",
    // Composition is mode-owned. Do not allow a URL to promote normal mode
    // into a developer composition.
    cp: "",
    sk: getQueryParam("sk") ?? ""
  };
}

function readSlotModeQueryOverrides(allowDeveloperSurfaces: boolean): Record<string, QuerySlotMode> {
  const params = new URLSearchParams(window.location.search);
  const overrides: Record<string, QuerySlotMode> = {};

  for (const [key, rawValue] of params.entries()) {
    if (!key || RESERVED_QUERY_PARAM_NAMES.has(key)) {
      continue;
    }

    if (!allowDeveloperSurfaces && (key === "devToolsDrawer" || key === "diagnosticsDrawer")) {
      continue;
    }

    const value = rawValue.trim().toLowerCase();
    if (value === "hidden" || value === "visible") {
      overrides[key] = value;
    }
  }

  return overrides;
}

function readPersistedOverride(storageKey: string): string {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function readBooleanSetting(storageKey: string, defaultValue: boolean): boolean {
  const persisted = readPersistedOverride(storageKey);
  if (!persisted) {
    return defaultValue;
  }

  return persisted === "true";
}

function readNumberSetting(storageKey: string, defaultValue: number): number {
  const persisted = readPersistedOverride(storageKey);
  const parsed = Number.parseInt(persisted, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function readDiagnosticsCategoryFilterSetting(storageKey: string): Record<string, boolean> {
  const persisted = readPersistedOverride(storageKey);
  if (!persisted) {
    return {};
  }

  try {
    const parsed = JSON.parse(persisted) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: Record<string, boolean> = {};
    for (const [rawCategory, rawEnabled] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof rawEnabled !== "boolean") {
        continue;
      }

      const normalizedCategory = rawCategory.trim().toLowerCase();
      if (!normalizedCategory) {
        continue;
      }

      result[normalizedCategory] = rawEnabled;
    }

    return result;
  } catch {
    return {};
  }
}

function buildProfileDisplayFilters(categories: string[], displayCategories: string[]): Record<string, boolean> {
  const enabled = new Set(displayCategories.map((category) => category.trim().toLowerCase()));
  return Object.fromEntries(categories
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)
    .filter((category) => !enabled.has(category))
    .map((category) => [category, false]));
}

function readDiagnosticsProfileSetting(storageKey: string, fallback: DiagnosticsProfile): DiagnosticsProfile {
  const persisted = readPersistedOverride(storageKey);
  return persisted === "Off" || persisted === "Focused" || persisted === "Normal" || persisted === "Verbose" || persisted === "Custom"
    ? persisted
    : fallback;
}

function setThemeCssVariable(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value);
}

function applyThemeColorTokens(color: ThemeColorTokens): void {
  for (const [tokenName, cssVariable] of Object.entries(THEME_COLOR_VARIABLES) as Array<[ThemeColorTokenKey, string]>) {
    setThemeCssVariable(cssVariable, color[tokenName]);
  }
}

function applyThemeTypographyTokens(typography: ThemeTypographyTokens): void {
  setThemeCssVariable("--theme-font-family-primary", typography.textFontFamilyPrimary);
  setThemeCssVariable("--theme-font-family-display", typography.textFontFamilyDisplay);
  setThemeCssVariable("--theme-font-family-hud-header", typography.hudFontFamilyHeader);
  setThemeCssVariable("--theme-font-family-hud-body", typography.hudFontFamilyBody);
}

function applyThemeContract(themeContract?: ThemeContract): void {
  if (!themeContract) {
    return;
  }

  const { typography, shape, spacing } = themeContract.tokens;
  applyThemeTypographyTokens(typography);

  setThemeCssVariable("--theme-shape-radius-base", `${shape.borderRadiusBase}px`);
  setThemeCssVariable("--theme-size-border-thickness", `${shape.borderThickness}px`);
  setThemeCssVariable("--theme-size-collapsed-component-thickness", `${shape.collapsedComponentThickness}px`);
  setThemeCssVariable("--theme-spacing-base", `${spacing.baseUnit}px`);
}

interface AppProps {
  initialSettings?: WebPortalSettings;
}

export default function App(props: AppProps): JSX.Element {
  const settings = props.initialSettings ?? DEFAULT_WEB_PORTAL_SETTINGS;
  const startupAudioGate = usePortalStartupAudioGate();
  const launchContext = useMemo(() => readPortalLaunchContext(), []);
  const developmentBootstrap = useMemo(() => {
    if (!launchContext.username) {
      return null;
    }

    return {
      username: launchContext.username,
      autoStartSession: launchContext.autoStartSession
    };
  }, [launchContext]);
  const [contracts, setContracts] = useState<OrchestrationContracts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const queryOverrides = useMemo<QueryOverrides>(() => readQueryOverrides(), []);
  const [state, setState] = useState<string>("");
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState<boolean>(false);
  const [diagnosticsVerbose, setDiagnosticsVerbose] = useState<boolean>(() => readBooleanSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsVerbose, false));
  const [diagnosticsCategoryFilters, setDiagnosticsCategoryFilters] = useState<Record<string, boolean>>(() => {
    const persisted = readDiagnosticsCategoryFilterSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsCategoryFilters);
    const initialProfile = readDiagnosticsProfileSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsProfile, settings.diagnosticsProfiles.defaultProfile);
    return Object.keys(persisted).length > 0
      ? persisted
      : buildProfileDisplayFilters(
        DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS.map((option) => option.category),
        initialProfile === "Off" || initialProfile === "Custom"
          ? DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS.map((option) => option.category)
          : settings.diagnosticsProfiles.profiles[initialProfile].displayCategories
      );
  });
  const [hostApiBaseUrlOverride, setHostApiBaseUrlOverride] = useState<string>(() => readPersistedOverride(DEV_TOOLS_STORAGE_KEYS.hostApiBaseUrlOverride));
  const [maxDiagnosticsEntries, setMaxDiagnosticsEntries] = useState<number>(() => readNumberSetting(DEV_TOOLS_STORAGE_KEYS.maxDiagnosticsEntries, 150));
  const [diagnosticsProfile, setDiagnosticsProfile] = useState<DiagnosticsProfile>(() => {
    return readDiagnosticsProfileSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsProfile, settings.diagnosticsProfiles.defaultProfile);
  });
  const [diagnosticsScope, setDiagnosticsScope] = useState<Record<PortalTraceSource, boolean>>(() => ({
    ...getDiagnosticsProfileScope(
      (() => {
        const initialProfile = readDiagnosticsProfileSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsProfile, settings.diagnosticsProfiles.defaultProfile);
        return initialProfile === "Custom" ? settings.diagnosticsProfiles.defaultProfile : initialProfile;
      })(),
      settings.diagnosticsProfiles
    ),
    ...(readDiagnosticsCategoryFilterSetting(DEV_TOOLS_STORAGE_KEYS.diagnosticsScope) as Partial<Record<PortalTraceSource, boolean>>)
  }));
  const [diagnosticsCaptureStartedUtc, setDiagnosticsCaptureStartedUtc] = useState<string | undefined>(undefined);
  const [diagnosticsCaptureStoppedUtc, setDiagnosticsCaptureStoppedUtc] = useState<string | undefined>(undefined);
  const [diagnosticsConsoleVisible, setDiagnosticsConsoleVisible] = useState<boolean>(false);
  const [diagnosticsDroppedCount, setDiagnosticsDroppedCount] = useState<number>(0);
  const [pollingSettingsOverrideEnabled, setPollingSettingsOverrideEnabled] = useState<boolean>(() => readBooleanSetting(DEV_TOOLS_STORAGE_KEYS.pollingSettingsOverrideEnabled, false));
  const [pollIntervalMsOverride, setPollIntervalMsOverride] = useState<number>(() => readNumberSetting(
    DEV_TOOLS_STORAGE_KEYS.pollIntervalMs,
    settings.devToolsDefaults.pollIntervalMs
  ));
  const [heartbeatEveryNPollsOverride, setHeartbeatEveryNPollsOverride] = useState<number>(() => readNumberSetting(
    DEV_TOOLS_STORAGE_KEYS.heartbeatEveryNPolls,
    settings.devToolsDefaults.heartbeatEveryNPolls
  ));
  const [slotModeOverrides, setSlotModeOverrides] = useState<SlotModeOverrides>({});
  const [showSlotTechnicalDetailsDefault, setShowSlotTechnicalDetailsDefault] = useState<boolean>(false);
  const [slotTechnicalDetailsOverrides, setSlotTechnicalDetailsOverrides] = useState<SlotTechnicalDetailsOverrides>({});
  const [showInspectorToggle, setShowInspectorToggle] = useState<boolean>(false);
  const [themeColorValues, setThemeColorValues] = useState<ThemeColorTokens>(DEFAULT_THEME_COLORS);
  const [themeTypographyValues, setThemeTypographyValues] = useState<ThemeTypographyTokens>(DEFAULT_THEME_TYPOGRAPHY);
  const [diagnosticsEntries, setDiagnosticsEntries] = useState<DiagnosticsEntry[]>([]);
  const isUndockedNonModalWindow = Boolean(window.opener) && Boolean(new URLSearchParams(window.location.search).get("undocked"));
  const liveControlsChannelRef = useRef<BroadcastChannel | null>(null);
  const liveThemeColorsChannelRef = useRef<BroadcastChannel | null>(null);
  const liveDiagnosticsChannelRef = useRef<BroadcastChannel | null>(null);
  const suppressLiveControlsBroadcastRef = useRef<boolean>(false);
  const suppressLiveThemeColorsBroadcastRef = useRef<boolean>(false);
  const suppressLiveDiagnosticsBroadcastRef = useRef<boolean>(false);
  const liveControlsSourceIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const liveThemeColorsSourceIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const liveDiagnosticsSourceIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const diagnosticsEntriesRef = useRef<DiagnosticsEntry[]>([]);
  const diagnosticsSequenceRef = useRef<number>(0);
  const diagnosticsDroppedCountRef = useRef<number>(0);

  const [preferredInputFocusRestoreEpoch, setPreferredInputFocusRestoreEpoch] = useState<number>(0);
  const preferredInputFocusLockUntilMsRef = useRef<number>(0);

  const pollIntervalMs = pollingSettingsOverrideEnabled
    ? pollIntervalMsOverride
    : settings.devToolsDefaults.pollIntervalMs;

  const heartbeatEveryNPolls = pollingSettingsOverrideEnabled
    ? heartbeatEveryNPollsOverride
    : diagnosticsProfile !== "Custom"
      ? diagnosticsProfile === "Off"
        ? settings.devToolsDefaults.heartbeatEveryNPolls
        : settings.diagnosticsProfiles.profiles[diagnosticsProfile as DiagnosticsProfileKey]?.heartbeatEveryNPolls ?? settings.devToolsDefaults.heartbeatEveryNPolls
      : settings.devToolsDefaults.heartbeatEveryNPolls;

  const addDiagnostic = useCallback((level: DiagnosticsLevel, category: string, message: string, details?: unknown): void => {
    if (!diagnosticsEnabled) {
      return;
    }

    const entry = normalizePortalTraceEvent({
      level,
      category,
      message,
      details
    }, diagnosticsSequenceRef.current + 1);

    if (!diagnosticsScope[entry.source]) {
      return;
    }

    diagnosticsSequenceRef.current = entry.sequence;

    setDiagnosticsEntries((previous) => {
      const retention = appendPortalTraceEvent(
        previous,
        entry,
        Math.max(10, Math.min(500, maxDiagnosticsEntries))
      );
      diagnosticsDroppedCountRef.current += retention.droppedCount;
      if (retention.droppedCount > 0) {
        setDiagnosticsDroppedCount((previous) => previous + retention.droppedCount);
      }
      return retention.entries;
    });
  }, [diagnosticsEnabled, diagnosticsScope, maxDiagnosticsEntries]);

  const startDiagnosticsTrace = useCallback((): void => {
    setDiagnosticsEnabled(true);
    setDiagnosticsCaptureStartedUtc(new Date().toISOString());
    setDiagnosticsCaptureStoppedUtc(undefined);
    diagnosticsDroppedCountRef.current = 0;
    setDiagnosticsDroppedCount(0);
  }, []);

  const stopDiagnosticsTrace = useCallback((): void => {
    setDiagnosticsEnabled(false);
    setDiagnosticsCaptureStoppedUtc(new Date().toISOString());
  }, []);

  const showDiagnosticsConsole = useCallback((): void => {
    setDiagnosticsConsoleVisible(true);
    setSlotModeOverrides((previous) => ({
      ...previous,
      diagnosticsDrawer: "visible"
    }));
  }, []);

  const hideDiagnosticsConsole = useCallback((): void => {
    setDiagnosticsConsoleVisible(false);
    setSlotModeOverrides((previous) => ({
      ...previous,
      diagnosticsDrawer: "hidden"
    }));
  }, []);

  const clearDiagnostics = useCallback((): void => {
    setDiagnosticsEntries([]);
    diagnosticsEntriesRef.current = [];
    diagnosticsDroppedCountRef.current = 0;
    setDiagnosticsDroppedCount(0);
  }, []);

  const changeDiagnosticsProfile = useCallback((profile: DiagnosticsProfile): void => {
    setDiagnosticsProfile(profile);
    if (profile !== "Custom") {
      setPollingSettingsOverrideEnabled(false);
      setDiagnosticsScope(getDiagnosticsProfileScope(profile, settings.diagnosticsProfiles));
      if (profile !== "Off") {
        setDiagnosticsCategoryFilters(buildProfileDisplayFilters(
          DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS.map((option) => option.category),
          settings.diagnosticsProfiles.profiles[profile].displayCategories
        ));
      } else {
        setDiagnosticsCategoryFilters({});
      }
    }
  }, [settings.diagnosticsProfiles]);

  const changeDiagnosticsScope = useCallback((source: PortalTraceSource, enabled: boolean): void => {
    setDiagnosticsProfile("Custom");
    setDiagnosticsScope((previous) => ({
      ...previous,
      [source]: enabled
    }));
  }, []);

  const diagnosticsCategoryOptions = useMemo(() => {
    const byCategory = new Map<string, DiagnosticCategoryOption>();
    for (const option of DEFAULT_DIAGNOSTIC_CATEGORY_OPTIONS) {
      byCategory.set(option.category, option);
    }

    for (const entry of diagnosticsEntries) {
      const normalizedCategory = entry.category.trim().toLowerCase();
      if (!normalizedCategory || byCategory.has(normalizedCategory)) {
        continue;
      }

      byCategory.set(normalizedCategory, {
        category: normalizedCategory,
        label: entry.category.trim()
      });
    }

    return [...byCategory.values()]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((option) => ({
        category: option.category,
        label: DEFAULT_DIAGNOSTIC_CATEGORY_LABEL_BY_KEY.get(option.category) ?? option.label,
        enabled: diagnosticsCategoryFilters[option.category] ?? true
      }));
  }, [diagnosticsCategoryFilters, diagnosticsEntries]);

  const diagnosticsExportMetadata = useMemo<PortalTraceExportMetadata>(() => buildPortalTraceExportMetadata(
    diagnosticsEntries,
    {
      buildIdentity: PORTAL_BUILD_IDENTITY,
      captureStartedUtc: diagnosticsCaptureStartedUtc,
      captureStoppedUtc: diagnosticsCaptureStoppedUtc,
      profile: diagnosticsProfile,
      scope: Object.entries(diagnosticsScope)
        .filter(([, enabled]) => enabled)
        .map(([source]) => source),
      droppedCount: diagnosticsDroppedCount
    }
  ), [
    diagnosticsCaptureStartedUtc,
    diagnosticsCaptureStoppedUtc,
    diagnosticsDroppedCount,
    diagnosticsEntries,
    diagnosticsProfile,
    diagnosticsScope
  ]);

  const diagnosticsWorkspace = useMemo<DiagnosticsWorkspaceProps>(() => ({
    capturing: diagnosticsEnabled,
    profile: diagnosticsProfile,
    scopeOptions: buildDiagnosticsScopeOptions(diagnosticsScope),
    categoryOptions: diagnosticsCategoryOptions,
    entryCount: diagnosticsEntries.length,
    entries: diagnosticsEntries,
    exportMetadata: diagnosticsExportMetadata,
    droppedCount: diagnosticsDroppedCount,
    captureStartedUtc: diagnosticsCaptureStartedUtc,
    captureStoppedUtc: diagnosticsCaptureStoppedUtc,
    consoleVisible: diagnosticsConsoleVisible,
    onStartTrace: startDiagnosticsTrace,
    onStopTrace: stopDiagnosticsTrace,
    onShowConsole: showDiagnosticsConsole,
    onHideConsole: hideDiagnosticsConsole,
    onClear: clearDiagnostics,
    onProfileChange: changeDiagnosticsProfile,
    onScopeEnabledChange: changeDiagnosticsScope,
    onCategoryEnabledChange: (category, enabled) => {
      const normalizedCategory = category.trim().toLowerCase();
      if (!normalizedCategory) {
        return;
      }

      setDiagnosticsCategoryFilters((previous) => {
        if (enabled) {
          if (!(normalizedCategory in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[normalizedCategory];
          return next;
        }

        if (previous[normalizedCategory] === false) {
          return previous;
        }

        return {
          ...previous,
          [normalizedCategory]: false
        };
      });
    }
  }), [
    changeDiagnosticsProfile,
    changeDiagnosticsScope,
    clearDiagnostics,
    diagnosticsCaptureStartedUtc,
    diagnosticsCaptureStoppedUtc,
    diagnosticsCategoryOptions,
    diagnosticsConsoleVisible,
    diagnosticsDroppedCount,
    diagnosticsEnabled,
    diagnosticsEntries,
    diagnosticsExportMetadata,
    diagnosticsProfile,
    diagnosticsScope,
    hideDiagnosticsConsole,
    showDiagnosticsConsole,
    startDiagnosticsTrace,
    stopDiagnosticsTrace
  ]);

  useEffect(() => {
    diagnosticsEntriesRef.current = diagnosticsEntries;
  }, [diagnosticsEntries]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(LIVE_LAYOUT_CONTROLS_CHANNEL);
    liveControlsChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        sourceId?: string;
        payload?: {
          slotModeOverrides?: SlotModeOverrides;
          showSlotTechnicalDetailsDefault?: boolean;
          slotTechnicalDetailsOverrides?: SlotTechnicalDetailsOverrides;
          showInspectorToggle?: boolean;
        };
      };

      if (data?.type !== "layout-controls" || !data.payload) {
        return;
      }

      if (data.sourceId === liveControlsSourceIdRef.current) {
        return;
      }

      suppressLiveControlsBroadcastRef.current = true;
      setSlotModeOverrides(data.payload.slotModeOverrides ?? {});
      setShowSlotTechnicalDetailsDefault(data.payload.showSlotTechnicalDetailsDefault ?? true);
      setSlotTechnicalDetailsOverrides(data.payload.slotTechnicalDetailsOverrides ?? {});
      setShowInspectorToggle(data.payload.showInspectorToggle ?? true);
    };

    return () => {
      liveControlsChannelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    const channel = liveControlsChannelRef.current;
    if (!channel) {
      return;
    }

    if (suppressLiveControlsBroadcastRef.current) {
      suppressLiveControlsBroadcastRef.current = false;
      return;
    }

    channel.postMessage({
      type: "layout-controls",
      sourceId: liveControlsSourceIdRef.current,
      payload: {
        slotModeOverrides,
        showSlotTechnicalDetailsDefault,
        slotTechnicalDetailsOverrides,
        showInspectorToggle
      }
    });
  }, [slotModeOverrides, showSlotTechnicalDetailsDefault, slotTechnicalDetailsOverrides, showInspectorToggle]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(LIVE_THEME_COLORS_CHANNEL);
    liveThemeColorsChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        sourceId?: string;
        payload?: {
          colors?: ThemeColorTokens;
          typography?: ThemeTypographyTokens;
        };
      };

      if (data?.type !== "theme-colors" || (!data.payload?.colors && !data.payload?.typography)) {
        return;
      }

      if (data.sourceId === liveThemeColorsSourceIdRef.current) {
        return;
      }

      suppressLiveThemeColorsBroadcastRef.current = true;
      if (data.payload.colors) {
        setThemeColorValues(data.payload.colors);
      }
      if (data.payload.typography) {
        setThemeTypographyValues(data.payload.typography);
      }
    };

    return () => {
      liveThemeColorsChannelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(LIVE_DIAGNOSTICS_CHANNEL);
    liveDiagnosticsChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        sourceId?: string;
        targetSourceId?: string;
        payload?: {
          entries?: DiagnosticsEntry[];
        };
      };

      if (!data?.type || data.sourceId === liveDiagnosticsSourceIdRef.current) {
        return;
      }

      if (data.type === "diagnostics-sync-request") {
        if (isUndockedNonModalWindow) {
          return;
        }

        channel.postMessage({
          type: "diagnostics-state",
          sourceId: liveDiagnosticsSourceIdRef.current,
          targetSourceId: data.sourceId,
          payload: {
            entries: diagnosticsEntriesRef.current
          }
        });
        return;
      }

      if (data.type !== "diagnostics-state") {
        return;
      }

      if (data.targetSourceId && data.targetSourceId !== liveDiagnosticsSourceIdRef.current) {
        return;
      }

      if (!isUndockedNonModalWindow) {
        return;
      }

      const incomingEntries = Array.isArray(data.payload?.entries) ? data.payload.entries : [];
      suppressLiveDiagnosticsBroadcastRef.current = true;
      setDiagnosticsEntries(incomingEntries);
    };

    if (isUndockedNonModalWindow) {
      channel.postMessage({
        type: "diagnostics-sync-request",
        sourceId: liveDiagnosticsSourceIdRef.current
      });
    }

    return () => {
      liveDiagnosticsChannelRef.current = null;
      channel.close();
    };
  }, [isUndockedNonModalWindow]);

  useEffect(() => {
    const channel = liveDiagnosticsChannelRef.current;
    if (!channel || isUndockedNonModalWindow) {
      return;
    }

    if (suppressLiveDiagnosticsBroadcastRef.current) {
      suppressLiveDiagnosticsBroadcastRef.current = false;
      return;
    }

    channel.postMessage({
      type: "diagnostics-state",
      sourceId: liveDiagnosticsSourceIdRef.current,
      payload: {
        entries: diagnosticsEntries
      }
    });
  }, [diagnosticsEntries, isUndockedNonModalWindow]);

  useEffect(() => {
    const channel = liveThemeColorsChannelRef.current;
    if (!channel) {
      return;
    }

    if (suppressLiveThemeColorsBroadcastRef.current) {
      suppressLiveThemeColorsBroadcastRef.current = false;
      return;
    }

    channel.postMessage({
      type: "theme-colors",
      sourceId: liveThemeColorsSourceIdRef.current,
      payload: {
        colors: themeColorValues,
        typography: themeTypographyValues
      }
    });
  }, [themeColorValues, themeTypographyValues]);

  useEffect(() => {
    applyThemeColorTokens(themeColorValues);
  }, [themeColorValues]);

  useEffect(() => {
    applyThemeTypographyTokens(themeTypographyValues);
  }, [themeTypographyValues]);

  useEffect(() => {
    loadOrchestrationContracts()
      .then((loaded) => {
        applyThemeContract(loaded.themeContract);
        setThemeColorValues(loaded.themeContract?.tokens.color ?? DEFAULT_THEME_COLORS);
        setThemeTypographyValues(loaded.themeContract?.tokens.typography ?? DEFAULT_THEME_TYPOGRAPHY);
        setContracts(loaded);
        setState(loaded.featureMap.initialExperienceState);
        addDiagnostic("info", "contracts", "Orchestration contracts loaded successfully.", {
          initialExperienceState: loaded.featureMap.initialExperienceState
        });
      })
      .catch((err) => {
        const errorText = err instanceof Error ? err.message : String(err);
        setLoadError(errorText);
        addDiagnostic("error", "contracts", "Failed to load orchestration contracts.", { error: errorText });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contracts || state !== "Bootstrapping") {
      return;
    }

    const bootstrapNext = tryTransition(contracts, state, "BootstrapComplete");
    if (bootstrapNext) {
      setState(bootstrapNext);
      addDiagnostic("info", "state", `Auto-transitioned from ${state} to ${bootstrapNext}.`, {
        event: "BootstrapComplete"
      });
    }
  }, [contracts, state]);

  const handleThemeColorChange = useCallback((tokenName: ThemeColorTokenKey, nextValue: string): void => {
    setThemeColorValues((previous) => ({
      ...previous,
      [tokenName]: nextValue
    }));
  }, []);

  const handleThemeColorsReset = useCallback((): void => {
    setThemeColorValues(contracts?.themeContract?.tokens.color ?? DEFAULT_THEME_COLORS);
  }, [contracts]);

  const handleThemeTypographyChange = useCallback((tokenName: ThemeTypographyTokenKey, nextValue: string): void => {
    setThemeTypographyValues((previous) => ({
      ...previous,
      [tokenName]: nextValue
    }));
  }, []);

  const handleThemeTypographyReset = useCallback((): void => {
    setThemeTypographyValues(contracts?.themeContract?.tokens.typography ?? DEFAULT_THEME_TYPOGRAPHY);
  }, [contracts]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.diagnosticsVerbose, String(diagnosticsVerbose));
  }, [diagnosticsVerbose]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.diagnosticsCategoryFilters, JSON.stringify(diagnosticsCategoryFilters));
  }, [diagnosticsCategoryFilters]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.hostApiBaseUrlOverride, hostApiBaseUrlOverride);
  }, [hostApiBaseUrlOverride]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.maxDiagnosticsEntries, String(maxDiagnosticsEntries));
  }, [maxDiagnosticsEntries]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.diagnosticsProfile, diagnosticsProfile);
  }, [diagnosticsProfile]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.diagnosticsScope, JSON.stringify(diagnosticsScope));
  }, [diagnosticsScope]);

  useEffect(() => {
    window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.pollingSettingsOverrideEnabled, String(pollingSettingsOverrideEnabled));
  }, [pollingSettingsOverrideEnabled]);

  useEffect(() => {
    if (pollingSettingsOverrideEnabled) {
      window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.pollIntervalMs, String(pollIntervalMs));
      return;
    }

    window.localStorage.removeItem(DEV_TOOLS_STORAGE_KEYS.pollIntervalMs);
  }, [pollIntervalMs, pollingSettingsOverrideEnabled]);

  useEffect(() => {
    if (pollingSettingsOverrideEnabled) {
      window.localStorage.setItem(DEV_TOOLS_STORAGE_KEYS.heartbeatEveryNPolls, String(heartbeatEveryNPolls));
      return;
    }

    window.localStorage.removeItem(DEV_TOOLS_STORAGE_KEYS.heartbeatEveryNPolls);
  }, [heartbeatEveryNPolls, pollingSettingsOverrideEnabled]);

  const handlePollIntervalMsChange = useCallback((value: number): void => {
    setPollingSettingsOverrideEnabled(true);
    setPollIntervalMsOverride(value);
  }, []);

  const handleHeartbeatEveryNPollsChange = useCallback((value: number): void => {
    setPollingSettingsOverrideEnabled(true);
    setHeartbeatEveryNPollsOverride(value);
  }, []);

  const states = useMemo(() => {
    if (!contracts) {
      return [];
    }

    return Object.keys(contracts.featureMap.experienceStates).sort();
  }, [contracts]);

  const effectiveOverrides = useMemo(() => {
    return resolveEffectiveOverrides(
      queryOverrides,
      {
        ff: "",
        cp: "",
        sk: ""
      }
    );
  }, [queryOverrides]);

  const plan = useMemo(() => {
    if (!contracts || !state) {
      return { plan: null, resolveError: null as string | null };
    }

    try {
      return {
        plan: resolveShellPlan(contracts, {
          modeKey: launchContext.mode,
          experienceState: state,
          formFactorOverride: effectiveOverrides.formFactor.value || undefined,
          compositionProfileOverride: effectiveOverrides.composition.value || undefined,
          skeletonLayoutOverride: effectiveOverrides.skeleton.value || undefined
        }),
        resolveError: null as string | null
      };
    } catch (err) {
      return {
        plan: null,
        resolveError: err instanceof Error ? err.message : String(err)
      };
    }
  }, [contracts, launchContext.mode, state, effectiveOverrides]);

  const error = loadError ?? plan.resolveError;

  const activeFormFactorKey = useMemo(() => {
    if (!contracts) {
      return "";
    }

    return plan.plan?.formFactorKey
      || effectiveOverrides.formFactor.value
      || contracts.featureMap.resolutionDefaults.defaultFormFactorKey
      || contracts.implementations.defaultFormFactorKey;
  }, [contracts, plan.plan, effectiveOverrides.formFactor.value]);

  const DiagnosticsConsoleComponent = useMemo(() => {
    if (!contracts || !activeFormFactorKey) {
      return DiagnosticsConsole;
    }

    return resolveTechnicalFeatureComponent(
      contracts,
      "diagnosticsConsole",
      activeFormFactorKey,
      DiagnosticsConsole
    );
  }, [contracts, activeFormFactorKey]);

  const DevToolsPanelComponent = useMemo(() => {
    if (!contracts || !activeFormFactorKey) {
      return DevToolsPanel;
    }

    return resolveTechnicalFeatureComponent(
      contracts,
      "devToolsPanel",
      activeFormFactorKey,
      DevToolsPanel
    );
  }, [contracts, activeFormFactorKey]);

  const slotModeQueryOverrides = useMemo(
    () => readSlotModeQueryOverrides(launchContext.mode === "devsimulator"),
    [launchContext.mode]
  );

  const effectiveSlotModes = useMemo(() => {
    const modes: Record<string, SlotMode> = {};
    for (const slot of plan.plan?.slots ?? []) {
      modes[slot.slotKey] = slotModeOverrides[slot.slotKey] ?? slotModeQueryOverrides[slot.slotKey] ?? slot.mode;
    }

    return modes;
  }, [plan.plan, slotModeOverrides, slotModeQueryOverrides]);

  const previewContext = useMemo<PreviewContext | undefined>(() => {
    if (!plan.plan) {
      return undefined;
    }

    return {
      experienceState: state,
      formFactorKey: plan.plan.formFactorKey,
      compositionProfileKey: plan.plan.compositionProfileKey,
      skeletonLayoutKey: plan.plan.skeletonLayoutKey
    };
  }, [plan.plan, state]);

  const hostWorkflow = useHostWorkflow({
    baseUrlOverride: hostApiBaseUrlOverride,
    developmentBootstrap,
    startupAudioStatus: startupAudioGate.status,
    pollIntervalMs,
    heartbeatEveryNPolls,
    echoOutputRetentionLines: settings.devToolsDefaults.echoOutputRetentionLines,
    audioDefaults: settings.audioDefaults,
    roomTransitionDefaults: settings.roomTransitionDefaults,
    waypointDefaults: settings.waypointDefaults,
    uiCommandVerbs: settings.uiCommandVerbs,
    presentationCueCatalogRelativeLocator: settings.presentationCueCatalogRelativeLocator,
    contracts,
    state,
    states,
    onStateChange: setState,
    addDiagnostic
  });

  const handleCommandSubmitCompleted = useCallback((): void => {
    setPreferredInputFocusRestoreEpoch((previous) => previous + 1);
  }, []);

  const renderFeatureForSlot = useCallback((slot: ResolvedSlot): JSX.Element | null => {
    return (
      <ConfigSlotFeatureRenderer
        slot={slot}
        state={state}
        hostWorkflow={hostWorkflow}
          onCommandSubmitCompleted={handleCommandSubmitCompleted}
        diagnosticsEnabled={diagnosticsEnabled}
        diagnosticsVerbose={diagnosticsVerbose}
        hostApiBaseUrlOverride={hostApiBaseUrlOverride}
        maxDiagnosticsEntries={maxDiagnosticsEntries}
        diagnosticsCategoryOptions={diagnosticsCategoryOptions}
        diagnosticsCategoryFilters={diagnosticsCategoryFilters}
        diagnosticsWorkspace={diagnosticsWorkspace}
        pollIntervalMs={pollIntervalMs}
        heartbeatEveryNPolls={heartbeatEveryNPolls}
        diagnosticsEntries={diagnosticsEntries}
        diagnosticsExportMetadata={diagnosticsExportMetadata}
        onClearDiagnostics={clearDiagnostics}
        onDiagnosticsEnabledChange={setDiagnosticsEnabled}
        onDiagnosticsVerboseChange={setDiagnosticsVerbose}
        onHostApiBaseUrlOverrideChange={setHostApiBaseUrlOverride}
        onMaxDiagnosticsEntriesChange={setMaxDiagnosticsEntries}
        onDiagnosticsCategoryEnabledChange={(category, enabled) => {
          const normalizedCategory = category.trim().toLowerCase();
          if (!normalizedCategory) {
            return;
          }

          setDiagnosticsProfile("Custom");

          setDiagnosticsCategoryFilters((previous) => {
            if (enabled) {
              if (!(normalizedCategory in previous)) {
                return previous;
              }

              const next = { ...previous };
              delete next[normalizedCategory];
              return next;
            }

            if (previous[normalizedCategory] === false) {
              return previous;
            }

            return {
              ...previous,
              [normalizedCategory]: false
            };
          });
        }}
        onSetAllDiagnosticsCategoriesEnabled={(enabled) => {
          setDiagnosticsProfile("Custom");
          setDiagnosticsCategoryFilters(() => {
            if (enabled) {
              return {};
            }

            const next: Record<string, boolean> = {};
            for (const option of diagnosticsCategoryOptions) {
              next[option.category] = false;
            }

            return next;
          });
        }}
        onPollIntervalMsChange={handlePollIntervalMsChange}
        onHeartbeatEveryNPollsChange={handleHeartbeatEveryNPollsChange}
        slotModeOverrides={slotModeOverrides}
        onSlotModeOverrideChange={(slotKey, mode) => {
          setSlotModeOverrides((previous) => {
            if (!mode) {
              const next = { ...previous };
              delete next[slotKey];
              return next;
            }

            return {
              ...previous,
              [slotKey]: mode
            };
          });
        }}
        effectiveSlotModes={effectiveSlotModes}
        allowedSlotModes={contracts?.uiSlots.allowedSlotModes ?? []}
        showSlotTechnicalDetailsDefault={showSlotTechnicalDetailsDefault}
        onShowSlotTechnicalDetailsDefaultChange={setShowSlotTechnicalDetailsDefault}
        slotTechnicalDetailsOverrides={slotTechnicalDetailsOverrides}
        onSlotTechnicalDetailsOverrideChange={(slotKey, showDetails) => {
          setSlotTechnicalDetailsOverrides((previous) => ({
            ...previous,
            [slotKey]: showDetails
          }));
        }}
        showInspectorToggle={showInspectorToggle}
        onShowInspectorToggleChange={setShowInspectorToggle}
        themeColorValues={themeColorValues}
        onThemeColorChange={handleThemeColorChange}
        onThemeColorsReset={handleThemeColorsReset}
        themeTypographyValues={themeTypographyValues}
        onThemeTypographyChange={handleThemeTypographyChange}
        onThemeTypographyReset={handleThemeTypographyReset}
        previewContext={previewContext}
        DiagnosticsConsoleComponent={DiagnosticsConsoleComponent}
        DevToolsPanelComponent={DevToolsPanelComponent}
      />
    );
  }, [
    DiagnosticsConsoleComponent,
    DevToolsPanelComponent,
    diagnosticsEnabled,
    diagnosticsEntries,
    diagnosticsExportMetadata,
    diagnosticsCategoryFilters,
    diagnosticsWorkspace,
    diagnosticsVerbose,
    hostApiBaseUrlOverride,
    hostWorkflow,
    maxDiagnosticsEntries,
    state,
    slotModeOverrides,
    effectiveSlotModes,
    contracts,
    showSlotTechnicalDetailsDefault,
    slotTechnicalDetailsOverrides,
    showInspectorToggle,
    previewContext,
    themeColorValues,
    themeTypographyValues,
    handleThemeColorChange,
    handleThemeColorsReset,
    handleThemeTypographyChange,
    handleThemeTypographyReset,
    handleCommandSubmitCompleted,
    clearDiagnostics
  ]);

  const planWithSlotModeOverrides = useMemo(() => {
    if (!plan.plan) {
      return null;
    }

    const hasQueryOverrides = Object.keys(slotModeQueryOverrides).length > 0;
    const hasManualOverrides = Object.keys(slotModeOverrides).length > 0;
    if (!hasQueryOverrides && !hasManualOverrides) {
      return plan.plan;
    }

    return {
      ...plan.plan,
      slots: plan.plan.slots.map((slot) => {
        const overriddenMode = slotModeOverrides[slot.slotKey] ?? slotModeQueryOverrides[slot.slotKey];
        if (!overriddenMode) {
          return slot;
        }

        return {
          ...slot,
          mode: overriddenMode
        };
      })
    };
  }, [plan.plan, slotModeQueryOverrides, slotModeOverrides]);

  const preferredInputElementId = useMemo(() => {
    const preferredInputFocus = planWithSlotModeOverrides?.preferredInputFocus;
    if (!preferredInputFocus) {
      return "";
    }

    const hasVisiblePreferredFeature = planWithSlotModeOverrides?.slots.some((slot) => {
      return slot.featureKey === preferredInputFocus.featureKey && slot.mode !== "hidden";
    });
    if (!hasVisiblePreferredFeature) {
      return "";
    }

    return preferredInputFocus.inputElementId?.trim() ?? "";
  }, [planWithSlotModeOverrides]);

  const restorePreferredInputFocus = useCallback((): void => {
    if (!preferredInputElementId) {
      return;
    }

    const input = document.getElementById(preferredInputElementId) as HTMLInputElement | null;
    if (!input || input.disabled) {
      return;
    }

    input.focus({ preventScroll: true });
  }, [preferredInputElementId]);

  useEffect(() => {
    if (preferredInputFocusRestoreEpoch <= 0 || !preferredInputElementId) {
      return;
    }

    preferredInputFocusLockUntilMsRef.current = Date.now() + 2000;

    const isTargetFocused = (): boolean => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.id === preferredInputElementId;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const preferredInput = document.getElementById(preferredInputElementId);
      if (!preferredInput) {
        preferredInputFocusLockUntilMsRef.current = 0;
        return;
      }

      if (!preferredInput.contains(target)) {
        preferredInputFocusLockUntilMsRef.current = 0;
      }
    };

    const intervalId = window.setInterval(() => {
      if (Date.now() > preferredInputFocusLockUntilMsRef.current) {
        window.clearInterval(intervalId);
        return;
      }

      if (!isTargetFocused()) {
        restorePreferredInputFocus();
      }
    }, 50);

    restorePreferredInputFocus();
    window.requestAnimationFrame(() => {
      restorePreferredInputFocus();
    });

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [
    preferredInputFocusRestoreEpoch,
    preferredInputElementId,
    restorePreferredInputFocus
  ]);

  const skeletonTemplateStyleText = useMemo(() => {
    if (!contracts || !planWithSlotModeOverrides) {
      return undefined;
    }

    const layout = contracts.skeletonLayouts.skeletonLayouts[planWithSlotModeOverrides.skeletonLayoutKey];
    return layout?.templateStyleText;
  }, [contracts, planWithSlotModeOverrides]);

  const skeletonTemplateRootMetadata = useMemo(() => {
    if (!contracts || !planWithSlotModeOverrides) {
      return { className: undefined as string | undefined, dataSkeleton: undefined as string | undefined };
    }

    const layout = contracts.skeletonLayouts.skeletonLayouts[planWithSlotModeOverrides.skeletonLayoutKey];

    return {
      className: layout?.templateRootClassName,
      dataSkeleton: layout?.templateRootDataSkeleton
    };
  }, [contracts, planWithSlotModeOverrides]);

  const skeletonTemplateSlotGridPlacements = useMemo(() => {
    if (!contracts || !planWithSlotModeOverrides) {
      return undefined;
    }

    const layout = contracts.skeletonLayouts.skeletonLayouts[planWithSlotModeOverrides.skeletonLayoutKey];
    return layout?.templateSlotGridPlacements;
  }, [contracts, planWithSlotModeOverrides]);

  const skeletonTemplateSlotClassNames = useMemo(() => {
    if (!contracts || !planWithSlotModeOverrides) {
      return undefined;
    }

    const layout = contracts.skeletonLayouts.skeletonLayouts[planWithSlotModeOverrides.skeletonLayoutKey];
    return layout?.templateSlotClassNames;
  }, [contracts, planWithSlotModeOverrides]);

  const shellClassName = "shell mode-config";
  const startupSplash = (
    <PortalStartupSplash
      status={startupAudioGate.status}
      onEnableAudio={() => void startupAudioGate.enableAudio()}
      onRetryAudio={() => void startupAudioGate.retryAudio()}
      onContinueMuted={startupAudioGate.continueMuted}
    />
  );

  if (!contracts) {
    return (
      <main className={shellClassName}>
        {loadError ? <section className="error">{loadError}</section> : <p>Loading orchestration contracts...</p>}
        {startupSplash}
      </main>
    );
  }

  return (
    <main
      className={shellClassName}
      data-launch-mode={launchContext.mode}
      data-portal-mode={launchContext.mode}
    >
      {startupSplash}
      {error ? <section className="error">{error}</section> : null}

      {planWithSlotModeOverrides ? (
        <ConfigDrivenLayoutPreview
          plan={planWithSlotModeOverrides}
          slotDefinitions={contracts.uiSlots.slots}
          templateStyleText={skeletonTemplateStyleText}
          templateRootClassName={skeletonTemplateRootMetadata.className}
          templateRootDataSkeleton={skeletonTemplateRootMetadata.dataSkeleton}
          templateSlotGridPlacements={skeletonTemplateSlotGridPlacements}
          templateSlotClassNames={skeletonTemplateSlotClassNames}
          showSlotTechnicalDetailsDefault={showSlotTechnicalDetailsDefault}
          slotTechnicalDetailsOverrides={slotTechnicalDetailsOverrides}
          onRequestSlotModeChange={(slotKey, mode) => {
            setSlotModeOverrides((previous) => ({
              ...previous,
              [slotKey]: mode
            }));
          }}
          renderFeature={renderFeatureForSlot}
        />
      ) : null}

    </main>
  );
}
