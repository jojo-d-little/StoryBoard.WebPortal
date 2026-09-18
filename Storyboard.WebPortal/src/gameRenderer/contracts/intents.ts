export interface GameRendererPointerIntent {
  type: "pointer";
  action: "tap" | "dragStart" | "dragMove" | "dragEnd";
  x: number;
  y: number;
  pointerId?: number;
}

export interface GameRendererCommandIntent {
  type: "command";
  action: "submit" | "cancel";
  commandText?: string;
}

export type GameRendererIntent = GameRendererPointerIntent | GameRendererCommandIntent;

export type GameRendererIntentSink = (intent: GameRendererIntent) => void;
