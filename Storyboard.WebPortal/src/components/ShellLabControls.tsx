import type { ComponentProps, ComponentType, JSX } from "react";
import { DevToolsPanel } from "./DevToolsPanel";
import { OverrideControls } from "./OverrideControls";
import { TransitionEvents } from "./TransitionEvents";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { EffectiveOverrides } from "../overrides/overrideResolution";
import type { SlotMode, ThemeContract } from "../orchestration/types";

type SlotModeOverrides = Record<string, SlotMode>;
type SlotTechnicalDetailsOverrides = Record<string, boolean>;
type ThemeColorTokenKey = keyof ThemeContract["tokens"]["color"];
type ThemeColorTokens = ThemeContract["tokens"]["color"];
type ThemeTypographyTokenKey = keyof ThemeContract["tokens"]["typography"];
type ThemeTypographyTokens = ThemeContract["tokens"]["typography"];
type PreviewContext = {
  experienceState: string;
  formFactorKey: string;
  compositionProfileKey: string;
  skeletonLayoutKey: string;
  renderMode: RenderMode;
};

type RenderMode = "lab" | "config";

interface ShellLabControlsProps {
  renderMode: RenderMode;
  inspectorOpen: boolean;
  devToolsOpen: boolean;
  onDevToolsOpenChange: (nextOpen: boolean) => void;
  onRenderModeChange: (nextMode: RenderMode) => void;
  DevToolsPanelComponent: ComponentType<ComponentProps<typeof DevToolsPanel>>;
  diagnosticsEnabled: boolean;
  diagnosticsVerbose: boolean;
  hostApiBaseUrlOverride: string;
  maxDiagnosticsEntries: number;
  diagnosticsCategoryOptions: Array<{
    category: string;
    label: string;
    enabled: boolean;
  }>;
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
  state: string;
  states: string[];
  formFactorOverride: string;
  formFactors: string[];
  compositionOverride: string;
  compositionProfiles: string[];
  skeletonOverride: string;
  skeletonLayouts: string[];
  onStateChange: (nextState: string) => void;
  onFormFactorChange: (nextFormFactor: string) => void;
  onCompositionChange: (nextComposition: string) => void;
  onSkeletonChange: (nextSkeleton: string) => void;
  onResetOverrides: () => void;
  onCopyShareUrl: () => Promise<void>;
  onClearQueryOverrides: () => void;
  hasQueryOverrides: boolean;
  effectiveOverrides: EffectiveOverrides;
  shareMessage: string;
  activeEvents: string[];
  onTriggerEvent: (eventName: string) => void;
  hostWorkflow: HostWorkflowState;
}

