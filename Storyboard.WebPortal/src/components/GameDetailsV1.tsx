import { useEffect, useState, type JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { HostGameDetailsDescriptor } from "../hostApi/HostContracts";

export type GameDetailsWorkflow = Pick<
  HostWorkflowState,
  | "credentialHandle"
  | "selectedGameId"
  | "selectedGameKey"
  | "activeSessionId"
  | "fetchGameDetails"
  | "fetchGamePreviewImageDataUrl"
>;

export interface GameDetailsV1Props {
  hostWorkflow: GameDetailsWorkflow;
}

export function GameDetailsV1(props: GameDetailsV1Props): JSX.Element {
  const { hostWorkflow } = props;
  const [details, setDetails] = useState<HostGameDetailsDescriptor | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!hostWorkflow.credentialHandle || !hostWorkflow.selectedGameId) {
      setDetails(null);
      setPreviewUrl("");
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      const gameDetails = await hostWorkflow.fetchGameDetails(hostWorkflow.selectedGameId, hostWorkflow.selectedGameKey);
      if (cancelled) {
        return;
      }

      setDetails(gameDetails);

      const firstPreview = gameDetails?.previewImages[0] || "";
      if (!firstPreview) {
        setPreviewUrl("");
        setLoading(false);
        return;
      }

      const resolvedPreview = await hostWorkflow.fetchGamePreviewImageDataUrl(
        firstPreview,
        hostWorkflow.selectedGameId,
        hostWorkflow.selectedGameKey
      );
      if (cancelled) {
        return;
      }

      setPreviewUrl(resolvedPreview || "");
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    hostWorkflow.credentialHandle,
    hostWorkflow.selectedGameId,
    hostWorkflow.selectedGameKey
  ]);

  if (!hostWorkflow.selectedGameId && !hostWorkflow.selectedGameKey) {
    return (
      <section className="config-feature-placeholder">
        <h4>Game Details</h4>
        <p>Select a game from the discovery list to view details.</p>
      </section>
    );
  }

  return (
    <section className="config-feature-placeholder">
      <h4>Game Details</h4>
      <p>gameId: {hostWorkflow.selectedGameId || "(none)"}</p>
      <p>gameKey: {hostWorkflow.selectedGameKey || "(none)"}</p>
      <p>activeSessionId: {hostWorkflow.activeSessionId || "(none)"}</p>
      {loading ? <p className="game-discovery-summary">Loading selected game details...</p> : null}
      {details ? (
        <>
          <p><strong>{details.displayName || details.gameKey}</strong></p>
          {details.summary ? <p className="game-discovery-summary">{details.summary}</p> : null}
          {previewUrl ? <img className="game-discovery-preview" src={previewUrl} alt={`${details.displayName || details.gameKey} preview`} /> : null}
        </>
      ) : null}
    </section>
  );
}
