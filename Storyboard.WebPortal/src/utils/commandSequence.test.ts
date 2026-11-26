import { describe, expect, it } from "vitest";
import { parseCommandSequence } from "./commandSequence";

describe("parseCommandSequence", () => {
  it("keeps legacy numeric pauses, including zero, unchanged", () => {
    expect(parseCommandSequence("look | 1000\n\n# comment\ngo north|0")).toEqual([
      { command: "look", pauseMs: 1000, advance: "pause", lineNumber: 1 },
      { command: "go north", pauseMs: 0, advance: "pause", lineNumber: 4 }
    ]);
  });

  it("accepts complete case-insensitively and mixes it with numeric lines", () => {
    const steps = parseCommandSequence([
      "﻿stack yellow suitcase on trunk | complete",
      "stack green suitcase on yellow suitcase |COMPLETE ",
      "look | Complete",
      "inventory | 250"
    ].join("\r\n"));
    expect(steps.map((step) => [step.command, step.advance, step.pauseMs, step.lineNumber])).toEqual([
      ["stack yellow suitcase on trunk", "complete", 0, 1],
      ["stack green suitcase on yellow suitcase", "complete", 0, 2],
      ["look", "complete", 0, 3],
      ["inventory", "pause", 250, 4]
    ]);
  });

  it("defaults a line without a suffix to complete, alongside explicit suffixes", () => {
    expect(parseCommandSequence("open west door\n  go west  \nlook | 1000\ninventory | complete")).toEqual([
      { command: "open west door", pauseMs: 0, advance: "complete", lineNumber: 1 },
      { command: "go west", pauseMs: 0, advance: "complete", lineNumber: 2 },
      { command: "look", pauseMs: 1000, advance: "pause", lineNumber: 3 },
      { command: "inventory", pauseMs: 0, advance: "complete", lineNumber: 4 }
    ]);
  });

  it("splits on the last separator so commands may contain pipes", () => {
    expect(parseCommandSequence("say a|b | complete")[0]).toMatchObject({ command: "say a|b", advance: "complete" });
  });

  it("strips a leading byte order mark written as an escape", () => {
    const steps = parseCommandSequence("\uFEFFstack yellow suitcase on trunk | complete\nlook | 500");
    expect(steps[0].command.startsWith("\uFEFF")).toBe(false);
    expect(steps[0].command).toBe("stack yellow suitcase on trunk");
    expect(steps[0]).toMatchObject({ advance: "complete", lineNumber: 1 });
    expect(steps[1]).toMatchObject({ command: "look", advance: "pause", pauseMs: 500 });
  });

  it.each([
    [" | complete", "Line 1: command cannot be empty."],
    ["# c\nlook | completed", "Line 2: expected a non-negative whole number of milliseconds or \"complete\"."],
    ["look | -5", "Line 1: expected a non-negative whole number of milliseconds or \"complete\"."],
    ["look | 1.5", "Line 1: expected a non-negative whole number of milliseconds or \"complete\"."],
    ["look |", "Line 1: expected a non-negative whole number of milliseconds or \"complete\"."],
    ["look | 99999999999999999999", "Line 1: pause is too large."],
    ["# only comments\n\n", "The file does not contain any commands."]
  ])("rejects %j with a line-numbered error", (contents, message) => {
    expect(() => parseCommandSequence(contents)).toThrow(message);
  });
});
