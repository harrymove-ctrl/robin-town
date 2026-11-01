import type * as THREE from 'three';
import { PLOT_LAYOUT } from '../board-layout';
import type { GameState } from '../types';

export const BOARD_2D_W = 1100;
export const BOARD_2D_H = 730;
export const CELL_PITCH_2D = 52;
export const CELL_SIZE_2D = 50;

export const STREET_YAW_SOUTH = 0;
export const STREET_YAW_WEST = -Math.PI / 2;
export const STREET_YAW_EAST = Math.PI / 2;
export const STREET_YAW_NORTH = Math.PI;

export interface RoadDef2D {
  readonly id: string;
  readonly width: number;
  readonly points: readonly (readonly [number, number])[];
}

/**
 * Exact mathematical street centerlines and asphalt widths from draw-city-board-v6.lua.
 */
export const ROAD_DEFS_2D: readonly RoadDef2D[] = [
  {
    id: 'west',
    width: 23,
    points: [
      [30, -10],
      [30, 85],
      [39, 220],
      [48, 285],
      [70, 324],
      [90, 352],
      [107, 379],
      [111, 420],
      [100, 480],
      [96, 580],
      [112, 645],
      [165, 685],
      [310, 700],
      [506, 699],
      [704, 688],
      [876, 683],
      [1039, 676],
    ],
  },
  {
    id: 'top',
    width: 25,
    points: [
      [-20, 45],
      [355, 40],
      [664, 44],
      [861, 55],
      [1090, 70],
    ],
  },
  {
    id: 'v1',
    width: 22,
    points: [
      [355, 38],
      [348, 134],
      [346, 243],
      [333, 331],
    ],
  },
  {
    id: 'v2',
    width: 24,
    points: [
      [680, 45],
      [681, 172],
      [694, 260],
      [684, 348],
    ],
  },
  {
    id: 'v3',
    width: 22,
    points: [
      [391, 333],
      [402, 409],
      [411, 510],
      [414, 604],
      [432, 699],
    ],
  },
  {
    id: 'v4',
    width: 24,
    points: [
      [729, 353],
      [730, 447],
      [734, 549],
      [750, 686],
    ],
  },
  {
    id: 'east',
    width: 19,
    points: [
      [1024, 65],
      [1020, 200],
      [1030, 305],
      [1046, 402],
      [1047, 499],
      [1040, 588],
      [1039, 676],
      [1052, 745],
    ],
  },
  {
    id: 'main',
    width: 33,
    points: [
      [-30, 355],
      [180, 339],
      [333, 331],
      [512, 333],
      [684, 348],
      [845, 364],
      [990, 390],
      [1130, 421],
    ],
  },
];

export function closestPointOnSegment2D(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number; dist: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) {
    return { x: x0, y: y0, dist: Math.hypot(px - x0, py - y0) };
  }
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const cx = x0 + dx * t;
  const cy = y0 + dy * t;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

/**
 * Signed distance from `(bx, by)` to the nearest asphalt road edge across all 8 streets:
 * - Negative (`< 0`) means `(bx, by)` lies inside the asphalt roadway.
 * - Positive (`> 0`) means `(bx, by)` lies outside the asphalt roadway (curb/sidewalk/plaza).
 */
export function minRoadClearance2D(bx: number, by: number): {
  clearance: number;
  nearestRoadX: number;
  nearestRoadY: number;
  roadId: string;
} {
  let bestClearance = Infinity;
  let nearestRoadX = bx;
  let nearestRoadY = by;
  let roadId = 'main';

  for (const road of ROAD_DEFS_2D) {
    const halfW = road.width * 0.5;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [x0, y0] = road.points[i];
      const [x1, y1] = road.points[i + 1];
      const hit = closestPointOnSegment2D(bx, by, x0, y0, x1, y1);
      const clearance = hit.dist - halfW;
      if (clearance < bestClearance) {
        bestClearance = clearance;
        nearestRoadX = hit.x;
        nearestRoadY = hit.y;
        roadId = road.id;
      }
    }
  }

  return { clearance: bestClearance, nearestRoadX, nearestRoadY, roadId };
}

