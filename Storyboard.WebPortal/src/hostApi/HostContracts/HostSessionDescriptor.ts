export interface HostSessionDescriptor {
  sessionId: string;
  gameId: string;
  gameKey: string;
  sessionName: string;
  sessionState: string;
  ownerPrincipalId: string;
  joinPolicy: string;
  canJoin: boolean;
  canLeave: boolean;
  isJoined: boolean;
  isOwner: boolean;
}
