import * as THREE from 'three';
import { BLOCK_LAYOUTS } from '../board-layout';
import {
  BOARD_2D_H,
  BOARD_2D_W,
  CELL_PITCH_2D,
  CELL_SIZE_2D,
  DISTRICT_THEMES_3D,
  ROAD_DEFS_2D,
  STREET_YAW_EAST,
  STREET_YAW_NORTH,
  STREET_YAW_SOUTH,
  STREET_YAW_WEST,
  boardRectToWorld,
  boardToWorld,
  getMissingBlockCells,
  minRoadClearance2D,
  type CityAtmosphereMode,
  type NeighborhoodWorldHandle,
} from './types-3d';

type ShophouseKind = 'roof' | 'flat';

interface ShophouseSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind: ShophouseKind;
}

interface CrossingSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly ux: number;
  readonly uy: number;
  readonly w: number;
}

interface PolylineRoute {
  readonly points: readonly (readonly [number, number])[];
  readonly lengths: readonly number[];
  readonly totalLength: number;
  readonly closed: boolean;
}

interface AnimatedSampan {
  readonly group: THREE.Group;
  readonly baseBx: number;
  readonly baseBy: number;
  readonly travelAmp: number;
  readonly speed: number;
  readonly phase: number;
  readonly oarPivot: THREE.Group;
  readonly wakeMesh: THREE.Mesh;
}

interface AnimatedTree {
  readonly crownGroup: THREE.Group;
  readonly phase: number;
  readonly amp: number;
}

interface AnimatedTrafficLight {
  readonly redMat: THREE.MeshStandardMaterial;
  readonly amberMat: THREE.MeshStandardMaterial;
  readonly greenMat: THREE.MeshStandardMaterial;
  readonly phaseOffset: number;
}

interface AnimatedScooter {
  readonly group: THREE.Group;
  readonly frontWheel: THREE.Object3D;
  readonly rearWheel: THREE.Object3D;
  readonly riderTorso: THREE.Object3D;
  readonly route: PolylineRoute;
  readonly speed: number;
  readonly offsetDist: number;
  readonly laneOffset: number;
}

interface AnimatedBus {
  readonly group: THREE.Group;
  readonly wheels: readonly THREE.Object3D[];
  readonly route: PolylineRoute;
  readonly speed: number;
  readonly stopDist: number;
}

interface AnimatedPedestrian {
  readonly group: THREE.Group;
  readonly bodyPivot: THREE.Group;
  readonly leftArm: THREE.Object3D;
  readonly rightArm: THREE.Object3D;
  readonly leftLeg: THREE.Object3D;
  readonly rightLeg: THREE.Object3D;
  readonly route: PolylineRoute;
  readonly speed: number;
  readonly phaseOffset: number;
  readonly pingPong: boolean;
}

interface FountainDrop {
  readonly mesh: THREE.Mesh;
  readonly angle: number;
  readonly phase: number;
}

const PERIMETER_SHOPHOUSES: readonly ShophouseSpec[] = [
  { x: 56, y: 8, w: 30, h: 17, kind: 'roof' },
  { x: 90, y: 8, w: 26, h: 17, kind: 'flat' },
  { x: 120, y: 8, w: 32, h: 17, kind: 'roof' },
  { x: 156, y: 8, w: 28, h: 17, kind: 'flat' },
  { x: 188, y: 8, w: 32, h: 17, kind: 'roof' },
  { x: 224, y: 8, w: 28, h: 17, kind: 'flat' },
  { x: 256, y: 8, w: 32, h: 17, kind: 'roof' },
  { x: 292, y: 8, w: 28, h: 16, kind: 'flat' },
  { x: 389, y: 8, w: 28, h: 16, kind: 'roof' },
  { x: 421, y: 8, w: 27, h: 16, kind: 'flat' },
  { x: 461, y: 8, w: 27, h: 17, kind: 'roof' },
  { x: 491, y: 8, w: 27, h: 17, kind: 'flat' },
  { x: 521, y: 8, w: 27, h: 17, kind: 'roof' },
  { x: 562, y: 8, w: 30, h: 18, kind: 'flat' },
  { x: 595, y: 8, w: 30, h: 18, kind: 'roof' },
  { x: 712, y: 10, w: 30, h: 18, kind: 'roof' },
  { x: 746, y: 11, w: 28, h: 18, kind: 'flat' },
  { x: 778, y: 12, w: 32, h: 18, kind: 'roof' },
  { x: 814, y: 14, w: 28, h: 18, kind: 'flat' },
  { x: 64, y: 115, w: 17, h: 36, kind: 'flat' },
  { x: 64, y: 155, w: 17, h: 38, kind: 'roof' },
  { x: 62, y: 200, w: 18, h: 32, kind: 'roof' },
  { x: 615, y: 224, w: 28, h: 32, kind: 'roof' },
  { x: 613, y: 262, w: 30, h: 31, kind: 'flat' },
  { x: 972, y: 135, w: 24, h: 29, kind: 'flat' },
  { x: 972, y: 168, w: 24, h: 29, kind: 'roof' },
  { x: 972, y: 211, w: 24, h: 33, kind: 'roof' },
  { x: 972, y: 248, w: 24, h: 33, kind: 'flat' },
  { x: 466, y: 638, w: 44, h: 18, kind: 'flat' },
  { x: 554, y: 626, w: 44, h: 23, kind: 'roof' },
  { x: 613, y: 638, w: 48, h: 18, kind: 'roof' },
  { x: 788, y: 704, w: 58, h: 21, kind: 'roof' },
  { x: 864, y: 703, w: 48, h: 22, kind: 'flat' },
  { x: 924, y: 701, w: 43, h: 23, kind: 'roof' },
  { x: 971, y: 701, w: 43, h: 23, kind: 'flat' },
];

const TREE_SPECS: readonly (readonly [number, number, number])[] = [
  [12, 396, 12],
  [56, 404, 13],
  [62, 479, 10],
  [49, 528, 13],
  [57, 579, 13],
  [45, 638, 13],
  [9, 602, 11],
  [14, 568, 8],
  [8, 509, 10],
  [25, 391, 10],
  [138, 391, 12],
  [164, 376, 11],
  [254, 380, 10],
  [320, 383, 12],
  [344, 408, 10],
  [133, 637, 10],
  [358, 645, 12],
  [691, 618, 11],
  [1018, 628, 8],
  [999, 420, 8],
  [716, 104, 9],
  [718, 170, 9],
  [722, 238, 9],
  [376, 82, 8],
  [64, 247, 7],
  [1042, 133, 7],
  [1045, 227, 7],
  [1022, 466, 7],
  [1020, 551, 7],
  [1018, 594, 7],
];

const PLANTER_SPECS: readonly (readonly [number, number])[] = [
  [310, 295],
  [655, 246],
  [973, 318],
  [434, 386],
  [710, 576],
];

const PARASOL_SPECS: readonly (readonly [number, number])[] = [
  [376, 244],
  [378, 268],
  [656, 272],
  [656, 298],
];

const BENCH_SPECS: readonly (readonly [number, number, number])[] = [
  [201, 413.5, 0],
  [283, 413.5, 0],
  [539, 626.5, 0],
  [996, 414.5, 0.18],
  [69, 547.5, Math.PI / 2],
];

const CROSSING_SPECS: readonly CrossingSpec[] = [
  { id: 'park', x: 110.7, y: 417, ux: 4, uy: 41, w: 23 },
  { id: 'sherwood-south', x: 336.8, y: 305, ux: -13, uy: 88, w: 22 },
  { id: 'market-west', x: 362, y: 331.3, ux: 179, uy: 2, w: 33 },
  { id: 'garden-east', x: 397, y: 374.5, ux: 11, uy: 76, w: 22 },
  { id: 'river-market-north', x: 687.4, y: 318, ux: -10, uy: 88, w: 24 },
  { id: 'grand-market-east', x: 729.4, y: 390, ux: 1, uy: 94, w: 24 },
  { id: 'riverside-north', x: 1041.7, y: 376, ux: 16, uy: 97, w: 19 },
  { id: 'riverside-west', x: 1007, y: 393.8, ux: 140, uy: 31, w: 33 },
  { id: 'south-market', x: 710, y: 687.8, ux: 172, uy: -5, w: 23 },
];

const WALL_PALETTE = [0xf2e4c4, 0xead29e, 0xe3b89a, 0xd4dec7, 0xeddcc4, 0xdcc397] as const;
const AWNING_PALETTE = [0x367b78, 0xcb7054, 0xd9a55a, 0x4f7d58, 0xb8584e, 0x518db1] as const;

function isBrowserDomAvailable(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function createCanvas2D(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!isBrowserDomAvailable()) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  } catch {
    return null;
  }
}

function buildRoute(
  rawPoints: readonly (readonly [number, number])[],
  closed: boolean,
): PolylineRoute {
  const points = closed ? [...rawPoints, rawPoints[0]] : [...rawPoints];
  const lengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const segLen = Math.hypot(dx, dy);
    lengths.push(segLen);
    totalLength += segLen;
  }
  return { points, lengths, totalLength: Math.max(totalLength, 1), closed };
}

function buildFilletedLaneRoute(
  rawCenterPoints: readonly (readonly [number, number])[],
  rightHandLaneOffset: number,
  cornerRadius = 12,
  closed = true,
): PolylineRoute {
  const n = rawCenterPoints.length;
  if (n < 2) return buildRoute(rawCenterPoints, closed);

  const offsetVerts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const curr = rawCenterPoints[i];
    const prev = rawCenterPoints[(i - 1 + n) % n];
    const next = rawCenterPoints[(i + 1) % n];

    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;

    let nPrevX = 0;
    let nPrevY = 0;
    if (hasPrev) {
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      nPrevX = -dy / len;
      nPrevY = dx / len;
    }

    let nNextX = 0;
    let nNextY = 0;
    if (hasNext) {
      const dx = next[0] - curr[0];
      const dy = next[1] - curr[1];
      const len = Math.hypot(dx, dy) || 1;
      nNextX = -dy / len;
      nNextY = dx / len;
    }

    if (!hasPrev) {
      offsetVerts.push([curr[0] + nNextX * rightHandLaneOffset, curr[1] + nNextY * rightHandLaneOffset]);
    } else if (!hasNext) {
      offsetVerts.push([curr[0] + nPrevX * rightHandLaneOffset, curr[1] + nPrevY * rightHandLaneOffset]);
    } else {
      const sumX = nPrevX + nNextX;
      const sumY = nPrevY + nNextY;
      const sumLen = Math.hypot(sumX, sumY);
      if (sumLen < 0.001) {
        offsetVerts.push([curr[0] + nNextX * rightHandLaneOffset, curr[1] + nNextY * rightHandLaneOffset]);
      } else {
        const mx = sumX / sumLen;
        const my = sumY / sumLen;
        const dot = Math.max(0.62, mx * nNextX + my * nNextY);
        const miterScale = Math.min(1.45, 1 / dot);
        offsetVerts.push([
          curr[0] + mx * rightHandLaneOffset * miterScale,
          curr[1] + my * rightHandLaneOffset * miterScale,
        ]);
      }
    }
  }

  const smoothPts: [number, number][] = [];
  const arcSteps = 5;
  for (let i = 0; i < n; i++) {
    const curr = offsetVerts[i];
    if (!closed && (i === 0 || i === n - 1)) {
      smoothPts.push(curr);
      continue;
    }
    const prev = offsetVerts[(i - 1 + n) % n];
    const next = offsetVerts[(i + 1) % n];
    const inDx = prev[0] - curr[0];
    const inDy = prev[1] - curr[1];
    const outDx = next[0] - curr[0];
    const outDy = next[1] - curr[1];
    const inLen = Math.hypot(inDx, inDy);
    const outLen = Math.hypot(outDx, outDy);
    const trim = Math.min(cornerRadius, inLen * 0.36, outLen * 0.36);

    if (trim < 1.2) {
      smoothPts.push(curr);
      continue;
    }

    const pStart: [number, number] = [curr[0] + (inDx / inLen) * trim, curr[1] + (inDy / inLen) * trim];
    const pEnd: [number, number] = [curr[0] + (outDx / outLen) * trim, curr[1] + (outDy / outLen) * trim];
    for (let s = 0; s <= arcSteps; s++) {
      const t = s / arcSteps;
      const omt = 1 - t;
      const bx = omt * omt * pStart[0] + 2 * omt * t * curr[0] + t * t * pEnd[0];
      const by = omt * omt * pStart[1] + 2 * omt * t * curr[1] + t * t * pEnd[1];
      smoothPts.push([bx, by]);
    }
  }

  return buildRoute(smoothPts, closed);
}

function sampleRoutePointRaw(
  route: PolylineRoute,
  distance: number,
  laneOffset = 0,
): { bx: number; by: number; dx: number; dy: number } {
  const total = route.totalLength;
  const wrapped = route.closed
    ? ((distance % total) + total) % total
    : Math.min(total, Math.max(0, distance));
  let acc = 0;
  for (let i = 0; i < route.lengths.length; i++) {
    const segLen = route.lengths[i];
    if (wrapped <= acc + segLen || i === route.lengths.length - 1) {
      const t = segLen > 0 ? Math.min(1, Math.max(0, (wrapped - acc) / segLen)) : 0;
      const p0 = route.points[i];
      const p1 = route.points[i + 1];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.max(segLen, 0.0001);
      const nx = -dy / len;
      const ny = dx / len;
      return {
        bx: p0[0] + dx * t + nx * laneOffset,
        by: p0[1] + dy * t + ny * laneOffset,
        dx: dx / len,
        dy: dy / len,
      };
    }
    acc += segLen;
  }
  return { bx: route.points[0][0], by: route.points[0][1], dx: 0, dy: 1 };
}

function sampleRoute(
  route: PolylineRoute,
  distance: number,
  laneOffset = 0,
): { bx: number; by: number; headingRad: number } {
  const center = sampleRoutePointRaw(route, distance, laneOffset);
  if (!route.closed) {
    return { bx: center.bx, by: center.by, headingRad: Math.atan2(center.dx, center.dy) };
  }
  const behind = sampleRoutePointRaw(route, distance - 2.2, laneOffset);
  const ahead = sampleRoutePointRaw(route, distance + 2.2, laneOffset);
  const tdx = ahead.bx - behind.bx;
  const tdy = ahead.by - behind.by;
  const headingRad =
    Math.hypot(tdx, tdy) > 0.01 ? Math.atan2(tdx, tdy) : Math.atan2(center.dx, center.dy);
  return { bx: center.bx, by: center.by, headingRad };
}

function crossingPoint(c: CrossingSpec, along: number, across: number): [number, number] {
  const len = Math.hypot(c.ux, c.uy) || 1;
  const ux = c.ux / len;
  const uy = c.uy / len;
  return [c.x + ux * along - uy * across, c.y + uy * along + ux * across];
}

function resolveCurbsidePolePosition(
  c: CrossingSpec,
  along: number,
  across: number,
): [number, number] {
  if (c.id === 'riverside-north') {
    return across < 0 ? [1055.5, 354] : [1024, 366];
  }
  const [rawX, rawY] = crossingPoint(c, along, across);
  const rawCheck = minRoadClearance2D(rawX, rawY);
  if (rawCheck.clearance >= 6.5 && rawX >= 8 && rawX <= 1051) {
    return [rawX, rawY];
  }

  let bestX = rawX;
  let bestY = rawY;
  let bestScore = rawCheck.clearance - (rawX > 1051 ? (rawX - 1051) * 4 : 0);

  for (let r = 4; r <= 28; r += 2) {
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const candX = rawX + Math.cos(rad) * r;
      const candY = rawY + Math.sin(rad) * r;
      if (candX < 8 || candX > 1051 || candY < 8 || candY > BOARD_2D_H - 8) continue;
      const check = minRoadClearance2D(candX, candY);
      if (check.clearance >= 6.8) {
        return [candX, candY];
      }
      if (check.clearance > bestScore) {
        bestScore = check.clearance;
        bestX = candX;
        bestY = candY;
      }
    }
  }
  return [bestX, bestY];
}

class MaterialLibrary {
  private readonly stdCache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly basicCache = new Map<string, THREE.MeshBasicMaterial>();

  std(
    color: number,
    roughness = 0.78,
    metalness = 0.05,
    extra?: Partial<THREE.MeshStandardMaterialParameters>,
  ): THREE.MeshStandardMaterial {
    if (!extra) {
      const key = `${color.toString(16)}_${roughness.toFixed(2)}_${metalness.toFixed(2)}`;
      const hit = this.stdCache.get(key);
      if (hit) return hit;
      const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.stdCache.set(key, mat);
      return mat;
    }
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  }

  contactShadow(): THREE.MeshBasicMaterial {
    const key = 'contact_shadow';
    const hit = this.basicCache.get(key);
    if (hit) return hit;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22362d,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.basicCache.set(key, mat);
    return mat;
  }
}

function addShadowDisc(
  parent: THREE.Object3D,
  mats: MaterialLibrary,
  rx: number,
  rz: number,
  y = 0.07,
): THREE.Mesh {
  const geom = new THREE.CircleGeometry(1, 16);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, mats.contactShadow());
  mesh.scale.set(rx, 1, rz);
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function createAxisPyramidGeometry(
  widthX: number,
  heightY: number,
  depthZ: number,
): THREE.BufferGeometry {
  const geom = new THREE.ConeGeometry(Math.SQRT1_2, heightY, 4);
  geom.rotateY(Math.PI / 4);
  geom.scale(widthX, 1, depthZ);
  return geom;
}

function createDistrictPlaqueMaterial(
  code: string,
  title: string,
  accentHex: string,
  bgHex: string,
  mats: MaterialLibrary,
): THREE.MeshStandardMaterial {
  const surface = createCanvas2D(512, 112);
  if (!surface) {
    return mats.std(0x254236, 0.55, 0.15);
  }
  const { canvas, ctx } = surface;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 112);

  ctx.strokeStyle = '#d7b36a';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 502, 102);

  ctx.strokeStyle = 'rgba(243, 233, 199, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 13, 486, 86);

  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.roundRect(24, 24, 82, 64, 10);
  ctx.fill();

  ctx.fillStyle = '#1b3128';
  ctx.font = '800 34px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 65, 57);

  ctx.fillStyle = '#f8f0d8';
  ctx.font = '800 36px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.toUpperCase(), 124, 57);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0.12,
  });
}

function createSignPlaqueMaterial(
  labelText: string,
  bgHex: string,
  fgHex: string,
  borderHex: string,
  mats: MaterialLibrary,
): THREE.MeshStandardMaterial {
  const surface = createCanvas2D(256, 80);
  if (!surface) {
    return mats.std(new THREE.Color(bgHex).getHex(), 0.5, 0.2);
  }
  const { canvas, ctx } = surface;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 72);
  ctx.fillStyle = fgHex;
  ctx.font = '900 38px Georgia, ui-serif, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, 128, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.4,
    metalness: 0.22,
  });
}

