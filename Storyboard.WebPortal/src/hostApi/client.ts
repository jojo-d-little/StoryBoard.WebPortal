import type {
  HostAuthenticateRequest,
  HostAuthenticateResponse,
  HostCommandMoveLegTelemetry,
  HostCommandSoundCue,
  HostCommandSoundCueOperation,
  HostClarificationAnswer,
  HostClarificationCandidate,
  HostGameDiagnosticsLevel,
  HostPendingClarificationRequest,
  HostProcessCommandResult,
  HostRuntimePresentationBaseline,
  HostSoundEffectLane,
  HostSoundEffectReplayPolicy,
  HostSoundEffectRepeatMode,
  HostSessionDataEnvelope,
  HostSessionDeltaBatchProfile,
  HostSessionDeltaPollResponse,
  HostSessionDeltaPollResultCode,
  HostDiscoverGamesRequest,
  HostCurrentPrincipalResponse,
  HostDiscoverGamesResponse,
  HostDiscoveredGame,
  HostGameDetailsDescriptor,
  HostGetGameDetailsResponse,
  HostGetCurrentPrincipalRequest,
  HostJoinSessionRequest,
  HostJoinSessionResponse,
  HostLeaveSessionRequest,
  HostLeaveSessionResponse,
  HostListSessionsRequest,
  HostListSessionsResponse,
  HostRenderableImage,
  HostRequestContext,
  HostSessionDescriptor,
  HostStartSessionRequest,
  HostStartSessionResponse,
  HostResultEnvelope
} from "./HostContracts";

export interface HostApiClientOptions {
  baseUrl?: string;
  tenantId?: string;
  orgId?: string;
  onTraceEvent?: (event: HostApiTraceEvent) => void;
}

export interface HostApiTraceEvent {
  phase: "completed" | "failed";
  method: "POST";
  path: string;
  durationMs: number;
  status?: number;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  gameId?: string;
  details?: Record<string, unknown>;
}

const defaultBaseUrl = (import.meta.env.VITE_HOST_API_BASE_URL as string | undefined) || window.location.origin;
type HostRoomTravelDirection = NonNullable<HostSessionDataEnvelope["roomChange"]>["travelDirection"];

export class HostApiClient {
  private readonly baseUrl: string;
  private readonly tenantId: string;
  private readonly orgId: string;
  private readonly onTraceEvent?: (event: HostApiTraceEvent) => void;

  constructor(options?: HostApiClientOptions) {
    this.baseUrl = options?.baseUrl || defaultBaseUrl;
    this.tenantId = options?.tenantId || "local-tenant";
    this.orgId = options?.orgId || "local-org";
    this.onTraceEvent = options?.onTraceEvent;
  }

