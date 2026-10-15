export interface CommandSequenceStep {
  command: string;
  pauseMs: number;
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
      throw new Error(`Line ${index + 1}: expected command | pause-ms.`);
    }

    const command = line.slice(0, separator).trim();
    const pauseText = line.slice(separator + 1).trim();
    if (!command) throw new Error(`Line ${index + 1}: command cannot be empty.`);
    if (!/^\d+$/.test(pauseText)) {
      throw new Error(`Line ${index + 1}: pause must be a non-negative whole number of milliseconds.`);
    }

    const pauseMs = Number(pauseText);
    if (!Number.isSafeInteger(pauseMs)) {
      throw new Error(`Line ${index + 1}: pause is too large.`);
    }
    steps.push({ command, pauseMs, lineNumber: index + 1 });
  });

  if (steps.length === 0) throw new Error("The file does not contain any commands.");
  return steps;
}
