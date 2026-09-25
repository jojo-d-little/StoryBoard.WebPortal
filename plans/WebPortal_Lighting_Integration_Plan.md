# WebPortal Lighting Integration Plan

## Status

Planning only. This document defines the WebPortal work required after the
Designer and host contract work supplies lighting data. It does not authorize
package installation or implementation yet.

The plan is intentionally based on a host contract that contains a resolved,
renderer-ready lighting block. The exact contract names and version remain to
be agreed with the Designer and host work.

## Objective

Integrate `@jojo-d-little/storyboard-lighting` into the Pixi game renderer with
minimal disruption to existing room rendering.

Lighting must be an optional presentation stage:

```text
reconcile room scene
        |
        v
render current room surface
        |
        +-- lighting disabled --> present existing room surface
        |
        `-- lighting enabled ---> render room texture -> lighting pipeline
                                      -> present composed texture
```

The existing room reconciliation, object effects, input mapping, viewport
scaling, HUD, and transition orchestration should not need to know about
individual lights.

## Non-goals

- Do not implement Designer authoring or host serialization in this work.
- Do not make the renderer interpret Designer-specific object metadata.
- Do not move lighting calculations into WebPortal.
- Do not make lighting depend on viewport dimensions, camera offsets, or DOM
  coordinates.
- Do not require lighting to be present for a room to render successfully.
- Do not apply lighting to viewport HUD or transition UI.
- Do not use the lighting output as the next frame's room source texture.

## Current renderer facts

The integration must fit these existing characteristics:

- [`PixiGameRenderer.ts`](../Storyboard.WebPortal/src/gameRenderer/pixi/PixiGameRenderer.ts)
  creates `Application`, initializes Pixi asynchronously, owns the ticker, and
  owns active and staging room surfaces.
- [`SessionPlaySurfaceRendererV1.tsx`](../Storyboard.WebPortal/src/components/SessionPlaySurfaceRendererV1.tsx)
  creates the renderer, sends scene updates, and sends viewport resize events.
- [`GameRenderSceneSnapshot`](../Storyboard.WebPortal/src/gameRenderer/contracts/sceneTypes/GameRenderSceneSnapshot.ts)
  currently carries room bounds, directional overlays, room objects, HUD
  entries, and transition metadata, but no lighting data.
- Room content is currently represented by Pixi containers containing overlays,
  room objects, and room-space effects. There is not currently a dedicated
  host-supplied room/albedo texture.
- Room transitions already have a bounded snapshot seam. The existing snapshot
  plan expects the final room composite—including future lighting—to feed that
  seam.
- Viewport presentation uses a contain transform applied to the room stage.
  Lighting inputs and outputs must stay in logical room pixels before that
  transform.

## Recommended integration boundary

Add a dedicated renderer-owned adapter, tentatively:

```text
src/gameRenderer/pixi/lighting/
  RoomLightingController.ts
  RoomLightingController.test.ts
  mapLightingData.ts
  mapLightingData.test.ts
