import { expect, test } from "@playwright/test";

test("slide transition clips outgoing overflow and preserves incoming live layout", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-room-snapshot-transition.html");

  await page.waitForFunction(() => {
    return (window as Window & { __snapshotTransitionReady?: boolean }).__snapshotTransitionReady === true;
  });

  const screenshot = await page.locator("#mount").screenshot();
  const screenshotDataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;
  const pixels = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const copy = document.createElement("canvas");
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext("2d");
    if (!context) {
      throw new Error("Could not create inspection canvas.");
    }

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, copy.width, copy.height).data;
    let magentaCount = 0;
    let blueCount = 0;
    let maxMagentaX = -1;
    let minBlueX = copy.width;
    for (let y = 0; y < copy.height; y += 1) {
      for (let x = 0; x < copy.width; x += 1) {
        const offset = ((y * copy.width) + x) * 4;
        const red = data[offset] ?? 0;
        const green = data[offset + 1] ?? 0;
        const blue = data[offset + 2] ?? 0;
        if (red > 230 && green < 40 && blue > 230) {
          magentaCount += 1;
          maxMagentaX = Math.max(maxMagentaX, x);
        }
        if (red < 70 && green < 130 && blue > 170) {
          blueCount += 1;
          minBlueX = Math.min(minBlueX, x);
        }
      }
    }

    return { magentaCount, blueCount, maxMagentaX, minBlueX };
  }, screenshotDataUrl);

  expect(pixels.magentaCount).toBeGreaterThan(0);
  expect(pixels.blueCount).toBeGreaterThan(0);
  expect(pixels.maxMagentaX).toBeLessThan(pixels.minBlueX);

  await page.waitForFunction(() => {
    return (window as Window & { __snapshotTransitionComplete?: boolean }).__snapshotTransitionComplete === true;
  });

  const finalScreenshot = await page.locator("#mount").screenshot();
  const finalScreenshotDataUrl = `data:image/png;base64,${finalScreenshot.toString("base64")}`;
  const finalPixels = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create inspection canvas.");
    }

    context.drawImage(image, 0, 0);
    const sample = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    return {
      cyan: sample(120, 100),
      yellow: sample(600, 400),
      background: sample(400, 300)
    };
  }, finalScreenshotDataUrl);

  expect(finalPixels.cyan[0]).toBeLessThan(30);
  expect(finalPixels.cyan[1]).toBeGreaterThan(220);
  expect(finalPixels.cyan[2]).toBeGreaterThan(220);
  expect(finalPixels.yellow[0]).toBeGreaterThan(220);
  expect(finalPixels.yellow[1]).toBeGreaterThan(220);
  expect(finalPixels.yellow[2]).toBeLessThan(30);
  expect(finalPixels.background[0]).toBeLessThan(30);
  expect(finalPixels.background[1]).toBeGreaterThan(220);
  expect(finalPixels.background[2]).toBeLessThan(30);
});
