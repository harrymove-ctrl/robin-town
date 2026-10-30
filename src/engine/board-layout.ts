/**
 * src/engine/board-layout.ts
 *
 * Board layout geometry, orthogonal adjacency graph, connected component
 * cluster analysis, business completion verification, and non-linear yield
 * calculations for the 72-parcel robin-town Web3 metropolis.
 */

export const BOARD_WIDTH = 1100;
export const BOARD_HEIGHT = 730;
export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 730;
export const BOARD_REVISION = 2;
export const CELL_SIZE = 50;
export const CELL_PITCH = 52;
export const TOTAL_LOTS = 72;
export const TOTAL_DISTRICTS = 6;
export const LOTS_PER_DISTRICT = 12;

export type DistrictId = 0 | 1 | 2 | 3 | 4 | 5;

export interface DistrictConfig {
  id: DistrictId;
  name: string;
  x: number;
  y: number;
  accent: [number, number, number, number];
  accentHex: string;
  rows: number[][];
}

export interface LotDefinition {
  id: number;
  lotNumber: number;
  block: DistrictId;
  districtName: string;
  row: number;
  col: number;
  x: number;
  y: number;
  neighbors: readonly number[];
}

export interface PlotLayout {
  id: number;
  displayId: number;
  block: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface ShopCategoryDefinition {
  id: number;
  name: string;
  code: string;
  targetSize: number;
  colorHex: string;
  bagQuota: number;
}

export interface LotState {
  id: number;
  owner: number | null;
  shop: number | null;
}

export interface ShopCluster {
  playerId: number;
  shopType: number;
  districtId: DistrictId;
  lots: number[];
  size: number;
  targetSize: number;
  isComplete: boolean;
  annualIncome: number;
}

export interface BuildValidationResult {
  valid: boolean;
  reason?: string;
  resultingClusterSize?: number;
  isComplete?: boolean;
}

export const DISTRICT_BLOCKS: readonly DistrictConfig[] = [
  {
    id: 0,
    name: 'ROBINHOOD DISTRICT',
    x: 92,
    y: 100,
    accent: [0, 200, 5, 255],
    accentHex: '#00C805',
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
    ],
  },
  {
    id: 1,
    name: 'WALL STREET QUARTER',
    x: 399,
    y: 105,
    accent: [238, 195, 83, 255],
    accentHex: '#EEC353',
    rows: [
      [0, 1],
      [0, 1, 2],
      [0, 1, 2, 3],
      [1, 2, 3],
    ],
  },
  {
    id: 2,
    name: 'CRYPTO WHARF',
    x: 747,
    y: 120,
    accent: [41, 182, 246, 255],
    accentHex: '#29B6F6',
    rows: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2, 3],
      [2, 3],
    ],
  },
  {
    id: 3,
    name: 'SILICON STRIP',
    x: 156,
    y: 439,
    accent: [171, 71, 188, 255],
    accentHex: '#AB47BC',
    rows: [
      [1, 2],
      [1, 2, 3],
      [0, 1, 2],
      [0, 1, 2, 3],
    ],
  },
  {
    id: 4,
    name: 'MEMECOIN BOULEVARD',
    x: 464,
    y: 404,
    accent: [255, 112, 67, 255],
    accentHex: '#FF7043',
    rows: [
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
      [0, 1, 2],
    ],
  },
  {
    id: 5,
    name: 'DEFI CITADEL',
    x: 796,
    y: 451,
    accent: [88, 124, 154, 255],
    accentHex: '#587C9A',
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1],
      [0, 1, 2],
    ],
  },
];

export const SHOP_CATEGORIES: readonly ShopCategoryDefinition[] = [
  { id: 0, name: 'DEX Swap', code: 'DX', targetSize: 3, colorHex: '#39A883', bagQuota: 20 },
  { id: 1, name: 'Memecoin Lounge', code: 'ML', targetSize: 3, colorHex: '#EEC353', bagQuota: 20 },
  { id: 2, name: 'Staking Vault', code: 'SV', targetSize: 4, colorHex: '#B85539', bagQuota: 20 },
  { id: 3, name: 'Lending Protocol', code: 'LP', targetSize: 4, colorHex: '#A16586', bagQuota: 20 },
  { id: 4, name: 'Derivatives Exchange', code: 'DE', targetSize: 5, colorHex: '#587C9A', bagQuota: 20 },
  { id: 5, name: 'Validator Citadel', code: 'VC', targetSize: 6, colorHex: '#648454', bagQuota: 20 },
];

export const SHOP_TARGET_SIZES: readonly [number, number, number, number, number, number] = [
  3, 3, 4, 4, 5, 6,
];

export const COMPLETE_PAYOUTS: readonly number[] = [0, 0, 0, 50, 80, 110, 140];
export const INCOMPLETE_PAYOUTS: readonly number[] = [0, 10, 20, 40, 60, 80];

interface RawParcel {
  id: number;
  lotNumber: number;
  block: DistrictId;
  districtName: string;
  row: number;
  col: number;
  x: number;
  y: number;
}