```

The controller should be the only WebPortal module that imports
`TopDownLightingPipeline`.

Its responsibilities should be limited to:

1. Creating the pipeline after `app.init()` has completed.
2. Owning a host-created room source `RenderTexture`.
3. Rendering a selected room surface into that source texture.
4. Passing the resolved host lighting block to `submitFrame()`.
5. Calling `renderFrame()` with an absolute clock value.
6. Presenting either the raw room surface or `composedTexture`.
7. Resizing room-space targets when room geometry changes.
8. Replacing and disposing borrowed textures safely.
9. Falling back to the raw room surface if lighting is disabled or cannot be
   initialized.

The main Pixi coordinator should only orchestrate the controller. It should not
map individual lights, construct shader payloads, or own lighting resource
details.

## Feature-gate design

The lighting feature should participate in the same advanced-presentation
settings mechanism used for other optional renderer features.

The desired coordinator shape is conceptually:

```ts
renderRoomFrame(timeSeconds): void {
  if (lightingEnabled) {
    renderRoomSurfaceToSourceTexture();
    lightingController.renderEnabledFrame(timeSeconds);
  } else {
    lightingController.presentRawRoomSurface();
  }
}
```

The exact implementation may use a controller method rather than a literal
inline `if`, but the behavioral requirement is the same: one narrow gate at the
final room-presentation point.

When the feature is disabled:

- the current room rendering path remains visible;
- no offscreen room-source render is performed;
- no lighting frame is submitted or rendered;
- the composed output is hidden or detached from presentation;
- room reconciliation and animation continue normally;
- lighting resources may remain allocated for a cheap runtime toggle, or be
  released on a deliberately chosen lifecycle boundary.

When the feature is enabled:

- the raw room surface is rendered into the separate source texture;
- the current host lighting data is submitted;
- the lighting pipeline renders using absolute seconds;
- only the composed room texture is presented;
- HUD and viewport overlays remain outside the lit room surface.

The plan should choose whether the setting is fixed for a renderer lifetime or
can change live. If live toggling is required, the controller must make the
raw/composed presentation switch atomic at a frame boundary.

## Pixi and resource lifecycle

### Initialization

The current renderer initializes Pixi asynchronously. The final implementation
must create the lighting pipeline only after:

1. `app.init({ preference: "webgl", ... })` resolves;
2. `app.renderer` is available;
3. the renderer's room presentation layers have been attached.

Scene updates that arrive before initialization completes must continue to use
the existing queued/latest-scene behavior. They must not call lighting methods
against a partially initialized pipeline.

### Source texture

The preferred source is a stable host-owned `RenderTexture` containing the
current room-space composition. It must remain separate from
`outputs.composedTexture`.

The source texture should be recreated or resized only when logical room
geometry changes. It should not be recreated for browser viewport changes.

The source should contain room-space content selected by the locked scope:

- room/albedo content;
- included directional overlays;
- included room objects and effects;
- no HUD or viewport-level transition UI.

The renderer must not render the composed lighting sprite back into the source
texture.

### Ownership

WebPortal should pass the source texture as `ownership: "borrowed"`.

The controller owns the source texture lifecycle. The lighting package owns its
intermediate and output targets. The controller must dispose the pipeline before
destroying the source texture or Pixi renderer.

### Shutdown

The renderer teardown sequence must be:

1. stop or detach frame work;
2. dispose transition snapshots and other room captures;
3. dispose the lighting controller/pipeline;
4. destroy the host-owned source texture;
5. destroy the Pixi application and renderer.

All steps must be safe on partial initialization and repeated disposal.

## Room composition and presentation

The preferred structure is:

```text
active/staging live room surface
        |
        +--> raw presentation when lighting is disabled
        |
        `--> host RenderTexture
                 |
                 `--> TopDownLightingPipeline
                         |
                         `--> composedTexture
                                  |
                                  `--> room presentation when enabled
