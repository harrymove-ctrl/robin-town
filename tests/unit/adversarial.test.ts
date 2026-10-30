/**
 * tests/unit/adversarial.test.ts
 *
 * Empirical adversarial stress test harness for robin-town core game engine.
 * Stress-tests parcel conservation, tile pool conservation, non-linear payout arithmetic,
 * state machine robustness, and Monte Carlo determinism.
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
  holdings,
  validSave,
  rankings,
  SHOPS,
  COMPLETE,
  INCOMPLETE,
  PLOT_KEEP_SCHEDULE,
} from '../../src/engine/engine';
import {
  calculateClusterIncome,
  SHOP_TARGET_SIZES,
} from '../../src/engine/board-layout';
import type { GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createSeededRng(seed: number): RandomSource {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('Adversarial Challenge 1: Parcel Conservation Invariant', () => {
  it('conserves all 72 parcels with zero leaks, zero duplicates, and zero unowned lots across 100 matches', () => {
    for (let seed = 100; seed < 200; seed++) {
      const random = createSeededRng(seed);
      const state = newGame(random);

      for (let year = 1; year <= 6; year++) {
        assert.strictEqual(state.year, year);
        assert.strictEqual(state.phase, 'receive');
        assert.strictEqual(state.draftCount, PLOT_KEEP_SCHEDULE[year - 1]);

        // Verify pending contains only unowned parcels
        for (const pid of state.pending) {
          assert.strictEqual(state.lots[pid].owner, null);
        }

        claimPlots(state, state.pending.slice(0, state.draftCount), random);
        assert.strictEqual(state.phase, 'trade');

        beginBuild(state);
        botBuild(state, 0);
        finishYear(state);
        if (year < 6) {
          nextYear(state, random);
        }
      }

      assert.strictEqual(state.phase, 'ended');

      // Invariant: exactly 72 parcels exist
      assert.strictEqual(state.lots.length, 72);

      // Invariant: zero unowned parcels at game end
      const unowned = state.lots.filter((lot) => lot.owner === null);
      assert.strictEqual(unowned.length, 0);

      // Invariant: exactly 18 parcels per player in 4-player match
      for (let p = 0; p < 4; p++) {
        const owned = holdings(state, p);
        assert.strictEqual(owned.length, 18, `Player ${p} does not have exactly 18 lots`);
      }

      // Invariant: zero duplicate ownership
      const seenLots = new Set<number>();
      for (const lot of state.lots) {
        assert.ok(lot.owner !== null);
        assert.ok(!seenLots.has(lot.id), `Lot ${lot.id} was claimed more than once`);
        seenLots.add(lot.id);
      }
      assert.strictEqual(seenLots.size, 72);
    }
  });

  it('rejects adversarial drafting inputs without corrupting state', () => {
    const random = createSeededRng(777);
    const state = newGame(random);
    const snapshot = JSON.stringify(state);

    // Empty drafting array
    assert.throws(() => draftPlots(state, 0, []));
    assert.strictEqual(JSON.stringify(state), snapshot);

    // Too few deeds
    assert.throws(() => draftPlots(state, 0, state.pending.slice(0, state.draftCount - 1)));
    assert.strictEqual(JSON.stringify(state), snapshot);

    // Too many deeds
    assert.throws(() => draftPlots(state, 0, [...state.pending.slice(0, state.draftCount), state.pending[0]]));
    assert.strictEqual(JSON.stringify(state), snapshot);

    // Duplicate deed in same drafting call
    if (state.draftCount >= 2) {
      const duplicateSelection = Array(state.draftCount).fill(state.pending[0]);
      assert.throws(() => draftPlots(state, 0, duplicateSelection));
      assert.strictEqual(JSON.stringify(state), snapshot);
    }

    // Unoffered deed ID outside pending
    const unofferedLotId = state.lots.findIndex((l) => !state.pending.includes(l.id));
    if (unofferedLotId !== -1) {
      const illegalSelection = [...state.pending.slice(0, state.draftCount - 1), unofferedLotId];
      assert.throws(() => draftPlots(state, 0, illegalSelection));
      assert.strictEqual(JSON.stringify(state), snapshot);
    }

    // Invalid deed ID out of range
    const invalidSelection = [...state.pending.slice(0, state.draftCount - 1), 999];
    assert.throws(() => draftPlots(state, 0, invalidSelection));
    assert.strictEqual(JSON.stringify(state), snapshot);
  });
});

describe('Adversarial Challenge 2: Tile Pool Conservation Invariant', () => {
  it('strictly conserves 120 total tiles and 20 per category at every phase of every year', () => {
    for (let seed = 300; seed < 350; seed++) {
      const random = createSeededRng(seed);
      const state = newGame(random);

      const assertTileConservation = (stage: string) => {
        const bagTotal = state.bag.length;
        const playerTotal = state.players.reduce(
          (sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0),
          0
        );
        const placedTotal = state.lots.filter((l) => l.shop !== null).length;
        const grandTotal = bagTotal + playerTotal + placedTotal;

        assert.strictEqual(
          grandTotal,
          120,
          `Tile pool leak at stage ${stage}: total is ${grandTotal} instead of 120`
        );

        // Category conservation: exactly 20 tiles per category
        const categoryCounts = [0, 0, 0, 0, 0, 0];
        for (const t of state.bag) {
          assert.ok(t >= 0 && t <= 5);
          categoryCounts[t]++;
        }
        for (const p of state.players) {
          for (let c = 0; c < 6; c++) {
            assert.ok(p.tiles[c] >= 0, `Player ${p.id} has negative tiles for shop ${c}`);
            categoryCounts[c] += p.tiles[c];
          }
        }
        for (const lot of state.lots) {
          if (lot.shop !== null) {
            assert.ok(lot.shop >= 0 && lot.shop <= 5);
            categoryCounts[lot.shop]++;
          }
        }

        for (let c = 0; c < 6; c++) {
          assert.strictEqual(
            categoryCounts[c],
            20,
            `Category ${c} tile leak at ${stage}: count is ${categoryCounts[c]} instead of 20`
          );
        }
      };

      for (let year = 1; year <= 6; year++) {
        assertTileConservation(`Year ${year} Receive Phase Start`);

        claimPlots(state, state.pending.slice(0, state.draftCount), random);
        assertTileConservation(`Year ${year} Trade Phase`);

        beginBuild(state);
        assertTileConservation(`Year ${year} Build Phase Before Bot Deploy`);

        botBuild(state, 0);
        assertTileConservation(`Year ${year} Build Phase After Bot Deploy`);

        finishYear(state);
        assertTileConservation(`Year ${year} Income Phase Harvest`);

        if (year < 6) {
          nextYear(state, random);
        }
      }

      assertTileConservation('Game Final Settlement');
    }
  });

  it('conserves tile pool during valid and invalid OTC tile trades', () => {
    const random = createSeededRng(888);
    const state = newGame(random);
    claimPlots(state, state.pending.slice(0, state.draftCount), random);

    // Find a shop tile held by player 0 and partner 1
    const p0Tile = state.players[0].tiles.findIndex((count) => count > 0);
    const p1Tile = state.players[1].tiles.findIndex((count) => count > 0);
    assert.ok(p0Tile !== -1);
    assert.ok(p1Tile !== -1);

    const give = emptyOffer();
    give.tiles[p0Tile] = 1;
    give.cash = 20; // within player 0 balance of 50
    const take = emptyOffer();
    take.tiles[p1Tile] = 1;

    const offer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give,
      take,
    };

    const initialP0Count = state.players[0].tiles[p0Tile];
    const initialP1Count = state.players[1].tiles[p1Tile];

    executeTrade(state, offer);

    // Verify tiles correctly swapped if accepted
    const bagPlusPlayersPlusBoard =
      state.bag.length +
      state.players.reduce((s, p) => s + p.tiles.reduce((a, b) => a + b, 0), 0) +
      state.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(bagPlusPlayersPlusBoard, 120);

    // Adversarial trade: attempt to trade more tiles than held
    const illegalGive = emptyOffer();
    illegalGive.tiles[0] = 999;
    const illegalOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: illegalGive,
      take: emptyOffer(),
    };
    const beforeState = JSON.stringify(state);
    assert.throws(() => executeTrade(state, illegalOffer));
    assert.strictEqual(JSON.stringify(state), beforeState);
  });
});

describe('Adversarial Challenge 3: Payout Arithmetic and Overflow', () => {
  it('matches canonical payout table for all cluster sizes 1 through 12 across all 6 shop types', () => {
    // Expected matrix matching Section 2.5 of EXECUTION_PLAN.md
    const expectedTarget3 = [10, 20, 50, 60, 70, 100, 110, 120, 150, 160, 170, 200];
    const expectedTarget4 = [10, 20, 40, 80, 90, 100, 120, 160, 170, 180, 200, 240];
    const expectedTarget5 = [10, 20, 40, 60, 110, 120, 130, 150, 170, 220, 230, 240];
    const expectedTarget6 = [10, 20, 40, 60, 80, 140, 150, 160, 180, 200, 220, 280];

    for (let size = 1; size <= 12; size++) {
      // Category 0: DEX Swap (target 3)
      assert.strictEqual(groupIncome(0, size), expectedTarget3[size - 1]);
      assert.strictEqual(calculateClusterIncome(0, size), expectedTarget3[size - 1]);

      // Category 1: Memecoin Lounge (target 3)
      assert.strictEqual(groupIncome(1, size), expectedTarget3[size - 1]);
      assert.strictEqual(calculateClusterIncome(1, size), expectedTarget3[size - 1]);

      // Category 2: Staking Vault (target 4)
      assert.strictEqual(groupIncome(2, size), expectedTarget4[size - 1]);
      assert.strictEqual(calculateClusterIncome(2, size), expectedTarget4[size - 1]);

      // Category 3: Lending Protocol (target 4)
      assert.strictEqual(groupIncome(3, size), expectedTarget4[size - 1]);
      assert.strictEqual(calculateClusterIncome(3, size), expectedTarget4[size - 1]);

      // Category 4: Derivatives Exchange (target 5)
      assert.strictEqual(groupIncome(4, size), expectedTarget5[size - 1]);
      assert.strictEqual(calculateClusterIncome(4, size), expectedTarget5[size - 1]);

      // Category 5: Validator Citadel (target 6)
      assert.strictEqual(groupIncome(5, size), expectedTarget6[size - 1]);
      assert.strictEqual(calculateClusterIncome(5, size), expectedTarget6[size - 1]);
    }
  });

  it('guarantees separated clusters of the same shop type score independently', () => {
    const random = createSeededRng(555);
    const state = newGame(random);
    state.phase = 'build';

    // Clear lots for clean testing
    for (const lot of state.lots) {
      lot.owner = null;
      lot.shop = null;
    }

    // Set up two disjoint clusters of DEX Swap (size 2 each) in District 0
    // Lots 0 and 1 are adjacent (row 0, col 1 and 2)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;

    // Lots 10 and 11 are adjacent (row 3, col 0 and 1), completely disconnected from lots 0 and 1
    state.lots[10].owner = 0;
    state.lots[10].shop = 0;
    state.lots[11].owner = 0;
    state.lots[11].shop = 0;

    const detectedGroups = groups(state, 0);
    assert.strictEqual(detectedGroups.length, 2, 'Should discover exactly 2 separate clusters');
    assert.strictEqual(detectedGroups[0].size, 2);
    assert.strictEqual(detectedGroups[1].size, 2);

    // If incorrectly merged into size 4, payout would be 60.
    // When scored independently, payout is 20 + 20 = 40.
    assert.strictEqual(income(state, 0), 40);

    // Cross-district isolation: DEX Swap size 3 in District 0 and DEX Swap size 3 in District 1
    state.lots[2].owner = 0;
    state.lots[2].shop = 0; // Cluster 1 is now size 3 (payout: 50)

    // Clear lots 10 and 11
    state.lots[10].owner = null;
    state.lots[10].shop = null;
    state.lots[11].owner = null;
    state.lots[11].shop = null;

    // District 1: lots 12, 13, 14
    state.lots[12].owner = 0;
    state.lots[12].shop = 0;
    state.lots[13].owner = 0;
    state.lots[13].shop = 0;
    state.lots[14].owner = 0;
    state.lots[14].shop = 0; // Cluster 2 is size 3 in District 1 (payout: 50)

    const crossDistrictGroups = groups(state, 0);
    assert.strictEqual(crossDistrictGroups.length, 2);
    assert.strictEqual(income(state, 0), 100);
  });
});

describe('Adversarial Challenge 4: State Machine Robustness and Illegal Phase Transitions', () => {
  it('strictly blocks illegal transitions and out-of-order phase actions', () => {
    const random = createSeededRng(1234);
    const state = newGame(random);

    // Phase is currently 'receive'
    assert.strictEqual(state.phase, 'receive');

    // 1. Attempting to build during 'receive' phase
    assert.throws(() => buildTile(state, 0, 0, 0), /Build phase/);
    assert.throws(() => placeShop(state, 0, 0), /Build phase/);

    // 2. Attempting to advance to build without trading
    assert.throws(() => beginBuild(state), /Finish choosing your plots/);

    // 3. Attempting to harvest income during 'receive' phase
    assert.throws(() => collectIncome(state), /Deployment must conclude/);

    // 4. Attempting to advance year during 'receive' phase
    assert.throws(() => nextYear(state), /Harvest annual yield first/);

    // 5. Attempting to trade during 'receive' phase
    assert.throws(
      () => trade(state, { partner: 1, give: emptyOffer(), take: emptyOffer() }),
      /Trade phase/
    );

    // Transition legally to 'trade'
    claimPlots(state, state.pending.slice(0, state.draftCount), random);
    assert.strictEqual(state.phase, 'trade');

    // In 'trade' phase:
    // 6. Attempting to draft plots during 'trade' phase
    assert.throws(() => claimPlots(state, [0]), /Allocation phase/);

    // 7. Attempting to build during 'trade' phase
    assert.throws(() => buildTile(state, 0, 0, 0), /Build phase/);

    // 8. Attempting to harvest income during 'trade' phase
    assert.throws(() => collectIncome(state), /Deployment must conclude/);

    // 9. Attempting to advance year during 'trade' phase
    assert.throws(() => nextYear(state), /Harvest annual yield first/);

    // Transition legally to 'build'
    beginBuild(state);
    assert.strictEqual(state.phase, 'build');

    // In 'build' phase:
    // 10. Attempting to draft plots during 'build' phase
    assert.throws(() => claimPlots(state, [0]), /Allocation phase/);

    // 11. Attempting to trade during 'build' phase
    assert.throws(
      () => trade(state, { partner: 1, give: emptyOffer(), take: emptyOffer() }),
      /Trade phase/
    );

    // 12. Attempting to advance year during 'build' phase
    assert.throws(() => nextYear(state), /Harvest annual yield first/);

    // Transition legally to 'income'
    finishYear(state);
    assert.strictEqual(state.phase, 'income');

    // In 'income' phase:
    // 13. Attempting to draft plots during 'income' phase
    assert.throws(() => claimPlots(state, [0]), /Allocation phase/);

    // 14. Attempting to trade during 'income' phase
    assert.throws(
      () => trade(state, { partner: 1, give: emptyOffer(), take: emptyOffer() }),
      /Trade phase/
    );

    // 15. Attempting to build during 'income' phase
    assert.throws(() => buildTile(state, 0, 0, 0), /Build phase/);

    // 16. Attempting to harvest income again during 'income' phase
    assert.throws(() => collectIncome(state), /Deployment must conclude/);
  });

  it('strictly blocks actions after game end', () => {
    const random = createSeededRng(9999);
    const state = newGame(random);

    for (let y = 1; y <= 6; y++) {
      claimPlots(state, state.pending.slice(0, state.draftCount), random);
      beginBuild(state);
      botBuild(state, 0);
      finishYear(state);
      if (y < 6) nextYear(state, random);
    }

    assert.strictEqual(state.phase, 'ended');
    const endedState = JSON.stringify(state);

    // All actions must be rejected in ended state
    assert.throws(() => claimPlots(state, [0]));
    assert.throws(() => trade(state, { partner: 1, give: emptyOffer(), take: emptyOffer() }));
    assert.throws(() => buildTile(state, 0, 0, 0));
    assert.throws(() => collectIncome(state));
    assert.throws(() => nextYear(state));

    assert.strictEqual(JSON.stringify(state), endedState);
  });
});

describe('Adversarial Challenge 5: Monte Carlo Simulation and Determinism', () => {
  it('executes 100 complete 6-year matches without hangs, crashes, or NaN values', () => {
    const startTime = Date.now();

    for (let seed = 2001; seed <= 2100; seed++) {
      const random = createSeededRng(seed);
      const state = newGame(random);

      for (let y = 1; y <= 6; y++) {
        claimPlots(state, state.pending.slice(0, state.draftCount), random);
        beginBuild(state);
        botBuild(state, 0);
        finishYear(state);
        if (y < 6) nextYear(state, random);
      }

      assert.strictEqual(state.phase, 'ended');
      assert.strictEqual(state.year, 6);

      // Verify no NaN or undefined values exist
      for (const p of state.players) {
        assert.ok(Number.isFinite(p.cash), `Player ${p.id} cash is not finite`);
        assert.ok(!Number.isNaN(p.cash), `Player ${p.id} cash is NaN`);
        assert.ok(p.cash >= 50, `Player ${p.id} cash (${p.cash}) below initial 50`);
        for (let c = 0; c < 6; c++) {
          assert.ok(Number.isInteger(p.tiles[c]), `Player ${p.id} tile count is not integer`);
          assert.ok(p.tiles[c] >= 0, `Player ${p.id} has negative tile count`);
        }
      }

      for (const lot of state.lots) {
        assert.ok(Number.isInteger(lot.id));
        assert.ok(lot.owner !== null);
        assert.ok(lot.owner >= 0 && lot.owner <= 3);
        if (lot.shop !== null) {
          assert.ok(lot.shop >= 0 && lot.shop <= 5);
        }
      }

      const playerRankings = rankings(state);
      assert.strictEqual(playerRankings.length, 4);
      assert.ok(playerRankings[0].cash >= playerRankings[1].cash);
      assert.ok(validSave(state));
    }

    const elapsed = Date.now() - startTime;
    // Assert entire 100-match Monte Carlo completes in under 5 seconds
    assert.ok(elapsed < 5000, `Monte Carlo took ${elapsed}ms (expected under 5000ms)`);
  });

  it('guarantees 100% byte-for-byte reproducibility when seeded identically', () => {
    const seeds = [11111, 22222, 33333, 44444, 55555];

    for (const seed of seeds) {
      const matchA = newGame(createSeededRng(seed));
      const matchB = newGame(createSeededRng(seed));

      for (let y = 1; y <= 6; y++) {
        const rngA = createSeededRng(seed + y * 100);
        const rngB = createSeededRng(seed + y * 100);

        claimPlots(matchA, matchA.pending.slice(0, matchA.draftCount), rngA);
        claimPlots(matchB, matchB.pending.slice(0, matchB.draftCount), rngB);

        beginBuild(matchA);
        beginBuild(matchB);

        botBuild(matchA, 0);
        botBuild(matchB, 0);

        finishYear(matchA);
        finishYear(matchB);

        if (y < 6) {
          nextYear(matchA, rngA);
          nextYear(matchB, rngB);
        }
      }

      assert.strictEqual(
        JSON.stringify(matchA),
        JSON.stringify(matchB),
        `Matches with seed ${seed} diverged`
      );
    }
  });
});
