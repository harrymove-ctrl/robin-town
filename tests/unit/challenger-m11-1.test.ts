/**
 * tests/unit/challenger-m11-1.test.ts
 *
 * Empirical Challenger M11.1 Adversarial Stress Test Harness.
 * Validates player scaling invariants, strict tile and parcel conservation,
 * trade validation edge cases, capacity parity, and multiplayer room scaling.
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
  validSave,
  getPlotKeepSchedule,
  getTileDrawSchedule,
} from '../../src/engine/engine';
import { canBuildShop, TOTAL_LOTS } from '../../src/engine/board-layout';
import { NetworkRoom } from '../../src/network/room';
import type { GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createRng(seed = 12345): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function countTotalTiles(state: GameState): number {
  const bagTiles = state.bag.length;
  const handTiles = state.players.reduce(
    (sum, p) => sum + p.tiles.reduce((a, b) => a + b, 0),
    0
  );
  const boardTiles = state.lots.filter((l) => l.shop !== null).length;
  return bagTiles + handTiles + boardTiles;
}

describe('Challenger M11.1 - Suite 1: Multi-Seed 6-Epoch Full Match Simulations (3p, 4p, 5p, 6p)', () => {
  const testSeeds = [42, 101, 777, 1337, 2026, 8888, 99999];

  for (const playerCount of [3, 4, 5, 6]) {
    for (const seed of testSeeds) {
      it(`simulates full 6-year game for ${playerCount} players with seed ${seed}`, () => {
        const players = Array.from({ length: playerCount }, (_, idx) => ({
          name: idx === 0 ? 'Human' : `Bot_${idx}`,
          address: `0x${(idx + 1).toString().padStart(40, '0')}`,
        }));

        const rng = createRng(seed);
        const state = createGame({ players, seed }, rng);

        assert.strictEqual(state.players.length, playerCount);
        assert.strictEqual(state.lots.length, 72);
        assert.strictEqual(countTotalTiles(state), 120, 'Initial tile conservation check');

        for (let year = 1; year <= 6; year++) {
          assert.strictEqual(state.year, year);
          assert.strictEqual(state.phase, 'receive');

          const draftCount = state.draftCount;
          assert.ok(draftCount > 0, `Draft count must be positive in year ${year}`);

          // Draft deeds for human player 0
          const humanPicks = state.pending.slice(0, draftCount);
          draftPlots(state, 0, humanPicks, rng);
          assert.strictEqual(state.phase, 'trade');

          // Check tile conservation after drafting and bot proactive offers
          assert.strictEqual(countTotalTiles(state), 120);

          // Advance to build phase
          beginBuild(state);
          assert.strictEqual(state.phase, 'build');
          assert.strictEqual(countTotalTiles(state), 120);

          // Harvest income and greedy bot builds
          collectIncome(state);
          assert.strictEqual(countTotalTiles(state), 120);

          if (year < 6) {
            assert.strictEqual(state.phase, 'income');
            nextYear(state, rng);
            assert.strictEqual(countTotalTiles(state), 120);
          }
        }

        assert.strictEqual(state.phase, 'ended');
        assert.strictEqual(countTotalTiles(state), 120, 'Final tile conservation check');

        const claimed = state.lots.filter((l) => l.owner !== null).length;
        const vacant = state.lots.filter((l) => l.owner === null).length;

        if (playerCount === 5) {
          assert.strictEqual(claimed, 70, '5-player match must have exactly 70 claimed parcels');
          assert.strictEqual(vacant, 2, '5-player match must have exactly 2 vacant parcels');
        } else {
          assert.strictEqual(claimed, 72, `${playerCount}-player match must have all 72 claimed parcels`);
          assert.strictEqual(vacant, 0, `${playerCount}-player match must have 0 vacant parcels`);
        }
      });
    }
  }
});

describe('Challenger M11.1 - Suite 2: Strict Invariant Verification Across All Phases', () => {
  it('conserves exactly 120 tiles at every single phase transition for 4-player game', () => {
    const rng = createRng(5555);
    const state = createGame(undefined, rng);

    assert.strictEqual(countTotalTiles(state), 120, 'Check 0: createGame');

    for (let year = 1; year <= 6; year++) {
      assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: receive phase start`);

      const picks = state.pending.slice(0, state.draftCount);
      draftPlots(state, 0, picks, rng);
      assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: trade phase after draft`);

      // Execute a test trade during trade phase if assets exist
      if (state.players[0].tiles.some((t) => t > 0) && state.players[1].tiles.some((t) => t > 0)) {
        const giveShop = state.players[0].tiles.findIndex((t) => t > 0);
        const takeShop = state.players[1].tiles.findIndex((t) => t > 0);
        const giveTiles = [0, 0, 0, 0, 0, 0];
        const takeTiles = [0, 0, 0, 0, 0, 0];
        giveTiles[giveShop] = 1;
        takeTiles[takeShop] = 1;

        const offer: TradeOffer = {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: giveTiles, lots: [] },
          take: { cash: 0, tiles: takeTiles, lots: [] },
        };

        if (validateOffer(state, offer)) {
          executeTrade(state, offer);
          assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: after trade execution`);
        }
      }

      advancePhase(state);
      assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: build phase entered`);

      // Place a shop tile manually if player has an empty lot and tile
      const playerLots = state.lots.filter((l) => l.owner === 0 && l.shop === null);
      for (const lot of playerLots) {
        for (let s = 0; s < SHOPS.length; s++) {
          if (canPlace(state, 0, lot.id, s)) {
            buildTile(state, 0, lot.id, s);
            assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: after human buildTile`);
            break;
          }
        }
      }

      collectIncome(state);
      assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: after collectIncome`);

      if (year < 6) {
        nextYear(state, rng);
        assert.strictEqual(countTotalTiles(state), 120, `Year ${year}: after nextYear`);
      }
    }

    assert.strictEqual(state.phase, 'ended');
    assert.strictEqual(countTotalTiles(state), 120, 'Final check after game over');
  });

  it('verifies exact plot schedules and cumulative allotments per player', () => {
    // 3 players: [6,5,4,3,3,3] sum = 24 per player * 3 = 72
    const s3 = getPlotKeepSchedule(3);
    assert.deepStrictEqual(s3, [6, 5, 4, 3, 3, 3]);
    assert.strictEqual(s3.reduce((a, b) => a + b, 0) * 3, 72);

    // 4 players: [5,4,3,2,2,2] sum = 18 per player * 4 = 72
    const s4 = getPlotKeepSchedule(4);
    assert.deepStrictEqual(s4, [5, 4, 3, 2, 2, 2]);
    assert.strictEqual(s4.reduce((a, b) => a + b, 0) * 4, 72);

    // 5 players: [4,3,2,2,2,1] sum = 14 per player * 5 = 70 (leaving 2 vacant)
    const s5 = getPlotKeepSchedule(5);
    assert.deepStrictEqual(s5, [4, 3, 2, 2, 2, 1]);
    assert.strictEqual(s5.reduce((a, b) => a + b, 0) * 5, 70);

    // 6 players: [3,3,2,2,1,1] sum = 12 per player * 6 = 72
    const s6 = getPlotKeepSchedule(6);
    assert.deepStrictEqual(s6, [3, 3, 2, 2, 1, 1]);
    assert.strictEqual(s6.reduce((a, b) => a + b, 0) * 6, 72);
  });

  it('verifies exact tile draw schedules per player count', () => {
    assert.deepStrictEqual(getTileDrawSchedule(3), [6, 5, 5, 5, 5, 5]);
    assert.deepStrictEqual(getTileDrawSchedule(4), [5, 4, 4, 4, 4, 4]);
    assert.deepStrictEqual(getTileDrawSchedule(5), [4, 3, 3, 3, 3, 3]);
    assert.deepStrictEqual(getTileDrawSchedule(6), [4, 3, 3, 2, 2, 2]);
  });
});

describe('Challenger M11.1 - Suite 3: Adversarial Trade Validation & Stress Testing', () => {
  function setupTradeState(): GameState {
    const rng = createRng(123);
    const state = createGame(undefined, rng);
    state.phase = 'trade';
    state.players[0].cash = 100;
    state.players[1].cash = 100;
    state.lots[0].owner = 0;
    state.lots[1].owner = 1;
    return state;
  }

  it('rejects trade when game is not in trade phase', () => {
    const state = setupTradeState();
    state.phase = 'receive';
    const offer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
    };
    assert.throws(() => validateOffer(state, offer), /Deals are available only during the Trade phase/);
  });

  it('rejects partner trading with oneself (proposer == partner)', () => {
    const state = setupTradeState();
    const offer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 0,
      partner: 0,
      give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0] },
    };
    assert.throws(() => validateOffer(state, offer), /Choose a trading partner/);
  });

  it('rejects partner out of range (partner < 0 or partner >= players.length)', () => {
    const state = setupTradeState();
    // Negative partner
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: -1,
          partner: -1,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Choose a trading partner/
    );

    // Partner index 4 in 4-player game (valid indices 0..3)
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 4,
          partner: 4,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Choose a trading partner/
    );
  });

  it('rejects proposer out of range (proposer < 0 or proposer >= players.length)', () => {
    const state = setupTradeState();
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: -1,
          toPlayer: 1,
          partner: 1,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Invalid trade proposer/
    );

    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 4,
          toPlayer: 1,
          partner: 1,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Invalid trade proposer/
    );
  });

  it('rejects negative cash attempts', () => {
    const state = setupTradeState();
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: -50, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );

    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: -20, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );
  });

  it('rejects non-integer cash amounts', () => {
    const state = setupTradeState();
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 12.5, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );
  });

  it('rejects cash exceeding current balance', () => {
    const state = setupTradeState();
    // Proposer has 100, attempts to offer 101
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 101, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );

    // Partner has 100, proposer attempts to take 200
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 50, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 200, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Cash must be a whole number within the owner’s balance/
    );
  });

  it('rejects empty trade with zero assets on both sides', () => {
    const state = setupTradeState();
    const emptyOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.throws(() => validateOffer(state, emptyOffer), /Add cash, a shop tile, or a plot to the deal/);
  });

  it('accepts zero-cash trades when non-cash assets are present', () => {
    const state = setupTradeState();
    const validZeroCashTrade: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
    };
    assert.strictEqual(validateOffer(state, validZeroCashTrade), true);
  });

  it('rejects invalid parcel IDs and unowned parcels', () => {
    const state = setupTradeState();
    // Negative parcel ID
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [-1] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );

    // Parcel ID out of bounds (72)
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [72] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );

    // Offering lot 1 which is owned by player 1, not player 0
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );

    // Duplicate parcel in lots array
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0, 0] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /Each plot can be offered once by its current owner/
    );
  });

  it('rejects trading more tiles than held or negative tiles', () => {
    const state = setupTradeState();
    state.players[0].tiles = [1, 0, 0, 0, 0, 0];

    // Offering 2 tiles when holding only 1
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [2, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /A player cannot trade more shop tiles than they hold/
    );

    // Offering negative tile count
    assert.throws(
      () =>
        validateOffer(state, {
          fromPlayer: 0,
          toPlayer: 1,
          partner: 1,
          give: { cash: 0, tiles: [-1, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        }),
      /A player cannot trade more shop tiles than they hold/
    );
  });
});

describe('Challenger M11.1 - Suite 4: Save State Validation & Room Multiplayer Capacity', () => {
  it('validates save states with 3, 4, 5, and 6 players', () => {
    const rng = createRng(111);
    for (const count of [3, 4, 5, 6]) {
      const players = Array.from({ length: count }, (_, i) => ({
        name: `P${i}`,
        address: `0x${(i + 1).toString().padStart(40, '0')}`,
      }));
      const state = createGame({ players }, rng);
      assert.strictEqual(validSave(state), true, `State with ${count} players must be valid`);
    }

    // Invalid save states: 2 players, 7 players, bad lots count
    const base = createGame(undefined, rng);
    assert.strictEqual(validSave({ ...base, players: base.players.slice(0, 2) }), false);
    assert.strictEqual(
      validSave({
        ...base,
        players: [...base.players, ...base.players.slice(0, 3)], // 7 players
      }),
      false
    );
    assert.strictEqual(validSave({ ...base, lots: base.lots.slice(0, 50) }), false);
    assert.strictEqual(validSave({ ...base, year: 7 }), false);
    assert.strictEqual(validSave({ ...base, year: 0 }), false);
  });

  it('clamps and configures NetworkRoom maxPlayers between 3 and 6', () => {
    const baseConfig = {
      roomCode: 'TEST01',
      isHost: true,
      localPlayer: { name: 'Host', address: '0x1000000000000000000000000000000000000001' },
    };

    // Default maxPlayers is 4
    const roomDefault = new NetworkRoom(baseConfig);
    assert.strictEqual(roomDefault.state.maxPlayers, 4);

    // Explicit 3, 5, 6
    const room3 = new NetworkRoom({ ...baseConfig, roomCode: 'ROOM03', maxPlayers: 3 });
    assert.strictEqual(room3.state.maxPlayers, 3);

    const room5 = new NetworkRoom({ ...baseConfig, roomCode: 'ROOM05', maxPlayers: 5 });
    assert.strictEqual(room5.state.maxPlayers, 5);

    const room6 = new NetworkRoom({ ...baseConfig, roomCode: 'ROOM06', maxPlayers: 6 });
    assert.strictEqual(room6.state.maxPlayers, 6);

    // Clamping: < 3 clamped to 3, > 6 clamped to 6
    const roomUnder = new NetworkRoom({ ...baseConfig, roomCode: 'ROOM02', maxPlayers: 2 });
    assert.strictEqual(roomUnder.state.maxPlayers, 3);

    const roomOver = new NetworkRoom({ ...baseConfig, roomCode: 'ROOM09', maxPlayers: 9 });
    assert.strictEqual(roomOver.state.maxPlayers, 6);
  });

  it('handles room seat assignment bounds for 3 and 5 player configurations', () => {
    const baseConfig = {
      isHost: true,
      localPlayer: { name: 'Host', address: '0x1000000000000000000000000000000000000001' },
    };
    const room3 = new NetworkRoom({ ...baseConfig, roomCode: 'SEAT03', maxPlayers: 3 });
    assert.throws(() => room3.setSeat(3), /0, 1, or 2/);
    assert.throws(() => room3.setSeat(-1), /0, 1, or 2/);

    const room5 = new NetworkRoom({ ...baseConfig, roomCode: 'SEAT05', maxPlayers: 5 });
    assert.throws(() => room5.setSeat(5), /0, 1, 2, 3, or 4/);
    assert.throws(() => room5.setSeat(-1), /0, 1, 2, 3, or 4/);
  });
});

describe('Challenger M11.1 - Suite 5: Capacity Validation and Dynamic Bot Archetypes', () => {
  it('strictly rejects shop expansion adjacent to complete business in engine.ts and board-layout.ts', () => {
    const rng = createRng(303);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // Lot 0, 1, 2 are in District 0. Shop 0 (DEX) target size = 3
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;

    // Lot 4 is adjacent to Lot 0 and in District 0
    state.lots[4].owner = 0;
    state.lots[4].shop = null;
    state.players[0].tiles[0] = 5;

    assert.strictEqual(canPlace(state, 0, 4, 0), false);
    assert.throws(() => buildTile(state, 0, 4, 0), /already completed at maximum capacity/);

    // Verification that canBuildShop and canPlace give identical rejection
    const directCheck = canBuildShop(state.lots, 4, 0, 0, 5);
    assert.strictEqual(directCheck.valid, false);
    assert.ok(directCheck.reason?.includes('already completed at maximum capacity'));
  });

  it('strictly rejects placements that merge clusters into oversized business (> target size)', () => {
    const rng = createRng(404);
    const state = createGame(undefined, rng);
    state.phase = 'build';

    // Cluster A: lot 3 and 4 (size 2)
    state.lots[3].owner = 0;
    state.lots[3].shop = 0;
    state.lots[4].owner = 0;
    state.lots[4].shop = 0;

    // Cluster B: lot 2 and 6 (size 2)
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;
    state.lots[6].owner = 0;
    state.lots[6].shop = 0;

    // Bridging lot 5 connects both clusters: 2 + 2 + 1 = 5 > 3
    state.lots[5].owner = 0;
    state.lots[5].shop = null;
    state.players[0].tiles[0] = 2;

    assert.strictEqual(canPlace(state, 0, 5, 0), false);
    assert.throws(() => buildTile(state, 0, 5, 0), /exceeds maximum capacity/);
  });
});
