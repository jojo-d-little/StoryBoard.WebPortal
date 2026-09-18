import type { HostRequestContext } from "./HostRequestContext";

export interface HostAuthenticateRequest {
  context: HostRequestContext;
  username: string;
  password: string;
  bearerToken: string;
}
