import { useState } from "react";
import type { SlotMode, ThemeContract } from "../orchestration/types";
import type { WebPortalAssetCacheStats } from "../cache/webPortalAssetCache";
import { DiagnosticsWorkspace, type DiagnosticsWorkspaceProps } from "./DiagnosticsWorkspace";

type SlotModeOverrides = Record<string, SlotMode>;
type SlotTechnicalDetailsOverrides = Record<string, boolean>;
interface PreviewContext {
  experienceState: string;
  formFactorKey: string;
  compositionProfileKey: string;
  skeletonLayoutKey: string;
}

type ThemeColorTokenKey = keyof ThemeContract["tokens"]["color"];
type ThemeColorTokens = ThemeContract["tokens"]["color"];
type ThemeTypographyTokenKey = keyof ThemeContract["tokens"]["typography"];
type ThemeTypographyTokens = ThemeContract["tokens"]["typography"];
type HudThemeTypographyTokenKey = "hudFontFamilyHeader" | "hudFontFamilyBody";

const THEME_COLOR_DESCRIPTIONS: Record<ThemeColorTokenKey, { label: string; description: string }> = {
  chromePrimary: {
    label: "chromePrimary",
    description: "Primary shell/chrome foreground, used for major UI headings and chrome text."
  },
  accentPrimary: {
    label: "accentPrimary",
    description: "Primary accent used for emphasis and highlighted borders."
  },
  primaryText: {
    label: "primaryText",
    description: "Default high-priority text color."
  },
  surfaceBackground: {
    label: "surfaceBackground",
    description: "App-level background behind panels and slots."
  },
  panelBackground: {
    label: "panelBackground",
    description: "Default panel/card background color."
  },
  borderPrimary: {
    label: "borderPrimary",
    description: "Primary border and divider color across controls and panels."
  },
  controlBackground: {
    label: "controlBackground",
    description: "Default input/button/chip background color."
  },
  controlBackgroundActive: {
    label: "controlBackgroundActive",
    description: "Active/selected control background color."
  },
  controlText: {
    label: "controlText",
    description: "Text color used inside interactive controls."
  },
  surfaceMuted: {
    label: "surfaceMuted",
    description: "Muted helper/placeholder surface color."
  },
  collapsedOutlineColor: {
    label: "collapsedOutlineColor",
    description: "Outline color for collapsed slot indicators."
  },
  collapsedFillColor: {
    label: "collapsedFillColor",
    description: "Fill color for collapsed slot indicators."
  },
  secondaryText: {
    label: "secondaryText",
    description: "Secondary text for subtitles and metadata."
  },
  statusSuccessText: {
    label: "statusSuccessText",
    description: "Success-state text color."
  },
  statusWarningText: {
    label: "statusWarningText",
    description: "Warning-state text color."
  },
  statusErrorText: {
    label: "statusErrorText",
    description: "Error-state text color."
  },
  echoMessageTextColor: {
    label: "echoMessageTextColor",
    description: "Command handler echo/output text color."
  },
  echoMessageBackgroundColor: {
    label: "echoMessageBackgroundColor",
    description: "Command handler echo/output panel background color."
  },
  hudOutlineColor: {
    label: "hudOutlineColor",
    description: "HUD card outline stroke color in the Pixi play surface."
  },
  hudBackgroundColor: {
    label: "hudBackgroundColor",
    description: "HUD card background fill color in the Pixi play surface."
  },
  hudTextColor: {
    label: "hudTextColor",
    description: "HUD message text color in the Pixi play surface."
  },
  hudManualDismissButtonColor: {
    label: "hudManualDismissButtonColor",
    description: "Manual-dismiss call-to-action color shown on HUD entries that need a click."
  }
};