function createStreetStencilMaterial(
  labelText: string,
  fgHex: string,
  outlineHex: string,
): THREE.MeshBasicMaterial {
  const surface = createCanvas2D(512, 64);
  if (!surface) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(fgHex).getHex(),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
  }
  const { canvas, ctx } = surface;
  ctx.clearRect(0, 0, 512, 64);
  ctx.font = '800 30px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = outlineHex;
  ctx.strokeText(labelText, 256, 33);
  ctx.fillStyle = fgHex;
  ctx.fillText(labelText, 256, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

function createCrispNeighborhoodGroundTexture(): THREE.CanvasTexture | null {
  const scale = 3;
  const surface = createCanvas2D(BOARD_2D_W * scale, BOARD_2D_H * scale);
  if (!surface) return null;
  const { canvas, ctx } = surface;

  ctx.save();
  ctx.scale(scale, scale);

  const fillPoly = (pts: readonly (readonly [number, number])[], fill: string): void => {
    if (pts.length < 3) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  };

  const strokePolyline = (
    pts: readonly (readonly [number, number])[],
    stroke: string,
    width: number,
    dash?: readonly number[],
  ): void => {
    if (pts.length < 2) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = dash ? 'butt' : 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ? [...dash] : []);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };

  // 1. Warm city earth base + subtle tactile stone grain
  ctx.fillStyle = '#979a7a';
  ctx.fillRect(0, 0, BOARD_2D_W, BOARD_2D_H);
  for (let y = 0; y < BOARD_2D_H - 2; y += 6) {
    for (let x = 0; x < BOARD_2D_W - 2; x += 6) {
      const z = (x * 17 + y * 23) % 73;
      if (z < 9) {
        ctx.fillStyle = '#9aa088';
        ctx.fillRect(x, y, 2, 2);
      } else if (z > 68) {
        ctx.fillStyle = '#aba689';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // 2. River bank & promenade coping (3D water & animated sampans sit above this)
  fillPoly(
    [
      [1081, -5],
      [1066, 88],
      [1086, 192],
      [1073, 303],
      [1089, 407],
      [1070, 516],
      [1083, 606],
      [1062, 734],
      [1101, 734],
      [1101, -5],
    ],
    '#3b6c69',
  );
  fillPoly(
    [
      [1093, -5],
      [1078, 88],
      [1098, 192],
      [1085, 303],
      [1101, 407],
      [1082, 516],
      [1095, 606],
      [1074, 734],
      [1101, 734],
      [1101, -5],
    ],
    '#527f79',
  );
  const riverEdgePts: readonly (readonly [number, number])[] = [
    [1079, 0],
    [1064, 88],
    [1084, 192],
    [1071, 303],
    [1087, 407],
    [1068, 516],
    [1081, 606],
    [1060, 730],
  ];
  strokePolyline(riverEdgePts, '#e6d9af', 8);
  strokePolyline(riverEdgePts, '#344d48', 1.8);

  // 3. Irregular district blocks and broad stone sidewalks
  const sidewalkBlocks: readonly (readonly (readonly [number, number])[])[] = [
    [
      [56, 65],
      [322, 66],
      [329, 219],
      [310, 302],
      [93, 310],
      [70, 276],
    ],
    [
      [374, 60],
      [650, 67],
      [662, 206],
      [645, 300],
      [450, 312],
      [370, 300],
      [367, 178],
    ],
    [
      [708, 81],
      [998, 86],
      [1007, 273],
      [1018, 343],
      [882, 347],
      [721, 321],
      [715, 236],
    ],
    [
      [131, 395],
      [365, 382],
      [377, 445],
      [387, 612],
      [346, 660],
      [173, 655],
      [123, 616],
      [123, 490],
    ],
    [
      [433, 374],
      [702, 382],
      [709, 556],
      [696, 643],
      [465, 668],
      [433, 609],
      [434, 482],
    ],
    [
      [757, 399],
      [1017, 426],
      [1023, 591],
      [1014, 658],
      [796, 660],
      [770, 626],
      [756, 513],
    ],
  ];

  for (const poly of sidewalkBlocks) {
    fillPoly(poly, '#807b5e');
    let cx = 0;
    let cy = 0;
    for (const [px, py] of poly) {
      cx += px;
      cy += py;
    }
    cx /= poly.length;
    cy /= poly.length;
    const inner = poly.map(([px, py]) => [px + (cx - px) * 0.025, py + (cy - py) * 0.025] as const);
    fillPoly(inner, '#c9c2a0');
  }

  ctx.strokeStyle = '#aba689';
  ctx.lineWidth = 1;
  for (let y = 12; y <= BOARD_2D_H; y += 18) {
    for (let x = 12; x <= 1047; x += 34) {
      if ((x * 3 + y * 7) % 13 < 3) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10, y);
        ctx.stroke();
      }
    }
  }

  // 4. Curved western pocket park & triangular public garden
  fillPoly(
    [
      [0, 385],
      [38, 371],
      [73, 390],
      [82, 434],
      [65, 490],
      [65, 565],
      [74, 623],
      [58, 658],
      [5, 660],
      [0, 613],
    ],
    '#807b5e',
  );
  fillPoly(
    [
      [0, 392],
      [34, 381],
      [62, 397],
      [71, 432],
      [54, 490],
      [54, 568],
      [63, 622],
      [52, 647],
      [5, 649],
      [0, 611],
    ],
    '#456f51',
  );
  fillPoly(
    [
      [4, 406],
      [28, 394],
      [50, 405],
      [55, 436],
      [38, 493],
      [40, 566],
      [47, 615],
      [39, 630],
      [6, 627],
    ],
    '#668856',
  );
  const parkPath: readonly (readonly [number, number])[] = [
    [4, 418],
    [26, 421],
    [37, 441],
    [22, 489],
    [22, 549],
    [31, 588],
    [20, 627],
    [4, 637],
  ];
  strokePolyline(parkPath, '#aba689', 15);
  strokePolyline(parkPath, '#dbbd80', 10);

  fillPoly(
    [
      [129, 378],
      [207, 366],
      [303, 368],
      [359, 387],
      [342, 421],
      [235, 431],
      [138, 414],
    ],
    '#456f51',
  );
  fillPoly(
    [
      [139, 383],
      [209, 377],
      [301, 379],
      [341, 390],
      [330, 408],
      [233, 420],
      [145, 406],
    ],
    '#668856',
  );
  strokePolyline(
    [
      [153, 397],
      [222, 397],
      [272, 391],
      [315, 397],
    ],
    '#dbbd80',
    11,
  );

  // 5. Joined vector streets with anti-aliased stone kerbs & center lane dashes
  for (const r of ROAD_DEFS_2D) strokePolyline(r.points, '#7e7a63', r.width + 17);
  for (const r of ROAD_DEFS_2D) strokePolyline(r.points, '#e6d9af', r.width + 12);
  for (const r of ROAD_DEFS_2D) strokePolyline(r.points, '#304a43', r.width + 3);
  for (const r of ROAD_DEFS_2D) strokePolyline(r.points, '#405951', r.width);
  for (const r of ROAD_DEFS_2D) strokePolyline(r.points, '#c1bc8d', 2.0, [12, 16]);

  // Clear center lane dashes cleanly inside road junctions
  const junctions: readonly (readonly [number, number, number])[] = [
    [30, 45, 11],
    [355, 40, 11],
    [680, 45, 12],
    [1024, 65, 10],
    [90, 352, 13],
    [333, 331, 14],
    [391, 333, 14],
    [684, 348, 15],
    [729, 353, 14],
    [1046, 402, 12],
    [432, 699, 11],
    [750, 686, 12],
    [1039, 676, 10],
  ];
  ctx.fillStyle = '#405951';
  for (const [jx, jy, jr] of junctions) {
    ctx.beginPath();
    ctx.arc(jx, jy, jr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Crisp vector zebra crossings & stop bars (zero baked 2D drains, cars, trees, or poles)
  const fillCrossQuad = (
    c: CrossingSpec,
    a0: number,
    a1: number,
    n0: number,
    n1: number,
    color: string,
  ): void => {
    fillPoly(
      [
        crossingPoint(c, a0, n0),
        crossingPoint(c, a1, n0),
        crossingPoint(c, a1, n1),
        crossingPoint(c, a0, n1),
      ],
      color,
    );
  };

  for (const c of CROSSING_SPECS) {
    fillCrossQuad(c, -13, 13, -c.w / 2 + 1.2, c.w / 2 - 1.2, '#405951');
    const count = Math.floor((c.w - 2) / 5);
    const total = count * 3 + (count - 1) * 2;
    for (let i = 0; i < count; i++) {
      const n = -total / 2 + i * 5;
      fillCrossQuad(c, -8, 8, n, n + 3, '#eadfb7');
    }
    fillCrossQuad(c, -15, -13, 1, c.w / 2 - 2, '#c1bc8d');
    fillCrossQuad(c, 13, 15, -c.w / 2 + 2, -1, '#c1bc8d');
  }

  // Bus stop paved sidewalk apron in front of shelter (873, 414)
  ctx.fillStyle = '#7e7a63';
  ctx.fillRect(862, 402, 60, 15);
  ctx.fillStyle = '#e6d9af';
  ctx.fillRect(864, 404, 56, 12);

  // 7. Stepped district plot foundations
  for (const block of BLOCK_LAYOUTS) {
    const cells: [number, number][] = [];
    for (let r = 0; r < block.rows.length; r++) {
      for (const c of block.rows[r]) {
        cells.push([block.x + c * CELL_PITCH_2D, block.y + r * CELL_PITCH_2D]);
      }
    }
    ctx.fillStyle = '#807b5e';
    for (const [cx, cy] of cells) ctx.fillRect(cx - 5, cy - 3, 61, 61);
    ctx.fillStyle = '#7e7a63';
    for (const [cx, cy] of cells) ctx.fillRect(cx - 4, cy - 4, 60, 60);
    ctx.fillStyle = '#e6d9af';
    for (const [cx, cy] of cells) ctx.fillRect(cx - 2, cy - 2, 56, 56);
    ctx.fillStyle = '#c9c2a0';
    for (const [cx, cy] of cells) ctx.fillRect(cx, cy, 52, 52);
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function buildTabletopAndGround(root: THREE.Group, mats: MaterialLibrary): void {
  const frameGroup = new THREE.Group();
  frameGroup.name = 'tabletop-frame-and-ground';

  const outerFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1148, 22, 778),
    mats.std(0x4a3525, 0.62, 0.08),
  );
  outerFrame.position.set(0, -11.5, 0);
  outerFrame.receiveShadow = true;
  frameGroup.add(outerFrame);

  const lowerMolding = new THREE.Mesh(
    new THREE.BoxGeometry(1158, 5, 788),
    mats.std(0x382619, 0.68, 0.08),
  );
  lowerMolding.position.set(0, -20.5, 0);
  frameGroup.add(lowerMolding);

  const brassMat = mats.std(0xc8a25a, 0.3, 0.76);
  const railNorth = new THREE.Mesh(new THREE.BoxGeometry(1124, 4, 12), brassMat);
  railNorth.position.set(0, -1.5, -(BOARD_2D_H / 2 + 6));
  const railSouth = new THREE.Mesh(new THREE.BoxGeometry(1124, 4, 12), brassMat);
  railSouth.position.set(0, -1.5, BOARD_2D_H / 2 + 6);
  const railWest = new THREE.Mesh(new THREE.BoxGeometry(12, 4, BOARD_2D_H), brassMat);
  railWest.position.set(-(BOARD_2D_W / 2 + 6), -1.5, 0);
  const railEast = new THREE.Mesh(new THREE.BoxGeometry(12, 4, BOARD_2D_H), brassMat);
  railEast.position.set(BOARD_2D_W / 2 + 6, -1.5, 0);
  frameGroup.add(railNorth, railSouth, railWest, railEast);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerCap = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 22), brassMat);
      cornerCap.position.set(sx * 565, -2.2, sz * 380);
      frameGroup.add(cornerCap);
    }
  }

  const innerBase = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_2D_W, 16, BOARD_2D_H),
    mats.std(0x8f9474, 0.88, 0.02),
  );
  innerBase.position.set(0, -8.05, 0);
  innerBase.receiveShadow = true;
  frameGroup.add(innerBase);

  const crispGroundTex = createCrispNeighborhoodGroundTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: crispGroundTex ? 0xffffff : 0xb5b192,
    map: crispGroundTex,
    roughness: 0.88,
    metalness: 0.02,
  });

  const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_2D_W, BOARD_2D_H), groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(0, 0, 0);
  groundPlane.receiveShadow = true;
  frameGroup.add(groundPlane);

  const curbOuterMat = mats.std(0xa7a184, 0.86, 0.03);
  const curbTopMat = mats.std(0xd4ccb0, 0.82, 0.03);
  const cellLipMat = mats.std(0xe3dac0, 0.8, 0.03);

  for (let bIdx = 0; bIdx < BLOCK_LAYOUTS.length; bIdx++) {
    const block = BLOCK_LAYOUTS[bIdx];
    const taken = new Set<string>();
    for (let row = 0; row < block.rows.length; row++) {
      for (const col of block.rows[row]) {
        taken.add(`${col},${row}`);
      }
    }

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = block.x + col * CELL_PITCH_2D;
        const cy = block.y + row * CELL_PITCH_2D;
        const isPlayable = taken.has(`${col},${row}`);

        if (isPlayable) {
          const kerbApron = new THREE.Mesh(
            new THREE.BoxGeometry(CELL_PITCH_2D + 6, 0.42, CELL_PITCH_2D + 6),
            curbOuterMat,
          );
          kerbApron.position.set(
            ...boardRectToWorld(cx - 5, cy - 5, CELL_PITCH_2D + 6, CELL_PITCH_2D + 6, 0.21),
          );
          kerbApron.receiveShadow = true;
          frameGroup.add(kerbApron);

          const cellCurbSlab = new THREE.Mesh(
            new THREE.BoxGeometry(CELL_PITCH_2D + 2, 0.76, CELL_PITCH_2D + 2),
            curbTopMat,
          );
          cellCurbSlab.position.set(
            ...boardRectToWorld(cx - 3, cy - 3, CELL_PITCH_2D + 2, CELL_PITCH_2D + 2, 0.38),
          );
          cellCurbSlab.receiveShadow = true;
          cellCurbSlab.castShadow = true;
          frameGroup.add(cellCurbSlab);
        }

        const paver = new THREE.Mesh(
          new THREE.BoxGeometry(CELL_SIZE_2D + 0.8, 0.8, CELL_SIZE_2D + 0.8),
          cellLipMat,
        );
        paver.position.set(
          ...boardRectToWorld(cx - 0.4, cy - 0.4, CELL_SIZE_2D + 0.8, CELL_SIZE_2D + 0.8, 0.4),
        );
        paver.receiveShadow = true;
        frameGroup.add(paver);
      }
    }
  }

  root.add(frameGroup);
}

function buildRiverPierAndSampans(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  sampans: AnimatedSampan[];
  foamRipples: THREE.Mesh[];
  pierLantern: THREE.Object3D;
} {
  const riverGroup = new THREE.Group();
  riverGroup.name = 'robinhood-river-and-pier';

  const seawall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.95, BOARD_2D_H),
    mats.std(0xc8c0a0, 0.82, 0.04),
  );
  seawall.position.set(...boardRectToWorld(1053, 0, 5, BOARD_2D_H, 0.475));
  seawall.receiveShadow = true;
  seawall.castShadow = true;
  riverGroup.add(seawall);

  for (let by = 111; by <= 233; by += 24) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.8, 3.4, 8),
      mats.std(0x525d56, 0.65, 0.25),
    );
    bollard.position.set(...boardToWorld(1052, by, 1.7));
    bollard.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.7, 8),
      mats.std(0xeadfb7, 0.6, 0.1),
    );
    cap.position.y = 1.8;
    bollard.add(cap);
    riverGroup.add(bollard);
  }

  const waterW = 44;
  const waterMat = mats.std(0x4f8782, 0.18, 0.12, {
    transparent: true,
    opacity: 0.86,
  });
  const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(waterW, 0.35, BOARD_2D_H), waterMat);
  waterMesh.position.set(...boardRectToWorld(1056, 0, waterW, BOARD_2D_H, 0.18));
  waterMesh.receiveShadow = true;
  riverGroup.add(waterMesh);

  const foamRipples: THREE.Mesh[] = [];
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xb7ded4,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  for (let i = 0; i < 16; i++) {
    const by = 24 + i * 44;
    const bx = 1064 + ((i * 11) % 24);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 16), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(...boardToWorld(bx, by, 0.39));
    foam.userData.baseZ = foam.position.z;
    riverGroup.add(foam);
    foamRipples.push(foam);
  }

  const pierGroup = new THREE.Group();
  pierGroup.position.set(...boardRectToWorld(1054, 264, 38, 22, 1.2));
  riverGroup.add(pierGroup);

  const beamMat = mats.std(0x694d36, 0.82, 0.05);
  const plankMat = mats.std(0x9b7954, 0.78, 0.05);
  const plankAltMat = mats.std(0xaf8b62, 0.78, 0.05);

  for (const sz of [-8.5, 8.5]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(38, 1.1, 1.8), beamMat);
    stringer.position.set(0, 0.2, sz);
    stringer.castShadow = true;
    pierGroup.add(stringer);
  }

  for (let p = 0; p < 10; p++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.65, 22),
      p % 2 === 0 ? plankMat : plankAltMat,
    );
    plank.position.set(-16.5 + p * 3.65, 0.9, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }

  for (const px of [-15, 0, 15]) {
    for (const pz of [-9, 9]) {
      const piling = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.0, 3.8, 8),
        mats.std(0x4f3928, 0.85, 0.05),
      );
      piling.position.set(px, 0.3, pz);
      piling.castShadow = true;
      pierGroup.add(piling);
    }
  }

  const ropeMat = mats.std(0xd8c394, 0.88, 0.02);
  for (const bz of [-8.5, 8.5]) {
    const mooringPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.1, 2.4, 8),
      mats.std(0x3a322c, 0.6, 0.3),
    );
    mooringPost.position.set(16.2, 2.1, bz);
    pierGroup.add(mooringPost);

    const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.36, 6, 12), ropeMat);
    ropeCoil.rotation.x = Math.PI / 2;
    ropeCoil.position.set(16.2, 1.5, bz);
    pierGroup.add(ropeCoil);
  }

  const crate = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.6, 4.2), mats.std(0xb68656, 0.8, 0.04));
  crate.position.set(-8, 2.9, -5.2);
  crate.castShadow = true;
  pierGroup.add(crate);

  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9.5, 8), beamMat);
  lanternPost.position.set(16.8, 5.8, -8.5);
  lanternPost.castShadow = true;
  pierGroup.add(lanternPost);

  const lanternArm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.45), beamMat);
  lanternArm.position.set(17.9, 10.3, -8.5);
  pierGroup.add(lanternArm);

  const pierLantern = new THREE.Group();
  pierLantern.position.set(19.2, 10.1, -8.5);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), beamMat);
  cord.position.y = -0.7;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 10, 8),
    mats.std(0xe86146, 0.35, 0.08, {
      emissive: new THREE.Color(0xff9d3b),
      emissiveIntensity: 0.85,
    }),
  );
  globe.position.y = -2.0;
  pierLantern.add(cord, globe);
  pierGroup.add(pierLantern);

  const sampanSpecs = [
    { by: 140, amp: 42, speed: 0.34, phase: 0.2, canopyHex: 0xd9bc82, shirtHex: 0x397a78 },
    { by: 390, amp: 46, speed: 0.29, phase: 2.1, canopyHex: 0xcfa96e, shirtHex: 0xc96450 },
    { by: 590, amp: 48, speed: 0.32, phase: 4.0, canopyHex: 0xe2c892, shirtHex: 0x4b6e8c },
  ];

  const sampans: AnimatedSampan[] = [];
  for (const s of sampanSpecs) {
    const boat = new THREE.Group();
    const [wx, wy, wz] = boardToWorld(1074, s.by, 0.55);
    boat.position.set(wx, wy, wz);

    const wakeMesh = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 5.2, 12),
      new THREE.MeshBasicMaterial({
        color: 0xcbeae2,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    wakeMesh.rotation.x = -Math.PI / 2;
    wakeMesh.scale.set(0.65, 1.9, 1);
    wakeMesh.position.y = -0.14;
    boat.add(wakeMesh);

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 2.0, 18.0),
      mats.std(0x785236, 0.78, 0.06),
    );
    hull.position.y = 0.85;
    hull.castShadow = true;
    boat.add(hull);

    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 5.8, 4),
      mats.std(0x634129, 0.8, 0.05),
    );
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.scale.set(1, 1, 0.58);
    bow.position.set(0, 1.25, -11.4);
    bow.castShadow = true;
    boat.add(bow);

    const stern = bow.clone();
    stern.rotation.x = Math.PI / 2;
    stern.position.set(0, 1.25, 11.4);
    boat.add(stern);

    const gunwale = new THREE.Mesh(
      new THREE.BoxGeometry(7.3, 0.45, 17.6),
      mats.std(0xd9a55a, 0.7, 0.08),
    );
    gunwale.position.y = 1.92;
    boat.add(gunwale);

    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(3.3, 3.5, 8.6, 10, 1, false, 0, Math.PI),
      mats.std(s.canopyHex, 0.85, 0.02),
    );
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = Math.PI / 2;
    canopy.position.set(0, 2.0, -0.8);
    canopy.castShadow = true;
    boat.add(canopy);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.1, 2.8),
      mats.std(0xb98552, 0.8, 0.04),
    );
    cargoBox.position.set(-1.1, 2.5, -6.2);
    boat.add(cargoBox);

    const jar = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 8, 8),
      mats.std(0xb65d43, 0.55, 0.1),
    );
    jar.position.set(1.4, 2.4, -5.8);
    boat.add(jar);

    const rower = new THREE.Group();
    rower.position.set(0, 2.0, 6.6);
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.1, 2.8, 8),
      mats.std(s.shirtHex, 0.78, 0.04),
    );
    torso.position.y = 1.4;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 8),
      mats.std(0xf0c29c, 0.72, 0.02),
    );
    head.position.y = 3.3;
    const conicalHat = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 1.2, 10),
      mats.std(0xe8d5a0, 0.82, 0.02),
    );
    conicalHat.position.y = 4.0;
    rower.add(torso, head, conicalHat);
    boat.add(rower);

    const oarPivot = new THREE.Group();
    oarPivot.position.set(2.2, 2.5, 6.8);
    const oarBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 10.5),
      mats.std(0x6e4e35, 0.8, 0.04),
    );
    oarBlade.position.set(1.2, -0.9, 3.8);
    oarBlade.rotation.x = 0.28;
    oarBlade.rotation.y = 0.25;
    oarPivot.add(oarBlade);
    boat.add(oarPivot);

    riverGroup.add(boat);
    sampans.push({
      group: boat,
      baseBx: 1074,
      baseBy: s.by,
      travelAmp: s.amp,
      speed: s.speed,
      phase: s.phase,
      oarPivot,
      wakeMesh,
    });
  }

  root.add(riverGroup);
  return { sampans, foamRipples, pierLantern };
}