function computePerimeterPlotYaw(
  col: number,
  row: number,
  block: number,
  clusterSet: ReadonlySet<number> | null,
): number {
  const hasNeighborInCluster = (targetCol: number, targetRow: number): boolean => {
    if (!clusterSet || clusterSet.size <= 1) return false;
    for (const id of clusterSet) {
      const candidate = PLOT_LAYOUT[id];
      if (candidate && candidate.block === block && candidate.col === targetCol && candidate.row === targetRow) {
        return true;
      }
    }
    return false;
  };

  // Single-street perimeter edges
  if (row === 3 && col > 0 && col < 3) return STREET_YAW_SOUTH;
  if (row === 0 && col > 0 && col < 3) return STREET_YAW_NORTH;
  if (col === 0 && row > 0 && row < 3) return STREET_YAW_WEST;
  if (col === 3 && row > 0 && row < 3) return STREET_YAW_EAST;

  // Two-street block corners: align with connected street-edge cluster when unambiguous
  if (col === 0 && row === 0) {
    if (hasNeighborInCluster(1, 0) && !hasNeighborInCluster(0, 1)) return STREET_YAW_NORTH;
    return STREET_YAW_WEST;
  }
  if (col === 3 && row === 0) {
    if (hasNeighborInCluster(2, 0) && !hasNeighborInCluster(3, 1)) return STREET_YAW_NORTH;
    return STREET_YAW_EAST;
  }
  if (col === 0 && row === 3) {
    if (hasNeighborInCluster(0, 2) && !hasNeighborInCluster(1, 3)) return STREET_YAW_WEST;
    return STREET_YAW_SOUTH;
  }
  if (col === 3 && row === 3) {
    if (hasNeighborInCluster(3, 2) && !hasNeighborInCluster(2, 3)) return STREET_YAW_EAST;
    return STREET_YAW_SOUTH;
  }

  // Fallback for interior cells if called directly
  if (row >= 2) return STREET_YAW_SOUTH;
  return col <= 1 ? STREET_YAW_WEST : STREET_YAW_EAST;
}

/**
 * Computes the Three.js Y rotation (`0`, `-PI/2`, `+PI/2`, `PI`) so a plot's 3D shopfront
 * faces the adjacent street rather than facing into interior neighbor walls.
 * Connected multi-tile shop clusters inherit a consistent outward street direction.
 */
export function getPlotStreetFacingYaw(
  lotId: number,
  clusterLots?: readonly number[],
): number {
  const plot = PLOT_LAYOUT[lotId];
  if (!plot) return STREET_YAW_SOUTH;

  const clusterSet =
    clusterLots && clusterLots.length > 1 ? new Set<number>(clusterLots) : null;

  const isPerimeter =
    plot.col === 0 || plot.col === 3 || plot.row === 0 || plot.row === 3;

  if (isPerimeter) {
    return computePerimeterPlotYaw(plot.col, plot.row, plot.block, clusterSet);
  }

  // Interior cell (col 1..2, row 1..2): if connected to a perimeter shop in the same cluster,
  // face the same street as the nearest perimeter tile of that business.
  if (clusterSet) {
    let bestDist = Infinity;
    let bestPerimeterPlot: (typeof PLOT_LAYOUT)[number] | null = null;
    for (const memberId of clusterSet) {
      const member = PLOT_LAYOUT[memberId];
      if (!member || member.block !== plot.block) continue;
      const memberIsPerim =
        member.col === 0 || member.col === 3 || member.row === 0 || member.row === 3;
      if (!memberIsPerim) continue;
      const manhattan = Math.abs(member.col - plot.col) + Math.abs(member.row - plot.row);
      if (manhattan < bestDist) {
        bestDist = manhattan;
        bestPerimeterPlot = member;
      }
    }
    if (bestPerimeterPlot) {
      return computePerimeterPlotYaw(
        bestPerimeterPlot.col,
        bestPerimeterPlot.row,
        bestPerimeterPlot.block,
        clusterSet,
      );
    }
  }

  if (plot.row >= 2) return STREET_YAW_SOUTH;
  return plot.col <= 1 ? STREET_YAW_WEST : STREET_YAW_EAST;
}

