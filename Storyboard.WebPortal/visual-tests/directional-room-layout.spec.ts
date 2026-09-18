import { expect, test } from "@playwright/test";

test("directional room layout baseline", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-baseline-directional.html");

  await page.waitForFunction(() => {
    return (window as Window & { __baselineReady?: boolean }).__baselineReady === true;
  });

  const mount = page.locator("#mount");
  await expect(mount).toHaveScreenshot("directional-room-layout.png");
});