function buildParkPondAndFountain(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  pondRipple: THREE.Mesh;
  fountainDrops: FountainDrop[];
  fountainFoam: THREE.Mesh;
} {
  const waterFeatureGroup = new THREE.Group();
  waterFeatureGroup.name = 'park-pond-and-garden-fountain';

  const pondGroup = new THREE.Group();
  pondGroup.position.set(...boardToWorld(31, 462, 0.25));
  waterFeatureGroup.add(pondGroup);

  const pondRim = new THREE.Mesh(
    new THREE.TorusGeometry(15.5, 2.2, 8, 24),
    mats.std(0xbab496, 0.85, 0.04),
  );
  pondRim.rotation.x = Math.PI / 2;
  pondRim.scale.set(0.86, 1.24, 0.85);
  pondRim.position.y = 0.55;
  pondRim.castShadow = true;
  pondRim.receiveShadow = true;
  pondGroup.add(pondRim);

  const pondBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(14.8, 14.0, 0.7, 24),
    mats.std(0x45807b, 0.16, 0.14, { transparent: true, opacity: 0.9 }),
  );
  pondBasin.scale.set(0.85, 1, 1.22);
  pondBasin.position.y = 0.35;
  pondGroup.add(pondBasin);

  const pondRipple = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 20),
    new THREE.MeshBasicMaterial({
      color: 0xbdebe3,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  pondRipple.rotation.x = -Math.PI / 2;
  pondRipple.position.set(-1.5, 0.74, -2.0);
  pondGroup.add(pondRipple);

  const lilyOffsets: readonly [number, number, number, boolean][] = [
    [-4.2, -5.5, 2.3, true],
    [3.8, 4.2, 2.5, true],
    [-2.5, 7.6, 2.0, false],
    [5.2, -3.4, 1.9, false],
    [0.5, 1.2, 2.2, false],
  ];
  for (const [lx, lz, lr, hasLotus] of lilyOffsets) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(lr, lr, 0.18, 12, 1, false, 0.25, Math.PI * 1.82),
      mats.std(0x5d9456, 0.72, 0.04),
    );
    pad.position.set(lx, 0.76, lz);
    pondGroup.add(pad);
    if (hasLotus) {
      const lotus = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 1.15, 7),
        mats.std(0xf28ca8, 0.55, 0.04),
      );
      lotus.position.set(lx, 1.3, lz);
      pondGroup.add(lotus);
    }
  }

  const reedClusters: readonly [number, number][] = [
    [-9.5, -9.0],
    [9.2, 8.8],
    [-8.4, 10.5],
  ];
  for (const [rx, rz] of reedClusters) {
    for (let k = 0; k < 3; k++) {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 5.2 + k * 0.8, 6),
        mats.std(0x4b7746, 0.8, 0.02),
      );
      stalk.position.set(rx + (k - 1) * 0.9, 2.6, rz + (k % 2) * 0.8);
      stalk.rotation.z = (k - 1) * 0.08;
      const tip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.3, 6),
        mats.std(0x6e4930, 0.88, 0.02),
      );
      tip.position.y = 2.2;
      stalk.add(tip);
      pondGroup.add(stalk);
    }
  }

  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(...boardToWorld(216, 397, 0.25));
  waterFeatureGroup.add(fountainGroup);

  addShadowDisc(fountainGroup, mats, 17.5, 17.5, 0.05);

  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(15.6, 16.4, 2.6, 16),
    mats.std(0xe3d7b3, 0.78, 0.04),
  );
  outerWall.position.y = 1.3;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  fountainGroup.add(outerWall);

  const rimCoping = new THREE.Mesh(
    new THREE.TorusGeometry(15.2, 1.35, 8, 20),
    mats.std(0xf0e6c8, 0.72, 0.05),
  );
  rimCoping.rotation.x = Math.PI / 2;
  rimCoping.position.y = 2.6;
  fountainGroup.add(rimCoping);

  const lowerWater = new THREE.Mesh(
    new THREE.CylinderGeometry(14.1, 14.1, 0.5, 20),
    mats.std(0x4bb0b5, 0.14, 0.12, { transparent: true, opacity: 0.9 }),
  );
  lowerWater.position.y = 2.15;
  fountainGroup.add(lowerWater);

  const lowerPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.4, 5.2, 12),
    mats.std(0xd8ccb0, 0.76, 0.05),
  );
  lowerPedestal.position.y = 4.4;
  lowerPedestal.castShadow = true;
  fountainGroup.add(lowerPedestal);

  const midBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(7.6, 4.2, 2.0, 14),
    mats.std(0xeae0c2, 0.74, 0.05),
  );
  midBowl.position.y = 7.2;
  midBowl.castShadow = true;
  fountainGroup.add(midBowl);

  const midWater = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 6.8, 0.35, 14),
    mats.std(0x63cad0, 0.14, 0.12),
  );
  midWater.position.y = 8.1;
  fountainGroup.add(midWater);

  const upperSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 2.2, 4.2, 10),
    mats.std(0xeae0c2, 0.74, 0.05),
  );
  upperSpire.position.y = 9.9;
  upperSpire.castShadow = true;
  fountainGroup.add(upperSpire);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 10, 8),
    mats.std(0xc8a25a, 0.35, 0.65),
  );
  finial.position.y = 12.3;
  fountainGroup.add(finial);

  const fountainFoam = new THREE.Mesh(
    new THREE.RingGeometry(6.2, 8.2, 20),
    new THREE.MeshBasicMaterial({
      color: 0xd9fbfd,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fountainFoam.rotation.x = -Math.PI / 2;
  fountainFoam.position.y = 2.45;
  fountainGroup.add(fountainFoam);

  const dropGeom = new THREE.SphereGeometry(0.68, 6, 6);
  const dropMat = mats.std(0xd8fcff, 0.12, 0.05, {
    emissive: new THREE.Color(0x7be3ea),
    emissiveIntensity: 0.35,
  });
  const fountainDrops: FountainDrop[] = [];
  for (let i = 0; i < 12; i++) {
    const drop = new THREE.Mesh(dropGeom, dropMat);
    fountainGroup.add(drop);
    fountainDrops.push({
      mesh: drop,
      angle: (i / 12) * Math.PI * 2,
      phase: i / 12,
    });
  }

  root.add(waterFeatureGroup);
  return { pondRipple, fountainDrops, fountainFoam };
}

function buildPerimeterShophouses(root: THREE.Group, mats: MaterialLibrary): void {
  const housesGroup = new THREE.Group();
  housesGroup.name = 'perimeter-shophouses';

  const windowFrameMat = mats.std(0x284e4b, 0.62, 0.12);
  const glassMat = mats.std(0x528884, 0.25, 0.25);
  const shutterMat = mats.std(0x367b78, 0.72, 0.06);
  const corniceMat = mats.std(0xdfd6ba, 0.78, 0.04);
  const clayRoofMat = mats.std(0xb8734b, 0.76, 0.05);
  const clayRoofAltMat = mats.std(0xa35f3c, 0.78, 0.05);
  const ridgeMat = mats.std(0xeadcc0, 0.75, 0.04);
  const tankMat = mats.std(0x96aba6, 0.38, 0.55);

  for (let i = 0; i < PERIMETER_SHOPHOUSES.length; i++) {
    const spec = PERIMETER_SHOPHOUSES[i];
    const house = new THREE.Group();
    house.position.set(...boardRectToWorld(spec.x, spec.y, spec.w, spec.h, 0));

    const wallH = 18 + ((i * 5) % 11);
    const wallHex = WALL_PALETTE[i % WALL_PALETTE.length];
    const awningHex = AWNING_PALETTE[(i * 3) % AWNING_PALETTE.length];
    const cx = spec.x + spec.w / 2;
    const cy = spec.y + spec.h / 2;
    const nearestRoad = minRoadClearance2D(cx, cy);
    const rdx = nearestRoad.nearestRoadX - cx;
    const rdy = nearestRoad.nearestRoadY - cy;
    const streetYaw =
      Math.abs(rdx) > Math.abs(rdy)
        ? rdx < 0
          ? STREET_YAW_WEST
          : STREET_YAW_EAST
        : rdy < 0
          ? STREET_YAW_NORTH
          : STREET_YAW_SOUTH;
    const isEastWestFacing = streetYaw === STREET_YAW_WEST || streetYaw === STREET_YAW_EAST;
    const frontWidth = isEastWestFacing ? spec.h : spec.w;
    const frontHalfDepth = (isEastWestFacing ? spec.w : spec.h) / 2;

    const shadowPad = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.w + 4, spec.h + 4),
      mats.contactShadow(),
    );
    shadowPad.rotation.x = -Math.PI / 2;
    shadowPad.position.set(1.2, 0.06, 1.4);
    house.add(shadowPad);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 1.2, 1.4, spec.h + 1.2),
      mats.std(0x8e8970, 0.86, 0.03),
    );
    plinth.position.y = 0.7;
    plinth.receiveShadow = true;
    house.add(plinth);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w, wallH, spec.h),
      mats.std(wallHex, 0.8, 0.03),
    );
    body.position.y = 1.4 + wallH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    const beltBand = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 0.8, 0.9, spec.h + 0.8),
      corniceMat,
    );
    beltBand.position.y = 1.4 + wallH * 0.48;
    house.add(beltBand);

    const facadeGroup = new THREE.Group();
    facadeGroup.rotation.y = streetYaw;
    house.add(facadeGroup);

    const shopDoor = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(6.4, frontWidth * 0.34), 5.4, 0.7),
      windowFrameMat,
    );
    shopDoor.position.set(0, 4.1, frontHalfDepth + 0.12);
    facadeGroup.add(shopDoor);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(frontWidth * 0.86, 0.9, 4.0),
      mats.std(awningHex, 0.72, 0.05),
    );
    awning.position.set(0, 7.6, frontHalfDepth + 1.5);
    awning.rotation.x = 0.26;
    awning.castShadow = true;
    facadeGroup.add(awning);

    const winCount = Math.max(1, Math.min(3, Math.floor(frontWidth / 11)));
    const spacing = frontWidth / (winCount + 1);
    const makeShutteredWindow = (): THREE.Mesh => {
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.2, 0.8), windowFrameMat);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(3.0, 4.0, 0.95), glassMat);
      winFrame.add(pane);
      const leftShutter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.8, 0.5), shutterMat);
      leftShutter.position.set(-2.5, 0, 0.2);
      const rightShutter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.8, 0.5), shutterMat);
      rightShutter.position.set(2.5, 0, 0.2);
      winFrame.add(leftShutter, rightShutter);
      return winFrame;
    };

    for (let wIdx = 0; wIdx < winCount; wIdx++) {
      const wx = -frontWidth / 2 + spacing * (wIdx + 1);
      const frontWin = makeShutteredWindow();
      frontWin.position.set(wx, 1.4 + wallH * 0.72, frontHalfDepth + 0.15);
      facadeGroup.add(frontWin);

      // Matching rear upper shuttered windows so rear-viewed perimeter houses never look blank
      const rearUpperWin = makeShutteredWindow();
      rearUpperWin.rotation.y = Math.PI;
      rearUpperWin.position.set(wx, 1.4 + wallH * 0.72, -frontHalfDepth - 0.15);
      facadeGroup.add(rearUpperWin);
    }

    const rearServiceDoor = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(5.0, frontWidth * 0.28), 4.8, 0.7),
      windowFrameMat,
    );
    rearServiceDoor.position.set(0, 3.8, -frontHalfDepth - 0.12);
    facadeGroup.add(rearServiceDoor);

    if (frontWidth >= 22) {
      for (const rx of [-frontWidth * 0.3, frontWidth * 0.3]) {
        const rearGroundWin = makeShutteredWindow();
        rearGroundWin.scale.set(0.82, 0.82, 1);
        rearGroundWin.rotation.y = Math.PI;
        rearGroundWin.position.set(rx, 5.0, -frontHalfDepth - 0.15);
        facadeGroup.add(rearGroundWin);
      }
    }

    const sideWidth = frontHalfDepth * 2;
    const sideHalfDepth = frontWidth / 2;
    if (sideWidth >= 18) {
      for (const sideSign of [-1, 1] as const) {
        const sideWin = makeShutteredWindow();
        sideWin.scale.set(0.86, 0.88, 1);
        sideWin.rotation.y = sideSign * (Math.PI / 2);
        sideWin.position.set(sideSign * (sideHalfDepth + 0.15), 1.4 + wallH * 0.72, 0);
        facadeGroup.add(sideWin);
      }
    }

    const topY = 1.4 + wallH;
    if (spec.kind === 'roof') {
      const eave = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w + 2.6, 1.0, spec.h + 2.6),
        mats.std(0x6e4b35, 0.82, 0.04),
      );
      eave.position.y = topY + 0.5;
      house.add(eave);

      const roofH = Math.min(7.5, Math.max(4.6, Math.min(spec.w, spec.h) * 0.34));
      const hipRoof = new THREE.Mesh(
        createAxisPyramidGeometry(spec.w + 3.2, roofH, spec.h + 3.2),
        i % 2 === 0 ? clayRoofMat : clayRoofAltMat,
      );
      hipRoof.position.y = topY + 1.0 + roofH / 2;
      hipRoof.castShadow = true;
      house.add(hipRoof);

      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(
          spec.w >= spec.h ? spec.w * 0.46 : 1.6,
          0.95,
          spec.h > spec.w ? spec.h * 0.46 : 1.6,
        ),
        ridgeMat,
      );
      ridge.position.y = topY + 0.9 + roofH;
      house.add(ridge);
    } else {
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w + 1.8, 2.0, spec.h + 1.8),
        corniceMat,
      );
      parapet.position.y = topY + 1.0;
      parapet.castShadow = true;
      house.add(parapet);

      const roofDeck = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(4, spec.w - 2.6), 0.6, Math.max(4, spec.h - 2.6)),
        mats.std(0x9ea38c, 0.86, 0.03),
      );
      roofDeck.position.y = topY + 1.85;
      house.add(roofDeck);

      const skylight = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(7, spec.w * 0.32), 1.8, Math.min(6, spec.h * 0.32)),
        glassMat,
      );
      skylight.position.set(-spec.w * 0.18, topY + 2.8, 0);
      house.add(skylight);

      const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 10), tankMat);
      waterTank.position.set(spec.w * 0.22, topY + 3.6, -spec.h * 0.14);
      waterTank.castShadow = true;
      house.add(waterTank);

      const roofShrub = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 8, 7),
        mats.std(0x669658, 0.78, 0.02),
      );
      roofShrub.position.set(0, topY + 3.1, spec.h * 0.2);
      house.add(roofShrub);
    }

    housesGroup.add(house);
  }

  root.add(housesGroup);
}

