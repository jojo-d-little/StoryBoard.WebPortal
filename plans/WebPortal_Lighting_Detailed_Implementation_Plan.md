# WebPortal lighting implementation plan

## Status and sources

Implementation plan, 2026-09-27. This is the current WebPortal plan; [the short implementation sequence](WebPortal_Lighting_Implementation_Sequence.md) is its execution checklist. The [Host handoff](LIGHTING_WEBPORTAL_HANDOFF.md) is authoritative where it differs from the older [portal integration plan](WebPortal_Lighting_Integration_Plan.md). The Contracts [Designer handover](../../StoryBoard.Contracts/plans/Lighting_Data_Contract_Designer_Handover.md) supplies the authoring and lifecycle decisions. The Lighting repository's `TopDown/plan/WebPortalLightingIntegrationHandover.md` supplies the Pixi pipeline API and ownership rules.

The npm dependency ranges use the project's patch-range convention: `@jojo-d-little/storyboard-contracts` is `1.0.x` and resolves to `1.0.6` in the lockfile; `@jojo-d-little/storyboard-lighting` is `0.1.x` and resolves to official release `0.1.3`. WebPortal still uses its own `src/hostApi/HostContracts` TypeScript definitions, updated from the staged generated interfaces. The official package's fractional-pixel blocker contract is present and its WebGL integration has passed build, unit, and browser validation.

## Outcome and scope

Build a single, optional room lighting stage. WebPortal retains effective Host lighting data, maps it to the Lighting package's `LightingFrameInput`, renders the existing room content into a separate room-size texture, and presents the package's `composedTexture`. All lighting calculations, shadow generation, and animation stay in the package. WebPortal owns data retention, coordinate mapping, Pixi texture lifecycle, transition handoff, and the Devtools switch.

The lit source includes the room's directional overlays, visible object sprites, and room-space appearance/styled-point effects already attached to a room surface. The HUD, blackout overlay, transition frames, and diagnostic grid remain outside that source. Keep the current raw Pixi room path intact and make the lighting decision at the final room presentation boundary. No Designer metadata or viewport coordinates enter the package adapter.

## Current code seams and required corrections

| Current seam | Finding | Implementation action |
| --- | --- | --- |
| `src/hostApi/HostContracts` | Local DTOs do not import generated interfaces directly. | Completed: updated affected local DTOs and barrel exports from staged generated types while retaining the local-contract convention. |
| `src/hooks/useHostRendererSessionWorkflow.ts` | Baseline/resync and deltas need retained settings and session reset behavior. | Completed: feed settings through mapping, retain complete scene state, and reset stale state on new sessions/resync. |
| `src/gameRenderer/adapters/mapHostSessionScene.ts` | Visual objects may have empty image paths, while lighting-only objects must remain represented. | Completed: map every Host object to `objectsById`, with optional sprite and lighting components; apply complete replacements. |
| `GameRenderSceneSnapshot` | Room lighting settings and object lighting need renderer-neutral state. | Completed: snapshot has room/session lighting state and one canonical `objectsById` table shared by optional sprite and lighting components. |
| `mapLightingFrameInput.ts` | Scene state must become a pure, complete package frame without viewport transforms. | Completed in step 3: maps room-pixel geometry, ambient, point lights, and blockers; validates geometry/capacity and reports malformed capabilities. |
| `PixiGameRenderer.ts`, `pixi/lighting/RoomLightingController.ts` | Own active/staging room surfaces, movement ticker, raw presentation, and captures. | Complete: request WebGL, capture the active room into a borrowed room-size texture after movement updates, submit the complete mapped frame, and show the composed texture only on success. Lighting defaults on; the Devtools control can disable it, and final lit transition captures are connected. |
| `RoomSnapshotRenderer.ts` | Captures a raw `Container`; slide preparation can capture before the new Host room arrives. | Provide a final lit/raw capture seam so outgoing and incoming transition images reflect their respective lighting state. |
| `presentationIsolation.ts`, `useHostWorkflow.ts`, `DevToolsPanel.tsx` | The existing visual category list is filtered by presentation cue catalog categories. Lighting is a renderer stage, not a cue category. | Complete: added a separate catalog-independent `lightingEnabled` setting and checkbox in Presentation Effects. Lighting defaults on; the checkbox and master Presentation Effects switch suppress it. |

## Data flow and ownership

```text
Host baseline / deltas
  -> local Host DTOs
  -> mapHostSessionScene: retained settings + canonical objectsById (optional sprite and lighting components)
  -> GameRenderSceneSnapshot (renderer-neutral room settings and object lighting)
  -> mapLightingFrameInput.ts (pure mapping)
  -> RoomLightingController (only package import)
  -> Pixi composed room texture or raw room surface
```

