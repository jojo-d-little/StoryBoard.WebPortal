import type { ComponentProps, ComponentType, JSX } from "react";
import { AuthSignInV1 } from "./AuthSignInV1";
import { CommandHandlerV1 } from "./CommandHandlerV1";
import { DevToolsPanel } from "./DevToolsPanel";
import { DiagnosticsConsole, type DiagnosticsEntry } from "./DiagnosticsConsole";
import type { DiagnosticsWorkspaceProps } from "./DiagnosticsWorkspace";
import type { PortalTraceExportMetadata } from "../diagnostics/portalTraceExport";
import { GameDiscoveryV1 } from "./GameDiscoveryV1";
import { GameDetailsV1 } from "./GameDetailsV1";
import { IdentityBootstrapStatusV1 } from "./IdentityBootstrapStatusV1";
import { InterruptionRecoveryV1 } from "./InterruptionRecoveryV1";
import { SessionPlaySurfaceHostV1 } from "./SessionPlaySurfaceHostV1";
import { StatusBarInfoV1 } from "./StatusBarInfoV1";
import { TopBarMenuV1 } from "./TopBarMenuV1";
import { InGameToolsMenuHostV1 } from "./InGameToolsMenuHostV1";
import type { ResolvedSlot, SlotMode, ThemeContract } from "../orchestration/types";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { PresentationIsolationCategory } from "../gameRenderer/presentationIsolation";

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
};

interface ConfigSlotFeatureRendererProps {
  slot: ResolvedSlot;
  state: string;
  hostWorkflow: HostWorkflowState;
  onCommandSubmitCompleted: () => void;
  diagnosticsEnabled: boolean;
  diagnosticsVerbose: boolean;
  hostApiBaseUrlOverride: string;
  maxDiagnosticsEntries: number;
  diagnosticsCategoryOptions: Array<{
    category: string;
    label: string;
    enabled: boolean;
  }>;
  diagnosticsCategoryFilters: Record<string, boolean>;
  diagnosticsWorkspace: DiagnosticsWorkspaceProps;
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
  diagnosticsEntries: DiagnosticsEntry[];
  diagnosticsExportMetadata: PortalTraceExportMetadata;
  onClearDiagnostics: () => void;
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
  DiagnosticsConsoleComponent: ComponentType<ComponentProps<typeof DiagnosticsConsole>>;
  DevToolsPanelComponent: ComponentType<ComponentProps<typeof DevToolsPanel>>;
}

