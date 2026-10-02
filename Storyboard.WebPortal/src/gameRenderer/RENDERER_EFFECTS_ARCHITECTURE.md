# Renderer Effects Architecture

Purpose: establish a default implementation pattern so new visual cues/effects start modular, testable, and supportable.

Scope:

1. Applies to new and modified visual effect work in WebPortal game renderer modules.
2. Applies to cue-driven visual behavior (appearance, movement-adjacent visuals, particles, shader passes, and related overlays).

## Core Rule

Do not implement new effect logic directly inside the main Pixi coordinator flow unless there is a strong, documented reason.

Default approach:

1. Resolve cue data in resolver modules.
2. Implement visual behavior in a dedicated effect controller module.
3. Keep coordinator responsibility limited to orchestration (route scene data, call controller lifecycle methods, and tick).

## Layering Model

Object cue data follows two stages. `presentationCues` carries Host activation identity
and change-associated movement timing. Catalog resolution produces
`resolvedObjectEffects`, a typed list of visual effects with validated styles. Point,
outline, silhouette, Shake, and Scale use this list. Movement timing remains on the
movement path because it describes a room-coordinate transition rather than an
object visual effect. Effect keys are opaque identifiers; category and catalog style
fields decide the rendering behavior. The older direct outline, silhouette, and point
style fields remain only for callers that construct renderer scenes directly.

The Portal names visual families after the catalog property that defines them:

| Catalog property | Catalog input type | Resolved effect kind | Pixi controller folder |
| --- | --- | --- | --- |
| `appearanceOutlineStyle` | `CatalogAppearanceOutlineStyle` | `appearanceOutlineStyle` | `appearanceOutlineStyle` |
| `appearanceSilhouetteStyle` | `CatalogAppearanceSilhouetteStyle` | `appearanceSilhouetteStyle` | `appearanceSilhouetteStyle` |
| `shakeStyle` | `CatalogShakeStyle` | `shakeStyle` | `shakeStyle` |
| `scaleStyle` | `CatalogScaleStyle` | `scaleStyle` | `scaleStyle` |
| `styledPointEffect` | `CatalogStyledPointEffect` | `styledPointEffect` | `styledPointEffect` |

Catalog input interfaces and validated render DTOs live together in
`contracts/presentationEffects/`, with `contracts/presentationEffects.ts` as their
entry point. Scene snapshots and object composition stay in `contracts/sceneTypes/`. Shake and Scale
have separate controllers; the Pixi object composition supplies their independent
position and scale containers. `GameRenderPresentationCue` is the adapter's merged cue
reference. Its movement fields are defined by `GameRenderMovementCueMetadata` because
change-associated movement cues carry timing alongside active cue identity.

1. Cue Resolver Layer
- Pure data normalization from scene cues/catalog into render-ready effect config.
- No Pixi object creation and no renderer lifecycle state.
- Prefer pure-function tests.

2. Effect Controller Layer
- One module per effect family.
- Owns effect-local runtime state maps keyed by room object id.
- Owns apply/remove/cleanup behavior for render nodes.
- Owns frame update (pulse, fade, drift, shader uniforms, etc.).

3. Renderer Composition Layer
- Registers and invokes controllers.
- Routes scene room object snapshots to controllers.
- Calls per-frame tick for active controllers.
- Handles room-surface lifecycle and global teardown.

## Standard Controller Contract

Controllers should expose a minimal predictable API. The outline and silhouette
controllers use the shared contract in
`src/gameRenderer/pixi/effects/contracts/ObjectEffectController.ts`:

```ts
import type { Container, Sprite } from "pixi.js";

export interface ObjectEffectController<TStyle> {
  applyForObject: (objectId: string, objectName: string, transformHost: Container, sprite: Sprite, style: TStyle | undefined) => void;
  syncObjectTransform: (objectId: string, transformHost: Container, sprite: Sprite) => void;
  tick: (nowMs: number) => void;
  removeObject: (objectId: string) => void;
  clear: () => void;
}
```

Shake and Scale use narrower controller methods that receive their own transform
containers and resolved effect list. Point effects have a point-placement lifecycle.

## Coordinator Responsibilities

The coordinator should do the following and no more:

1. Resolve which objects need which effect styles.
2. Call applyForObject during reconciliation.
3. Call syncObjectTransform whenever object sprite transform changes.
4. Call tick during frame updates.
5. Call removeObject on object removal.
6. Call clear/dispose during surface reset and renderer dispose.

## Definition Of Done For New Effects

1. Modular implementation
- Effect logic is introduced in a dedicated module.
- Coordinator changes are orchestration-only and minimal.

2. Test coverage
- Resolver tests for cue/style parsing and normalization.
- Controller tests for apply/update/remove behavior.
- At least one regression for lifecycle transitions (toggle on/off, object removal, scene update stability).

3. Diagnostics
- Emit applied/removed lifecycle diagnostics.
- Emit warning diagnostics for invalid style/config values.

4. Performance guardrails
- No per-frame object allocations in hot loops.
- Stable state map keys and deterministic cleanup.
- Explicit cap or strategy documented for high-object-count scenarios.

## Performance Budget Guidance

Start simple and measurable:

1. Default target: near-zero added cost when no object has the effect.
2. Added cost should scale with active effected objects, not total room objects.
3. Expensive operations (pixel reads, heavy filters, shader compile/link) should be cached and amortized.

## Risk Management Strategy

Use two-stage rollout for non-trivial visuals:

1. Stage 1: low-risk fallback path (simple shape, no shader dependency).
2. Stage 2: advanced mode (silhouette glow, particles, shader pass) behind an internal toggle or guarded recipe path.

Do not mix extraction/refactor and visual behavior redesign in one change when avoidable.

## Pull Request Checklist

1. Effect logic is in its own module.
2. Coordinator changes are orchestration-only.
3. Resolver tests added/updated.
4. Controller behavior/lifecycle tests added/updated.
5. Cleanup path validated for scene reset and renderer dispose.
6. Diagnostics include apply/remove events.
7. Performance assumptions and limits are documented in PR notes.

## Suggested Folder Convention

When adding a new effect controller, use a discoverable structure:

1. `src/gameRenderer/pixi/effects/<catalogStyleProperty>/<EffectFamily>EffectController.ts`
2. `src/gameRenderer/pixi/effects/<catalogStyleProperty>/<EffectFamily>EffectController.test.ts`
3. `src/gameRenderer/presentationCue/<EffectFamily>Resolver.ts` if separate from the shared resolver

This convention is guidance, not a hard rule. Keep file naming and placement consistent across new effect modules.
