// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DevToolsPanel } from "./DevToolsPanel";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS } from "../gameRenderer/presentationIsolation";
import type { ComponentProps } from "react";

describe("DevToolsPanel lighting control", () => {
  it("shows the default-on lighting setting and reports when the user turns it off", () => {
    const onLightingEnabledChange = vi.fn();
    const props = {
      effectiveSlotModes: {},
      cacheStats: {
        lookupRequests: 0,
        memoryHits: 0,
        indexedDbHits: 0,
        memoryEntryCount: 0,
        memoryBytes: 0,
        indexedDbEntryCount: 0,
        indexedDbBytes: 0,
        networkFetches: 0,
        misses: 0,
        writes: 0,
        memoryEvictions: 0,
        indexedDbEvictions: 0,
        ttlExpirations: 0,
        parseFailures: 0,
        indexedDbErrors: 0
      },
      pollIntervalMs: 500,
      heartbeatEveryNPolls: 10,
      presentationIsolationSettings: DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
      presentationIsolationCategoryOptions: [],
      sessionRecording: { playbackStatus: null },
      onLightingEnabledChange
    } as unknown as ComponentProps<typeof DevToolsPanel>;

    render(<DevToolsPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Presentation Effects" }));

    const lightingToggle = screen.getByRole("checkbox", { name: "Lighting" });
    expect((lightingToggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(lightingToggle);
    expect(onLightingEnabledChange).toHaveBeenCalledWith(false);
  });
});
