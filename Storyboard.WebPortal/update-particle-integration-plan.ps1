$ErrorActionPreference = 'Stop'
$path = 'C:\work\GIT\StoryBoard.Architecture\plans\active\PARTICLE_EFFECT_INTEGRATION\PARTICLE_EFFECT_INTEGRATION_PLAN.md'
$content = [System.IO.File]::ReadAllText($path)
$oldRow = '| 12 | `StoryBoard.WebPortal` — rendering | After the Stage 09 Host contract and Stage 11 projection/discovery addenda → package/default/custom art loading from sparse style mappings, demand fetch, room-surface controller, lighting passes, interpolation, event playback, reconciliation and snapshot capture. | [12 WebPortal](PARTICLE_EFFECT_INTEGRATION_12_WEBPORTAL_HANDOFF.md) |'
$newRow = '| 12 | `StoryBoard.WebPortal` — rendering | Core implementation and burst diagnostics are in place. The 2026-10-27 real-package Chromium check confirms burst events emit at the expected anchors, duplicate IDs are ignored, async custom art loads, late-room events are rejected, and particles naturally decay. It also confirms sparks are practically imperceptible at the current one-particle-per-BurstId request and authored 4×2 px / 0.12–0.30 s recipe. Catalog/schema/package owners must agree on per-stream `burstCount` before Portal can render authored burst quantities. Stage 12 visual acceptance remains open pending that dependency, sample replay, and all-family validation. | [12 WebPortal](PARTICLE_EFFECT_INTEGRATION_12_WEBPORTAL_HANDOFF.md) |'
if ([regex]::Matches($content, [regex]::Escape($oldRow)).Count -ne 1) { throw 'Expected exactly one Stage 12 row.' }
$content = $content.Replace($oldRow, $newRow)
$status = 'Status: Active staged implementation plan, amended 2026-10-24.'
$checkpoint = @'

### Stage 12 Portal burst-visibility checkpoint — 2026-10-27

The Portal burst investigation has isolated the visibility result with the installed particle package and Chromium: BurstIds reach emission and produce framebuffer pixels, but the current one-particle request and electrical-sparks recipe produce only tiny, short-lived specks. This is separate from the corrected renderer-diagnostics callback capture. Portal diagnostics/retry handling, deferred custom-art burst handling, and focused tests/build are complete for this slice. The burst handoff proposes optional catalog-authored per-stream `burstCount`; contracts/schema, GameEngine catalog, and particle-package owners need to agree and publish that field before Portal can consume meaningful authored counts. Keep Stage 12 acceptance open until the dependency is resolved and the sample is replayed with visible results. See [Burst visibility review](PARTICLE_EFFECT_INTEGRATION_BURST_VISIBILITY_REVIEW.md).
'@
if ([regex]::Matches($content, [regex]::Escape($status)).Count -ne 1) { throw 'Expected exactly one current plan status line.' }
$content = $content.Replace($status, $status + $checkpoint)
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