const HUD_THEME_TYPOGRAPHY_DESCRIPTIONS: Record<HudThemeTypographyTokenKey, { label: string; description: string }> = {
  hudFontFamilyHeader: {
    label: "hudFontFamilyHeader",
    description: "HUD header/action font stack used by manual-dismiss cue text."
  },
  hudFontFamilyBody: {
    label: "hudFontFamilyBody",
    description: "HUD body font stack used by in-scene narrative/message text."
  }
};

interface DevToolsPanelProps {
  diagnosticsEnabled: boolean;
  diagnosticsVerbose: boolean;
  hostApiBaseUrlOverride: string;
  maxDiagnosticsEntries: number;
  diagnosticsCategoryOptions: Array<{
    category: string;
    label: string;
    enabled: boolean;
  }>;
  diagnosticsWorkspace: DiagnosticsWorkspaceProps;
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
  onDiagnosticsEnabledChange: (value: boolean) => void;
  onDiagnosticsVerboseChange: (value: boolean) => void;
  onHostApiBaseUrlOverrideChange: (value: string) => void;
  onMaxDiagnosticsEntriesChange: (value: number) => void;
  onDiagnosticsCategoryEnabledChange: (category: string, enabled: boolean) => void;
  onSetAllDiagnosticsCategoriesEnabled: (enabled: boolean) => void;
  onPollIntervalMsChange: (value: number) => void;
  onHeartbeatEveryNPollsChange: (value: number) => void;
  slotModeOverrides: SlotModeOverrides;
  onSlotModeOverrideChange: (slotKey: string, mode: SlotMode | undefined) => void;
  effectiveSlotModes: Record<string, SlotMode>;
  allowedSlotModes: SlotMode[];
  showSlotTechnicalDetailsDefault: boolean;
  onShowSlotTechnicalDetailsDefaultChange: (value: boolean) => void;
  slotTechnicalDetailsOverrides: SlotTechnicalDetailsOverrides;
  onSlotTechnicalDetailsOverrideChange: (slotKey: string, showDetails: boolean) => void;
  showInspectorToggle: boolean;
  onShowInspectorToggleChange: (value: boolean) => void;
  themeColorValues: ThemeColorTokens;
  onThemeColorChange: (tokenName: ThemeColorTokenKey, value: string) => void;
  onThemeColorsReset: () => void;
  themeTypographyValues: ThemeTypographyTokens;
  onThemeTypographyChange: (tokenName: ThemeTypographyTokenKey, value: string) => void;
  onThemeTypographyReset: () => void;
  previewContext?: PreviewContext;
  cacheStats: WebPortalAssetCacheStats;
  onResetCacheStats: () => void;
  onClearMemoryCache: () => void;
  onClearPersistentCache: () => Promise<void>;
  audioUnlockRequired: boolean;
  onAudioUnlockRequiredChange: (value: boolean) => void;
  soundCueStatus: {
    isAudioUnlocked: boolean;
    pendingUnlockCueCount: number;
    autoplayBlockedCount: number;
  };
  onRequestAudioUnlock: () => void;
  sfxMuted: boolean;
  onSfxMutedChange: (value: boolean) => void;
  sfxVolumePercent: number;
  onSfxVolumePercentChange: (value: number) => void;
  ambientMuted: boolean;
  onAmbientMutedChange: (value: boolean) => void;
  ambientVolumePercent: number;
  onAmbientVolumePercentChange: (value: number) => void;
  roomTransitionCueOptions: Array<{
    effectKey: string;
    displayName: string;
    durationMs?: number;
    mode?: "slide" | "fade" | "fade-blackout";
  }>;
  selectedRoomTransitionCueEffectKey: string;
  onSelectedRoomTransitionCueEffectKeyChange: (effectKey: string) => void;
  roomTransitionCatalogStatus: {
    loaded: boolean;
    source: "none" | "cache" | "network";
    relativeLocator: string;
    gameId: string;
    gameKey: string;
    effectCount: number;
    roomTransitionCount: number;
    selectedCueEffectKey: string;
    selectedCueDurationMs?: number;
    usingFallbackDuration: boolean;
    lastError?: string;
  };
}

