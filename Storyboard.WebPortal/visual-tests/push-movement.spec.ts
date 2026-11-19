import { expect, test } from "@playwright/test";

type PushHarnessResult = {
  started: boolean;
  completed: boolean;
  objectIds: string[];
  segmentCounts: Record<string, number>;
  trunkScale: number | undefined;
  diagnostics: string[];
};

declare global {
  interface Window {
    __pushMovementHarness?: {
      ready: boolean;
      direct?: PushHarnessResult;
      legByLeg?: PushHarnessResult;
      transfer?: {
        roomId: string;
        objectIds: string[];
        segmentKinds: string[];
        trunkScale: number | undefined;
        firstDestinationFrames: Record<string, { x: number; y: number }>;
        intermediateFrames: Record<string, { x: number; y: number }>;
        liveFrames: Record<string, { x: number; y: number }>;
        completedIds: string[];
        completedPositions: Record<string, { x: number; y: number }>;
        expiryApplied: boolean;
        completedBeforeExpiry: boolean;
      };
    };
  }
}

test("coordinated Push turns, translations, and synchronized child remain visible", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173/push-movement.html");
  try {
    await page.waitForFunction(() => {
    const harness = (window as Window & {
      __pushMovementHarness?: {
        direct?: PushHarnessResult;
        legByLeg?: PushHarnessResult;
        transfer?: { roomId: string; firstDestinationFrames: Record<string, { x: number; y: number }> };
      };
    }).__pushMovementHarness;
    return harness?.direct?.started === true
      && harness.legByLeg?.started === true
      && harness.transfer?.roomId === "b4148986-823d-4d9a-832d-f31f60165e79"
      && Boolean(harness.transfer.firstDestinationFrames["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"])
      && Boolean(harness.transfer.firstDestinationFrames["15b418f7-b443-4556-91d0-65fcdcec9c0f"]);
    }, undefined, { timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => (window as Window & { __pushMovementHarness?: unknown }).__pushMovementHarness);
    throw new Error(`${String(error)}; harness=${JSON.stringify(state)}; pageErrors=${pageErrors.join(" | ")}`);
  }

  const directCanvas = page.locator("#direct canvas");
  const legByLegCanvas = page.locator("#leg-by-leg canvas");
  await expect(directCanvas).toBeVisible();
  await expect(legByLegCanvas).toBeVisible();
  await directCanvas.screenshot({ path: testInfo.outputPath("push-direct-turn-and-start.png") });
  await legByLegCanvas.screenshot({ path: testInfo.outputPath("push-leg-by-leg-turn-and-start.png") });
  const arrival = await page.evaluate(() => (window as Window & {
    __pushMovementHarness?: { transfer?: { firstDestinationFrames: Record<string, { x: number; y: number }> } };
  }).__pushMovementHarness?.transfer?.firstDestinationFrames);
  expect(arrival?.["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"]).toEqual({ x: 268, y: 828 });
  expect(arrival?.["15b418f7-b443-4556-91d0-65fcdcec9c0f"]).toEqual({ x: 182, y: 639 });
  await page.locator("#transfer-mount canvas").screenshot({ path: testInfo.outputPath("push-room-transfer-first-destination-frame.png") });

  await page.waitForTimeout(1600);
  const destinationProgress = await page.evaluate(() => (window as Window & {
    __pushMovementHarness?: { transfer?: { intermediateFrames: Record<string, { x: number; y: number }> } };
  }).__pushMovementHarness?.transfer?.intermediateFrames);
  expect(destinationProgress?.["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"]?.y).toBeLessThan(828);
  expect(destinationProgress?.["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"]?.y).toBeGreaterThan(468);
  expect(destinationProgress?.["15b418f7-b443-4556-91d0-65fcdcec9c0f"]?.y).toBeLessThan(639);
  expect(destinationProgress?.["15b418f7-b443-4556-91d0-65fcdcec9c0f"]?.y).toBeGreaterThan(279);
  await page.locator("#transfer-mount canvas").screenshot({ path: testInfo.outputPath("push-room-transfer-destination-midpoint.png") });
  await directCanvas.screenshot({ path: testInfo.outputPath("push-direct-translation.png") });
  await legByLegCanvas.screenshot({ path: testInfo.outputPath("push-leg-by-leg-translation.png") });

  await page.waitForFunction(() => {
    const harness = (window as Window & { __pushMovementHarness?: { direct?: PushHarnessResult; legByLeg?: PushHarnessResult } }).__pushMovementHarness;
    return harness?.direct?.completed === true && harness.legByLeg?.completed === true;
  });
  await directCanvas.screenshot({ path: testInfo.outputPath("push-direct-complete.png") });
  await legByLegCanvas.screenshot({ path: testInfo.outputPath("push-leg-by-leg-complete.png") });
  await page.locator("#transfer-mount canvas").screenshot({ path: testInfo.outputPath("push-room-transfer-destination-continuation.png") });

  const result = await page.evaluate(() => (window as Window & {
    __pushMovementHarness?: {
      direct?: PushHarnessResult;
      legByLeg?: PushHarnessResult;
      transfer?: {
        roomId: string;
        objectIds: string[];
        segmentKinds: string[];
        trunkScale: number | undefined;
        firstDestinationFrames: Record<string, { x: number; y: number }>;
        intermediateFrames: Record<string, { x: number; y: number }>;
        liveFrames: Record<string, { x: number; y: number }>;
        completedIds: string[];
        completedPositions: Record<string, { x: number; y: number }>;
        expiryApplied: boolean;
        completedBeforeExpiry: boolean;
      };
    };
  }).__pushMovementHarness);
  expect(result?.direct?.objectIds).toEqual(expect.arrayContaining(["player", "trunk", "suitcase"]));
  expect(result?.legByLeg?.objectIds).toEqual(expect.arrayContaining(["player", "trunk", "suitcase"]));
  expect(result?.direct?.segmentCounts).toEqual({ player: 2, trunk: 2, suitcase: 2 });
  expect(result?.legByLeg?.segmentCounts).toEqual({ player: 3, trunk: 3, suitcase: 3 });
  expect(result?.direct?.trunkScale).toBe(0.8);
  expect(result?.legByLeg?.trunkScale).toBe(0.8);
  expect(result?.direct?.diagnostics).toContain("Animating room object movement as leg-by-leg sequence.");
  expect(result?.legByLeg?.diagnostics).toContain("Animating room object movement as leg-by-leg sequence.");
  expect(result?.transfer?.roomId).toBe("b4148986-823d-4d9a-832d-f31f60165e79");
  expect(result?.transfer?.objectIds).toEqual(expect.arrayContaining(["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b", "15b418f7-b443-4556-91d0-65fcdcec9c0f"]));
  expect(result?.transfer?.segmentKinds).toEqual(expect.arrayContaining(["Translation", "RoomTransfer"]));
  expect(result?.transfer?.trunkScale).toBe(0.8);
  expect(result?.transfer?.liveFrames["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"]?.y).toBe(468);
  expect(result?.transfer?.liveFrames["15b418f7-b443-4556-91d0-65fcdcec9c0f"]?.y).toBe(279);
  await page.waitForFunction(() => {
    const transfer = (window as Window & { __pushMovementHarness?: { transfer?: { expiryApplied: boolean } } }).__pushMovementHarness?.transfer;
    return transfer?.expiryApplied === true;
  });
  const expiry = await page.evaluate(() => (window as Window & {
    __pushMovementHarness?: { transfer?: { completedIds: string[]; completedPositions: Record<string, { x: number; y: number }>; completedBeforeExpiry: boolean } };
  }).__pushMovementHarness?.transfer);
  expect(expiry?.completedBeforeExpiry).toBe(true);
  expect(expiry?.completedIds).toEqual(expect.arrayContaining(["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b", "15b418f7-b443-4556-91d0-65fcdcec9c0f"]));
  expect(expiry?.completedPositions["ec6fffd3-0f80-4d34-b99d-c3bf224b2b8b"]).toEqual({ x: 268, y: 468 });
  expect(expiry?.completedPositions["15b418f7-b443-4556-91d0-65fcdcec9c0f"]).toEqual({ x: 182, y: 279 });
  await page.locator("#transfer-mount canvas").screenshot({ path: testInfo.outputPath("push-room-transfer-cue-expiry-update.png") });
});
