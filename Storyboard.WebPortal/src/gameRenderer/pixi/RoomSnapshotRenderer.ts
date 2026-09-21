import { Container, Rectangle, type Renderer, type Texture } from "pixi.js";

const MAX_SNAPSHOT_TEXTURE_DIMENSION = 4096;
const MAX_SNAPSHOT_PIXEL_COUNT = 4096 * 4096;

export interface RoomSnapshotRequest {
  roomId: string;
  width: number;
  height: number;
  resolutionScale: number;
}

export interface CapturedRoomTexture {
  roomId: string;
  width: number;
  height: number;
  resolution: number;
  texture: Texture;
  dispose: () => void;
}

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function resolveRendererTextureDimension(renderer: Renderer): number | undefined {
  const capabilities = renderer as unknown as {
    gl?: {
      MAX_TEXTURE_SIZE?: number;
      getParameter?: (parameter: number) => unknown;
    };
    gpu?: {
      device?: {
        limits?: {
          maxTextureDimension2D?: number;
        };
      };
    };
  };

  const gl = capabilities.gl;
  if (gl?.getParameter && Number.isFinite(gl.MAX_TEXTURE_SIZE)) {
    const value = gl.getParameter(gl.MAX_TEXTURE_SIZE as number);
    if (Number.isFinite(value) && Number(value) > 0) {
      return Number(value);
    }
  }

  const webGpuLimit = capabilities.gpu?.device?.limits?.maxTextureDimension2D;
  return Number.isFinite(webGpuLimit) && Number(webGpuLimit) > 0
    ? Number(webGpuLimit)
    : undefined;
}

function resolveCaptureResolution(
  width: number,
  height: number,
  requestedScale: number,
  rendererTextureDimension?: number
): number {
  const normalizedScale = Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1;
  const effectiveTextureDimension = Math.min(
    MAX_SNAPSHOT_TEXTURE_DIMENSION,
    rendererTextureDimension ?? Number.POSITIVE_INFINITY
  );
  const dimensionLimit = Math.min(
    effectiveTextureDimension / width,
    effectiveTextureDimension / height
  );
  const pixelLimit = Math.sqrt(MAX_SNAPSHOT_PIXEL_COUNT / (width * height));
  return Math.max(0.0001, Math.min(normalizedScale, dimensionLimit, pixelLimit));
}

/**
 * Captures the final room-space composition into a bounded GPU texture. The slide transition is
 * the first consumer. A future discovered-map feature is expected to reuse this boundary and add
 * thumbnail extraction/persistence outside this module; map-specific encoding, storage, and
 * player-marker exclusion are intentionally not responsibilities of this initial implementation.
 */
export function captureRoomTexture(
  renderer: Renderer,
  surface: Container,
  request: RoomSnapshotRequest
): CapturedRoomTexture {
  const width = normalizeDimension(request.width);
  const height = normalizeDimension(request.height);
  const rendererTextureDimension = resolveRendererTextureDimension(renderer);
  const resolution = resolveCaptureResolution(
    width,
    height,
    request.resolutionScale,
    rendererTextureDimension
  );
  const previousVisible = surface.visible;
  const previousAlpha = surface.alpha;
  const previousMask = surface.mask;
  const previousX = surface.position.x;
  const previousY = surface.position.y;
  const previousIsRenderGroup = surface.isRenderGroup;

  surface.visible = true;
  surface.alpha = 1;
  surface.mask = null;
  surface.position.set(0, 0);

  try {
    const texture = renderer.generateTexture({
      target: surface,
      frame: new Rectangle(0, 0, width, height),
      resolution,
      antialias: true,
      clearColor: 0x0f172a
    });
    let disposed = false;

    return {
      roomId: request.roomId,
      width,
      height,
      resolution,
      texture,
      dispose: () => {
        if (disposed) {
          return;
        }

        disposed = true;
        texture.destroy(true);
      }
    };
  } finally {
    surface.position.set(previousX, previousY);
    // Pixi promotes every direct render target to a render group. Restore the caller's render
    // topology so taking a snapshot cannot change subsequent live mask/transform behavior.
    if (!previousIsRenderGroup && surface.isRenderGroup) {
      surface.disableRenderGroup();
    }
    surface.mask = previousMask;
    surface.alpha = previousAlpha;
    surface.visible = previousVisible;
  }
}
