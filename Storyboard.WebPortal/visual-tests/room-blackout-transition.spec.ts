import { expect, test } from "@playwright/test";

test("blackout swap fade remains visible when snapshot preparation is requested", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/visual-room-snapshot-transition.html?mode=fade-blackout");

  await page.waitForFunction(() => {
    return (window as Window & { __snapshotTransitionReady?: boolean }).__snapshotTransitionReady === true;
  });

  const screenshot = await page.locator("#mount").screenshot();
  const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;
  const centerPixel = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create inspection canvas.");
    }

    context.drawImage(image, 0, 0);
    return [...context.getImageData(400, 300, 1, 1).data];
  }, dataUrl);

  // One second into a four-second blackout swap, the center must be nearly black rather than
  // a fully visible frozen outgoing snapshot.
  expect(centerPixel[0]).toBeLessThan(45);
  expect(centerPixel[1]).toBeLessThan(45);
  expect(centerPixel[2]).toBeLessThan(45);
});