function buildHeroLandmark(
  districtIndex: number,
  cellGroup: THREE.Group,
  mats: MaterialLibrary,
): THREE.Object3D[] {
  const clockHands: THREE.Object3D[] = [];

  if (districtIndex === 0) {
    // Block 0 (Sherwood, cell 0,0): Rose-Terracotta Sherwood Chapel / Abbey
    const roseWall = mats.std(0xd88a88, 0.76, 0.04);
    const roseTrim = mats.std(0xf4e8d2, 0.74, 0.05);
    const roofClay = mats.std(0x9e5340, 0.76, 0.05);

    const courtyard = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.6, 46),
      mats.std(0xdccfb4, 0.84, 0.03),
    );
    courtyard.position.y = 0.3;
    courtyard.receiveShadow = true;
    cellGroup.add(courtyard);

    const nave = new THREE.Mesh(new THREE.BoxGeometry(24, 21, 30), roseWall);
    nave.position.set(0, 11.1, -2);
    nave.castShadow = true;
    nave.receiveShadow = true;
    cellGroup.add(nave);

    const naveRoof = new THREE.Mesh(createAxisPyramidGeometry(26, 9.5, 33), roofClay);
    naveRoof.position.set(0, 26.2, -2);
    naveRoof.castShadow = true;
    cellGroup.add(naveRoof);

    const lancetGlassMat = mats.std(0x5d9dad, 0.25, 0.2, {
      emissive: new THREE.Color(0xf2b57c),
      emissiveIntensity: 0.24,
    });
    for (const sideX of [-12.15, 12.15] as const) {
      for (const lz of [-10, -2.5, 4.5]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.2, 3.4), roseTrim);
        frame.position.set(sideX, 12.2, lz);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.8, 2.4), lancetGlassMat);
        glass.position.set(sideX, 12.2, lz);
        cellGroup.add(frame, glass);
      }
    }

    for (const sx of [-8.2, 8.2]) {
      const belfry = new THREE.Mesh(new THREE.BoxGeometry(8.2, 30, 8.8), roseWall);
      belfry.position.set(sx, 15.6, 9.5);
      belfry.castShadow = true;
      cellGroup.add(belfry);

      const belfryBelt = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.2, 9.6), roseTrim);
      belfryBelt.position.set(sx, 23.0, 9.5);
      cellGroup.add(belfryBelt);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(6.2, 9.5, 4), roofClay);
      spire.rotation.y = Math.PI / 4;
      spire.position.set(sx, 35.2, 9.5);
      spire.castShadow = true;
      cellGroup.add(spire);

      const finial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 3.2, 6),
        mats.std(0xdfb860, 0.35, 0.68),
      );
      finial.position.set(sx, 40.8, 9.5);
      cellGroup.add(finial);
    }

    const portalFrame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 10.5, 2.4), roseTrim);
    portalFrame.position.set(0, 5.8, 13.4);
    const portalDoor = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 8.6, 2.8),
      mats.std(0x523628, 0.8, 0.05),
    );
    portalDoor.position.set(0, 5.0, 13.5);
    cellGroup.add(portalFrame, portalDoor);

    const roseWindowRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.7, 8, 16), roseTrim);
    roseWindowRing.position.set(0, 16.5, 13.6);
    const roseGlass = new THREE.Mesh(
      new THREE.CircleGeometry(3.3, 16),
      mats.std(0x63a6b8, 0.25, 0.2, {
        emissive: new THREE.Color(0xf2b57c),
        emissiveIntensity: 0.28,
      }),
    );
    roseGlass.position.set(0, 16.5, 13.7);
    cellGroup.add(roseWindowRing, roseGlass);

    for (const cx of [-18.5, 18.5]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.1, 5.0, 7),
        mats.std(0x694932, 0.82, 0.03),
      );
      trunk.position.set(cx, 3.0, 14.5);
      const cypress = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 15.5, 8),
        mats.std(0x3a6b4c, 0.78, 0.03),
      );
      cypress.position.set(cx, 12.2, 14.5);
      cypress.castShadow = true;
      cellGroup.add(trunk, cypress);
    }
  } else if (districtIndex === 1) {
    // Block 1 (Clocktower, cell 2,0): Golden Clocktower Market Hall
    const creamWall = mats.std(0xe8d5a7, 0.76, 0.04);
    const ochreTrim = mats.std(0xc89952, 0.74, 0.06);
    const copperMat = mats.std(0x4d947f, 0.45, 0.28);
    const darkArch = mats.std(0x284744, 0.7, 0.1);

    const hallBase = new THREE.Mesh(new THREE.BoxGeometry(44, 15, 38), creamWall);
    hallBase.position.set(0, 8.0, 1);
    hallBase.castShadow = true;
    hallBase.receiveShadow = true;
    cellGroup.add(hallBase);

    const hallRoof = new THREE.Mesh(
      createAxisPyramidGeometry(46.5, 7.5, 40.5),
      mats.std(0xb86a48, 0.76, 0.05),
    );
    hallRoof.position.set(0, 19.2, 1);
    hallRoof.castShadow = true;
    cellGroup.add(hallRoof);

    for (const az of [19.4, -17.4]) {
      for (const ax of [-13, 0, 13]) {
        const arch = new THREE.Mesh(new THREE.BoxGeometry(7.2, 9.6, 2.2), darkArch);
        arch.position.set(ax, 5.2, az);
        const keystone = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.4, 2.6), ochreTrim);
        keystone.position.set(ax, 10.4, az);
        cellGroup.add(arch, keystone);
      }
    }

    const towerShaft = new THREE.Mesh(new THREE.BoxGeometry(15.5, 30, 15.5), creamWall);
    towerShaft.position.set(0, 19.5, 1);
    towerShaft.castShadow = true;
    cellGroup.add(towerShaft);

    const towerCornice = new THREE.Mesh(new THREE.BoxGeometry(17.6, 1.8, 17.6), ochreTrim);
    towerCornice.position.set(0, 34.6, 1);
    cellGroup.add(towerCornice);

    const faceDirs: readonly [number, number, number][] = [
      [0, 0, 1],
      [0, Math.PI, -1],
      [1, Math.PI / 2, 0],
      [-1, -Math.PI / 2, 0],
    ];
    for (const [dx, rotY, dz] of faceDirs) {
      const dialGroup = new THREE.Group();
      dialGroup.position.set(dx * 7.9, 28.2, 1 + dz * 7.9);
      dialGroup.rotation.y = rotY;

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.5, 16), ochreTrim);
      rim.rotation.x = Math.PI / 2;
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(3.7, 3.7, 0.65, 16),
        mats.std(0xfff9ea, 0.45, 0.05, {
          emissive: new THREE.Color(0xfff1c9),
          emissiveIntensity: 0.25,
        }),
      );
      dial.rotation.x = Math.PI / 2;

      const hourHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 2.1, 0.3),
        mats.std(0x1f3532, 0.5, 0.2),
      );
      hourHand.position.set(0.4, 0.7, 0.45);
      hourHand.rotation.z = -0.6;

      const minuteHandPivot = new THREE.Group();
      minuteHandPivot.position.set(0, 0, 0.5);
      const minuteHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 3.0, 0.3),
        mats.std(0x1f3532, 0.5, 0.2),
      );
      minuteHand.position.y = 1.2;
      minuteHandPivot.add(minuteHand);
      clockHands.push(minuteHandPivot);

      dialGroup.add(rim, dial, hourHand, minuteHandPivot);
      cellGroup.add(dialGroup);
    }

    const lanternDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.2, 4.5, 8), creamWall);
    lanternDrum.position.set(0, 37.5, 1);
    const cupola = new THREE.Mesh(
      new THREE.SphereGeometry(6.0, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      copperMat,
    );
    cupola.position.set(0, 39.2, 1);
    cupola.castShadow = true;
    const weatherSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.5, 4.6, 6),
      mats.std(0xeec353, 0.3, 0.75),
    );
    weatherSpire.position.set(0, 44.2, 1);
    cellGroup.add(lanternDrum, cupola, weatherSpire);
  } else if (districtIndex === 2) {
    // Block 2 (Harborview, cell 3,0): Harborview Villa & Pool
    const whiteMat = mats.std(0xf7f4ea, 0.65, 0.04);
    const teakMat = mats.std(0xb68454, 0.76, 0.05);
    const glassAqua = mats.std(0x63b4b8, 0.2, 0.3, { transparent: true, opacity: 0.78 });

    const woodDeck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.9, 46), teakMat);
    woodDeck.position.y = 0.45;
    woodDeck.receiveShadow = true;
    cellGroup.add(woodDeck);

    const poolRim = new THREE.Mesh(
      new THREE.BoxGeometry(24, 1.2, 15),
      mats.std(0xeae6d8, 0.65, 0.04),
    );
    poolRim.position.set(6, 0.9, 11);
    const poolWater = new THREE.Mesh(
      new THREE.BoxGeometry(21.5, 1.0, 12.5),
      mats.std(0x5ec4c8, 0.12, 0.1, {
        emissive: new THREE.Color(0x3aa8ad),
        emissiveIntensity: 0.22,
      }),
    );
    poolWater.position.set(6, 1.15, 11);
    cellGroup.add(poolRim, poolWater);

    for (const lx of [-11, -5.5]) {
      const lounger = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.1, 7.6),
        mats.std(0xfff7e2, 0.7, 0.03),
      );
      lounger.position.set(lx, 1.4, 11);
      cellGroup.add(lounger);
    }

    const groundWing = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 18), whiteMat);
    groundWing.position.set(-2, 7.2, -9);
    groundWing.castShadow = true;
    groundWing.receiveShadow = true;
    cellGroup.add(groundWing);

    const upperCantilever = new THREE.Mesh(new THREE.BoxGeometry(26, 11.5, 16), whiteMat);
    upperCantilever.position.set(2, 19.2, -8);
    upperCantilever.castShadow = true;
    cellGroup.add(upperCantilever);

    const roofPergola = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 18), teakMat);
    roofPergola.position.set(2, 25.4, -8);
    cellGroup.add(roofPergola);

    const ribbonWindow = new THREE.Mesh(new THREE.BoxGeometry(20, 6.2, 0.9), glassAqua);
    ribbonWindow.position.set(2, 19.0, 0.2);
    cellGroup.add(ribbonWindow);

    for (const [px, pz, h] of [
      [-17, 15, 22],
      [18, -14, 25],
    ] as const) {
      const palmTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.35, h, 8),
        mats.std(0x8d6847, 0.82, 0.03),
      );
      palmTrunk.position.set(px, h / 2 + 0.6, pz);
      palmTrunk.rotation.z = px < 0 ? -0.08 : 0.08;
      palmTrunk.castShadow = true;
      cellGroup.add(palmTrunk);

      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.4, 8.8),
          mats.std(f % 2 === 0 ? 0x5ca062 : 0x7cb86c, 0.75, 0.03),
        );
        const ang = (f / 6) * Math.PI * 2;
        frond.position.set(
          px + Math.cos(ang) * 3.8,
          h + 0.5,
          pz + Math.sin(ang) * 3.8,
        );
        frond.rotation.y = -ang + Math.PI / 2;
        frond.rotation.x = 0.38;
        cellGroup.add(frond);
      }
    }
  } else if (districtIndex === 3) {
    // Block 3 (Lantern Hall, cell 0,0): Lantern Hall Ceremonial Gateway with HALL plaque
    const vermilionMat = mats.std(0xcf5242, 0.68, 0.06);
    const ochreWall = mats.std(0xe2b46d, 0.76, 0.04);
    const jadeGlazeMat = mats.std(0x2f7d5b, 0.36, 0.18);
    const goldMat = mats.std(0xeec353, 0.35, 0.62);

    const stoneCourt = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.8, 46),
      mats.std(0xd8ccb0, 0.82, 0.03),
    );
    stoneCourt.position.y = 0.4;
    stoneCourt.receiveShadow = true;
    cellGroup.add(stoneCourt);

    const rearHall = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 16), ochreWall);
    rearHall.position.set(0, 8.8, -10);
    rearHall.castShadow = true;
    cellGroup.add(rearHall);

    const rearRoof = new THREE.Mesh(createAxisPyramidGeometry(39.5, 7.5, 19.5), jadeGlazeMat);
    rearRoof.position.set(0, 20.5, -10);
    rearRoof.castShadow = true;
    cellGroup.add(rearRoof);

    const pillarXs = [-16.5, -6.2, 6.2, 16.5];
    for (const px of pillarXs) {
      const isInner = Math.abs(px) < 10;
      const ph = isInner ? 25 : 19;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55, 1.75, ph, 10),
        vermilionMat,
      );
      pillar.position.set(px, ph / 2 + 0.8, 8);
      pillar.castShadow = true;
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.3, 1.8, 10),
        mats.std(0x9a9e8b, 0.8, 0.05),
      );
      plinth.position.set(px, 1.3, 8);
      cellGroup.add(pillar, plinth);
    }

    const sideLintels = [-11.35, 11.35];
    for (const lx of sideLintels) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.2, 3.2), vermilionMat);
      lintel.position.set(lx, 17.5, 8);
      const sideEave = new THREE.Mesh(createAxisPyramidGeometry(13.0, 4.8, 8.0), jadeGlazeMat);
      sideEave.position.set(lx, 21.5, 8);
      sideEave.castShadow = true;
      cellGroup.add(lintel, sideEave);
    }

    const centerBeam = new THREE.Mesh(new THREE.BoxGeometry(14.6, 5.4, 3.6), vermilionMat);
    centerBeam.position.set(0, 22.8, 8);
    cellGroup.add(centerBeam);

    const hallPlaqueMat = createSignPlaqueMaterial('HALL', '#24473a', '#f7d674', '#eec353', mats);
    const plaqueFront = new THREE.Mesh(new THREE.BoxGeometry(11.2, 4.0, 0.6), hallPlaqueMat);
    plaqueFront.position.set(0, 22.8, 10.0);
    const plaqueBack = plaqueFront.clone();
    plaqueBack.rotation.y = Math.PI;
    plaqueBack.position.set(0, 22.8, 6.0);
    cellGroup.add(plaqueFront, plaqueBack);

    const mainRoof = new THREE.Mesh(createAxisPyramidGeometry(20.6, 6.8, 11.0), jadeGlazeMat);
    mainRoof.position.set(0, 29.0, 8);
    mainRoof.castShadow = true;
    const ridgeCrest = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.3, 1.4), goldMat);
    ridgeCrest.position.set(0, 32.5, 8);
    cellGroup.add(mainRoof, ridgeCrest);

    const lanternXs = [-11.4, -3.4, 3.4, 11.4];
    for (let i = 0; i < lanternXs.length; i++) {
      const lx = lanternXs[i];
      const ly = Math.abs(lx) < 8 ? 18.2 : 14.2;
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(1.45, 10, 8),
        mats.std(0xe6483d, 0.35, 0.08, {
          emissive: new THREE.Color(0xff7d3b),
          emissiveIntensity: 0.72,
        }),
      );
      lantern.scale.set(0.9, 1.15, 0.9);
      lantern.position.set(lx, ly, 8);
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.4, 6), goldMat);
      tassel.position.set(lx, ly - 1.9, 8);
      cellGroup.add(lantern, tassel);
    }
  } else if (districtIndex === 4) {
    // Block 4 (Grand Market, cell 3,1): Grand Market Rotunda with MARKET pediment sign
    const sandstone = mats.std(0xe5c78f, 0.76, 0.04);
    const terraRoof = mats.std(0xc86747, 0.74, 0.05);
    const archShade = mats.std(0x2a4f4c, 0.7, 0.08);

    const rotundaDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(18.5, 19.5, 16.5, 12),
      sandstone,
    );
    rotundaDrum.position.set(0, 8.8, -2);
    rotundaDrum.castShadow = true;
    rotundaDrum.receiveShadow = true;
    cellGroup.add(rotundaDrum);

    const rotundaRoof = new THREE.Mesh(new THREE.ConeGeometry(21.5, 9.5, 12), terraRoof);
    rotundaRoof.position.set(0, 21.8, -2);
    rotundaRoof.castShadow = true;
    cellGroup.add(rotundaRoof);

    const cupolaLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 6.4, 5.2, 10),
      mats.std(0xf4e8c8, 0.7, 0.05),
    );
    cupolaLantern.position.set(0, 27.6, -2);
    const cupolaCap = new THREE.Mesh(new THREE.ConeGeometry(7.2, 4.4, 10), terraRoof);
    cupolaCap.position.set(0, 32.2, -2);
    cellGroup.add(cupolaLantern, cupolaCap);

    const portico = new THREE.Mesh(new THREE.BoxGeometry(22, 13.5, 8), sandstone);
    portico.position.set(0, 7.2, 13.5);
    portico.castShadow = true;
    const porticoArch = new THREE.Mesh(new THREE.BoxGeometry(9.5, 9.2, 2.0), archShade);
    porticoArch.position.set(0, 5.0, 17.0);
    cellGroup.add(portico, porticoArch);

    const marketSignMat = createSignPlaqueMaterial(
      'MARKET',
      '#284d3e',
      '#fff4d2',
      '#eec353',
      mats,
    );
    const pedimentSign = new THREE.Mesh(new THREE.BoxGeometry(18.5, 4.8, 1.2), marketSignMat);
    pedimentSign.position.set(0, 15.6, 17.2);
    const southDrumSign = new THREE.Mesh(new THREE.BoxGeometry(15.2, 4.0, 1.0), marketSignMat);
    southDrumSign.rotation.y = -Math.PI / 2;
    southDrumSign.position.set(-18.6, 14.2, -2);
    cellGroup.add(pedimentSign, southDrumSign);

    const stallSpecs: readonly [number, number, number][] = [
      [-15.5, 15.5, 0xdc6f57],
      [15.5, 15.5, 0x56b389],
    ];
    for (const [sx, sz, canopyHex] of stallSpecs) {
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(9.5, 3.6, 6.2),
        mats.std(0xb68352, 0.8, 0.04),
      );
      counter.position.set(sx, 2.2, sz);
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(10.6, 1.0, 7.4),
        mats.std(canopyHex, 0.72, 0.04),
      );
      canopy.position.set(sx, 6.8, sz);
      canopy.rotation.x = 0.22;
      canopy.castShadow = true;
      for (const fx of [-2.4, 0, 2.4]) {
        const fruit = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 7, 7),
          mats.std(fx < 0 ? 0xf2b84b : fx === 0 ? 0xe05347 : 0x76b85c, 0.65, 0.04),
        );
        fruit.position.set(sx + fx, 4.4, sz);
        cellGroup.add(fruit);
      }
      cellGroup.add(counter, canopy);
    }
  } else {
    // Block 5 (Maple Lane, cell 0,0): Maple Lane Heritage House & Giant Autumn Tree
    const brickMat = mats.std(0xb9684e, 0.8, 0.04);
    const timberMat = mats.std(0x6e4a32, 0.8, 0.05);
    const plasterMat = mats.std(0xf2e4c4, 0.76, 0.03);

    const groundStory = new THREE.Mesh(new THREE.BoxGeometry(24, 11.5, 24), brickMat);
    groundStory.position.set(-8, 6.4, -7);
    groundStory.castShadow = true;
    groundStory.receiveShadow = true;
    cellGroup.add(groundStory);

    const upperStory = new THREE.Mesh(new THREE.BoxGeometry(22.5, 11.0, 22.5), plasterMat);
    upperStory.position.set(-8, 17.6, -7);
    upperStory.castShadow = true;
    cellGroup.add(upperStory);

    const balconyDeck = new THREE.Mesh(new THREE.BoxGeometry(27.5, 1.0, 27.5), timberMat);
    balconyDeck.position.set(-7.2, 12.4, -6.2);
    const balconyRail = new THREE.Mesh(new THREE.BoxGeometry(27.8, 2.4, 27.8), timberMat);
    balconyRail.position.set(-7.2, 13.8, -6.2);
    cellGroup.add(balconyDeck, balconyRail);

    const heritageRoof = new THREE.Mesh(
      new THREE.ConeGeometry(19.5, 8.8, 4),
      mats.std(0x8c4d38, 0.78, 0.05),
    );
    heritageRoof.rotation.y = Math.PI / 4;
    heritageRoof.position.set(-8, 27.5, -7);
    heritageRoof.castShadow = true;
    cellGroup.add(heritageRoof);

    const mapleTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 3.2, 16, 9),
      mats.std(0x66432d, 0.85, 0.03),
    );
    mapleTrunk.position.set(11.5, 8.4, 9.5);
    mapleTrunk.castShadow = true;
    cellGroup.add(mapleTrunk);

    const maplePuffs: readonly [number, number, number, number, number][] = [
      [11.5, 20.5, 9.5, 10.5, 0xdc6f4e],
      [6.2, 18.2, 12.8, 7.6, 0xe89448],
      [16.2, 18.8, 6.2, 7.8, 0xc9523d],
      [11.8, 26.2, 8.8, 7.4, 0xf2ba52],
      [8.0, 23.5, 5.5, 6.5, 0xe47a46],
    ];
    for (const [mx, my, mz, mr, mhex] of maplePuffs) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(mr, 1),
        mats.std(mhex, 0.74, 0.03),
      );
      puff.position.set(mx, my, mz);
      puff.castShadow = true;
      cellGroup.add(puff);
    }
  }

  return clockHands;
}

