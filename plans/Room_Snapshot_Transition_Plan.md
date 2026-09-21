# Room Snapshot and Transition Rendering Plan

## Status

Design lock-off complete. Initial bounded-snapshot slide transition and polling-backpressure implementation completed on 2026-09-21.

Implemented validation includes the full unit suite, the production build, and browser-level pixel regressions proving that an intentionally overflowing outgoing-room object does not cross into the incoming room during a slide and that blackout-swap fades remain visible. Transition diagnostics report resolved mode/duration, capture start/completion/failure, fallback reasons, zero-duration commits, and cancellation reasons. Snapshot resolution honors both the fixed safety budget and the active renderer/GPU texture limit.

## Objective

Introduce a reusable room-snapshot capability and use it to render room slide transitions from frozen, bounded images instead of moving the live room scene graphs.

The immediate purpose is to prevent content authored outside a room boundary from becoming visible during a slide transition. The same capture boundary should later support whole-room transition effects such as page turns and persistent room thumbnails for the player-discovered map.

## Current issue

The active and staging room surfaces currently share a stationary rectangular mask. While a room is stationary, this mask correctly hides image content outside the logical room bounds. During a slide, however, the entire live room surface moves through that stationary mask. Previously hidden content can therefore move into the visible rectangle before the outgoing surface is removed.

The reusable active and staging surfaces also retain their original display-list order when their roles are swapped. Without explicit transition ordering, the outgoing surface can sometimes render above the incoming surface.

## Scope

### Included in the initial implementation

- A renderer-owned API for capturing a fully composed room into a bounded Pixi render texture.
- Frozen outgoing and incoming room snapshots for slide transitions.
- Explicit transition-layer ordering.
- Deterministic creation, cancellation, replacement, and disposal of transition textures.
- Explicit pause/resume coordination with the serial session-delta polling loop while a room transition is being prepared or displayed.
- Correct handling of room content that extends beyond room bounds.
- A capture boundary that can include the future lighting result without redesigning the transition system.
- Automated regression coverage for clipping, ordering, lifecycle, and differing room dimensions.

### Deferred

- The player-discovered map UI and map topology.
- Persistent thumbnail storage or synchronization.
- GPU-to-CPU extraction and PNG, WebP, or other image encoding.
- Thumbnail sizing and image-retention policies.
- Shader-based lighting implementation.
- Page-turn or other advanced transition shaders.
- Render-texture pooling unless profiling demonstrates a need.

## Proposed architecture

Use a renderer-owned room-capture component as the shared boundary. Transitions are its first consumer, but capture must not depend on a transition being active.

```text
Live room scene
  -> final bounded room composite
  -> room snapshot renderer
       -> GPU RenderTexture -> transitions
       -> thumbnail/export adapter -> future discovered-map feature
```

The stage composition during a transition should be:

```text
Renderer stage
  |- hidden live room surfaces
  |- stationary transition viewport clip
  |    |- outgoing snapshot sprite
  |    `- incoming snapshot sprite
  `- viewport HUD/UI
```

Room-space content included in a snapshot should initially be directional overlays, room objects, and room-space visual effects. Viewport HUD and transition UI should remain outside the snapshot. When lighting is introduced, the final lighting composite should feed the same capture boundary.

## Initial API shape

Exact names may change during implementation, but the responsibility and ownership should remain explicit.

```ts
interface RoomSnapshotRequest {
  roomId: string;
  width: number;
  height: number;
  resolutionScale: number;
}

interface CapturedRoomTexture {
  roomId: string;
  width: number;
  height: number;
  texture: RenderTexture;
  dispose(): void;
}

interface RoomSnapshotRenderer {
  captureTexture(
    surface: Container,
    request: RoomSnapshotRequest
  ): CapturedRoomTexture;
}
```

The snapshot renderer should own bounded capture mechanics. The transition controller should own timing, placement, animation, and final disposal. A future thumbnail exporter should consume the same final composite without forcing GPU readback during ordinary transitions.

## Polling and transition coordination

The portal currently has a serial, single-flight session-delta polling loop, React workflows that map and hydrate scenes, and a separate Pixi ticker that renders animation. It does not have one centralized application driver loop. Room-transition processing must therefore provide explicit backpressure to the polling workflow.

When a delta containing a room change is accepted:

1. Advance and preserve the watermark delivered by that poll.
2. Pause the polling pump before it can begin another HTTP delta request.
3. Keep the polling generation alive; pausing must not use the existing polling `enabled` flag or recreate the polling effect.
4. Capture the outgoing room, hydrate and capture the incoming room, and execute the transition.
5. Delay HUD activity and all subsequently available server deltas until the incoming room is live.
6. Resume polling from the preserved watermark after success, fallback, cancellation, or other terminal transition handling.

