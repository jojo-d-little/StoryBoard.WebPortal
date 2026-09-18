import type { HostGameAccessDescriptor } from "./HostGameAccessDescriptor";

export interface HostGameDetailsDescriptor {
  gameId: string;
  gameKey: string;
  displayName: string;
  summary: string;
  access: HostGameAccessDescriptor;
  previewImages: string[];
}
