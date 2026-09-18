export type SetHostStatus = (value: string) => void;

export function ensureCredentialHandle(
  credentialHandle: string,
  setHostStatus: SetHostStatus,
  missingCredentialMessage: string
): boolean {
  if (credentialHandle) {
    return true;
  }

  setHostStatus(missingCredentialMessage);
  return false;
}

export function ensureSignedInSessionContext(
  credentialHandle: string,
  activeSessionId: string,
  setHostStatus: SetHostStatus,
  missingContextMessage: string
): boolean {
  if (credentialHandle && activeSessionId) {
    return true;
  }

  setHostStatus(missingContextMessage);
  return false;
}
