import { useCallback, useRef, useState } from "react";
import type { HostSessionDataEnvelope } from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

type SessionAttachReason = "session-start" | "session-join" | "session-reconnect";

export type SessionOutputLineSource = "session-delta" | "client-command" | "phase-step";

interface PendingAttachEchoDiagnostic {
  reason: SessionAttachReason;
  targetSessionId: string;
  sessionDeltaResetEpoch: number;
}

interface UseSessionEchoWorkflowOptions {
  activeSessionId: string;
  echoOutputRetentionLines: number;
  addDiagnostic: AddDiagnostic;
}

interface UseSessionEchoWorkflowResult {
  sessionOutputLines: string[];
  sessionDeltaResetEpoch: number;
  clearSessionOutputLines: () => void;
  appendSessionOutputLines: (lines: string[], source: SessionOutputLineSource) => void;
  appendClientCommandEcho: (commandText: string) => void;
  consumeSessionDeltaEcho: (sessionData: HostSessionDataEnvelope) => void;
  resetEchoForSessionAttach: (reason: SessionAttachReason, targetSessionId: string) => void;
}

export function useSessionEchoWorkflow(options: UseSessionEchoWorkflowOptions): UseSessionEchoWorkflowResult {
  const [sessionOutputLines, setSessionOutputLines] = useState<string[]>([]);
  const [sessionDeltaResetEpoch, setSessionDeltaResetEpoch] = useState<number>(0);
  const lastOutputWatermarkRef = useRef<string>("");
  const lastOutputSignatureRef = useRef<string>("");
  const skippedDuplicateWatermarkCountRef = useRef<number>(0);
  const skippedDuplicateSignatureCountRef = useRef<number>(0);
  const pendingAttachEchoDiagnosticRef = useRef<PendingAttachEchoDiagnostic | null>(null);

  const appendOutputLines = useCallback((lines: string[], source: SessionOutputLineSource): void => {
    const trimmedLines = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (trimmedLines.length === 0) {
      return;
    }

    setSessionOutputLines((previous) => {
      const next = [...previous, ...trimmedLines];
      const trimmed = next.slice(Math.max(0, next.length - options.echoOutputRetentionLines));
      const droppedLineCount = Math.max(0, next.length - trimmed.length);

      options.addDiagnostic(
        "info",
        "session-echo",
        source === "client-command" ? "Client command line appended." : "Session echo lines appended.",
        {
          source,
          lines: trimmedLines,
          appendedLineCount: trimmedLines.length,
          previousCount: previous.length,
          nextCount: trimmed.length,
          droppedLineCount,
          retentionLimit: options.echoOutputRetentionLines,
          activeSessionId: options.activeSessionId || "(none)"
        }
      );

      return trimmed;
    });
  }, [options.activeSessionId, options.addDiagnostic, options.echoOutputRetentionLines]);

  const clearSessionOutputLines = useCallback((): void => {
    setSessionOutputLines([]);
    lastOutputWatermarkRef.current = "";
    lastOutputSignatureRef.current = "";
    skippedDuplicateWatermarkCountRef.current = 0;
    skippedDuplicateSignatureCountRef.current = 0;
  }, []);

  const appendClientCommandEcho = useCallback((commandText: string): void => {
    appendOutputLines([`> ${commandText}`], "client-command");
  }, [appendOutputLines]);

  const consumeSessionDeltaEcho = useCallback((sessionData: HostSessionDataEnvelope): void => {
    if (sessionData.outputLines.length === 0) {
      return;
    }

    const watermark = sessionData.sessionDeltaWatermark.trim();
    const signature = `${watermark}|${sessionData.outputLines.join("\n")}`;

    if (watermark && watermark === lastOutputWatermarkRef.current) {
      skippedDuplicateWatermarkCountRef.current += 1;
      const duplicateWatermarkSkipCount = skippedDuplicateWatermarkCountRef.current;
      if (duplicateWatermarkSkipCount === 1 || duplicateWatermarkSkipCount % 10 === 0) {
        options.addDiagnostic("warn", "session-echo", "Skipped duplicate session echo batch by watermark.", {
          duplicateWatermarkSkipCount,
          watermark,
          outputLineCount: sessionData.outputLines.length,
          activeSessionId: options.activeSessionId || "(none)"
        });
      }
      return;
    }

    if (!watermark && signature === lastOutputSignatureRef.current) {
      skippedDuplicateSignatureCountRef.current += 1;
      const duplicateSignatureSkipCount = skippedDuplicateSignatureCountRef.current;
      if (duplicateSignatureSkipCount === 1 || duplicateSignatureSkipCount % 10 === 0) {
        options.addDiagnostic("warn", "session-echo", "Skipped duplicate session echo batch by signature.", {
          duplicateSignatureSkipCount,
          outputLineCount: sessionData.outputLines.length,
          activeSessionId: options.activeSessionId || "(none)"
        });
      }
      return;
    }

    skippedDuplicateWatermarkCountRef.current = 0;
    skippedDuplicateSignatureCountRef.current = 0;
    appendOutputLines(sessionData.outputLines, "session-delta");

    options.addDiagnostic("info", "session-echo", "Accepted session echo batch.", {
      watermark: watermark || "(none)",
      lines: sessionData.outputLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      outputLineCount: sessionData.outputLines.length,
      activeSessionId: options.activeSessionId || "(none)"
    });

    const pendingAttachEchoDiagnostic = pendingAttachEchoDiagnosticRef.current;
    if (pendingAttachEchoDiagnostic) {
      options.addDiagnostic("info", "session-echo", "First accepted echo batch after session attach.", {
        reason: pendingAttachEchoDiagnostic.reason,
        targetSessionId: pendingAttachEchoDiagnostic.targetSessionId,
        sessionDeltaResetEpoch: pendingAttachEchoDiagnostic.sessionDeltaResetEpoch,
        watermark: watermark || "(none)",
        outputLineCount: sessionData.outputLines.length,
        activeSessionId: options.activeSessionId || "(none)"
      });
      pendingAttachEchoDiagnosticRef.current = null;
    }

    if (watermark) {
      lastOutputWatermarkRef.current = watermark;
    }
    lastOutputSignatureRef.current = signature;
  }, [appendOutputLines, options.activeSessionId, options.addDiagnostic]);

  const resetEchoForSessionAttach = useCallback((reason: SessionAttachReason, targetSessionId: string): void => {
    const previousEchoCount = sessionOutputLines.length;
    const previousWatermark = lastOutputWatermarkRef.current || "(none)";
    const previousSignatureSet = lastOutputSignatureRef.current.length > 0;

    clearSessionOutputLines();
    setSessionDeltaResetEpoch((value) => {
      const next = value + 1;
      pendingAttachEchoDiagnosticRef.current = {
        reason,
        targetSessionId,
        sessionDeltaResetEpoch: next
      };

      options.addDiagnostic("info", "session-echo", "Session attach reset echo and polling state.", {
        reason,
        targetSessionId,
        previousEchoCount,
        previousWatermark,
        previousSignatureSet,
        sessionDeltaResetEpoch: next
      });

      return next;
    });
  }, [clearSessionOutputLines, options.addDiagnostic, sessionOutputLines.length]);

  return {
    sessionOutputLines,
    sessionDeltaResetEpoch,
    clearSessionOutputLines,
    appendSessionOutputLines: appendOutputLines,
    appendClientCommandEcho,
    consumeSessionDeltaEcho,
    resetEchoForSessionAttach
  };
}