```

The composed output must use the same logical room dimensions and transform as
the raw room surface. The existing contain transform remains responsible for
letterboxing and viewport placement.

The plan must lock down whether the lighting controller renders:

- only the active surface during normal play; and
- the staging surface into the same source/pipeline during transition
  preparation.

The recommended minimal-resource design is one pipeline and one source target:

1. Capture or freeze the outgoing final room image at the existing transition
   boundary.
2. Render the incoming staging surface into the source texture.
3. Produce and capture the incoming composed result.
4. Animate the existing bounded transition snapshots.
5. Switch the live pipeline/source association to the incoming room after the
   transition.

Use two simultaneous pipelines only if testing proves that one pipeline cannot
prepare the incoming room without disturbing the outgoing snapshot.

## Frame sequencing

The implementation plan must establish a deterministic ordering relative to the
existing ticker callbacks:

1. Apply any current movement/effect tick for the frame.
2. Reconcile or finish the current room surface as required by the existing
   renderer lifecycle.
3. If lighting is enabled:
   - render the selected room surface into the lighting source texture;
   - submit the latest room lighting payload;
   - call `renderFrame(ticker.lastTime / 1000)` or an equivalent monotonic
     absolute clock;
   - present the composed output.
4. If lighting is disabled, keep the existing raw room presentation visible and
   skip the source-texture and lighting calls.
5. Run viewport-only HUD and presentation updates outside the lighting source.

The exact ordering of existing movement and transition ticker callbacks must be
verified in a focused renderer test. The important invariant is that the source
texture reflects the same visual state that the composed output represents.

If asset reconciliation is asynchronous, the controller must render only after
the relevant surface is ready. A late asset completion must not cause an older
lighting frame to replace a newer room.

## Host lighting payload expected by WebPortal

The WebPortal adapter should receive a renderer-neutral block and map it to the
lighting package's `LightingFrameInput`. It should not pass Designer-specific
types directly into the package.

The minimum useful shape is described in the companion document:

[Lighting Data Contract Designer Handover](Lighting_Data_Contract_Designer_Handover.md)

At a high level, WebPortal needs:

- room dimensions in room pixels;
- `cellSizePx` in the same room-pixel coordinate system;
- room-level ambient and shared light appearance settings;
- a list of point lights with room-space positions;
- optional animation and color properties for each point light;
- optional blockers if the first contract includes occlusion authoring.

The adapter must define defaults and normalization for missing optional data.
An absent lighting block should be treated as a valid “no authored lighting”
state, not as a renderer failure.

## Coordinate and geometry rules

The adapter must enforce these rules at one boundary:

- room `(0, 0)` is the top-left of the logical room;
- light `x`/`y` values are room-space pixels;
- blocker cell positions are integer room-cell coordinates;
- `widthPx` and `heightPx` match the source texture dimensions;
- `cellSizePx` is expressed in those same internal pixels;
- viewport scale, letterboxing, camera offset, CSS size, and browser canvas
  position never enter the lighting payload;
- `lighting.resize()` is called for room geometry changes only.

Add pure mapping tests that use a non-1 viewport scale and letterboxed viewport
to prove that light positions remain unchanged.

## Room-grid diagnostic overlay

Because `cellSizePx` becomes part of the renderer-visible room contract, add a
developer-only grid overlay to WebPortal's Dev Tools. This is a diagnostic
consumer of room geometry, not a Lighting package feature.

### Recommended implementation

Use one Pixi `Graphics` object in a dedicated room diagnostic layer. Draw the
vertical and horizontal grid lines in logical room coordinates:

```text
room-space Graphics
  vertical lines:   x = 0, cellSizePx, 2 * cellSizePx, ...
  horizontal lines: y = 0, cellSizePx, 2 * cellSizePx, ...