  async authenticate(username: string, password: string): Promise<HostAuthenticateResponse> {
    const payload: HostAuthenticateRequest = {
      context: this.buildContext("webportal-authenticate"),
      username,
      password,
      bearerToken: ""
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/identity/authenticate", payload);
    const result = this.readResult(data);

    return {
      result,
      principalName: this.readString(this.readObject(data, ["principal", "Principal"]), ["username", "Username"]),
      credentialHandle: this.readString(data, ["credentialHandle", "CredentialHandle"])
    };
  }

  async getCurrentPrincipal(credentialHandle: string): Promise<HostCurrentPrincipalResponse> {
    const payload: HostGetCurrentPrincipalRequest = {
      context: this.buildContext("webportal-current-principal", credentialHandle),
      credentialHandle
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/identity/current-principal", payload);
    const result = this.readResult(data);

    return {
      result,
      principalName: this.readString(this.readObject(data, ["principal", "Principal"]), ["username", "Username"])
    };
  }

  async discoverGames(credentialHandle: string, searchText = "", maxItems = 25): Promise<HostDiscoverGamesResponse> {
    const payload: HostDiscoverGamesRequest = {
      context: this.buildContext("webportal-discover-games", credentialHandle),
      searchText,
      maxItems
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/discovery/games", payload);
    const result = this.readResult(data);
    const gamesRaw = this.readArray(data, ["games", "Games"]);

    return {
      result,
      totalAvailableCount: this.readNumber(data, ["totalAvailableCount", "TotalAvailableCount"]),
      games: gamesRaw.map((game) => this.readDiscoveredGame(game))
    };
  }

  async getGameDetails(credentialHandle: string, gameId: string, gameKey = ""): Promise<HostGetGameDetailsResponse> {
    const payload = {
      context: this.buildContext("webportal-game-details", credentialHandle),
      gameId,
      gameKey
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/discovery/game-details", payload);
    const result = this.readResult(data);
    const gameRaw = this.readObject(data, ["game", "Game"]);

    return {
      result,
      game: Object.keys(gameRaw).length > 0 ? this.readGameDetailsDescriptor(gameRaw) : null
    };
  }

  async getAssetPreviewDataUrl(
    credentialHandle: string,
    relativeLocator: string,
    gameId = "",
    gameKey = ""
  ): Promise<string | null> {
    const payload = {
      context: this.buildContext("webportal-get-asset", credentialHandle),
      gameId: gameId || null,
      gameKey,
      relativeLocator,
      locatorHint: relativeLocator,
      ifNoneMatchContentHash: "",
      ifNoneMatchETag: ""
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/assets/get", payload, {
      assetPath: relativeLocator,
      assetRequestKind: "preview"
    });
    const result = this.readResult(data);
    if (!result.success) {
      return null;
    }

    const contentType = this.readString(data, ["contentType", "ContentType"]);
    const payloadBytes = this.readString(data, ["payloadBytes", "PayloadBytes"]);
    if (!contentType || !payloadBytes) {
      return null;
    }

    return `data:${contentType};base64,${payloadBytes}`;
  }

  async getAssetText(
    credentialHandle: string,
    relativeLocator: string,
    gameId = "",
    gameKey = ""
  ): Promise<{ contentType: string; text: string } | null> {
    const payload = {
      context: this.buildContext("webportal-get-asset", credentialHandle),
      gameId: gameId || null,
      gameKey,
      relativeLocator,
      locatorHint: relativeLocator,
      ifNoneMatchContentHash: "",
      ifNoneMatchETag: ""
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/assets/get", payload, {
      assetPath: relativeLocator,
      assetRequestKind: "text"
    });
    const result = this.readResult(data);
    if (!result.success) {
      return null;
    }

    const contentType = this.readString(data, ["contentType", "ContentType"]);
    const payloadBytes = this.readString(data, ["payloadBytes", "PayloadBytes"]);
    if (!contentType || !payloadBytes) {
      return null;
    }

    return {
      contentType,
      text: this.decodeBase64Utf8(payloadBytes)
    };
  }

  async getAssetJson<T>(
    credentialHandle: string,
    relativeLocator: string,
    gameId = "",
    gameKey = ""
  ): Promise<T | null> {
    const textPayload = await this.getAssetText(credentialHandle, relativeLocator, gameId, gameKey);
    if (!textPayload) {
      return null;
    }

    try {
      return JSON.parse(textPayload.text) as T;
    } catch {
      return null;
    }
  }

  async startSession(
    credentialHandle: string,
    gameId: string,
    gameKey: string,
    requestedSessionName: string,
    requestedJoinPolicy: string
  ): Promise<HostStartSessionResponse> {
    const payload: HostStartSessionRequest = {
      context: this.buildContext("webportal-start-session", credentialHandle),
      gameId,
      gameKey,
      requestedSessionName,
      requestedJoinPolicy
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/session/start", payload);
    const result = this.readResult(data);

    return {
      result,
      created: this.readBoolean(data, ["created", "Created"]),
      session: this.readOptionalSessionDescriptor(data, ["session", "Session"])
    };
  }

  async listSessions(
    credentialHandle: string,
    options?: {
      gameId?: string;
      gameKey?: string;
      includeOwnOnly?: boolean;
      includeJoinableOnly?: boolean;
      maxItems?: number;
    }
  ): Promise<HostListSessionsResponse> {
    const payload: HostListSessionsRequest = {
      context: this.buildContext("webportal-list-sessions", credentialHandle),
      gameId: options?.gameId || "00000000-0000-0000-0000-000000000000",
      gameKey: options?.gameKey || "",
      includeOwnOnly: options?.includeOwnOnly ?? false,
      includeJoinableOnly: options?.includeJoinableOnly ?? true,
      maxItems: options?.maxItems ?? 25
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/session/list", payload);
    const result = this.readResult(data);
    const sessionsRaw = this.readArray(data, ["sessions", "Sessions"]);

    return {
      result,
      totalAvailableCount: this.readNumber(data, ["totalAvailableCount", "TotalAvailableCount"]),
      sessions: sessionsRaw.map((session) => this.readSessionDescriptor(session))
    };
  }

  async joinSession(
    credentialHandle: string,
    sessionId: string,
    inviteCode = "",
    requestOwnerApproval = false
  ): Promise<HostJoinSessionResponse> {
    const payload: HostJoinSessionRequest = {
      context: this.buildContext("webportal-join-session", credentialHandle, sessionId),
      sessionId,
      inviteCode,
      requestOwnerApproval
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/session/join", payload);
    const result = this.readResult(data);

    return {
      result,
      joined: this.readBoolean(data, ["joined", "Joined"]),
      session: this.readOptionalSessionDescriptor(data, ["session", "Session"])
    };
  }

  async leaveSession(credentialHandle: string, sessionId: string): Promise<HostLeaveSessionResponse> {
    const payload: HostLeaveSessionRequest = {
      context: this.buildContext("webportal-leave-session", credentialHandle, sessionId),
      sessionId
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/session/leave", payload);
    const result = this.readResult(data);

    return {
      result,
      sessionId: this.readString(data, ["sessionId", "SessionId"]),
      left: this.readBoolean(data, ["left", "Left"])
    };
  }

  async processCommand(
    credentialHandle: string,
    sessionId: string,
    commandCorrelationId: number,
    rawCommandText: string,
    clarificationAnswers: HostClarificationAnswer[] = [],
    diagnosticsLevel: HostGameDiagnosticsLevel = "None"
  ): Promise<HostProcessCommandResult> {
    const payload = {
      context: this.buildContext("webportal-process-command", credentialHandle, sessionId),
      commandCorrelationId,
      rawCommandText,
      diagnosticsLevel,
      clarificationAnswers
    };

    const data = await this.postJson<Record<string, unknown>>("/api/v1/runtime/process-command", payload);
    return this.readProcessCommandResult(data, rawCommandText, commandCorrelationId);
  }

  async getSessionDeltas(
    credentialHandle: string,
    sessionId: string,
    watermark: string,
    batchProfile: HostSessionDeltaBatchProfile
  ): Promise<HostSessionDeltaPollResponse> {
    const context = this.buildContext("webportal-session-deltas", credentialHandle, sessionId);
    const path = this.buildSessionDeltaPath("/api/v1/session/deltas", watermark, batchProfile);
    const data = await this.postJson<Record<string, unknown>>(path, context);

    return {
      resultCode: this.readDeltaResultCode(data),
      sessionData: this.readOptionalSessionDataEnvelope(data),
      sessionDeltaWatermark: this.readString(data, ["sessionDeltaWatermark", "SessionDeltaWatermark"]),
      diagnostics: this.readArray(data, ["diagnostics", "Diagnostics"]).map((x) => String(x))
    };
  }

  async getSessionBaseline(
    credentialHandle: string,
    sessionId: string,
    diagnosticsLevel = "None"
  ): Promise<HostRuntimePresentationBaseline> {
    const context = this.buildContext("webportal-session-baseline", credentialHandle, sessionId);
    const path = this.buildSessionBaselinePath("/api/v1/session/baseline", diagnosticsLevel);
    const data = await this.postJson<Record<string, unknown>>(path, context);
    const roomChange = this.readRoomChangeData(data);
    const phaseChange = this.readPhaseChangeData(data);
    const orderedTextPresentationSteps = this.readOrderedTextPresentationSteps(data, phaseChange);
    const authoredRenderWidth = this.readNumber(data, ["authoredRenderWidth", "AuthoredRenderWidth"]);
    const authoredRenderHeight = this.readNumber(data, ["authoredRenderHeight", "AuthoredRenderHeight"]);

    return {
      sessionDeltaWatermark: this.readString(data, ["sessionDeltaWatermark", "SessionDeltaWatermark"]),
      roomChange,
      phaseChange,
      soundCues: this.readSoundCues(data),
      orderedTextPresentationSteps,
      authoredRenderWidth,
      authoredRenderHeight
    };
  }

  private async postJson<T>(
    path: string,
    payload: unknown,
    traceDetails?: Record<string, unknown>
  ): Promise<T> {
    const context = this.readTraceContext(payload);
    const payloadRecord = this.asRecord(payload);
    const startedAtMs = Date.now();
    let traceEmitted = false;

    const emitTrace = (phase: HostApiTraceEvent["phase"], status?: number, details?: Record<string, unknown>): void => {
      traceEmitted = true;
      this.onTraceEvent?.({
        phase,
        method: "POST",
        path,
        durationMs: Math.max(0, Date.now() - startedAtMs),
        ...(status !== undefined ? { status } : {}),
        ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
        ...this.readOptionalTraceIdentity(payloadRecord),
        ...(details ? { details } : {})
      });
    };

    try {
      const response = await fetch(new URL(path, this.baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(context?.correlationId ? { "X-Correlation-Id": context.correlationId } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`Host API call failed (${response.status}) for ${path}.`);
        emitTrace("failed", response.status, { ...traceDetails, message: error.message });
        throw error;
      }

      const data = (await response.json()) as T;
      emitTrace("completed", response.status, traceDetails);
      return data;
    } catch (error) {
      if (!traceEmitted) {
        emitTrace("failed", undefined, {
          ...traceDetails,
          message: error instanceof Error ? error.message : String(error)
        });
      }

      throw error;
    }
  }

  private buildContext(_operationName: string, principalHandle = "", sessionId: string | null = null): HostRequestContext {
    const requestId = this.generateUuid();

    return {
      requestId,
      correlationId: this.generateUuid(),
      principalHandle,
      tenantId: this.tenantId,
      orgId: this.orgId,
      sessionId,
      clientSentUtc: new Date().toISOString(),
      idempotencyKey: requestId,
      traceFlags: ""
    };
  }

  private readTraceContext(input: unknown): {
    requestId: string;
    correlationId: string;
    sessionId: string;
  } | null {
    const record = this.asRecord(input);
    const nestedContext = this.readObject(record, ["context", "Context"]);
    const context = Object.keys(nestedContext).length > 0 ? nestedContext : record;
    const requestId = this.readString(context, ["requestId", "RequestId"]);
    const correlationId = this.readString(context, ["correlationId", "CorrelationId"]);
    const sessionId = this.readString(context, ["sessionId", "SessionId"]);

    if (!requestId || !correlationId) {
      return null;
    }

    return { requestId, correlationId, sessionId };
  }

  private readOptionalTraceIdentity(input: Record<string, unknown>): { gameId?: string } {
    const gameId = this.readString(input, ["gameId", "GameId"]);
    return gameId ? { gameId } : {};
  }

  private generateUuid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private readDiscoveredGame(input: unknown): HostDiscoveredGame {
    const game = this.asRecord(input);

    return {
      gameId: this.readString(game, ["gameId", "GameId"]),
      gameKey: this.readString(game, ["gameKey", "GameKey"]),
      displayName: this.readString(game, ["displayName", "DisplayName"]),
      description: this.readString(game, ["description", "Description"])
    };
  }

  private readGameDetailsDescriptor(input: unknown): HostGameDetailsDescriptor {
    const game = this.asRecord(input);
    const access = this.readObject(game, ["access", "Access"]);

    return {
      gameId: this.readString(game, ["gameId", "GameId"]),
      gameKey: this.readString(game, ["gameKey", "GameKey"]),
      displayName: this.readString(game, ["displayName", "DisplayName"]),
      summary: this.readString(game, ["summary", "Summary"]),
      access: {
        canView: this.readBoolean(access, ["canView", "CanView"]),
        canStartSession: this.readBoolean(access, ["canStartSession", "CanStartSession"]),
        denialCode: this.readString(access, ["denialCode", "DenialCode"]),
        denialMessage: this.readString(access, ["denialMessage", "DenialMessage"])
      },
      previewImages: this.readArray(game, ["previewImages", "PreviewImages"]).map((x) => String(x))
    };
  }

  private readSessionDescriptor(input: unknown): HostSessionDescriptor {
    const session = this.asRecord(input);
    const joinPolicy = this.readObject(session, ["joinPolicy", "JoinPolicy"]);
    const access = this.readObject(session, ["access", "Access"]);
    const membership = this.readObject(session, ["membership", "Membership"]);

    return {
      sessionId: this.readString(session, ["sessionId", "SessionId"]),
      gameId: this.readString(session, ["gameId", "GameId"]),
      gameKey: this.readString(session, ["gameKey", "GameKey"]),
      sessionName: this.readString(session, ["sessionName", "SessionName"]),
      sessionState: this.readString(session, ["sessionState", "SessionState"]),
      ownerPrincipalId: this.readString(session, ["ownerPrincipalId", "OwnerPrincipalId"]),
      joinPolicy: this.readString(joinPolicy, ["policy", "Policy"]),
      canJoin: this.readBoolean(access, ["canJoin", "CanJoin"]),
      canLeave: this.readBoolean(access, ["canLeave", "CanLeave"]),
      isJoined: this.readBoolean(membership, ["isJoined", "IsJoined"]),
      isOwner: this.readBoolean(membership, ["isOwner", "IsOwner"])
    };
  }

  private readOptionalSessionDescriptor(source: unknown, keys: string[]): HostSessionDescriptor | null {
    const session = this.readObject(source, keys);
    const id = this.readString(session, ["sessionId", "SessionId"]);
    if (!id) {
      return null;
    }

    return this.readSessionDescriptor(session);
  }

  private readResult(input: Record<string, unknown>): HostResultEnvelope {
    const result = this.readObject(input, ["result", "Result"]);

    return {
      success: this.readBoolean(result, ["success", "Success"]),
      code: this.readString(result, ["code", "Code"]),
      diagnosticsMessages: this.readArray(result, ["diagnosticsMessages", "DiagnosticsMessages"]).map((x) => String(x))
    };
  }

  private readDeltaResultCode(input: Record<string, unknown>): HostSessionDeltaPollResultCode {
    const raw = this.readString(input, ["resultCode", "ResultCode"]);
    if (raw === "InvalidRequest" || raw === "ResyncRequired" || raw === "Success") {
      return raw;
    }

    return "Success";
  }

  private readOptionalSessionDataEnvelope(input: Record<string, unknown>): HostSessionDataEnvelope | null {
    const sessionData = this.readObject(input, ["sessionData", "SessionData"]);
    const hasSessionData = Object.keys(sessionData).length > 0;
    if (!hasSessionData) {
      return null;
    }

    const phaseChange = this.readPhaseChangeData(sessionData);
    const orderedTextPresentationSteps = this.readOrderedTextPresentationSteps(sessionData, phaseChange);

    return {
      sessionDeltaWatermark: this.readString(sessionData, ["sessionDeltaWatermark", "SessionDeltaWatermark"]),
      roomObjectChanges: this.readRoomObjectChanges(sessionData),
      soundCues: this.readSoundCues(sessionData),
      outputLines: this.readArray(sessionData, ["outputLines", "OutputLines"]).map((x) => String(x)),
      diagnostics: this.readArray(sessionData, ["diagnostics", "Diagnostics"]).map((x) => String(x)),
      roomChange: this.readRoomChangeData(sessionData),
      phaseChange,
      orderedTextPresentationSteps,
      authoredRenderWidth: this.readNumber(sessionData, ["authoredRenderWidth", "AuthoredRenderWidth"]),
      authoredRenderHeight: this.readNumber(sessionData, ["authoredRenderHeight", "AuthoredRenderHeight"]),
      hasRoomChange: Object.keys(this.readObject(sessionData, ["roomChange", "RoomChange"])).length > 0,
      hasPhaseChange: phaseChange !== undefined
    };
  }

  private readMoveLegTelemetry(source: Record<string, unknown>): HostCommandMoveLegTelemetry[] {
    const entries = this.readArray(source, ["moveLegTelemetry", "MoveLegTelemetry"]);
    return entries.map((entry) => {
      const leg = this.asRecord(entry);

      return {
        targetObjectId: this.readOptionalGuidString(leg, ["targetObjectId", "TargetObjectId"]),
        targetObjectName: this.readString(leg, ["targetObjectName", "TargetObjectName"]),
        legIndex: this.readOptionalNonNegativeInt(leg, ["legIndex", "LegIndex"]) ?? 0,
        requestedDirection: this.readString(leg, ["requestedDirection", "RequestedDirection"]),
        requestedDistanceInCells: this.readOptionalNonNegativeInt(leg, ["requestedDistanceInCells", "RequestedDistanceInCells"]) ?? 0,
        appliedDistanceInCells: this.readOptionalNonNegativeInt(leg, ["appliedDistanceInCells", "AppliedDistanceInCells"]) ?? 0,
        success: this.readBoolean(leg, ["success", "Success"]),
        resultCode: this.readString(leg, ["resultCode", "ResultCode"]),
        fromX: this.readOptionalFiniteNumber(leg, ["fromX", "FromX"]),
        fromY: this.readOptionalFiniteNumber(leg, ["fromY", "FromY"]),
        toX: this.readOptionalFiniteNumber(leg, ["toX", "ToX"]),
        toY: this.readOptionalFiniteNumber(leg, ["toY", "ToY"]),
        travelVisualizationMode: this.readTravelVisualizationMode(leg)
      };
    });
  }

  private readTravelVisualizationMode(source: Record<string, unknown>): HostCommandMoveLegTelemetry["travelVisualizationMode"] {
    const raw = this.readString(source, ["travelVisualizationMode", "TravelVisualizationMode"]);
    if (raw === "Direct" || raw === "LegByLeg") {
      return raw;
    }

    const rawNumeric = this.readOptionalNumber(source, ["travelVisualizationMode", "TravelVisualizationMode"]);
    return rawNumeric === 0
      ? "Direct"
      : "LegByLeg";
  }

  private readPhaseChangeData(source: Record<string, unknown>): HostSessionDataEnvelope["phaseChange"] {
    const phaseChange = this.readObject(source, ["phaseChange", "PhaseChange"]);
    if (Object.keys(phaseChange).length === 0) {
      return undefined;
    }

    const oldPhase = this.readPhaseSummary(phaseChange, ["oldPhase", "OldPhase"]);
    const newPhase = this.readPhaseSummary(phaseChange, ["newPhase", "NewPhase"]);

    return {
      reason: this.readString(phaseChange, ["reason", "Reason"]),
      oldPhase,
      newPhase,
      isResume: this.readOptionalBoolean(phaseChange, ["isResume", "IsResume"]),
      changedBook: this.readOptionalBoolean(phaseChange, ["changedBook", "ChangedBook"]),
      changedChapter: this.readOptionalBoolean(phaseChange, ["changedChapter", "ChangedChapter"]),
      changedPage: this.readOptionalBoolean(phaseChange, ["changedPage", "ChangedPage"]),
      orderedTextPresentationSteps: this.readPhaseTextPresentationSteps(phaseChange)
    };
  }

  private readOrderedTextPresentationSteps(
    sessionData: Record<string, unknown>,
    phaseChange: HostSessionDataEnvelope["phaseChange"]
  ): HostSessionDataEnvelope["orderedTextPresentationSteps"] {
    const direct = this.readPhaseTextPresentationSteps(sessionData);
    if (direct.length > 0) {
      return direct;
    }

    if (!phaseChange) {
      return [];
    }

    const phaseChangeRecord = this.readObject(sessionData, ["phaseChange", "PhaseChange"]);
    return this.readPhaseTextPresentationSteps(phaseChangeRecord);
  }

  private readPhaseSummary(source: Record<string, unknown>, keys: string[]): NonNullable<HostSessionDataEnvelope["phaseChange"]>["newPhase"] {
    const phaseSummary = this.readObject(source, keys);
    if (Object.keys(phaseSummary).length === 0) {
      return undefined;
    }

    return {
      phaseId: this.readString(phaseSummary, ["phaseId", "PhaseId"]),
      pathDisplayName: this.readString(phaseSummary, ["pathDisplayName", "PathDisplayName"]),
      book: this.readPhaseNodeSummary(this.readObject(phaseSummary, ["book", "Book"])),
      chapter: this.readPhaseNodeSummary(this.readObject(phaseSummary, ["chapter", "Chapter"])),
      page: this.readPhaseNodeSummary(this.readObject(phaseSummary, ["page", "Page"]))
    };
  }

  private readPhaseNodeSummary(source: Record<string, unknown>): NonNullable<NonNullable<HostSessionDataEnvelope["phaseChange"]>["newPhase"]>["book"] {
    return {
      nodeId: this.readString(source, ["nodeId", "NodeId"]),
      displayName: this.readString(source, ["displayName", "DisplayName"]),
      title: this.readString(source, ["title", "Title"]),
      prologue: this.readString(source, ["prologue", "Prologue"]),
      narrative: this.readString(source, ["narrative", "Narrative"])
    };
  }

  private readPhaseTextPresentationSteps(source: Record<string, unknown>): HostSessionDataEnvelope["orderedTextPresentationSteps"] {
    const entries = this.readArray(source, ["orderedTextPresentationSteps", "OrderedTextPresentationSteps"]);

    return entries.map((entry) => {
      const step = this.asRecord(entry);
      const titleText = this.readOptionalNonEmptyString(step, ["titleText", "TitleText", "headerText", "HeaderText"]);
      const bodyText = this.readOptionalNonEmptyString(step, ["bodyText", "BodyText"])
        ?? this.readString(step, ["text", "Text"]);
      const resolvedEffectKey = this.readOptionalNonEmptyString(step, ["effectKey", "EffectKey", "presentationCueEffectKey", "PresentationCueEffectKey"]);

      return {
        cueType: this.readPresentationCueType(step) ?? "text",
        category: this.readString(step, ["category", "Category"]) || "Text",
        effectKey: resolvedEffectKey ?? "",
        titleText,
        bodyText,
        where: this.readOptionalNonEmptyString(step, ["where", "Where"]),
        how: this.readOptionalNonEmptyString(step, ["how", "How"]),
        dismissMode: this.readOptionalNonEmptyString(step, ["dismissMode", "DismissMode"]),
        displayDurationMs: this.readOptionalNonNegativeInt(step, ["displayDurationMs", "DisplayDurationMs"]),
        durationMs: this.readOptionalNonNegativeInt(step, ["durationMs", "DurationMs"]),
        edgePosition: this.readOptionalNonEmptyString(step, ["edgePosition", "EdgePosition"]),
        backdropMode: this.readOptionalNonEmptyString(step, ["backdropMode", "BackdropMode"]),
        backdropOpacity: this.readOptionalFiniteNumber(step, ["backdropOpacity", "BackdropOpacity"]),
        panelOpacity: this.readOptionalFiniteNumber(step, ["panelOpacity", "PanelOpacity"]),
        panelBorderThicknessPx: this.readOptionalFiniteNumber(step, ["panelBorderThicknessPx", "PanelBorderThicknessPx"]),
        motionInMs: this.readOptionalNonNegativeInt(step, ["motionInMs", "MotionInMs"]),
        motionOutMs: this.readOptionalNonNegativeInt(step, ["motionOutMs", "MotionOutMs"]),
        titleFontSizePx: this.readOptionalFiniteNumber(step, ["titleFontSizePx", "TitleFontSizePx"]),
        bodyFontSizePx: this.readOptionalFiniteNumber(step, ["bodyFontSizePx", "BodyFontSizePx"]),
        scrollSpeedPxPerSec: this.readOptionalFiniteNumber(step, ["scrollSpeedPxPerSec", "ScrollSpeedPxPerSec"]),
        presentationCueEffectKey: resolvedEffectKey
      };
    });
  }

  private readRoomChangeData(source: Record<string, unknown>): HostSessionDataEnvelope["roomChange"] {
    const roomChange = this.readObject(source, ["roomChange", "RoomChange"]);
    const newRoom = this.readObject(roomChange, ["newRoom", "NewRoom"]);
    const directionalRenderableImages = this.readArray(newRoom, ["directionalRenderableImages", "DirectionalRenderableImages"]);
    const renderableRoomObjects = this.readArray(newRoom, ["renderableRoomObjects", "RenderableRoomObjects"]);
    const presentationCues = this.readArray(roomChange, ["presentationCues", "PresentationCues"]);

    if (Object.keys(roomChange).length === 0) {
      return undefined;
    }

    return {
      travelDirection: this.readRoomChangeTravelDirection(roomChange),
      presentationCues: presentationCues.map((cueEntry) => this.readPresentationCue(cueEntry)),
      newRoom: Object.keys(newRoom).length === 0
        ? undefined
        : {
            roomId: this.readString(newRoom, ["roomId", "RoomId"]),
            name: this.readString(newRoom, ["name", "Name"]),
            roomDisplayMode: this.readRoomDisplayMode(newRoom),
            roomImageCanvasWidth: this.readOptionalPositiveInt(newRoom, ["roomImageCanvasWidth", "RoomImageCanvasWidth"]),
            roomImageCanvasHeight: this.readOptionalPositiveInt(newRoom, ["roomImageCanvasHeight", "RoomImageCanvasHeight"]),
            renderableRoomObjects: renderableRoomObjects.map((entry) => {
              const roomObject = this.asRecord(entry);
              const renderableImage = this.readObject(roomObject, ["renderableImage", "RenderableImage"]);

              return {
                objectId: this.readString(roomObject, ["objectId", "ObjectId"]),
                name: this.readString(roomObject, ["name", "Name"]),
                renderableImage: this.readRenderableImage(renderableImage),
                renderZOrder: this.readNumber(roomObject, ["renderZOrder", "RenderZOrder"])
              };
            }),
            directionalRenderableImages: directionalRenderableImages.map((entry) => {
              const directional = this.asRecord(entry);
              const renderableImage = this.readObject(directional, ["renderableImage", "RenderableImage"]);

              return {
                slot: this.readString(directional, ["slot", "Slot"]),
                renderableImage: this.readRenderableImage(renderableImage)
              };
            })
          }
    };
  }

  private readRoomDisplayMode(source: Record<string, unknown>): NonNullable<NonNullable<HostSessionDataEnvelope["roomChange"]>["newRoom"]>["roomDisplayMode"] {
    const rawText = this.readString(source, ["roomDisplayMode", "RoomDisplayMode"]);
    if (rawText === "Independent" || rawText === "Overlay") {
      return rawText;
    }

    const rawNumeric = this.readOptionalNumber(source, ["roomDisplayMode", "RoomDisplayMode"]);
    if (rawNumeric === 0) {
      return 0;
    }

    if (rawNumeric === 1) {
      return 1;
    }

    return "Overlay";
  }

  private readRoomChangeTravelDirection(source: Record<string, unknown>): HostRoomTravelDirection {
    const raw = this.readString(source, ["travelDirection", "TravelDirection"]);
    switch (raw) {
      case "North":
      case "NorthEast":
      case "East":
      case "SouthEast":
      case "South":
      case "SouthWest":
      case "West":
      case "NorthWest":
      case "Up":
      case "Down":
        return raw;
      default:
        break;
    }

    const rawNumeric = this.readOptionalNumber(source, ["travelDirection", "TravelDirection"]);
    switch (rawNumeric) {
      case 0:
        return "North";
      case 1:
        return "NorthEast";
      case 2:
        return "East";
      case 3:
        return "SouthEast";
      case 4:
        return "South";
      case 5:
        return "SouthWest";
      case 6:
        return "West";
      case 7:
        return "NorthWest";
      case 8:
        return "Up";
      case 9:
        return "Down";
      default:
        return undefined;
    }
  }

  private readRoomObjectChanges(source: Record<string, unknown>): HostSessionDataEnvelope["roomObjectChanges"] {
    const changes = this.readArray(source, ["roomObjectChanges", "RoomObjectChanges"]);

    return changes.map((entry) => {
      const change = this.asRecord(entry);
      const renderableRoomObject = this.readObject(change, ["renderableRoomObject", "RenderableRoomObject"]);
      const renderableImage = this.readObject(renderableRoomObject, ["renderableImage", "RenderableImage"]);
      const presentationCues = this.readArray(change, ["presentationCues", "PresentationCues"]);

      const rawKind = this.readString(change, ["changeKind", "ChangeKind"]);
      const changeKind = rawKind === "Added" || rawKind === "Removed" || rawKind === "Updated"
        ? rawKind
        : "Updated";

      return {
        changeKind,
        objectId: this.readString(change, ["objectId", "ObjectId"]),
        objectName: this.readString(change, ["objectName", "ObjectName"]),
        renderableRoomObject: Object.keys(renderableRoomObject).length === 0
          ? undefined
          : {
              objectId: this.readString(renderableRoomObject, ["objectId", "ObjectId"]),
              name: this.readString(renderableRoomObject, ["name", "Name"]),
              renderableImage: this.readRenderableImage(renderableImage),
              renderZOrder: this.readNumber(renderableRoomObject, ["renderZOrder", "RenderZOrder"])
            },
        presentationCues: presentationCues.map((cueEntry) => {
          return this.readPresentationCue(cueEntry);
        }),
        moveLegTelemetry: this.readMoveLegTelemetry(change)
      };
    });
  }

  private readPresentationCue(
    cueEntry: unknown
  ): HostSessionDataEnvelope["roomObjectChanges"][number]["presentationCues"][number] {
    const cue = this.asRecord(cueEntry);
    const movementDurationMs = this.readOptionalNonNegativeInt(cue, ["movementDurationMs", "MovementDurationMs"]);
    const movementFrames = this.readOptionalNonNegativeInt(cue, ["movementFrames", "MovementFrames"]);

    return {
      cueType: this.readPresentationCueType(cue),
      category: this.readString(cue, ["category", "Category"]),
      effectKey: this.readString(cue, ["effectKey", "EffectKey"]),
      moveDirection: this.readMoveDirection(cue),
      movementDurationMs,
      movementFrames
    };
  }

  private readPresentationCueType(source: Record<string, unknown>): HostSessionDataEnvelope["roomObjectChanges"][number]["presentationCues"][number]["cueType"] {
    const raw = this.readString(source, ["$cueType", "cueType", "CueType"]).trim();
    if (
      raw === "movement"
      || raw === "appearance"
      || raw === "disappearance"
      || raw === "text"
      || raw === "roomTransition"
      || raw === "custom"
    ) {
      return raw;
    }

    return undefined;
  }

  private readMoveDirection(source: Record<string, unknown>): HostRoomTravelDirection {
    const raw = this.readString(source, ["moveDirection", "MoveDirection"]);
    switch (raw) {
      case "North":
      case "NorthEast":
      case "East":
      case "SouthEast":
      case "South":
      case "SouthWest":
      case "West":
      case "NorthWest":
      case "Up":
      case "Down":
        return raw;
      default:
        break;
    }

    const rawNumeric = this.readOptionalNumber(source, ["moveDirection", "MoveDirection"]);
    switch (rawNumeric) {
      case 0:
        return "North";
      case 1:
        return "NorthEast";
      case 2:
        return "East";
      case 3:
        return "SouthEast";
      case 4:
        return "South";
      case 5:
        return "SouthWest";
      case 6:
        return "West";
      case 7:
        return "NorthWest";
      case 8:
        return "Up";
      case 9:
        return "Down";
      default:
        return undefined;
    }
  }

  private readSoundCueOperation(source: Record<string, unknown>): HostCommandSoundCueOperation {
    const raw = this.readString(source, ["operation", "Operation"]);
    if (raw === "Cancel") {
      return "Cancel";
    }

    if (raw === "Play") {
      return "Play";
    }

    const rawNumeric = this.readOptionalNumber(source, ["operation", "Operation"]);
    return rawNumeric === 1 ? "Cancel" : "Play";
  }

  private readSoundEffectLane(source: Record<string, unknown>): HostSoundEffectLane {
    const raw = this.readString(source, ["soundEffectLane", "SoundEffectLane"]);
    if (raw === "Ambient") {
      return "Ambient";
    }

    if (raw === "Sfx") {
      return "Sfx";
    }

    const rawNumeric = this.readOptionalNumber(source, ["soundEffectLane", "SoundEffectLane"]);
    return rawNumeric === 1 ? "Ambient" : "Sfx";
  }

  private readSoundEffectRepeatMode(source: Record<string, unknown>): HostSoundEffectRepeatMode {
    const raw = this.readString(source, ["repeatMode", "RepeatMode"]);
    switch (raw) {
      case "RepeatForDuration":
      case "RepeatCount":
      case "UntilCanceled":
      case "None":
        return raw;
      default:
        break;
    }

    const rawNumeric = this.readOptionalNumber(source, ["repeatMode", "RepeatMode"]);
    switch (rawNumeric) {
      case 1:
        return "RepeatForDuration";
      case 2:
        return "RepeatCount";
      case 3:
        return "UntilCanceled";
      default:
        return "None";
    }
  }

  private readSoundEffectReplayPolicy(source: Record<string, unknown>): HostSoundEffectReplayPolicy {
    const raw = this.readString(source, ["replayPolicy", "ReplayPolicy"]);
    switch (raw) {
      case "CancelPreviousAtNextPlay":
      case "IgnoreIfAlreadyPlaying":
      case "PlayAgain":
        return raw;
      default:
        break;
    }

    const rawNumeric = this.readOptionalNumber(source, ["replayPolicy", "ReplayPolicy"]);
    switch (rawNumeric) {
      case 1:
        return "CancelPreviousAtNextPlay";
      case 2:
        return "IgnoreIfAlreadyPlaying";
      default:
        return "PlayAgain";
    }
  }

  private readOptionalGuidString(source: Record<string, unknown>, keys: string[]): string | undefined {
    const value = this.readString(source, keys).trim();
    return value.length > 0
      ? value
      : undefined;
  }

  private readOptionalBoolean(source: Record<string, unknown>, keys: string[]): boolean | undefined {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "boolean") {
        return candidate;
      }
    }

    return undefined;
  }

  private readOptionalNonEmptyString(source: Record<string, unknown>, keys: string[]): string | undefined {
    const value = this.readString(source, keys).trim();
    return value.length > 0
      ? value
      : undefined;
  }

  private readOptionalNonNegativeInt(source: Record<string, unknown>, keys: string[]): number | undefined {
    const value = this.readNumber(source, keys);
    if (!Number.isFinite(value)) {
      return undefined;
    }

    const rounded = Math.round(value);
    return rounded >= 0
      ? rounded
      : undefined;
  }

  private readOptionalPositiveInt(source: Record<string, unknown>, keys: string[]): number | undefined {
    const value = this.readOptionalNonNegativeInt(source, keys);
    if (value === undefined || value <= 0) {
      return undefined;
    }

    return value;
  }

  private readOptionalFiniteNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
    const value = this.readNumber(source, keys);
    return Number.isFinite(value)
      ? Number(value)
      : undefined;
  }

  private readSoundCues(source: Record<string, unknown>): HostCommandSoundCue[] {
    const entries = this.readArray(source, ["soundCues", "SoundCues"]);

    return entries.map((entry) => {
      const cue = this.asRecord(entry);

      return {
        operation: this.readSoundCueOperation(cue),
        soundEffectId: this.readString(cue, ["soundEffectId", "SoundEffectId"]),
        soundEffectLane: this.readSoundEffectLane(cue),
        soundEffectKey: this.readString(cue, ["soundEffectKey", "SoundEffectKey"]),
        runtimeAssetRef: this.readString(cue, ["runtimeAssetRef", "RuntimeAssetRef"]),
        playRequestInstanceId: this.readOptionalGuidString(cue, ["playRequestInstanceId", "PlayRequestInstanceId"]),
        commandCorrelationId: this.readNumber(cue, ["commandCorrelationId", "CommandCorrelationId"]),
        actionId: this.readString(cue, ["actionId", "ActionId"]),
        resultCode: this.readString(cue, ["resultCode", "ResultCode"]),
        sequenceIndex: this.readNumber(cue, ["sequenceIndex", "SequenceIndex"]),
        repeatMode: this.readSoundEffectRepeatMode(cue),
        replayPolicy: this.readSoundEffectReplayPolicy(cue),
        repeatCount: this.readOptionalNonNegativeInt(cue, ["repeatCount", "RepeatCount"]),
        repeatDurationMs: this.readOptionalNonNegativeInt(cue, ["repeatDurationMs", "RepeatDurationMs"]),
        repeatIntervalMs: this.readOptionalNonNegativeInt(cue, ["repeatIntervalMs", "RepeatIntervalMs"]),
        startDelayMs: this.readOptionalNonNegativeInt(cue, ["startDelayMs", "StartDelayMs"]),
        sourceDurationMs: this.readOptionalNonNegativeInt(cue, ["sourceDurationMs", "SourceDurationMs"]),
        maxPlayDurationMs: this.readOptionalNonNegativeInt(cue, ["maxPlayDurationMs", "MaxPlayDurationMs"]),
        repeatCooldownMs: this.readOptionalNonNegativeInt(cue, ["repeatCooldownMs", "RepeatCooldownMs"]),
        baseVolumeDb: this.readOptionalFiniteNumber(cue, ["baseVolumeDb", "BaseVolumeDb"]),
        fadeInMs: this.readOptionalNonNegativeInt(cue, ["fadeInMs", "FadeInMs"]),
        fadeOutMs: this.readOptionalNonNegativeInt(cue, ["fadeOutMs", "FadeOutMs"])
      };
    });
  }

  private readRenderableImage(source: Record<string, unknown>): HostRenderableImage {
    const additionalSituationalScale = this.readOptionalFiniteNumber(source, ["additionalSituationalScale", "AdditionalSituationalScale"]);

    return {
      imagePath: this.readString(source, ["imagePath", "ImagePath"]),
      anchorX: this.readNumber(source, ["anchorX", "AnchorX"]),
      anchorY: this.readNumber(source, ["anchorY", "AnchorY"]),
      iconOffsetX: this.readNumber(source, ["iconOffsetX", "IconOffsetX"]),
      iconOffsetY: this.readNumber(source, ["iconOffsetY", "IconOffsetY"]),
      x: this.readNumber(source, ["x", "X"]),
      y: this.readNumber(source, ["y", "Y"]),
      rotationDegrees: this.readNumber(source, ["rotationDegrees", "RotationDegrees"]),
      scale: this.readNumber(source, ["scale", "Scale"]),
      ...(additionalSituationalScale === undefined ? {} : { additionalSituationalScale })
    };
  }

  private readProcessCommandResult(
    input: Record<string, unknown>,
    fallbackRawCommandText: string,
    fallbackCorrelationId: number
  ): HostProcessCommandResult {
    const resultCode = this.readString(input, ["resultCode", "ResultCode"]);
    const pendingClarification = this.readPendingClarification(input);

    return {
      commandId: this.readString(input, ["commandId", "CommandId"]),
      commandText: this.readString(input, ["commandText", "CommandText"]),
      commandCorrelationId: this.readNumber(input, ["commandCorrelationId", "CommandCorrelationId"]) || fallbackCorrelationId,
      rawCommandText: this.readString(input, ["rawCommandText", "RawCommandText"]) || fallbackRawCommandText,
      resultCode: this.readProcessCommandResultCode(resultCode),
      clarificationRequired: this.readBoolean(input, ["clarificationRequired", "ClarificationRequired"]),
      pendingClarification,
      success: this.readBoolean(input, ["success", "Success"]),
      matchedCommand: this.readBoolean(input, ["matchedCommand", "MatchedCommand"]),
      diagnostics: this.readArray(input, ["diagnostics", "Diagnostics"]).map((x) => String(x))
    };
  }

  private readPendingClarification(input: Record<string, unknown>): HostPendingClarificationRequest | null {
    const pending = this.readObject(input, ["pendingClarification", "PendingClarification"]);
    if (Object.keys(pending).length === 0) {
      return null;
    }

    return {
      slotId: this.readString(pending, ["slotId", "SlotId"]),
      ambiguousPhraseText: this.readString(pending, ["ambiguousPhraseText", "AmbiguousPhraseText"]),
      promptText: this.readString(pending, ["promptText", "PromptText"]),
      candidates: this.readArray(pending, ["candidates", "Candidates"]).map((candidate) => this.readClarificationCandidate(candidate))
    };
  }

  private readClarificationCandidate(input: unknown): HostClarificationCandidate {
    const candidate = this.asRecord(input);
    return {
      objectScopeNodeId: this.readString(candidate, ["objectScopeNodeId", "ObjectScopeNodeId"]),
      displayNameInGame: this.readString(candidate, ["displayNameInGame", "DisplayNameInGame"]),
      candidateScopeParentName: this.readString(candidate, ["candidateScopeParentName", "CandidateScopeParentName"]),
      contextLabel: this.readString(candidate, ["contextLabel", "ContextLabel"])
    };
  }

  private readProcessCommandResultCode(raw: string): HostProcessCommandResult["resultCode"] {
    if (
      raw === "Success"
      || raw === "ClarificationRequired"
      || raw === "NoMatch"
      || raw === "CorrelationIdCommandMismatch"
      || raw === "ClarificationAnswerMismatch"
      || raw === "ClarificationStateStale"
      || raw === "DuplicateCorrelationId"
      || raw === "Failure"
    ) {
      return raw;
    }

    return "Failure";
  }

  private buildSessionDeltaPath(path: string, watermark: string, batchProfile: HostSessionDeltaBatchProfile): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("watermark", watermark);
    url.searchParams.set("batchProfile", batchProfile);
    return url.toString();
  }

  private buildSessionBaselinePath(path: string, diagnosticsLevel: string): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("diagnosticsLevel", diagnosticsLevel);
    return url.toString();
  }

  private readObject(source: unknown, keys: string[]): Record<string, unknown> {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        return candidate as Record<string, unknown>;
      }
    }

    return {};
  }

  private readArray(source: unknown, keys: string[]): unknown[] {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private readString(source: unknown, keys: string[]): string {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "string") {
        return candidate;
      }
    }

    return "";
  }

  private readBoolean(source: unknown, keys: string[]): boolean {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "boolean") {
        return candidate;
      }
    }

    return false;
  }

  private readNumber(source: unknown, keys: string[]): number {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "number") {
        return candidate;
      }
    }

    return 0;
  }

  private readOptionalNumber(source: unknown, keys: string[]): number | undefined {
    const record = this.asRecord(source);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private asRecord(input: unknown): Record<string, unknown> {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }

    return {};
  }

  private decodeBase64Utf8(base64Value: string): string {
    const binary = atob(base64Value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
}
