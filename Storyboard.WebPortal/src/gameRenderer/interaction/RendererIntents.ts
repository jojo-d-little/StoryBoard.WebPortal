import type { GameRendererIntent } from "../contracts/intents";

export type EmitRendererIntent = (intent: GameRendererIntent) => void;
