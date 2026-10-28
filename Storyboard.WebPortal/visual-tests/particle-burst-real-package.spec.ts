import { expect, test } from "@playwright/test";

test("installed particle package renders and naturally decays a real burst in browser Pixi", async ({ page }, testInfo) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const harness = await import("/src/gameRenderer/pixi/effects/particleBurstBrowserHarness.ts");
    return harness.runParticleBurstBrowserHarness();
  });
  await page.evaluate((src) => {
    const image = document.createElement("img");
    image.alt = "Real particle package burst frame";
    image.src = src;
    image.style.cssText = "display:block;position:fixed;inset:0;width:640px;height:400px;z-index:2147483647;image-rendering:pixelated";
    document.body.appendChild(image);
  }, result.burstFrameDataUrl);
  await page.getByAltText("Real particle package burst frame").screenshot({ path: testInfo.outputPath("particle-burst.png") });
  console.log(JSON.stringify({ stats: result.statsAfterEmit, zero: result.statsAfterZeroCount, customArt: result.statsAfterCustomArtBurst, diagnostics: result.diagnostics, customArtChangedPixels: result.customArtChangedPixels, pixels: { changedTotal: result.changedPixelsTotal, dimensions: result.rendererCanvasDimensions, center: result.extractedCenterRgba, layers: result.effectLayerState, near: result.changedPixelsNearBurst } }));

  expect(result.statsAfterEmit.emittedParticles).toBe(56);
  expect(result.statsAfterEmit.liveParticles).toBe(56);
  expect(result.statsAfterDuplicateDelivery.emittedParticles).toBe(56);
  expect(result.statsAfterZeroCount.emittedParticles).toBe(56);
  expect(result.changedPixelsNearBurst).toBeGreaterThan(0);
  expect(result.changedPixelsAtMovedAnchor).toBeGreaterThan(0);
  expect(result.changedPixelsAtSecondSource).toBeGreaterThan(0);
  expect(result.changedPixelsTotal).toBeGreaterThan(0);
  expect(result.statsAfterDecay.liveParticles).toBe(0);
  expect(result.changedPixelsAfterNaturalDecay).toBe(0);
  expect(result.statsAfterCustomArtBurst.emittedParticles).toBe(8);
  expect(result.customArtChangedPixels).toBeGreaterThan(0);
  expect(result.diagnostics.some((entry) => entry.message === "Particle burst stream emission result."
    && (entry.details as { quantityMultiplier?: number }).quantityMultiplier === 0.5
    && (entry.details as { requestedCount?: number }).requestedCount === 8)).toBe(true);
  expect(result.diagnostics.some((entry) => entry.message === "Particle burst stream emission result."
    && (entry.details as { quantityMultiplier?: number }).quantityMultiplier === 1
    && (entry.details as { requestedCount?: number }).requestedCount === 16)).toBe(true);
  expect(result.diagnostics.some((entry) => entry.message === "Particle burst stream emission result."
    && (entry.details as { quantityMultiplier?: number }).quantityMultiplier === 2
    && (entry.details as { requestedCount?: number }).requestedCount === 32)).toBe(true);
});
