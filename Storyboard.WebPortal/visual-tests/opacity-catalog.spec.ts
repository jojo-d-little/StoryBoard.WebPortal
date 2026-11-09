import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __opacityHarness?: {
      setAppearanceEnabled: (enabled: boolean) => void;
      setDisappearanceEnabled: (enabled: boolean) => void;
      setSituationalScale: (scale: number) => void;
      setTiming: () => void;
    };
    __opacityReady?: boolean;
  }
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4173/visual-opacity.html");
  await page.waitForFunction(() => window.__opacityReady === true);
  await page.waitForTimeout(150);
}

test("catalog opacity recipes compose with scale, selected parts, base alpha, and isolation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);
  await page.evaluate(() => window.__opacityHarness?.setTiming());
  await page.waitForTimeout(80);
  const mount = page.locator("#mount");
  await expect(page.locator("#catalog-identity")).toContainText("appearance.fade.in");

  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(2));
  await page.waitForTimeout(60);
  const atScaleTwo = await mount.screenshot({ path: testInfo.outputPath("situational-scale-2-opacity-held.png") });
  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(0.5));
  await page.waitForTimeout(60);
  const atScaleHalf = await mount.screenshot({ path: testInfo.outputPath("situational-scale-0_5-opacity-held.png") });
  expect(Buffer.compare(atScaleTwo, atScaleHalf)).not.toBe(0);
  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(1));
  await page.waitForTimeout(60);
  const atScaleOne = await mount.screenshot({ path: testInfo.outputPath("situational-scale-1-opacity-held.png") });
  expect(Buffer.compare(atScaleHalf, atScaleOne)).not.toBe(0);

  await page.getByLabel("Appearance", { exact: true }).uncheck();
  await page.getByLabel("Disappearance", { exact: true }).uncheck();
  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(1));
  await page.waitForTimeout(60);
  const baselineAtOne = await mount.screenshot();
  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(2));
  await page.waitForTimeout(60);
  const baselineAtTwo = await mount.screenshot();
  expect(Buffer.compare(baselineAtOne, baselineAtTwo)).not.toBe(0);

  await page.getByLabel("Appearance", { exact: true }).check();
  await page.getByLabel("Disappearance", { exact: true }).check();
  await page.evaluate(() => window.__opacityHarness?.setSituationalScale(1));
  await page.waitForTimeout(60);
  const animated = await mount.screenshot({ path: testInfo.outputPath("opacity-animated.png") });
  await page.getByLabel("Appearance", { exact: true }).uncheck();
  await page.getByLabel("Disappearance", { exact: true }).uncheck();
  await page.waitForTimeout(80);
  const baseline = await mount.screenshot({ path: testInfo.outputPath("opacity-baseline.png") });
  expect(Buffer.compare(animated, baseline)).not.toBe(0);
  await page.getByLabel("Appearance", { exact: true }).check();
  await page.getByLabel("Disappearance", { exact: true }).check();
  await page.waitForTimeout(80);
  const reenacted = await mount.screenshot();
  expect(Buffer.compare(baseline, reenacted)).not.toBe(0);
  await mount.screenshot({ path: testInfo.outputPath("appearance-disappearance-catalog.png") });
  expect(errors).toEqual([]);
});
