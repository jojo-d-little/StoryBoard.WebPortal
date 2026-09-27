# WebPortal lighting implementation plan

## Status and sources

Implementation plan, 2026-09-27. This is the current WebPortal plan; [the short implementation sequence](WebPortal_Lighting_Implementation_Sequence.md) is its execution checklist. The [Host handoff](LIGHTING_WEBPORTAL_HANDOFF.md) is authoritative where it differs from the older [portal integration plan](WebPortal_Lighting_Integration_Plan.md). The Contracts [Designer handover](../../StoryBoard.Contracts/plans/Lighting_Data_Contract_Designer_Handover.md) supplies the authoring and lifecycle decisions. The Lighting repository's `TopDown/plan/WebPortalLightingIntegrationHandover.md` supplies the Pixi pipeline API and ownership rules.

`@jojo-d-little/storyboard-contracts` has been refreshed to exact version `1.0.6` in `Storyboard.WebPortal/package.json` and its lockfile. WebPortal still uses its own `src/hostApi/HostContracts` TypeScript definitions. The staged generated types in `StoryBoard.Contracts/CodegenManagment/Staging/HostContractTypeScript/HostCommandDtos` are a reference for updating those definitions. The published Lighting package version and registry access still need verification before installing it; the local Lighting source identifies itself as `0.1.2`, which alone does not prove a published version is available.

## Outcome and scope

Build a single, optional room lighting stage. WebPortal retains effective Host lighting data, maps it to the Lighting package's `LightingFrameInput`, renders the existing room content into a separate room-size texture, and presents the package's `composedTexture`. All lighting calculations, shadow generation, and animation stay in the package. WebPortal owns data retention, coordinate mapping, Pixi texture lifecycle, transition handoff, and the Devtools switch.

The lit source includes the room's directional overlays, visible object sprites, and room-space appearance/styled-point effects already attached to a room surface. The HUD, blackout overlay, transition frames, and diagnostic grid remain outside that source. Keep the current raw Pixi room path intact and make the lighting decision at the final room presentation boundary. No Designer metadata or viewport coordinates enter the package adapter.

## Current code seams and required corrections

| Current seam | Finding | Implementation action |
| --- | --- | --- |
| `src/hostApi/HostContracts` | The checked-in DTOs lack the new lighting fields. | Update only the affected local DTOs and barrel exports using the staged generated types and Contracts schemas; retain the current local-contract convention. |
| `src/hooks/useHostRendererSessionWorkflow.ts` | Baseline maps `HostRuntimePresentationResult` directly; its synthetic envelope currently omits `sessionPresentationSettings`. | Feed settings into baseline scene mapping and synthetic envelope; reset retained state on new session and resync. |
| `src/gameRenderer/adapters/mapHostSessionScene.ts` | The visual mapper filters out empty `renderableImage.imagePath`. Delta handling tracks only visual objects. | Map lighting from every Host object before the image filter. Keep a separate keyed lighting/footprint state in the renderer-neutral scene. |
| `GameRenderSceneSnapshot` | Has no lighting or `cellSizePx`. | Add a small optional room-lighting state with geometry and keyed object records, independent of `roomObjects`. |
| `PixiGameRenderer.ts` | Owns active/staging room surfaces, movement ticker, raw presentation, and captures. `areScenesRenderEquivalent` ignores lighting. | Add one controller call after movement/effect ticks and before Pixi's screen render; make lighting-only scene changes observable without rerunning asset reconciliation. |
| `RoomSnapshotRenderer.ts` | Captures a raw `Container`; slide preparation can capture before the new Host room arrives. | Provide a final lit/raw capture seam so outgoing and incoming transition images reflect their respective lighting state. |
| `presentationIsolation.ts`, `useHostWorkflow.ts`, `DevToolsPanel.tsx` | The existing visual category list is filtered by presentation cue catalog categories. Lighting is a renderer stage, not a cue category. | Add an explicit `lightingEnabled` renderer setting and checkbox in Presentation Effects. Do not depend on cue catalog discovery. |

## Data flow and ownership

```text
Host baseline / deltas
  -> local Host DTOs
  -> mapHostSessionScene: retained session settings + complete room/object lighting state
  -> GameRenderSceneSnapshot.lighting (renderer-neutral)
  -> mapLightingFrameInput (pure mapping)
  -> RoomLightingController (only package import)
  -> Pixi composed room texture or raw room surface
```

Prefer a scene-scoped value, for example `lighting: { cellSizePx, ambientLighting, pointLightDefaults, objectsById }`. The map may be represented as a sorted array in the immutable snapshot if that fits existing test fixtures better. Keep each object's optional `pointLight`, `spatialFootprint`, and `lightOcclusion` together by `objectId`; an object can contribute a light or blocker with no image. Store optional transition interpolation metadata separately from authoritative current state. The scene bounds remain the canonical room pixel dimensions.

### Host update rules

