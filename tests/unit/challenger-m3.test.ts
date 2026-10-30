/**
 * tests/unit/challenger-m3.test.ts
 *
 * Empirical adversarial stress tests for Milestone 3:
 * 1. Board Topology and Adjacency Graph Invariants (72 parcels, 2556 pairs, 6 districts)
 * 2. Chinatown Building Restrictions (expansion prohibition, cluster merging overflow, illegal lots)
 * 3. AI Bot Trade Negotiation Engine (perspective, margins, counteroffers, insolvency, edge cases)
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  TOTAL_LOTS,
  TOTAL_DISTRICTS,
  LOTS_PER_DISTRICT,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  ADJACENCY_GRAPH,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
  getLotDefinition,
  getLotsInDistrict,
  getNeighbors,
  areOrthogonallyAdjacent,
  getLotPixelCoordinates,
  findClusterAtLot,
  canBuildShop,
  calculateClusterIncome,
  type LotState,
  type DistrictId,
} from '../../src/engine/board-layout';
import {
  BOT_PERSONALITIES,
  getBotPersonality,
  evaluateTradeOffer,
  type BotState,
} from '../../src/engine/bot';
import {
  createGame,
  validateOffer,
  evaluateOffer,
} from '../../src/engine/engine';
import type {
  GameState,
  TradeOffer,
  OfferSide,
} from '../../src/engine/types';

describe('Empirical Challenge 1: Board Topology and Adjacency Invariants', () => {
  it('confirms all 72 parcels have valid sequential IDs, display numbers, and fit within board canvas bounds', () => {
    assert.strictEqual(TOTAL_LOTS, 72);
    assert.strictEqual(TOTAL_DISTRICTS, 6);
    assert.strictEqual(LOTS_PER_DISTRICT, 12);
    assert.strictEqual(LOT_DEFINITIONS.length, 72);
    assert.strictEqual(ADJACENCY_GRAPH.length, 72);

    for (let id = 0; id < 72; id++) {
      const lot = LOT_DEFINITIONS[id];
      assert.strictEqual(lot.id, id);
      assert.strictEqual(lot.lotNumber, id + 1);
      assert.ok(lot.block >= 0 && lot.block < 6);

      const coords = getLotPixelCoordinates(id);
      assert.strictEqual(coords.width, CELL_SIZE);
      assert.strictEqual(coords.height, CELL_SIZE);
      assert.ok(coords.x >= 0, `Parcel ${id} has negative x`);
      assert.ok(coords.y >= 0, `Parcel ${id} has negative y`);
      assert.ok(
        coords.x + coords.width <= BOARD_WIDTH,
        `Parcel ${id} exceeds board canvas width`
      );
      assert.ok(
        coords.y + coords.height <= BOARD_HEIGHT,
        `Parcel ${id} exceeds board canvas height`
      );
    }
  });

  it('stress-tests all 2556 pairwise parcel combinations for cross-district and diagonal isolation', () => {
    const totalPairs = (72 * 71) / 2;
    let pairsChecked = 0;
    let crossDistrictChecks = 0;
    let diagonalChecks = 0;
    let orthogonalChecks = 0;

    for (let i = 0; i < 72; i++) {
      // Self-adjacency must always be false
      assert.strictEqual(
        areOrthogonallyAdjacent(i, i),
        false,
        `Parcel ${i} is self-adjacent`
      );

      const lotA = LOT_DEFINITIONS[i];
      for (let j = i + 1; j < 72; j++) {
        pairsChecked++;
        const lotB = LOT_DEFINITIONS[j];
        const adjacentAB = areOrthogonallyAdjacent(i, j);
        const adjacentBA = areOrthogonallyAdjacent(j, i);

        // Bidirectional symmetry
        assert.strictEqual(
          adjacentAB,
          adjacentBA,
          `Adjacency asymmetry between ${i} and ${j}`
        );

        if (lotA.block !== lotB.block) {
          crossDistrictChecks++;
          assert.strictEqual(
            adjacentAB,
            false,
            `Parcels ${i} (district ${lotA.block}) and ${j} (district ${lotB.block}) are adjacent across district borders`
          );
          assert.ok(
            !getNeighbors(i).includes(j),
            `Parcel ${j} unexpectedly in neighbors list of ${i}`
          );
          assert.ok(
            !getNeighbors(j).includes(i),
            `Parcel ${i} unexpectedly in neighbors list of ${j}`
          );
        } else {
          // Same district
          const dRow = Math.abs(lotA.row-lotB.row);
          const dCol = Math.abs(lotA.col-lotB.col);

          if (dRow === 1 && dCol === 1) {
            diagonalChecks++;
            assert.strictEqual(
              adjacentAB,
              false,
              `Diagonal neighbor allowed between parcels ${i} and ${j} in district ${lotA.block}`
            );
          } else if (dRow + dCol === 1) {
            orthogonalChecks++;
            assert.strictEqual(
              adjacentAB,
              true,
              `Orthogonal neighbor missing between parcels ${i} and ${j} in district ${lotA.block}`
            );
          } else {
            assert.strictEqual(
              adjacentAB,
              false,
              `Non-neighboring parcels ${i} and ${j} marked adjacent in district ${lotA.block}`
            );
          }
        }
      }
    }

    assert.strictEqual(pairsChecked, totalPairs);
    assert.strictEqual(pairsChecked, 2556);
    // 6 districts with 12 parcels each: internal pairs per district is 12*11/2 = 66, so 6*66 = 396 internal pairs
    // Cross-district pairs count: 2556 minus 396 equals 2160
    assert.strictEqual(crossDistrictChecks, 2160);
    // Diagonal pairs in grid: exactly 72 undirected pairs (144 directed pairs)
    assert.strictEqual(diagonalChecks, 72);
    // Total orthogonal edges on board: exactly 93 undirected edges (186 directed edges)
    assert.strictEqual(orthogonalChecks, 93);
  });

  it('asserts each of the 6 districts forms a single connected component of exactly 12 parcels from any starting node', () => {
    for (let districtId = 0; districtId < 6; districtId++) {
      const districtLots = getLotsInDistrict(districtId as DistrictId);
      assert.strictEqual(districtLots.length, 12);
      const districtLotIds = new Set(districtLots.map((l) => l.id));

      // Test BFS reachability starting from every single node in the district
      for (const startNode of districtLots) {
        const visited = new Set<number>([startNode.id]);
        const queue = [startNode.id];

        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const neighborId of getNeighbors(current)) {
            // Must never leak to outside district
            assert.ok(
              districtLotIds.has(neighborId),
              `District ${districtId} leaked to external parcel ${neighborId}`
            );
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        }

        assert.strictEqual(
          visited.size,
          12,
          `District ${districtId} reached only ${visited.size} of 12 parcels starting from lot ${startNode.id}`
        );
      }
    }
  });
});

describe('Empirical Challenge 2: Chinatown Building Restrictions', () => {
  function makeEmptyBoard(): LotState[] {
    return Array.from({ length: 72 }, (_, id) => ({
      id,
      owner: null,
      shop: null,
    }));
  }

  it('rejects adding a 4th tile adjacent to an already completed size-3 DEX Swap', () => {
    const lots = makeEmptyBoard();
    // In District 0: Lot 0 (row 0, col 1), Lot 1 (row 0, col 2), Lot 2 (row 0, col 3)
    // Orthogonal chain: 0 <-> 1 <-> 2
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };
    lots[2] = { id: 2, owner: 0, shop: 0 };

    const initialCluster = findClusterAtLot(lots, 0);
    assert.ok(initialCluster);
    assert.strictEqual(initialCluster.size, 3);
    assert.strictEqual(initialCluster.isComplete, true);
    assert.strictEqual(initialCluster.annualIncome, 50);

    // Lot 4 (row 1, col 1) is adjacent to Lot 0 (orthogonal neighbor)
    assert.ok(areOrthogonallyAdjacent(0, 4));
    lots[4].owner = 0;
    lots[4].shop = null;

    // Attempt to expand completed DEX Swap with a 4th tile
    const attempt = canBuildShop(lots, 4, 0, 0, 1);
    assert.strictEqual(attempt.valid, false);
    assert.ok(
      attempt.reason?.includes('already completed'),
      `Expected reason to mention already completed but got: ${attempt.reason}`
    );
  });

  it('rejects expanding completed shops across all target sizes (sizes 3, 4, 5, 6)', () => {
    const lots = makeEmptyBoard();

    // Test Staking Vault (Shop 2, Target Size 4)
    // Lots in District 0: 0, 1, 4, 5 form a 2x2 connected block
    lots[0] = { id: 0, owner: 0, shop: 2 };
    lots[1] = { id: 1, owner: 0, shop: 2 };
    lots[4] = { id: 4, owner: 0, shop: 2 };
    lots[5] = { id: 5, owner: 0, shop: 2 };

    const vaultCluster = findClusterAtLot(lots, 0);
    assert.ok(vaultCluster);
    assert.strictEqual(vaultCluster.size, 4);
    assert.strictEqual(vaultCluster.isComplete, true);

    // Lot 2 is neighbor to Lot 1
    assert.ok(areOrthogonallyAdjacent(1, 2));
    lots[2].owner = 0;
    const vaultAttempt = canBuildShop(lots, 2, 0, 2, 1);
    assert.strictEqual(vaultAttempt.valid, false);
    assert.ok(vaultAttempt.reason?.includes('already completed'));

    // Test Derivatives Exchange (Shop 4, Target Size 5)
    // Extend with Lot 2
    lots[2] = { id: 2, owner: 0, shop: 4 };
    lots[0] = { id: 0, owner: 0, shop: 4 };
    lots[1] = { id: 1, owner: 0, shop: 4 };
    lots[4] = { id: 4, owner: 0, shop: 4 };
    lots[5] = { id: 5, owner: 0, shop: 4 };
    // Lot 6 is neighbor to Lot 5
    assert.ok(areOrthogonallyAdjacent(5, 6));
    lots[6].owner = 0;
    const derivAttempt = canBuildShop(lots, 6, 0, 4, 1);
    assert.strictEqual(derivAttempt.valid, false);
    assert.ok(derivAttempt.reason?.includes('already completed'));

    // Test Validator Citadel (Shop 5, Target Size 6)
    lots[6] = { id: 6, owner: 0, shop: 5 };
    lots[0] = { id: 0, owner: 0, shop: 5 };
    lots[1] = { id: 1, owner: 0, shop: 5 };
    lots[2] = { id: 2, owner: 0, shop: 5 };
    lots[4] = { id: 4, owner: 0, shop: 5 };
    lots[5] = { id: 5, owner: 0, shop: 5 };
    // Lot 3 is neighbor to Lot 4
    assert.ok(areOrthogonallyAdjacent(4, 3));
    lots[3].owner = 0;
    const valAttempt = canBuildShop(lots, 3, 0, 5, 1);
    assert.strictEqual(valAttempt.valid, false);
    assert.ok(valAttempt.reason?.includes('already completed'));
  });

  it('rejects cluster merging overflow when connecting two incomplete shops exceeds target capacity', () => {
    const lots = makeEmptyBoard();

    // Scenario: Two separate size 2 clusters of DEX Swap (target size 3)
    // Cluster 1: Lot 0 (row 0, col 1) and Lot 1 (row 0, col 2). Size: 2.
    lots[0] = { id: 0, owner: 0, shop: 0 };
    lots[1] = { id: 1, owner: 0, shop: 0 };

    // Cluster 2: Lot 7 (row 2, col 0) and Lot 8 (row 2, col 1). Size: 2.
    lots[7] = { id: 7, owner: 0, shop: 0 };
    lots[8] = { id: 8, owner: 0, shop: 0 };

    // Verify Cluster 1 and Cluster 2 are disjoint and incomplete
    const c1 = findClusterAtLot(lots, 0);
    const c2 = findClusterAtLot(lots, 7);
    assert.ok(c1 && c2);
    assert.strictEqual(c1.size, 2);
    assert.strictEqual(c2.size, 2);
    assert.strictEqual(c1.isComplete, false);
    assert.strictEqual(c2.isComplete, false);

    // Bridge candidate: Lot 4 (row 1, col 1).
    // Lot 4 is adjacent to Lot 0 (Cluster 1) and Lot 8 (Cluster 2).
    assert.ok(areOrthogonallyAdjacent(4, 0));
    assert.ok(areOrthogonallyAdjacent(4, 8));
    lots[4].owner = 0;
    lots[4].shop = null;

    // Merged size would be 2 + 2 + 1 = 5, which exceeds target size 3
    const attempt = canBuildShop(lots, 4, 0, 0, 1);
    assert.strictEqual(attempt.valid, false);
    assert.ok(
      attempt.reason?.includes('exceeds maximum capacity'),
      `Expected reason to mention exceeds maximum capacity but got: ${attempt.reason}`
    );
  });

  it('permits cluster merging when the combined size equals target capacity exactly', () => {
    const lots = makeEmptyBoard();

    // Staking Vault (target size 4)
    // Cluster 1: Lot 0 (size 1)
    lots[0] = { id: 0, owner: 0, shop: 2 };

    // Cluster 2: Lot 7 and Lot 8 (size 2)
    lots[7] = { id: 7, owner: 0, shop: 2 };
    lots[8] = { id: 8, owner: 0, shop: 2 };

    // Bridge Lot 4 (adjacent to Lot 0 and Lot 8)
    // Merged size: 1 + 2 + 1 = 4 (exact target size)
    lots[4].owner = 0;
    lots[4].shop = null;

    const attempt = canBuildShop(lots, 4, 0, 2, 1);
    assert.strictEqual(attempt.valid, true);
    assert.strictEqual(attempt.resultingClusterSize, 4);
    assert.strictEqual(attempt.isComplete, true);
  });

  it('rejects placement on opponent lots, vacant unowned lots, already occupied lots, or with zero inventory', () => {
    const lots = makeEmptyBoard();

    // Opponent parcel
    lots[10].owner = 1;
    const oppAttempt = canBuildShop(lots, 10, 0, 0, 1);
    assert.strictEqual(oppAttempt.valid, false);
    assert.ok(oppAttempt.reason?.includes('does not own'));

    // Unowned parcel
    lots[11].owner = null;
    const unownedAttempt = canBuildShop(lots, 11, 0, 0, 1);
    assert.strictEqual(unownedAttempt.valid, false);
    assert.ok(unownedAttempt.reason?.includes('does not own'));

    // Already occupied parcel
    lots[12].owner = 0;
    lots[12].shop = 0;
    const occAttempt = canBuildShop(lots, 12, 0, 0, 1);
    assert.strictEqual(occAttempt.valid, false);
    assert.ok(occAttempt.reason?.includes('already contains'));

    // Zero unplaced inventory tiles
    lots[13].owner = 0;
    lots[13].shop = null;
    const zeroTilesAttempt = canBuildShop(lots, 13, 0, 0, 0);
    assert.strictEqual(zeroTilesAttempt.valid, false);
    assert.ok(zeroTilesAttempt.reason?.includes('zero unplaced tiles'));

    // Boundary violations
    assert.strictEqual(canBuildShop(lots, -1, 0, 0, 1).valid, false);
    assert.strictEqual(canBuildShop(lots, 72, 0, 0, 1).valid, false);
    assert.strictEqual(canBuildShop(lots, 13, 0, -1, 1).valid, false);
    assert.strictEqual(canBuildShop(lots, 13, 0, 6, 1).valid, false);
  });
});

describe('Empirical Challenge 3: AI Bot Negotiation Engine and Edge Cases', () => {
  const personas = {
    sherwood: { name: 'Sherwood', margin: 1.04 },
    apex: { name: 'Apex', margin: 1.09 },
    luna: { name: 'Luna', margin: 1.01 },
  };

  it('tests trade perspective: rejects when valueReceived < valueSurrendered * margin, accepts when >=', () => {
    const emptyState: BotState = { tiles: {}, lots: {} };

    // Sherwood (margin 1.04). Proposer asks for 100 cash (valueSurrendered = 100).
    // Required value is 100 * 1.04 = 104.
    const offerSherwoodShort = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 103, tiles: [], lots: [] },
      take: { cash: 100, tiles: [], lots: [] },
    };
    const evalSherwoodShort = evaluateTradeOffer(offerSherwoodShort, personas.sherwood, emptyState, 200, 1);
    assert.strictEqual(evalSherwoodShort.accepted, false);
    assert.strictEqual(evalSherwoodShort.shortfall, 1);

    const offerSherwoodExact = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 104, tiles: [], lots: [] },
      take: { cash: 100, tiles: [], lots: [] },
    };
    const evalSherwoodExact = evaluateTradeOffer(offerSherwoodExact, personas.sherwood, emptyState, 200, 1);
    assert.strictEqual(evalSherwoodExact.accepted, true);
    assert.strictEqual(evalSherwoodExact.shortfall, 0);

    const offerSherwoodOver = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 105, tiles: [], lots: [] },
      take: { cash: 100, tiles: [], lots: [] },
    };
    const evalSherwoodOver = evaluateTradeOffer(offerSherwoodOver, personas.sherwood, emptyState, 200, 1);
    assert.strictEqual(evalSherwoodOver.accepted, true);
    assert.strictEqual(evalSherwoodOver.shortfall, 0);

    // Apex (margin 1.09). At valueSurrendered = 300, 300 * 1.09 = 327 (exact integer).
    const apexUnder = {
      fromPlayer: 0,
      toPlayer: 2,
      give: { cash: 326, tiles: [], lots: [] },
      take: { cash: 300, tiles: [], lots: [] },
    };
    const evalApexUnder = evaluateTradeOffer(apexUnder, personas.apex, emptyState, 500, 1);
    assert.strictEqual(evalApexUnder.accepted, false);
    assert.strictEqual(evalApexUnder.shortfall, 1);

    const apexMatch = {
      fromPlayer: 0,
      toPlayer: 2,
      give: { cash: 327, tiles: [], lots: [] },
      take: { cash: 300, tiles: [], lots: [] },
    };
    const evalApexMatch = evaluateTradeOffer(apexMatch, personas.apex, emptyState, 500, 1);
    assert.strictEqual(evalApexMatch.accepted, true);
    assert.strictEqual(evalApexMatch.shortfall, 0);

    const apexOver = {
      fromPlayer: 0,
      toPlayer: 2,
      give: { cash: 328, tiles: [], lots: [] },
      take: { cash: 300, tiles: [], lots: [] },
    };
    const evalApexOver = evaluateTradeOffer(apexOver, personas.apex, emptyState, 500, 1);
    assert.strictEqual(evalApexOver.accepted, true);
    assert.strictEqual(evalApexOver.shortfall, 0);

    // Luna (margin 1.01). At valueSurrendered = 100, 100 * 1.01 = 101.
    const lunaUnder = {
      fromPlayer: 0,
      toPlayer: 3,
      give: { cash: 100, tiles: [], lots: [] },
      take: { cash: 100, tiles: [], lots: [] },
    };
    const evalLunaUnder = evaluateTradeOffer(lunaUnder, personas.luna, emptyState, 200, 1);
    assert.strictEqual(evalLunaUnder.accepted, false);
    assert.strictEqual(evalLunaUnder.shortfall, 1);

    const lunaMatch = {
      fromPlayer: 0,
      toPlayer: 3,
      give: { cash: 101, tiles: [], lots: [] },
      take: { cash: 100, tiles: [], lots: [] },
    };
    const evalLunaMatch = evaluateTradeOffer(lunaMatch, personas.luna, emptyState, 200, 1);
    assert.strictEqual(evalLunaMatch.accepted, true);
    assert.strictEqual(evalLunaMatch.shortfall, 0);
  });

  it('confirms counteroffers top up give.cash by shortfall and NEVER add bot cash to take.cash', () => {
    const emptyState: BotState = { tiles: {}, lots: {} };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 20, tiles: [], lots: [5] },
      take: { cash: 100, tiles: [], lots: [] },
    };

    // valueSurrendered = 100, required = 104
    // valueReceived = 20 + 18 (default lot value) = 38
    // shortfall: 104 minus 38 equals 66
    const evaluation = evaluateTradeOffer(offer, personas.sherwood, emptyState, 200, 1);
    assert.strictEqual(evaluation.accepted, false);
    assert.strictEqual(evaluation.shortfall, 66);
    assert.ok(evaluation.counterOffer);

    // Counteroffer must top up give.cash by shortfall: 20 + 66 = 86
    assert.strictEqual(evaluation.counterOffer.cash, 86);
    // Preserves non-cash give assets
    assert.deepStrictEqual(evaluation.counterOffer.lots, [5]);
    // Bot must NEVER add its own cash to take.cash or reduce requested assets
    assert.strictEqual(offer.take.cash, 100);
  });

  it('suppresses counteroffer when human proposer cannot afford the cash shortfall', () => {
    const emptyState: BotState = { tiles: {}, lots: {} };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 10, tiles: [], lots: [] },
      take: { cash: 50, tiles: [], lots: [] },
    };

    // required = 50 * 1.04 = 52. shortfall = 42. total cash required = 10 + 42 = 52.
    // Case A: Human has 51 cash (1 short of 52)
    const evalInsolvent = evaluateTradeOffer(offer, personas.sherwood, emptyState, 51, 1);
    assert.strictEqual(evalInsolvent.accepted, false);
    assert.strictEqual(evalInsolvent.shortfall, 42);
    assert.strictEqual(evalInsolvent.counterOffer, undefined);
    assert.ok(
      typeof evalInsolvent.quoteMessage === 'string' &&
        evalInsolvent.quoteMessage.includes('exceeding available reserves')
    );

    // Case B: Human has exactly 52 cash (boundary threshold)
    const evalExactCash = evaluateTradeOffer(offer, personas.sherwood, emptyState, 52, 1);
    assert.strictEqual(evalExactCash.accepted, false);
    assert.strictEqual(evalExactCash.shortfall, 42);
    assert.ok(evalExactCash.counterOffer);
    assert.strictEqual(evalExactCash.counterOffer.cash, 52);

    // Case C: Human has zero additional cash
    const evalZeroCash = evaluateTradeOffer(offer, personas.sherwood, emptyState, 10, 1);
    assert.strictEqual(evalZeroCash.counterOffer, undefined);
  });

  it('validates edge cases in trade offers: rejects empty offers, negative cash, unowned assets, and wrong phases', () => {
    const state = createGame();
    // Advance state to trade phase by drafting plots for human
    const pendingDeeds = state.pending.slice(0, state.draftCount);
    for (const deed of pendingDeeds) {
      state.lots[deed].owner = 0;
    }
    state.pending = [];
    state.phase = 'trade';

    // 1. Completely empty offer
    const emptyTrade: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, emptyTrade),
      /Add cash, a shop tile, or a plot to the deal/
    );

    // 2. Negative cash
    const negativeGiveCash: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: -10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, negativeGiveCash),
      /Cash must be a whole number within the owner’s balance/
    );

    const negativeTakeCash: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: -5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, negativeTakeCash),
      /Cash must be a whole number within the owner’s balance/
    );

    // 3. Cash exceeding owner balance
    const humanCash = state.players[0].cash;
    const overGiveCash: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: humanCash + 1, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, overGiveCash),
      /Cash must be a whole number within the owner’s balance/
    );

    // 4. Proposer offering a parcel they do not own
    const unownedLot = state.lots.find((l) => l.owner !== 0)!.id;
    const illegalLotOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [unownedLot] },
      take: { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, illegalLotOffer),
      /Each plot can be offered once by its current owner/
    );

    // 5. Asking for a parcel partner does not own
    const partnerId = 1;
    const notPartnerLot = state.lots.find((l) => l.owner !== partnerId)!.id;
    const illegalAskLot: TradeOffer = {
      fromPlayer: 0,
      toPlayer: partnerId,
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [notPartnerLot] },
    };
    assert.throws(
      () => validateOffer(state, illegalAskLot),
      /Each plot can be offered once by its current owner/
    );

    // 6. Proposer offering more shop tiles than held
    const tileCategory = 0;
    const heldTiles = state.players[0].tiles[tileCategory];
    const excessTiles = [0, 0, 0, 0, 0, 0];
    excessTiles[tileCategory] = heldTiles + 1;
    const excessTileOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 0, tiles: excessTiles, lots: [] },
      take: { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, excessTileOffer),
      /A player cannot trade more shop tiles than they hold/
    );

    // 7. Trading with invalid partner ID
    const selfTrade: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 0, // self
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(() => validateOffer(state, selfTrade), /Choose a trading partner/);

    // 8. Attempting trade in non-trade phase
    state.phase = 'build';
    const validOfferContent: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(
      () => validateOffer(state, validOfferContent),
      /Deals are available only during the Trade phase/
    );
  });
});
