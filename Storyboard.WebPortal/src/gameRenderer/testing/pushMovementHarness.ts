import { createGameRenderer, type GameRendererDiagnosticsEvent, type GameRendererHandle } from "../index";
import type { GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import type { HostCommandMoveLegTelemetry, HostCommandRenderableImage, HostCommandRenderableRoomObject, HostSessionPresentationData } from "../../hostApi/HostContracts";
import { mapHostSessionDataToSceneSnapshot } from "../adapters/mapHostSessionScene";

type PushMode = "Direct" | "LegByLeg";
type HarnessResult = {
  started: boolean;
  completed: boolean;
  objectIds: string[];
  segmentCounts: Record<string, number>;
  trunkScale: number | undefined;
  diagnostics: string[];
};

declare global {
  interface Window {
    __pushMovementHarness?: {
      ready: boolean;
      direct?: HarnessResult;
      legByLeg?: HarnessResult;
      transfer?: {
        roomId: string;
        objectIds: string[];
        segmentKinds: string[];
        trunkScale: number | undefined;
        firstDestinationFrames: Record<string, { x: number; y: number }>;
        intermediateFrames: Record<string, { x: number; y: number }>;
        liveFrames: Record<string, { x: number; y: number }>;
        completedIds: string[];
        completedPositions: Record<string, { x: number; y: number }>;
        lightingDiagnostics?: string[];
        expiryApplied: boolean;
        completedBeforeExpiry: boolean;
      };
    };
  }
}

const ROOM_ID = "push-room-a";
const OBJECTS = ["player", "trunk", "suitcase"] as const;
const OBJECT_COLORS: Record<(typeof OBJECTS)[number], string> = {
  player: "#2563eb",
  trunk: "#c2410c",
  suitcase: "#15803d"
};

function imageDataUrl(objectId: string): string {
  const color = OBJECT_COLORS[objectId as keyof typeof OBJECT_COLORS];
  const label = objectId === "player" ? "P" : objectId === "trunk" ? "T" : "S";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40"><rect x="1" y="1" width="54" height="38" rx="8" fill="${color}" stroke="#111827" stroke-width="2"/><text x="28" y="27" text-anchor="middle" font-family="Segoe UI" font-size="22" font-weight="700" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function transferImageDataUrl(objectId: "player" | "suitcase"): string {
  const svg = objectId === "player"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250"><circle cx="125" cy="125" r="118" fill="#2563eb" stroke="#111827" stroke-width="8"/><text x="125" y="155" text-anchor="middle" font-family="Segoe UI" font-size="100" font-weight="700" fill="white">P</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="360" viewBox="0 0 320 360"><rect x="22" y="38" width="276" height="300" rx="34" fill="#f5c542" stroke="#111827" stroke-width="12"/><path d="M105 38V18Q105 5 120 5H200Q215 5 215 18V38" fill="none" stroke="#111827" stroke-width="14"/><text x="160" y="220" text-anchor="middle" font-family="Segoe UI" font-size="100" font-weight="700" fill="#111827">S</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderableImage(objectId: string, x: number, y: number, rotationDegrees: number, pivotX: number, pivotY: number): HostCommandRenderableImage {
  return {
    imagePath: imageDataUrl(objectId),
    anchorX: x,
    anchorY: y,
    iconOffsetX: 0,
    iconOffsetY: 0,
    situationalScalePivotOffsetXPx: pivotX,
    situationalScalePivotOffsetYPx: pivotY,
    x,
    y,
    rotationDegrees,
    scale: objectId === "trunk" ? 0.8 : 1
  };
}

type ObjectPosition = { x: number; y: number; rotation: number; pivotX?: number; pivotY?: number };
type Positions = Record<(typeof OBJECTS)[number], ObjectPosition>;

const startPositions: Positions = {
  player: { x: 150, y: 190, rotation: 0 },
  trunk: { x: 195, y: 190, rotation: 0, pivotX: -45, pivotY: 0 },
  suitcase: { x: 120, y: 230, rotation: 0, pivotX: 30, pivotY: -40 }
};

const turnPositions: Positions = {
  player: { x: 150, y: 190, rotation: 90 },
  trunk: { x: 150, y: 235, rotation: 0, pivotX: 0, pivotY: -45 },
  suitcase: { x: 110, y: 160, rotation: 0, pivotX: 40, pivotY: 30 }
};

const firstTranslationPositions: Positions = {
  player: { x: 230, y: 190, rotation: 90 },
  trunk: { x: 230, y: 235, rotation: 0, pivotX: 0, pivotY: -45 },
  suitcase: { x: 190, y: 160, rotation: 0, pivotX: 40, pivotY: 30 }
};

const finalPositions: Positions = {
  player: { x: 290, y: 135, rotation: 90 },
  trunk: { x: 290, y: 180, rotation: 0, pivotX: 0, pivotY: -45 },
  suitcase: { x: 250, y: 105, rotation: 0, pivotX: 40, pivotY: 30 }
};

function roomObjects(positions: Positions): HostCommandRenderableRoomObject[] {
  return OBJECTS.map((objectId, index) => {
    const position = positions[objectId];
    return {
      objectId,
      name: objectId[0]!.toUpperCase() + objectId.slice(1),
      renderableImage: renderableImage(objectId, position.x, position.y, position.rotation, position.pivotX ?? 0, position.pivotY ?? 0),
      renderZOrder: index + 10
    };
  });
}

function hostSession(positions: Positions, roomId = ROOM_ID, changes: HostSessionPresentationData["roomObjectChanges"] = []): HostSessionPresentationData {
  return {
    roomChange: {
      newRoom: {
        roomId,
        name: roomId === ROOM_ID ? "Push Room" : "Destination Room",
        roomDisplayMode: "Independent",
        roomImageCanvasWidth: 600,
        roomImageCanvasHeight: 400,
        directionalRenderableImages: [],
        renderableRoomObjects: roomObjects(positions)
      }
    },
    roomObjectChanges: changes,
    activeRoomObjectName: "",
    activeRoomObjectSelectionCueEffectKey: "",
    secondaryActiveRoomObjectName: "",
    secondaryActiveRoomObjectSelectionCueEffectKey: "",
    soundCues: [],
    outputLines: [],
    diagnostics: []
  };
}

function segment(
  objectId: (typeof OBJECTS)[number],
  index: number,
  kind: "Turn" | "Translation",
  startOffsetMs: number,
  durationMs: number,
  fromPosition: ObjectPosition,
  toPosition: ObjectPosition
) {
  return {
    objectId,
    coordinationId: "push-coordination-1",
    segmentIndex: index,
    kind,
    sourceRoomId: ROOM_ID,
    destinationRoomId: ROOM_ID,
    startOffsetMs,
    durationMs,
    ...(kind === "Turn" ? { rotationDeltaDegrees: 90 } : {}),
    fromRenderableImage: renderableImage(objectId, fromPosition.x, fromPosition.y, fromPosition.rotation, fromPosition.pivotX ?? 0, fromPosition.pivotY ?? 0),
    toRenderableImage: renderableImage(objectId, toPosition.x, toPosition.y, toPosition.rotation, toPosition.pivotX ?? 0, toPosition.pivotY ?? 0)
  };
}

function telemetryFor(objectId: (typeof OBJECTS)[number], mode: PushMode): HostCommandMoveLegTelemetry {
  const from = startPositions[objectId];
  const turned = turnPositions[objectId];
  const first = firstTranslationPositions[objectId];
  const last = finalPositions[objectId];
  return {
    targetObjectId: objectId,
    targetObjectName: objectId,
    legIndex: 0,
    requestedDirection: "SouthEast",
    requestedDistanceInCells: 2,
    appliedDistanceInCells: 2,
    success: true,
    resultCode: "Success",
    travelVisualizationMode: mode,
    movementSegments: [
      segment(objectId, 0, "Turn", 0, 800, from, turned),
      segment(objectId, 1, "Translation", 800, 1600, turned, first),
      segment(objectId, 2, "Translation", 2400, 5600, first, last)
    ]
  };
}

function commandDelta(mode: PushMode): HostSessionPresentationData {
  const changes = OBJECTS.map((objectId) => ({
    changeKind: "Updated" as const,
    objectId,
    objectName: objectId,
    fromRenderableObject: roomObjects(startPositions)[OBJECTS.indexOf(objectId)],
    renderableRoomObject: roomObjects(finalPositions)[OBJECTS.indexOf(objectId)],
    moveLegTelemetry: [telemetryFor(objectId, mode)]
  }));
  return hostSession(finalPositions, ROOM_ID, changes);
}

function mappedSegmentCounts(snapshot: GameRenderSceneSnapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const leg of snapshot.moveLegTelemetry ?? []) {
    for (const item of leg.movementSegments ?? []) {
      counts[item.objectId] = (counts[item.objectId] ?? 0) + 1;
    }
  }
  return counts;
}