The implemented scene uses room/session settings in `GameRenderSceneSnapshot.lighting` and a canonical top-level `objectsById` table. Each `GameRenderSceneObject` has shared identity plus optional `sprite` and `lighting` components; a light or blocker can exist without an image. Keep optional transition interpolation metadata separate from authoritative current state. The scene bounds remain the canonical room pixel dimensions.

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
| `blockers` | Objects with both `spatialFootprint` and `lightOcclusion`; convert Host cell top-left to room-image `xPx`/`yPx` at rest, then send fractional pixel positions while moving. Forward size (default 1), elevation, and strength including zero. Map Host `cornerStyle: "sharp"` (the default) to `square` and `"rounded"` to `round`. Footprint alone creates no blocker. |
| `pipeline.shadowSoften` | A WebPortal quality constant/configuration, not a Host or Designer field. |

The package's point-light and blocker arrays describe the complete current frame, so submit both every lit frame, including empty arrays after removals. The pure mapper emits explicit room ambient and the current arrays each time. It maps project defaults when present; because package defaults persist when omitted, the controller must reset or recreate package state on session changes where defaults are absent. Map only package-supported fields and validate finite coordinates and legal geometry at this boundary. Record invalid-input and capacity diagnostics, then fall back to raw presentation when geometry or pipeline setup is unusable. The mapper's initial capacity defaults match the package's current 64-light/64-blocker defaults; profile and tune these during acceptance before rollout.

The Host already resolves local offset, object rotation, footprint, elevation, and effective ambient. Room origin is top-left; positive Y is down. Light positions are pixels; footprint positions and sizes are cells. Sprite anchor, appearance scale, canvas placement, contain scaling, and browser size must not alter these values. `lighting.resize()` runs only when internal room width/height or cell size changes.

### Movement between Host updates

The Host's replacement object is the authoritative endpoint. The scene adapter retains `fromRenderableObject` lighting as transient movement input. For sprite-owned lights, project the point light from the sprite renderer's live root position and its active movement tween, including eased multi-leg paths and retargets; interpolate only the light's relative offset between Host endpoints. This keeps its position on the same path and frame timing as the associated sprite. Sprite-owned blockers use the same live root position plus the Host-resolved footprint-to-sprite offset to submit fractional room-image `xPx`/`yPx` each frame. Keep footprint size, corner style, elevation, and occlusion strength from the source endpoint until movement settles, then use the Host replacement. At rest, derive pixel position as `cellX * cellSizePx`, `cellY * cellSizePx`. Light-only objects have no visual movement path, so they use timed endpoint interpolation. Retarget from the currently projected blocker position to avoid a discontinuity. This is a small animation projection at the adapter/controller boundary, not a second spatial model.

## Pixi integration

Place `mapLightingFrameInput.ts` next to the Host scene adapter (pure, renderer-neutral), and `RoomLightingController.ts` under `src/gameRenderer/pixi/lighting`. The controller is the sole WebPortal import of `@jojo-d-little/storyboard-lighting`. Its public operations should be small: initialize after Pixi WebGL setup, update geometry/scene, render a selected room surface at an absolute time, expose a final presentation/capture texture, and dispose. The coordinator owns the `lightingEnabled` branch; the controller owns its source `RenderTexture`, package pipeline, and composed sprite.

Set `preference: "webgl"` during `app.init()` and confirm the resulting renderer meets the package requirement. Construct the pipeline only after initialization and stage attachment. Keep the existing latest-scene queue behavior during asynchronous setup. The controller creates one stable room-size `RenderTexture`, supplies it with `ownership: "borrowed"`, and renders the selected raw room surface into it with a clear each enabled frame. The package owns its intermediate and output targets. Never render the composed sprite, grid, HUD, or transition layer back into the source texture.

Put the raw room surfaces and one composed presentation sprite under the same room-space contain transform. Select exactly one visible representation for normal play. When disabled, skip source capture, `submitFrame`, and `renderFrame`, hide the composed sprite, and show the raw surface. When enabled, render room content after movement/effect ticker updates, submit current arrays and effective settings, call `renderFrame(ticker.lastTime / 1000)`, and show `composedTexture` only after a successful frame. Switching is atomic at a frame boundary; failure restores the raw surface and emits one actionable diagnostic rather than leaving a blank or stale output. An enabled room with no valid `cellSizePx` uses the raw path until valid geometry arrives.

The current Pixi ticker registers movement, room swap, and HUD callbacks. Register lighting after movement and room swap updates, before Pixi's application render. Guard against `renderGeneration` changes during asynchronous asset reconciliation. `areScenesRenderEquivalent` must account for lighting, or split visual equivalence from lighting-data equivalence so ambient-only and light-only deltas update the controller without reloading unchanged assets. Browser viewport resize changes only the contain transform and screen renderer; room-size lighting targets remain as they are.