1. Baseline or resync replaces room and all objects, and takes the supplied session settings. A new session clears previous settings and lighting even when optional fields are absent. An ordinary delta without `sessionPresentationSettings` keeps the current settings.
2. `roomChange.newRoom` is a complete room replacement, including when `roomId` is unchanged. Use its effective `ambientLighting` directly; do not reapply phase overlays. Apply any `roomObjectChanges` in that same envelope afterward.
3. `Added`/`Updated` completely replaces the keyed object's lighting, footprint, and occlusion. Missing or `null` capabilities clear the old values. `Removed` deletes the object. `fromRenderableObject` is the prior endpoint for animation, never an additional current light.
4. Preserve explicit zero values, particularly ambient `0`, light intensity `0`, and occlusion strength `0`. Do not use truthiness to choose fallbacks. Older content without lighting fields remains a valid full-ambient, no-point-light scene; the renderer must not synthesize object lights.
5. Asset hydration must preserve the lighting portion of a snapshot and its update order. A late asset result from a prior generation must not replace a newer room or its lighting state.

### Package mapping

| Lighting input | Host source / mapping |
| --- | --- |
| Geometry `widthPx`, `heightPx` | `newRoom.roomImageCanvasWidth/Height`, already represented by scene bounds; use room pixels only. |
| Geometry `cellSizePx` | Retained `sessionPresentationSettings.cellSizePx`; require a finite positive value before using the pipeline. |
| `roomLighting` | Effective `newRoom.ambientLighting`; use `{ ambient: 1, ambientColor: "#FFFFFF" }` when absent. |
| `pointLightDefaults` | Retained project `sessionPresentationSettings.pointLightDefaults`; on a new session explicitly clear/recreate pipeline state so omitted defaults cannot persist from the prior game. |
| `pointLights` | Every current object with `pointLight`, including image-free objects. Forward its absolute room-pixel `x/y` and optional appearance, direction, cone, height, sway and flicker fields without transforming them again. |
| `blockers` | Objects with both `spatialFootprint` and `lightOcclusion`; forward cell position, size (default 1), elevation, and strength including zero. Map `rectangle` to `square` and `rounded-rectangle` to `round`. Footprint alone creates no blocker. |
| `pipeline.shadowSoften` | A WebPortal quality constant/configuration, not a Host or Designer field. |

The package's point-light and blocker arrays describe the complete current frame, so submit both every lit frame, including empty arrays after removals. Submit explicit room ambient and project defaults at room/session boundaries, or every frame if simpler; avoid the package's persistent optional-field semantics causing stale values. Map only package-supported fields and validate finite coordinates and legal geometry at this boundary. Record invalid-input and capacity diagnostics, then fall back to raw presentation when geometry or pipeline setup is unusable.

The Host already resolves local offset, object rotation, footprint, elevation, and effective ambient. Room origin is top-left; positive Y is down. Light positions are pixels; footprint positions and sizes are cells. Sprite anchor, appearance scale, canvas placement, contain scaling, and browser size must not alter these values. `lighting.resize()` runs only when internal room width/height or cell size changes.

### Movement between Host updates

The Host's replacement object is the authoritative endpoint. For a presentation tween, derive the light start from `fromRenderableObject.pointLight` (or previous keyed state) and end from the replacement's resolved point light. Advance this interpolation on the same movement ticker and timing as the visual object's cue or leg sequence; settle exactly on the Host endpoint. A light-only object still needs its own tween state, independent of sprite existence. For blockers, retain whole-cell footprints and switch at a defined cell/leg boundary; never feed fractional cell coordinates to the package. Rotation or stacking endpoints are likewise Host-resolved. This is a small animation projection at the adapter/controller boundary, not a second spatial model.

## Pixi integration

Place `mapLightingFrameInput.ts` next to the Host scene adapter (pure, renderer-neutral), and `RoomLightingController.ts` under `src/gameRenderer/pixi/lighting`. The controller is the sole WebPortal import of `@jojo-d-little/storyboard-lighting`. Its public operations should be small: initialize after Pixi WebGL setup, update geometry/scene, render a selected room surface at an absolute time, expose a final presentation/capture texture, and dispose. The coordinator owns the `lightingEnabled` branch; the controller owns its source `RenderTexture`, package pipeline, and composed sprite.

Set `preference: "webgl"` during `app.init()` and confirm the resulting renderer meets the package requirement. Construct the pipeline only after initialization and stage attachment. Keep the existing latest-scene queue behavior during asynchronous setup. The controller creates one stable room-size `RenderTexture`, supplies it with `ownership: "borrowed"`, and renders the selected raw room surface into it with a clear each enabled frame. The package owns its intermediate and output targets. Never render the composed sprite, grid, HUD, or transition layer back into the source texture.

