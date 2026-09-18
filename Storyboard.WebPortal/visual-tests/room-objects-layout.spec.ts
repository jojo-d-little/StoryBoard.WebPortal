import { expect, test } from "@playwright/test";

test("room objects layout baseline", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-baseline-objects.html");

  await page.waitForFunction(() => {
    return (window as Window & { __baselineReady?: boolean }).__baselineReady === true;
  });

  const mount = page.locator("#mount");
  await expect(mount).toHaveScreenshot("room-objects-layout.png");
});