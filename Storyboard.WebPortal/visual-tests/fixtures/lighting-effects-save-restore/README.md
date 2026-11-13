# Lighting effects Host fixtures

These are actual Host baseline wire payloads produced by Engine test `LightingEffectsSaveRestoreRegressionTests.HostCaptureJsonAlterLoad_RestoresLightingStateAndRetainsRuntimeAssets`. Portal consumes them as deterministic mock-Host fixtures through its existing client, session, mapper, and renderer pipeline. This browser regression does not run backend persistence or capture a live Host.

## Producer and provenance

- `StoryBoard.SampleProjects` resolved through the existing floating reference to `1.0.10-local.20261113.t133939109`. Package SHA-256: `C05F803535563BB5F64E4C9223F5285493BE6F94BF1CE2DFED8040CE8C87DA55`.
- Runtime export `Samples/LightingEffectsTest/GameRuntimeJson/LightingEffectsTest.sbr.runtime.json`; SHA-256: `F9F043549C0421DAE64FA245BCDD7171836A90357AEA667C535B0A223D8D08BD`. All 70 configured room images have explicit placements with valid coordinate sums.
- Engine's explicit-placement regression passed and generated these payloads through the normal capture → serialize/deserialize → disturb → load sequence. Contracts resolved to `1.0.24-local.20261112.t181749714`; package SHA-256: `2CA93AE56DC87644933F7EB6B2A0D6DAD7B9F5150FEA43ED4C9060992C30F61B`.
- Source files: `C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Tests\Fixtures\LightingEffectsSaveRestore\Host\`.
- Engine's five fixture SHA-256 values are recorded below and match the Portal copies exactly.

The restored same-room and changed-room payloads select Winter — Evening and deliver ambient `0.608` / `#ACB7CC`. The changed-room altered baseline is Seasonal Shelter; the same-room altered baseline captures the same-room disturbance. `before.json` is Lifecycle & Restore before capture. The payloads are Engine-produced; no save envelope or synthesized payload is included here.

| File | Meaning | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `Host/before.json` | Lifecycle & Restore before capture; Winter — Evening | 24,218 | `51DE5F592B369AED40BF9B8315E758C0F6E528D894CEB3A3310708BD12F425D2` |
| `Host/altered.json` | Changed-room disturbance in Seasonal Shelter | 23,951 | `26B1921F4A3DD93958716BDD151ED1EF5FD2299D7BDB3D7E7285EB11C171301C` |
| `Host/restored.json` | Changed-room restore; Lifecycle & Restore, Winter — Evening | 24,123 | `EE2D2BFFC0F54C99167AEAFEA048AD1E5A8B2D17ACE03B87D9BA639211EEECF2` |
| `Host/same-room-altered.json` | Same-room disturbance before load | 26,101 | `6CE99D30DED4E56BDE5C8FC71ADD7F67DE5573A0E8E814D300DCA3A625B2C641` |
| `Host/same-room-restored.json` | Same-room restore; Lifecycle & Restore, Winter — Evening | 24,123 | `EE2D2BFFC0F54C99167AEAFEA048AD1E5A8B2D17ACE03B87D9BA639211EEECF2` |

`Assets/custom-candle-leaf.png` remains the custom image golden. It is served at locator `assets/images/_shared/6af009fe71514e5d4d86136d404e7c2a82cb1c8e2a9356cffe28eedbc88a2297f__leaf.png`, effect `particle.candle`, slot `flame-tip`; length 7,753 bytes, SHA-256 `6AF009FE71514E5D4D86136D404E7C2A82CB1C8E2A9356CFF28EEDBC88A2297F`.

For category-inheritance closeout 10, `presentation-effects.catalog.json` remains copied verbatim from `C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Configuration\Config\presentation-effects.catalog.json` (Engine current catalog).

## Portal consumer validation

The existing `host-restore-regression.spec.ts` runs both same-room and changed-room scenarios. It gets the restore scene from the fresh baseline, then validates fixture-driven ambient/effect state, object and light/source positions, effect tuning and enablement, custom-image retrieval/bytes, no stale burst or duplicate effect IDs, and a subsequent ordinary delta update. The test does not assert phase selection; Engine owns that persistence proof.

Validation result for the fixture refresh is recorded in `PARTICLE_EFFECT_INTEGRATION_CLOSEOUT_04B_PORTAL_HANDOFF.md`. This is mock-Host consumer validation, not live backend capture/load.