function startMode(mode: PushMode, mountId: string, publish: (result: HarnessResult) => void): void {
  const mount = document.getElementById(mountId);
  if (!mount) throw new Error(`Missing ${mountId} mount.`);
  const prepared = new Set<string>();
  const diagnostics: string[] = [];
  let started = false;
  let completed = false;
  let renderer: GameRendererHandle;
  const baseline = mapHostSessionDataToSceneSnapshot(hostSession(startPositions))!;
  const delta = mapHostSessionDataToSceneSnapshot(commandDelta(mode))!;
  const result: HarnessResult = {
    started,
    completed,
    objectIds: [...new Set((delta.moveLegTelemetry ?? []).flatMap((leg) => (leg.movementSegments ?? []).map((item) => item.objectId)))],
    segmentCounts: mappedSegmentCounts(delta),
    trunkScale: delta.objectsById.trunk?.sprite?.scale,
    diagnostics
  };

  function publishState(): void {
    result.started = started;
    result.completed = completed;
    publish({ ...result, diagnostics: [...diagnostics], objectIds: [...result.objectIds], segmentCounts: { ...result.segmentCounts } });
  }

  function onDiagnostic(event: GameRendererDiagnosticsEvent): void {
    diagnostics.push(event.message);
    if (event.message === "Room object sprite prepared.") {
      const objectId = (event.details as { objectId?: string } | undefined)?.objectId;
      if (objectId && OBJECTS.includes(objectId as (typeof OBJECTS)[number])) prepared.add(objectId);
      if (!started && prepared.size === OBJECTS.length) {
        started = true;
        publishState();
        renderer.updateScene(delta);
      }
    }
    if (event.message === "Animating room object movement as leg-by-leg sequence.") {
      const details = event.details as { objectId?: string; segmentCount?: number } | undefined;
      if (details?.objectId && Number.isFinite(details.segmentCount)) {
        result.segmentCounts[details.objectId] = Number(details.segmentCount);
        publishState();
      }
    }
    if (event.message === "Room object movement animation completed.") {
      const objectId = (event.details as { objectId?: string } | undefined)?.objectId;
      if (objectId && OBJECTS.includes(objectId as (typeof OBJECTS)[number])) {
        const completedIds = diagnostics.filter((message) => message === "Room object movement animation completed.").length;
        if (completedIds >= OBJECTS.length) completed = true;
        publishState();
      }
    }
  }

  renderer = createGameRenderer(mount, { diagnosticsSink: onDiagnostic });
  renderer.resize(600, 400);
  renderer.updateScene(baseline);
  publishState();
}