The polling hook should gain a real pause gate that prevents only the start of the next request. It must preserve its current watermark, counters, ownership epoch, and generation. A transition lifecycle signal should travel from the renderer to the orchestration workflow; the renderer must not directly control network polling.

Transition lifecycle signaling may use states conceptually equivalent to `preparing`, `running`, `complete`, and `failed`. Exact names remain an implementation detail. All renderer-disposal, session-detach, capture-failure, fallback, and cancellation paths must release the pause. Add a bounded watchdog so a lost completion signal cannot suspend polling indefinitely.

Because polling is already serial and the room change originates in the response currently being processed, another normal delta request should not be in flight when the pause is asserted. Server-side changes may continue to accumulate behind the preserved watermark and will be requested after the transition. Player commands that could create new server state should be disabled or explicitly governed while the transition is active.

## Transition lifecycle

1. Detect a room-boundary change and capture the outgoing room at its current completed visual state.
2. Render the incoming scene into the staging surface and wait for its required assets to finish loading.
3. Capture the fully prepared incoming room.
4. Hide the live room surfaces and place the two snapshot sprites in the transition layer with explicit ordering.
5. Animate only the snapshot sprites for the duration of the slide.
6. Do not request additional session deltas while transition preparation or animation is active; the frozen transition images do not change.
7. At completion, activate and reveal the incoming live surface and release delayed HUD activity.
8. Remove transition sprites, dispose their owned textures, and resume polling from the preserved watermark.
9. On cancellation, superseding room change, initialization failure, fallback, or renderer disposal, remove sprites, dispose all partially or fully created snapshot resources, and release or terminate the polling pause as appropriate.

## Implementation phases

### Phase 1: Extract bounded room capture

- Establish a single final-room composite container or documented capture root.
- Add a small room-snapshot renderer near the Pixi renderer implementation.
- Capture into a render texture whose dimensions match the requested logical room bounds.
- Cap capture resolution against both the fixed snapshot budget and the active renderer/GPU maximum texture dimension.
- Make texture ownership and disposal explicit.
- Keep HUD and viewport-level UI outside the captured container.
- Add diagnostics for capture size, resolution, duration, and failures.

### Phase 2: Convert slide transitions

- Add a dedicated transition layer and stationary viewport clip.
- Capture outgoing and incoming room snapshots at the defined lifecycle points.
- Hide live surfaces while the frozen snapshots animate.
- Replace live-root position animation with snapshot-sprite position animation.
- Set incoming and outgoing draw order explicitly rather than relying on reusable surface insertion order.
- Reveal the current incoming live surface and clean up snapshots when complete.

### Phase 3: Coordinate polling backpressure

- Add a pause/resume gate to the existing serial polling loop without tearing down its effect or resetting its watermark.
- Detect an accepted room change synchronously while processing the poll result and assert the pause before another poll can begin.
- Reorder room-change delta consumption as needed so HUD/phase presentation from the triggering envelope is queued until the incoming room is live rather than consumed before transition detection.
- Expose a narrow renderer-transition lifecycle signal to the orchestration workflow.
- Resume polling only after the incoming room is live or a terminal fallback/cancellation path has completed.
- Delay transition-associated HUD presentation until the room is live.
- Add a maximum-pause watchdog and diagnostics for pause reason, duration, preserved watermark, and resume outcome.
- Disable or explicitly govern commands that could create additional server state while the transition is active.

### Phase 4: Harden lifecycle behavior

- Handle a new room change arriving during capture or transition.
- Handle same-room deltas received while snapshot sprites are moving.
- Handle renderer resize during capture and transition.
- Handle asset-load or texture-creation failure with a safe immediate room swap or existing fallback effect.
- Ensure every completion, cancellation, and disposal path releases render textures exactly once.

### Phase 5: Prepare the future thumbnail seam

- Keep snapshot capture callable independently from room transitions.
- Retain room identity and logical dimensions in snapshot metadata.
- Document the future adapter point for downscaling and GPU-to-CPU extraction.
- Do not add persistence, encoding, map-specific metadata, or thumbnail policy in this implementation.

## Testing plan

### Unit and component coverage

