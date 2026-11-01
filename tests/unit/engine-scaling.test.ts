/**
 * tests/unit/engine-scaling.test.ts
 *
 * Dedicated test suite verifying 3 to 6 player scaling, capacity validation,
 * trade cluster recalculation, and proactive bot proposals.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createGame,
  draftPlots,
  beginBuild,
  buildTile,
  executeTrade,
  collectIncome,
  nextYear,
  canPlace,
  groups,
  income,
  SHOPS,
  validateOffer,
  advancePhase,
} from '../../src/engine/engine';
import { canBuildShop } from '../../src/engine/board-layout';
import { generateBotTradeOffer, getBotPersonality } from '../../src/engine/bot';
import type { GameState, RandomSource } from '../../src/engine/types';

function createRng(seed = 12345): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Suite 1: 3-Player 6-Year Match Completion & Tile Conservation', () => {
  it('completes 6-year game with exactly 72 parcels and 120 tiles conserved', () => {
    const players = [
      { name: 'Alice', address: '0x1000000000000000000000000000000000000001' },
      { name: 'Bob', address: '0x2000000000000000000000000000000000000002' },
      { name: 'Charlie', address: '0x3000000000000000000000000000000000000003' },
    ];
    const rng = createRng(42);
    const state = createGame({ players, seed: 42 }, rng);

    assert.strictEqual(state.players.length, 3);
    assert.strictEqual(state.lots.length, 72);

    for (let year = 1; year <= 6; year++) {
      assert.strictEqual(state.year, year);
      assert.strictEqual(state.phase, 'receive');

      const count = state.draftCount;

      // Draft pending deeds for human player 0
      const humanPicks = state.pending.slice(0, count);
      draftPlots(state, 0, humanPicks, rng);
      assert.strictEqual(state.phase, 'trade');

      // Progress through build and income
      beginBuild(state);
      assert.strictEqual(state.phase, 'build');

      collectIncome(state);
      if (year < 6) {
        assert.strictEqual(state.phase, 'income');
        nextYear(state, rng);
      }
    }

    assert.strictEqual(state.phase, 'ended');
    const claimedParcels = state.lots.filter((l) => l.owner !== null).length;
    assert.strictEqual(claimedParcels, 72, 'All 72 parcels must be claimed in 3-player match');

    // Conservation check: 120 total tiles
    const totalTiles =
      state.bag.length +
      state.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
      state.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(totalTiles, 120, 'Tile conservation invariant: exactly 120 tiles in game');
  });
});

describe('Suite 2: 5-Player 6-Year Match Completion & Parcel Invariants', () => {
  it('completes 6-year game with exactly 70 claimed parcels and 2 vacant parcels', () => {
    const players = [
      { name: 'Player 0', address: '0x1000000000000000000000000000000000000000' },
      { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001' },
      { name: 'Apex', address: '0x3000000000000000000000000000000000000002' },
      { name: 'Luna', address: '0x4000000000000000000000000000000000000003' },
      { name: 'Nexus', address: '0x5000000000000000000000000000000000000004' },
    ];
    const rng = createRng(99);
    const state = createGame({ players, seed: 99 }, rng);

    assert.strictEqual(state.players.length, 5);

    for (let year = 1; year <= 6; year++) {
      const count = state.draftCount;
      const humanPicks = state.pending.slice(0, count);
      draftPlots(state, 0, humanPicks, rng);
      beginBuild(state);
      collectIncome(state);
      if (year < 6) {
        assert.strictEqual(state.phase, 'income');
        nextYear(state, rng);
      }
    }

    assert.strictEqual(state.phase, 'ended');
    const claimedParcels = state.lots.filter((l) => l.owner !== null).length;
    const vacantParcels = state.lots.filter((l) => l.owner === null).length;

    assert.strictEqual(claimedParcels, 70, '5-player game must leave exactly 70 claimed parcels');
    assert.strictEqual(vacantParcels, 2, '5-player game must leave exactly 2 vacant parcels');

    const totalTiles =
      state.bag.length +
      state.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
      state.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(totalTiles, 120, '120 tiles conserved');
  });
});

describe('Suite 3: 6-Player 6-Year Match Completion & Tile Conservation', () => {
  it('completes 6-year game with exactly 72 claimed parcels across 6 players', () => {
    const players = [
      { name: 'Player 0', address: '0x1000000000000000000000000000000000000000' },
      { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001' },
      { name: 'Apex', address: '0x3000000000000000000000000000000000000002' },
      { name: 'Luna', address: '0x4000000000000000000000000000000000000003' },
      { name: 'Nexus', address: '0x5000000000000000000000000000000000000004' },
      { name: 'Solace', address: '0x6000000000000000000000000000000000000005' },
    ];
    const rng = createRng(777);
    const state = createGame({ players, seed: 777 }, rng);

    assert.strictEqual(state.players.length, 6);

    for (let year = 1; year <= 6; year++) {
      const count = state.draftCount;
      const humanPicks = state.pending.slice(0, count);
      draftPlots(state, 0, humanPicks, rng);
      beginBuild(state);
      collectIncome(state);
      if (year < 6) {
        assert.strictEqual(state.phase, 'income');
        nextYear(state, rng);
      }
    }

    assert.strictEqual(state.phase, 'ended');
    const claimedParcels = state.lots.filter((l) => l.owner !== null).length;
    assert.strictEqual(claimedParcels, 72, 'All 72 parcels claimed across 6 players');

    const totalTiles =
      state.bag.length +
      state.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
      state.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(totalTiles, 120, '120 tiles conserved');
  });
});

describe('Suite 4: Capacity Validation Parity with canBuildShop', () => {
  it('rejects placement adjacent to completed business', () => {
    const rng = createRng(1);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // Give player 0 parcels 0, 1, 2 in District 0
    state.lots[0].owner = 0;
    state.lots[1].owner = 0;
    state.lots[2].owner = 0;

    // Shop 0 target size is 3 (DEX Swap)
    state.lots[0].shop = 0;
    state.lots[1].shop = 0;
    state.lots[2].shop = 0;
    state.lots[0].isComplete = true;
    state.lots[1].isComplete = true;
    state.lots[2].isComplete = true;

    // Parcel 4 is adjacent to parcel 0 and owned by player 0
    state.lots[4].owner = 0;
    state.lots[4].shop = null;
    state.players[0].tiles[0] = 5;

    const validation = canBuildShop(state.lots, 4, 0, 0, 5);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.reason?.includes('already completed at maximum capacity'));

    const canPlaceResult = canPlace(state, 0, 4, 0);
    assert.strictEqual(canPlaceResult, false, 'canPlace must reject adjacent expansion of completed shop');

    assert.throws(
      () => buildTile(state, 0, 4, 0),
      /already completed at maximum capacity/
    );
    assert.ok(state.logs.some((msg) => msg.includes('Build rejected on Parcel 5')));
  });

  it('rejects placement that merges two clusters into oversized group', () => {
    const rng = createRng(2);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // In District 0, parcel layout:
    // Lot 3 and 4 have shop 0 (cluster 1, size 2)
    // Lot 2 and 6 have shop 0 (cluster 2, size 2)
    // Lot 5 is adjacent to lot 4 and lot 6
    // Placing on lot 5 merges cluster 1 and cluster 2 plus lot 5 = 5 > 3 (target size)
    state.lots[3].owner = 0;
    state.lots[3].shop = 0;
    state.lots[4].owner = 0;
    state.lots[4].shop = 0;

    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[6].owner = 0;
    state.lots[6].shop = 0;

    // Bridging parcel 5
    state.lots[5].owner = 0;
    state.lots[5].shop = null;

    state.players[0].tiles[0] = 3;

    const validation = canBuildShop(state.lots, 5, 0, 0, 3);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.reason?.includes('exceeds maximum capacity'));
    assert.strictEqual(canPlace(state, 0, 5, 0), false);
    assert.throws(() => buildTile(state, 0, 5, 0), /exceeds maximum capacity/);
  });
});

describe('Suite 5: Trade Cluster Completeness & Payout Recalculation', () => {
  it('immediately recalculates cluster size and isComplete when parcel is traded', () => {
    const rng = createRng(3);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 owns parcel 0 with shop 0 (size 1)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = false;

    // Player 1 owns parcel 1 with shop 0 (size 1)
    state.lots[1].owner = 1;
    state.lots[1].shop = 0;
    state.lots[1].isComplete = false;

    // Player 0 owns parcel 2 with shop 0 (size 1)
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[2].isComplete = false;

    // Trade parcel 1 from Player 1 to Player 0
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 100, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
    };

    state.players[0].cash = 500;
    executeTrade(state, offer);

    assert.strictEqual(state.lots[1].owner, 0);

    // After trade, player 0 owns parcels 0, 1, 2, forming complete size 3 cluster
    const player0Groups = groups(state, 0);
    const cluster = player0Groups.find((g) => g.shop === 0 && g.lots.includes(1));
    assert.ok(cluster, 'Cluster must exist for player 0');
    assert.strictEqual(cluster.size, 3, 'Merged cluster size must equal 3');
    assert.strictEqual(cluster.isComplete, true, 'Merged cluster must be marked complete');
    assert.strictEqual(state.lots[0].isComplete, true);
    assert.strictEqual(state.lots[1].isComplete, true);
    assert.strictEqual(state.lots[2].isComplete, true);
  });

  it('severs completed cluster when a component parcel is traded away', () => {
    const rng = createRng(33);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Player 0 owns a complete 3-lot cluster on parcels 0, 1, 2
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = true;

    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[1].isComplete = true;

    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[2].isComplete = true;

    // Player 0 trades parcel 1 to Player 1
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
      take: { cash: 50, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };

    state.players[1].cash = 200;
    executeTrade(state, offer);

    assert.strictEqual(state.lots[1].owner, 1);
    assert.strictEqual(state.lots[1].isComplete, false);
    assert.strictEqual(state.lots[0].isComplete, false);
    assert.strictEqual(state.lots[2].isComplete, false);

    const player0Groups = groups(state, 0);
    for (const g of player0Groups) {
      assert.strictEqual(g.isComplete, false);
    }
  });
});

describe('Suite 6: Proactive Bot Trade Offers Queue', () => {
  it('populates incoming offers queue when bot detects high-synergy adjacent plot', () => {
    const rng = createRng(4);
    const state = createGame(undefined, rng);
    state.phase = 'trade';

    // Bot 1 owns parcel 0 with shop 0 (incomplete)
    state.lots[0].owner = 1;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = false;

    // Human player 0 owns adjacent parcel 1 (empty)
    state.lots[1].owner = 0;
    state.lots[1].shop = null;

    const offer = generateBotTradeOffer(1, 0, state);
    assert.ok(offer !== null, 'Bot must formulate proactive offer for adjacent synergy plot');
    assert.strictEqual(offer.fromPlayer, 1);
    assert.strictEqual(offer.toPlayer, 0);
    assert.ok(offer.take.lots.includes(1));
    assert.ok(offer.give.cash > 0);

    // Verify validateOffer accepts bot proactive offer
    assert.strictEqual(validateOffer(state, offer), true);
  });

  it('populates state.incomingOffers during draftPlots and clears on advancePhase', () => {
    const rng = createRng(5);
    const state = createGame(undefined, rng);
    state.phase = 'receive';

    // Set up Bot 1 with an incomplete shop on parcel 0
    state.lots[0].owner = 1;
    state.lots[0].shop = 0;
    state.lots[0].isComplete = false;

    // Put adjacent parcel 1 into state.pending and human picks it
    state.lots[1].owner = null;
    state.lots[1].shop = null;
    state.draftCount = 1;
    state.pending = [1];

    draftPlots(state, 0, [1], rng);
    assert.strictEqual(state.phase, 'trade');

    // Bot 1 should have formulated an offer for parcel 1
    assert.ok(Array.isArray(state.incomingOffers));
    const bot1Offer = state.incomingOffers.find((o) => o.fromPlayer === 1 && o.take.lots.includes(1));
    assert.ok(bot1Offer, 'Bot 1 proactive offer must be queued in incomingOffers');

    // Advance phase to build must clear incomingOffers
    advancePhase(state);
    assert.strictEqual(state.phase, 'build');
    assert.deepStrictEqual(state.incomingOffers, []);
  });

  it('verifies AI personas Nexus and Solace are registered with correct profiles', () => {
    const nexus = getBotPersonality(4);
    assert.strictEqual(nexus.name, 'Nexus');
    assert.strictEqual(nexus.profitMargin, 1.06);
    assert.strictEqual(nexus.riskTolerance, 0.5);
    assert.ok(nexus.dialogue.greeting.includes('Connection established'));

    const solace = getBotPersonality(5);
    assert.strictEqual(solace.name, 'Solace');
    assert.strictEqual(solace.profitMargin, 1.02);
    assert.strictEqual(solace.riskTolerance, 0.75);
    assert.ok(solace.dialogue.greeting.includes('Welcome, neighbor'));
  });
});
