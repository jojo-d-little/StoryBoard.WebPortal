import type { JSX } from "react";
import type { PortalStartupAudioStatus } from "../hooks/usePortalStartupAudioGate";

interface PortalStartupSplashProps {
  status: PortalStartupAudioStatus;
  onEnableAudio: () => void;
  onRetryAudio: () => void;
  onContinueMuted: () => void;
}

export function PortalStartupSplash(props: PortalStartupSplashProps): JSX.Element | null {
  if (props.status === "enabled" || props.status === "muted") {
    return null;
  }

  const isChecking = props.status === "checking";
  const isDenied = props.status === "denied";
  const isPlaying = props.status === "playing";

  return (
    <div
      className="portal-startup-splash"
      data-startup-audio-status={props.status}
      aria-live="polite"
    >
      <div className="portal-startup-splash__backdrop" aria-hidden="true">
        <span className="portal-startup-splash__star portal-startup-splash__star--one" />
        <span className="portal-startup-splash__star portal-startup-splash__star--two" />
        <span className="portal-startup-splash__star portal-startup-splash__star--three" />
        <span className="portal-startup-splash__grid" />
      </div>
      <div className="portal-startup-splash__visual" aria-hidden="true">
        <span className="portal-startup-splash__orb portal-startup-splash__orb--outer" />
        <span className="portal-startup-splash__orb portal-startup-splash__orb--middle" />
        <span className="portal-startup-splash__orb portal-startup-splash__orb--inner" />
        <span className="portal-startup-splash__signal" />
      </div>
      <section className="portal-startup-splash__card">
        <p className="portal-startup-splash__eyebrow">Preparing session</p>
        <h1 id="portal-startup-splash-title">Getting things ready</h1>
        {isChecking ? (
          <p>Checking sound availability…</p>
        ) : isPlaying ? (
          <p>Welcome. Starting your session…</p>
        ) : (
          <p>Preparing the welcome experience…</p>
        )}
      </section>
      {!isChecking && !isPlaying ? (
        <section
          className="portal-startup-splash__permission"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="portal-startup-splash-permission-title"
        >
          <p className="portal-startup-splash__eyebrow">{isDenied ? "Sound unavailable" : "Sound permission"}</p>
          <h2 id="portal-startup-splash-permission-title">
            {isDenied ? "Sound could not be started" : "Enable welcome sound?"}
          </h2>
          <p>
            {isDenied
              ? "Sound playback is currently unavailable. You can try again or continue with sound disabled."
              : "Enable sound before the session begins, or continue with sound disabled."}
          </p>
          <div className="portal-startup-splash__actions">
            <button type="button" onClick={() => void (isDenied ? props.onRetryAudio() : props.onEnableAudio())}>
              {isDenied ? "Try sound again" : "Enable sound"}
            </button>
            <button type="button" className="portal-startup-splash__muted-action" onClick={props.onContinueMuted}>
              Continue with sound disabled
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