- Snapshot texture dimensions equal the requested room dimensions.
- Invalid dimensions are normalized or rejected according to the locked design.
- Transition sprites receive deterministic draw order.
- Completion, cancellation, replacement, and renderer disposal release texture ownership.
- No subsequently polled same-room update is delivered while the transition is preparing or running; accumulated updates are retrieved after polling resumes.
- A superseding room change cannot reveal or retain stale snapshots.
- Polling pause preserves the active watermark and does not restart the polling generation.
- No additional delta request begins while transition preparation or animation is active.
- Polling resumes exactly once after success, fallback, cancellation, and failure.
- A watchdog recovers from a missing transition-completion signal.

### Visual regression coverage

- Create an outgoing room with a conspicuous image extending beyond each relevant boundary.
- Capture the slide at a deterministic midpoint and verify that no authored overflow is visible.
- Verify the incoming room is not unexpectedly covered by the outgoing snapshot.
- Run consecutive transitions to catch active/staging display-order alternation.
- Cover horizontal, vertical, and at least one diagonal slide.
- Cover transitions between equal room dimensions and mixed aspect ratios.
- Confirm the completed live room matches its incoming snapshot closely enough to avoid a visible final-frame jump.

### Validation gate

- Run the focused renderer tests.
- Run the complete Vitest suite.
- Run the room visual regression suite.
- Run the production TypeScript/Vite build.
- Inspect diagnostics for unreleased or duplicate-disposed transition resources.

## Risks and mitigations

- **GPU memory spikes:** keep only the required outgoing and incoming textures, dispose deterministically, and defer pooling until measured.
- **Post-transition catch-up discontinuity:** resume from the preserved watermark and process accumulated deltas through the normal presentation-cue path after the incoming room is live.
- **Polling deadlock:** preserve the live polling generation, release the pause on every terminal path, and enforce a bounded watchdog.
- **Delayed server changes:** resume from the preserved watermark and rely on normal delta or resync behavior after the short transition pause.
- **Commands during transition:** disable or explicitly govern commands that could advance server state while delta retrieval is intentionally paused.
- **Resolution mismatch or softness:** use an explicit capture-resolution policy and test at representative device pixel ratios.
- **Mixed-size room ambiguity:** lock the transition coordinate-space policy and cover it with visual tests.
- **Future lighting incompatibility:** define capture against the final room composite rather than individual object layers.
- **GPU readback cost for the future map:** keep persistent thumbnail extraction as a separate consumer so transitions remain GPU-local.
- **Capture failure:** provide a deterministic fallback that commits the staged live room without leaving the renderer between states.

## Acceptance criteria

- No image content outside either room's logical bounds becomes visible during a slide transition.
- Slide transitions use frozen room snapshots rather than moving live room surfaces.
- Incoming and outgoing layering is deterministic across repeated transitions.
- The incoming live room appears correctly at completion, and server changes accumulated during the polling pause are retrieved and processed afterward.
- No new session-delta request begins while a room transition is preparing or running.
- Polling resumes from the preserved watermark after every successful, failed, cancelled, or fallback transition path without replaying consumed deltas.
- Snapshot resources are released on completion, cancellation, replacement, and renderer disposal.
- The capture implementation is independently callable and contains no map persistence or transition-timing responsibility.
- The future final lighting composite can become the capture input without changing transition semantics.
- Existing non-slide behavior remains unchanged unless explicitly included by a design decision below.

## Design lock-off questions

1. **Capture contents:** Should the canonical room snapshot include all room-space overlays and effects while always excluding viewport HUD, menus, diagnostics, and transition UI?

   **Agreed decision:** Yes. Capture the final room-space composition and exclude viewport-level UI, HUD, diagnostics, menus, and transition UI.

2. **Player representation:** If the player avatar or marker is room-space content, should it be included in transition snapshots and future discovered-map thumbnails, or should map thumbnails use a separate capture profile?

   **Agreed decision:** Include all currently rendered room-space content, including any player representation, in the initial transition snapshots. The portal does not currently have enough semantic knowledge to filter player imagery. Revisit capture profiles and player exclusion when the map feature is designed.

3. **Capture timing:** Should the outgoing snapshot be taken immediately when a room change is accepted, before waiting for incoming assets, so its visual state freezes at the transition trigger?

   **Agreed decision:** Yes. Capture and freeze the outgoing room immediately when the room change is accepted, before waiting for incoming-room readiness.

4. **Incoming readiness:** Must all required incoming-room images and effects be ready before its snapshot and the transition begin, or may a timeout initiate a fallback transition?

   **Agreed decision:** Required incoming images and room-space presentation cues, including highlights, outlines, silhouettes, and comparable effects, must be applied and rendered before capture. HUD activity is delayed until the transition completes and the room becomes live. A finite readiness timeout enters the agreed failure path rather than capturing an incomplete room.

