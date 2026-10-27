import { describe, expect, it, vi } from "vitest";
import { submitCommandDuringRoomTransition } from "./roomTransitionCommandSubmission";

describe("room transition command submission", () => {
  it("submits a command while the renderer callback is delayed or missing", async () => {
    const submit = vi.fn(async (commandText: string) => ({ commandText, success: true }));
    const report = vi.fn();

    const result = await submitCommandDuringRoomTransition({
      transitionActive: true,
      commandText: "weather_rain",
      submit,
      report
    });

    expect(submit).toHaveBeenCalledWith("weather_rain");
    expect(result).toEqual({ commandText: "weather_rain", success: true });
    expect(report).toHaveBeenCalledWith(
      "Submitting command while room-transition presentation is active; command handling is independent of the visual transition.",
      { commandText: "weather_rain" }
    );
  });

  it("submits commands after the destination scene is displayed", async () => {
    const submit = vi.fn(async (commandText: string) => commandText);

    await expect(submitCommandDuringRoomTransition({
      transitionActive: false,
      commandText: "weather_rain",
      submit,
      report: vi.fn()
    })).resolves.toBe("weather_rain");

    expect(submit).toHaveBeenCalledTimes(1);
  });
});