Dispose in this order: stop the lighting frame callback; dispose transition captures; dispose the lighting pipeline; destroy the borrowed source texture and composed sprite; destroy the Pixi app. Make partial initialization, repeated disposal, and room replacement safe. On session change, recreate or reset the controller to prevent package-persistent defaults carrying across sessions.

## Devtools control and grid

`PresentationIsolationSettings` includes a distinct `lightingEnabled` boolean, default **on**, and the Presentation Effects section has a Lighting checkbox separate from the cue-category list. The checkbox turns lighting off; the master `enabled` setting also suppresses lighting. The effective gate is `enabled && lightingEnabled`. The checkbox remains visible regardless of cue catalog content. `useHostWorkflow` carries the setting through `ConfigSlotFeatureRenderer` and `SessionPlaySurfaceRendererV1` to the renderer handle, where one branch at the room-presentation seam performs the switch live. This remains portal-local and session-only; it does not change Host state or audio settings. Lighting-specific browser fixtures and single-machine performance profiling are complete; see the [performance baseline](WebPortal_Lighting_Performance_Baseline.md) for results and hardware limits.

Retain the older plan's diagnostic grid as a separate, initially-off Devtools control. Draw it with one Pixi `Graphics` object in room coordinates above raw/composed presentation but outside the source and transition captures. Rebuild only for room geometry/cell-size changes; hide it for invalid cell size or during frozen transitions. This diagnostic is not a lighting-package feature.

## Transition strategy

Use **one pipeline and one source texture**. At the existing slide preparation boundary, capture the outgoing final room image while the old room and lighting state are still active. After staging reconciliation finishes, render the incoming staging surface with the incoming lighting state and capture its final image. When lighting is enabled, use these frozen final images for slide, fade, and fade-blackout transitions so both rooms can retain their lighting while the single pipeline processes only one room at a time. When lighting is disabled, retain the existing raw transition behavior. Capture methods preserve resolution bounds and exclude HUD, grid, and transition UI. Do not re-light a captured image.

Current fade and blackout paths use two live room surfaces, while one pipeline exposes only one composed output at a time. For enabled lighting, use frozen final-image snapshots for both sides during those transitions as well, with the existing fade/blackout timing and fallback behavior. On completion, attach the incoming live room to the pipeline. When lighting is disabled, retain the present raw transition path. If capture or lighting fails, use the established raw/fade-blackout fallback. Test cancellation and rapid consecutive room changes for stale source/scene association and exactly-once snapshot disposal.

## Implementation and acceptance gates

1. Verify and install an approved published Lighting package version using the existing private npm scope. Confirm WebGL/Pixi 8 compatibility with the installed declarations. Do not link to the sibling source tree.
2. Update local Host DTOs from staged/generated contracts: `HostSessionPresentationSettings`, `HostPointLightDefaults`, `HostRoomAmbientLighting`, `HostObjectPointLight`, `HostObjectSpatialFootprint`, `HostObjectLightOcclusion`, and affected envelope, room, and object definitions. Update exports and contract fixtures. Preserve optional/null semantics.
3. Add the retained scene-lighting state and pure Host-to-scene/package mapping. Cover baseline/resync, same-room ambient refresh, delta replacement/removal, light-only and blocker-only objects, explicit zero, old projects, and session reset in focused tests.
4. Add the Pixi controller and single normal-frame gate. Verify off means zero lighting capture/package calls, on renders ambient and current lights/blockers, failed setup/frame returns raw output, and room geometry changes resize once while viewport changes do not.
5. Extend final-composite capture and active/staging transition handoff. Each staged surface receives its destination room clip bounds before it is rendered or captured, while the outgoing surface retains its current bounds through the delayed swap. A different-size lit fade-blackout browser regression verifies the incoming edge remains visible in its frozen image. Verify outgoing/incoming slide and fade/blackout images, rapid room changes, failure fallback, and disposal. Verify moving lights and blockers at non-1 contain scales and letterboxed viewports.
6. Add the Devtools Lighting switch and, separately, the diagnostic grid. Verify live toggling does not duplicate sprites/ticker work or affect pointer mapping, audio, HUD, or Host state.
7. Run WebPortal build, unit tests, and browser visual tests. Against official package `0.1.3`, the build, all 247 unit tests, and the 12-test Playwright suite pass. The lighting browser fixtures cover compact and WorkshopTutorial-authored static/flickering lights, ambient changes, occlusion, explicit zero, removals, movement, legacy rooms, different-size lit blackout snapshots, room swaps, live toggling, and viewport resizing. Controller failure/disposal paths are covered by unit tests. See the [performance baseline](WebPortal_Lighting_Performance_Baseline.md) for the historical on/off memory measurements and the official-release frame-cadence rerun; GPU memory capture was unavailable in that rerun. Repeat performance measurements on lower-end supported hardware.

The integration is complete when a single authored Host fixture survives baseline and delta processing into the exact current package frame, the on/off paths and transitions render correctly in a browser, and no lighting work runs on a disabled normal frame.
