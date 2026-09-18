import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";
import type { HostGameDetailsDescriptor } from "../hostApi/HostContracts";
import type { FeatureRenderDensity, FeatureRenderOrientation } from "../orchestration/types";

type DiscoveryViewMode = "games" | "sessions";

export type GameDiscoveryWorkflow = Pick<
  HostWorkflowState,
  "hostBusy"
  | "credentialHandle"
  | "fetchDiscoveredGames"
  | "fetchGameDetails"
  | "fetchGamePreviewImageDataUrl"
  | "startSessionFromSelectedGame"
  | "startSessionForGame"
  | "listHostSessions"
  | "sessions"
  | "joinSessionById"
  | "selectedGameId"
  | "selectedGameKey"
  | "setSelectedGame"
  | "discoverGames"
>;

export interface GameDiscoveryV1Props {
  hostWorkflow: GameDiscoveryWorkflow;
  orientation: FeatureRenderOrientation;
  density: FeatureRenderDensity;
}

export function GameDiscoveryV1(props: GameDiscoveryV1Props): JSX.Element {
  const { hostWorkflow, orientation, density } = props;
  const [viewMode, setViewMode] = useState<DiscoveryViewMode>("games");
  const [detailsByGameId, setDetailsByGameId] = useState<Record<string, HostGameDetailsDescriptor>>({});
  const [previewByGameId, setPreviewByGameId] = useState<Record<string, string>>({});
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const hasAutoLoadedRef = useRef<boolean>(false);

  const eventsClassName = orientation === "horizontal"
    ? "events"
    : "events game-discovery-events-vertical";

  const discoveredGames = hostWorkflow.discoverGames;
  const listedSessions = hostWorkflow.sessions;

  const gameRows = useMemo(() => {
    return discoveredGames.map((game) => {
      const details = detailsByGameId[game.gameId];
      const displayName = details?.displayName || game.displayName || game.gameKey;
      const summary = details?.summary || game.description || "";
      const previewImageUrl = previewByGameId[game.gameId] || "";
      const canStart = details?.access?.canStartSession ?? true;
      const isActive = game.gameId === hostWorkflow.selectedGameId
        && game.gameKey === hostWorkflow.selectedGameKey;
      return {
        game,
        displayName,
        summary,
        previewImageUrl,
        canStart,
        isActive
      };
    });
  }, [detailsByGameId, discoveredGames, hostWorkflow.selectedGameId, hostWorkflow.selectedGameKey, previewByGameId]);

  const sessionRows = useMemo(() => {
    return listedSessions.map((session) => {
      const details = detailsByGameId[session.gameId];
      const displayName = details?.displayName || session.gameKey || session.gameId;
      const summary = details?.summary || "";
      const previewImageUrl = previewByGameId[session.gameId] || "";
      const isActive = session.gameId === hostWorkflow.selectedGameId
        && session.gameKey === hostWorkflow.selectedGameKey;
      return {
        session,
        displayName,
        summary,
        previewImageUrl,
        isActive
      };
    });
  }, [detailsByGameId, hostWorkflow.selectedGameId, hostWorkflow.selectedGameKey, listedSessions, previewByGameId]);

  async function refreshDetailsForGames(games: Array<{ gameId: string; gameKey: string }>): Promise<void> {
    if (!hostWorkflow.credentialHandle || games.length === 0) {
      return;
    }

    setDetailsLoading(true);
    const detailUpdates: Record<string, HostGameDetailsDescriptor> = {};
    const previewUpdates: Record<string, string> = {};

    for (const game of games) {
      const details = await hostWorkflow.fetchGameDetails(game.gameId, game.gameKey);
      if (!details) {
        continue;
      }

      detailUpdates[game.gameId] = details;
      const firstPreview = details.previewImages[0] || "";
      if (!firstPreview) {
        continue;
      }

      const previewDataUrl = await hostWorkflow.fetchGamePreviewImageDataUrl(firstPreview, game.gameId, game.gameKey);
      if (previewDataUrl) {
        previewUpdates[game.gameId] = previewDataUrl;
      }
    }

    setDetailsByGameId((previous) => ({ ...previous, ...detailUpdates }));
    setPreviewByGameId((previous) => ({ ...previous, ...previewUpdates }));
    setDetailsLoading(false);
  }

  async function refreshGamesAndDetails(): Promise<void> {
    setViewMode("games");
    await hostWorkflow.fetchDiscoveredGames();
  }

  async function listSessionsAndDetails(): Promise<void> {
    setViewMode("sessions");
    await hostWorkflow.listHostSessions();
  }

  useEffect(() => {
    if (!hostWorkflow.credentialHandle || hasAutoLoadedRef.current) {
      return;
    }

    hasAutoLoadedRef.current = true;
    void refreshGamesAndDetails();
  }, [hostWorkflow.credentialHandle]);

  useEffect(() => {
    if (!hostWorkflow.credentialHandle) {
      setDetailsByGameId({});
      setPreviewByGameId({});
      hasAutoLoadedRef.current = false;
      return;
    }

    if (viewMode === "sessions") {
      const uniqueSessionGames = Array.from(
        new Map(
          listedSessions.map((session) => [
            session.gameId,
            {
              gameId: session.gameId,
              gameKey: session.gameKey
            }
          ])
        ).values()
      );
      void refreshDetailsForGames(uniqueSessionGames);
      return;
    }

    void refreshDetailsForGames(discoveredGames);
  }, [discoveredGames, hostWorkflow.credentialHandle, listedSessions, viewMode]);

  return (
    <section className={`config-feature-placeholder game-discovery game-discovery-${orientation} game-discovery-${density}`}>
      <h4>Game Discovery</h4>
      <div className={eventsClassName}>
        <button type="button" onClick={refreshGamesAndDetails} disabled={hostWorkflow.hostBusy || !hostWorkflow.credentialHandle}>List Games (refresh)</button>
        <button type="button" onClick={listSessionsAndDetails} disabled={hostWorkflow.hostBusy || !hostWorkflow.credentialHandle}>List Sessions</button>
      </div>
      {/*
      <label>
        Start Game
        <select
          value={hostWorkflow.selectedGameId ? `${hostWorkflow.selectedGameId}|${hostWorkflow.selectedGameKey}` : ""}
          onChange={(e) => {
            const [gameId, gameKey] = e.target.value.split("|");
            hostWorkflow.setSelectedGame(gameId || "", gameKey || "");
          }}
          disabled={hostWorkflow.hostBusy || hostWorkflow.discoverGames.length === 0}
        >
          <option value="">(select discovered game)</option>
          {hostWorkflow.discoverGames.map((game) => (
            <option key={`${game.gameId}:${game.gameKey}`} value={`${game.gameId}|${game.gameKey}`}>
              {(detailsByGameId[game.gameId]?.displayName || game.displayName || game.gameKey)}
            </option>
          ))}
        </select>
      </label>
      */}
      {viewMode === "games" && gameRows.length > 0 ? (
        <table className="game-discovery-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Preview</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {gameRows.map((row) => (
              <tr
                key={`${row.game.gameId}:${row.game.gameKey}`}
                className={row.isActive ? "game-discovery-row-active" : undefined}
                onClick={() => {
                  hostWorkflow.setSelectedGame(row.game.gameId, row.game.gameKey);
                }}
              >
                <td>
                  <strong>{row.displayName}</strong>
                  {row.summary ? <div className="game-discovery-summary">{row.summary}</div> : null}
                </td>
                <td>
                  {row.previewImageUrl
                    ? <img className="game-discovery-preview" src={row.previewImageUrl} alt={`${row.displayName} preview`} />
                    : <span className="game-discovery-no-preview">No preview</span>}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      hostWorkflow.setSelectedGame(row.game.gameId, row.game.gameKey);
                      void hostWorkflow.startSessionForGame(row.game.gameId, row.game.gameKey);
                    }}
                    disabled={hostWorkflow.hostBusy || !hostWorkflow.credentialHandle || !row.canStart}
                  >
                    Start Game
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {viewMode === "sessions" && sessionRows.length > 0 ? (
        <table className="game-discovery-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Session</th>
              <th>Preview</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessionRows.map((row) => (
              <tr
                key={row.session.sessionId}
                className={row.isActive ? "game-discovery-row-active" : undefined}
                onClick={() => {
                  hostWorkflow.setSelectedGame(row.session.gameId, row.session.gameKey);
                }}
              >
                <td>
                  <strong>{row.displayName}</strong>
                  {row.summary ? <div className="game-discovery-summary">{row.summary}</div> : null}
                </td>
                <td>
                  <strong>{row.session.sessionName || row.session.sessionId}</strong>
                  <div className="game-discovery-summary">{row.session.sessionState || "unknown"}</div>
                </td>
                <td>
                  {row.previewImageUrl
                    ? <img className="game-discovery-preview" src={row.previewImageUrl} alt={`${row.displayName} preview`} />
                    : <span className="game-discovery-no-preview">No preview</span>}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      hostWorkflow.setSelectedGame(row.session.gameId, row.session.gameKey);
                      void hostWorkflow.joinSessionById(row.session.sessionId);
                    }}
                    disabled={hostWorkflow.hostBusy || !hostWorkflow.credentialHandle || !row.session.canJoin}
                  >
                    Join Game
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {viewMode === "games" && gameRows.length === 0 && !detailsLoading ? <p className="game-discovery-summary">No discovered games.</p> : null}
      {viewMode === "sessions" && sessionRows.length === 0 && !detailsLoading ? <p className="game-discovery-summary">No running sessions.</p> : null}
      {detailsLoading ? <p className="game-discovery-summary">Loading game details...</p> : null}
    </section>
  );
}
