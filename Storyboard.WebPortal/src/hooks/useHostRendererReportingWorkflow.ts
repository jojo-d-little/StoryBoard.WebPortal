import { useCallback } from "react";
import type { GameRendererDiagnosticsEvent } from "../gameRenderer";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

interface RendererScaleMetrics {
  roomWidth: number;
  roomHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

interface RendererLastClickPoint {
  clientX: number;
  clientY: number;
  viewportX: number;
  viewportY: number;
  roomX: number;
  roomY: number;
  insideRoom: boolean;
}

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostRendererReportingWorkflowOptions {
  addDiagnostic: AddDiagnostic;
  setRendererScaleMetrics: (metrics: RendererScaleMetrics | null) => void;
  setRendererLastClickPoint: (clickPoint: RendererLastClickPoint | null) => void;
}

interface UseHostRendererReportingWorkflowResult {
  reportRendererDiagnostic: (event: GameRendererDiagnosticsEvent) => void;
  reportRendererScaleMetrics: (metrics: RendererScaleMetrics | null) => void;
  reportRendererLastClickPoint: (clickPoint: RendererLastClickPoint | null) => void;
}

export function useHostRendererReportingWorkflow(
  options: UseHostRendererReportingWorkflowOptions
): UseHostRendererReportingWorkflowResult {
  const reportRendererDiagnostic = useCallback((event: GameRendererDiagnosticsEvent): void => {
    const level = event.level === "warning"
      ? "warn"
      : event.level === "debug"
        ? "info"
        : event.level;
    options.addDiagnostic(level, `renderer-${event.category}`, event.message, event.details);
  }, [options]);

  const reportRendererScaleMetrics = useCallback((metrics: RendererScaleMetrics | null): void => {
    options.setRendererScaleMetrics(metrics);
  }, [options]);

  const reportRendererLastClickPoint = useCallback((clickPoint: RendererLastClickPoint | null): void => {
    options.setRendererLastClickPoint(clickPoint);
  }, [options]);

  return {
    reportRendererDiagnostic,
    reportRendererScaleMetrics,
    reportRendererLastClickPoint
  };
}
