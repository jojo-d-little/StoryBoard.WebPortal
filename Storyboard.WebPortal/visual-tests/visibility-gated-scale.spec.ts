import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __visibilityGatedScale?: {
      ready: boolean;
      transitionState: string;
      reconcileStagedDelta: (revision: number) => void;
    };
  }
}

test("captures the first visible below-arrival scale frame", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-tests/visibility-gated-scale.html");
  await page.waitForFunction(() => window.__visibilityGatedScale?.ready === true);
  await page.waitForFunction(() => window.__visibilityGatedScale?.transitionState === "running");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  const screenshot = await page.locator("#mount").screenshot({ path: "visual-tests/artifacts/visibility-gated-scale-first-visible.png" });
  expect(screenshot.byteLength).toBeGreaterThan(1000);
  expect(await page.locator("canvas").count()).toBe(1);
});