5. **Updates during transition:** Should session updates continue to update the hidden incoming live scene and appear only when the transition completes?

   **Agreed decision:** Superseded by the polling-coordination decision. When a received delta contains an accepted room change, pause the serial polling pump before another delta request begins. Preserve the active watermark and polling generation, keep transition snapshots immutable, delay HUD activity, make the incoming room live, and then resume polling from the preserved watermark. Do not implement pause by toggling the polling hook's existing `enabled` flag. Server-side changes accumulated during the pause are retrieved afterward through normal delta or resync behavior.

6. **Superseding room changes:** When another room change arrives mid-transition, should the current transition finish, be replaced immediately, or jump to its destination before starting the next transition?

   **Agreed decision:** Complete the current transition immediately to its destination, dispose its transition resources, and then begin the next transition from that known room state. Collapse intermediate queued changes where possible so rendering advances toward the latest authoritative room.

7. **Draw order:** Should the incoming snapshot always render above the outgoing snapshot in overlap regions, or should ordering depend on effect or travel direction?

   **Agreed decision:** Bounded slide snapshots must be adjacent and must not intentionally overlap. Assign deterministic ordering as a defensive implementation detail, but it should not affect slide visuals. Future effects such as page turns define their own effect-specific ordering.

8. **Mixed room dimensions:** Should the incoming room bounds define the transition viewport, preserving current behavior, or should both snapshots be normalized into a separate transition canvas?

   **Agreed decision:** Normalize both bounded rooms into a common transition canvas equal to the renderer viewport, using the normal contain-fit and centering behavior. Slides between materially different room sizes or shapes remain supported but are not the preferred presentation; other transition effects will normally be selected for those cases.

9. **Capture resolution:** Should transition snapshots use logical room resolution, renderer/device resolution, or a configurable capped resolution?

   **Agreed decision:** Match the renderer's actual output resolution, subject to a configurable maximum texture dimension or pixel budget and the GPU texture limit. Do not automatically multiply by raw device pixel ratio unless the renderer itself uses that resolution. Future map thumbnails use an independent lower-resolution profile.

10. **Failure fallback:** If either snapshot cannot be created, should the renderer perform an immediate live-room swap or fall back to the existing fade-blackout transition?

    **Agreed decision:** Fall back first to the existing live-surface fade-blackout transition. If that cannot run, perform an immediate live-room commit. Emit diagnostics for either fallback. Incoming asset timeout follows the same policy and must not produce a knowingly incomplete snapshot.

11. **Initial effect scope:** Should only slide transitions move to snapshots initially, or should fade and fade-blackout use the same snapshot pipeline in the first implementation?

    **Agreed decision:** Convert slide transitions only. Leave fade and fade-blackout unchanged, with fade-blackout retained as the snapshot-failure fallback. Keep the snapshot seam reusable by future page-turn and other whole-room effects.

12. **Future map capture moment:** For eventual discovered-map thumbnails, should the saved image represent first entry, most recent entry, or a separately defined stable moment after the room transition completes?

    **Agreed decision:** Use both an entry and exit capture. Capture on entry after the transition completes, the room becomes live, and at least one complete live frame renders. Capture again immediately when an exit room change is accepted, before the outgoing room is changed or removed. The exit capture should share the outgoing transition capture operation where practical, while persistence remains a separate future responsibility.

13. **Future map refresh policy:** When a known room is revisited, should its stored thumbnail always be replaced, replaced only when materially changed, or retain its first-discovered appearance?

    **Agreed decision:** Replace the stored thumbnail after every successful entry capture and again after every successful exit capture. Retain the previous successful thumbnail if a later capture fails. Do not add material-change image comparison.

14. **Snapshot API ownership:** Should the reusable capture API remain internal to the Pixi renderer initially, or be exposed through the public `GameRendererHandle` now for future consumers?

    **Agreed decision:** Keep the API internal for now and implement it as a separate renderer service with a clean interface. Add a clear code comment block explaining its intended future reuse for discovered-map room thumbnails, including that future persistence, encoding, and player-exclusion policy remain outside the initial transition implementation.

## Expected implementation footprint

- Primary changes in the Pixi renderer and a small adjacent snapshot/transition helper.
- A contained pause/resume addition to the session-delta polling hook plus transition-lifecycle coordination in the host renderer workflow.
- Focused polling, orchestration, renderer-lifecycle, and visual-transition tests.
- No host-contract, server, map, persistence, or lighting changes in this effort.
