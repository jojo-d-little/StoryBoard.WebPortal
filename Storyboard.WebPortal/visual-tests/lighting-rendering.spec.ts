import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __lightingHarness?: {
      setLightingEnabled: (enabled: boolean) => void;
      setGridEnabled: (enabled: boolean) => void;
      setMode: (mode: "compact" | "workshop" | "supply-closet" | "stress" | "ambient-only" | "phase-high" | "removed" | "zero" | "legacy") => void;
      moveCrate: () => void;
      resize: (width: number, height: number) => void;
    };
    __lightingReady?: boolean;
  }
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4173/visual-lighting.html");
  await page.waitForFunction(() => window.__lightingReady === true);
  await page.waitForTimeout(500);
}

test("lighting defaults on, toggles live, and the optional grid is independently controlled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);

  const mount = page.locator("#mount");
  const lightingToggle = page.getByLabel("Lighting", { exact: true });
  const gridToggle = page.getByLabel("Lighting Grid Diagnostic", { exact: true });
  await expect(lightingToggle).toBeChecked();
  await expect(gridToggle).not.toBeChecked();

  const litFrame = await mount.screenshot();
  await lightingToggle.uncheck();
  await page.waitForTimeout(100);
  const rawFrame = await mount.screenshot();
  expect(Buffer.compare(litFrame, rawFrame)).not.toBe(0);

  await lightingToggle.check();
  await page.waitForTimeout(100);
  const relitFrame = await mount.screenshot();
  expect(Buffer.compare(litFrame, relitFrame)).toBe(0);

  const noGridFrame = await mount.screenshot();
  await gridToggle.check();
  await page.waitForTimeout(100);
  const gridFrame = await mount.screenshot();
  expect(Buffer.compare(noGridFrame, gridFrame)).not.toBe(0);
  expect(errors).toEqual([]);
});

test("ambient-only, phase replacement, explicit zero, and removals update the rendered room", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);

  const mount = page.locator("#mount");
  await page.evaluate(() => window.__lightingHarness?.setMode("ambient-only"));
  await page.waitForTimeout(150);
  const ambientLow = await mount.screenshot();

  await page.evaluate(() => window.__lightingHarness?.setMode("phase-high"));
  await page.waitForTimeout(150);
  const ambientHigh = await mount.screenshot();
  expect(Buffer.compare(ambientLow, ambientHigh)).not.toBe(0);

  await page.evaluate(() => window.__lightingHarness?.setMode("zero"));
  await page.waitForTimeout(150);
  const explicitZero = await mount.screenshot();
  await page.evaluate(() => window.__lightingHarness?.setMode("removed"));
  await page.waitForTimeout(150);
  const removed = await mount.screenshot();
  expect(Buffer.compare(explicitZero, removed)).not.toBe(0);
  expect(errors).toEqual([]);
});

test("sprite-attached lighting follows the rendered sprite during a move", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);

  const mount = page.locator("#mount");
  const startingFrame = await mount.screenshot();
  await page.evaluate(() => window.__lightingHarness?.moveCrate());
  await page.waitForTimeout(400);
  const movingFrame = await mount.screenshot();
  await page.waitForTimeout(1300);
  const settledFrame = await mount.screenshot();

  expect(Buffer.compare(startingFrame, movingFrame)).not.toBe(0);
  expect(Buffer.compare(movingFrame, settledFrame)).not.toBe(0);
  expect(errors).toEqual([]);
});

test("legacy rooms remain renderable and room swaps survive viewport resizing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);

  const mount = page.locator("#mount");
  const toggle = page.getByLabel("Lighting", { exact: true });
  await page.evaluate(() => window.__lightingHarness?.setMode("legacy"));
  await page.waitForTimeout(150);
  const legacyOn = await mount.screenshot();
  await toggle.uncheck();
  await page.waitForTimeout(100);
  const legacyOff = await mount.screenshot();
  expect(Buffer.compare(legacyOn, legacyOff)).toBe(0);

  await toggle.check();
  await page.evaluate(() => window.__lightingHarness?.setMode("workshop"));
  await page.waitForTimeout(300);
  const atrium = await mount.screenshot();
  await page.evaluate(() => window.__lightingHarness?.setMode("supply-closet"));
  await page.waitForTimeout(300);
  const closetNow = await mount.screenshot();
  await page.waitForTimeout(500);
  const closetLater = await mount.screenshot();
  expect(Buffer.compare(atrium, closetNow)).not.toBe(0);
  expect(Buffer.compare(closetNow, closetLater)).not.toBe(0);

  await page.evaluate(() => window.__lightingHarness?.setMode("stress"));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__lightingHarness?.resize(640, 480));
  await page.waitForTimeout(150);
  await expect(mount.locator("canvas")).toBeVisible();
  const canvasSize = await mount.locator("canvas").evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height
  }));
  expect(canvasSize).toEqual({ width: 640, height: 480 });
  expect(Buffer.compare(legacyOn, await mount.screenshot())).not.toBe(0);
  expect(errors).toEqual([]);
});
