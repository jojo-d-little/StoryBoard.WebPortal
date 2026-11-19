import { expect, test } from "@playwright/test";

const playerId = "ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b";
const suitcaseId = "15b418f7-b443-4556-91d0-65fcdcec9c0f";

test("incoming Push shadow starts at arrival and follows the suitcase through snapshot handoff", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173/push-movement.html?transferOnly=1&lightingTransfer=1");
  try {
    await page.waitForFunction(({ playerId, suitcaseId }) => {
      const transfer = (window as Window & { __pushMovementHarness?: { transfer?: {
        roomId: string;
        firstDestinationFrames: Record<string, { x: number; y: number }>;
      } } }).__pushMovementHarness?.transfer;
      return transfer?.roomId === "b4148986-823d-4d9a-832d-f31f60165e79"
        && Boolean(transfer.firstDestinationFrames[playerId])
        && Boolean(transfer.firstDestinationFrames[suitcaseId]);
    }, { playerId, suitcaseId }, { timeout: 15000 });
  } catch (error) {
    const state = await page.evaluate(() => (window as Window & { __pushMovementHarness?: unknown }).__pushMovementHarness);
    throw new Error(`${String(error)}; harness=${JSON.stringify(state)}; pageErrors=${pageErrors.join(" | ")}`);
  }

  const canvas = page.locator("#transfer-mount canvas");
  await expect(canvas).toBeVisible();
  const firstFrame = await page.evaluate(() => (window as Window & { __pushMovementHarness?: { transfer?: {
    firstDestinationFrames: Record<string, { x: number; y: number }>;
  } } }).__pushMovementHarness?.transfer?.firstDestinationFrames);
  expect(firstFrame?.[playerId]).toEqual({ x: 268, y: 828 });
  expect(firstFrame?.[suitcaseId]).toEqual({ x: 182, y: 639 });
  await canvas.screenshot({ path: testInfo.outputPath("push-transfer-lighting-arrival.png") });

  await page.waitForFunction(({ playerId, suitcaseId }) => {
    const transfer = (window as Window & { __pushMovementHarness?: { transfer?: {
      intermediateFrames: Record<string, { x: number; y: number }>;
    } } }).__pushMovementHarness?.transfer;
    const player = transfer?.intermediateFrames[playerId]?.y;
    const suitcase = transfer?.intermediateFrames[suitcaseId]?.y;
    return player !== undefined && player < 828 && player > 468
      && suitcase !== undefined && suitcase < 639 && suitcase > 279;
  }, { playerId, suitcaseId }, { timeout: 15000 });
  await canvas.screenshot({ path: testInfo.outputPath("push-transfer-lighting-continuation.png") });

  await page.waitForFunction(() => {
    const transfer = (window as Window & { __pushMovementHarness?: { transfer?: {
      expiryApplied: boolean;
    } } }).__pushMovementHarness?.transfer;
    return transfer?.expiryApplied === true;
  }, undefined, { timeout: 15000 });
  const expiry = await page.evaluate(() => (window as Window & { __pushMovementHarness?: { transfer?: {
    completedBeforeExpiry: boolean;
    completedPositions: Record<string, { x: number; y: number }>;
    lightingDiagnostics: string[];
  } } }).__pushMovementHarness?.transfer);
  expect(expiry?.lightingDiagnostics).toEqual([]);
  expect(expiry?.completedBeforeExpiry).toBe(true);
  expect(expiry?.completedPositions[playerId]).toEqual({ x: 268, y: 468 });
  expect(expiry?.completedPositions[suitcaseId]).toEqual({ x: 182, y: 279 });
  await canvas.screenshot({ path: testInfo.outputPath("push-transfer-lighting-cue-expiry.png") });
});
