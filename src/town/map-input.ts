import { cameraFor, dragCamera, pinchCamera } from './camera';
import type { Camera, Point } from './camera';

export type PointerId = number;

export interface PanGesture {
  point: Point;
  camera: Camera;
}

export interface PinchGesture {
  camera: Camera;
  mid: Point;
  distance: number;
}

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const distance = (a: Point, b: Point): number => Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

function firstTwo(points: ReadonlyMap<PointerId, Point>): [Point, Point] {
  const iterator = points.values();
  const a = iterator.next().value;
  const b = iterator.next().value;
  if (a === undefined || b === undefined) {
    throw new Error('A pinch requires two active pointers.');
  }
  return [a, b];
}

// This state machine owns only map gestures. Racks and dialogs use native scrolling.
export class MapInput {
  readonly points = new Map<PointerId, Point>();
  readonly ignored = new Set<PointerId>();
  active = false;
  private pan: PanGesture | null = null;
  private pinch: PinchGesture | null = null;
  private width = 0;
  private height = 0;

  get blocksClick(): boolean {
    return this.points.size > 0 || this.ignored.size > 0;
  }

  down(id: PointerId, point: Point, camera: Camera, width: number, height: number): boolean {
    if (this.points.has(id) || this.ignored.has(id)) return false;
    if (this.points.size >= 2) {
      this.ignored.add(id);
      return false;
    }
    this.width = width;
    this.height = height;
    this.points.set(id, point);
    if (this.points.size === 1) {
      this.active = false;
      this.pan = { point, camera };
    } else {
      const [a, b] = firstTwo(this.points);
      this.pinch = { camera, mid: midpoint(a, b), distance: distance(a, b) };
      this.active = true;
    }
    return true;
  }

  move(id: PointerId, point: Point): Camera | null {
    if (!this.points.has(id)) return null;
    this.points.set(id, point);
    if (this.points.size === 2) {
      const [a, b] = firstTwo(this.points);
      const pinch = this.pinch;
      if (pinch === null) throw new Error('An active pinch needs a starting camera.');
      return pinchCamera(
        this.width,
        this.height,
        pinch.camera,
        pinch.mid,
        midpoint(a, b),
        distance(a, b) / pinch.distance,
      );
    }
    const pan = this.pan;
    if (pan === null) throw new Error('An active pan needs a starting pointer.');
    const dx = point.x - pan.point.x;
    const dy = point.y - pan.point.y;
    if (!this.active && Math.hypot(dx, dy) < 6) return null;
    this.active = true;
    return cameraFor(
      this.width,
      this.height,
      dragCamera(pan.camera, dx, dy),
      pan.camera.scale,
      pan.camera.fit,
    );
  }

  up(id: PointerId, camera: Camera): boolean {
    if (this.ignored.delete(id)) return true;
    if (!this.points.has(id)) return false;
    const consumed = this.active;
    this.points.delete(id);
    this.pinch = null;
    if (this.points.size === 1) {
      const point = this.points.values().next().value;
      if (point === undefined) throw new Error('A continuing pan needs its remaining pointer.');
      this.pan = { point, camera };
    } else {
      this.active = false;
      this.pan = null;
    }
    return consumed;
  }

  clear(quarantine: boolean = false): boolean {
    const consumed = this.active || this.ignored.size > 0;
    if (quarantine) {
      for (const id of this.points.keys()) this.ignored.add(id);
    } else {
      this.ignored.clear();
    }
    this.points.clear();
    this.active = false;
    this.pan = null;
    this.pinch = null;
    return consumed;
  }
}