function buildCourtyardInfill(
  variant: number,
  isClocktowerEastPlaza: boolean,
  cellGroup: THREE.Group,
  mats: MaterialLibrary,
): void {
  if (isClocktowerEastPlaza) {
    // Block 1 cell (3,0): Clocktower East Arcade Courtyard pairing with cell (2,0)
    const paving = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.6, 46),
      mats.std(0xe5dab9, 0.82, 0.03),
    );
    paving.position.y = 0.3;
    paving.receiveShadow = true;
    cellGroup.add(paving);

    const arcadeWing = new THREE.Mesh(
      new THREE.BoxGeometry(42, 12.5, 14),
      mats.std(0xe8d5a7, 0.76, 0.04),
    );
    arcadeWing.position.set(0, 6.8, -13);
    arcadeWing.castShadow = true;
    const arcadeRoof = new THREE.Mesh(
      createAxisPyramidGeometry(44.5, 5.8, 17.0),
      mats.std(0xb86a48, 0.76, 0.05),
    );
    arcadeRoof.position.set(0, 15.8, -13);
    arcadeRoof.castShadow = true;
    cellGroup.add(arcadeWing, arcadeRoof);

    for (const az of [-6.0, -20.0]) {
      for (const ax of [-13, 0, 13]) {
        const arch = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, 8.2, 0.9),
          mats.std(0x284744, 0.7, 0.1),
        );
        arch.position.set(ax, 5.0, az);
        cellGroup.add(arch);
      }
    }

    const obeliskBase = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 2.2, 7.2),
      mats.std(0xc8bfa2, 0.78, 0.04),
    );
    obeliskBase.position.set(0, 1.6, 8);
    const sundialColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.0, 9.5, 8),
      mats.std(0xeadcc0, 0.72, 0.05),
    );
    sundialColumn.position.set(0, 7.0, 8);
    sundialColumn.castShadow = true;
    const goldOrb = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 10, 8),
      mats.std(0xeec353, 0.32, 0.7),
    );
    goldOrb.position.set(0, 12.4, 8);
    cellGroup.add(obeliskBase, sundialColumn, goldOrb);

    for (const sx of [-13.5, 13.5]) {
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(5.6, 2.6, 8),
        mats.std(sx < 0 ? 0xcb7054 : 0x367b78, 0.72, 0.04),
      );
      umbrella.position.set(sx, 7.4, 10);
      umbrella.castShadow = true;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 7.2, 6),
        mats.std(0x5b4634, 0.8, 0.05),
      );
      pole.position.set(sx, 3.8, 10);
      cellGroup.add(umbrella, pole);
    }
    return;
  }

  const mode = variant % 3;
  if (mode === 0) {
    // Cozy stone bistro courtyard with low brick wall, tables, and striped parasols
    const patio = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.6, 44),
      mats.std(0xdcd3b6, 0.84, 0.03),
    );
    patio.position.y = 0.3;
    patio.receiveShadow = true;
    cellGroup.add(patio);

    const lowWallMat = mats.std(0xb87056, 0.8, 0.04);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(44, 3.4, 2.2), lowWallMat);
    backWall.position.set(0, 2.0, -20.5);
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 44), lowWallMat);
    sideWall.position.set(-20.5, 2.0, 0);
    cellGroup.add(backWall, sideWall);

    for (const [tx, tz, uHex] of [
      [-8, -6, 0xd96c49],
      [9, 8, 0x367b78],
    ] as const) {
      const tbl = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, 0.6, 12),
        mats.std(0xd8b17a, 0.75, 0.04),
      );
      tbl.position.set(tx, 3.4, tz);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, 3.4, 8),
        mats.std(0x344d48, 0.65, 0.2),
      );
      leg.position.set(tx, 1.7, tz);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 8.2, 6),
        mats.std(0x6e4e35, 0.8, 0.04),
      );
      pole.position.set(tx, 5.2, tz);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(6.8, 2.8, 8),
        mats.std(uHex, 0.72, 0.04),
      );
      canopy.position.set(tx, 9.4, tz);
      canopy.castShadow = true;
      cellGroup.add(tbl, leg, pole, canopy);
    }

    const cornerTreeTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 6.8, 7),
      mats.std(0x755138, 0.84, 0.03),
    );
    cornerTreeTrunk.position.set(12, 3.6, -12);
    const cornerTreeCrown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(6.2, 1),
      mats.std(0x639457, 0.76, 0.03),
    );
    cornerTreeCrown.position.set(12, 10.2, -12);
    cornerTreeCrown.castShadow = true;
    cellGroup.add(cornerTreeTrunk, cornerTreeCrown);
  } else if (mode === 1) {
    // Twin narrow neighborhood tube-houses with balconies, flower boxes, and shaded alley
    const leftHouse = new THREE.Mesh(
      new THREE.BoxGeometry(17.5, 19.5, 36),
      mats.std(0xf0dfc0, 0.78, 0.03),
    );
    leftHouse.position.set(-11, 10.1, 0);
    leftHouse.castShadow = true;
    leftHouse.receiveShadow = true;

    const leftRoof = new THREE.Mesh(
      createAxisPyramidGeometry(19.6, 6.2, 38.2),
      mats.std(0xb86d49, 0.76, 0.05),
    );
    leftRoof.position.set(-11, 22.8, 0);
    leftRoof.castShadow = true;

    const rightHouse = new THREE.Mesh(
      new THREE.BoxGeometry(17.5, 16.5, 36),
      mats.std(0xd8e2cc, 0.78, 0.03),
    );
    rightHouse.position.set(11, 8.6, 0);
    rightHouse.castShadow = true;
    rightHouse.receiveShadow = true;

    const rightParapet = new THREE.Mesh(
      new THREE.BoxGeometry(18.8, 1.8, 37.2),
      mats.std(0xe8dec2, 0.76, 0.04),
    );
    rightParapet.position.set(11, 17.6, 0);

    const tubeFrameMat = mats.std(0x284e4b, 0.62, 0.12);
    const tubeGlassMat = mats.std(0x58918c, 0.25, 0.25);
    const tubeShutterMat = mats.std(0x367b78, 0.72, 0.06);
    const makeTubeWin = (): THREE.Mesh => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.6, 0.7), tubeFrameMat);
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.5, 0.85), tubeGlassMat);
      const ls = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.2, 0.45), tubeShutterMat);
      ls.position.set(-2.2, 0, 0.18);
      const rs = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.2, 0.45), tubeShutterMat);
      rs.position.set(2.2, 0, 0.18);
      f.add(p, ls, rs);
      return f;
    };

    for (const bx of [-11, 11]) {
      const upperY = bx < 0 ? 15.2 : 13.6;
      const balcony = new THREE.Mesh(
        new THREE.BoxGeometry(13.5, 1.4, 3.8),
        mats.std(0x526e68, 0.65, 0.15),
      );
      balcony.position.set(bx, 10.6, 18.8);
      const flowerBox = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 1.8, 2.0),
        mats.std(0xb66246, 0.8, 0.04),
      );
      flowerBox.position.set(bx, 11.8, 19.8);
      const blooms = new THREE.Mesh(
        new THREE.BoxGeometry(9.8, 1.4, 1.8),
        mats.std(bx < 0 ? 0xe87b8c : 0xf0c254, 0.7, 0.03),
      );
      blooms.position.set(bx, 13.1, 19.8);

      const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5.8, 0.7), tubeFrameMat);
      frontDoor.position.set(bx, 3.5, 18.1);
      const frontAwning = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 0.85, 3.4),
        mats.std(bx < 0 ? 0xc86448 : 0x3b8c79, 0.72, 0.05),
      );
      frontAwning.position.set(bx, 7.1, 19.3);
      frontAwning.rotation.x = 0.24;

      const frontWin = makeTubeWin();
      frontWin.position.set(bx, upperY, 18.15);
      const rearWin = makeTubeWin();
      rearWin.rotation.y = Math.PI;
      rearWin.position.set(bx, upperY - 1.2, -18.15);
      const rearDoor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.2, 0.7), tubeFrameMat);
      rearDoor.position.set(bx, 3.2, -18.1);

      const outerSideX = bx < 0 ? -19.85 : 19.85;
      const sideRotY = bx < 0 ? -Math.PI / 2 : Math.PI / 2;
      for (const sz of [-9, 9]) {
        const sideUpperWin = makeTubeWin();
        sideUpperWin.rotation.y = sideRotY;
        sideUpperWin.position.set(outerSideX, upperY - 1.2, sz);
        const sideLowerWin = makeTubeWin();
        sideLowerWin.scale.set(0.84, 0.84, 1);
        sideLowerWin.rotation.y = sideRotY;
        sideLowerWin.position.set(outerSideX, 5.2, sz);
        cellGroup.add(sideUpperWin, sideLowerWin);
      }

      cellGroup.add(balcony, flowerBox, blooms, frontDoor, frontAwning, frontWin, rearWin, rearDoor);
    }

    cellGroup.add(leftHouse, leftRoof, rightHouse, rightParapet);
  } else {
    // Pocket herb garden with low brick walls, raised timber beds, stone cistern, and citrus tree
    const soilPad = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.7, 44),
      mats.std(0xc8c0a2, 0.85, 0.03),
    );
    soilPad.position.y = 0.35;
    soilPad.receiveShadow = true;
    cellGroup.add(soilPad);

    const brickMat = mats.std(0xb6694f, 0.82, 0.04);
    for (const [wx, wz, ww, wd] of [
      [0, -20.5, 44, 2.2],
      [0, 20.5, 28, 2.2],
      [-20.5, 0, 2.2, 44],
      [20.5, 0, 2.2, 44],
    ] as const) {
      const wMesh = new THREE.Mesh(new THREE.BoxGeometry(ww, 3.2, wd), brickMat);
      wMesh.position.set(wx, 1.9, wz);
      wMesh.castShadow = true;
      cellGroup.add(wMesh);
    }

    for (const [bx, bz] of [
      [-9.5, -8.5],
      [-9.5, 6.5],
    ] as const) {
      const bedFrame = new THREE.Mesh(
        new THREE.BoxGeometry(15, 2.2, 10),
        mats.std(0x8c6240, 0.82, 0.04),
      );
      bedFrame.position.set(bx, 1.4, bz);
      const herbs = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 1.8, 8.2),
        mats.std(0x649956, 0.78, 0.02),
      );
      herbs.position.set(bx, 2.9, bz);
      cellGroup.add(bedFrame, herbs);
    }

    const cistern = new THREE.Mesh(
      new THREE.BoxGeometry(11, 3.6, 10),
      mats.std(0x7e8a7d, 0.78, 0.06),
    );
    cistern.position.set(10.5, 2.1, -10.5);
    const cisternWater = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.5, 7.8),
      mats.std(0x529b96, 0.16, 0.12),
    );
    cisternWater.position.set(10.5, 3.85, -10.5);
    cellGroup.add(cistern, cisternWater);

    const citrusTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.35, 7.5, 8),
      mats.std(0x6e4a32, 0.84, 0.03),
    );
    citrusTrunk.position.set(10.5, 4.0, 8.5);
    const citrusCrown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(6.8, 1),
      mats.std(0x598f4f, 0.75, 0.03),
    );
    citrusCrown.position.set(10.5, 11.2, 8.5);
    citrusCrown.castShadow = true;
    cellGroup.add(citrusTrunk, citrusCrown);
  }
}

function getHeroLandmarkStreetYaw(districtIndex: number): number {
  switch (districtIndex) {
    case 0:
      return STREET_YAW_WEST; // Sherwood Chapel faces West avenue
    case 1:
      return STREET_YAW_SOUTH; // Clocktower has 4-sided dials + North/South arcade arches
    case 2:
      return STREET_YAW_EAST; // Harborview Villa & Pool faces East riverfront avenue
    case 3:
      return STREET_YAW_WEST; // Lantern Hall gateway faces West park avenue
    case 4:
      return STREET_YAW_EAST; // Grand Market Rotunda faces East street (v4)
    case 5:
    default:
      return STREET_YAW_WEST; // Maple Lane Heritage House opens toward West street (v4)
  }
}

function getCourtyardOutwardStreetYaw(col: number, row: number): number {
  if (col === 3) return STREET_YAW_EAST;
  if (col === 0) return STREET_YAW_WEST;
  if (row === 3) return STREET_YAW_SOUTH;
  return STREET_YAW_NORTH;
}

function buildLandmarksAndCourtyards(
  root: THREE.Group,
  mats: MaterialLibrary,
): { clockHands: THREE.Object3D[] } {
  const group = new THREE.Group();
  group.name = 'district-landmarks-and-courtyards';
  const clockHands: THREE.Object3D[] = [];

  for (let bIdx = 0; bIdx < BLOCK_LAYOUTS.length; bIdx++) {
    const block = BLOCK_LAYOUTS[bIdx];
    const missing = getMissingBlockCells(block.rows);

    for (let mIdx = 0; mIdx < missing.length; mIdx++) {
      const { col, row } = missing[mIdx];
      const rx = block.x + col * CELL_PITCH_2D;
      const ry = block.y + row * CELL_PITCH_2D;

      const cellGroup = new THREE.Group();
      cellGroup.position.set(...boardRectToWorld(rx, ry, CELL_SIZE_2D, CELL_SIZE_2D, 0.8));

      if (mIdx === 0) {
        cellGroup.rotation.y = getHeroLandmarkStreetYaw(bIdx);
        const hands = buildHeroLandmark(bIdx, cellGroup, mats);
        clockHands.push(...hands);
      } else {
        const isClocktowerEastPlaza = bIdx === 1 && col === 3 && row === 0;
        cellGroup.rotation.y = isClocktowerEastPlaza
          ? STREET_YAW_EAST
          : getCourtyardOutwardStreetYaw(col, row);
        buildCourtyardInfill(bIdx + col + row, isClocktowerEastPlaza, cellGroup, mats);
      }

      group.add(cellGroup);
    }
  }

  root.add(group);
  return { clockHands };
}

function buildDistrictSignsAndStreetLabels(root: THREE.Group, mats: MaterialLibrary): void {
  const signGroup = new THREE.Group();
  signGroup.name = 'district-nameplates-and-street-signs';

  const postMat = mats.std(0x233d36, 0.48, 0.38);
  const brassMat = mats.std(0xcda455, 0.28, 0.78);
  const stonePedestalMat = mats.std(0xd8ceb2, 0.78, 0.04);
  const bodyJadeMat = mats.std(0x1f3b31, 0.48, 0.18);
  const finialGlowMat = mats.std(0xffdf91, 0.25, 0.1, {
    emissive: new THREE.Color(0xffb84d),
    emissiveIntensity: 0.45,
  });

  // Compact sidewalk monument coordinates (clearance >= 9.0, height <= 10.8 so shophouses behind stay 100% visible)
  const monumentCoords: readonly [number, number][] = [
    [198, 66],
    [442, 64],
    [796, 78],
    [248, 380],
    [542, 368],
    [876, 398],
  ];

  for (let i = 0; i < BLOCK_LAYOUTS.length; i++) {
    const theme = DISTRICT_THEMES_3D[i];
    if (!theme) continue;

    const [signBx, signBy] = monumentCoords[i] ?? [
      BLOCK_LAYOUTS[i].x + 104,
      BLOCK_LAYOUTS[i].y - 12,
    ];

    const assembly = new THREE.Group();
    assembly.name = `district-corner-monument-${i}`;
    assembly.position.set(...boardToWorld(signBx, signBy, 0));

    // Low stepped stone & brass heritage street monument base (never blocks upper windows or roofs)
    const stonePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(42, 1.5, 6.2),
      stonePedestalMat,
    );
    stonePlinth.position.y = 0.75;
    stonePlinth.castShadow = true;
    stonePlinth.receiveShadow = true;

    const brassTrimCap = new THREE.Mesh(new THREE.BoxGeometry(40, 0.55, 5.4), brassMat);
    brassTrimCap.position.y = 1.75;
    assembly.add(stonePlinth, brassTrimCap);

    for (const px of [-20.5, 20.5]) {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 1.5, 8), brassMat);
      collar.position.set(px, 2.2, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 7.6, 8), postMat);
      post.position.set(px, 5.8, 0);
      post.castShadow = true;
      const lanternCap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), finialGlowMat);
      lanternCap.position.set(px, 10.1, 0);
      assembly.add(collar, post, lanternCap);
    }

    const archCrest = new THREE.Mesh(new THREE.BoxGeometry(43.5, 0.85, 1.1), brassMat);
    archCrest.position.set(0, 9.7, 0);
    assembly.add(archCrest);

    const plaqueHolder = new THREE.Group();
    plaqueHolder.position.set(0, 5.75, 0);
    // Gentle upward tilt makes district plaque crisp from Street, Iso, 2D Match, and Top presets
    plaqueHolder.rotation.x = -0.44;

    const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(47.6, 9.8, 1.8), brassMat);
    frameOuter.castShadow = true;
    const frameCore = new THREE.Mesh(new THREE.BoxGeometry(45.6, 8.2, 2.05), bodyJadeMat);

    const faceMat = createDistrictPlaqueMaterial(
      theme.code,
      theme.name,
      theme.accentHex,
      theme.plaqueBgHex,
      mats,
    );
    const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(44.8, 7.8), faceMat);
    frontFace.position.z = 1.08;

    const backFace = new THREE.Mesh(new THREE.PlaneGeometry(44.8, 7.8), faceMat);
    backFace.rotation.y = Math.PI;
    backFace.position.z = -1.08;

    plaqueHolder.add(frameOuter, frameCore, frontFace, backFace);
    assembly.add(plaqueHolder);
    signGroup.add(assembly);
  }

  const streetMarks: readonly {
    label: string;
    bx: number;
    by: number;
    y: number;
    w: number;
    h: number;
    rotY: number;
    fg: string;
    outline: string;
  }[] = [
    {
      label: 'SHERWOOD AVE',
      bx: 495,
      by: 42,
      y: 0.14,
      w: 148,
      h: 18,
      rotY: -0.015,
      fg: '#e9eccb',
      outline: '#2b423b',
    },
    {
      label: 'MERCHANT BLVD',
      bx: 525,
      by: 338,
      y: 0.14,
      w: 158,
      h: 19,
      rotY: -0.068,
      fg: '#e9eccb',
      outline: '#2b423b',
    },
    {
      label: 'HARBORFRONT QUAY',
      bx: 548,
      by: 695,
      y: 0.14,
      w: 172,
      h: 18,
      rotY: 0.032,
      fg: '#e9eccb',
      outline: '#2b423b',
    },
    {
      label: 'ROBINHOOD RIVER',
      bx: 1084,
      by: 485,
      y: 0.56,
      w: 168,
      h: 19,
      rotY: Math.PI / 2,
      fg: '#e6f5ec',
      outline: '#27534f',
    },
  ];

  for (const sm of streetMarks) {
    const decalMat = createStreetStencilMaterial(sm.label, sm.fg, sm.outline);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(sm.w, sm.h), decalMat);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = sm.rotY;
    decal.position.set(...boardToWorld(sm.bx, sm.by, sm.y));
    signGroup.add(decal);
  }

  root.add(signGroup);
}

