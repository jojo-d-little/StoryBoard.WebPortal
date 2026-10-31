# Lighting effects Host fixtures

These are actual Host baseline wire payloads produced by Engine test `LightingEffectsSaveRestoreRegressionTests.HostCaptureJsonAlterLoad_RestoresLightingStateAndRetainsRuntimeAssets`. Portal consumes them as deterministic mock-Host fixtures through its existing client, session, mapper, and renderer pipeline. This browser regression does not run backend persistence or capture a live Host.

## Producer and provenance

- `StoryBoard.SampleProjects` resolved through the existing floating reference to `1.0.7-local.20261030.t131815836`. Package SHA-256: `6A7446A907EF4F8417B91D1EE48452BCA27E0B2346DE650978924580A3A00549`.
- Runtime export `Samples/LightingEffectsTest/GameRuntimeJson/LightingEffectsTest.sbr.runtime.json`; SHA-256: `83D4AE8BF618B778A2D1DA8D43D3FC33BE94588D0B426A42E1B9CF486EDF1B3C`.
- Engine's regression passed after the 04C active-phase selector correction. Contracts resolved to `1.0.21-local.20261030.t141203238`; package SHA-256: `3DE9C59AEB74ACD2682435D727C5F062E24D024C34344A060FC9A151455FEB69`.
- Source files: `C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Tests\Fixtures\LightingEffectsSaveRestore\Host\`.
- Engine's five fixture SHA-256 values are recorded below and match the Portal copies exactly.

The restored same-room and changed-room payloads select Winter — Evening and deliver ambient `0.608` / `#ACB7CC`. The changed-room altered baseline is Seasonal Shelter; the same-room altered baseline captures the same-room disturbance. `before.json` is Lifecycle & Restore before capture. The payloads are Engine-produced; no save envelope or synthesized payload is included here.

| File | Meaning | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `Host/before.json` | Lifecycle & Restore before capture; Winter — Evening | 23,795 | `944FE6F64A53441BF084606EDDDE8676568B6FC319D92D6F79318F47DE0711F0` |
| `Host/altered.json` | Changed-room disturbance in Seasonal Shelter | 21,848 | `5B6E5656B32B0D05C12035A5F48C5E259E81C48D1EA4E69223EA1CB904313199` |
| `Host/restored.json` | Changed-room restore; Lifecycle & Restore, Winter — Evening | 23,700 | `CF1317CAD3D1058809C854EF29CD38DBC2DBA48B1B1DA77C610837E14110643F` |
| `Host/same-room-altered.json` | Same-room disturbance before load | 25,678 | `77B067864FAB90000AD5F966DC83D9CCF4313C67F502E9DFE8BFFE2B7692B57A` |
| `Host/same-room-restored.json` | Same-room restore; Lifecycle & Restore, Winter — Evening | 23,700 | `CF1317CAD3D1058809C854EF29CD38DBC2DBA48B1B1DA77C610837E14110643F` |

`Assets/custom-candle-leaf.png` remains the custom image golden. It is served at locator `assets/images/_shared/6af009fe71514e5d4d86136d404e7c2a82cb1c8e2a9356cffe28eedbc88a2297f__leaf.png`, effect `particle.candle`, slot `flame-tip`; length 7,753 bytes, SHA-256 `6AF009FE71514E5D4D86136D404E7C2A82CB1C8E2A9356CFF28EEDBC88A2297F`.

For category-inheritance closeout 10, `presentation-effects.catalog.json` remains copied verbatim from `C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Configuration\Config\presentation-effects.catalog.json` (Engine current catalog).

## Portal consumer validation

The existing `host-restore-regression.spec.ts` runs both same-room and changed-room scenarios. It gets the restore scene from the fresh baseline, then validates fixture-driven ambient/effect state, object and light/source positions, effect tuning and enablement, custom-image retrieval/bytes, no stale burst or duplicate effect IDs, and a subsequent ordinary delta update. The test does not assert phase selection; Engine owns that persistence proof.

Validation result for the fixture refresh is recorded in `PARTICLE_EFFECT_INTEGRATION_CLOSEOUT_04B_PORTAL_HANDOFF.md`. This is mock-Host consumer validation, not live backend capture/load.