Put the raw room surfaces and one composed presentation sprite under the same room-space contain transform. Select exactly one visible representation for normal play. When disabled, skip source capture, `submitFrame`, and `renderFrame`, hide the composed sprite, and show the raw surface. When enabled, render room content after movement/effect ticker updates, submit current arrays and effective settings, call `renderFrame(ticker.lastTime / 1000)`, and show `composedTexture` only after a successful frame. Switching is atomic at a frame boundary; failure restores the raw surface and emits one actionable diagnostic rather than leaving a blank or stale output. An enabled room with no valid `cellSizePx` uses the raw path until valid geometry arrives.

The current Pixi ticker registers movement, room swap, and HUD callbacks. Register lighting after movement and room swap updates, before Pixi's application render. Guard against `renderGeneration` changes during asynchronous asset reconciliation. `areScenesRenderEquivalent` must account for lighting, or split visual equivalence from lighting-data equivalence so ambient-only and light-only deltas update the controller without reloading unchanged assets. Browser viewport resize changes only the contain transform and screen renderer; room-size lighting targets remain as they are.

Dispose in this order: stop the lighting frame callback; dispose transition captures; dispose the lighting pipeline; destroy the borrowed source texture and composed sprite; destroy the Pixi app. Make partial initialization, repeated disposal, and room replacement safe. On session change, recreate or reset the controller to prevent package-persistent defaults carrying across sessions.

## Devtools control and grid

Extend `PresentationIsolationSettings` with a distinct `lightingEnabled` boolean, default **off for the initial rollout**, and add a Lighting checkbox to the existing Presentation Effects section. The master `enabled` setting also suppresses lighting; the effective gate is `enabled && lightingEnabled`. Keep the checkbox visible regardless of cue catalog content. Carry the setting through `useHostWorkflow` -> `ConfigSlotFeatureRenderer` -> `SessionPlaySurfaceRendererV1` -> renderer handle, where one branch at the room-presentation seam performs the switch live. This remains portal-local and session-only; it does not change Host state or audio settings. Turn the default on only after the acceptance checks below pass.

Retain the older plan's diagnostic grid as a separate, initially-off Devtools control. Draw it with one Pixi `Graphics` object in room coordinates above raw/composed presentation but outside the source and transition captures. Rebuild only for room geometry/cell-size changes; hide it for invalid cell size or during frozen transitions. This diagnostic is not a lighting-package feature.

## Transition strategy

Use **one pipeline and one source texture**. At the existing slide preparation boundary, capture the outgoing final room image while the old room and lighting state are still active. After staging reconciliation finishes, render the incoming staging surface with the incoming lighting state and capture its final image. Let the existing bounded snapshot transition own slide motion. Capture methods must accept the final lit texture or raw surface, preserve current resolution bounds, and exclude HUD, grid, and transition UI. Do not re-light a captured image.

Current fade and blackout paths use two live room surfaces, while one pipeline exposes only one composed output at a time. For enabled lighting, use frozen final-image snapshots for both sides during those transitions as well, with the existing fade/blackout timing and fallback behavior. On completion, attach the incoming live room to the pipeline. When lighting is disabled, retain the present raw transition path. If capture or lighting fails, use the established raw/fade-blackout fallback. Test cancellation and rapid consecutive room changes for stale source/scene association and exactly-once snapshot disposal.

## Implementation and acceptance gates

1. Verify and install an approved published Lighting package version using the existing private npm scope. Confirm WebGL/Pixi 8 compatibility with the installed declarations. Do not link to the sibling source tree.
2. Update local Host DTOs from staged/generated contracts: `HostSessionPresentationSettings`, `HostPointLightDefaults`, `HostRoomAmbientLighting`, `HostObjectPointLight`, `HostObjectSpatialFootprint`, `HostObjectLightOcclusion`, and affected envelope, room, and object definitions. Update exports and contract fixtures. Preserve optional/null semantics.
3. Add the retained scene-lighting state and pure Host-to-scene/package mapping. Cover baseline/resync, same-room ambient refresh, delta replacement/removal, light-only and blocker-only objects, explicit zero, old projects, and session reset in focused tests.
4. Add the Pixi controller and single normal-frame gate. Verify off means zero lighting capture/package calls, on renders ambient and current lights/blockers, failed setup/frame returns raw output, and room geometry changes resize once while viewport changes do not.
5. Extend final-composite capture and active/staging transition handoff. Verify outgoing/incoming slide and fade/blackout images, rapid room changes, failure fallback, and disposal. Verify moving lights and blockers at non-1 contain scales and letterboxed viewports.
6. Add the Devtools Lighting switch and, separately, the diagnostic grid. Verify live toggling does not duplicate sprites/ticker work or affect pointer mapping, audio, HUD, or Host state.
7. Run WebPortal build, unit tests, and browser visual tests with the compact and Workshop lighting fixtures. Compare ambient-only, static/animated light, occlusion, phase change, movement, and legacy scenes. Measure representative room sizes/light counts and choose shader capacities plus frame-time/GPU-memory budgets before enabling by default.

The integration is complete when a single authored Host fixture survives baseline and delta processing into the exact current package frame, the on/off paths and transitions render correctly in a browser, and no lighting work runs on a disabled normal frame.