function buildTreesFurnitureAndSignals(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  trees: AnimatedTree[];
  trafficLights: AnimatedTrafficLight[];
} {
  const propGroup = new THREE.Group();
  propGroup.name = 'trees-furniture-and-traffic-lights';

  const trees: AnimatedTree[] = [];
  const trunkMat = mats.std(0x755238, 0.85, 0.03);
  const deepLeafMat = mats.std(0x456f51, 0.78, 0.02);
  const midLeafMat = mats.std(0x668856, 0.76, 0.02);
  const hiLeafMat = mats.std(0x8da56c, 0.74, 0.02);
  const tipLeafMat = mats.std(0xafb77b, 0.72, 0.02);

  for (let i = 0; i < TREE_SPECS.length; i++) {
    const [bx, by, r] = TREE_SPECS[i];
    const isPromenade = bx >= 1052;
    const groundY = isPromenade ? 0.95 : 0;

    const treeRoot = new THREE.Group();
    treeRoot.position.set(...boardToWorld(bx, by, groundY));

    addShadowDisc(treeRoot, mats, r * 0.95, r * 0.95, 0.06);

    const trunkH = Math.max(5.5, r * 0.78);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.12, r * 0.2, trunkH, 7),
      trunkMat,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    treeRoot.add(trunk);

    const crownGroup = new THREE.Group();
    crownGroup.position.y = trunkH * 0.88;

    const basePuff = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.78, 1), deepLeafMat);
    basePuff.scale.set(1.05, 0.78, 1.05);
    basePuff.position.set(0, r * 0.2, 0);
    basePuff.castShadow = true;

    const leftPuff = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.62, 1), midLeafMat);
    leftPuff.position.set(-r * 0.26, r * 0.45, r * 0.14);
    leftPuff.castShadow = true;

    const rightPuff = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.56, 1), hiLeafMat);
    rightPuff.position.set(r * 0.28, r * 0.52, -r * 0.12);
    rightPuff.castShadow = true;

    const topTuft = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.42, 1), tipLeafMat);
    topTuft.position.set(-r * 0.06, r * 0.82, 0);

    crownGroup.add(basePuff, leftPuff, rightPuff, topTuft);
    treeRoot.add(crownGroup);
    propGroup.add(treeRoot);

    trees.push({
      crownGroup,
      phase: i * 0.73,
      amp: 0.032 + (i % 3) * 0.008,
    });
  }

  // 5 Terracotta planters
  const potMat = mats.std(0xb86b4b, 0.78, 0.04);
  const potRimMat = mats.std(0x934f37, 0.8, 0.04);
  const soilMat = mats.std(0x634d36, 0.9, 0.02);

  for (let i = 0; i < PLANTER_SPECS.length; i++) {
    const [bx, by] = PLANTER_SPECS[i];
    const planter = new THREE.Group();
    planter.position.set(...boardToWorld(bx, by, 0));
    addShadowDisc(planter, mats, 5.8, 4.6, 0.06);

    const box = new THREE.Mesh(new THREE.BoxGeometry(9.6, 3.6, 7.2), potMat);
    box.position.y = 1.8;
    box.castShadow = true;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.8, 8.0), potRimMat);
    rim.position.y = 3.6;
    const soil = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 6.2), soilMat);
    soil.position.y = 3.85;

    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(4.6, 1), midLeafMat);
    bush.scale.set(1.1, 0.88, 0.92);
    bush.position.y = 6.8;
    bush.castShadow = true;

    const blossom = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 6, 6),
      mats.std(i % 2 === 0 ? 0xf08c84 : 0xf4cf65, 0.65, 0.04),
    );
    blossom.position.set(1.6, 9.6, 1.0);

    planter.add(box, rim, soil, bush, blossom);
    propGroup.add(planter);
  }

  // 4 Striped cafe parasols with patio tables and stools
  for (let i = 0; i < PARASOL_SPECS.length; i++) {
    const [bx, by] = PARASOL_SPECS[i];
    const cafeSet = new THREE.Group();
    cafeSet.name = 'cafe-parasol-set';
    cafeSet.position.set(...boardToWorld(bx, by, 0));
    addShadowDisc(cafeSet, mats, 8.2, 8.2, 0.06);

    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 1.4, 3.4, 8),
      mats.std(0x343d39, 0.6, 0.25),
    );
    ped.position.y = 1.7;
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, 0.55, 14),
      mats.std(0xd6ab74, 0.74, 0.04),
    );
    tableTop.position.y = 3.5;
    tableTop.castShadow = true;

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8),
      mats.std(0xfff4d6, 0.5, 0.05),
    );
    cup.position.set(1.2, 4.2, 0.6);

    for (const sx of [-5.4, 5.4]) {
      const stool = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.3, 2.4),
        mats.std(i % 2 === 0 ? 0x518db1 : 0xdc6f57, 0.68, 0.05),
      );
      stool.position.set(sx, 1.15, 0.8);
      stool.castShadow = true;
      cafeSet.add(stool);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 10.2, 7),
      mats.std(0x6e4d35, 0.8, 0.04),
    );
    pole.position.y = 5.2;

    const umbrella = new THREE.Group();
    umbrella.position.y = 10.2;
    const stripeA = mats.std(0xcb7054, 0.7, 0.03);
    const stripeB = mats.std(0xf5ecd0, 0.72, 0.03);
    for (let s = 0; s < 8; s++) {
      const wedge = new THREE.Mesh(
        new THREE.ConeGeometry(7.8, 2.9, 3, 1, false, (s * Math.PI) / 4, Math.PI / 4 + 0.04),
        s % 2 === 0 ? stripeA : stripeB,
      );
      wedge.castShadow = true;
      umbrella.add(wedge);
    }
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 7, 7),
      mats.std(0xc8a25a, 0.35, 0.65),
    );
    finial.position.y = 1.7;
    umbrella.add(finial);

    cafeSet.add(ped, tableTop, cup, pole, umbrella);
    propGroup.add(cafeSet);
  }

  // 5 Wooden park benches
  const ironMat = mats.std(0x2f4540, 0.6, 0.3);
  const benchWoodMat = mats.std(0xb68252, 0.76, 0.04);
  for (const [bx, by, rotY] of BENCH_SPECS) {
    const bench = new THREE.Group();
    bench.position.set(...boardToWorld(bx, by, 0));
    bench.rotation.y = rotY;
    addShadowDisc(bench, mats, 9.5, 3.6, 0.06);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.8, 4.4), benchWoodMat);
    seat.position.y = 2.4;
    seat.castShadow = true;
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(17.5, 2.6, 0.7), benchWoodMat);
    backrest.position.set(0, 4.1, -1.9);
    backrest.rotation.x = -0.16;
    backrest.castShadow = true;

    for (const lx of [-7.2, 7.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 4.4), ironMat);
      leg.position.set(lx, 1.3, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 4.2), ironMat);
      arm.position.set(lx, 3.2, 0);
      bench.add(leg, arm);
    }

    bench.add(seat, backrest);
    propGroup.add(bench);
  }

  // Glass-roof bus stop shelter at (873, 414, 39, 14)
  const shelter = new THREE.Group();
  shelter.position.set(...boardRectToWorld(873, 414, 39, 14, 0));
  const shelterPad = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.7, 15),
    mats.std(0xe3d8b6, 0.82, 0.03),
  );
  shelterPad.position.y = 0.35;
  shelterPad.receiveShadow = true;
  shelter.add(shelterPad);

  const shelterFrameMat = mats.std(0x264440, 0.5, 0.35);
  const shelterGlassMat = mats.std(0x6eb8b0, 0.16, 0.25, {
    transparent: true,
    opacity: 0.5,
  });
  for (const px of [-17.5, 0, 17.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 11.5, 8), shelterFrameMat);
    post.position.set(px, 6.1, 5.2);
    post.castShadow = true;
    shelter.add(post);
  }
  const backGlass = new THREE.Mesh(new THREE.BoxGeometry(35.5, 9.2, 0.5), shelterGlassMat);
  backGlass.position.set(0, 5.8, 5.2);
  const leftGlass = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.2, 10.5), shelterGlassMat);
  leftGlass.position.set(-17.5, 5.8, 0.2);

  const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(39, 0.8, 14.2), shelterFrameMat);
  roofFrame.position.set(0, 11.9, 0);
  roofFrame.rotation.x = -0.08;
  roofFrame.castShadow = true;
  const roofGlass = new THREE.Mesh(
    new THREE.BoxGeometry(37.4, 1.0, 12.8),
    mats.std(0x8ecfd4, 0.14, 0.25, { transparent: true, opacity: 0.66 }),
  );
  roofGlass.position.set(0, 12.1, 0);
  roofGlass.rotation.x = -0.08;

  const waitBench = new THREE.Mesh(new THREE.BoxGeometry(22, 0.9, 3.6), benchWoodMat);
  waitBench.position.set(-2, 2.7, 3.0);

  const busTotemPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.5, 13.5, 8),
    shelterFrameMat,
  );
  busTotemPole.position.set(22.5, 6.8, -3.5);
  const busTotemSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 5.4, 1.2),
    createSignPlaqueMaterial('BUS', '#254e4d', '#fff5d4', '#eec353', mats),
  );
  busTotemSign.position.set(22.5, 12.4, -3.5);

  shelter.add(backGlass, leftGlass, roofFrame, roofGlass, waitBench, busTotemPole, busTotemSign);
  propGroup.add(shelter);

  // 18 Curbside cycling 3D traffic light poles
  const poleBaseMat = mats.std(0x52635a, 0.65, 0.28);
  const poleShaftMat = mats.std(0x253e3a, 0.55, 0.35);
  const boxMat = mats.std(0x192c29, 0.55, 0.25);
  const trafficLights: AnimatedTrafficLight[] = [];

  for (let cIdx = 0; cIdx < CROSSING_SPECS.length; cIdx++) {
    const c = CROSSING_SPECS[cIdx];
    const side = c.w / 2 + 8.5;
    const poleCoords: readonly [readonly [number, number], number][] = [
      [resolveCurbsidePolePosition(c, -10, -side), Math.atan2(-c.ux, -c.uy)],
      [resolveCurbsidePolePosition(c, 10, side), Math.atan2(c.ux, c.uy)],
    ];

    for (const [[px, py], facingRotY] of poleCoords) {
      const tlGroup = new THREE.Group();
      tlGroup.name = 'traffic-light-pole';
      const poleGroundY = px >= 1052 ? 0.95 : 0;
      tlGroup.position.set(...boardToWorld(px, py, poleGroundY));
      tlGroup.rotation.y = facingRotY;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 1.6, 8), poleBaseMat);
      base.position.y = 0.8;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 13.5, 8), poleShaftMat);
      shaft.position.y = 7.5;
      shaft.castShadow = true;

      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 6.8, 2.2), boxMat);
      housing.position.set(0, 12.2, 0.6);
      housing.castShadow = true;

      const redMat = new THREE.MeshStandardMaterial({
        color: 0x5c2c26,
        emissive: new THREE.Color(0xff5238),
        emissiveIntensity: 0.05,
        roughness: 0.3,
      });
      const amberMat = new THREE.MeshStandardMaterial({
        color: 0x594a24,
        emissive: new THREE.Color(0xffc238),
        emissiveIntensity: 0.05,
        roughness: 0.3,
      });
      const greenMat = new THREE.MeshStandardMaterial({
        color: 0x245236,
        emissive: new THREE.Color(0x4cf082),
        emissiveIntensity: 0.05,
        roughness: 0.3,
      });

      const bulbGeom = new THREE.SphereGeometry(0.76, 8, 8);
      const redBulb = new THREE.Mesh(bulbGeom, redMat);
      redBulb.position.set(0, 14.1, 1.55);
      const amberBulb = new THREE.Mesh(bulbGeom, amberMat);
      amberBulb.position.set(0, 12.2, 1.55);
      const greenBulb = new THREE.Mesh(bulbGeom, greenMat);
      greenBulb.position.set(0, 10.3, 1.55);

      tlGroup.add(base, shaft, housing, redBulb, amberBulb, greenBulb);
      propGroup.add(tlGroup);

      trafficLights.push({
        redMat,
        amberMat,
        greenMat,
        phaseOffset: (cIdx % 2) * 7.0,
      });
    }
  }

  root.add(propGroup);
  return { trees, trafficLights };
}

function createScooterMesh(
  bodyHex: number,
  shirtHex: number,
  helmetHex: number,
  useStrawHat: boolean,
  mats: MaterialLibrary,
): {
  group: THREE.Group;
  frontWheel: THREE.Object3D;
  rearWheel: THREE.Object3D;
  riderTorso: THREE.Object3D;
} {
  const group = new THREE.Group();
  addShadowDisc(group, mats, 3.0, 5.8, 0.08);

  const tireMat = mats.std(0x282d2b, 0.85, 0.08);
  const rimMat = mats.std(0xd8ddd8, 0.35, 0.65);
  const bodyMat = mats.std(bodyHex, 0.42, 0.16);
  const seatMat = mats.std(0x3a322d, 0.78, 0.05);

  const makeWheel = (): THREE.Group => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.95, 12), tireMat);
    tire.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.05, 10), rimMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tire, hub);
    return w;
  };

  const frontWheel = makeWheel();
  frontWheel.position.set(0, 1.55, 3.6);
  const rearWheel = makeWheel();
  rearWheel.position.set(0, 1.55, -3.4);
  group.add(frontWheel, rearWheel);

  const floorboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 5.4), bodyMat);
  floorboard.position.set(0, 1.6, 0.1);
  const rearCowling = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.5, 4.2), bodyMat);
  rearCowling.position.set(0, 2.9, -2.5);
  rearCowling.castShadow = true;

  const frontShield = new THREE.Mesh(new THREE.BoxGeometry(2.9, 4.4, 1.2), bodyMat);
  frontShield.position.set(0, 3.6, 2.6);
  frontShield.rotation.x = -0.18;
  frontShield.castShadow = true;

  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.4), bodyMat);
  frontFender.position.set(0, 2.8, 3.7);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 3.8), seatMat);
  saddle.position.set(0, 4.4, -2.1);

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 4.4, 8), rimMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 5.9, 2.2);

  const headlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 8, 8),
    mats.std(0xfff9d8, 0.2, 0.1, {
      emissive: new THREE.Color(0xffe694),
      emissiveIntensity: 0.9,
    }),
  );
  headlight.position.set(0, 5.9, 2.75);

  const taillight = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.7, 0.4),
    mats.std(0xe84838, 0.3, 0.1, {
      emissive: new THREE.Color(0xff4230),
      emissiveIntensity: 0.65,
    }),
  );
  taillight.position.set(0, 3.5, -4.65);

  const parcelBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.2, 2.4),
    mats.std(0xc89658, 0.78, 0.05),
  );
  parcelBox.position.set(0, 5.4, -4.2);

  const riderTorso = new THREE.Group();
  riderTorso.position.set(0, 4.8, -1.4);
  const torsoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.25, 3.6, 8),
    mats.std(shirtHex, 0.76, 0.04),
  );
  torsoMesh.position.y = 1.8;
  torsoMesh.rotation.x = 0.2;
  torsoMesh.castShadow = true;

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 8, 8),
    mats.std(0xf0c29c, 0.72, 0.02),
  );
  headMesh.position.set(0, 4.1, 0.45);

  if (useStrawHat) {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 1.3, 10),
      mats.std(0xe8d59e, 0.82, 0.02),
    );
    hat.position.set(0, 5.0, 0.45);
    riderTorso.add(hat);
  } else {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 9, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mats.std(helmetHex, 0.38, 0.18),
    );
    helmet.position.set(0, 4.3, 0.45);
    riderTorso.add(helmet);
  }

  for (const sx of [-1.15, 1.15]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.3, 3.2, 6),
      mats.std(shirtHex, 0.76, 0.04),
    );
    arm.position.set(sx, 2.5, 1.55);
    arm.rotation.x = 1.15;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.36, 3.2, 6),
      mats.std(0x2f434e, 0.8, 0.04),
    );
    leg.position.set(sx * 0.85, -0.9, 1.3);
    leg.rotation.x = -0.55;
    riderTorso.add(arm, leg);
  }

  riderTorso.add(torsoMesh, headMesh);
  group.add(
    floorboard,
    rearCowling,
    frontShield,
    frontFender,
    saddle,
    handlebar,
    headlight,
    taillight,
    parcelBox,
    riderTorso,
  );

  return { group, frontWheel, rearWheel, riderTorso };
}

function createCityBusMesh(mats: MaterialLibrary): {
  group: THREE.Group;
  wheels: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 25.5), mats.contactShadow());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.09;
  group.add(shadow);

  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 4.8, 23.0),
    mats.std(0x367b78, 0.52, 0.14),
  );
  lowerBody.position.y = 3.9;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;

  const beltStripe = new THREE.Mesh(
    new THREE.BoxGeometry(9.85, 0.75, 23.2),
    mats.std(0xeec353, 0.45, 0.25),
  );
  beltStripe.position.y = 6.35;

  const upperCabin = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 4.4, 22.4),
    mats.std(0xf3e9c7, 0.62, 0.06),
  );
  upperCabin.position.y = 8.6;
  upperCabin.castShadow = true;

  const glassBand = new THREE.Mesh(
    new THREE.BoxGeometry(9.62, 2.7, 19.8),
    mats.std(0x264b50, 0.2, 0.35),
  );
  glassBand.position.y = 8.4;

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 3.0, 0.6),
    mats.std(0x2b555a, 0.18, 0.35),
  );
  windshield.position.set(0, 8.3, 11.15);

  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 0.9, 21.2),
    mats.std(0xe5dec4, 0.7, 0.05),
  );
  roofCap.position.y = 11.2;

  const acPod = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.3, 7.6),
    mats.std(0xc8c3ad, 0.68, 0.1),
  );
  acPod.position.set(0, 12.1, -1.5);

  const routeHeader = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 1.1, 0.5),
    mats.std(0x203532, 0.4, 0.1, {
      emissive: new THREE.Color(0xffc952),
      emissiveIntensity: 0.75,
    }),
  );
  routeHeader.position.set(0, 10.3, 11.2);

  for (const hx of [-3.2, 3.2]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 8, 8),
      mats.std(0xfff9d6, 0.2, 0.1, {
        emissive: new THREE.Color(0xffe48c),
        emissiveIntensity: 0.9,
      }),
    );
    lamp.position.set(hx, 3.2, 11.55);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.4),
      mats.std(0xe64838, 0.3, 0.1, {
        emissive: new THREE.Color(0xff3e2e),
        emissiveIntensity: 0.7,
      }),
    );
    tail.position.set(hx, 3.4, -11.55);
    group.add(lamp, tail);
  }

  const tireMat = mats.std(0x242928, 0.86, 0.08);
  const hubMat = mats.std(0xeadfc0, 0.45, 0.35);
  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [
    [-4.6, 6.8],
    [4.6, 6.8],
    [-4.6, -6.8],
    [4.6, -6.8],
  ] as const) {
    const wPivot = new THREE.Group();
    wPivot.position.set(wx, 1.9, wz);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.3, 12), tireMat);
    tire.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    wPivot.add(tire, hub);
    group.add(wPivot);
    wheels.push(wPivot);
  }

  group.add(lowerBody, beltStripe, upperCabin, glassBand, windshield, roofCap, acPod, routeHeader);
  return { group, wheels };
}

function createPedestrianMesh(
  tunicHex: number,
  pantsHex: number,
  hatStyle: 'conical' | 'cap',
  mats: MaterialLibrary,
): {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
} {
  const group = new THREE.Group();
  addShadowDisc(group, mats, 1.8, 1.8, 0.07);

  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const skinMat = mats.std(0xf1c39d, 0.72, 0.02);
  const tunicMat = mats.std(tunicHex, 0.76, 0.04);
  const pantsMat = mats.std(pantsHex, 0.8, 0.03);
  const shoeMat = mats.std(0x2e3634, 0.82, 0.05);

  const makeLeg = (x: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.5, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 2.3, 7), pantsMat);
    leg.position.y = -1.1;
    leg.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 1.15), shoeMat);
    shoe.position.set(0, -2.25, 0.2);
    pivot.add(leg, shoe);
    return pivot;
  };

  const leftLeg = makeLeg(-0.52);
  const rightLeg = makeLeg(0.52);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.05, 2.8, 8), tunicMat);
  torso.position.y = 3.8;
  torso.castShadow = true;

  const makeArm = (x: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 4.9, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 2.1, 6), tunicMat);
    sleeve.position.y = -0.95;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), skinMat);
    hand.position.y = -2.0;
    pivot.add(sleeve, hand);
    return pivot;
  };

  const leftArm = makeArm(-1.12);
  const rightArm = makeArm(1.12);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.92, 8, 8), skinMat);
  head.position.y = 6.05;
  head.castShadow = true;

  if (hatStyle === 'conical') {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(2.05, 1.15, 10),
      mats.std(0xe8d59e, 0.82, 0.02),
    );
    hat.position.y = 6.85;
    hat.castShadow = true;
    bodyPivot.add(hat);
  } else {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.98, 8, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mats.std(0x3a5f7d, 0.65, 0.05),
    );
    cap.position.y = 6.22;
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.18, 0.9),
      mats.std(0x3a5f7d, 0.65, 0.05),
    );
    brim.position.set(0, 6.28, 0.82);
    bodyPivot.add(cap, brim);
  }

  bodyPivot.add(leftLeg, rightLeg, torso, leftArm, rightArm, head);
  return { group, bodyPivot, leftArm, rightArm, leftLeg, rightLeg };
}

