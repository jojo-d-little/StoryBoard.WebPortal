import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

declare global {
  interface Window {
    __lightingHarness?: {
      setLightingEnabled: (enabled: boolean) => void;
      setMode: (mode: "compact" | "workshop" | "stress") => void;
    };
    __lightingReady?: boolean;
  }
}

async function measureWindowsGpuMemory(processId: number, sampleCount: number): Promise<unknown> {
  if (process.platform !== "win32") return null;
  const script = `
    $ErrorActionPreference = 'Stop'
    $rows = @()
    for ($index = 0; $index -lt ${sampleCount}; $index++) {
      $counter = Get-Counter -Counter '\\GPU Process Memory(*)\\Dedicated Usage','\\GPU Process Memory(*)\\Shared Usage'
      $matching = @($counter.CounterSamples | Where-Object { $_.Path -match 'pid_${processId}_' })
      $dedicated = ($matching | Where-Object { $_.Path -match 'dedicated usage$' } | Measure-Object -Property CookedValue -Sum).Sum
      $shared = ($matching | Where-Object { $_.Path -match 'shared usage$' } | Measure-Object -Property CookedValue -Sum).Sum
      $rows += [pscustomobject]@{ dedicatedBytes = [double]($dedicated -as [double]); sharedBytes = [double]($shared -as [double]) }
      Start-Sleep -Milliseconds 1000
    }
    ConvertTo-Json -InputObject @($rows) -Compress
  `;
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { maxBuffer: 1_000_000 });
    return JSON.parse(stdout.trim());
  } catch (error) {
    return { unavailable: error instanceof Error ? error.message : String(error) };
  }
}

test("records a reproducible compact or synthetic Workshop lighting frame and GPU memory sample", async ({ page }) => {
  test.setTimeout(90_000);
  const mode = process.env.LIGHTING_PROFILE_MODE === "compact"
    ? "compact"
    : process.env.LIGHTING_PROFILE_MODE === "stress" ? "stress" : "workshop";
  await page.goto("http://127.0.0.1:4173/visual-lighting.html?lighting=off");
  await page.waitForFunction(() => window.__lightingReady === true);
  await page.evaluate((fixtureMode) => window.__lightingHarness?.setMode(fixtureMode), mode);
  await page.waitForTimeout(500);

  const browser = page.context().browser();
  if (!browser) throw new Error("Playwright browser handle is unavailable.");
  const cdp = await browser.newBrowserCDPSession();
  const processInfo = await cdp.send("SystemInfo.getProcessInfo") as {
    processInfo?: Array<{ type: string; id: number }>;
  };
  const gpuProcessId = processInfo.processInfo?.find((process) => process.type.toLowerCase().includes("gpu"))?.id;
  const measureFrameCadence = async () => page.evaluate(async () => {
    const intervals: number[] = [];
    let previous = 0;
    await new Promise<void>((resolve) => {
      const started = performance.now();
      const sample = (now: number) => {
        if (previous > 0) intervals.push(now - previous);
        previous = now;
        if (now - started >= 8000) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    const sorted = [...intervals].sort((a, b) => a - b);
    const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frameCount: intervals.length,
      medianFrameIntervalMs: percentile(0.5),
      p95FrameIntervalMs: percentile(0.95),
      p99FrameIntervalMs: percentile(0.99),
      framesOver17_5ms: intervals.filter((interval) => interval > 17.5).length,
      framesOver20ms: intervals.filter((interval) => interval > 20).length,
      framesOver33_3ms: intervals.filter((interval) => interval > 33.3).length,
      jsHeapUsedBytes: memory?.usedJSHeapSize ?? null
    };
  });

  const measure = async (lightingEnabled: boolean) => {
    await page.evaluate(async (enabled) => {
      window.__lightingHarness?.setLightingEnabled(enabled);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
    }, lightingEnabled);
    const memorySamples = gpuProcessId
      ? measureWindowsGpuMemory(gpuProcessId, 8)
      : Promise.resolve({ unavailable: "Chrome did not expose a GPU process id." });
    const [frameCadence, gpuMemory] = await Promise.all([measureFrameCadence(), memorySamples]);
    return { lightingEnabled, ...frameCadence, gpuMemory };
  };

  const results = await page.evaluate(() => {
    const canvas = document.querySelector("#mount canvas") as HTMLCanvasElement | null;
    const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const renderer = gl && debugInfo ? {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    } : null;

    return { renderer, browser: navigator.userAgent };
  });
  const off = await measure(false);
  const on = await measure(true);

  console.log(`LIGHTING_PROFILE ${JSON.stringify({
    fixture: mode === "compact"
      ? "compact: 800x600 room, 2 point lights, 1 blocker"
      : mode === "workshop"
        ? "WorkshopTutorial authored Atrium lighting values: 800x600 room, 1 static point light, ambient 0.7"
        : "synthetic stress: 1600x1200 room, 32 point lights, 16 blockers",
    ...results,
    gpuProcessId,
    off,
    on
  })}`);
  expect(off.frameCount).toBeGreaterThan(400);
  expect(on.frameCount).toBeGreaterThan(400);
});
