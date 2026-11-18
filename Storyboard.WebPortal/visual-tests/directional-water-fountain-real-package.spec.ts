import { expect, test } from "@playwright/test";

test("published particle package renders isolated multi-emitter acceleration, mapped surges, and lifecycle changes", async ({ page }, testInfo) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const harness = await import("/src/gameRenderer/pixi/effects/directionalWaterFountainBrowserHarness.ts");
    return harness.runDirectionalWaterFountainBrowserHarness();
  });

  await page.evaluate((src) => {
    const image = document.createElement("img");
    image.alt = "Directional water and electrical particle showcase";
    image.src = src;
    image.style.cssText = "display:block;position:fixed;inset:0;width:900px;height:620px;z-index:2147483647;image-rendering:pixelated";
    document.body.appendChild(image);
  }, result.frameDataUrl);
  await page.getByAltText("Directional water and electrical particle showcase")
    .screenshot({ path: testInfo.outputPath("directional-water-fountain.png") });
  await expect(page.getByAltText("Directional water and electrical particle showcase"))
    .toHaveScreenshot("directional-water-fountain-win32.png", { maxDiffPixelRatio: 0.01 });

  expect(result.packageVersion).toBe("1.0.4");
  expect(result.continuousEmittedParticles).toBeGreaterThan(0);
  expect(result.emitterChangedPixels).toHaveLength(4);
  expect(result.emitterChangedPixels.every((count) => count > 0)).toBe(true);
  expect(result.arcingChangedPixels).toBeGreaterThan(0);
  expect(result.customImageLocators).toContain("Project/Effects/Fountain/custom-ripple.png");
  expect(new Set(result.emitterMappings.map(({ direction }) => direction)).size).toBe(4);
  expect(new Set(result.emitterMappings.map(({ accelerationX, accelerationY }) => `${accelerationX},${accelerationY}`)).size).toBe(4);
  expect(new Set(result.emitterMappings.map(({ trajectoryAtHalfSecond }) => `${trajectoryAtHalfSecond.x.toFixed(2)},${trajectoryAtHalfSecond.y.toFixed(2)}`)).size).toBe(4);
  for (const emitter of result.emitterMappings) {
    expect(Object.values(emitter.streams)).toHaveLength(2);
    for (const stream of Object.values(emitter.streams)) {
      expect(stream.accelerationX).toBe(emitter.accelerationX);
      expect(stream.accelerationY).toBe(emitter.accelerationY);
    }
  }
  expect(result.retunedEmitterMappings[0]).toMatchObject({ direction: 0, accelerationX: 85, accelerationY: -90 });
  expect(result.retunedEmitterMappings.slice(1)).toEqual(result.emitterMappings.slice(1));
  expect(result.burstRecords).toEqual(expect.arrayContaining([
    expect.objectContaining({ effectKey: "particle.water-fountain", streamId: "fountain-surge", requestedCount: 12 }),
    expect.objectContaining({ effectKey: "particle.electrical-arcing", streamId: "arc-surge", requestedCount: 8 })
  ]));
  expect(result.burstRecords.filter(({ effectKey }) => effectKey === "particle.water-fountain")).toHaveLength(4);
  expect(result.burstRecords).toHaveLength(5);
  expect(result.duplicateBurstRejected).toBe(true);
  expect(result.replayBurstAccepted).toBe(true);
  expect(result.disabledEmitterRemainsIsolated).toBe(true);
  expect(result.activeEmittersAfterRemoval).toBe(0);
  expect(result.removedSceneEmissionDelta).toBe(0);
});
