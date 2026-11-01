export interface Point {
  x: number;
  y: number;
}

export interface CameraViewport {
  width: number;
  height: number;
}

export type CameraFit = 'cover' | 'contain';

export interface Camera extends Point {
  scale: number;
  left: number;
  top: number;
  fit: CameraFit;
}

export interface CameraScaleLimits {
  min: number;
  max: number;
}

// World coordinates stay stable when the HUD changes size or the phone rotates.
export const WORLD: CameraViewport = { width: 1100, height: 730 };

export function scaleLimits(
  width: number,
  height: number,
  fit: CameraFit = 'cover',
): CameraScaleLimits {
  const ratios = [Math.max(1, width) / WORLD.width, Math.max(1, height) / WORLD.height];
  const cover = Math.max(...ratios);
  return {
    min: fit === 'contain' ? Math.min(...ratios) : cover,
    max: Math.max(2.8, cover * 2),
  };
}

export function cameraFor(
  width: number,
  height: number,
  center: Point = { x: 550, y: 365 },
  requestedScale: number | null = null,
  fit: CameraFit = 'cover',
): Camera {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const limits = scaleLimits(width, height, fit);
  const scale =
    typeof requestedScale === 'number' && Number.isFinite(requestedScale)
      ? Math.max(limits.min, Math.min(limits.max, requestedScale))
      : fit === 'contain'
        ? limits.min
        : Math.max(0.9, limits.min);
  const halfX = width / (2 * scale);
  const halfY = height / (2 * scale);
  const clamp = (value: number, half: number, size: number): number =>
    half >= size / 2 ? size / 2 : Math.max(half, Math.min(size - half, value));
  const x = clamp(center.x, halfX, WORLD.width);
  const y = clamp(center.y, halfY, WORLD.height);
  return {
    scale,
    x,
    y,
    left: width / 2 - x * scale,
    top: height / 2 - y * scale,
    fit,
  };
}

export function dragCamera(
  camera: Pick<Camera, 'x' | 'y' | 'scale'>,
  dx: number,
  dy: number,
): Point {
  return { x: camera.x - dx / camera.scale, y: camera.y - dy / camera.scale };
}

// Keep the same world point under the two-finger midpoint while it moves.
export function pinchCamera(
  width: number,
  height: number,
  start: Camera,
  startMid: Point,
  mid: Point,
  distanceRatio: number,
): Camera {
  const fit = start.fit || 'cover';
  const limits = scaleLimits(width, height, fit);
  const scale = Math.max(limits.min, Math.min(limits.max, start.scale * distanceRatio));
  const anchor = {
    x: (startMid.x - start.left) / start.scale,
    y: (startMid.y - start.top) / start.scale,
  };
  const center = {
    x: anchor.x - (mid.x - width / 2) / scale,
    y: anchor.y - (mid.y - height / 2) / scale,
  };
  return cameraFor(width, height, center, scale, fit);
}

// Wheel deltas can be pixels, text lines, or pages. Zoom around the pointer.
export function wheelCamera(
  width: number,
  height: number,
  start: Camera,
  point: Point,
  deltaY: number,
  deltaMode: number = 0,
): Camera {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1;
  const pixels = Math.max(-240, Math.min(240, deltaY * unit));
  return pinchCamera(width, height, start, point, point, Math.exp(-pixels * 0.002));
}
