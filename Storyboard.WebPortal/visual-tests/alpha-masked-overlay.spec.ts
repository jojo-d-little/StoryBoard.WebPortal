import { expect, test, type Page } from "@playwright/test";

type Rgba = [number, number, number, number];

async function samplePixel(page: Page, x: number, y: number): Promise<Rgba> {
  const screenshot = await page.locator("#mount canvas").screenshot();
  return page.evaluate(async ({ png, x, y }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot sample the rendered canvas.");
    context.drawImage(image, 0, 0);
    return [...context.getImageData(x, y, 1, 1).data] as Rgba;
  }, { png: screenshot.toString("base64"), x, y });
}

test("alpha-masked overlay follows source alpha for soft and binary policies", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/visual-alpha-mask.html");
  await page.waitForFunction(() => window.__alphaMaskReady === true);
  await page.waitForTimeout(250);

  const baselineTransparent = await samplePixel(page, 32, 64);
  const baselinePartial = await samplePixel(page, 64, 64);
  const baselineOpaque = await samplePixel(page, 96, 64);

  await page.evaluate(() => window.__alphaMaskHarness?.setMode("soft"));
  await page.waitForTimeout(250);
  const softTransparent = await samplePixel(page, 32, 64);
  const softPartial = await samplePixel(page, 64, 64);
  const softOpaque = await samplePixel(page, 96, 64);

  await page.evaluate(() => window.__alphaMaskHarness?.setMode("binary"));
  await page.waitForTimeout(250);
  const binaryTransparent = await samplePixel(page, 32, 64);
  const binaryPartial = await samplePixel(page, 64, 64);
  const binaryOpaque = await samplePixel(page, 96, 64);

  await page.evaluate(() => window.__alphaMaskHarness?.setMode("binary-above-cutoff"));
  await page.waitForTimeout(250);
  const cutoffPartial = await samplePixel(page, 64, 64);

  expect(softTransparent).toEqual(baselineTransparent);
  expect(binaryTransparent).toEqual(baselineTransparent);
  expect(softPartial[0]).toBeGreaterThan(baselinePartial[0] + 10);
  expect(binaryPartial[0]).toBeGreaterThan(softPartial[0] + 10);
  expect(cutoffPartial).toEqual(baselinePartial);
  expect(softOpaque).toEqual(baselineOpaque);
  expect(binaryOpaque).toEqual(baselineOpaque);

  await page.evaluate(() => window.__alphaMaskHarness?.setMode("pane-flash"));
  await page.waitForTimeout(250);
  const flashTransparent = await samplePixel(page, 32, 64);
  const flashPartial = await samplePixel(page, 64, 64);
  const flashOpaque = await samplePixel(page, 96, 64);

  expect(flashTransparent).toEqual(baselineTransparent);
  expect(flashPartial[0]).toBeGreaterThan(flashPartial[1]);
  expect(flashPartial[1]).toBeGreaterThan(0);
  expect(flashOpaque[0]).toBeGreaterThan(flashOpaque[1]);
  expect(flashOpaque[1]).toBe(0);
  expect(errors).toEqual([]);
});
