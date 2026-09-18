import { expect, test } from "@playwright/test";

test("movement cue retarget stress does not detect reset", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-movement-stress.test.html");

  await page.waitForFunction(() => {
    return (window as Window & { __movementStressReady?: boolean }).__movementStressReady === true;
  });

  const result = await page.evaluate(() => {
    return (window as Window & {
      __movementStressResult?: {
        animationStarts: number;
        resetDetected: boolean;
        samples: Array<{ fromX: number; toX: number; durationMs: number }>;
      };
    }).__movementStressResult;
  });

  expect(result).toBeDefined();
  expect(result?.animationStarts ?? 0).toBeGreaterThanOrEqual(4);
  expect(result?.resetDetected).toBeFalsy();
});