const rawParcels: RawParcel[] = [];
let lotCounter = 0;

for (const block of DISTRICT_BLOCKS) {
  for (let r = 0; r < block.rows.length; r++) {
    const cols = block.rows[r];
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      rawParcels.push({
        id: lotCounter,
        lotNumber: lotCounter + 1,
        block: block.id,
        districtName: block.name,
        row: r,
        col,
        x: block.x + col * CELL_PITCH,
        y: block.y + r * CELL_PITCH,
      });
      lotCounter++;
    }
  }
}

// Build adjacency graph with strict orthogonal rules
const adjacencyGraph: number[][] = [];

for (let i = 0; i < rawParcels.length; i++) {
  const p = rawParcels[i];
  const neighbors: number[] = [];
  for (let j = 0; j < rawParcels.length; j++) {
    if (i === j) continue;
    const other = rawParcels[j];
    // Same district block only
    if (p.block !== other.block) continue;
    // Strict orthogonal adjacency, strictly no diagonals
    const dRow = Math.abs(p.row - other.row);
    const dCol = Math.abs(p.col - other.col);
    if (dRow + dCol === 1) {
      neighbors.push(other.id);
    }
  }
  neighbors.sort((a, b) => a - b);
  adjacencyGraph.push(neighbors);
}

export const LOT_DEFINITIONS: readonly LotDefinition[] = Object.freeze(
  rawParcels.map((p) =>
    Object.freeze({
      ...p,
      neighbors: Object.freeze([...adjacencyGraph[p.id]]),
    })
  )
);

export const PLOT_LAYOUT: PlotLayout[] = rawParcels.map((p) => ({
  id: p.id,
  displayId: p.lotNumber,
  block: p.block,
  col: p.col,
  row: p.row,
  x: p.x,
  y: p.y,
}));

export const ADJACENCY_GRAPH: readonly (readonly number[])[] = Object.freeze(
  adjacencyGraph.map((list) => Object.freeze([...list]))
);

export function plotNeighbors(id: number): number[] {
  if (id < 0 || id >= TOTAL_LOTS) return [];
  return [...adjacencyGraph[id]];
}

export function getLotDefinition(lotId: number): LotDefinition {
  if (lotId < 0 || lotId >= TOTAL_LOTS) {
    throw new Error(`Lot ID ${lotId} out of bounds (expected 0 to ${TOTAL_LOTS - 1})`);
  }
  return LOT_DEFINITIONS[lotId];
}

export function getLotByNumber(lotNumber: number): LotDefinition | undefined {
  if (lotNumber < 1 || lotNumber > TOTAL_LOTS) {
    return undefined;
  }
  return LOT_DEFINITIONS[lotNumber - 1];
}

export function getLotsInDistrict(districtId: DistrictId): readonly LotDefinition[] {
  if (districtId < 0 || districtId >= TOTAL_DISTRICTS) {
    throw new Error(`District ID ${districtId} out of bounds (expected 0 to ${TOTAL_DISTRICTS - 1})`);
  }
  return LOT_DEFINITIONS.filter((lot) => lot.block === districtId);
}

export function getNeighbors(lotId: number): readonly number[] {
  if (lotId < 0 || lotId >= TOTAL_LOTS) {
    throw new Error(`Lot ID ${lotId} out of bounds (expected 0 to ${TOTAL_LOTS - 1})`);
  }
  return ADJACENCY_GRAPH[lotId];
}

export function areOrthogonallyAdjacent(lotIdA: number, lotIdB: number): boolean {
  if (lotIdA < 0 || lotIdA >= TOTAL_LOTS || lotIdB < 0 || lotIdB >= TOTAL_LOTS) {
    return false;
  }
  return ADJACENCY_GRAPH[lotIdA].includes(lotIdB);
}

export function getLotPixelCoordinates(lotId: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const lot = getLotDefinition(lotId);
  return {
    x: lot.x,
    y: lot.y,
    width: CELL_SIZE,
    height: CELL_SIZE,
  };
}

export function calculateClusterIncome(shopType: number, count: number): number {
  if (count <= 0) return 0;
  if (shopType < 0 || shopType >= SHOP_TARGET_SIZES.length) {
    throw new Error(`Invalid shop type ${shopType}`);
  }
  const target = SHOP_TARGET_SIZES[shopType];
  const completeCount = Math.floor(count / target);
  const remainder = count % target;
  const completeBonus = completeCount * (COMPLETE_PAYOUTS[target] || 0);
  const incompleteReward = INCOMPLETE_PAYOUTS[remainder] || 0;
  return completeBonus + incompleteReward;
}

