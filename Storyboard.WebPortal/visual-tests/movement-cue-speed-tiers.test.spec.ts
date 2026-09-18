import { expect, test } from "@playwright/test";

test("movement cue speed tiers complete in fast-medium-slow order", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-movement-speed-tiers.test.html");

  await page.waitForFunction(() => {
    return (window as Window & { __movementSpeedTierReady?: boolean }).__movementSpeedTierReady === true;
  });

  const result = await page.evaluate(() => {
    return (window as Window & {
      __movementSpeedTierResult?: {
        observedMs: Record<string, number>;
        orderedFastMediumSlow: boolean;
        startedCount: number;
        completedCount: number;
      };
    }).__movementSpeedTierResult;
  });

  expect(result).toBeDefined();
  expect(result?.startedCount ?? 0).toBeGreaterThanOrEqual(3);
  expect(result?.completedCount ?? 0).toBeGreaterThanOrEqual(3);
  expect(result?.orderedFastMediumSlow).toBeTruthy();
});
