# Game Renderer Module

This folder contains the Pixi-native game renderer stack for WebPortal.

Principles:

1. Functional parity with runtime-host outputs, not WPF implementation parity.
2. Renderer-neutral scene contracts at the boundary.
3. Pixi-only concerns inside the pixi layer.
4. Host API concerns outside this module.

Folder responsibilities:

1. contracts/: renderer-neutral types and intent contracts.
2. scene/: pure mapping and deterministic scene preparation.
3. pixi/: stage lifecycle, containers, sprites, clipping, disposal.
4. adapters/: boundary adapters, including asset resolution contracts.
5. interaction/: pointer intent contracts and translation helpers.
6. diagnostics/: renderer diagnostics event contracts.
7. testing/: shared fixtures and test helpers.

Public entrypoint:

- Use src/gameRenderer/index.ts only.
- Treat all other files as internal unless explicitly exported.

Renderer effects architecture:

- Follow the modular effect-controller pattern described in src/gameRenderer/RENDERER_EFFECTS_ARCHITECTURE.md.
- New cue/effect features should start in dedicated modules instead of extending the Pixi coordinator directly.
