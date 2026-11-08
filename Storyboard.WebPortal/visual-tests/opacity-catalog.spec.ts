import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __opacityHarness?: { setAppearanceEnabled: (enabled: boolean) => void; setTiming: () => void };
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
  const animated = await mount.screenshot({ path: testInfo.outputPath("opacity-animated.png") });
  await page.getByLabel("Appearance", { exact: true }).uncheck();
  await page.waitForTimeout(80);
  const baseline = await mount.screenshot({ path: testInfo.outputPath("opacity-baseline.png") });
  expect(Buffer.compare(animated, baseline)).not.toBe(0);
  await page.getByLabel("Appearance", { exact: true }).check();
  await page.waitForTimeout(80);
  const reenacted = await mount.screenshot();
  expect(Buffer.compare(baseline, reenacted)).not.toBe(0);
  await mount.screenshot({ path: testInfo.outputPath("appearance-disappearance-catalog.png") });
  expect(errors).toEqual([]);
});
