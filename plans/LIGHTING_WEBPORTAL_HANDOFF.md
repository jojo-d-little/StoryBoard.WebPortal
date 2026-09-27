# WebPortal lighting handoff

Reviewed 2026-09-27 against the Designer export, Contracts Host schemas, GameEngine projection and integration tests, the Lighting package API, and the current WebPortal adapter. This is the Host-to-WebPortal data and lifecycle handoff. `StoryBoard.Lighting/TopDown/plan/WebPortalLightingIntegrationHandover.md` covers Pixi setup and texture ownership. `StoryBoard.WebPortal/plans/WebPortal_Lighting_Integration_Plan.md` covers renderer work, but its proposed unresolved “lighting block” predates the concrete Host fields below.

## Source and status

- Designer authors project point-light defaults, room ambient, page/chapter ambient overlays, and at most one optional point light and occlusion strength per object. Its offsets are local pixels from the logical footprint's top-left cell. See `StoryBoard.Designer/plans/Lighting_Designer_Implementation_Checklist.md`.
- GameEngine resolves the authored data, instance enablement, phase ambient, footprint, elevation, and absolute room-pixel light position. Host sends these values through existing presentation DTOs. The [engine checklist](LIGHTING_RUNTIME_ENGINE_IMPLEMENTATION_CHECKLIST.md) records completed lifecycle coverage.
- The Contracts Host schemas under `StoryBoard.Contracts/Storyboard.Shared.Contracts/HostContracts/Schemas/Dtos/HostCommandDtos` define the wire fields. WebPortal's checked-in `HostContracts` TypeScript files do not yet contain the lighting additions; update them from the Contracts schema or staged generation before mapping data. WebPortal does not currently depend on the Lighting package or carry lighting in `GameRenderSceneSnapshot`.
- The Lighting package source declares `@jojo-d-little/storyboard-lighting` version `0.1.2`. Confirm the approved published version and registry access when WebPortal implements the adapter.

## Host fields to retain

| Source | Fields | WebPortal use |
| --- | --- | --- |
| `HostRuntimePresentationResult.sessionPresentationSettings` on hydration, and `HostSessionDataEnvelope.sessionPresentationSettings` on initial sync/resync | `cellSizePx`, optional `pointLightDefaults` | Keep for the session. Ordinary deltas may omit this object; omission does not clear it. |
| `roomChange.newRoom` | `roomImageCanvasWidth`, `roomImageCanvasHeight`, `ambientLighting`, `renderableRoomObjects` | Treat as a complete room summary, including when `roomId` is unchanged. Dimensions are room pixels; `ambientLighting` is already effective. |
| Each `HostCommandRenderableRoomObject` in the room summary or an object change | Optional `pointLight`, `spatialFootprint`, `lightOcclusion` | Keep current state by `objectId`. These values belong to the object, independent of sprite appearance. |
| `roomObjectChanges[]` | `changeKind`, `objectId`, optional `renderableRoomObject`, optional `fromRenderableObject` | Add, completely replace, or remove the keyed object. `fromRenderableObject` is prior state for presentation; it is not another current light. |

The baseline and update files under [`Fixtures/LightingBaseline/Expected`](../Storyboard.GameEngine.Tests/Fixtures/LightingBaseline/Expected) are **lighting-field fragments**: they omit unrelated required Host fields and some optional lighting fields, so they are not complete schema-valid envelopes. The real Host baseline is checked against the Contracts `HostSessionDataEnvelope` schema and sent through `Storyboard.GameClient` in [`GameHostCompositionSocketSmokeTests`](../Storyboard.GameClient.Tests/GameHostCompositionSocketSmokeTests.cs).

### Fixture values

The compact Designer fixture yields `cellSizePx: 40`, room size `800 × 600`, and effective ambient `{ "ambient": 0.2, "ambientColor": "#506070" }`. Its Lantern has a light at room pixel `(92.5, 144.25)` and a footprint at cell `(2, 3)`. The solid Pillar has strength `1`; the wall's explicit strength `0` remains `0`. These values are recorded in [`compact-baseline-lighting.json`](../Storyboard.GameEngine.Tests/Fixtures/LightingBaseline/Expected/compact-baseline-lighting.json).