export function DevToolsPanel(props: DevToolsPanelProps): JSX.Element {
  const [activeSection, setActiveSection] = useState<"host" | "diagnostics" | "polling" | "layout" | "theme" | "cache" | "audio" | "roomTransitions">("polling");
  const [clearingPersistentCache, setClearingPersistentCache] = useState<boolean>(false);
  const slotKeys = Object.keys(props.effectiveSlotModes).sort();
  const themeColorKeys = Object.keys(THEME_COLOR_DESCRIPTIONS) as ThemeColorTokenKey[];
  const hudThemeTypographyKeys = Object.keys(HUD_THEME_TYPOGRAPHY_DESCRIPTIONS) as HudThemeTypographyTokenKey[];
  const totalHits = props.cacheStats.memoryHits + props.cacheStats.indexedDbHits;
  const hitRate = props.cacheStats.lookupRequests > 0
    ? (totalHits / props.cacheStats.lookupRequests) * 100
    : 0;
  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
  }

  async function handleClearPersistentCache(): Promise<void> {
    setClearingPersistentCache(true);
    try {
      await props.onClearPersistentCache();
    } finally {
      setClearingPersistentCache(false);
    }
  }

  return (
    <section className="results devtools-panel">
      <h2>Dev Tools</h2>
      <p className="subtitle">Technical controls grouped for quick navigation.</p>

      <div className="devtools-layout">
        <nav className="devtools-nav" aria-label="Dev tools sections">
          <button
            type="button"
            className={activeSection === "polling" ? "active" : ""}
            onClick={() => setActiveSection("polling")}
          >
            Session Delta Polling
          </button>
          <button
            type="button"
            className={activeSection === "diagnostics" ? "active" : ""}
            onClick={() => setActiveSection("diagnostics")}
          >
            Diagnostics
          </button>
          <button
            type="button"
            className={activeSection === "host" ? "active" : ""}
            onClick={() => setActiveSection("host")}
          >
            Host Connection
          </button>
          <button
            type="button"
            className={activeSection === "layout" ? "active" : ""}
            onClick={() => setActiveSection("layout")}
          >
            Layout Controls
          </button>
          <button
            type="button"
            className={activeSection === "theme" ? "active" : ""}
            onClick={() => setActiveSection("theme")}
          >
            Theme Colors
          </button>
          <button
            type="button"
            className={activeSection === "cache" ? "active" : ""}
            onClick={() => setActiveSection("cache")}
          >
            Cache
          </button>
          <button
            type="button"
            className={activeSection === "audio" ? "active" : ""}
            onClick={() => setActiveSection("audio")}
          >
            Audio
          </button>
          <button
            type="button"
            className={activeSection === "roomTransitions" ? "active" : ""}
            onClick={() => setActiveSection("roomTransitions")}
          >
            Room Transitions
          </button>
        </nav>

        <section className="devtools-section">
          {activeSection === "polling" ? (
            <>
              <h3>Session Delta Polling</h3>
              <p className="subtitle">Controls for heartbeat cadence and no-op logging visibility.</p>

              <div className="grid">
                <label>
                  Poll Interval (ms)
                  <input
                    type="number"
                    min={100}
                    max={60000}
                    value={props.pollIntervalMs}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(parsed)) {
                        props.onPollIntervalMsChange(parsed);
                      }
                    }}
                  />
                </label>

                <label>
                  Heartbeat Every N Polls
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={props.heartbeatEveryNPolls}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(parsed)) {
                        props.onHeartbeatEveryNPollsChange(parsed);
                      }
                    }}
                  />
                </label>
              </div>
            </>
          ) : null}

          {activeSection === "diagnostics" ? (
            <DiagnosticsWorkspace {...props.diagnosticsWorkspace} />
          ) : null}

          {activeSection === "host" ? (
            <>
              <h3>Host Connection</h3>
              <p className="subtitle">Host transport endpoint override.</p>

              <div className="grid">
                <label>
                  Host API Base URL Override
                  <input
                    value={props.hostApiBaseUrlOverride}
                    onChange={(e) => props.onHostApiBaseUrlOverrideChange(e.target.value)}
                    placeholder="http://127.0.0.1:5199"
                  />
                </label>
              </div>
            </>
          ) : null}

          {activeSection === "layout" ? (
            <>
              <h3>Layout Controls</h3>
              <p className="subtitle">Manual slot mode overrides and slot chrome visibility controls.</p>

              {props.previewContext ? (
                <div className="slot-control-item preview-context-card">
                  <strong>Preview Context</strong>
                  <span>state: {props.previewContext.experienceState}</span>
                  <span>form factor: {props.previewContext.formFactorKey}</span>
                  <span>composition: {props.previewContext.compositionProfileKey}</span>
                  <span>layout: {props.previewContext.skeletonLayoutKey}</span>
                </div>
              ) : null}

              <div className="grid">
                <label>
                  <span>Show Inspector Toggle Button</span>
                  <input
                    type="checkbox"
                    checked={props.showInspectorToggle}
                    onChange={(e) => props.onShowInspectorToggleChange(e.target.checked)}
                  />
                </label>

                <label>
                  <span>Show Slot Technical Details by Default</span>
                  <input
                    type="checkbox"
                    checked={props.showSlotTechnicalDetailsDefault}
                    onChange={(e) => props.onShowSlotTechnicalDetailsDefaultChange(e.target.checked)}
                  />
                </label>
              </div>

              <div className="slot-control-list">
                {slotKeys.map((slotKey) => {
                  const effectiveMode = props.effectiveSlotModes[slotKey];
                  const overrideMode = props.slotModeOverrides[slotKey] ?? "";
                  const hasSlotDetailsOverride = Object.prototype.hasOwnProperty.call(props.slotTechnicalDetailsOverrides, slotKey);
                  const slotDetailsVisible = hasSlotDetailsOverride
                    ? Boolean(props.slotTechnicalDetailsOverrides[slotKey])
                    : props.showSlotTechnicalDetailsDefault;

                  return (
                    <div className="slot-control-item" key={slotKey}>
                      <strong>{slotKey}</strong>
                      <span>effective mode: {effectiveMode}</span>

                      <label>
                        Slot Mode Override
                        <select
                          value={overrideMode}
                          onChange={(e) => {
                            const value = e.target.value;
                            props.onSlotModeOverrideChange(slotKey, value ? value as SlotMode : undefined);
                          }}
                        >
                          <option value="">(none)</option>
                          {props.allowedSlotModes.map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Show Slot Technical Details</span>
                        <input
                          type="checkbox"
                          checked={slotDetailsVisible}
                          onChange={(e) => props.onSlotTechnicalDetailsOverrideChange(slotKey, e.target.checked)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {activeSection === "theme" ? (
            <>
              <h3>Theme Tokens</h3>
              <p className="subtitle">Live token tuning playground. Changes apply instantly and are not persisted.</p>

              <div className="events">
                <button type="button" onClick={props.onThemeColorsReset}>Reset To Contract</button>
                <button type="button" onClick={props.onThemeTypographyReset}>Reset HUD Fonts To Contract</button>
              </div>

              <div className="theme-token-list">
                {themeColorKeys.map((tokenName) => {
                  const config = THEME_COLOR_DESCRIPTIONS[tokenName];
                  const value = props.themeColorValues[tokenName];
                  return (
                    <div className="theme-token-item" key={tokenName}>
                      <strong>{config.label}</strong>
                      <span>{config.description}</span>
                      <div className="theme-token-inputs">
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => props.onThemeColorChange(tokenName, e.target.value)}
                          aria-label={`${config.label} color picker`}
                        />
                        <input
                          value={value}
                          onChange={(e) => props.onThemeColorChange(tokenName, e.target.value)}
                          aria-label={`${config.label} hex value`}
                        />
                      </div>
                    </div>
                  );
                })}

                {hudThemeTypographyKeys.map((tokenName) => {
                  const config = HUD_THEME_TYPOGRAPHY_DESCRIPTIONS[tokenName];
                  const value = props.themeTypographyValues[tokenName];
                  return (
                    <div className="theme-token-item" key={tokenName}>
                      <strong>{config.label}</strong>
                      <span>{config.description}</span>
                      <div className="theme-token-inputs">
                        <input
                          value={value}
                          onChange={(e) => props.onThemeTypographyChange(tokenName, e.target.value)}
                          aria-label={`${config.label} font family`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {activeSection === "cache" ? (
            <>
              <h3>Cache</h3>
              <p className="subtitle">Read-through cache effectiveness and pressure across memory and IndexedDB tiers.</p>

              <div className="events">
                <button type="button" onClick={props.onResetCacheStats}>Reset Counters</button>
                <button type="button" onClick={props.onClearMemoryCache}>Clear Memory Cache</button>
                <button
                  type="button"
                  onClick={() => {
                    void handleClearPersistentCache();
                  }}
                  disabled={clearingPersistentCache}
                >
                  {clearingPersistentCache ? "Clearing IndexedDB..." : "Clear Persistent IndexedDB"}
                </button>
              </div>

              <ul className="devtools-status-list" aria-label="Cache traffic and hit rate">
                <li>Lookup requests: {props.cacheStats.lookupRequests}</li>
                <li>Hit rate: {hitRate.toFixed(1)}%</li>
                <li>Memory hits: {props.cacheStats.memoryHits}</li>
                <li>IndexedDB hits: {props.cacheStats.indexedDbHits}</li>
                <li>Network fetches: {props.cacheStats.networkFetches}</li>
                <li>Misses: {props.cacheStats.misses}</li>
              </ul>

              <ul className="devtools-status-list" aria-label="Cache usage">
                <li>Memory entries: {props.cacheStats.memoryEntryCount}</li>
                <li>Memory bytes: {formatBytes(props.cacheStats.memoryBytes)}</li>
                <li>IndexedDB entries: {props.cacheStats.indexedDbEntryCount}</li>
                <li>IndexedDB bytes: {formatBytes(props.cacheStats.indexedDbBytes)}</li>
              </ul>

              <ul className="devtools-status-list" aria-label="Cache health">
                <li>Writes: {props.cacheStats.writes}</li>
                <li>Memory evictions: {props.cacheStats.memoryEvictions}</li>
                <li>IndexedDB evictions: {props.cacheStats.indexedDbEvictions}</li>
                <li>TTL expirations: {props.cacheStats.ttlExpirations}</li>
                <li>Parse failures: {props.cacheStats.parseFailures}</li>
                <li>IndexedDB errors: {props.cacheStats.indexedDbErrors}</li>
              </ul>
            </>
          ) : null}

          {activeSection === "audio" ? (
            <>
              <h3>Audio</h3>
              <p className="subtitle">Sound cue playback controls, unlock diagnostics, and lane mix tuning.</p>

              <div className="grid">
                <label>
                  <span>Require User Gesture To Unlock Audio</span>
                  <input
                    type="checkbox"
                    checked={props.audioUnlockRequired}
                    onChange={(e) => props.onAudioUnlockRequiredChange(e.target.checked)}
                  />
                </label>

                <label>
                  <span>SFX Muted</span>
                  <input
                    type="checkbox"
                    checked={props.sfxMuted}
                    onChange={(e) => props.onSfxMutedChange(e.target.checked)}
                  />
                </label>

                <label>
                  SFX Volume (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={props.sfxVolumePercent}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(parsed)) {
                        props.onSfxVolumePercentChange(parsed);
                      }
                    }}
                  />
                </label>

                <label>
                  <span>Ambient Muted</span>
                  <input
                    type="checkbox"
                    checked={props.ambientMuted}
                    onChange={(e) => props.onAmbientMutedChange(e.target.checked)}
                  />
                </label>

                <label>
                  Ambient Volume (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={props.ambientVolumePercent}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(parsed)) {
                        props.onAmbientVolumePercentChange(parsed);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="events">
                <button
                  type="button"
                  onClick={props.onRequestAudioUnlock}
                  disabled={props.soundCueStatus.isAudioUnlocked}
                >
                  {props.soundCueStatus.isAudioUnlocked ? "Audio Unlocked" : "Unlock Audio"}
                </button>
              </div>

              <ul className="devtools-status-list" aria-label="Sound cue playback status">
                <li>Audio unlocked: {props.soundCueStatus.isAudioUnlocked ? "yes" : "no"}</li>
                <li>Queued cues waiting for unlock: {props.soundCueStatus.pendingUnlockCueCount}</li>
                <li>Autoplay blocked attempts: {props.soundCueStatus.autoplayBlockedCount}</li>
              </ul>
            </>
          ) : null}

          {activeSection === "roomTransitions" ? (
            <>
              <h3>Room Transitions</h3>
              <p className="subtitle">Runtime-only transition cue selection for this session (not persisted).</p>

              <div className="grid">
                <label>
                  Active RoomTransition Cue
                  <select
                    value={props.selectedRoomTransitionCueEffectKey}
                    onChange={(e) => props.onSelectedRoomTransitionCueEffectKeyChange(e.target.value)}
                    disabled={props.roomTransitionCueOptions.length === 0}
                  >
                    <option value="">(auto from settings)</option>
                    {props.roomTransitionCueOptions.length === 0 ? <option value="">(no RoomTransition cues loaded)</option> : null}
                    {props.roomTransitionCueOptions.map((cue) => (
                      <option key={cue.effectKey} value={cue.effectKey}>
                        {cue.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ul className="devtools-status-list" aria-label="Available room transition cues">
                <li>Catalog loaded: {props.roomTransitionCatalogStatus.loaded ? "yes" : "no"}</li>
                <li>Catalog source: {props.roomTransitionCatalogStatus.source}</li>
                <li>Catalog locator: {props.roomTransitionCatalogStatus.relativeLocator || "(none)"}</li>
                <li>Game id: {props.roomTransitionCatalogStatus.gameId || "(none)"}</li>
                <li>Game key: {props.roomTransitionCatalogStatus.gameKey || "(none)"}</li>
                <li>Catalog effect count: {props.roomTransitionCatalogStatus.effectCount}</li>
                <li>RoomTransition effect count: {props.roomTransitionCatalogStatus.roomTransitionCount}</li>
                <li>Selected cue key: {props.roomTransitionCatalogStatus.selectedCueEffectKey || "(none)"}</li>
                <li>Selected cue duration from catalog: {props.roomTransitionCatalogStatus.selectedCueDurationMs ?? "(missing)"}</li>
                <li>Using fallback duration: {props.roomTransitionCatalogStatus.usingFallbackDuration ? "yes" : "no"}</li>
                {props.roomTransitionCatalogStatus.lastError ? <li>Last catalog error: {props.roomTransitionCatalogStatus.lastError}</li> : null}
              </ul>

              <ul className="devtools-status-list" aria-label="Available room transition cue entries">
                {props.roomTransitionCueOptions.length === 0 ? <li>No RoomTransition cues are currently available in the loaded catalog.</li> : null}
                {props.roomTransitionCueOptions.map((cue) => (
                  <li key={`room-transition-cue:${cue.effectKey}`}>
                    {cue.effectKey} | mode={cue.mode ?? "(unspecified)"} | duration={cue.durationMs ?? "(catalog timing missing)"}ms
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