export function ConfigSlotFeatureRenderer(props: ConfigSlotFeatureRendererProps): JSX.Element | null {
  const {
    slot,
    state,
    hostWorkflow,
    onCommandSubmitCompleted,
    diagnosticsEnabled,
    diagnosticsVerbose,
    hostApiBaseUrlOverride,
    maxDiagnosticsEntries,
    diagnosticsCategoryOptions,
    diagnosticsCategoryFilters,
    diagnosticsWorkspace,
    pollIntervalMs,
    heartbeatEveryNPolls,
    diagnosticsEntries,
    diagnosticsExportMetadata,
    onClearDiagnostics,
    onDiagnosticsEnabledChange,
    onDiagnosticsVerboseChange,
    onHostApiBaseUrlOverrideChange,
    onMaxDiagnosticsEntriesChange,
    onDiagnosticsCategoryEnabledChange,
    onSetAllDiagnosticsCategoriesEnabled,
    onPollIntervalMsChange,
    onHeartbeatEveryNPollsChange,
    slotModeOverrides,
    onSlotModeOverrideChange,
    effectiveSlotModes,
    allowedSlotModes,
    showSlotTechnicalDetailsDefault,
    onShowSlotTechnicalDetailsDefaultChange,
    slotTechnicalDetailsOverrides,
    onSlotTechnicalDetailsOverrideChange,
    showInspectorToggle,
    onShowInspectorToggleChange,
    themeColorValues,
    onThemeColorChange,
    onThemeColorsReset,
    themeTypographyValues,
    onThemeTypographyChange,
    onThemeTypographyReset,
    previewContext,
    DiagnosticsConsoleComponent,
    DevToolsPanelComponent
  } = props;

  if (slot.slotKey === "topBar") {
    const showDevToolsButton = Object.prototype.hasOwnProperty.call(effectiveSlotModes, "devToolsDrawer");
    const devToolsVisible = effectiveSlotModes.devToolsDrawer === "visible";

    return (
      <TopBarMenuV1
        state={state}
        hostWorkflow={hostWorkflow}
        showDevToolsButton={showDevToolsButton}
        devToolsVisible={devToolsVisible}
        onToggleDevTools={() => {
          if (!showDevToolsButton) {
            return;
          }

          onSlotModeOverrideChange("devToolsDrawer", devToolsVisible ? "hidden" : "visible");
        }}
      />
    );
  }

  if (!slot.featureKey) {
    return null;
  }

  if (slot.featureKey === "authSignIn") {
    return (
      <AuthSignInV1
        hostWorkflow={hostWorkflow}
        orientation={slot.implementationOrientation ?? "vertical"}
        density={slot.implementationDensity ?? "regular"}
      />
    );
  }

  if (slot.featureKey === "identityBootstrapStatus") {
    return <IdentityBootstrapStatusV1 hostWorkflow={hostWorkflow} />;
  }

  if (slot.featureKey === "gameDiscovery") {
    return (
      <GameDiscoveryV1
        hostWorkflow={hostWorkflow}
        orientation={slot.implementationOrientation ?? "vertical"}
        density={slot.implementationDensity ?? "regular"}
      />
    );
  }

  if (slot.featureKey === "gameDetails") {
    return <GameDetailsV1 hostWorkflow={hostWorkflow} />;
  }

  if (slot.featureKey === "commandHandler") {
    return (
      <CommandHandlerV1
        hostWorkflow={hostWorkflow}
        orientation={slot.implementationOrientation ?? "vertical"}
        density={slot.implementationDensity ?? "regular"}
        onCommandSubmitCompleted={onCommandSubmitCompleted}
      />
    );
  }

  if (slot.featureKey === "sessionPlaySurface") {
    return <SessionPlaySurfaceHostV1 hostWorkflow={hostWorkflow} />;
  }

  if (slot.featureKey === "inGameToolsMenu") {
    return (
      <InGameToolsMenuHostV1
        hostWorkflow={hostWorkflow}
        orientation={slot.implementationOrientation ?? "vertical"}
        density={slot.implementationDensity ?? "regular"}
      />
    );
  }

  if (slot.featureKey === "interruptionRecovery") {
    return <InterruptionRecoveryV1 hostWorkflow={hostWorkflow} />;
  }

  if (slot.featureKey === "globalStatus") {
    return <StatusBarInfoV1 state={state} hostWorkflow={hostWorkflow} />;
  }

  if (slot.featureKey === "diagnosticsConsole") {
    return (
      <DiagnosticsConsoleComponent
        enabled={diagnosticsEnabled}
        entries={diagnosticsEntries}
        categoryFilters={diagnosticsCategoryFilters}
        exportMetadata={diagnosticsExportMetadata}
        onClear={onClearDiagnostics}
      />
    );
  }

  if (slot.featureKey === "devToolsPanel") {
    return (
      <DevToolsPanelComponent
        diagnosticsEnabled={diagnosticsEnabled}
        diagnosticsVerbose={diagnosticsVerbose}
        hostApiBaseUrlOverride={hostApiBaseUrlOverride}
        maxDiagnosticsEntries={maxDiagnosticsEntries}
        diagnosticsCategoryOptions={diagnosticsCategoryOptions}
        diagnosticsWorkspace={diagnosticsWorkspace}
        pollIntervalMs={pollIntervalMs}
        heartbeatEveryNPolls={heartbeatEveryNPolls}
        onDiagnosticsEnabledChange={onDiagnosticsEnabledChange}
        onDiagnosticsVerboseChange={onDiagnosticsVerboseChange}
        onHostApiBaseUrlOverrideChange={onHostApiBaseUrlOverrideChange}
        onMaxDiagnosticsEntriesChange={onMaxDiagnosticsEntriesChange}
        onDiagnosticsCategoryEnabledChange={onDiagnosticsCategoryEnabledChange}
        onSetAllDiagnosticsCategoriesEnabled={onSetAllDiagnosticsCategoriesEnabled}
        onPollIntervalMsChange={onPollIntervalMsChange}
        onHeartbeatEveryNPollsChange={onHeartbeatEveryNPollsChange}
        slotModeOverrides={slotModeOverrides}
        onSlotModeOverrideChange={onSlotModeOverrideChange}
        effectiveSlotModes={effectiveSlotModes}
        allowedSlotModes={allowedSlotModes}
        showSlotTechnicalDetailsDefault={showSlotTechnicalDetailsDefault}
        onShowSlotTechnicalDetailsDefaultChange={onShowSlotTechnicalDetailsDefaultChange}
        slotTechnicalDetailsOverrides={slotTechnicalDetailsOverrides}
        onSlotTechnicalDetailsOverrideChange={onSlotTechnicalDetailsOverrideChange}
        showInspectorToggle={showInspectorToggle}
        onShowInspectorToggleChange={onShowInspectorToggleChange}
        themeColorValues={themeColorValues}
        onThemeColorChange={onThemeColorChange}
        onThemeColorsReset={onThemeColorsReset}
        themeTypographyValues={themeTypographyValues}
        onThemeTypographyChange={onThemeTypographyChange}
        onThemeTypographyReset={onThemeTypographyReset}
        previewContext={previewContext}
        cacheStats={hostWorkflow.cacheStats}
        onResetCacheStats={hostWorkflow.resetCacheStats}
        onClearMemoryCache={hostWorkflow.clearMemoryCache}
        onClearPersistentCache={hostWorkflow.clearPersistentCache}
        audioUnlockRequired={hostWorkflow.audioUnlockRequired}
        onAudioUnlockRequiredChange={hostWorkflow.setAudioUnlockRequired}
        soundCueStatus={hostWorkflow.soundCueStatus}
        onRequestAudioUnlock={hostWorkflow.requestAudioUnlock}
        sfxMuted={hostWorkflow.sfxMuted}
        onSfxMutedChange={hostWorkflow.setSfxMuted}
        sfxVolumePercent={hostWorkflow.sfxVolumePercent}
        onSfxVolumePercentChange={hostWorkflow.setSfxVolumePercent}
        ambientMuted={hostWorkflow.ambientMuted}
        onAmbientMutedChange={hostWorkflow.setAmbientMuted}
        ambientVolumePercent={hostWorkflow.ambientVolumePercent}
        onAmbientVolumePercentChange={hostWorkflow.setAmbientVolumePercent}
        presentationIsolationSettings={hostWorkflow.presentationIsolationSettings}
        presentationIsolationCategoryOptions={hostWorkflow.presentationIsolationCategoryOptions}
        onPresentationIsolationEnabledChange={hostWorkflow.setPresentationIsolationEnabled}
        onPresentationIsolationCategoryEnabledChange={(category: PresentationIsolationCategory, enabled: boolean) => {
          hostWorkflow.setPresentationIsolationCategoryEnabled(category, enabled);
        }}
        roomTransitionCueOptions={hostWorkflow.roomTransitionCueOptions}
        selectedRoomTransitionCueEffectKey={hostWorkflow.selectedRoomTransitionCueEffectKey}
        onSelectedRoomTransitionCueEffectKeyChange={hostWorkflow.setSelectedRoomTransitionCueEffectKey}
        roomTransitionCatalogStatus={hostWorkflow.roomTransitionCatalogStatus}
      />
    );
  }

  return null;
}
