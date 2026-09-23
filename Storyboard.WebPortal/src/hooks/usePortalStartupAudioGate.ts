import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import welcomeSplashUrl from "../assets/sounds/welcome-splash.wav";

export type PortalStartupAudioStatus =
  | "checking"
  | "needs-user-action"
  | "denied"
  | "playing"
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

const MINIMUM_SPLASH_DURATION_MS = 3000;

function getPlaybackFallbackDurationMs(audio: HTMLAudioElement): number {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    return MINIMUM_SPLASH_DURATION_MS;
  }

  return Math.max(MINIMUM_SPLASH_DURATION_MS, Math.ceil(audio.duration * 1000) + 250);
}

export function usePortalStartupAudioGate(): PortalStartupAudioGate {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const playbackStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<PortalStartupAudioStatus>("checking");

  const clearFallbackTimer = useCallback((): void => {
    if (fallbackTimerRef.current === null) {
      return;
    }

    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const finishWelcomePlayback = useCallback((): void => {
    const startedAt = playbackStartedAtRef.current;
    const elapsedMs = startedAt === null ? MINIMUM_SPLASH_DURATION_MS : performance.now() - startedAt;
    const remainingMs = Math.max(0, MINIMUM_SPLASH_DURATION_MS - elapsedMs);

    clearFallbackTimer();
    if (remainingMs > 0) {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        setStatus((currentStatus) => currentStatus === "playing" ? "enabled" : currentStatus);
      }, remainingMs);
      return;
    }

    setStatus((currentStatus) => currentStatus === "playing" ? "enabled" : currentStatus);
  }, [clearFallbackTimer]);

  const schedulePlaybackFallback = useCallback((audio: HTMLAudioElement): void => {
    clearFallbackTimer();
    fallbackTimerRef.current = window.setTimeout(() => {
      fallbackTimerRef.current = null;
      finishWelcomePlayback();
    }, getPlaybackFallbackDurationMs(audio));
  }, [clearFallbackTimer, finishWelcomePlayback]);

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
      playbackStartedAtRef.current = performance.now();
      setStatus("playing");
      schedulePlaybackFallback(audio);
      if (audio.ended) {
        finishWelcomePlayback();
      }
    } catch (error) {
      playbackStartedAtRef.current = null;
      clearFallbackTimer();
      setStatus(isAutoplayBlockedError(error) ? "needs-user-action" : "denied");
    }
  }, [clearFallbackTimer, finishWelcomePlayback, schedulePlaybackFallback]);

  const enableAudio = useCallback(async (): Promise<void> => {
    await tryWelcomePlayback();
  }, [tryWelcomePlayback]);

  const retryAudio = useCallback(async (): Promise<void> => {
    setStatus("needs-user-action");
    await tryWelcomePlayback();
  }, [tryWelcomePlayback]);

  const continueMuted = useCallback((): void => {
    clearFallbackTimer();
    playbackStartedAtRef.current = null;
    audioRef.current?.pause();
    setStatus("muted");
  }, [clearFallbackTimer]);

  useEffect(() => {
    if (typeof Audio === "undefined") {
      setStatus("denied");
      return;
    }

    const audio = new Audio(welcomeSplashUrl);
    audio.preload = "auto";
    audio.addEventListener("ended", finishWelcomePlayback);
    audioRef.current = audio;
    void tryWelcomePlayback();

    return () => {
      clearFallbackTimer();
      audio.removeEventListener("ended", finishWelcomePlayback);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [clearFallbackTimer, finishWelcomePlayback, tryWelcomePlayback]);

  return useMemo(() => ({
    status,
    startupAudioReady: status === "enabled" || status === "muted",
    enableAudio,
    retryAudio,
    continueMuted
  }), [continueMuted, enableAudio, retryAudio, status]);
}
