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

Controllers should expose a minimal predictable API. Example:

Canonical location for shared contracts:

1. src/gameRenderer/pixi/effects/contracts/ObjectEffectController.ts

```ts
import type { Sprite } from "pixi.js";
import type { GameRendererDiagnosticsSink } from "../diagnostics/RendererDiagnostics";

export interface ObjectEffectController<TStyle> {
  applyForObject: (objectId: string, objectName: string, sprite: Sprite, style: TStyle | undefined) => void;
  syncObjectTransform: (objectId: string, sprite: Sprite) => void;
  tick: (nowMs: number, deltaMs: number) => void;
  removeObject: (objectId: string) => void;
  clear: () => void;
  dispose: () => void;
}

export interface CreateObjectEffectControllerOptions {
  diagnostics?: GameRendererDiagnosticsSink;
  isDisposed: () => boolean;
}
```

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

1. src/gameRenderer/pixi/effects/<effectName>/<effectName>Controller.ts
2. src/gameRenderer/pixi/effects/<effectName>/<effectName>Controller.test.ts
3. src/gameRenderer/presentationCue/<effectName>Resolver.ts (if separate from existing resolver module)

This convention is guidance, not a hard rule. Keep file naming and placement consistent across new effect modules.