type PushMovementHarness = {
  ready: boolean;
  direct?: HarnessResult;
  legByLeg?: HarnessResult;
  transfer?: {
    roomId: string;
    objectIds: string[];
    segmentKinds: string[];
    trunkScale: number | undefined;
    firstDestinationFrames: Record<string, { x: number; y: number }>;
    intermediateFrames: Record<string, { x: number; y: number }>;
    liveFrames: Record<string, { x: number; y: number }>;
    completedIds: string[];
    completedPositions: Record<string, { x: number; y: number }>;
    lightingDiagnostics: string[];
    expiryApplied: boolean;
    completedBeforeExpiry: boolean;
  };
};

const harness: PushMovementHarness = window.__pushMovementHarness = { ready: false };
const query = new URLSearchParams(window.location.search);
const transferOnly = query.get("transferOnly") === "1";
const transferLightingEnabled = query.get("lightingTransfer") === "1";
if (!transferOnly) {
  startMode("Direct", "direct", (value) => { harness.direct = value; });
  startMode("LegByLeg", "leg-by-leg", (value) => { harness.legByLeg = value; });
}
const transferObjects = ["player", "suitcase"] as const;
const transferHostObjectIds = {
  player: "ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b",
  suitcase: "15b418f7-b443-4556-91d0-65fcdcec9c0f"
} as const;
const transferSourceRoomId = "0dd5753d-953c-4a11-9412-d3e110f10af3";
const transferDestinationRoomId = "b4148986-823d-4d9a-832d-f31f60165e79";
const transferCoordinationId = "cd756421-c28b-46aa-a67d-48079b471862";
const transferSourcePositions: Positions = {
  ...startPositions,
  player: { x: 200, y: 480, rotation: 180 },
  suitcase: { x: 160, y: 400, rotation: 0 }
};
const transferSourceExitPositions: Record<(typeof transferObjects)[number], ObjectPosition> = {
  player: { x: 200, y: 80, rotation: 180 },
  suitcase: { x: 160, y: 0, rotation: 0 }
};
const transferArrivalPositions: Record<(typeof transferObjects)[number], ObjectPosition> = {
  player: { x: 200, y: 764, rotation: 180 },
  suitcase: { x: 200, y: 684, rotation: 0 }
};
const transferFinalPositions: Positions = {
  ...finalPositions,
  player: { x: 200, y: 404, rotation: 180 },
  suitcase: { x: 200, y: 324, rotation: 0 }
};
function transferRenderableImage(objectId: (typeof transferObjects)[number], position: ObjectPosition): HostCommandRenderableImage {
  const iconOffsetX = objectId === "player" ? 68 : -18;
  const iconOffsetY = objectId === "player" ? 64 : -45;
  return {
    imagePath: transferImageDataUrl(objectId),
    anchorX: position.x,
    anchorY: position.y,
    iconOffsetX,
    iconOffsetY,
    x: position.x + iconOffsetX,
    y: position.y + iconOffsetY,
    rotationDegrees: position.rotation,
    scale: objectId === "player" ? 0.14 : 0.12,
    additionalSituationalScale: 1
  };
}

