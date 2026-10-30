# Lighting effects Host fixtures

These payloads were captured from `ISessionDeltaPolling.GetSessionBaseline` by Engine test `LightingEffectsSaveRestoreRegressionTests.HostCaptureJsonAlterLoad_RestoresLightingStateAndRetainsRuntimeAssets`. They are Engine-produced Host wire payloads used here as a deterministic mock Host consumer fixture; this browser test does not perform backend persistence.

Producer identity: `StoryBoard.SampleProjects` `1.0.7-local.20261028.t192501418`, package SHA-256 `4AA4C4C29DDD28977CFDEAE6993EB5803BE19FC8A9BF96C1EEB09B6F30ECB60B`; runtime export SHA-256 `5C67848A94A933E31617FA9C5FFD2CF845C65B19E305C61A2E823777092F6F8B`.

`Host/` includes the actual before, altered, and restored baseline payloads for changed-room restoration, plus same-room altered/restored baselines. `Assets/custom-candle-leaf.png` is the 7,753-byte custom image returned by Host locator `assets/images/_shared/6af009fe71514e5d4d86136d404e7c2a82cb1c8e2a9356cffe28eedbc88a2297f__leaf.png` (SHA-256 `6AF009FE71514E5D4D86136D404E7C2A82CB1C8E2A9356CFF28EEDBC88A2297F`), mapped to `particle.candle` / `flame-tip`.

The producer reports an Engine/shared-contract gap: restored payload has Spring — Dawn and ambient `0.624` / `#FFE2B5`; active Winter — Evening cannot be restored until the shared save snapshot contains a phase selector. `before.json` retains the saved `0.608` / `#ACB7CC` lighting for Portal's saved scene state.

For category-inheritance closeout 10, `presentation-effects.catalog.json` is refreshed verbatim from `C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Configuration\Config\presentation-effects.catalog.json` (Engine current catalog) so the browser restore test consumes the producer's current category IDs and unchanged recipes.
