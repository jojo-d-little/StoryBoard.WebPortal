import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  clearOverrideParams,
  resolveEffectiveOverrides,
  resolveOverride
} from "./overrideResolution";

describe("override resolution", () => {
  it("prefers query over selected", () => {
    const result = resolveOverride("mobilePortrait", "desktop");
    expect(result).toEqual({ value: "mobilePortrait", source: "query" });
  });

  it("falls back to selected when query is empty", () => {
    const result = resolveOverride("", "desktop");
    expect(result).toEqual({ value: "desktop", source: "selection" });
  });

  it("uses default when neither query nor selection is provided", () => {
    const result = resolveOverride("", "");
    expect(result).toEqual({ value: "", source: "default" });
  });

  it("resolves all override categories with query precedence", () => {
    const effective = resolveEffectiveOverrides(
      { ff: "mobileLandscape", cp: "queryProfile", sk: "" },
      { ff: "desktop", cp: "selectedProfile", sk: "desktopStandard" }
    );

    expect(effective.formFactor).toEqual({ value: "mobileLandscape", source: "query" });
    expect(effective.composition).toEqual({ value: "queryProfile", source: "query" });
    expect(effective.skeleton).toEqual({ value: "desktopStandard", source: "selection" });
  });

  it("builds share url using effective override values", () => {
    const shareUrl = buildShareUrl(
      "http://localhost:5173/?old=true",
      {
        formFactor: { value: "mobilePortrait", source: "query" },
        composition: { value: "signedInDefault", source: "selection" },
        skeleton: { value: "", source: "default" }
      }
    );

    expect(shareUrl).toContain("ff=mobilePortrait");
    expect(shareUrl).toContain("cp=signedInDefault");
    expect(shareUrl).not.toContain("sk=");
    expect(shareUrl).toContain("old=true");
  });

  it("clears override params only", () => {
    const cleared = clearOverrideParams("http://localhost:5173/?ff=desktop&cp=default&sk=layoutX&persist=1");
    expect(cleared).toContain("persist=1");
    expect(cleared).not.toContain("ff=");
    expect(cleared).not.toContain("cp=");
    expect(cleared).not.toContain("sk=");
  });
});
