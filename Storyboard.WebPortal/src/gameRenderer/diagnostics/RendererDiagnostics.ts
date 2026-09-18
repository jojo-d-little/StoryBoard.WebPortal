export interface GameRendererDiagnosticsEvent {
  category: "asset" | "scene" | "frame" | "lifecycle";
  level: "debug" | "info" | "warning" | "error";
  message: string;
  details?: unknown;
}

export type GameRendererDiagnosticsSink = (event: GameRendererDiagnosticsEvent) => void;