```

Do not generate a transparent image or render texture for the grid. A graphics
overlay is preferable because:

- it uses no additional room-sized texture memory;
- it stays crisp when the room is scaled or letterboxed;
- it can be rebuilt only when room width, height, or cell size changes;
- it has no asset-loading or texture-ownership lifecycle;
- its visibility can be toggled without changing the room source or lighting
  pipeline.

The layer should be attached inside the room presentation transform so it uses
the same `stageRoot` scale and position as the room. It must be above the raw
or composed room presentation but outside the room source capture. Therefore:

- the grid is never rendered into the lighting source texture;
- the grid is not included in composed lighting output;
- the grid is not included in room transition snapshots;
- the grid does not affect pointer hit testing or room-coordinate mapping;
- the grid remains aligned with the room under viewport resizing.

The renderer handle should expose a narrow method such as:

```ts
setGridOverlayEnabled(enabled: boolean): void;
```

The Dev Tools checkbox updates that setting for the active renderer. The
setting should be session-only and default to off. It should be placed in a
visual/renderer diagnostics section rather than in the host contract or
lighting settings.

The renderer-neutral scene snapshot should carry the room's `cellSizePx`,
probably as part of a small room-grid/geometry value rather than requiring the
diagnostic layer to inspect host DTOs directly. The grid should be cleared or
hidden when no valid cell size is available.

### Geometry and performance rules

- Draw through the room width and height, including the right and bottom room
  edges when they are not exact cell multiples.
- Normalize invalid or non-positive cell sizes before drawing.
- Rebuild the `Graphics` geometry only when room geometry or style changes.
- Do not create one Pixi display object per cell.
- Keep line color, alpha, and width as diagnostic constants initially; expose
  additional styling only if visual debugging needs it.
- If a pathological room would produce an excessive line count, emit a
  diagnostic and suppress or coarsen the overlay rather than impacting normal
  rendering.

During snapshot-based transitions, the simplest behavior is to hide the live
grid with the live room surfaces. If transition debugging later requires the
grid over frozen snapshots, add a separate snapshot diagnostic layer; do not
put the live grid into the captured room texture.

## Transition integration

The existing room snapshot system should remain the transition owner. Lighting
should feed it the final room image rather than introducing a second transition
system.

Required behavior:

- outgoing slide snapshots contain the completed outgoing lighting result;
- incoming slide snapshots contain the incoming room's lighting result;
- fade and fade-blackout retain their current fallback behavior;
- transition UI and HUD remain outside lighting and snapshots as currently
  defined;
- a room change does not reuse the previous room's source texture or lighting
  payload;
- snapshot disposal remains independent and exactly-once;
- a failed lighting render can fall back to an unlit room instead of making the
  room unavailable.

The plan should add a final-composite capture seam if the current snapshot
implementation still captures only a raw room container. That seam should work
for both lighting-enabled and lighting-disabled presentation.

## Implementation phases after contract readiness

### Phase 1: Lock the seam and contract adapter

- Confirm the host payload shape and version.
- Confirm which room layers are lit.
- Confirm the feature-setting source and runtime toggle behavior.
- Add the renderer-neutral WebPortal lighting types.
- Add the renderer-neutral room-grid/cell-size value needed by lighting and the
  diagnostic overlay.
- Add pure mapping/default tests.
- Confirm the published lighting package version and clean-install path.

### Phase 2: Add the isolated controller

- Add `RoomLightingController` and its resource ownership rules.
- Create the pipeline after Pixi WebGL initialization.
- Add the stable host-owned source texture.
- Add raw/composed presentation switching.
- Add room-geometry resize handling.
- Add the room-grid diagnostic layer and Dev Tools toggle without including it
  in lighting input.
- Add diagnostics for initialization, frame failures, capacity truncation, and
  disposal.

### Phase 3: Connect the single frame seam

- Invoke the controller after room content is rendered and before final room
  presentation.
- Keep the enabled/disabled decision at that seam.
- Pass absolute time.
- Verify that the disabled path has no lighting render call and remains visually
  equivalent to the current renderer.

### Phase 4: Connect transitions and room replacement

- Feed final lit/unlit room output into the existing snapshot boundary.
- Validate active/staging handoff with one pipeline.
- Handle room geometry changes and source texture replacement.
- Exercise capture failure, lighting failure, cancellation, and disposal paths.

### Phase 5: Browser validation and rollout

- Run the existing unit, build, and visual suites.
- Add lighting visual baselines.
- Measure representative room sizes and light counts.
- Roll out with lighting disabled by default until the visual and performance
  gates pass.
- Enable it deliberately through the advanced presentation setting.

## Validation matrix

### Functional

- Lighting disabled produces the existing room image.
- Lighting enabled with no lights applies the expected ambient result.
- One static object light appears at the expected room-space position.
- Multiple lights are rendered without viewport-coordinate drift.
- Animated lights are deterministic for a fixed absolute time.
- Missing optional lighting data does not break room rendering.
- Room replacement does not retain the prior room's lights or texture.
- Geometry changes resize lighting targets exactly once per geometry change.
- Browser viewport resize does not call lighting `resize()`.
- Grid overlay aligns with room boundaries at multiple viewport scales and
  letterboxing configurations.
- Grid overlay is absent from the lighting source texture and transition
  snapshots.
- Grid toggle does not alter pointer-to-room coordinate mapping.
- Repeated enable/disable does not duplicate sprites, textures, or ticker work.

### Transition

- Outgoing and incoming snapshots contain the correct lighting state.
- Slide, fade, and blackout transitions remain visually valid.
- A failed lighting frame falls back safely to unlit presentation.
- Transition cancellation and renderer disposal release all resources.

### Resource and performance

- Borrowed source textures are destroyed by WebPortal, not the package.
- Package-owned outputs are disposed by the pipeline.
- Light and blocker capacity limits are visible in diagnostics.
- No additional per-frame work is done when lighting is disabled beyond the
  feature-gate check and normal room rendering.
- Representative room sizes remain within the agreed GPU memory and frame-time
  budgets.

## Completion gate for implementation readiness

Implementation can begin only when the plan has confirmed:

1. The exact published package version and installation path.
2. The authoritative host lighting payload and its versioning policy.
3. Which room layers are included in albedo and which remain outside it.
4. The single WebPortal frame seam and feature-gate owner.
5. The active/staging transition strategy.
6. The room geometry and coordinate rules.
7. The source/output texture ownership and disposal order.
8. The disabled-path equivalence test.
9. The visual and performance acceptance thresholds.

Until those decisions are complete, the lighting package should remain an
unreferenced planning dependency in WebPortal.
