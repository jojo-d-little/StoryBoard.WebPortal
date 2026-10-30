import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { HostSessionPresentationData } from "../../hostApi/HostContracts";
import { HostApiClient } from "../../hostApi/client";
import { SessionPlaySurfaceRendererV1 } from "../../components/SessionPlaySurfaceRendererV1";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS, type GameRenderSceneSnapshot } from "../index";
import type { PresentationCueCatalogDocument } from "../contracts/presentationEffects";
import { useHostRendererSessionWorkflow } from "../../hooks/useHostRendererSessionWorkflow";
import samplePresentationCatalog from "../../../visual-tests/fixtures/lighting-effects-save-restore/presentation-effects.catalog.json";

declare global { interface Window { __hostRestoreHarness?: { scene: GameRenderSceneSnapshot | null; revision: number; customImage?: string | null } } }

const client = new HostApiClient({ baseUrl: window.location.origin });
const catalog = {
  effects: samplePresentationCatalog.effects as PresentationCueCatalogDocument["effects"]
} satisfies PresentationCueCatalogDocument;
function Harness(): JSX.Element {
  const [scene, setScene] = useState<GameRenderSceneSnapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [customImage, setCustomImage] = useState<string | null>();
  window.__hostRestoreHarness = { scene, revision, customImage };
  const noop = useCallback(() => undefined, []);
  const workflow = useHostRendererSessionWorkflow({
    hostApiClient: client, credentialHandle: "fixture-credential", activeSessionId: "fixture-session",
    selectedGameId: "fixture-game", selectedGameKey: "lighting-effects-fixture",
    presentationCueCatalogRevision: 1, rendererSceneSnapshot: scene, setRendererSceneSnapshot: (next) => { setScene(next); window.__hostRestoreHarness = { scene: next, revision: window.__hostRestoreHarness?.revision ?? 0 }; },
    applyPresentationCues: (value) => value, getCurrentPresentationCueCatalog: () => catalog,
    ensurePresentationCueCatalogReady: async () => catalog, presentationCueCatalogSource: "cache",
    particleAssetWarmupEnabled: false, getHudOverlayEntries: () => [], pollIntervalMs: 100, heartbeatEveryNPolls: 1,
    sessionDeltaResetEpoch: 0, consumeSessionDeltaPhasePresentation: (_data: HostSessionPresentationData) => undefined,
    consumeSessionDeltaEcho: noop, consumeSessionDeltaSoundCues: noop, refreshCacheStats: noop, addDiagnostic: noop
  });
  const updateRevision = (): void => { setRevision((value) => value + 1); };
  window.__hostRestoreHarness = { scene, revision, customImage };
  return <main style={{ width: 800, height: 600 }}>
    <style>{`.session-play-surface-v1, .session-play-surface-v1__stage { width: 800px; height: 600px; overflow: hidden; }`}</style>
    <button data-testid="apply-altered" onClick={updateRevision}>Apply altered Host delta</button>
    <button data-testid="restore" onClick={updateRevision}>Consume restored baseline</button>
    <button data-testid="ordinary-delta" onClick={updateRevision}>Apply ordinary delta</button>
    <button data-testid="load-custom-image" onClick={() => {
      const locator = scene?.particleEffectImageMappings?.find((mapping) => mapping.effectKey === "particle.candle" && mapping.imageSlot === "flame-tip")?.relativeLocator;
      if (!locator) { setCustomImage("missing-restored-mapping"); return; }
      void workflow.loadParticleEffectImage(locator).then(setCustomImage).catch((error: unknown) => setCustomImage(`error:${String(error)}`));
    }}>Load Host custom image</button>
    <span data-testid="delta-revision">{workflow.sessionDeltaRevision}:{revision}</span>
    <SessionPlaySurfaceRendererV1 activeSessionId="fixture-session" sceneSnapshot={scene}
      loadParticleEffectImage={workflow.loadParticleEffectImage} presentationIsolationSettings={DEFAULT_PRESENTATION_ISOLATION_SETTINGS}
      roomTransitionPreparationEpoch={0} gameplayInteractionSubstate="DefaultClick" waypointDraftCount={0}
      waypointPointPlacementCueStyle={null} hasManualDismissHudOverlay={false} onDismissHudOverlay={noop}
      onRegisterWaypointInteractionRendererBridge={noop} onReportRendererDiagnostic={noop} onReportRoomTransitionState={workflow.reportRoomTransitionState}
      onReportRendererScaleMetrics={noop} onReportRendererLastClickPoint={noop} onWaypointPointSelected={noop} onCommandPointSelected={noop} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
