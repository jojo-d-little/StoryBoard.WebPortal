import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import type { HostWorkflowState } from "../hooks/useHostWorkflow";

interface TopBarMenuV1Props {
  state: string;
  hostWorkflow: HostWorkflowState;
  showDevToolsButton: boolean;
  devToolsVisible: boolean;
  onToggleDevTools: () => void;
}

const HELP_PAGES = import.meta.glob("../../help/*.html", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

const FALLBACK_HELP_PAGE_KEY = "../../help/help.html";
const FALLBACK_HELP_CONTENT = "<!doctype html><html><head><title>Help</title></head><body><main><h1>Help content unavailable.</h1></main></body></html>";

interface DragState {
  active: boolean;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

function resolveHelpPageDocument(experienceState: string): { fileName: string; content: string } {
  const stateFileName = `${encodeURIComponent(experienceState)}.html`;
  const stateFileKey = `../../help/${stateFileName}`;
  const fallbackContent = HELP_PAGES[FALLBACK_HELP_PAGE_KEY] ?? FALLBACK_HELP_CONTENT;
  const stateContent = HELP_PAGES[stateFileKey];

  if (stateContent) {
    return {
      fileName: stateFileName,
      content: stateContent
    };
  }

  return {
    fileName: "help.html",
    content: fallbackContent
  };
}

export function TopBarMenuV1(props: TopBarMenuV1Props): JSX.Element {
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [identityOpen, setIdentityOpen] = useState<boolean>(false);
  const [helpUndocked, setHelpUndocked] = useState<boolean>(false);
  const [helpDialogOffset, setHelpDialogOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingHelpDialog, setIsDraggingHelpDialog] = useState<boolean>(false);
  const helpUndockedWindowRef = useRef<Window | null>(null);
  const helpUndockedPollRef = useRef<number | null>(null);
  const helpDialogDragStateRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  });
  const identityMenuRef = useRef<HTMLDivElement | null>(null);

  const canLeaveSession = Boolean(
    props.hostWorkflow.credentialHandle
    && (props.hostWorkflow.activeSessionId || props.hostWorkflow.selectedSessionId)
    && !props.hostWorkflow.hostBusy
  );
  const canRefreshIdentity = Boolean(props.hostWorkflow.credentialHandle) && !props.hostWorkflow.hostBusy;
  const authStateLabel = props.hostWorkflow.credentialHandle ? "Signed In" : "Guest";

  const principalLabel = props.hostWorkflow.principalName || "Guest";

  const showSessionActions = props.state === "SessionActive";

  const helpDialogTitle = useMemo(() => {
    return `Help: ${props.state}`;
  }, [props.state]);

  const helpPageDocument = useMemo(() => {
    return resolveHelpPageDocument(props.state);
  }, [props.state]);

  function clearHelpUndockedPoll(): void {
    if (helpUndockedPollRef.current !== null) {
      window.clearInterval(helpUndockedPollRef.current);
      helpUndockedPollRef.current = null;
    }
  }

  function openUndockedHelpWindow(): void {
    const popup = window.open(
      "",
      "storyboard-help-undocked",
      "popup=yes,width=920,height=760,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      return;
    }

    popup.document.open();
    popup.document.write(helpPageDocument.content);
    popup.document.close();
    if (!popup.document.title) {
      popup.document.title = helpDialogTitle;
    }

    helpUndockedWindowRef.current = popup;
    setHelpUndocked(true);
    setHelpOpen(false);

    clearHelpUndockedPoll();
    helpUndockedPollRef.current = window.setInterval(() => {
      const undockedWindow = helpUndockedWindowRef.current;
      if (!undockedWindow || undockedWindow.closed) {
        helpUndockedWindowRef.current = null;
        setHelpUndocked(false);
        clearHelpUndockedPoll();
      }
    }, 400);

    popup.focus();
  }

  function dockHelpWindowBack(): void {
    const undockedWindow = helpUndockedWindowRef.current;
    if (undockedWindow && !undockedWindow.closed) {
      undockedWindow.close();
    }

    helpUndockedWindowRef.current = null;
    setHelpUndocked(false);
    clearHelpUndockedPoll();
    setHelpOpen(true);
  }

  useEffect(() => {
    function stopDragging(pointerId: number | null): void {
      const dragState = helpDialogDragStateRef.current;
      if (!dragState.active) {
        return;
      }

      if (pointerId !== null && dragState.pointerId !== null && pointerId !== dragState.pointerId) {
        return;
      }

      dragState.active = false;
      dragState.pointerId = null;
      setIsDraggingHelpDialog(false);
    }

    function handlePointerMove(event: PointerEvent): void {
      const dragState = helpDialogDragStateRef.current;
      if (!dragState.active) {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      setHelpDialogOffset({
        x: dragState.startOffsetX + deltaX,
        y: dragState.startOffsetY + deltaY
      });
    }

    function handlePointerUp(event: PointerEvent): void {
      stopDragging(event.pointerId);
    }

    function handlePointerCancel(event: PointerEvent): void {
      stopDragging(event.pointerId);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (!identityMenuRef.current || !target) {
        return;
      }

      if (!identityMenuRef.current.contains(target)) {
        setIdentityOpen(false);
      }
    }

    if (!identityOpen) {
      return;
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [identityOpen]);

  useEffect(() => {
    return () => {
      clearHelpUndockedPoll();
      const undockedWindow = helpUndockedWindowRef.current;
      if (undockedWindow && !undockedWindow.closed) {
        undockedWindow.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!helpUndocked) {
      return;
    }

    const undockedWindow = helpUndockedWindowRef.current;
    if (!undockedWindow || undockedWindow.closed) {
      return;
    }

    undockedWindow.document.open();
    undockedWindow.document.write(helpPageDocument.content);
    undockedWindow.document.close();
    if (!undockedWindow.document.title) {
      undockedWindow.document.title = helpDialogTitle;
    }
  }, [helpUndocked, helpPageDocument, helpDialogTitle]);

  useEffect(() => {
    if (helpOpen) {
      setHelpDialogOffset({ x: 0, y: 0 });
    }
  }, [helpOpen, props.state]);

  function beginHelpDialogDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }

    const targetElement = event.target as Element | null;
    if (targetElement?.closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }

    const dragState = helpDialogDragStateRef.current;
    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.startClientX = event.clientX;
    dragState.startClientY = event.clientY;
    dragState.startOffsetX = helpDialogOffset.x;
    dragState.startOffsetY = helpDialogOffset.y;

    setIsDraggingHelpDialog(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  const helpDialogStyle = {
    "--help-dialog-drag-x": `${helpDialogOffset.x}px`,
    "--help-dialog-drag-y": `${helpDialogOffset.y}px`
  } as CSSProperties;

  return (
    <section className="storyboard-topbar" aria-label="Application top bar">
      <div className="storyboard-topbar-left">
        {showSessionActions ? (
          <>
            <button type="button" onClick={props.hostWorkflow.leaveActiveSession} disabled={!canLeaveSession}>
              Leave Game
            </button>
            {props.hostWorkflow.activeSessionIsOwner ? (
              <button type="button" onClick={props.hostWorkflow.quitActiveSession} disabled={!canLeaveSession}>
                Quit Game
              </button>
            ) : null}
          </>
        ) : null}

      </div>

      <div className="storyboard-topbar-right" ref={identityMenuRef}>
        <button type="button" onClick={() => setIdentityOpen((open) => !open)}>
          Identity: {principalLabel}
        </button>

        <button
          type="button"
          onClick={() => {
            setIdentityOpen(false);
            if (helpUndocked) {
              const undockedWindow = helpUndockedWindowRef.current;
              if (undockedWindow && !undockedWindow.closed) {
                undockedWindow.focus();
                return;
              }

              setHelpUndocked(false);
            }

            setHelpOpen((open) => !open);
          }}
        >
          Help
        </button>

        {props.showDevToolsButton ? (
          <button
            type="button"
            onClick={() => {
              setIdentityOpen(false);
              props.onToggleDevTools();
            }}
          >
            {props.devToolsVisible ? "Hide Dev Tools" : "Dev Tools"}
          </button>
        ) : null}

        {helpUndocked ? (
          <button type="button" onClick={dockHelpWindowBack}>
            Dock Help
          </button>
        ) : null}

        {identityOpen ? (
          <div className="storyboard-topbar-identity-menu" role="dialog" aria-label="Identity details">
            <p><strong>Auth:</strong> {authStateLabel}</p>
            <p><strong>User:</strong> {principalLabel}</p>
            <p><strong>Credential:</strong> {props.hostWorkflow.credentialHandle || "(none)"}</p>
            <p><strong>Session:</strong> {props.hostWorkflow.activeSessionId || "(none)"}</p>
            <div className="events">
              <button type="button" onClick={props.hostWorkflow.fetchCurrentPrincipal} disabled={!canRefreshIdentity}>Refresh Identity</button>
              <button type="button" onClick={props.hostWorkflow.signOut}>Logout</button>
            </div>
          </div>
        ) : null}
      </div>

      {helpOpen ? (
        <aside
          className={`storyboard-topbar-help-dialog ${isDraggingHelpDialog ? "dragging" : ""}`}
          role="dialog"
          aria-label={helpDialogTitle}
          style={helpDialogStyle}
        >
          <header onPointerDown={beginHelpDialogDrag}>
            <h3>{helpDialogTitle}</h3>
            <div className="storyboard-topbar-help-actions">
              <button type="button" onClick={openUndockedHelpWindow} aria-label="Undock help dialog">
                Undock
              </button>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help dialog">
                Close
              </button>
            </div>
          </header>
          <iframe title={helpDialogTitle} srcDoc={helpPageDocument.content} />
        </aside>
      ) : null}
    </section>
  );
}