function transferRoomObjects(positions: Positions, withLighting = false): HostCommandRenderableRoomObject[] {
  const objects = roomObjects(positions).map((object) => {
    const role = object.objectId as (typeof transferObjects)[number];
    if (!transferObjects.includes(role)) return object;
    const mapped: HostCommandRenderableRoomObject = {
      ...object,
      objectId: transferHostObjectIds[role],
      name: role === "player" ? "Player" : "Yellow SuitCase",
      renderableImage: transferRenderableImage(role, positions[role])
    };
    if (withLighting && role === "suitcase") {
      const isSourceRoomPose = positions.suitcase.x === 160;
      mapped.spatialFootprint = isSourceRoomPose
        ? { cellX: 4, cellY: 10, footprintCenterXpx: 220, footprintCenterYpx: 440, sizeXCells: 3, sizeYCells: 2, cornerStyle: "rounded", elevationCells: 2 }
        : { cellX: 5, cellY: 8, footprintCenterXpx: 260, footprintCenterYpx: 360, sizeXCells: 3, sizeYCells: 2, cornerStyle: "rounded", elevationCells: 2 };
      mapped.lightOcclusion = { strength: 1 };
    }
    return mapped;
  });
  if (withLighting) {
    objects.push({
      objectId: "transfer-room-test-light",
      name: "Transfer Room Test Light",
      renderableImage: {
        imagePath: imageDataUrl("trunk"), anchorX: 80, anchorY: 400, iconOffsetX: 0, iconOffsetY: 0,
        x: 80, y: 400, rotationDegrees: 0, scale: 1
      },
      renderZOrder: 20,
      pointLight: { x: 80, y: 400, radiusPx: 720, intensityScale: 1, color: "#ffffff", lightHeightCells: 4 }
    });
  }
  return objects;
}

function transferSession(positions: Positions, roomId: string, changes: HostSessionPresentationData["roomObjectChanges"] = [], withLighting = false): HostSessionPresentationData {
  const data = hostSession(positions, roomId, changes);
  if (withLighting) data.sessionPresentationSettings = { cellSizePx: 40 };
  if (data.roomChange?.newRoom) {
    data.roomChange.newRoom.renderableRoomObjects = transferRoomObjects(positions, withLighting);
    if (withLighting) data.roomChange.newRoom.ambientLighting = { ambient: 0.1, ambientColor: "#ffffff" };
  }
  return data;
}