export function ShellLabControls(props: ShellLabControlsProps): JSX.Element {
  return (
    <section className={`controls ${props.renderMode === "config" ? "inspector" : ""} ${props.renderMode === "config" && !props.inspectorOpen ? "collapsed" : ""}`}>
      <h1>Storyboard Shell Lab</h1>
      <p className="subtitle">Phase 1 placeholder shell for state/layout/implementation resolution.</p>
      <div className="events">
        <button type="button" onClick={() => props.onDevToolsOpenChange(!props.devToolsOpen)}>
          {props.devToolsOpen ? "Hide Dev Tools" : "Show Dev Tools"}
        </button>
        <button type="button" onClick={() => props.onRenderModeChange("lab")} disabled={props.renderMode === "lab"}>Lab Renderer</button>
        <button type="button" onClick={() => props.onRenderModeChange("config")} disabled={props.renderMode === "config"}>Config Renderer Preview</button>
      </div>

      {props.devToolsOpen ? (
        <props.DevToolsPanelComponent
          diagnosticsEnabled={props.diagnosticsEnabled}
          diagnosticsVerbose={props.diagnosticsVerbose}
          hostApiBaseUrlOverride={props.hostApiBaseUrlOverride}
          maxDiagnosticsEntries={props.maxDiagnosticsEntries}
          diagnosticsCategoryOptions={props.diagnosticsCategoryOptions}
          pollIntervalMs={props.pollIntervalMs}
          heartbeatEveryNPolls={props.heartbeatEveryNPolls}
          onDiagnosticsEnabledChange={props.onDiagnosticsEnabledChange}
          onDiagnosticsVerboseChange={props.onDiagnosticsVerboseChange}
          onHostApiBaseUrlOverrideChange={props.onHostApiBaseUrlOverrideChange}
          onMaxDiagnosticsEntriesChange={props.onMaxDiagnosticsEntriesChange}
          onDiagnosticsCategoryEnabledChange={props.onDiagnosticsCategoryEnabledChange}
          onSetAllDiagnosticsCategoriesEnabled={props.onSetAllDiagnosticsCategoriesEnabled}
          onPollIntervalMsChange={props.onPollIntervalMsChange}
          onHeartbeatEveryNPollsChange={props.onHeartbeatEveryNPollsChange}
          slotModeOverrides={props.slotModeOverrides}
          onSlotModeOverrideChange={props.onSlotModeOverrideChange}
          effectiveSlotModes={props.effectiveSlotModes}
          allowedSlotModes={props.allowedSlotModes}
          showSlotTechnicalDetailsDefault={props.showSlotTechnicalDetailsDefault}
          onShowSlotTechnicalDetailsDefaultChange={props.onShowSlotTechnicalDetailsDefaultChange}
          slotTechnicalDetailsOverrides={props.slotTechnicalDetailsOverrides}
          onSlotTechnicalDetailsOverrideChange={props.onSlotTechnicalDetailsOverrideChange}
          showInspectorToggle={props.showInspectorToggle}
          onShowInspectorToggleChange={props.onShowInspectorToggleChange}
          themeColorValues={props.themeColorValues}
          onThemeColorChange={props.onThemeColorChange}
          onThemeColorsReset={props.onThemeColorsReset}
          themeTypographyValues={props.themeTypographyValues}
          onThemeTypographyChange={props.onThemeTypographyChange}
          onThemeTypographyReset={props.onThemeTypographyReset}
          previewContext={props.previewContext}
          cacheStats={props.hostWorkflow.cacheStats}
          onResetCacheStats={props.hostWorkflow.resetCacheStats}
          onClearMemoryCache={props.hostWorkflow.clearMemoryCache}
          onClearPersistentCache={props.hostWorkflow.clearPersistentCache}
          audioUnlockRequired={props.hostWorkflow.audioUnlockRequired}
          onAudioUnlockRequiredChange={props.hostWorkflow.setAudioUnlockRequired}
          soundCueStatus={props.hostWorkflow.soundCueStatus}
          onRequestAudioUnlock={props.hostWorkflow.requestAudioUnlock}
          sfxMuted={props.hostWorkflow.sfxMuted}
          onSfxMutedChange={props.hostWorkflow.setSfxMuted}
          sfxVolumePercent={props.hostWorkflow.sfxVolumePercent}
          onSfxVolumePercentChange={props.hostWorkflow.setSfxVolumePercent}
          ambientMuted={props.hostWorkflow.ambientMuted}
          onAmbientMutedChange={props.hostWorkflow.setAmbientMuted}
          ambientVolumePercent={props.hostWorkflow.ambientVolumePercent}
          onAmbientVolumePercentChange={props.hostWorkflow.setAmbientVolumePercent}
          roomTransitionCueOptions={props.hostWorkflow.roomTransitionCueOptions}
          selectedRoomTransitionCueEffectKey={props.hostWorkflow.selectedRoomTransitionCueEffectKey}
          onSelectedRoomTransitionCueEffectKeyChange={props.hostWorkflow.setSelectedRoomTransitionCueEffectKey}
          roomTransitionCatalogStatus={props.hostWorkflow.roomTransitionCatalogStatus}
        />
      ) : null}

      <OverrideControls
        state={props.state}
        states={props.states}
        formFactorOverride={props.formFactorOverride}
        formFactors={props.formFactors}
        compositionOverride={props.compositionOverride}
        compositionProfiles={props.compositionProfiles}
        skeletonOverride={props.skeletonOverride}
        skeletonLayouts={props.skeletonLayouts}
        onStateChange={props.onStateChange}
        onFormFactorChange={props.onFormFactorChange}
        onCompositionChange={props.onCompositionChange}
        onSkeletonChange={props.onSkeletonChange}
        onResetOverrides={props.onResetOverrides}
        onCopyShareUrl={props.onCopyShareUrl}
        onClearQueryOverrides={props.onClearQueryOverrides}
        hasQueryOverrides={props.hasQueryOverrides}
      />

      <div className="meta">
        <span>renderMode={props.renderMode}</span>
        <span>effective.formFactor={props.effectiveOverrides.formFactor.value || "(default)"}</span>
        <span>source.formFactor={props.effectiveOverrides.formFactor.source}</span>
        <span>effective.composition={props.effectiveOverrides.composition.value || "(default)"}</span>
        <span>source.composition={props.effectiveOverrides.composition.source}</span>
        <span>effective.skeleton={props.effectiveOverrides.skeleton.value || "(default)"}</span>
        <span>source.skeleton={props.effectiveOverrides.skeleton.source}</span>
      </div>

      {props.shareMessage ? <p className="share-note">{props.shareMessage}</p> : null}

      <TransitionEvents
        events={props.activeEvents}
        onTriggerEvent={props.onTriggerEvent}
      />

      <section className="host-flow">
        <h2>Host API Workflow (Phase 2 Scaffold)</h2>
        <p className="subtitle">Signed-out to signed-in and discovery flow against /api/v1 endpoints.</p>

        <div className="grid">
          <label>
            Username
            <input value={props.hostWorkflow.authUsername} onChange={(e) => props.hostWorkflow.setAuthUsername(e.target.value)} disabled={props.hostWorkflow.hostBusy} />
          </label>

          <label>
            Password
            <input
              type="password"
              value={props.hostWorkflow.authPassword}
              onChange={(e) => props.hostWorkflow.setAuthPassword(e.target.value)}
              disabled={props.hostWorkflow.hostBusy}
            />
          </label>
        </div>

        <div className="events">
          <button type="button" onClick={props.hostWorkflow.signInToHost} disabled={props.hostWorkflow.hostBusy}>Sign In</button>
          <button type="button" onClick={props.hostWorkflow.fetchCurrentPrincipal} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle}>Current Principal</button>
          <button type="button" onClick={props.hostWorkflow.fetchDiscoveredGames} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle}>Discover Games</button>
          <button type="button" onClick={props.hostWorkflow.startSessionFromSelectedGame} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle}>Start Session</button>
          <button type="button" onClick={props.hostWorkflow.listHostSessions} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle}>List Sessions</button>
          <button type="button" onClick={props.hostWorkflow.joinSelectedSession} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle || !props.hostWorkflow.selectedSessionId}>Join Session</button>
          <button type="button" onClick={props.hostWorkflow.leaveActiveSession} disabled={props.hostWorkflow.hostBusy || !props.hostWorkflow.credentialHandle || !(props.hostWorkflow.activeSessionId || props.hostWorkflow.selectedSessionId)}>Leave Session</button>
        </div>

        <div className="meta">
          <span>principal={props.hostWorkflow.principalName || "(none)"}</span>
          <span>credentialHandle={props.hostWorkflow.credentialHandle || "(none)"}</span>
          <span>activeSessionId={props.hostWorkflow.activeSessionId || "(none)"}</span>
          <span>operation={props.hostWorkflow.hostOperationKey}</span>
          <span>phase={props.hostWorkflow.hostOperationPhase}</span>
        </div>

        <p className="share-note">{props.hostWorkflow.hostStatus}</p>

        <div className="grid">
          <label>
            Start Game
            <select
              value={props.hostWorkflow.selectedGameId ? `${props.hostWorkflow.selectedGameId}|${props.hostWorkflow.selectedGameKey}` : ""}
              onChange={(e) => {
                const [gameId, gameKey] = e.target.value.split("|");
                props.hostWorkflow.setSelectedGame(gameId || "", gameKey || "");
              }}
              disabled={props.hostWorkflow.hostBusy || props.hostWorkflow.discoverGames.length === 0}
            >
              <option value="">(select discovered game)</option>
              {props.hostWorkflow.discoverGames.map((game) => (
                <option key={`${game.gameId}:${game.gameKey}`} value={`${game.gameId}|${game.gameKey}`}>
                  {game.displayName || game.gameKey}
                </option>
              ))}
            </select>
          </label>

          <label>
            Session Name
            <input
              value={props.hostWorkflow.requestedSessionName}
              onChange={(e) => props.hostWorkflow.setRequestedSessionName(e.target.value)}
              disabled={props.hostWorkflow.hostBusy}
            />
          </label>

          <label>
            Join Policy
            <input
              value={props.hostWorkflow.requestedJoinPolicy}
              onChange={(e) => props.hostWorkflow.setRequestedJoinPolicy(e.target.value)}
              disabled={props.hostWorkflow.hostBusy}
            />
          </label>

          <label>
            Target Session
            <select
              value={props.hostWorkflow.selectedSessionId}
              onChange={(e) => props.hostWorkflow.setSelectedSessionId(e.target.value)}
              disabled={props.hostWorkflow.hostBusy || props.hostWorkflow.sessions.length === 0}
            >
              <option value="">(select listed session)</option>
              {props.hostWorkflow.sessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.sessionName || session.sessionId}
                </option>
              ))}
            </select>
          </label>
        </div>

        {props.hostWorkflow.discoverGames.length > 0 ? (
          <ul>
            {props.hostWorkflow.discoverGames.map((game) => (
              <li key={`${game.gameId}:${game.gameKey}`}>{game.displayName || game.gameKey} ({game.gameKey})</li>
            ))}
          </ul>
        ) : null}

        {props.hostWorkflow.sessions.length > 0 ? (
          <ul>
            {props.hostWorkflow.sessions.map((session) => (
              <li key={session.sessionId}>
                {session.sessionName || session.sessionId} [{session.sessionState || "unknown"}] policy={session.joinPolicy || "n/a"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