function buildStreetLife(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  scooters: AnimatedScooter[];
  bus: AnimatedBus;
  pedestrians: AnimatedPedestrian[];
} {
  const lifeGroup = new THREE.Group();
  lifeGroup.name = 'animated-street-life';

  const circuitNW = buildFilletedLaneRoute(
    [
      [30, 45],
      [355, 40],
      [348, 134],
      [346, 243],
      [333, 331],
      [180, 339],
      [90, 352],
      [70, 324],
      [48, 285],
      [39, 220],
      [30, 85],
    ],
    3.4,
    12,
    true,
  );

  // Counter-clockwise circuit so two-way traffic rides in opposite right-hand lanes
  const circuitNC = buildFilletedLaneRoute(
    [
      [355, 40],
      [348, 134],
      [346, 243],
      [333, 331],
      [512, 333],
      [684, 348],
      [694, 260],
      [681, 172],
      [680, 45],
    ],
    3.4,
    12,
    true,
  );

  const circuitNE = buildFilletedLaneRoute(
    [
      [680, 45],
      [861, 55],
      [1024, 65],
      [1020, 200],
      [1030, 305],
      [1046, 402],
      [990, 390],
      [845, 364],
      [684, 348],
      [694, 260],
      [681, 172],
    ],
    3.1,
    12,
    true,
  );

  const circuitSC = buildFilletedLaneRoute(
    [
      [391, 333],
      [512, 333],
      [684, 348],
      [729, 353],
      [730, 447],
      [734, 549],
      [750, 686],
      [704, 688],
      [506, 699],
      [432, 699],
      [414, 604],
      [411, 510],
      [402, 409],
    ],
    3.4,
    12,
    true,
  );

  // Counter-clockwise south-east circuit in its right-hand lane
  const circuitSE = buildFilletedLaneRoute(
    [
      [729, 353],
      [730, 447],
      [734, 549],
      [750, 686],
      [876, 683],
      [1039, 676],
      [1040, 588],
      [1047, 499],
      [1046, 402],
      [990, 390],
      [845, 364],
    ],
    3.0,
    12,
    true,
  );

  const circuitOuter = buildFilletedLaneRoute(
    [
      [30, 45],
      [355, 40],
      [664, 44],
      [861, 55],
      [1024, 65],
      [1020, 200],
      [1030, 305],
      [1046, 402],
      [1047, 499],
      [1040, 588],
      [1039, 676],
      [876, 683],
      [704, 688],
      [506, 699],
      [310, 700],
      [165, 685],
      [112, 645],
      [96, 580],
      [100, 480],
      [111, 420],
      [107, 379],
      [90, 352],
      [70, 324],
      [48, 285],
      [39, 220],
      [30, 85],
    ],
    3.2,
    13,
    true,
  );

  const scooterConfigs = [
    { route: circuitNW, body: 0x62b6a8, shirt: 0xf4e8c6, helmet: 0x2c5c58, hat: false, speed: 34, offset: 0 },
    { route: circuitNC, body: 0xdc6f57, shirt: 0x3b6978, helmet: 0xf2d06b, hat: true, speed: 38, offset: 180 },
    { route: circuitNE, body: 0xeec353, shirt: 0xb85248, helmet: 0x344d48, hat: false, speed: 36, offset: 95 },
    { route: circuitSC, body: 0x6fa8dc, shirt: 0xf2b857, helmet: 0xf5f0dc, hat: false, speed: 33, offset: 240 },
    { route: circuitSE, body: 0xe08a9b, shirt: 0x457d63, helmet: 0xe87b8c, hat: true, speed: 35, offset: 130 },
    { route: circuitOuter, body: 0xf2e6c2, shirt: 0x39a883, helmet: 0xdc6f57, hat: false, speed: 42, offset: 520 },
  ] as const;

  const scooters: AnimatedScooter[] = [];
  for (const cfg of scooterConfigs) {
    const built = createScooterMesh(cfg.body, cfg.shirt, cfg.helmet, cfg.hat, mats);
    built.group.name = 'street-scooter';
    lifeGroup.add(built.group);
    scooters.push({
      group: built.group,
      frontWheel: built.frontWheel,
      rearWheel: built.rearWheel,
      riderTorso: built.riderTorso,
      route: cfg.route,
      speed: cfg.speed,
      offsetDist: cfg.offset,
      laneOffset: 0,
    });
  }

  // Bus route stays strictly inside Merchant Blvd, East Promenade Rd, and Harborfront Quay right-hand lanes
  const busRoute = buildFilletedLaneRoute(
    [
      [90, 352],
      [180, 339],
      [333, 331],
      [512, 333],
      [684, 348],
      [845, 364],
      [990, 390],
      [1046, 402],
      [1047, 499],
      [1040, 588],
      [1039, 676],
      [876, 683],
      [704, 688],
      [506, 699],
      [310, 700],
      [165, 685],
      [112, 645],
      [96, 580],
      [100, 480],
      [111, 420],
      [107, 379],
    ],
    3.1,
    14,
    true,
  );
  const builtBus = createCityBusMesh(mats);
  builtBus.group.name = 'city-bus';
  lifeGroup.add(builtBus.group);
  const bus: AnimatedBus = {
    group: builtBus.group,
    wheels: builtBus.wheels,
    route: busRoute,
    speed: 26,
    stopDist: 805,
  };

  // 10 Toy-scale walking pedestrians along real sidewalks, park paths, promenade, and zebra crossings
  const pedDefs: readonly {
    pts: readonly (readonly [number, number])[];
    closed: boolean;
    pingPong: boolean;
    tunic: number;
    pants: number;
    hat: 'conical' | 'cap';
    speed: number;
    phase: number;
  }[] = [
    {
      pts: [
        [22, 421],
        [37, 441],
        [22, 489],
        [22, 549],
        [31, 588],
        [20, 627],
      ],
      closed: false,
      pingPong: true,
      tunic: 0x39a883,
      pants: 0x2e424d,
      hat: 'conical',
      speed: 11,
      phase: 0.1,
    },
    {
      pts: [
        [153, 397],
        [195, 382],
        [240, 382],
        [272, 391],
        [315, 397],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xeec353,
      pants: 0x3a4844,
      hat: 'cap',
      speed: 10.5,
      phase: 1.4,
    },
    {
      pts: [
        [131.1, 415.0],
        [90.3, 419.0],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xdc6f57,
      pants: 0x2d3b42,
      hat: 'conical',
      speed: 12,
      phase: 2.2,
    },
    {
      pts: [
        [362.3, 305.8],
        [361.7, 356.8],
      ],
      closed: false,
      pingPong: true,
      tunic: 0x7fb5cf,
      pants: 0x333c3a,
      hat: 'cap',
      speed: 11.5,
      phase: 0.7,
    },
    {
      pts: [
        [708.3, 320.4],
        [666.5, 315.6],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xe38e89,
      pants: 0x304543,
      hat: 'conical',
      speed: 11,
      phase: 3.1,
    },
    {
      pts: [
        [750.4, 389.8],
        [708.4, 390.2],
      ],
      closed: false,
      pingPong: true,
      tunic: 0x8aae64,
      pants: 0x2f3c46,
      hat: 'cap',
      speed: 12.2,
      phase: 4.3,
    },
    {
      pts: [
        [1012.5, 368.9],
        [1001.5, 418.7],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xf4d06e,
      pants: 0x2c3e3b,
      hat: 'conical',
      speed: 11.2,
      phase: 1.9,
    },
    {
      pts: [
        [709.4, 667.3],
        [710.6, 708.3],
      ],
      closed: false,
      pingPong: true,
      tunic: 0x62a89a,
      pants: 0x363a38,
      hat: 'cap',
      speed: 10.8,
      phase: 2.8,
    },
    {
      pts: [
        [1046, 95],
        [1046, 250],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xd96c49,
      pants: 0x2d4048,
      hat: 'conical',
      speed: 10.2,
      phase: 0.5,
    },
    {
      pts: [
        [448, 376],
        [696, 384],
      ],
      closed: false,
      pingPong: true,
      tunic: 0xa99bc6,
      pants: 0x2f3a3c,
      hat: 'cap',
      speed: 11.8,
      phase: 3.7,
    },
  ];

  const pedestrians: AnimatedPedestrian[] = [];
  for (const pd of pedDefs) {
    const built = createPedestrianMesh(pd.tunic, pd.pants, pd.hat, mats);
    built.group.name = 'street-pedestrian';
    lifeGroup.add(built.group);
    pedestrians.push({
      group: built.group,
      bodyPivot: built.bodyPivot,
      leftArm: built.leftArm,
      rightArm: built.rightArm,
      leftLeg: built.leftLeg,
      rightLeg: built.rightLeg,
      route: buildRoute(pd.pts, pd.closed),
      speed: pd.speed,
      phaseOffset: pd.phase,
      pingPong: pd.pingPong,
    });
  }

  root.add(lifeGroup);
  return { scooters, bus, pedestrians };
}

interface DriftingCloud {
  readonly group: THREE.Group;
  readonly baseAngle: number;
  readonly radius: number;
  readonly baseY: number;
  readonly speed: number;
}

interface DistantSailboat {
  readonly group: THREE.Group;
  readonly baseX: number;
  readonly baseZ: number;
  readonly ampX: number;
  readonly ampZ: number;
  readonly speed: number;
  readonly phase: number;
}

function createSkyDomeTexture(mode: CityAtmosphereMode): THREE.CanvasTexture | null {
  const surface = createCanvas2D(512, 256);
  if (!surface) return null;
  const { canvas, ctx } = surface;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  if (mode === 'sunset') {
    grad.addColorStop(0.0, '#2e3c68');
    grad.addColorStop(0.26, '#7d5370');
    grad.addColorStop(0.44, '#db7d64');
    grad.addColorStop(0.51, '#f8be76');
    grad.addColorStop(0.55, '#c98863');
    grad.addColorStop(0.72, '#3d302b');
    grad.addColorStop(1.0, '#241c19');
  } else if (mode === 'night') {
    grad.addColorStop(0.0, '#0a1426');
    grad.addColorStop(0.28, '#132640');
    grad.addColorStop(0.47, '#1f3d54');
    grad.addColorStop(0.52, '#2a4d60');
    grad.addColorStop(0.62, '#152734');
    grad.addColorStop(1.0, '#0b141c');
  } else {
    grad.addColorStop(0.0, '#5a97ad');
    grad.addColorStop(0.26, '#89c1cc');
    grad.addColorStop(0.45, '#cde4df');
    grad.addColorStop(0.51, '#faeac9');
    grad.addColorStop(0.56, '#d9d4b8');
    grad.addColorStop(0.72, '#44594d');
    grad.addColorStop(1.0, '#2c3c34');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft sun / sunset / moon horizon glow toward North-West / North-East vista
  const sunX = mode === 'sunset' ? 140 : mode === 'night' ? 360 : 185;
  const sunY = mode === 'sunset' ? 124 : mode === 'night' ? 76 : 94;
  const sunR = mode === 'night' ? 34 : 68;
  const halo = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, sunR);
  if (mode === 'sunset') {
    halo.addColorStop(0, 'rgba(255, 241, 198, 0.92)');
    halo.addColorStop(0.35, 'rgba(255, 178, 96, 0.48)');
    halo.addColorStop(1, 'rgba(255, 140, 80, 0)');
  } else if (mode === 'night') {
    halo.addColorStop(0, 'rgba(244, 248, 255, 0.88)');
    halo.addColorStop(0.28, 'rgba(182, 214, 255, 0.28)');
    halo.addColorStop(1, 'rgba(120, 170, 240, 0)');
  } else {
    halo.addColorStop(0, 'rgba(255, 252, 232, 0.85)');
    halo.addColorStop(0.4, 'rgba(255, 236, 188, 0.34)');
    halo.addColorStop(1, 'rgba(255, 236, 188, 0)');
  }
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 512, 160);

  if (mode === 'night') {
    for (let i = 0; i < 95; i++) {
      const sx = (i * 79 + 23) % 512;
      const sy = (i * 43 + 11) % 116;
      const sr = i % 7 === 0 ? 1.6 : 1.0;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(255, 233, 176, 0.88)' : 'rgba(218, 236, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWalnutTabletopTexture(): THREE.CanvasTexture | null {
  const surface = createCanvas2D(512, 512);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 16; row++) {
    const y = row * 32;
    ctx.fillStyle = row % 2 === 0 ? 'rgba(78, 55, 38, 0.55)' : 'rgba(49, 34, 24, 0.55)';
    ctx.fillRect(0, y, 512, 31);
    ctx.fillStyle = 'rgba(26, 17, 11, 0.35)';
    ctx.fillRect(0, y + 31, 512, 1);

    for (let g = 0; g < 18; g++) {
      const gx = ((row * 67 + g * 31) % 490);
      const gw = 18 + ((row + g) % 26);
      ctx.fillStyle = g % 2 === 0 ? 'rgba(112, 80, 54, 0.14)' : 'rgba(30, 20, 13, 0.16)';
      ctx.fillRect(gx, y + ((g * 7) % 26), gw, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 6);
  tex.needsUpdate = true;
  return tex;
}

function buildScenicHorizonAndHarbor(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  skyDomeMat: THREE.MeshBasicMaterial;
  skyTextures: Record<CityAtmosphereMode, THREE.CanvasTexture | null>;
  cloudMat: THREE.MeshStandardMaterial;
  bayWaterMat: THREE.MeshStandardMaterial;
  lighthouseBeamPivot: THREE.Group;
  lighthouseBeamMat: THREE.MeshBasicMaterial;
  lighthouseLanternMat: THREE.MeshStandardMaterial;
  clouds: DriftingCloud[];
  sailboats: DistantSailboat[];
} {
  const scenicGroup = new THREE.Group();
  scenicGroup.name = 'distant-harbor-backdrop';

  const skyTextures: Record<CityAtmosphereMode, THREE.CanvasTexture | null> = {
    day: createSkyDomeTexture('day'),
    sunset: createSkyDomeTexture('sunset'),
    night: createSkyDomeTexture('night'),
  };

  const skyDomeMat = new THREE.MeshBasicMaterial({
    color: skyTextures.day ? 0xffffff : 0x9fd0d4,
    map: skyTextures.day,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(2350, 32, 20), skyDomeMat);
  skyDome.name = 'scenic-sky-dome';
  skyDome.renderOrder = -10;
  scenicGroup.add(skyDome);

  // Warm cafe walnut tabletop grounding the mahogany game board on South & West flanks
  const walnutTex = createWalnutTabletopTexture();
  const tabletopMat = new THREE.MeshStandardMaterial({
    color: walnutTex ? 0xffffff : 0x3d2b1f,
    map: walnutTex,
    roughness: 0.58,
    metalness: 0.06,
  });
  const tabletopBase = new THREE.Mesh(new THREE.BoxGeometry(3600, 10, 2900), tabletopMat);
  tabletopBase.position.set(0, -28.4, 0);
  tabletopBase.receiveShadow = true;
  scenicGroup.add(tabletopBase);

  // Subtle inlaid brass mat frame around the game board perimeter on the cafe table
  const inlayBrassMat = mats.std(0xb9934c, 0.34, 0.72);
  const inlayFrame = new THREE.Group();
  inlayFrame.position.y = -23.2;
  const barN = new THREE.Mesh(new THREE.BoxGeometry(1216, 0.8, 5), inlayBrassMat);
  barN.position.z = -418;
  const barS = new THREE.Mesh(new THREE.BoxGeometry(1216, 0.8, 5), inlayBrassMat);
  barS.position.z = 418;
  const barW = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 840), inlayBrassMat);
  barW.position.x = -606;
  const barE = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 840), inlayBrassMat);
  barE.position.x = 606;
  inlayFrame.add(barN, barS, barW, barE);
  scenicGroup.add(inlayFrame);

  // Scenic North & East Harbor Bay water opening out toward the misty horizon
  const bayWaterMat = new THREE.MeshStandardMaterial({
    color: 0x4b8783,
    roughness: 0.22,
    metalness: 0.16,
  });
  const northBay = new THREE.Mesh(new THREE.BoxGeometry(3400, 2.2, 1320), bayWaterMat);
  northBay.position.set(160, -22.5, -1085);
  northBay.receiveShadow = true;
  const eastBay = new THREE.Mesh(new THREE.BoxGeometry(1180, 2.2, 1680), bayWaterMat);
  eastBay.position.set(1198, -22.5, 220);
  eastBay.receiveShadow = true;
  scenicGroup.add(northBay, eastBay);

  const quayStoneMat = mats.std(0xbdb496, 0.82, 0.04);
  const northQuayLip = new THREE.Mesh(new THREE.BoxGeometry(3404, 3.0, 12), quayStoneMat);
  northQuayLip.position.set(160, -21.9, -424);
  const eastQuayLip = new THREE.Mesh(new THREE.BoxGeometry(12, 3.0, 1684), quayStoneMat);
  eastQuayLip.position.set(608, -21.9, 220);
  scenicGroup.add(northQuayLip, eastQuayLip);

  // Picturesque distant limestone karst islands & coastal hills along the North & East bay
  const rockMat = mats.std(0x6e7d73, 0.86, 0.03);
  const hillGrassMat = mats.std(0x557e58, 0.8, 0.03);
  const sandCoveMat = mats.std(0xdacba8, 0.84, 0.02);

  const islandSpecs: readonly {
    x: number;
    z: number;
    rBase: number;
    hMain: number;
    subOffset: [number, number, number, number];
  }[] = [
    { x: -460, z: -720, rBase: 86, hMain: 74, subOffset: [54, -18, 52, 48] },
    { x: 140, z: -820, rBase: 108, hMain: 96, subOffset: [-62, 22, 64, 58] },
    { x: 640, z: -640, rBase: 76, hMain: 58, subOffset: [46, 26, 44, 38] },
    { x: 930, z: -180, rBase: 92, hMain: 82, subOffset: [-38, 52, 54, 48] },
  ];

  for (const isl of islandSpecs) {
    const ig = new THREE.Group();
    ig.position.set(isl.x, -21.2, isl.z);

    const beach = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.rBase * 0.94, isl.rBase * 1.06, 4.5, 10),
      sandCoveMat,
    );
    beach.position.y = 1.6;
    ig.add(beach);

    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(isl.rBase * 0.78, isl.hMain, 9),
      rockMat,
    );
    peak.position.y = isl.hMain * 0.46 + 2;
    peak.castShadow = true;
    ig.add(peak);

    const foliageCap = new THREE.Mesh(
      new THREE.DodecahedronGeometry(isl.rBase * 0.46, 1),
      hillGrassMat,
    );
    foliageCap.scale.set(1.2, 0.62, 1.1);
    foliageCap.position.set(0, isl.hMain * 0.42, 0);
    ig.add(foliageCap);

    const [sx, sz, sr, sh] = isl.subOffset;
    const subPeak = new THREE.Mesh(new THREE.ConeGeometry(sr, sh, 8), hillGrassMat);
    subPeak.position.set(sx, sh * 0.45 + 2, sz);
    ig.add(subPeak);

    scenicGroup.add(ig);
  }

  // Heritage Harbor Lighthouse on the North-East headland island (640, -640)
  const lhGroup = new THREE.Group();
  lhGroup.position.set(648, 22, -632);
  const lhWhite = mats.std(0xf7f2e4, 0.68, 0.04);
  const lhRed = mats.std(0xc85342, 0.68, 0.05);
  const lhTowerLow = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 7.2, 14, 10), lhWhite);
  lhTowerLow.position.y = 7;
  const lhTowerMid = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.6, 11, 10), lhRed);
  lhTowerMid.position.y = 19.5;
  const lhTowerTop = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.6, 9, 10), lhWhite);
  lhTowerTop.position.y = 29.5;
  const lhLanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff5cf,
    emissive: new THREE.Color(0xffc759),
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.1,
  });
  const lhLantern = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 6.2, 10), lhLanternMat);
  lhLantern.position.y = 37;
  const lhCap = new THREE.Mesh(new THREE.ConeGeometry(4.8, 5.2, 10), lhRed);
  lhCap.position.y = 42.5;
  lhGroup.add(lhTowerLow, lhTowerMid, lhTowerTop, lhLantern, lhCap);

  const lighthouseBeamPivot = new THREE.Group();
  lighthouseBeamPivot.position.set(0, 37, 0);
  const lighthouseBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffe69c,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamCone = new THREE.Mesh(new THREE.ConeGeometry(22, 145, 12, 1, true), lighthouseBeamMat);
  beamCone.rotation.z = Math.PI / 2;
  beamCone.position.x = -74;
  lighthouseBeamPivot.add(beamCone);
  lhGroup.add(lighthouseBeamPivot);
  scenicGroup.add(lhGroup);

  // Distant traditional wooden sailboats gliding across the North & East bay
  const hullMat = mats.std(0x7c5338, 0.78, 0.04);
  const sailMat = mats.std(0xf8efe0, 0.72, 0.02);
  const sailboats: DistantSailboat[] = [];
  const boatDefs: readonly [number, number, number, number, number, number][] = [
    [-190, -560, 42, 12, 0.18, 0.4],
    [390, -590, 48, 15, 0.15, 2.1],
    [760, -90, 14, 46, 0.17, 3.8],
  ];
  for (const [bx, bz, ampX, ampZ, speed, phase] of boatDefs) {
    const bg = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 4.2, 7.6), hullMat);
    hull.position.y = 2.1;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 22, 6), hullMat);
    mast.position.set(1, 13, 0);
    const mainSail = new THREE.Mesh(new THREE.BoxGeometry(12.5, 16.5, 0.6), sailMat);
    mainSail.position.set(-2.2, 13.5, 0);
    mainSail.rotation.y = 0.16;
    const jibSail = new THREE.Mesh(new THREE.ConeGeometry(4.5, 13.5, 4), sailMat);
    jibSail.position.set(6.4, 12.2, 0);
    jibSail.rotation.z = -0.18;
    bg.add(hull, mast, mainSail, jibSail);
    bg.position.set(bx, -21.2, bz);
    scenicGroup.add(bg);
    sailboats.push({ group: bg, baseX: bx, baseZ: bz, ampX, ampZ, speed, phase });
  }

  // Soft 3D miniature clouds drifting gently along the horizon arc
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf0,
    roughness: 0.92,
    metalness: 0.0,
    emissive: new THREE.Color(0xf6ead6),
    emissiveIntensity: 0.18,
  });
  const clouds: DriftingCloud[] = [];
  for (let c = 0; c < 8; c++) {
    const cg = new THREE.Group();
    const puffs: readonly [number, number, number, number][] = [
      [0, 0, 0, 26],
      [-24, -4, 4, 19],
      [25, -3, -3, 21],
      [8, 9, 2, 17],
    ];
    for (const [px, py, pz, pr] of puffs) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(pr, 1), cloudMat);
      puff.scale.set(1.35, 0.68, 0.92);
      puff.position.set(px, py, pz);
      cg.add(puff);
    }
    const baseAngle = -Math.PI * 0.92 + (c / 7) * Math.PI * 1.15;
    const radius = 1080 + (c % 3) * 135;
    const baseY = 205 + (c % 4) * 28;
    cg.position.set(Math.cos(baseAngle) * radius, baseY, Math.sin(baseAngle) * radius);
    cg.lookAt(0, baseY * 0.6, 0);
    scenicGroup.add(cg);
    clouds.push({
      group: cg,
      baseAngle,
      radius,
      baseY,
      speed: 0.0045 + (c % 3) * 0.0012,
    });
  }

  root.add(scenicGroup);
  return {
    skyDomeMat,
    skyTextures,
    cloudMat,
    bayWaterMat,
    lighthouseBeamPivot,
    lighthouseBeamMat,
    lighthouseLanternMat: lhLanternMat,
    clouds,
    sailboats,
  };
}

