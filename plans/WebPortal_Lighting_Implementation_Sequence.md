# WebPortal lighting: implementation sequence

Use the [detailed plan](WebPortal_Lighting_Detailed_Implementation_Plan.md) for field mappings, ownership rules, transition behavior, and acceptance checks. The [newer Host handoff](LIGHTING_WEBPORTAL_HANDOFF.md) takes precedence over the older portal plan where they differ.


## Current progress

Completed through step 3. The scene stores each Host object once in `objectsById`; sprite and lighting data are optional components on that object. The pure mapper now produces room geometry and a complete Lighting frame from that state. Step 4 is next.

## Implementation checklist

1. **[x] Prepare dependencies and contracts**
   - [x] Refresh the npm package references, including `@jojo-d-little/storyboard-contracts` at `1.0.6` and the Lighting package using the project’s patch-range convention.
   - [x] Add the local Host TypeScript definitions needed for the new lighting contract fields, using the staged generated interfaces as the reference.
   - [x] Compare the local definitions with the staged contract interfaces and confirm the intentional local adaptation.

2. **[x] Retain complete Host lighting state**
   - [x] Carry session cell size, project defaults, room ambient, object lights, footprints, and occlusion into the renderer-neutral scene state.
   - [x] Preserve lighting state through baselines, resyncs, deltas, same-room `newRoom` changes, and session resets.
   - [x] Consolidate per-object state into `objectsById`, with optional sprite and lighting components on the same object record.
   - [x] Apply object changes as complete replacements and preserve image-free lighting objects in scene state.
   - [x] Verify the state mapping and compatibility paths with tests.

3. **[x] Create a pure mapping boundary**
   - [x] Map room pixels, effective ambient, current point lights, and blockers from renderer-neutral state to Lighting package inputs.
   - [x] Preserve explicit zero values and emit complete point-light and blocker arrays so removed objects cannot leave stale entries.
   - [x] Keep viewport transforms and sprite rendering coordinates out of package mapping.
   - [x] Add focused mapping tests for ambient-only, light-only, sprite-and-light, blocker-only, zero values, invalid inputs, and capacity overflow.

4. **[ ] Add one Pixi lighting controller**
   - [ ] After Pixi WebGL initialization, create the borrowed room-size source texture and package pipeline.
   - [ ] Submit the complete lighting frame and absolute time each enabled frame, then present the composed texture.
   - [ ] Keep the disabled and failed paths on the existing raw room surface; dispose owned GPU resources correctly.

5. **[ ] Wire the live Devtools switch**
   - [ ] Add a catalog-independent Lighting checkbox in Presentation Effects, initially off.
   - [ ] Make the master visual-effects switch suppress lighting as well.
   - [ ] Place the effective on/off branch at the room-presentation seam so the off path skips capture and package calls.

6. **[ ] Complete movement and transitions**
   - [ ] Interpolate object-owned light positions from Host before/after endpoints during presentation tweens; switch blocker cells at leg boundaries.
   - [ ] Feed final lit or raw room images to bounded transition captures.
   - [ ] Use one pipeline and frozen final images when outgoing and incoming rooms must appear together.

7. **[ ] Add the grid diagnostic and verify in the browser**
   - [ ] Add the separate, initially-off room-grid Devtools control.
   - [ ] Test ambient-only rooms, light-only objects, blockers and explicit zero, same-room phase changes, removals, older projects, room swaps, live toggling, viewport resize, and failure/disposal paths.
   - [ ] Run build, unit, and visual suites; measure representative GPU cost before changing the lighting default to on.
