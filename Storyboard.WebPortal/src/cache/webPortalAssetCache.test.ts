/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAssetCacheKey, WebPortalAssetCache } from "./webPortalAssetCache";

describe("webPortalAssetCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes cache key identity values", () => {
    const cacheKey = buildAssetCacheKey({
      gameId: " game-1 ",
      gameKey: " sample.game ",
      relativeLocator: "Assets/PresentationCues/Presentation-Effects.Catalog.json ",
      kind: "cue-catalog-json"
    });

    expect(cacheKey).toBe("v1|cue-catalog-json|game-1|sample.game|assets/presentationcues/presentation-effects.catalog.json");
  });

  it("returns a memory cache hit after set", async () => {
    const cache = new WebPortalAssetCache();

    await cache.set({
      cacheKey: "v1|image-data-url|g-1|sample.game|assets/images/key.png",
      gameId: "g-1",
      gameKey: "sample.game",
      relativeLocator: "assets/images/key.png",
      kind: "image-data-url",
      contentType: "image/png",
      value: "data:image/png;base64,AAE="
    });

    const result = await cache.get("v1|image-data-url|g-1|sample.game|assets/images/key.png");

    expect(result.source).toBe("memory");
    expect(result.entry?.value).toBe("data:image/png;base64,AAE=");
  });

  it("evicts expired memory entries when TTL has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const cache = new WebPortalAssetCache();

    await cache.set({
      cacheKey: "v1|cue-catalog-json|g-1|sample.game|assets/presentationcues/presentation-effects.catalog.json",
      gameId: "g-1",
      gameKey: "sample.game",
      relativeLocator: "assets/PresentationCues/presentation-effects.catalog.json",
      kind: "cue-catalog-json",
      contentType: "application/json",
      value: "{\"schemaVersion\":\"1.0\",\"effects\":[]}",
      ttlMs: 10
    });

    vi.advanceTimersByTime(20);

    const result = await cache.get("v1|cue-catalog-json|g-1|sample.game|assets/presentationcues/presentation-effects.catalog.json");

    expect(result.source).toBe("none");
    expect(result.entry).toBeNull();
  });
});