function buildBoulevardStreetlamps(
  root: THREE.Group,
  mats: MaterialLibrary,
): {
  lampGlobeMat: THREE.MeshStandardMaterial;
  lampHaloMat: THREE.MeshBasicMaterial;
} {
  const lampGroup = new THREE.Group();
  lampGroup.name = 'boulevard-heritage-streetlamps';

  const ironMat = mats.std(0x223833, 0.5, 0.42);
  const brassCollarMat = mats.std(0xcda455, 0.3, 0.76);
  const lampGlobeMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: new THREE.Color(0xffb84d),
    emissiveIntensity: 0.32,
    roughness: 0.22,
    metalness: 0.06,
  });
  const lampHaloMat = new THREE.MeshBasicMaterial({
    color: 0xffca6b,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });

  // 12 verified sidewalk positions (minRoadClearance2D >= 7.5 and outside all 72 plot cells)
  const lampCoords: readonly [number, number][] = [
    [64, 152],
    [66, 262],
    [322, 185],
    [655, 185],
    [1004, 185],
    [132, 515],
    [380, 515],
    [702, 515],
    [1018, 520],
    [225, 312],
    [540, 310],
    [855, 342],
  ];

  for (const [bx, by] of lampCoords) {
    const roadInfo = minRoadClearance2D(bx, by);
    const yawToRoad = Math.atan2(roadInfo.nearestRoadX - bx, roadInfo.nearestRoadY - by);

    const lamp = new THREE.Group();
    lamp.name = 'street-heritage-lamp';
    lamp.position.set(...boardToWorld(bx, by, 0));
    lamp.rotation.y = yawToRoad;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 2.2, 8), ironMat);
    base.position.y = 1.1;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.5, 8), brassCollarMat);
    collar.position.y = 2.35;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 12.2, 8), ironMat);
    shaft.position.y = 8.4;
    shaft.castShadow = true;

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 3.4), ironMat);
    arm.position.set(0, 14.3, 1.5);
    const finialCap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.1, 8), brassCollarMat);
    finialCap.position.set(0, 14.0, 3.0);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.08, 10, 8), lampGlobeMat);
    globe.scale.set(0.92, 1.18, 0.92);
    globe.position.set(0, 12.9, 3.0);

    const haloPool = new THREE.Mesh(new THREE.CircleGeometry(10.5, 18), lampHaloMat);
    haloPool.rotation.x = -Math.PI / 2;
    haloPool.position.set(0, 0.16, 2.4);

    lamp.add(base, collar, shaft, arm, finialCap, globe, haloPool);
    lampGroup.add(lamp);
  }

  root.add(lampGroup);
  return { lampGlobeMat, lampHaloMat };
}

export function createNeighborhoodWorld3D(): NeighborhoodWorldHandle {
  const group = new THREE.Group();
  group.name = 'robin-neighborhood-world';

  const mats = new MaterialLibrary();

  const scenic = buildScenicHorizonAndHarbor(group, mats);
  buildTabletopAndGround(group, mats);
  const { sampans, foamRipples, pierLantern } = buildRiverPierAndSampans(group, mats);
  const { pondRipple, fountainDrops, fountainFoam } = buildParkPondAndFountain(group, mats);
  buildPerimeterShophouses(group, mats);
  const { clockHands } = buildLandmarksAndCourtyards(group, mats);
  buildDistrictSignsAndStreetLabels(group, mats);
  const { trees, trafficLights } = buildTreesFurnitureAndSignals(group, mats);
  const lamps = buildBoulevardStreetlamps(group, mats);
  const { scooters, bus, pedestrians } = buildStreetLife(group, mats);

  // Collect window pane materials once so Sunset / Night modes softly illuminate town windows
  const windowGlassMats: THREE.MeshStandardMaterial[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || Array.isArray(mesh.material)) return;
    const std = mesh.material as THREE.MeshStandardMaterial;
    if (!std.isMeshStandardMaterial || std === lamps.lampGlobeMat || std === scenic.cloudMat) return;
    const hex = std.color?.getHex?.() ?? 0;
    if (hex === 0x528884 || hex === 0x58918c || hex === 0x63b4b8 || hex === 0x5d9dad) {
      windowGlassMats.push(std);
    }
  });
  const uniqueWindowMats = Array.from(new Set(windowGlassMats));

  const setAtmosphere = (mode: CityAtmosphereMode): void => {
    const skyTex = scenic.skyTextures[mode];
    scenic.skyDomeMat.map = skyTex;
    scenic.skyDomeMat.color.setHex(
      skyTex ? 0xffffff : mode === 'night' ? 0x132640 : mode === 'sunset' ? 0xdb7d64 : 0x89c1cc,
    );
    scenic.skyDomeMat.needsUpdate = true;

    if (mode === 'night') {
      scenic.cloudMat.color.setHex(0x39506e);
      scenic.cloudMat.emissive.setHex(0x16253b);
      scenic.cloudMat.emissiveIntensity = 0.24;
      scenic.bayWaterMat.color.setHex(0x153142);
      scenic.lighthouseBeamMat.opacity = 0.44;
      scenic.lighthouseLanternMat.emissiveIntensity = 2.25;
      lamps.lampGlobeMat.emissiveIntensity = 2.45;
      lamps.lampHaloMat.opacity = 0.62;
      for (const wm of uniqueWindowMats) {
        wm.emissive.setHex(0xffbe58);
        wm.emissiveIntensity = 1.38;
      }
    } else if (mode === 'sunset') {
      scenic.cloudMat.color.setHex(0xffcfb0);
      scenic.cloudMat.emissive.setHex(0xf28d57);
      scenic.cloudMat.emissiveIntensity = 0.34;
      scenic.bayWaterMat.color.setHex(0x4b6d78);
      scenic.lighthouseBeamMat.opacity = 0.24;
      scenic.lighthouseLanternMat.emissiveIntensity = 1.45;
      lamps.lampGlobeMat.emissiveIntensity = 1.45;
      lamps.lampHaloMat.opacity = 0.32;
      for (const wm of uniqueWindowMats) {
        wm.emissive.setHex(0xffb55c);
        wm.emissiveIntensity = 0.52;
      }
    } else {
      scenic.cloudMat.color.setHex(0xfffaf0);
      scenic.cloudMat.emissive.setHex(0xf6ead6);
      scenic.cloudMat.emissiveIntensity = 0.18;
      scenic.bayWaterMat.color.setHex(0x4b8783);
      scenic.lighthouseBeamMat.opacity = 0.06;
      scenic.lighthouseLanternMat.emissiveIntensity = 0.65;
      lamps.lampGlobeMat.emissiveIntensity = 0.28;
      lamps.lampHaloMat.opacity = 0.04;
      for (const wm of uniqueWindowMats) {
        wm.emissive.setHex(0x000000);
        wm.emissiveIntensity = 0.0;
      }
    }
  };

  const update = (timeSec: number, _dtSec: number): void => {
    // 1. River foam shimmer & pier lantern breeze
    for (let i = 0; i < foamRipples.length; i++) {
      const f = foamRipples[i];
      const baseZ = (f.userData.baseZ as number) ?? f.position.z;
      f.position.z = baseZ + Math.sin(timeSec * 0.9 + i * 0.8) * 3.5;
      f.scale.y = 0.85 + Math.sin(timeSec * 1.6 + i) * 0.2;
    }
    pierLantern.rotation.z = Math.sin(timeSec * 1.9) * 0.08;
    pierLantern.rotation.x = Math.cos(timeSec * 1.4) * 0.05;

    // 2. Animated wooden sampan riverboats
    for (const s of sampans) {
      const theta = timeSec * s.speed + s.phase;
      const by = s.baseBy + Math.sin(theta) * s.travelAmp;
      const dir = Math.cos(theta) >= 0 ? 0 : Math.PI;
      const [wx, wy, wz] = boardToWorld(
        s.baseBx + Math.sin(theta * 2) * 1.6,
        by,
        0.55 + Math.sin(timeSec * 2.2 + s.phase) * 0.22,
      );
      s.group.position.set(wx, wy, wz);
      s.group.rotation.y = dir;
      s.group.rotation.z = Math.sin(timeSec * 1.8 + s.phase) * 0.045;
      s.group.rotation.x = Math.cos(timeSec * 1.5 + s.phase) * 0.03;
      s.oarPivot.rotation.y = Math.sin(timeSec * 3.4 + s.phase) * 0.35;
      const wakeScale = 0.9 + Math.sin(timeSec * 3.0 + s.phase) * 0.14;
      s.wakeMesh.scale.set(0.65 * wakeScale, 1.9 * wakeScale, 1);
    }

    // 3. West Park pond ripple & Central Garden fountain droplets
    const pondPulse = (timeSec * 0.45) % 1;
    pondRipple.scale.setScalar(0.55 + pondPulse * 1.15);
    (pondRipple.material as THREE.MeshBasicMaterial).opacity = (1 - pondPulse) * 0.48;

    const foamPulse = 0.92 + Math.sin(timeSec * 4.2) * 0.08;
    fountainFoam.scale.setScalar(foamPulse);
    for (const d of fountainDrops) {
      const p = (timeSec * 0.85 + d.phase) % 1;
      const radius = 1.1 + p * 11.2;
      const height = 11.8 + Math.sin(p * Math.PI) * 3.4 - p * p * 10.2;
      d.mesh.position.set(
        Math.cos(d.angle) * radius,
        Math.max(2.3, height),
        Math.sin(d.angle) * radius,
      );
      d.mesh.scale.setScalar(1.0 - p * 0.35);
    }

    // 4. Clocktower hands
    for (const hand of clockHands) {
      hand.rotation.z = -timeSec * 0.12;
    }

    // 5. Swaying trees
    for (const tr of trees) {
      tr.crownGroup.rotation.z = Math.sin(timeSec * 1.35 + tr.phase) * tr.amp;
      tr.crownGroup.rotation.x = Math.cos(timeSec * 1.05 + tr.phase) * tr.amp * 0.7;
    }

    // 6. Cycling 18 curbside traffic lights (14s cycle: 5.5s green, 1.5s amber, 7.0s red)
    for (const tl of trafficLights) {
      const t = (timeSec + tl.phaseOffset) % 14.0;
      const isGreen = t < 5.5;
      const isAmber = t >= 5.5 && t < 7.0;
      const isRed = t >= 7.0;
      tl.greenMat.emissiveIntensity = isGreen ? 1.15 : 0.05;
      tl.amberMat.emissiveIntensity = isAmber ? 1.15 : 0.05;
      tl.redMat.emissiveIntensity = isRed ? 1.15 : 0.05;
    }

    // 7. Scooters cruising along 2D avenues
    for (const sc of scooters) {
      const dist = timeSec * sc.speed + sc.offsetDist;
      const pos = sampleRoute(sc.route, dist, sc.laneOffset);
      const ahead = sampleRoute(sc.route, dist + 5, sc.laneOffset);
      const [wx, wy, wz] = boardToWorld(pos.bx, pos.by, 0.04);
      sc.group.position.set(wx, wy, wz);
      sc.group.rotation.y = pos.headingRad;

      let deltaYaw = ahead.headingRad - pos.headingRad;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
      sc.group.rotation.z = -deltaYaw * 0.35;

      const spin = dist * 0.55;
      sc.frontWheel.rotation.x = spin;
      sc.rearWheel.rotation.x = spin;
      sc.riderTorso.position.y = 4.8 + Math.sin(timeSec * 14 + sc.offsetDist) * 0.08;
    }

    // 8. City bus with gentle dwell near bus stop lay-by
    const rawBusPhase = (timeSec * bus.speed) % bus.route.totalLength;
    const distFromStop = rawBusPhase - bus.stopDist;
    const stopSlowdown = Math.exp(-(distFromStop * distFromStop) / 3600) * 18;
    const busDist = rawBusPhase - stopSlowdown;
    const busSample = sampleRoute(bus.route, busDist, 0);
    const [bwx, bwy, bwz] = boardToWorld(busSample.bx, busSample.by, 0.05);
    bus.group.position.set(bwx, bwy, bwz);
    bus.group.rotation.y = busSample.headingRad;
    for (const w of bus.wheels) {
      w.rotation.x = busDist * 0.42;
    }

    // 9. Walking pedestrians
    for (const ped of pedestrians) {
      const rawDist = timeSec * ped.speed + ped.phaseOffset * 35;
      let sampleDist = rawDist;
      let reverseHeading = false;
      if (ped.pingPong) {
        const span = ped.route.totalLength;
        const cycle = ((rawDist % (span * 2)) + span * 2) % (span * 2);
        if (cycle <= span) {
          sampleDist = cycle;
        } else {
          sampleDist = span * 2 - cycle;
          reverseHeading = true;
        }
      }
      const pSample = sampleRoute(ped.route, sampleDist, 0);
      const [pwx, pwy, pwz] = boardToWorld(pSample.bx, pSample.by, 0.05);
      ped.group.position.set(pwx, pwy, pwz);
      ped.group.rotation.y = reverseHeading ? pSample.headingRad + Math.PI : pSample.headingRad;

      const stride = timeSec * ped.speed * 0.62 + ped.phaseOffset;
      const swing = Math.sin(stride) * 0.55;
      ped.leftLeg.rotation.x = swing;
      ped.rightLeg.rotation.x = -swing;
      ped.leftArm.rotation.x = -swing * 0.8;
      ped.rightArm.rotation.x = swing * 0.8;
      ped.bodyPivot.position.y = Math.abs(Math.sin(stride)) * 0.32;
    }

    // 10. Harbor lighthouse sweep, drifting horizon clouds, and distant sailboats
    scenic.lighthouseBeamPivot.rotation.y = timeSec * 0.42;
    for (let i = 0; i < scenic.clouds.length; i++) {
      const cl = scenic.clouds[i];
      const ang = cl.baseAngle + Math.sin(timeSec * cl.speed + i) * 0.08;
      cl.group.position.x = Math.cos(ang) * cl.radius;
      cl.group.position.z = Math.sin(ang) * cl.radius;
      cl.group.position.y = cl.baseY + Math.sin(timeSec * 0.35 + i * 1.4) * 3.5;
    }
    for (const sb of scenic.sailboats) {
      const st = timeSec * sb.speed + sb.phase;
      sb.group.position.x = sb.baseX + Math.sin(st) * sb.ampX;
      sb.group.position.z = sb.baseZ + Math.cos(st * 0.8) * sb.ampZ;
      sb.group.rotation.y = Math.atan2(
        Math.cos(st) * sb.ampX * sb.speed,
        -Math.sin(st * 0.8) * sb.ampZ * sb.speed * 0.8,
      );
      sb.group.rotation.z = Math.sin(timeSec * 1.1 + sb.phase) * 0.05;
    }
  };

  // Prime initial pose at t = 0
  setAtmosphere('day');
  update(0, 0);

  const dispose = (): void => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const t of Object.values(scenic.skyTextures)) {
      if (t) textures.add(t);
    }

    const collectMaterial = (mat: THREE.Material): void => {
      materials.add(mat);
      const record = mat as unknown as Record<string, unknown>;
      const texKeys = [
        'map',
        'emissiveMap',
        'alphaMap',
        'roughnessMap',
        'metalnessMap',
        'bumpMap',
        'normalMap',
      ];
      for (const k of texKeys) {
        const val = record[k];
        if (val && val instanceof THREE.Texture) {
          textures.add(val);
        }
      }
    };

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
        if (obj.geometry) {
          geometries.add(obj.geometry);
        }
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) {
            if (m) collectMaterial(m);
          }
        } else if (obj.material) {
          collectMaterial(obj.material);
        }
      } else if (obj instanceof THREE.Sprite && obj.material) {
        collectMaterial(obj.material);
      }
    });

    for (const tex of textures) {
      tex.dispose();
    }
    for (const mat of materials) {
      mat.dispose();
    }
    for (const geom of geometries) {
      geom.dispose();
    }
    group.clear();
  };

  return { group, update, setAtmosphere, dispose };
}