const transferSourceSnapshot = mapHostSessionDataToSceneSnapshot(transferSession(transferSourcePositions, transferSourceRoomId, [], transferLightingEnabled))!;
const transferSegmentsByObject = Object.fromEntries(transferObjects.map((objectId) => {
  const source = transferSourceExitPositions[objectId];
  const arrival = transferArrivalPositions[objectId];
  const destination = transferFinalPositions[objectId];
  const image = (position: ObjectPosition) => transferRenderableImage(objectId, position);
  return [objectId, [
    {
      objectId: transferHostObjectIds[objectId], coordinationId: transferCoordinationId, segmentIndex: 0, kind: "Translation" as const,
      sourceRoomId: transferSourceRoomId, destinationRoomId: transferSourceRoomId, startOffsetMs: 0, durationMs: 5000,
      fromRenderableImage: image(transferSourcePositions[objectId]), toRenderableImage: image(source)
    },
    {
      objectId: transferHostObjectIds[objectId], coordinationId: transferCoordinationId, segmentIndex: 2, kind: "RoomTransfer" as const,
      sourceRoomId: transferSourceRoomId, destinationRoomId: transferDestinationRoomId, startOffsetMs: 5000, durationMs: 1,
      fromRenderableImage: image(source), toRenderableImage: image(arrival)
    },
    {
      objectId: transferHostObjectIds[objectId], coordinationId: transferCoordinationId, segmentIndex: 3, kind: "Translation" as const,
      sourceRoomId: transferDestinationRoomId, destinationRoomId: transferDestinationRoomId, startOffsetMs: 5001, durationMs: 4500,
      fromRenderableImage: image(arrival), toRenderableImage: image(destination)
    }
  ]];
})) as Record<(typeof transferObjects)[number], NonNullable<HostCommandMoveLegTelemetry["movementSegments"]>>;
const transferData = transferSession(transferFinalPositions, transferDestinationRoomId, transferObjects.map((objectId) => ({
  changeKind: "Updated" as const,
  objectId: transferHostObjectIds[objectId],
  objectName: objectId === "player" ? "Player" : "Yellow SuitCase",
  fromRenderableObject: transferRoomObjects(transferSourcePositions, transferLightingEnabled).find((object) => object.objectId === transferHostObjectIds[objectId]),
  renderableRoomObject: transferRoomObjects(transferFinalPositions, transferLightingEnabled).find((object) => object.objectId === transferHostObjectIds[objectId]),
  moveLegTelemetry: [{
    targetObjectId: transferHostObjectIds[objectId],
    targetObjectName: objectId === "player" ? "Player" : "Yellow SuitCase",
    legIndex: 0,
    requestedDirection: "North",
    requestedDistanceInCells: 20,
    appliedDistanceInCells: 11,
    success: true,
    resultCode: "MovedPartialDistance",
    travelVisualizationMode: "LegByLeg",
    movementSegments: transferSegmentsByObject[objectId]
  }]
})), transferLightingEnabled);
const transferSnapshot = mapHostSessionDataToSceneSnapshot(transferData, transferSourceSnapshot)!;
transferSnapshot.roomTransition = { mode: "slide", travelDirection: "North", durationMs: 300, cueEffectKey: "push.destination-transfer" };
transferSourceSnapshot.bounds.height = 800;
transferSnapshot.bounds.height = 800;
transferSourceSnapshot.bounds.width = 400;
transferSnapshot.bounds.width = 400;
for (const role of transferObjects) transferSnapshot.objectsById[transferHostObjectIds[role]]!.movementDurationMs = 4500;
const transferTelemetry = transferSnapshot.moveLegTelemetry ?? [];
const transferMount = document.getElementById("transfer-mount");
if (!transferMount) throw new Error("Missing destination-room transfer mount.");
const transferFrames = {
  firstDestinationFrames: {} as Record<string, { x: number; y: number }>,
  intermediateFrames: {} as Record<string, { x: number; y: number }>,
  liveFrames: {} as Record<string, { x: number; y: number }>,
  completedIds: [] as string[],
  completedPositions: {} as Record<string, { x: number; y: number }>,
  lightingDiagnostics: [] as string[],
  expiryApplied: false,
  completedBeforeExpiry: false
};
const transferSourcePrepared = new Set<string>();
let transferStarted = false;
const transferRenderer = createGameRenderer(transferMount, {
  verboseDiagnostics: true,
  diagnosticsSink: (event: GameRendererDiagnosticsEvent) => {
    if (event.level === "warning" && event.message.toLowerCase().includes("lighting")) {
      transferFrames.lightingDiagnostics.push(`${event.message} ${JSON.stringify(event.details ?? {})}`);
    }
    const details = event.details as {
      event?: string;
      roomId?: string;
      objectId?: string;
      surface?: string;
      roomSwap?: unknown;
      pixi?: { localPosition?: { x: number; y: number } };
      toX?: number;
      toY?: number;
    } | undefined;
    if (event.message === "Room object sprite prepared.") {
      const objectId = (event.details as { objectId?: string } | undefined)?.objectId;
      if (objectId && Object.values(transferHostObjectIds).includes(objectId as (typeof transferHostObjectIds)[keyof typeof transferHostObjectIds])) {
        transferSourcePrepared.add(objectId);
      }
      if (!transferStarted && Object.values(transferHostObjectIds).every((id) => transferSourcePrepared.has(id))) {
        transferStarted = true;
        window.setTimeout(() => {
          transferRenderer.prepareRoomTransitionSnapshot("slide");
          transferRenderer.updateScene(transferSnapshot);
          const expirySnapshot = mapHostSessionDataToSceneSnapshot(transferSession(transferFinalPositions, transferDestinationRoomId, [], transferLightingEnabled), transferSnapshot)!;
          expirySnapshot.moveLegTelemetry = [];
          expirySnapshot.bounds.height = 800;
          for (const role of transferObjects) expirySnapshot.objectsById[transferHostObjectIds[role]]!.movementDurationMs = 4500;
          window.setTimeout(() => {
            transferRenderer.updateScene(expirySnapshot);
            transferFrames.completedBeforeExpiry = Object.values(transferHostObjectIds).every((id) => transferFrames.completedIds.includes(id));
            transferFrames.expiryApplied = true;
            publishTransferState();
          }, 6500);
        }, 0);
      }
    }
    if (event.message === "Presentation motion trace."
      && details?.roomId === transferDestinationRoomId
      && details.objectId
      && details.pixi?.localPosition) {
      if (details.event === "first-visible-frame") {
        transferFrames.firstDestinationFrames[details.objectId] = { ...details.pixi.localPosition };
      } else if (details.event === "visible-tick" && details.roomSwap == null) {
        transferFrames.liveFrames[details.objectId] = { ...details.pixi.localPosition };
        const role = transferObjects.find((candidate) => transferHostObjectIds[candidate] === details.objectId);
        const arrivalY = role ? transferArrivalPositions[role].y + (role === "player" ? 64 : -45) : undefined;
        const destinationY = role ? transferFinalPositions[role].y + (role === "player" ? 64 : -45) : undefined;
        const y = details.pixi.localPosition.y;
        if (transferFrames.intermediateFrames[details.objectId] === undefined
          && Number.isFinite(arrivalY) && Number.isFinite(destinationY)
          && y < Number(arrivalY) - 1 && y > Number(destinationY) + 1) {
          transferFrames.intermediateFrames[details.objectId] = { ...details.pixi.localPosition };
        }
      }
    }
    if (event.message === "Room object movement animation completed.") {
      const objectId = (event.details as { objectId?: string } | undefined)?.objectId;
      if (objectId && Object.values(transferHostObjectIds).includes(objectId as (typeof transferHostObjectIds)[keyof typeof transferHostObjectIds]) && !transferFrames.completedIds.includes(objectId)) {
        transferFrames.completedIds.push(objectId);
        const completion = event.details as { toX?: number; toY?: number } | undefined;
        if (Number.isFinite(completion?.toX) && Number.isFinite(completion?.toY)) {
          transferFrames.completedPositions[objectId] = { x: Number(completion?.toX), y: Number(completion?.toY) };
        }
      }
    }
    publishTransferState();
  }
});
transferRenderer.resize(600, 800);
transferRenderer.updateScene(transferSourceSnapshot);
function publishTransferState(): void {
  harness.transfer = {
    roomId: transferSnapshot.roomId ?? "",
    objectIds: [...new Set(transferTelemetry.flatMap((leg) => (leg.movementSegments ?? []).map((item) => item.objectId)))],
    segmentKinds: transferTelemetry.flatMap((leg) => (leg.movementSegments ?? []).map((item) => item.kind)),
    trunkScale: transferSnapshot.objectsById.trunk?.sprite?.scale,
    firstDestinationFrames: { ...transferFrames.firstDestinationFrames },
    intermediateFrames: { ...transferFrames.intermediateFrames },
    liveFrames: { ...transferFrames.liveFrames },
    completedPositions: { ...transferFrames.completedPositions },
    lightingDiagnostics: [...transferFrames.lightingDiagnostics],
    completedIds: [...transferFrames.completedIds],
    expiryApplied: transferFrames.expiryApplied,
    completedBeforeExpiry: transferFrames.completedBeforeExpiry
  };
}
publishTransferState();
window.setTimeout(() => { harness.ready = true; }, 0);
