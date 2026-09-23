import { describe, expect, it } from "vitest";
import { readPortalLaunchContext } from "./portalLaunchContext";

describe("readPortalLaunchContext", () => {
  it("reads the explicit simulator mode, username, and auto-start policy", () => {
    expect(readPortalLaunchContext("?mode=devsimulator&username=dev%20user&autoStartSession=true")).toEqual({
      mode: "devsimulator",
      username: "dev user",
      autoStartSession: true
    });
  });

  it("does not request automatic session start unless explicitly enabled", () => {
    expect(readPortalLaunchContext("?mode=devsimulator&username=dev")).toEqual({
      mode: "devsimulator",
      username: "dev",
      autoStartSession: false
    });
  });

  it("uses the normal mode and no bootstrap values when the launch query is empty", () => {
    expect(readPortalLaunchContext("")).toEqual({
      mode: "normal",
      username: "",
      autoStartSession: false
    });
  });
});
