import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const fixtureRoot = join(process.cwd(), "visual-tests", "fixtures", "lighting-effects-save-restore");
const fixture = async (name: string) => JSON.parse(await readFile(join(fixtureRoot, "Host", `${name}.json`), "utf8"));

for (const scenario of [
  { name: "changed-room", altered: "altered", restored: "restored" },
  { name: "same-room", altered: "same-room-altered", restored: "same-room-restored" }
]) {
  test(`Host fixture restore reaches Portal session and Pixi renderer (${scenario.name})`, async ({ page }) => {
    const before = await fixture("before");
    const altered = await fixture(scenario.altered);
    const restored = await fixture(scenario.restored);
    const customBytes = await readFile(join(fixtureRoot, "Assets", "custom-candle-leaf.png"));
    const roomImageBytes = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='800' height='600' fill='#B28A62'/><path d='M0 120H800M0 240H800M0 360H800M0 480H800' stroke='#8B674B' stroke-width='2'/></svg>");
    const customLocator = restored.roomChange.newRoom.particleEffectImageMappings.find(
      (mapping: { effectKey: string; imageSlot: string }) => mapping.effectKey === "particle.candle" && mapping.imageSlot === "flame-tip"
    ).relativeLocator;
    let mode = "idle";
    let deltaDelivered = false;
    let customFetches = 0;
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/v1/session/baseline") {
        const body = mode === "restore" ? restored : before;
        if (mode === "restore") mode = "idle";
        await route.fulfill({ json: body });
        return;
      }
      if (url.pathname === "/api/v1/session/deltas") {
        if (mode === "restore") {
          await route.fulfill({ json: { resultCode: "ResyncRequired", sessionData: null, diagnostics: [], isNoOp: false } });
          return;
        }
        if ((mode === "altered" || mode === "ordinary") && !deltaDelivered) {
          deltaDelivered = true;
          const payload = mode === "altered" ? altered : JSON.parse(JSON.stringify(restored));
          if (mode === "ordinary") {
            const object = payload.roomChange.newRoom.renderableRoomObjects.find((entry: { name: string }) => entry.name === "Restore Beacon");
            object.renderableImage.x += 12;
            object.particleEffect.x += 12;
            payload.sessionDeltaWatermark = "portal-ordinary-delta";
          }
          mode = "idle";
          await route.fulfill({ json: { resultCode: "Success", sessionData: payload, diagnostics: [], isNoOp: false } });
          return;
        }
        await route.fulfill({ json: { resultCode: "Success", sessionData: null, diagnostics: [], isNoOp: true } });
        return;
      }
      if (url.pathname === "/api/v1/assets/get") {
        const request = route.request().postDataJSON() as { relativeLocator?: string };
        const isCustomImage = request.relativeLocator === customLocator;
        if (isCustomImage) customFetches += 1;
        const bytes = isCustomImage ? customBytes : roomImageBytes;
        await route.fulfill({ json: { result: { success: true }, contentType: isCustomImage ? "image/png" : "image/svg+xml", payloadBytes: bytes.toString("base64") } });
        return;
      }
      await route.fulfill({ status: 404, json: {} });
    });

    await page.goto("/visual-tests/host-restore-harness.html");
    await expect.poll(() => page.evaluate(() => window.__hostRestoreHarness?.scene?.roomId)).toBe(before.roomChange.newRoom.roomId);
    mode = "altered"; deltaDelivered = false;
    await page.getByTestId("apply-altered").click();
    await expect.poll(() => page.evaluate(() => window.__hostRestoreHarness?.scene?.roomId)).toBe(altered.roomChange.newRoom.roomId);
    const alteredScene = await page.evaluate(() => window.__hostRestoreHarness?.scene);
    expect(alteredScene?.roomId).toBe(altered.roomChange.newRoom.roomId);
    const alteredCanvas = await page.locator("canvas").screenshot({ animations: "disabled" });

    mode = "restore"; deltaDelivered = false;
    await page.getByTestId("restore").click();
    await expect.poll(() => page.evaluate(() => window.__hostRestoreHarness?.scene?.lighting?.ambientLighting?.ambient)).toBe(restored.roomChange.newRoom.ambientLighting.ambient);
    const restoredScene = await page.evaluate(() => window.__hostRestoreHarness?.scene);
    const restoredCanvas = await page.locator("canvas").screenshot({ animations: "disabled" });
    const stableLightingDifference = await page.evaluate(async ([alteredPng, restoredPng]) => {
      const decode = (base64: string): Promise<ImageBitmap> => createImageBitmap(new Blob([
        Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      ], { type: "image/png" }));
      const [alteredBitmap, restoredBitmap] = await Promise.all([decode(alteredPng), decode(restoredPng)]);
      const sample = document.createElement("canvas");
      sample.width = alteredBitmap.width;
      sample.height = alteredBitmap.height;
      const context = sample.getContext("2d");
      if (!context) throw new Error("Could not inspect rendered lighting regions.");
      context.drawImage(alteredBitmap, 0, 0);
      const alteredPixels = context.getImageData(0, 520, 800, 80).data;
      context.clearRect(0, 0, sample.width, sample.height);
      context.drawImage(restoredBitmap, 0, 0);
      const restoredPixels = context.getImageData(0, 520, 800, 80).data;
      let difference = 0;
      for (let index = 0; index < alteredPixels.length; index += 4) {
        difference += Math.abs(alteredPixels[index] - restoredPixels[index])
          + Math.abs(alteredPixels[index + 1] - restoredPixels[index + 1])
          + Math.abs(alteredPixels[index + 2] - restoredPixels[index + 2]);
      }
      alteredBitmap.close(); restoredBitmap.close();
      return difference / (alteredPixels.length / 4 * 3);
    }, [alteredCanvas.toString("base64"), restoredCanvas.toString("base64")]);
    expect(stableLightingDifference).toBeGreaterThan(2);
    expect(restoredScene?.roomId).toBe(restored.roomChange.newRoom.roomId);
    expect(restoredScene?.lighting?.ambientLighting).toMatchObject(restored.roomChange.newRoom.ambientLighting);
    expect(restoredScene?.particleEffectImageMappings).toContainEqual(restored.roomChange.newRoom.particleEffectImageMappings.find(
      (mapping: { effectKey: string; imageSlot: string }) => mapping.effectKey === "particle.candle" && mapping.imageSlot === "flame-tip"
    ));
    const expectedObjects = restored.roomChange.newRoom.renderableRoomObjects;
    expect(Object.values(restoredScene!.objectsById)).toHaveLength(expectedObjects.length);
    for (const expected of expectedObjects) {
      const mapped = Object.values(restoredScene!.objectsById).find((entry) => entry.objectName === expected.name);
      expect(mapped, `Host object ${expected.name} should be present exactly once`).toBeDefined();
      expect(mapped?.sprite).toMatchObject({ x: expected.renderableImage.x, y: expected.renderableImage.y });
      if (expected.pointLight) {
        expect(mapped?.lighting?.pointLight).toMatchObject({ x: expected.pointLight.x, y: expected.pointLight.y });
      }
      if (expected.particleEffect) {
        expect(mapped?.particleEffect).toMatchObject({
          x: expected.particleEffect.x,
          y: expected.particleEffect.y,
          enabled: expected.particleEffect.isProducing
        });
      }
    }
    const beacon = expectedObjects.find((entry: { name: string }) => entry.name === "Restore Beacon");
    const renderedBeacon = Object.values(restoredScene!.objectsById).find((entry) => entry.objectName === "Restore Beacon");
    expect(renderedBeacon?.sprite).toMatchObject({ x: beacon.renderableImage.x, y: beacon.renderableImage.y });
    expect(renderedBeacon?.lighting?.pointLight).toMatchObject({ x: beacon.pointLight.x, y: beacon.pointLight.y });
    expect(renderedBeacon?.particleEffect?.enabled).toBe(beacon.particleEffect.isProducing);
    expect(renderedBeacon?.particleEffect?.tuning).toMatchObject({ SizeMultiplier: 2 });
    expect(restoredScene?.environmentalParticleEffects?.some((effect) => effect.enabled === false)).toBe(true);
    expect(restoredScene?.environmentalParticleEffects?.some((effect) => effect.enabled === true)).toBe(true);
    expect(restoredScene?.environmentalParticleEffects?.filter((effect) => effect.effectKey === "particle.fog").map((effect) => effect.enabled))
      .toEqual(expect.arrayContaining([true, false]));
    expect(restoredScene?.particleEffectBursts ?? []).toHaveLength(0);
    const effectIds = [renderedBeacon?.particleEffect?.id, ...(restoredScene?.environmentalParticleEffects ?? []).map((effect) => effect.id)].filter(Boolean);
    expect(new Set(effectIds).size).toBe(effectIds.length);
    await expect(page.locator("canvas")).toBeVisible();

    await page.getByTestId("load-custom-image").click();
    await expect.poll(() => customFetches).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__hostRestoreHarness?.customImage ?? null)).toContain("data:image/png;base64,");
    const customImage = await page.evaluate(() => window.__hostRestoreHarness?.customImage ?? null);
    expect(Buffer.from(customImage!.split(",")[1], "base64")).toEqual(customBytes);
    expect(createHash("sha256").update(customBytes).digest("hex").toUpperCase()).toBe("6AF009FE71514E5D4D86136D404E7C2A82CB1C8E2A9356CFF28EEDBC88A2297F");

    mode = "ordinary"; deltaDelivered = false;
    await page.getByTestId("ordinary-delta").click();
    await expect.poll(() => page.evaluate(() => Object.values(window.__hostRestoreHarness?.scene?.objectsById ?? {}).find((entry) => entry.objectName === "Restore Beacon")?.sprite?.x)).toBe(beacon.renderableImage.x + 12);
  });
}