/**
 * Exact 4-player plastic stool colors matching the 2D Aseprite sprites and HUD:
 * 0 = You (Robin Jade), 1 = Cole (Gold), 2 = Maya (Coral), 3 = Clara (Sky Blue)
 */
export const PLAYER_STOOL_COLORS = ['#39a883', '#eec353', '#dc6f57', '#7fb5cf'] as const;

export const PLAYER_NAMES_DEFAULT = ['You', 'Cole', 'Maya', 'Clara'] as const;

export interface DistrictTheme3D {
  index: number;
  code: string;
  name: string;
  accentHex: string;
  plaqueBgHex: string;
}

export const DISTRICT_THEMES_3D: readonly DistrictTheme3D[] = [
  { index: 0, code: '01', name: 'Sherwood', accentHex: '#d88a88', plaqueBgHex: '#254236' },
  { index: 1, code: '02', name: 'Clocktower', accentHex: '#eec353', plaqueBgHex: '#254236' },
  { index: 2, code: '03', name: 'Harborview', accentHex: '#63b4b8', plaqueBgHex: '#254236' },
  { index: 3, code: '04', name: 'Lantern Hall', accentHex: '#dc6f57', plaqueBgHex: '#254236' },
  { index: 4, code: '05', name: 'Grand Market', accentHex: '#56b389', plaqueBgHex: '#254236' },
  { index: 5, code: '06', name: 'Maple Lane', accentHex: '#c68b59', plaqueBgHex: '#254236' },
];

export type CameraPresetMode = 'neighborhood' | 'isometric' | 'topdown' | 'street';

export type CityAtmosphereMode = 'day' | 'sunset' | 'night';

export interface ClusterConnectionMask {
  readonly north: boolean;
  readonly south: boolean;
  readonly east: boolean;
  readonly west: boolean;
}

export const EMPTY_CLUSTER_CONNECTIONS: ClusterConnectionMask = {
  north: false,
  south: false,
  east: false,
  west: false,
};

/**
 * Computes which orthogonal neighbor plots in the same block belong to the same connected shop
 * cluster, plus whether `lotId` is the canonical flagship plot of that cluster.
 */
export function computePlotClusterConnections(
  lotId: number,
  clusterLots?: readonly number[],
): { mask: ClusterConnectionMask; isFlagship: boolean } {
  if (!clusterLots || clusterLots.length <= 1) {
    return { mask: EMPTY_CLUSTER_CONNECTIONS, isFlagship: true };
  }
  const plot = PLOT_LAYOUT[lotId];
  if (!plot) {
    return { mask: EMPTY_CLUSTER_CONNECTIONS, isFlagship: true };
  }

  let north = false;
  let south = false;
  let east = false;
  let west = false;

  for (const otherId of clusterLots) {
    if (otherId === lotId) continue;
    const other = PLOT_LAYOUT[otherId];
    if (!other || other.block !== plot.block) continue;
    if (other.col === plot.col && other.row === plot.row - 1) north = true;
    else if (other.col === plot.col && other.row === plot.row + 1) south = true;
    else if (other.col === plot.col + 1 && other.row === plot.row) east = true;
    else if (other.col === plot.col - 1 && other.row === plot.row) west = true;
  }

  let bestId = clusterLots[0] ?? lotId;
  let bestScore = -Infinity;
  for (const memberId of clusterLots) {
    const m = PLOT_LAYOUT[memberId];
    if (!m) continue;
    let degree = 0;
    for (const peerId of clusterLots) {
      if (peerId === memberId) continue;
      const p = PLOT_LAYOUT[peerId];
      if (!p || p.block !== m.block) continue;
      if (Math.abs(p.col - m.col) + Math.abs(p.row - m.row) === 1) {
        degree++;
      }
    }
    const isPerim = m.col === 0 || m.col === 3 || m.row === 0 || m.row === 3 ? 6 : 0;
    const frontBias = m.row === 3 || m.col === 0 ? 3 : 0;
    const score = degree * 10 + isPerim + frontBias;
    if (score > bestScore || (score === bestScore && memberId < bestId)) {
      bestScore = score;
      bestId = memberId;
    }
  }

  return {
    mask: { north, south, east, west },
    isFlagship: lotId === bestId,
  };
}

