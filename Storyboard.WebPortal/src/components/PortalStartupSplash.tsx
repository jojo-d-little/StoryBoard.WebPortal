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

  return (
    <div className="portal-startup-splash" role="dialog" aria-modal="true" aria-labelledby="portal-startup-splash-title">
      <div className="portal-startup-splash__visual" aria-hidden="true">
        <span className="portal-startup-splash__orb portal-startup-splash__orb--outer" />
        <span className="portal-startup-splash__orb portal-startup-splash__orb--middle" />
        <span className="portal-startup-splash__orb portal-startup-splash__orb--inner" />
      </div>
      <section className="portal-startup-splash__card">
        <p className="portal-startup-splash__eyebrow">Preparing session</p>
        <h1 id="portal-startup-splash-title">Getting things ready</h1>
        {isChecking ? (
          <p>Checking sound availability…</p>
        ) : isDenied ? (
          <p>Sound playback is currently unavailable. You can try again or continue with sound disabled.</p>
        ) : (
          <p>Enable sound before the session begins, or continue with sound disabled.</p>
        )}
        {!isChecking ? (
          <div className="portal-startup-splash__actions">
            <button type="button" onClick={() => void (isDenied ? props.onRetryAudio() : props.onEnableAudio())}>
              {isDenied ? "Try sound again" : "Enable sound"}
            </button>
            <button type="button" className="portal-startup-splash__muted-action" onClick={props.onContinueMuted}>
              Continue with sound disabled
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
