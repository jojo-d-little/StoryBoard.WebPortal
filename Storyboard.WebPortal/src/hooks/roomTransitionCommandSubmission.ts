export async function submitCommandDuringRoomTransition<TResult>(input: {
  transitionActive: boolean;
  commandText: string;
  submit: (commandText: string) => Promise<TResult>;
  report: (message: string, details: { commandText: string }) => void;
}): Promise<TResult> {
  if (input.transitionActive) {
    input.report("Submitting command while room-transition presentation is active; command handling is independent of the visual transition.", {
      commandText: input.commandText
    });
  }

  return input.submit(input.commandText);
}
