# WebPortal Lighting Performance Baseline

Measured 2026-09-27 with the WebPortal lighting renderer and the installed system Chrome.

The measurements in the results table below were collected with `@jojo-d-little/storyboard-lighting` `0.2.0-preview.20260927192207.256970`. After official release `0.1.3` became available, the production build, all 247 unit tests, and all 11 Playwright tests were rerun against `0.1.3`. Its WorkshopTutorial profile recorded 480 frames per pass, p50/p95/p99 intervals of 16.7/16.9/17.0 ms, and zero frames over 17.5 ms. GPU memory counters were unavailable in that rerun because Windows returned an invalid performance-counter sample, so the table remains explicitly a preview-package measurement.

## Test setup

- Browser: Headless Chrome 153, 1024×768 viewport, requestAnimationFrame refresh at 60 Hz.
- GPU: NVIDIA GeForce RTX 5070 Ti, ANGLE Direct3D 11.
- Each on/off pass ran for eight seconds after a one-second warmup; each returned 480 animation frames.
- Frame intervals are a presentation-cadence proxy; they do not isolate GPU execution time from browser scheduling and display pacing.
- Windows GPU Process Memory counters sampled the isolated Chrome GPU process once per second. Values below use the median sample. JavaScript heap is reported separately and is not GPU memory.
- The WorkshopTutorial browser fixture uses authored runtime lighting values from `C:\work\GIT\StoryBoard.SampleProjects\Samples\WorkshopTutorial`: the Atrium's 800×600 room, 0.7 ambient, and static RoomLight; and the Supply Closet's 0.7 ambient, flickering Brass Key, and zero-strength occlusion. The fixture uses a synthetic host-resolved light position and a simple floor image, rather than loading the entire Designer project through Host.
- The compact fixture is an 800×600 synthetic room with two static lights and one blocker. The stress fixture is a 1600×1200 synthetic room with 32 lights and 16 blockers. The stress fixture checks memory scaling beyond the sample project's load.

## Results

| Fixture | Lighting | p50 / p95 / p99 frame interval | Frames over 17.5 ms | Dedicated GPU memory | Shared GPU memory | JS heap |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Compact, 800×600, 2 lights, 1 blocker | Off | 16.7 / 16.9 / 17.2 ms | 0 / 480 | 74.1 MB | 3.67 MB | 20.04 MB |
| Compact, 800×600, 2 lights, 1 blocker | On | 16.7 / 16.9 / 17.3 ms | 0 / 480 | 98.3 MB | 3.70 MB | 21.25 MB |
| WorkshopTutorial Atrium, 800×600, 1 static light | Off | 16.7 / 16.8 / 16.9 ms | 0 / 480 | 72.1 MB | 3.93 MB | 19.69 MB |
| WorkshopTutorial Atrium, 800×600, 1 static light | On | 16.7 / 16.8 / 16.9 ms | 0 / 480 | 98.5 MB | 4.24 MB | 21.28 MB |
| Stress, 1600×1200, 32 lights, 16 blockers | Off | 16.7 / 16.8 / 16.9 ms | 0 / 480 | 91.3 MB | 3.65 MB | 19.67 MB |
| Stress, 1600×1200, 32 lights, 16 blockers | On | 16.7 / 16.8 / 16.8 ms | 0 / 480 | 202.8 MB | 4.21 MB | 21.19 MB |

Lighting increased dedicated GPU memory by about 23 MiB in the compact case, 25 MiB in the WorkshopTutorial case, and 106 MiB in the 1600×1200 stress case. The measurements show room pixel area is the main cost driver in these runs. The stress profile stayed within a 60 Hz frame cadence on this GPU, with no sampled frame interval above 17.5 ms.

These are single-machine measurements, not a minimum-hardware guarantee. The stress case is synthetic, and the WorkshopTutorial fixture doesn't load the full Host-rendered project or measure its animated movement path. Repeat on a lower-end supported GPU and with the complete simulator project before making broad performance claims. Lighting remains on by explicit project direction; the Devtools switch can still turn off its per-frame rendering work.

## Reproducing

Run `npm run test:visual` for the regular lighting test and WorkshopTutorial sample profile. To select the compact or stress workload on Windows PowerShell:

```powershell
$env:LIGHTING_PROFILE_MODE = "compact"
npx playwright test visual-tests/lighting-performance.spec.ts

$env:LIGHTING_PROFILE_MODE = "stress"
npx playwright test visual-tests/lighting-performance.spec.ts
```

The profile writes one `LIGHTING_PROFILE` JSON record to the Playwright output. Windows GPU memory fields are omitted or reported unavailable where the Windows GPU Process Memory counters cannot be read.