/**
 * Converts a 2D point `(bx, by)` on the `1100 x 730` Aseprite board into Three.js `(x, y, z)`.
 * Matches a `PlaneGeometry(1100, 730)` rotated by `rotation.x = -Math.PI / 2` at `(0, 0, 0)`:
 * - `bx = 0..1100` -> `x = -550..+550` (West to East)
 * - `by = 0..730`  -> `z = -365..+365` (North to South)
 */
export function boardToWorld(bx: number, by: number, y = 0): [number, number, number] {
  return [bx - BOARD_2D_W / 2, y, by - BOARD_2D_H / 2];
}

export function worldToBoard(wx: number, wz: number): [number, number] {
  return [wx + BOARD_2D_W / 2, wz + BOARD_2D_H / 2];
}

/**
 * Converts a 2D top-left rectangle `(rx, ry, rw, rh)` into its centered Three.js `[x, y, z]`.
 */
export function boardRectToWorld(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  y = 0,
): [number, number, number] {
  return [rx + rw / 2 - BOARD_2D_W / 2, y, ry + rh / 2 - BOARD_2D_H / 2];
}

/**
 * Returns the 4 missing `(col, row)` cells in a `4 x 4` district block envelope (`BLOCK_LAYOUTS[i]`),
 * which hold courtyards, district landmarks, and corner houses in the 2D Aseprite map.
 */
export function getMissingBlockCells(rows: readonly (readonly number[])[]): Array<{ col: number; row: number }> {
  const missing: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < 4; row++) {
    const present = rows[row] ?? [];
    for (let col = 0; col < 4; col++) {
      if (!present.includes(col)) {
        missing.push({ col, row });
      }
    }
  }
  return missing;
}

export interface NeighborhoodWorldHandle {
  group: THREE.Group;
  update(timeSec: number, dtSec: number): void;
  setAtmosphere?(mode: CityAtmosphereMode): void;
  dispose(): void;
}

export interface PlotVisualState {
  lotId: number;
  displayNumber: number; // 1..72
  districtIndex: number; // 0..5
  owner: number | null; // 0..3 or null
  shop: number | null; // 0..5 or null
  isOffered: boolean; // in state.pending during Receive phase
  isChosen: boolean; // in chosenLots during Receive phase
  isSelected: boolean; // inspected/selected plot
  isHovered: boolean; // pointer hover
  isDropTarget: boolean; // shop drag-and-drop hover target
  isBuildable: boolean; // build phase + owned by player 0 + empty + player has selected shop
  clusterSize: number; // size of connected shop group
  targetSize: number; // complete shop size (3, 3, 4, 4, 5, 6)
  isComplete: boolean; // clusterSize >= targetSize
  streetYaw: number; // outward street-facing Y rotation in radians (0, -PI/2, +PI/2, PI)
  connectedMask?: ClusterConnectionMask; // connected orthogonal same-shop neighbors
  isClusterFlagship?: boolean; // primary centerpiece plot of a multi-tile shop cluster
  atmosphere?: CityAtmosphereMode; // active 3D lighting mood ('day' | 'sunset' | 'night')
}

export interface PlotSlot3D {
  lotId: number;
  root: THREE.Group;
  tileMesh: THREE.Mesh;
  frameMesh: THREE.LineSegments;
  ringMesh: THREE.Mesh;
  deedBadgeGroup: THREE.Group;
  occupantGroup: THREE.Group;
  occupantKey: string;
  visualKey: string;
}

export interface City3DRenderParams {
  state: GameState;
  selectedLot?: number | null;
  chosenLots?: readonly number[];
  selectedShop?: number | null;
  tradeGiveLots?: readonly number[];
  tradeTakeLots?: readonly number[];
}

export interface RobinCity3DOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  initialPreset?: CameraPresetMode;
  initialAtmosphere?: CityAtmosphereMode;
  onSelectLot?: (lotId: number) => void;
  onHoverLot?: (lotId: number | null) => void;
}