```json
{
  "sessionPresentationSettings": {
    "cellSizePx": 40,
    "pointLightDefaults": { "radiusPx": 200, "intensityScale": 0.9, "color": "#FFFFFF", "lightHeightCells": 1 }
  },
  "roomChange": {
    "newRoom": {
      "roomImageCanvasWidth": 800,
      "roomImageCanvasHeight": 600,
      "ambientLighting": { "ambient": 0.2, "ambientColor": "#506070" },
      "renderableRoomObjects": [
        {
          "objectId": "10000000-0000-0000-0000-000000000101",
          "pointLight": { "x": 92.5, "y": 144.25, "radiusPx": 180, "intensityScale": 0.75, "color": "#FFE0A0" },
          "spatialFootprint": { "cellX": 2, "cellY": 3, "sizeXCells": 1, "sizeYCells": 1 }
        }
      ]
    }
  }
}
```

The example is a selected fragment. Use the linked fixture and real Host DTOs for the remaining fields.

## State and delta rules

1. On baseline or resync, replace the current room and object map. Retain the supplied session settings. Clear the previous room's lights and blockers before rendering the new room.
2. On an ordinary delta without `sessionPresentationSettings`, keep the last settings. Project defaults are static within a session. A new session with no defaults must not inherit a previous session's package defaults; reset or recreate package state at that boundary.
3. On `roomChange.newRoom`, replace the complete room summary and its objects, even if the room ID is the same. A phase-only ambient change uses this path. If that envelope also has `roomObjectChanges`, apply them after the room summary.
4. On `Added` or `Updated`, replace the complete object at `objectId`. Omitted or `null` `pointLight`, `spatialFootprint`, or `lightOcclusion` removes that capability. Preserve explicit numeric `0`. On `Removed`, delete all lighting and geometry for that object, even if `fromRenderableObject` contains its old light.
5. Build the package's **complete current** `pointLights` and `blockers` arrays from retained objects for each rendered frame. Omitting a package array means empty for that frame. Package room ambient and defaults persist when omitted from a submission, so send the retained effective room values on room changes and guard session reset as above.

For example, [`compact-disable-light-update.json`](../Storyboard.GameEngine.Tests/Fixtures/LightingBaseline/Expected/compact-disable-light-update.json) shows an `Updated` Lantern. `fromRenderableObject.pointLight` contains its old light, but `renderableRoomObject.pointLight` is absent; the replacement retains the footprint and clears the light. `isLightOn` is an engine game-property mutation name; WebPortal consumes only the resulting object update.

```json
{
  "changeKind": "Updated",
  "objectId": "10000000-0000-0000-0000-000000000101",
  "fromRenderableObject": {
    "objectId": "10000000-0000-0000-0000-000000000101",
    "pointLight": { "x": 92.5, "y": 144.25 }
  },
  "renderableRoomObject": {
    "objectId": "10000000-0000-0000-0000-000000000101",
    "spatialFootprint": { "cellX": 2, "cellY": 3, "sizeXCells": 1, "sizeYCells": 1 }
  }
}
```

This is also a selected fragment; the fixture has the full lighting values and the real DTO includes other required fields.

## Mapping to the Lighting package

| Package input | Host source and rule |
| --- | --- |
| `RoomGeometryInput.widthPx`, `heightPx` | `newRoom.roomImageCanvasWidth`, `roomImageCanvasHeight`; use the internal room image size, not viewport or CSS dimensions. |
| `RoomGeometryInput.cellSizePx` | Retained `sessionPresentationSettings.cellSizePx`, in the same room pixels. Require a positive value before initializing the lighting path. |
| `LightingFrameInput.roomLighting` | `newRoom.ambientLighting.ambient` and `.ambientColor`, already resolved by GameEngine. Do not reapply page/chapter scaling or blending. |
| `LightingFrameInput.pointLightDefaults` | Retained `sessionPresentationSettings.pointLightDefaults` when present. Missing individual properties use package fallbacks. Defaults alone do not create lights or enable animation. |
| `LightingFrameInput.pointLights` | One entry for each current object with `pointLight`. Forward its room-pixel `x`/`y` and optional radius, cone, colors, intensity, height, motion, sway, and flicker fields. Do not offset or rotate it again. |
| `LightingFrameInput.blockers` | One entry only when an object has both `lightOcclusion` and `spatialFootprint`. Forward cell coordinates, dimensions, `elevationCells`, and `strength`, including `0`. Map Host `shape: "rectangle"` to package `cornerStyle: "square"` and `"rounded-rectangle"` to `"round"`. A footprint without occlusion is not a blocker. |