export function findClusterAtLot(
  lots: readonly LotState[],
  lotId: number
): ShopCluster | null {
  if (lotId < 0 || lotId >= TOTAL_LOTS) {
    throw new Error(`Lot ID ${lotId} out of bounds`);
  }
  const targetLot = lots[lotId];
  if (targetLot.owner === null || targetLot.shop === null) {
    return null;
  }

  const targetOwner = targetLot.owner;
  const targetShop = targetLot.shop;
  const targetBlock = LOT_DEFINITIONS[lotId].block;

  const visited = new Set<number>([lotId]);
  const queue = [lotId];
  const clusterLots: number[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    clusterLots.push(current);

    for (const neighborId of ADJACENCY_GRAPH[current]) {
      if (visited.has(neighborId)) continue;
      const neighborLot = lots[neighborId];
      if (
        neighborLot.owner === targetOwner &&
        neighborLot.shop === targetShop &&
        LOT_DEFINITIONS[neighborId].block === targetBlock
      ) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  clusterLots.sort((a, b) => a - b);
  const targetSize = SHOP_TARGET_SIZES[targetShop];
  const isComplete = clusterLots.length >= targetSize;
  const annualIncome = calculateClusterIncome(targetShop, clusterLots.length);

  return {
    playerId: targetOwner,
    shopType: targetShop,
    districtId: targetBlock,
    lots: clusterLots,
    size: clusterLots.length,
    targetSize,
    isComplete,
    annualIncome,
  };
}

export function findAllPlayerClusters(
  lots: readonly LotState[],
  playerId: number
): ShopCluster[] {
  const clusters: ShopCluster[] = [];
  const visited = new Set<number>();

  for (let id = 0; id < TOTAL_LOTS; id++) {
    if (visited.has(id)) continue;
    const lot = lots[id];
    if (lot.owner === playerId && lot.shop !== null) {
      const cluster = findClusterAtLot(lots, id);
      if (cluster) {
        clusters.push(cluster);
        for (const lotId of cluster.lots) {
          visited.add(lotId);
        }
      }
    }
  }

  return clusters;
}

export function findAllClusters(lots: readonly LotState[]): ShopCluster[] {
  const clusters: ShopCluster[] = [];
  const visited = new Set<number>();

  for (let id = 0; id < TOTAL_LOTS; id++) {
    if (visited.has(id)) continue;
    const lot = lots[id];
    if (lot.owner !== null && lot.shop !== null) {
      const cluster = findClusterAtLot(lots, id);
      if (cluster) {
        clusters.push(cluster);
        for (const lotId of cluster.lots) {
          visited.add(lotId);
        }
      }
    }
  }

  return clusters;
}

export function calculatePlayerTotalIncome(
  lots: readonly LotState[],
  playerId: number
): { total: number; clusters: ShopCluster[] } {
  const clusters = findAllPlayerClusters(lots, playerId);
  const total = clusters.reduce((sum, c) => sum + c.annualIncome, 0);
  return { total, clusters };
}

export function canBuildShop(
  lots: readonly LotState[],
  lotId: number,
  playerId: number,
  shopType: number,
  playerTileCount = 1
): BuildValidationResult {
  if (lotId < 0 || lotId >= TOTAL_LOTS) {
    return { valid: false, reason: `Lot ID ${lotId} out of bounds` };
  }
  if (shopType < 0 || shopType >= SHOP_TARGET_SIZES.length) {
    return { valid: false, reason: `Invalid shop type ${shopType}` };
  }
  if (playerTileCount < 1) {
    return { valid: false, reason: 'Player has zero unplaced tiles of this category' };
  }

  const lot = lots[lotId];
  if (lot.owner !== playerId) {
    return { valid: false, reason: 'Player does not own this parcel' };
  }
  if (lot.shop !== null) {
    return { valid: false, reason: 'Parcel already contains an active protocol shop' };
  }

  const targetSize = SHOP_TARGET_SIZES[shopType];
  const neighbors = ADJACENCY_GRAPH[lotId];

  // Discover all unique adjacent clusters belonging to the same player and shop type
  const adjacentClusters: ShopCluster[] = [];
  const processedLots = new Set<number>();

  for (const nId of neighbors) {
    if (processedLots.has(nId)) continue;
    const nLot = lots[nId];
    if (nLot.owner === playerId && nLot.shop === shopType) {
      const cluster = findClusterAtLot(lots, nId);
      if (cluster) {
        adjacentClusters.push(cluster);
        for (const cLotId of cluster.lots) {
          processedLots.add(cLotId);
        }
      }
    }
  }

  // Completed shops cannot be expanded or enlarged
  for (const cluster of adjacentClusters) {
    if (cluster.isComplete) {
      return {
        valid: false,
        reason: `Adjacent ${SHOP_CATEGORIES[shopType].name} cluster is already completed at maximum capacity (${cluster.size}/${targetSize})`,
      };
    }
  }

  // Merging clusters cannot exceed the target capacity
  const mergedSize = 1 + adjacentClusters.reduce((sum, c) => sum + c.size, 0);
  if (mergedSize > targetSize) {
    return {
      valid: false,
      reason: `Resulting merged shop size (${mergedSize}) exceeds maximum capacity (${targetSize})`,
    };
  }

  return {
    valid: true,
    resultingClusterSize: mergedSize,
    isComplete: mergedSize === targetSize,
  };
}
