import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import welcomeSplashUrl from "../assets/sounds/welcome-splash.wav";

export type PortalStartupAudioStatus =
  | "checking"
  | "needs-user-action"
  | "denied"
  | "enabled"
  | "muted";

export interface PortalStartupAudioGate {
  status: PortalStartupAudioStatus;
  startupAudioReady: boolean;
  enableAudio: () => Promise<void>;
  retryAudio: () => Promise<void>;
  continueMuted: () => void;
}

function isAutoplayBlockedError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "NotAllowedError"
    : error instanceof Error && error.name === "NotAllowedError";
}

export function usePortalStartupAudioGate(): PortalStartupAudioGate {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PortalStartupAudioStatus>("checking");

  const tryWelcomePlayback = useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) {
      setStatus("denied");
      return;
    }

    try {
      audio.currentTime = 0;
      audio.volume = 0.35;
      await audio.play();
      setStatus("enabled");
    } catch (error) {
      setStatus(isAutoplayBlockedError(error) ? "needs-user-action" : "denied");
    }
  }, []);

  const enableAudio = useCallback(async (): Promise<void> => {
    await tryWelcomePlayback();
  }, [tryWelcomePlayback]);

  const retryAudio = useCallback(async (): Promise<void> => {
    setStatus("needs-user-action");
    await tryWelcomePlayback();
  }, [tryWelcomePlayback]);

  const continueMuted = useCallback((): void => {
    setStatus("muted");
  }, []);

  useEffect(() => {
    if (typeof Audio === "undefined") {
      setStatus("denied");
      return;
    }

    const audio = new Audio(welcomeSplashUrl);
    audio.preload = "auto";
    audioRef.current = audio;
    void tryWelcomePlayback();

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [tryWelcomePlayback]);

  return useMemo(() => ({
    status,
    startupAudioReady: status === "enabled" || status === "muted",
    enableAudio,
    retryAudio,
    continueMuted
  }), [continueMuted, enableAudio, retryAudio, status]);
}