Room origin is `(0, 0)` at the top left; positive Y points down. `pointLight.x/y` are absolute room pixels. `spatialFootprint.cellX/cellY` are integer cell indices; `sizeXCells/sizeYCells` default to `1` when absent. `lightHeightCells` and `elevationCells` are in cells. GameEngine rotates light offsets and directions and supplies final height and footprint; sprite anchors, image offsets, z-order, viewport scale, and letterboxing do not enter lighting coordinates. Package `pipeline.shadowSoften` is a WebPortal quality setting, not a Designer or Host room field.

Forward optional point-light fields by their Host names: `radiusPx`, `directionDeg`, `coneAngleDeg`, `intensityScale`, `color`, `outerColor`, `gradientExponent`, `lightHeightCells`, `motionMode`, `phase`, `swayAmountPx`, `swayHz`, `swayDirectionDeg`, `flickerAmount`, `flickerHz`, and `flickerStyle`. Project defaults have the matching appearance and animation fields except direction, cone, motion mode, and phase. Omitted `motionMode` is static. GameEngine currently emits rectangular footprints; the contract also allows rounded rectangles.

The engine emits a complete effective ambient state, including for older projects with no authored lighting: ambient `1` and color `#FFFFFF`. It does not synthesize point lights for ordinary objects. A solid object with height gets effective occlusion strength `1` unless explicitly overridden; explicit `0` is meaningful. A disabled instance omits `pointLight`. Phase overlays affect room ambient only. Copied objects can have independent enabled states, and the engine recomputes light placement after movement, rotation, stacking, and save/load.

If WebPortal visually tweens a move, use Host `fromRenderableObject` and replacement light positions as tween endpoints; settle on the Host replacement. Blocker coordinates are grid indices, so switch their footprint at the appropriate cell boundary rather than treating them as fractional pixels. Never derive a light from sprite movement alone.

## WebPortal implementation seam

The current `StoryBoard.WebPortal/Storyboard.WebPortal/src/gameRenderer/adapters/mapHostSessionScene.ts` maps visible room objects into `GameRenderSceneSnapshot` and drops objects whose `renderableImage.imagePath` is empty. Build retained lighting state from **all** Host `renderableRoomObjects` before that visual filter, so a light-only or blocker-only object is not lost. The current scene snapshot has no lighting fields; add a renderer-neutral lighting state and carry retained settings through baseline hydration and delta polling. Keep the package import and frame/resource lifecycle in the Pixi lighting controller described by the WebPortal integration plan.

Before rollout, verify with the checked-in compact and Workshop Designer exports:

- Baseline and resync, room entry, and a same-room phase-only ambient refresh.
- Object add/update/remove; enabled-to-disabled and disabled-to-enabled light; explicit-zero occlusion; footprint-only object; copied instances with independent light states.
- Move, quarter-turn rotation, stacking, and room-edge light coordinates at viewport scales other than `1`.
- No-lighting legacy project with full ambient and zero synthesized point lights.
- One package frame from the retained Host state, including empty arrays after removals and no stale room/session defaults after a transition.

The GameEngine side is covered by [`LightingRuntimeStateTests`](../Storyboard.GameEngine.Tests/LightingRuntimeStateTests.cs), [`AmbientLightingDeltaPollingTests`](../Storyboard.GameEngine.Tests/AmbientLightingDeltaPollingTests.cs), and the Host-to-Client integration test. Browser rendering, package version selection, and WebPortal-specific visual/performance checks remain WebPortal acceptance work.
