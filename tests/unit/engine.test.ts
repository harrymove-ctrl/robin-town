/**
 * tests/unit/engine.test.ts
 *
 * Multi-tier unit test suite for robin-town core game engine.
 * Verifies initial state, 6-year turn loop, parcel and tile drafting,
 * tile conservation (120 tiles), parcel conservation (72 lots), non-linear
 * overflow payouts, OTC trading, and 100-match Monte Carlo simulation.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  newGame,
  createGame,
  claimPlots,
  draftPlots,
  beginBuild,
  buildTile,
  placeShop,
  canPlace,
  collectIncome,
  finishYear,
  nextYear,
  advancePhase,
  botBuild,
  income,
  groups,
  groupIncome,
  neighbors,
  emptyOffer,
  validateOffer,
  executeTrade,
  trade,
  evaluateOffer,
  holdings,
  validSave,
  updateBoardLayout,
  rankings,
  log,
  SHOPS,
  COMPLETE,
  INCOMPLETE,
  PLOT_KEEP_SCHEDULE,
} from '../../src/engine/engine';
import type { GameState, RandomSource } from '../../src/engine/types';

function rng(seed: number): RandomSource {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function fixture(): GameState {
  const s = newGame(rng(3));
  s.phase = 'build';
  s.pending = [];
  for (const l of s.lots) {
    l.owner = null;
    l.shop = null;
    l.isComplete = false;
  }
  s.players[0].tiles = [20, 20, 20, 20, 20, 20];
  return s;
}

describe('Initial State and Board Invariants', () => {
  it('initializes exactly 72 lots across 6 districts with 12 lots each', () => {
    const s = createGame();
    assert.strictEqual(s.lots.length, 72);
    for (let d = 0; d < 6; d++) {
      const inDistrict = s.lots.filter((l) => l.block === d);
      assert.strictEqual(inDistrict.length, 12);
    }
  });

  it('initializes exactly 120 tiles with 20 tiles per category', () => {
    const s = createGame();
    const totalTiles =
      s.bag.length +
      s.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
      s.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(totalTiles, 120);

    const counts = [0, 0, 0, 0, 0, 0];
    for (const tile of s.bag) counts[tile]++;
    for (const p of s.players) {
      for (let i = 0; i < 6; i++) counts[i] += p.tiles[i];
    }
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(counts[i], 20, `Shop category ${i} quota mismatch`);
    }
  });

  it('initializes 4 players with 50 starting cash and clean inventory', () => {
    const s = createGame();
    assert.strictEqual(s.players.length, 4);
    for (const p of s.players) {
      assert.strictEqual(p.cash, 50);
      assert.strictEqual(
        s.lots.filter((l) => l.owner === p.id).length,
        0
      );
    }
  });

  it('guarantees orthogonal connections never cross streets or diagonals', () => {
    assert.deepStrictEqual(
      neighbors(3).sort((a, b) => a - b),
      [4, 7]
    );
    assert.deepStrictEqual(
      neighbors(12).sort((a, b) => a - b),
      [13, 14]
    );
  });
});

describe('6-Year Turn Lifecycle and Drafting Schedules', () => {
  it('follows exact phase progression and distributes 72 lots across 6 years', () => {
    const random = rng(42);
    const s = newGame(random);

    for (let y = 1; y <= 6; y++) {
      assert.strictEqual(s.year, y);
      assert.strictEqual(s.phase, 'receive');
      assert.strictEqual(s.draftCount, PLOT_KEEP_SCHEDULE[y - 1]);

      const expectedPending = Math.min(
        s.draftCount + 2,
        s.lots.filter((l) => l.owner === null).length
      );
      assert.strictEqual(s.pending.length, expectedPending);

      claimPlots(s, s.pending.slice(0, s.draftCount), random);
      assert.strictEqual(s.phase, 'trade');

      beginBuild(s);
      assert.strictEqual(s.phase, 'build');

      finishYear(s);
      if (y < 6) {
        assert.strictEqual(s.phase, 'income');
        nextYear(s, random);
      }
    }

    assert.strictEqual(s.phase, 'ended');
    assert.strictEqual(s.lots.filter((l) => l.owner === null).length, 0);
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(holdings(s, i).length, 18);
    }
  });

  it('conserves all 120 shop tiles across every single epoch', () => {
    const random = rng(17);
    const s = newGame(random);

    for (let y = 1; y <= 6; y++) {
      claimPlots(s, s.pending.slice(0, s.draftCount), random);
      beginBuild(s);
      botBuild(s, 0);
      finishYear(s);

      const totalTiles =
        s.bag.length +
        s.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
        s.lots.filter((l) => l.shop !== null).length;
      assert.strictEqual(totalTiles, 120);

      if (y < 6) nextYear(s, random);
    }
  });

  it('rejects invalid drafting and building requests without state corruption', () => {
    const s = newGame(rng(5));
    const before = JSON.stringify(s);

    assert.throws(() => claimPlots(s, []));
    assert.throws(() => claimPlots(s, Array(s.draftCount).fill(s.pending[0])));
    assert.throws(() => placeShop(s, 0, 0));
    assert.strictEqual(JSON.stringify(s), before);

    claimPlots(s, s.pending.slice(0, s.draftCount));
    beginBuild(s);
    const opponentLot = s.lots.find((l) => l.owner === 1)!;
    assert.throws(() => placeShop(s, opponentLot.id, 0));
  });
});

describe('Protocol Deployment and Non-Linear Overflow Payouts', () => {
  it('scores complete sets with target completion bonuses', () => {
    const s = fixture();
    // DEX Swap (size 3) on lots 0, 1, 2
    for (const id of [0, 1, 2]) {
      s.lots[id].owner = 0;
      s.lots[id].shop = 0;
    }
    assert.strictEqual(income(s, 0), 50);

    // Change to Staking Vault (size 4) on lots 0, 1, 2
    s.lots[0].shop = 2;
    s.lots[1].shop = 2;
    s.lots[2].shop = 2;
    // Incomplete size 3 pays 40
    assert.strictEqual(income(s, 0), 40);

    // Add lot 4 to complete size 4 Staking Vault
    s.lots[4].owner = 0;
    placeShop(s, 4, 2);
    assert.strictEqual(income(s, 0), 80);
  });

  it('evaluates overflow payouts for cluster sizes 1 through 12', () => {
    // Target 3 (DEX Swap): Complete = 50, Incomplete = [0, 10, 20]
    assert.strictEqual(groupIncome(0, 1), 10);
    assert.strictEqual(groupIncome(0, 2), 20);
    assert.strictEqual(groupIncome(0, 3), 50);
    assert.strictEqual(groupIncome(0, 4), 60);
    assert.strictEqual(groupIncome(0, 5), 70);
    assert.strictEqual(groupIncome(0, 6), 100);
    assert.strictEqual(groupIncome(0, 7), 110);
    assert.strictEqual(groupIncome(0, 8), 120);
    assert.strictEqual(groupIncome(0, 9), 150);
    assert.strictEqual(groupIncome(0, 10), 160);
    assert.strictEqual(groupIncome(0, 11), 170);
    assert.strictEqual(groupIncome(0, 12), 200);

    // Target 4 (Staking Vault): Complete = 80, Incomplete = [0, 10, 20, 40]
    assert.strictEqual(groupIncome(2, 1), 10);
    assert.strictEqual(groupIncome(2, 2), 20);
    assert.strictEqual(groupIncome(2, 3), 40);
    assert.strictEqual(groupIncome(2, 4), 80);
    assert.strictEqual(groupIncome(2, 5), 90);
    assert.strictEqual(groupIncome(2, 6), 100);
    assert.strictEqual(groupIncome(2, 7), 120);
    assert.strictEqual(groupIncome(2, 8), 160);
    assert.strictEqual(groupIncome(2, 9), 170);
    assert.strictEqual(groupIncome(2, 10), 180);
    assert.strictEqual(groupIncome(2, 11), 200);
    assert.strictEqual(groupIncome(2, 12), 240);

    // Target 5 (Derivatives Exchange): Complete = 110, Incomplete = [0, 10, 20, 40, 60]
    assert.strictEqual(groupIncome(4, 1), 10);
    assert.strictEqual(groupIncome(4, 2), 20);
    assert.strictEqual(groupIncome(4, 3), 40);
    assert.strictEqual(groupIncome(4, 4), 60);
    assert.strictEqual(groupIncome(4, 5), 110);
    assert.strictEqual(groupIncome(4, 6), 120);
    assert.strictEqual(groupIncome(4, 7), 130);
    assert.strictEqual(groupIncome(4, 8), 150);
    assert.strictEqual(groupIncome(4, 9), 170);
    assert.strictEqual(groupIncome(4, 10), 220);
    assert.strictEqual(groupIncome(4, 11), 230);
    assert.strictEqual(groupIncome(4, 12), 240);

    // Target 6 (Validator Citadel): Complete = 140, Incomplete = [0, 10, 20, 40, 60, 80]
    assert.strictEqual(groupIncome(5, 1), 10);
    assert.strictEqual(groupIncome(5, 2), 20);
    assert.strictEqual(groupIncome(5, 3), 40);
    assert.strictEqual(groupIncome(5, 4), 60);
    assert.strictEqual(groupIncome(5, 5), 80);
    assert.strictEqual(groupIncome(5, 6), 140);
    assert.strictEqual(groupIncome(5, 7), 150);
    assert.strictEqual(groupIncome(5, 8), 160);
    assert.strictEqual(groupIncome(5, 9), 180);
    assert.strictEqual(groupIncome(5, 10), 200);
    assert.strictEqual(groupIncome(5, 11), 220);
    assert.strictEqual(groupIncome(5, 12), 280);
  });

  it('scores disconnected clusters of the same shop type independently', () => {
    const s = fixture();
    // Cluster 1: DEX Swap on lots 0, 1 (District 0) -> payout: 20
    s.lots[0].owner = 0;
    s.lots[0].shop = 0;
    s.lots[1].owner = 0;
    s.lots[1].shop = 0;

    // Cluster 2: DEX Swap on lots 10, 11 (District 0) -> payout: 20
    s.lots[10].owner = 0;
    s.lots[10].shop = 0;
    s.lots[11].owner = 0;
    s.lots[11].shop = 0;

    assert.strictEqual(groups(s, 0).length, 2);
    assert.strictEqual(income(s, 0), 40);
  });
});

describe('OTC Trading and Asset Conservation', () => {
  it('conserves cash, shops, and parcels on accepted mixed trades', () => {
    const s = newGame(rng(5));
    claimPlots(s, s.pending.slice(0, s.draftCount));

    const take = emptyOffer();
    const give = emptyOffer();
    take.cash = 50;
    const rejected = { partner: 1, take, give };
    const before = JSON.stringify(s);

    assert.strictEqual(trade(s, rejected).accepted, false);
    assert.strictEqual(JSON.stringify(s), before);

    take.cash = 0;
    take.lots = [holdings(s, 1)[0].id];
    give.cash = 50;
    const initialTotalCash = s.players.reduce((sum, p) => sum + p.cash, 0);

    const result = trade(s, { partner: 1, give, take });
    assert.strictEqual(result.accepted, true);
    assert.strictEqual(s.lots[take.lots[0]].owner, 0);

    const finalTotalCash = s.players.reduce((sum, p) => sum + p.cash, 0);
    assert.strictEqual(finalTotalCash, initialTotalCash);
  });

  it('rejects illegal trades atomically with clean state preservation', () => {
    const s = newGame(rng(5));
    claimPlots(s, s.pending.slice(0, s.draftCount));
    const prior = JSON.stringify(s);

    assert.throws(() =>
      trade(s, {
        partner: 1,
        give: { ...emptyOffer(), cash: 0.5 },
        take: emptyOffer(),
      })
    );
    assert.strictEqual(JSON.stringify(s), prior);
  });

  it('updates income dynamically following parcel ownership transfer', () => {
    const s = fixture();
    for (const id of [0, 1, 2]) {
      s.lots[id].owner = 0;
      s.lots[id].shop = 0;
    }
    s.phase = 'trade';
    const give = emptyOffer();
    give.lots = [1];

    assert.strictEqual(
      trade(s, { partner: 1, give, take: emptyOffer() }).accepted,
      true
    );
    assert.strictEqual(s.lots[1].shop, 0);
    // Player 0 now has lots 0 and 2 (disconnected) -> 10 + 10 = 20
    assert.strictEqual(income(s, 0), 20);
    // Player 1 now has lot 1 -> 10
    assert.strictEqual(income(s, 1), 10);
  });
});

describe('Rankings, Logging, and State Validation', () => {
  it('ranks players by cash, then placed shops, then owned parcels', () => {
    const s = fixture();
    for (const p of s.players) p.cash = 100;

    s.lots[0].owner = 2;
    s.lots[0].shop = 0;
    const sorted = rankings(s);
    assert.strictEqual(sorted[0].id, 2);
  });

  it('logs events and caps log history at 100 entries', () => {
    const s = fixture();
    for (let i = 0; i < 120; i++) {
      log(s, `Message ${i}`);
    }
    assert.strictEqual(s.logs.length, 100);
    assert.strictEqual(s.logs[0], 'Message 119');
  });

  it('validSave validates correct game states and rejects malformed inputs', () => {
    const s = createGame();
    assert.strictEqual(validSave(s), true);
    assert.strictEqual(validSave(null), false);
    assert.strictEqual(validSave({}), false);
    assert.strictEqual(validSave({ ...s, year: 7 }), false);
  });

  it('updateBoardLayout updates revision and preserves state properties', () => {
    const s = fixture();
    s.boardRevision = undefined;
    s.year = 4;
    s.lastIncome = [70, 50, 80, 90];
    s.lots[3].owner = 0;
    s.lots[3].shop = 2;

    const before = structuredClone(s);
    assert.strictEqual(updateBoardLayout(s), true);
    assert.deepStrictEqual(s.players, before.players);
    assert.deepStrictEqual(s.lots, before.lots);
    assert.strictEqual(s.boardRevision, 2);

    // Second call is a no-op
    assert.strictEqual(updateBoardLayout(s), false);
  });
});

describe('100-Match Monte Carlo Simulation and Determinism', () => {
  it('simulates 100 complete 6-year matches with parcel and tile conservation', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = rng(seed);
      const s = newGame(random);

      for (let y = 1; y <= 6; y++) {
        assert.strictEqual(s.year, y);
        assert.strictEqual(s.phase, 'receive');

        claimPlots(s, s.pending.slice(0, s.draftCount), random);
        assert.strictEqual(s.phase, 'trade');

        beginBuild(s);
        botBuild(s, 0);

        const preCash = s.players.map((p) => p.cash);
        finishYear(s);
        for (let i = 0; i < 4; i++) {
          assert.strictEqual(s.players[i].cash, preCash[i] + income(s, i));
        }

        const totalTiles =
          s.bag.length +
          s.players.reduce((sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0), 0) +
          s.lots.filter((l) => l.shop !== null).length;
        assert.strictEqual(totalTiles, 120);

        if (y < 6) nextYear(s, random);
      }

      assert.strictEqual(s.phase, 'ended');
      assert.strictEqual(s.lots.filter((l) => l.owner === null).length, 0);
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(holdings(s, i).length, 18);
      }
      assert.ok(validSave(s));
    }
  });

  it('guarantees byte-for-byte deterministic execution across identical seeds', () => {
    const s1 = newGame(rng(999));
    const s2 = newGame(rng(999));

    for (let y = 1; y <= 6; y++) {
      claimPlots(s1, s1.pending.slice(0, s1.draftCount), rng(999 + y));
      claimPlots(s2, s2.pending.slice(0, s2.draftCount), rng(999 + y));
      beginBuild(s1);
      beginBuild(s2);
      botBuild(s1, 0);
      botBuild(s2, 0);
      finishYear(s1);
      finishYear(s2);
      if (y < 6) {
        nextYear(s1, rng(999 + y * 10));
        nextYear(s2, rng(999 + y * 10));
      }
    }

    assert.strictEqual(JSON.stringify(s1), JSON.stringify(s2));
  });
});
