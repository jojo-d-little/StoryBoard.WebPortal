/**
 * How playback advances after a line:
 * - "pause": legacy numeric timing (`command | pause-ms`), unchanged.
 * - "complete": wait until this command reaches a successful terminal outcome
 *   (`command | complete`, case-insensitive), then send the next line. A line with
 *   no `|` suffix defaults to "complete". A command that itself contains `|` needs
 *   an explicit suffix, because the text after the last `|` is read as the suffix.
 */
export type CommandSequenceAdvance = "pause" | "complete";

export interface CommandSequenceStep {
  command: string;
  /** Pause after the line in milliseconds; always 0 for a `complete` line. */
  pauseMs: number;
  advance: CommandSequenceAdvance;
  lineNumber: number;
}

export function parseCommandSequence(contents: string): CommandSequenceStep[] {
  const steps: CommandSequenceStep[] = [];
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const separator = line.lastIndexOf("|");
    if (separator < 0) {
      // No suffix: wait for completion, the same as `command | complete`.
      steps.push({ command: line, pauseMs: 0, advance: "complete", lineNumber: index + 1 });
      return;
    }

    const command = line.slice(0, separator).trim();
    const advanceText = line.slice(separator + 1).trim();
    if (!command) throw new Error(`Line ${index + 1}: command cannot be empty.`);
    if (advanceText.toLowerCase() === "complete") {
      steps.push({ command, pauseMs: 0, advance: "complete", lineNumber: index + 1 });
      return;
    }

    if (!/^\d+$/.test(advanceText)) {
      throw new Error(`Line ${index + 1}: expected a non-negative whole number of milliseconds or "complete".`);
    }

    const pauseMs = Number(advanceText);
    if (!Number.isSafeInteger(pauseMs)) {
      throw new Error(`Line ${index + 1}: pause is too large.`);
    }
    steps.push({ command, pauseMs, advance: "pause", lineNumber: index + 1 });
  });

  if (steps.length === 0) throw new Error("The file does not contain any commands.");
  return steps;
}
