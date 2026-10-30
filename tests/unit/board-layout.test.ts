/**
 * tests/unit/board-layout.test.ts
 *
 * Comprehensive unit test suite verifying the 72-parcel board geometry,
 * district block bounds, orthogonal adjacency rules, cross-district boundaries,
 * diagonal exclusion, cluster BFS analysis, shop completion criteria,
 * building validation, and non-linear yield calculations.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  TOTAL_LOTS,
  TOTAL_DISTRICTS,
  LOTS_PER_DISTRICT,
  LOT_DEFINITIONS,
  ADJACENCY_GRAPH,
  getLotDefinition,
  getLotByNumber,
  getLotsInDistrict,
  getNeighbors,
  areOrthogonallyAdjacent,
  getLotPixelCoordinates,
  calculateClusterIncome,
  findClusterAtLot,
  findAllPlayerClusters,
  findAllClusters,
  calculatePlayerTotalIncome,
  canBuildShop,
} from '../../src/engine/board-layout';
import type { LotState } from '../../src/engine/board-layout';

describe('Board Layout and Geometry Architecture', () => {
  it('instantiates exactly 72 parcels across 6 distinct districts', () => {
    assert.strictEqual(TOTAL_LOTS, 72);
    assert.strictEqual(TOTAL_DISTRICTS, 6);
    assert.strictEqual(LOTS_PER_DISTRICT, 12);
    assert.strictEqual(LOT_DEFINITIONS.length, 72);
    assert.strictEqual(ADJACENCY_GRAPH.length, 72);

    for (let d = 0; d < 6; d++) {
      const lotsInDistrict = getLotsInDistrict(d as 0 | 1 | 2 | 3 | 4 | 5);
      assert.strictEqual(lotsInDistrict.length, 12);
    }
  });

  it('assigns sequential lot IDs from 0 to 71 and display numbers from 1 to 72', () => {
    for (let id = 0; id < 72; id++) {
      const lot = LOT_DEFINITIONS[id];
      assert.strictEqual(lot.id, id);
      assert.strictEqual(lot.lotNumber, id + 1);

      const byNumber = getLotByNumber(id + 1);
      assert.ok(byNumber);
      assert.strictEqual(byNumber.id, id);
    }

    assert.strictEqual(getLotByNumber(0), undefined);
    assert.strictEqual(getLotByNumber(73), undefined);
    assert.throws(() => getLotDefinition(-1));
    assert.throws(() => getLotDefinition(72));
  });

  it('ensures all parcel bounding boxes fit within the 1100x730 board canvas', () => {
    for (const lot of LOT_DEFINITIONS) {
      const coords = getLotPixelCoordinates(lot.id);
      assert.strictEqual(coords.width, CELL_SIZE);
      assert.strictEqual(coords.height, CELL_SIZE);
      assert.ok(coords.x >= 0, `Lot ${lot.id} x is negative`);
      assert.ok(coords.y >= 0, `Lot ${lot.id} y is negative`);
      assert.ok(coords.x + coords.width <= BOARD_WIDTH, `Lot ${lot.id} exceeds board width`);
      assert.ok(coords.y + coords.height <= BOARD_HEIGHT, `Lot ${lot.id} exceeds board height`);
    }
  });

  it('guarantees bidirectional symmetry for all orthogonal adjacency edges', () => {
    for (let id = 0; id < 72; id++) {
      const neighbors = getNeighbors(id);
      // No self-adjacency
      assert.ok(!neighbors.includes(id), `Lot ${id} contains itself as neighbor`);

      for (const nId of neighbors) {
        assert.ok(areOrthogonallyAdjacent(id, nId));
        assert.ok(areOrthogonallyAdjacent(nId, id));
        const reverseNeighbors = getNeighbors(nId);
        assert.ok(
          reverseNeighbors.includes(id),
          `Asymmetric edge detected between lot ${id} and ${nId}`
        );
      }
    }
  });

  it('verifies all adjacent lots share the same district block', () => {
    for (let id = 0; id < 72; id++) {
      const lot = getLotDefinition(id);
      const neighbors = getNeighbors(id);
      for (const nId of neighbors) {
        const nLot = getLotDefinition(nId);
        assert.strictEqual(
          lot.block,
          nLot.block,
          `Cross-district adjacency edge between lot ${id} (block ${lot.block}) and ${nId} (block ${nLot.block})`
        );
      }
    }
  });

  it('strictly excludes diagonal parcel neighbors across the entire board', () => {
    let diagonalPairsChecked = 0;
    for (let a = 0; a < 72; a++) {
      const lotA = getLotDefinition(a);
      for (let b = 0; b < 72; b++) {
        if (a === b) continue;
        const lotB = getLotDefinition(b);
        if (lotA.block === lotB.block) {
          const dRow = Math.abs(lotA.row - lotB.row);
          const dCol = Math.abs(lotA.col - lotB.col);
          if (dRow === 1 && dCol === 1) {
            diagonalPairsChecked++;
            assert.strictEqual(
              areOrthogonallyAdjacent(a, b),
              false,
              `Diagonal neighbor unexpectedly allowed between ${a} and ${b}`
            );
          }
        }
      }
    }
    assert.strictEqual(diagonalPairsChecked, 144);
  });

  it('strictly isolates parcels across street channels even when geographically close', () => {
    // District 0 Lot 2 and District 1 Lot 12
    assert.strictEqual(areOrthogonallyAdjacent(2, 12), false);

    // District 0 Lot 10 and District 3 Lot 36
    assert.strictEqual(areOrthogonallyAdjacent(10, 36), false);

    // District 1 Lot 21 and District 4 Lot 48
    assert.strictEqual(areOrthogonallyAdjacent(21, 48), false);

    // District 2 Lot 34 and District 5 Lot 60
    assert.strictEqual(areOrthogonallyAdjacent(34, 60), false);
  });

  it('confirms every district block forms a single connected 12-parcel component', () => {
    for (let b = 0; b < 6; b++) {
      const districtLots = getLotsInDistrict(b as 0 | 1 | 2 | 3 | 4 | 5);
      const startLot = districtLots[0].id;
      const visited = new Set<number>([startLot]);
      const queue = [startLot];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const n of getNeighbors(curr)) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }

      assert.strictEqual(visited.size, 12, `District ${b} is disconnected internally`);
    }
  });
});

describe('Cluster Analysis and Connected Component Traversal', () => {
  function makeEmptyBoard(): LotState[] {
    return Array.from({ length: 72 }, (_, id) => ({
      id,
      owner: null,
      shop: null,
    }));
  }

  it('returns null when querying vacant or unowned lots', () => {
    const lots = makeEmptyBoard();
    assert.strictEqual(findClusterAtLot(lots, 0), null);
    lots[0].owner = 0;
    assert.strictEqual(findClusterAtLot(lots, 0), null);
    lots[0].shop = 0;
    lots[0].owner = null;
    assert.strictEqual(findClusterAtLot(lots, 0), null);
  });

  it('computes isolated single-tile shop clusters', () => {
    const lots = makeEmptyBoard();
    lots[0].owner = 1;
    lots[0].shop = 0;

    const cluster = findClusterAtLot(lots, 0);
    assert.ok(cluster);
    assert.strictEqual(cluster.playerId, 1);
    assert.strictEqual(cluster.shopType, 0);
    assert.strictEqual(cluster.districtId, 0);
    assert.deepStrictEqual(cluster.lots, [0]);
    assert.strictEqual(cluster.size, 1);
    assert.strictEqual(cluster.targetSize, 3);
    assert.strictEqual(cluster.isComplete, false);
    assert.strictEqual(cluster.annualIncome, 10);
  });

  it('traverses contiguous orthogonal clusters and detects complete shops', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2] = { id: 2, owner: 0, shop: 0 };

    const clusterFrom0 = findClusterAtLot(lots, 0);
    assert.ok(clusterFrom0);
    assert.strictEqual(clusterFrom0.size, 3);
    assert.strictEqual(clusterFrom0.isComplete, true);
    assert.deepStrictEqual(clusterFrom0.lots, [0, 1, 2]);
    assert.strictEqual(clusterFrom0.annualIncome, 50);

    const clusterFrom1 = findClusterAtLot(lots, 1);
    assert.deepStrictEqual(clusterFrom0, clusterFrom1);
  });

  it('does not merge clusters owned by different players', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 1, shop: 0 };

    const cluster0 = findClusterAtLot(lots, 0);
    const cluster1 = findClusterAtLot(lots, 1);

    assert.ok(cluster0);
    assert.ok(cluster1);
    assert.strictEqual(cluster0.size, 1);
    assert.strictEqual(cluster1.size, 1);
    assert.strictEqual(cluster0.playerId, 0);
    assert.strictEqual(cluster1.playerId, 1);
  });

  it('does not merge adjacent shops of different categories', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 1 };

    const cluster0 = findClusterAtLot(lots, 0);
    const cluster1 = findClusterAtLot(lots, 1);

    assert.ok(cluster0);
    assert.ok(cluster1);
    assert.strictEqual(cluster0.size, 1);
    assert.strictEqual(cluster1.size, 1);
    assert.strictEqual(cluster0.shopType, 0);
    assert.strictEqual(cluster1.shopType, 1);
  });

  it('finds all disjoint clusters for a player and calculates aggregate income', () => {
    const lots = makeEmptyBoard();
    // Cluster 1: DEX Swap complete on lots [0, 1, 2] (payout: 50)
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2] = { id: 2, owner: 0, shop: 0 };

    // Cluster 2: Staking Vault size 2 on lots [10, 11] (payout: 20)
    lots[10] = { id: 10, owner: 0, shop: 2 };
    lots[11] = { id: 11, owner: 0, shop: 2 };

    const playerClusters = findAllPlayerClusters(lots, 0);
    assert.strictEqual(playerClusters.length, 2);

    const income = calculatePlayerTotalIncome(lots, 0);
    assert.strictEqual(income.total, 70);
    assert.strictEqual(income.clusters.length, 2);
  });

  it('finds all active clusters across the entire board', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[12] = { id: 12, owner: 1, shop: 1 };
    lots[13] = { id: 13, owner: 1, shop: 1 };

    const allClusters = findAllClusters(lots);
    assert.strictEqual(allClusters.length, 2);
  });
});

describe('Building Validation and Expansion Prohibition Rules', () => {
  function makeEmptyBoard(): LotState[] {
    return Array.from({ length: 72 }, (_, id) => ({
      id,
      owner: null,
      shop: null,
    }));
  }

  it('rejects placement when player does not own the parcel', () => {
    const lots = makeEmptyBoard();
    lots[0].owner = 1;

    const result = canBuildShop(lots, 0, 0, 0);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason?.includes('does not own'));
  });

  it('rejects placement when parcel is already occupied', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };

    const result = canBuildShop(lots, 0, 0, 0);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason?.includes('already contains'));
  });

  it('rejects placement when player has zero inventory tiles', () => {
    const lots = makeEmptyBoard();
    lots[0].owner = 0;

    const result = canBuildShop(lots, 0, 0, 0, 0);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason?.includes('zero unplaced tiles'));
  });

  it('permits building a new isolated shop on an empty owned lot', () => {
    const lots = makeEmptyBoard();
    lots[0].owner = 0;

    const result = canBuildShop(lots, 0, 0, 0, 1);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.resultingClusterSize, 1);
    assert.strictEqual(result.isComplete, false);
  });

  it('permits expanding an incomplete friendly shop up to maximum capacity', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1].owner = 0;

    const result = canBuildShop(lots, 1, 0, 0, 1);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.resultingClusterSize, 2);
    assert.strictEqual(result.isComplete, false);
  });

  it('permits completing a shop when adding the final required tile', () => {
    const lots = makeEmptyBoard();
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2].owner = 0;

    const result = canBuildShop(lots, 2, 0, 0, 1);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.resultingClusterSize, 3);
    assert.strictEqual(result.isComplete, true);
  });

  it('strictly forbids expanding or enlarging an ALREADY COMPLETED shop', () => {
    const lots = makeEmptyBoard();
    // Complete size 3 DEX Swap on lots 0, 1, 2
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2] = { id: 2, owner: 0, shop: 0 };

    // Lot 4 is adjacent to Lot 0 (South neighbor of 0)
    lots[4].owner = 0;

    const result = canBuildShop(lots, 4, 0, 0, 1);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason?.includes('already completed'));
  });

  it('strictly forbids merging clusters if the merged size exceeds target capacity', () => {
    const lots = makeEmptyBoard();
    // Staking Vault (target size 4)
    // Lots 0, 1: size 2. Lots 3, 7: size 2.
    lots[0] = { id: 0, owner: 0, shop: 2 };
    lots[1] = { id: 1, owner: 0, shop: 2 };
    lots[3] = { id: 3, owner: 0, shop: 2 };
    lots[7] = { id: 7, owner: 0, shop: 2 };

    // Lot 4 is adjacent to both Lot 0 and Lot 3
    lots[4].owner = 0;

    const result = canBuildShop(lots, 4, 0, 2, 1);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason?.includes('exceeds maximum capacity'));
  });

  it('permits merging clusters when the merged size exactly equals target capacity', () => {
    const lots = makeEmptyBoard();
    // Target size 4 (Staking Vault)
    // Cluster A: lot 0 (size 1)
    // Cluster B: lot 3 and lot 7 (size 2)
    lots[0] = { id: 0, owner: 0, shop: 2 };
    lots[3] = { id: 3, owner: 0, shop: 2 };
    lots[7] = { id: 7, owner: 0, shop: 2 };

    // Lot 4 connects lot 0 and lot 3. Merged size: 1 + 1 + 2 = 4
    lots[4].owner = 0;

    const result = canBuildShop(lots, 4, 0, 2, 1);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.resultingClusterSize, 4);
    assert.strictEqual(result.isComplete, true);
  });

  it('allows building a different shop category adjacent to a completed shop', () => {
    const lots = makeEmptyBoard();
    // Complete size 3 DEX Swap on lots 0, 1, 2
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2] = { id: 2, owner: 0, shop: 0 };

    // Lot 4 is adjacent to lot 0, but player builds Memecoin Lounge (shop 1)
    lots[4].owner = 0;

    const result = canBuildShop(lots, 4, 0, 1, 1);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.resultingClusterSize, 1);
    assert.strictEqual(result.isComplete, false);
  });
});

describe('Non-Linear Payout Matrix Calculations', () => {
  it('evaluates exact non-linear payouts across all sizes and categories', () => {
    // Category 0: DEX Swap (target 3)
    assert.strictEqual(calculateClusterIncome(0, 1), 10);
    assert.strictEqual(calculateClusterIncome(0, 2), 20);
    assert.strictEqual(calculateClusterIncome(0, 3), 50);
    assert.strictEqual(calculateClusterIncome(0, 4), 60);
    assert.strictEqual(calculateClusterIncome(0, 5), 70);
    assert.strictEqual(calculateClusterIncome(0, 6), 100);

    // Category 2: Staking Vault (target 4)
    assert.strictEqual(calculateClusterIncome(2, 1), 10);
    assert.strictEqual(calculateClusterIncome(2, 2), 20);
    assert.strictEqual(calculateClusterIncome(2, 3), 40);
    assert.strictEqual(calculateClusterIncome(2, 4), 80);
    assert.strictEqual(calculateClusterIncome(2, 5), 90);
    assert.strictEqual(calculateClusterIncome(2, 8), 160);

    // Category 4: Derivatives Exchange (target 5)
    assert.strictEqual(calculateClusterIncome(4, 1), 10);
    assert.strictEqual(calculateClusterIncome(4, 2), 20);
    assert.strictEqual(calculateClusterIncome(4, 3), 40);
    assert.strictEqual(calculateClusterIncome(4, 4), 60);
    assert.strictEqual(calculateClusterIncome(4, 5), 110);
    assert.strictEqual(calculateClusterIncome(4, 6), 120);
    assert.strictEqual(calculateClusterIncome(4, 10), 220);

    // Category 5: Validator Citadel (target 6)
    assert.strictEqual(calculateClusterIncome(5, 1), 10);
    assert.strictEqual(calculateClusterIncome(5, 2), 20);
    assert.strictEqual(calculateClusterIncome(5, 3), 40);
    assert.strictEqual(calculateClusterIncome(5, 4), 60);
    assert.strictEqual(calculateClusterIncome(5, 5), 80);
    assert.strictEqual(calculateClusterIncome(5, 6), 140);
    assert.strictEqual(calculateClusterIncome(5, 12), 280);
  });

  it('handles edge case inputs gracefully', () => {
    assert.strictEqual(calculateClusterIncome(0, 0), 0);
    assert.strictEqual(calculateClusterIncome(0, -5), 0);
    assert.throws(() => calculateClusterIncome(-1, 3));
    assert.throws(() => calculateClusterIncome(6, 3));
  });
});
