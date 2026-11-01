/**
 * tests/unit/challenger-m11-2.test.ts
 *
 * Empirical Challenger M11.2 Adversarial Stress and Verification Suite.
 * Covers:
 * 1. Capacity validation fuzzing across all 6 shop types (0..5), complete cluster extensions,
 *    bridge tile merges exceeding maximum size, opponent parcel attacks, and unowned parcel attacks.
 * 2. Trade cluster topology recalculation and payout fidelity across complete 3, complete 4,
 *    partial 2, and bilateral multi-parcel exchanges.
 * 3. NetworkRoom multi-capacity (3, 4, 5, 6) concurrency stress, rapid seat reassignments,
 *    and automated match initialization with scalable AI personas.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame,
  draftPlots,
  beginBuild,
  buildTile,
  canPlace,
  groups,
  income,
  executeTrade,
  collectIncome,
  startYear,
  nextYear,
  SHOPS,
  COMPLETE,
  INCOMPLETE,
} from '../../src/engine/engine';
import {
  canBuildShop,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
  ADJACENCY_GRAPH,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
} from '../../src/engine/board-layout';
import {
  NetworkRoom,
  MemoryTransportHub,
} from '../../src/network/room';
import type { GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createRng(seed = 424242): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Challenger M11.2 Task 1: Capacity Validation Fuzzing', () => {
  it('strictly rejects adjacent placement for completed clusters across ALL shop types 0 through 5', () => {
    const rng = createRng(1001);

    for (let shopType = 0; shopType < 6; shopType++) {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      const targetSize = SHOP_TARGET_SIZES[shopType];
      const shopName = SHOP_CATEGORIES[shopType].name;

      // In District 0:
      // Row 0: lot 0 (col 1), lot 1 (col 2), lot 2 (col 3)
      // Row 1: lot 3 (col 0), lot 4 (col 1), lot 5 (col 2), lot 6 (col 3)
      // Row 2: lot 7 (col 0), lot 8 (col 1), lot 9 (col 2)
      // Row 3: lot 10 (col 0), lot 11 (col 1)

      let clusterLots: number[] = [];
      let adjacentLot = -1;

      if (targetSize === 3) {
        // Shop 0 and 1: target 3. Cluster on lots 0, 1, 2. Adjacent lot 4 (adjacent to lot 0).
        clusterLots = [0, 1, 2];
        adjacentLot = 4;
      } else if (targetSize === 4) {
        // Shop 2 and 3: target 4. Cluster on lots 0, 1, 4, 5 (2x2 square). Adjacent lot 2 (adjacent to lot 1).
        clusterLots = [0, 1, 4, 5];
        adjacentLot = 2;
      } else if (targetSize === 5) {
        // Shop 4: target 5. Cluster on lots 0, 1, 2, 5, 6. Adjacent lot 4 (adjacent to lots 0 and 5).
        clusterLots = [0, 1, 2, 5, 6];
        adjacentLot = 4;
      } else if (targetSize === 6) {
        // Shop 5: target 6. Cluster on lots 0, 1, 2, 4, 5, 6. Adjacent lot 3 (adjacent to lot 4).
        clusterLots = [0, 1, 2, 4, 5, 6];
        adjacentLot = 3;
      }

      // Populate cluster lots for Player 0
      for (const id of clusterLots) {
        state.lots[id].owner = 0;
        state.lots[id].shop = shopType;
        state.lots[id].shopSize = targetSize;
        state.lots[id].isComplete = true;
      }

      // Configure adjacent empty lot owned by Player 0
      state.lots[adjacentLot].owner = 0;
      state.lots[adjacentLot].shop = null;
      state.lots[adjacentLot].isComplete = false;

      // Ensure player has inventory tiles of this shop type
      state.players[0].tiles[shopType] = 10;

      // 1. Verify canBuildShop returns invalid with descriptive reason
      const validation = canBuildShop(state.lots, adjacentLot, 0, shopType, 10);
      assert.strictEqual(
        validation.valid,
        false,
        `canBuildShop must reject expanding completed ${shopName} cluster`
      );
      assert.ok(
        validation.reason?.includes('already completed at maximum capacity'),
        `Validation reason must state completed capacity for ${shopName}: received "${validation.reason}"`
      );
      assert.ok(
        validation.reason?.includes(shopName),
        `Validation reason must include category name ${shopName}: received "${validation.reason}"`
      );

      // 2. Verify engine canPlace parity
      const canPlaceResult = canPlace(state, 0, adjacentLot, shopType);
      assert.strictEqual(
        canPlaceResult,
        false,
        `canPlace must return false for completed ${shopName} expansion`
      );

      // 3. Verify buildTile throws descriptive error and appends log
      assert.throws(
        () => buildTile(state, 0, adjacentLot, shopType),
        new RegExp(`Adjacent ${shopName} cluster is already completed at maximum capacity`),
        `buildTile must throw descriptive error for ${shopName}`
      );

      assert.ok(
        state.logs.some((l) => l.includes(`Build rejected on Parcel ${adjacentLot + 1}`)),
        `state.logs must record descriptive rejection on Parcel ${adjacentLot + 1}`
      );
    }
  });

  it('strictly rejects bridge tiles that merge separate clusters into oversized topologies', () => {
    const rng = createRng(1002);

    // Test Case A: Shop 0 (target 3).
    // Cluster 1 on lots 0, 1 (size 2).
    // Cluster 2 on lots 7, 8 (size 2).
    // Bridge on lot 4 (adjacent to lot 0 and lot 8).
    // Resulting merged size: 2 + 2 + 1 = 5 > 3.
    {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      state.lots[0].owner = 0;
      state.lots[0].shop = 0;
      state.lots[1].owner = 0;
      state.lots[1].shop = 0;

      state.lots[7].owner = 0;
      state.lots[7].shop = 0;
      state.lots[8].owner = 0;
      state.lots[8].shop = 0;

      state.lots[4].owner = 0;
      state.lots[4].shop = null;
      state.players[0].tiles[0] = 5;

      const validation = canBuildShop(state.lots, 4, 0, 0, 5);
      assert.strictEqual(validation.valid, false);
      assert.ok(
        validation.reason?.includes('Resulting merged shop size (5) exceeds maximum capacity (3)'),
        `Unexpected rejection reason: ${validation.reason}`
      );
      assert.strictEqual(canPlace(state, 0, 4, 0), false);
      assert.throws(
        () => buildTile(state, 0, 4, 0),
        /Resulting merged shop size \(5\) exceeds maximum capacity \(3\)/
      );
    }

    // Test Case B: Shop 0 (target 3).
    // Cluster 1 on lots 0, 1 (size 2).
    // Cluster 2 on lot 8 (size 1).
    // Bridge on lot 4 (adjacent to 0 and 8).
    // Resulting merged size: 2 + 1 + 1 = 4 > 3.
    {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      state.lots[0].owner = 0;
      state.lots[0].shop = 0;
      state.lots[1].owner = 0;
      state.lots[1].shop = 0;

      state.lots[8].owner = 0;
      state.lots[8].shop = 0;

      state.lots[4].owner = 0;
      state.lots[4].shop = null;
      state.players[0].tiles[0] = 5;

      const validation = canBuildShop(state.lots, 4, 0, 0, 5);
      assert.strictEqual(validation.valid, false);
      assert.ok(
        validation.reason?.includes('Resulting merged shop size (4) exceeds maximum capacity (3)'),
        `Unexpected rejection reason: ${validation.reason}`
      );
      assert.strictEqual(canPlace(state, 0, 4, 0), false);
      assert.throws(
        () => buildTile(state, 0, 4, 0),
        /Resulting merged shop size \(4\) exceeds maximum capacity \(3\)/
      );
    }

    // Test Case C: Shop 2 (target 4).
    // Cluster 1 on lots 0, 1, 2 (size 3).
    // Cluster 2 on lots 7, 8 (size 2).
    // Bridge on lot 4 (adjacent to 0 and 8).
    // Resulting merged size: 3 + 2 + 1 = 6 > 4.
    {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      state.lots[0].owner = 0;
      state.lots[0].shop = 2;
      state.lots[1].owner = 0;
      state.lots[1].shop = 2;
      state.lots[2].owner = 0;
      state.lots[2].shop = 2;

      state.lots[7].owner = 0;
      state.lots[7].shop = 2;
      state.lots[8].owner = 0;
      state.lots[8].shop = 2;

      state.lots[4].owner = 0;
      state.lots[4].shop = null;
      state.players[0].tiles[2] = 5;

      const validation = canBuildShop(state.lots, 4, 0, 2, 5);
      assert.strictEqual(validation.valid, false);
      assert.ok(
        validation.reason?.includes('Resulting merged shop size (6) exceeds maximum capacity (4)'),
        `Unexpected rejection reason: ${validation.reason}`
      );
      assert.strictEqual(canPlace(state, 0, 4, 2), false);
      assert.throws(
        () => buildTile(state, 0, 4, 2),
        /Resulting merged shop size \(6\) exceeds maximum capacity \(4\)/
      );
    }

    // Test Case D: Shop 4 (target 5).
    // Cluster 1 on lots 0, 1, 2 (size 3).
    // Cluster 2 on lots 7, 8, 9 (size 3).
    // Bridge on lot 5 (adjacent to 1 and 9).
    // Resulting merged size: 3 + 3 + 1 = 7 > 5.
    {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      state.lots[0].owner = 0;
      state.lots[0].shop = 4;
      state.lots[1].owner = 0;
      state.lots[1].shop = 4;
      state.lots[2].owner = 0;
      state.lots[2].shop = 4;

      state.lots[7].owner = 0;
      state.lots[7].shop = 4;
      state.lots[8].owner = 0;
      state.lots[8].shop = 4;
      state.lots[9].owner = 0;
      state.lots[9].shop = 4;

      state.lots[5].owner = 0;
      state.lots[5].shop = null;
      state.players[0].tiles[4] = 5;

      const validation = canBuildShop(state.lots, 5, 0, 4, 5);
      assert.strictEqual(validation.valid, false);
      assert.ok(
        validation.reason?.includes('Resulting merged shop size (7) exceeds maximum capacity (5)'),
        `Unexpected rejection reason: ${validation.reason}`
      );
      assert.strictEqual(canPlace(state, 0, 5, 4), false);
      assert.throws(
        () => buildTile(state, 0, 5, 4),
        /Resulting merged shop size \(7\) exceeds maximum capacity \(5\)/
      );
    }

    // Test Case E: Shop 5 (target 6).
    // Cluster 1 on lots 0, 1, 2 (size 3).
    // Cluster 2 on lots 3, 7, 8, 10 (size 4).
    // Bridge on lot 4 (adjacent to 0, 3, 8).
    // Resulting merged size: 3 + 4 + 1 = 8 > 6.
    {
      const state = createGame(undefined, rng);
      state.phase = 'build';
      state.lots[0].owner = 0;
      state.lots[0].shop = 5;
      state.lots[1].owner = 0;
      state.lots[1].shop = 5;
      state.lots[2].owner = 0;
      state.lots[2].shop = 5;

      state.lots[3].owner = 0;
      state.lots[3].shop = 5;
      state.lots[7].owner = 0;
      state.lots[7].shop = 5;
      state.lots[8].owner = 0;
      state.lots[8].shop = 5;
      state.lots[10].owner = 0;
      state.lots[10].shop = 5;

      state.lots[4].owner = 0;
      state.lots[4].shop = null;
      state.players[0].tiles[5] = 5;

      const validation = canBuildShop(state.lots, 4, 0, 5, 5);
      assert.strictEqual(validation.valid, false);
      assert.ok(
        validation.reason?.includes('Resulting merged shop size (8) exceeds maximum capacity (6)'),
        `Unexpected rejection reason: ${validation.reason}`
      );
      assert.strictEqual(canPlace(state, 0, 4, 5), false);
      assert.throws(
        () => buildTile(state, 0, 4, 5),
        /Resulting merged shop size \(8\) exceeds maximum capacity \(6\)/
      );
    }
  });

  it('rejects placement on opponent parcels, unowned parcels, occupied parcels, and zero inventory', () => {
    const rng = createRng(1003);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // 1. Unowned parcel (owner === null)
    state.lots[10].owner = null;
    state.lots[10].shop = null;
    state.players[0].tiles[0] = 3;
    const unownedVal = canBuildShop(state.lots, 10, 0, 0, 3);
    assert.strictEqual(unownedVal.valid, false);
    assert.strictEqual(unownedVal.reason, 'Player does not own this parcel');
    assert.strictEqual(canPlace(state, 0, 10, 0), false);
    assert.throws(() => buildTile(state, 0, 10, 0), /Player does not own this parcel/);

    // 2. Opponent parcel (owner === 1)
    state.lots[11].owner = 1;
    state.lots[11].shop = null;
    const opponentVal = canBuildShop(state.lots, 11, 0, 0, 3);
    assert.strictEqual(opponentVal.valid, false);
    assert.strictEqual(opponentVal.reason, 'Player does not own this parcel');
    assert.strictEqual(canPlace(state, 0, 11, 0), false);
    assert.throws(() => buildTile(state, 0, 11, 0), /Player does not own this parcel/);

    // 3. Occupied parcel (owner === 0, but shop !== null)
    state.lots[12].owner = 0;
    state.lots[12].shop = 1;
    const occupiedVal = canBuildShop(state.lots, 12, 0, 0, 3);
    assert.strictEqual(occupiedVal.valid, false);
    assert.strictEqual(occupiedVal.reason, 'Parcel already contains an active protocol shop');
    assert.strictEqual(canPlace(state, 0, 12, 0), false);
    assert.throws(
      () => buildTile(state, 0, 12, 0),
      /Parcel already contains an active protocol shop/
    );

    // 4. Zero inventory in player hand
    state.lots[13].owner = 0;
    state.lots[13].shop = null;
    state.players[0].tiles[0] = 0;
    const zeroTilesVal = canBuildShop(state.lots, 13, 0, 0, 0);
    assert.strictEqual(zeroTilesVal.valid, false);
    assert.strictEqual(zeroTilesVal.reason, 'Player has zero unplaced tiles of this category');
    assert.strictEqual(canPlace(state, 0, 13, 0), false);
    assert.throws(
      () => buildTile(state, 0, 13, 0),
      /Player has zero unplaced tiles of this category/
    );

    // 5. Out of bounds lot and shop indices
    assert.strictEqual(canBuildShop(state.lots, -1, 0, 0, 1).valid, false);
    assert.strictEqual(canBuildShop(state.lots, 72, 0, 0, 1).valid, false);
    assert.strictEqual(canBuildShop(state.lots, 0, 0, -1, 1).valid, false);
    assert.strictEqual(canBuildShop(state.lots, 0, 0, 6, 1).valid, false);
  });

  it('permits valid builds that extend partial clusters or complete clusters exactly', () => {
    const rng = createRng(1004);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // Initial lot 0 has shop 0 (size 1 of 3)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = false;

    // Extend onto adjacent lot 1 (size becomes 2 of 3)
    state.lots[1].owner = 0;
    state.lots[1].shop = null;
    state.players[0].tiles[0] = 2;

    const partialVal = canBuildShop(state.lots, 1, 0, 0, 2);
    assert.strictEqual(partialVal.valid, true);
    assert.strictEqual(partialVal.resultingClusterSize, 2);
    assert.strictEqual(partialVal.isComplete, false);
    assert.strictEqual(canPlace(state, 0, 1, 0), true);

    buildTile(state, 0, 1, 0);
    assert.strictEqual(state.lots[0].isComplete, false);
    assert.strictEqual(state.lots[1].isComplete, false);

    // Extend onto adjacent lot 2 (size becomes 3 of 3: complete!)
    state.lots[2].owner = 0;
    state.lots[2].shop = null;

    const completeVal = canBuildShop(state.lots, 2, 0, 0, 1);
    assert.strictEqual(completeVal.valid, true);
    assert.strictEqual(completeVal.resultingClusterSize, 3);
    assert.strictEqual(completeVal.isComplete, true);
    assert.strictEqual(canPlace(state, 0, 2, 0), true);

    buildTile(state, 0, 2, 0);
    assert.strictEqual(state.lots[0].isComplete, true);
    assert.strictEqual(state.lots[1].isComplete, true);
    assert.strictEqual(state.lots[2].isComplete, true);
  });

  it('rejects placement adjacent to multiple completed clusters of the same category', () => {
    const rng = createRng(1005);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // Cluster 1: lots 0, 1, 2 with shop 0 (complete 3)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = true;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[1].isComplete = true;
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[2].isComplete = true;

    // Cluster 2: lots 7, 8, 9 with shop 0 (complete 3)
    state.lots[7].owner = 0;
    state.lots[7].shop = 0;
    state.lots[7].isComplete = true;
    state.lots[8].owner = 0;
    state.lots[8].shop = 0;
    state.lots[8].isComplete = true;
    state.lots[9].owner = 0;
    state.lots[9].shop = 0;
    state.lots[9].isComplete = true;

    // Lot 4 is adjacent to lot 0 and lot 8
    state.lots[4].owner = 0;
    state.lots[4].shop = null;
    state.players[0].tiles[0] = 5;

    const val = canBuildShop(state.lots, 4, 0, 0, 5);
    assert.strictEqual(val.valid, false);
    assert.ok(val.reason?.includes('already completed at maximum capacity'));
    assert.strictEqual(canPlace(state, 0, 4, 0), false);
    assert.throws(() => buildTile(state, 0, 4, 0), /already completed at maximum capacity/);
  });
});

describe('Challenger M11.2 Task 2: Trade Cluster Recalculation & Payout Fidelity', () => {
  it('correctly updates isComplete and payouts during complete-3 parcel trade cycle', () => {
    const rng = createRng(2001);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 starts with complete 3 cluster on lots 0, 1, 2 (shop 0, target 3)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = true;

    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[1].isComplete = true;

    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[2].isComplete = true;

    // Verify baseline payouts
    assert.strictEqual(income(state, 0), COMPLETE[3]); // 50
    assert.strictEqual(income(state, 1), 0);

    // Trade 1: Player 0 gifts middle lot 1 to Player 1 (free asset for Sherwood bot: always accepted)
    const offer1: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };

    const tradeRes1 = executeTrade(state, offer1);
    assert.strictEqual(tradeRes1.evaluation.accepted, true);

    // Immediate post-trade checks
    assert.strictEqual(state.lots[1].owner, 1);
    assert.strictEqual(state.lots[1].isComplete, false);

    // Lots 0 and 2 are not adjacent, so Player 0 now has two separate clusters of size 1
    assert.strictEqual(state.lots[0].isComplete, false);
    assert.strictEqual(state.lots[2].isComplete, false);

    const p0GroupsAfterTrade1 = groups(state, 0);
    assert.strictEqual(p0GroupsAfterTrade1.length, 2);
    assert.deepStrictEqual(p0GroupsAfterTrade1[0].lots, [0]);
    assert.strictEqual(p0GroupsAfterTrade1[0].isComplete, false);
    assert.strictEqual(p0GroupsAfterTrade1[0].payout, INCOMPLETE[1]); // 10
    assert.deepStrictEqual(p0GroupsAfterTrade1[1].lots, [2]);
    assert.strictEqual(p0GroupsAfterTrade1[1].isComplete, false);
    assert.strictEqual(p0GroupsAfterTrade1[1].payout, INCOMPLETE[1]); // 10

    // Total income for Player 0: 10 + 10 = 20
    assert.strictEqual(income(state, 0), 20);

    // Player 1 has lot 1 (size 1)
    const p1GroupsAfterTrade1 = groups(state, 1);
    assert.strictEqual(p1GroupsAfterTrade1.length, 1);
    assert.deepStrictEqual(p1GroupsAfterTrade1[0].lots, [1]);
    assert.strictEqual(p1GroupsAfterTrade1[0].isComplete, false);
    assert.strictEqual(p1GroupsAfterTrade1[0].payout, INCOMPLETE[1]); // 10
    assert.strictEqual(income(state, 1), 10);

    // Trade 2: Player 0 buys lot 1 back from Player 1 with sufficient cash premium (300 cash)
    state.players[0].cash = 1000;
    const offer2: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 300, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
    };

    const tradeRes2 = executeTrade(state, offer2);
    assert.strictEqual(tradeRes2.evaluation.accepted, true);

    // Immediate post-trade checks
    assert.strictEqual(state.lots[1].owner, 0);
    assert.strictEqual(state.lots[0].isComplete, true);
    assert.strictEqual(state.lots[1].isComplete, true);
    assert.strictEqual(state.lots[2].isComplete, true);

    const p0GroupsAfterTrade2 = groups(state, 0);
    assert.strictEqual(p0GroupsAfterTrade2.length, 1);
    assert.deepStrictEqual(p0GroupsAfterTrade2[0].lots, [0, 1, 2]);
    assert.strictEqual(p0GroupsAfterTrade2[0].isComplete, true);
    assert.strictEqual(p0GroupsAfterTrade2[0].payout, COMPLETE[3]); // 50
    assert.strictEqual(income(state, 0), 50);

    // Player 1 has 0 lots
    assert.strictEqual(income(state, 1), 0);
  });

  it('correctly updates isComplete and payouts during complete-4 parcel trade sequence', () => {
    const rng = createRng(2002);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 owns 2x2 grid on lots 0, 1, 4, 5 with shop 2 (target 4)
    // Adjacent pairs: (0,1), (0,4), (1,5), (4,5)
    for (const lid of [0, 1, 4, 5]) {
      state.lots[lid].owner = 0;
      state.lots[lid].shop = 2;
      state.lots[lid].shopSize = 4;
      state.lots[lid].isComplete = true;
    }

    assert.strictEqual(income(state, 0), COMPLETE[4]); // 80
    assert.strictEqual(income(state, 1), 0);

    // Step 1: Player 0 gives corner lot 4 to Player 1
    const res1 = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [4] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    });
    assert.strictEqual(res1.evaluation.accepted, true);

    // Player 0 now has lots 0, 1, 5. Connected path 0-1-5 of size 3 (incomplete, target 4)
    assert.strictEqual(state.lots[4].owner, 1);
    assert.strictEqual(state.lots[4].isComplete, false);
    for (const lid of [0, 1, 5]) {
      assert.strictEqual(state.lots[lid].isComplete, false);
    }
    assert.strictEqual(income(state, 0), INCOMPLETE[3]); // 40
    assert.strictEqual(income(state, 1), INCOMPLETE[1]); // 10

    // Step 2: Player 0 gives lot 5 to Player 1
    const res2 = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [5] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    });
    assert.strictEqual(res2.evaluation.accepted, true);

    // Player 0 has lots 0, 1 (adjacent, size 2, incomplete). Income = INCOMPLETE[2] = 20
    // Player 1 has lots 4, 5 (adjacent, size 2, incomplete). Income = INCOMPLETE[2] = 20
    assert.strictEqual(income(state, 0), INCOMPLETE[2]); // 20
    assert.strictEqual(income(state, 1), INCOMPLETE[2]); // 20
    for (const lid of [0, 1, 4, 5]) {
      assert.strictEqual(state.lots[lid].isComplete, false);
    }

    // Step 3: Player 0 buys both lots 4 and 5 back from Player 1 with premium cash (400 cash)
    state.players[0].cash = 1000;
    const res3 = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 400, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [4, 5] },
    });
    assert.strictEqual(res3.evaluation.accepted, true);

    // Player 0 now has all 4 lots again. Re-formed complete cluster of size 4!
    for (const lid of [0, 1, 4, 5]) {
      assert.strictEqual(state.lots[lid].owner, 0);
      assert.strictEqual(state.lots[lid].isComplete, true);
    }
    assert.strictEqual(income(state, 0), COMPLETE[4]); // 80
    assert.strictEqual(income(state, 1), 0);
  });

  it('correctly handles bilateral parcel swaps and payout harvesting integration', () => {
    const rng = createRng(2003);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 owns lot 0 (shop 0, target 3) and lot 7 (shop 1, target 3)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = false;

    state.lots[7].owner = 0;
    state.lots[7].shop = 1;
    state.lots[7].isComplete = false;

    // Player 1 owns lot 1 (shop 0, target 3, adjacent to lot 0) and lot 8 (shop 1, target 3, adjacent to lot 7)
    state.lots[1].owner = 1;
    state.lots[1].shop = 0;
    state.lots[1].isComplete = false;

    state.lots[8].owner = 1;
    state.lots[8].shop = 1;
    state.lots[8].isComplete = false;

    // Bilateral swap: Player 0 gives lot 7 (shop 1) to Player 1, and Player 1 gives lot 1 (shop 0) to Player 0
    // Result:
    // Player 0 gets lots 0 and 1 (both shop 0, adjacent, cluster size 2, target 3)
    // Player 1 gets lots 7 and 8 (both shop 1, adjacent, cluster size 2, target 3)
    state.players[0].cash = 100;
    state.players[1].cash = 100;

    const res = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [7] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
    });
    assert.strictEqual(res.evaluation.accepted, true);

    assert.strictEqual(state.lots[0].owner, 0);
    assert.strictEqual(state.lots[1].owner, 0);
    assert.strictEqual(state.lots[7].owner, 1);
    assert.strictEqual(state.lots[8].owner, 1);

    const p0Groups = groups(state, 0);
    assert.strictEqual(p0Groups.length, 1);
    assert.deepStrictEqual(p0Groups[0].lots, [0, 1]);
    assert.strictEqual(p0Groups[0].size, 2);
    assert.strictEqual(p0Groups[0].payout, INCOMPLETE[2]); // 20

    const p1Groups = groups(state, 1);
    assert.strictEqual(p1Groups.length, 1);
    assert.deepStrictEqual(p1Groups[0].lots, [7, 8]);
    assert.strictEqual(p1Groups[0].size, 2);
    assert.strictEqual(p1Groups[0].payout, INCOMPLETE[2]); // 20

    // Now advance to build and collectIncome to verify exact cash harvest
    beginBuild(state);
    assert.strictEqual(state.phase, 'build');

    const initialP0Cash = state.players[0].cash;
    const initialP1Cash = state.players[1].cash;

    const { payouts } = collectIncome(state);
    assert.strictEqual(payouts[0], 20);
    assert.strictEqual(payouts[1], 20);
    assert.strictEqual(state.players[0].cash, initialP0Cash + 20);
    assert.strictEqual(state.players[1].cash, initialP1Cash + 20);
  });

  it('correctly recalculates cluster completeness when severing a 6-lot Validator Citadel into separate subcomponents', () => {
    const rng = createRng(2004);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 owns lots 0, 1, 2, 4, 5, 6 with shop 5 (target 6)
    // Complete 6-lot cluster
    for (const lid of [0, 1, 2, 4, 5, 6]) {
      state.lots[lid].owner = 0;
      state.lots[lid].shop = 5;
      state.lots[lid].shopSize = 6;
      state.lots[lid].isComplete = true;
    }

    assert.strictEqual(income(state, 0), COMPLETE[6]); // 140

    // Cut 1: Player 0 gives lot 5 to Player 1 (middle hub)
    // Remaining for Player 0: [0, 1, 2, 4, 6]
    // They are still connected via row 0 (0-1-2) with branches down to 4 (from 0) and 6 (from 2)
    const cut1 = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [5] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    });
    assert.strictEqual(cut1.evaluation.accepted, true);

    // Verify all remaining lots 0, 1, 2, 4, 6 have isComplete === false
    for (const lid of [0, 1, 2, 4, 6]) {
      assert.strictEqual(state.lots[lid].isComplete, false);
    }
    assert.strictEqual(state.lots[5].isComplete, false);

    const p0GroupsCut1 = groups(state, 0);
    assert.strictEqual(p0GroupsCut1.length, 1);
    assert.strictEqual(p0GroupsCut1[0].size, 5);
    assert.strictEqual(p0GroupsCut1[0].isComplete, false);
    assert.strictEqual(p0GroupsCut1[0].payout, INCOMPLETE[5]); // 80
    assert.strictEqual(income(state, 0), 80);
    assert.strictEqual(income(state, 1), INCOMPLETE[1]); // 10

    // Cut 2: Player 0 also gives lot 1 to Player 1
    // Now Player 0 has [0, 4] and [2, 6], which are completely disconnected from each other
    const cut2 = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    });
    assert.strictEqual(cut2.evaluation.accepted, true);

    for (const lid of [0, 2, 4, 6]) {
      assert.strictEqual(state.lots[lid].isComplete, false);
    }

    const p0GroupsCut2 = groups(state, 0);
    assert.strictEqual(p0GroupsCut2.length, 2);
    assert.strictEqual(p0GroupsCut2[0].size, 2);
    assert.strictEqual(p0GroupsCut2[1].size, 2);
    // Payout: 20 + 20 = 40
    assert.strictEqual(income(state, 0), INCOMPLETE[2] * 2); // 40

    // Player 1 has lots 1 and 5 (adjacent, size 2)
    const p1GroupsCut2 = groups(state, 1);
    assert.strictEqual(p1GroupsCut2.length, 1);
    assert.strictEqual(p1GroupsCut2[0].size, 2);
    assert.strictEqual(income(state, 1), INCOMPLETE[2]); // 20

    // Reconstitution: Player 0 buys back lots 1 and 5 with 600 cash
    state.players[0].cash = 1500;
    const restore = executeTrade(state, {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 600, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1, 5] },
    });
    assert.strictEqual(restore.evaluation.accepted, true);

    for (const lid of [0, 1, 2, 4, 5, 6]) {
      assert.strictEqual(state.lots[lid].owner, 0);
      assert.strictEqual(state.lots[lid].isComplete, true);
    }
    assert.strictEqual(income(state, 0), COMPLETE[6]); // 140
    assert.strictEqual(income(state, 1), 0);
  });

  it('strictly rejects illegal trades violating ownership, duplicate assets, or negative balances', () => {
    const rng = createRng(2005);
    const state = createGame(undefined, rng);
    state.phase = 'trade';
    state.players[0].cash = 100;
    state.players[1].cash = 100;

    // 1. Unowned parcel trade attempt
    assert.throws(
      () =>
        executeTrade(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0] }, // Lot 0 is unowned
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );

    // 2. Duplicate lot in offer
    state.lots[0].owner = 0;
    assert.throws(
      () =>
        executeTrade(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0, 0] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );

    // 3. Cash exceeding liquid balance
    assert.throws(
      () =>
        executeTrade(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 500, tiles: [0, 0, 0, 0, 0, 0], lots: [] }, // Player only has 100
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );

    // 4. Tiles exceeding inventory
    assert.throws(
      () =>
        executeTrade(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [5, 0, 0, 0, 0, 0], lots: [] }, // Player has 0
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /A player cannot trade more shop tiles than they hold/
    );

    // 5. Self-trading
    assert.throws(
      () =>
        executeTrade(state, {
          fromPlayer: 0,
          toPlayer: 0,
          partner: 0,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Choose a trading partner/
    );
  });
});

describe('Challenger M11.2 Task 3: NetworkRoom Multi-Capacity & Concurrency Stress', () => {
  beforeEach(() => {
    MemoryTransportHub.clearAll();
  });

  afterEach(() => {
    MemoryTransportHub.clearAll();
  });

  it('correctly initializes rooms across all capacities 3, 4, 5, 6 and clamps out-of-bounds inputs', () => {
    const capacities = [3, 4, 5, 6];

    for (const cap of capacities) {
      const room = new NetworkRoom({
        roomCode: `ROOM${cap}`,
        localPlayer: { name: `Host${cap}`, address: `0x${cap}` },
        isHost: true,
        maxPlayers: cap,
      });

      assert.strictEqual(room.state.maxPlayers, cap);
      assert.strictEqual(room.state.status, 'lobby');
      assert.strictEqual(room.state.players.length, 1);
      assert.strictEqual(room.state.players[0].seat, 0);
      assert.strictEqual(room.state.players[0].isHost, true);
      assert.strictEqual(room.state.players[0].isReady, true);
      room.stop();
    }

    // Boundary clamping tests
    const roomClampedLow = new NetworkRoom({
      roomCode: 'CLOW',
      localPlayer: { name: 'Low', address: '0x1' },
      maxPlayers: 1, // < 3
    });
    assert.strictEqual(roomClampedLow.state.maxPlayers, 3);
    roomClampedLow.stop();

    const roomClampedHigh = new NetworkRoom({
      roomCode: 'CHIGH',
      localPlayer: { name: 'High', address: '0x1' },
      maxPlayers: 10, // > 6
    });
    assert.strictEqual(roomClampedHigh.state.maxPlayers, 6);
    roomClampedHigh.stop();

    const roomDefault = new NetworkRoom({
      roomCode: 'CDEF',
      localPlayer: { name: 'Default', address: '0x1' },
    });
    assert.strictEqual(roomDefault.state.maxPlayers, 4);
    roomDefault.stop();
  });

  it('enforces seat boundaries dynamically per capacity and rejects seat collisions', async () => {
    // Capacity 3: valid seats 0, 1, 2
    const room3 = new NetworkRoom({
      roomCode: 'SEAT3',
      localPlayer: { name: 'H3', address: '0x3' },
      isHost: true,
      maxPlayers: 3,
    });
    await room3.start();
    room3.setSeat(1);
    assert.strictEqual(room3.getLocalPlayer()?.seat, 1);
    room3.setSeat(2);
    assert.strictEqual(room3.getLocalPlayer()?.seat, 2);
    assert.throws(() => room3.setSeat(3), /Seat index must be 0, 1, or 2/);
    assert.throws(() => room3.setSeat(-1), /Seat index must be 0, 1, or 2/);
    room3.stop();

    // Capacity 4: valid seats 0, 1, 2, 3
    const room4 = new NetworkRoom({
      roomCode: 'SEAT4',
      localPlayer: { name: 'H4', address: '0x4' },
      isHost: true,
      maxPlayers: 4,
    });
    await room4.start();
    room4.setSeat(3);
    assert.strictEqual(room4.getLocalPlayer()?.seat, 3);
    assert.throws(() => room4.setSeat(4), /Seat index must be 0, 1, 2, or 3/);
    room4.stop();

    // Capacity 5: valid seats 0, 1, 2, 3, 4
    const room5 = new NetworkRoom({
      roomCode: 'SEAT5',
      localPlayer: { name: 'H5', address: '0x5' },
      isHost: true,
      maxPlayers: 5,
    });
    await room5.start();
    room5.setSeat(4);
    assert.strictEqual(room5.getLocalPlayer()?.seat, 4);
    assert.throws(() => room5.setSeat(5), /Seat index must be 0, 1, 2, 3, or 4/);
    room5.stop();

    // Capacity 6: valid seats 0, 1, 2, 3, 4, 5
    const room6 = new NetworkRoom({
      roomCode: 'SEAT6',
      localPlayer: { name: 'H6', address: '0x6' },
      isHost: true,
      maxPlayers: 6,
    });
    await room6.start();
    room6.setSeat(5);
    assert.strictEqual(room6.getLocalPlayer()?.seat, 5);
    assert.throws(() => room6.setSeat(6), /Seat index must be 0, 1, 2, 3, 4, or 5/);
    room6.stop();
  });

  it('stress tests rapid seat hopping on vacant seats and prevents collision onto host seat', async () => {
    const capacities = [3, 4, 5, 6];

    for (const cap of capacities) {
      const roomCode = `HOP${cap}`;
      const host = new NetworkRoom({
        roomCode,
        localPlayer: { name: 'Host', address: '0x1000' },
        isHost: true,
        maxPlayers: cap,
      });
      await host.start();

      // Client joins room at seat 1. Seats 2..cap-1 remain vacant!
      const client = new NetworkRoom({
        roomCode,
        localPlayer: { name: 'Jumper', address: '0x2000' },
        isHost: false,
        maxPlayers: cap,
      });
      await client.start();

      // Wait for join synchronization
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.strictEqual(client.getLocalPlayer()?.seat, 1);

      // Rapidly hop across all non-host seats (1 .. cap-1) across 25 hops
      for (let hop = 0; hop < 25; hop++) {
        const targetSeat = (hop % (cap - 1)) + 1;
        client.setSeat(targetSeat);
        assert.strictEqual(client.getLocalPlayer()?.seat, targetSeat);
      }

      // Attempt to take seat 0 (occupied by Host)
      assert.throws(
        () => client.setSeat(0),
        /Seat 0 is already occupied by Host/,
        'Client must be prevented from grabbing occupied seat 0'
      );

      client.stop();
      host.stop();
    }
  });

  it('stress tests match initialization across capacities 3, 4, 5, 6 with automated bot autofill', async () => {
    const capacities = [3, 4, 5, 6];

    for (const cap of capacities) {
      const room = new NetworkRoom({
        roomCode: `MATCH${cap}`,
        localPlayer: { name: 'SoloHost', address: '0x9999' },
        isHost: true,
        maxPlayers: cap,
      });
      await room.start();

      assert.strictEqual(room.state.status, 'lobby');
      assert.strictEqual(room.state.players[0].isReady, true);

      // Start match with SoloHost (remaining seats autofilled by AI bots)
      room.startMatch(123456);

      assert.strictEqual(room.state.status, 'playing');
      assert.ok(room.state.gameState !== null);
      assert.strictEqual(
        room.state.gameState.players.length,
        cap,
        `Game engine state must have exactly ${cap} players`
      );

      // Verify specific bot archetypes filled into match
      if (cap === 3) {
        assert.strictEqual(room.state.gameState.players[0].name, 'SoloHost');
        assert.strictEqual(room.state.gameState.players[1].name, 'Sherwood');
        assert.strictEqual(room.state.gameState.players[2].name, 'Apex');
      } else if (cap === 4) {
        assert.strictEqual(room.state.gameState.players[3].name, 'Luna');
      } else if (cap === 5) {
        assert.strictEqual(room.state.gameState.players[4].name, 'Nexus');
      } else if (cap === 6) {
        assert.strictEqual(room.state.gameState.players[4].name, 'Nexus');
        assert.strictEqual(room.state.gameState.players[5].name, 'Solace');
      }

      room.stop();
    }
  });

  it('handles multi-client ready states and match synchronization', async () => {
    const roomCode = 'READY4';
    const host = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Host', address: '0x10' },
      isHost: true,
      maxPlayers: 4,
    });
    await host.start();

    const client1 = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Alice', address: '0x20' },
      isHost: false,
      maxPlayers: 4,
    });
    await client1.start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Client 1 is seated at seat 1 but not ready yet
    assert.strictEqual(client1.getLocalPlayer()?.seat, 1);
    assert.strictEqual(client1.getLocalPlayer()?.isReady, false);

    // Host attempts to start match prematurely while client is not ready
    assert.throws(
      () => host.startMatch(),
      /All seated players must toggle ready before starting/
    );

    // Non-host attempts to start match
    assert.throws(
      () => client1.startMatch(),
      /Only the room host can start the match/
    );

    // Client toggles ready
    client1.toggleReady(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Host starts match
    host.startMatch(42);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(host.state.status, 'playing');
    assert.strictEqual(client1.state.status, 'playing');
    assert.ok(host.state.gameState !== null);
    assert.ok(client1.state.gameState !== null);
    assert.strictEqual(host.state.gameState.players.length, 4);
    assert.strictEqual(client1.state.gameState.players.length, 4);

    // Clean stop
    client1.stop();
    host.stop();
  });

  it('assigns null spectator seat when room capacity is exceeded by additional joining clients', async () => {
    const roomCode = 'FULL3';
    const host = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Host', address: '0x10' },
      isHost: true,
      maxPlayers: 3,
    });
    await host.start();

    // Client 1 fills seat 1
    const client1 = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'P1', address: '0x20' },
      isHost: false,
      maxPlayers: 3,
    });
    await client1.start();

    // Client 2 fills seat 2
    const client2 = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'P2', address: '0x30' },
      isHost: false,
      maxPlayers: 3,
    });
    await client2.start();

    await new Promise((resolve) => setTimeout(resolve, 60));

    // Client 3 joins when room of capacity 3 is completely full
    const spectator = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Spectator', address: '0x40' },
      isHost: false,
      maxPlayers: 3,
    });
    await spectator.start();

    await new Promise((resolve) => setTimeout(resolve, 60));

    // Spectator seat must be null
    assert.strictEqual(spectator.getLocalPlayer()?.seat, null);

    // Spectator trying to take occupied seat throws error
    assert.throws(
      () => spectator.setSeat(0),
      /Seat 0 is already occupied by Host/
    );

    // Clean teardown
    spectator.stop();
    client2.stop();
    client1.stop();
    host.stop();
  });

  it('enforces that non-host clients cannot dispatch global lifecycle actions or impersonate other players', async () => {
    const roomCode = 'SEC4';
    const host = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Host', address: '0x100' },
      isHost: true,
      maxPlayers: 4,
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode,
      localPlayer: { name: 'Client1', address: '0x200' },
      isHost: false,
      maxPlayers: 4,
    });
    await client.start();

    await new Promise((resolve) => setTimeout(resolve, 50));
    client.toggleReady(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Host starts match
    host.startMatch(999);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Client attempts to dispatch global actions
    assert.throws(
      () => client.dispatchGameAction({ type: 'START_YEAR' }),
      /Only the room host can dispatch global lifecycle action START_YEAR/
    );
    assert.throws(
      () => client.dispatchGameAction({ type: 'BEGIN_BUILD' }),
      /Only the room host can dispatch global lifecycle action BEGIN_BUILD/
    );
    assert.throws(
      () => client.dispatchGameAction({ type: 'COLLECT_INCOME' }),
      /Only the room host can dispatch global lifecycle action COLLECT_INCOME/
    );
    assert.throws(
      () => client.dispatchGameAction({ type: 'NEXT_YEAR' }),
      /Only the room host can dispatch global lifecycle action NEXT_YEAR/
    );

    // Client (seated at 1) attempts to impersonate Player 0 or Player 2
    assert.throws(
      () =>
        client.dispatchGameAction({
          type: 'BUILD_TILE',
          playerId: 0,
          lotId: 10,
          shopType: 0,
        }),
      /Cannot dispatch action for player 0 when seated at 1/
    );

    client.stop();
    host.stop();
  });
});
