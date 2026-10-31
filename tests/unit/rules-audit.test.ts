/**
 * tests/unit/rules-audit.test.ts
 *
 * Audit of the Chinatown / saigon-town rule invariants: parcel and tile
 * conservation, per-epoch schedules, block-internal adjacency, payout table
 * and final ranking tie-breakers.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  newGame,
  startYear,
  draftPlots,
  beginBuild,
  buildTile,
  canPlace,
  validateOffer,
  applyTrade,
  collectIncome,
  nextYear,
  groupIncome,
  rankings,
  SHOPS,
  PLOT_KEEP_SCHEDULE,
  TILE_DEAL_SCHEDULE,
  COMPLETE,
  INCOMPLETE,
} from '../../src/engine/engine';
import {
  LOT_DEFINITIONS,
  ADJACENCY_GRAPH,
  TOTAL_LOTS,
  canBuildShop,
} from '../../src/engine/board-layout';

const EXPECTED_PENDING = [7, 6, 5, 4, 4, 4];
const EXPECTED_KEEP = [5, 4, 3, 2, 2, 2];

function playFullGame() {
  const state = newGame();
  const snapshots: { claimed: number; tiles: number; bag: number; pending: number }[] = [];
  for (let epoch = 1; epoch <= 6; epoch++) {
    if (epoch > 1) nextYear(state);
    const pending = state.pending.length;
    draftPlots(state, 0, state.pending.slice(0, state.draftCount));
    beginBuild(state);
    const tiles = state.players.reduce((n, p) => n + p.tiles.reduce((a, b) => a + b, 0), 0);
    snapshots.push({
      claimed: state.lots.filter((l) => l.owner !== null).length,
      tiles,
      bag: state.bag.length,
      pending,
    });
    collectIncome(state);
  }
  return { state, snapshots };
}

describe('rules audit: parcels and tiles', () => {
  it('has exactly 72 unique parcels across 6 districts of 12', () => {
    assert.strictEqual(LOT_DEFINITIONS.length, 72);
    assert.strictEqual(new Set(LOT_DEFINITIONS.map((l) => l.id)).size, 72);
    const perBlock = new Map<number, number>();
    for (const l of LOT_DEFINITIONS) perBlock.set(l.block, (perBlock.get(l.block) ?? 0) + 1);
    assert.strictEqual(perBlock.size, 6);
    for (const n of perBlock.values()) assert.strictEqual(n, 12);
  });

  it('follows the deal / keep schedule and claims all 72 parcels by epoch 6', () => {
    assert.deepStrictEqual(PLOT_KEEP_SCHEDULE, EXPECTED_KEEP);
    const { state, snapshots } = playFullGame();
    let claimed = 0;
    snapshots.forEach((s, i) => {
      claimed += EXPECTED_KEEP[i] * 4;
      assert.strictEqual(s.pending, EXPECTED_PENDING[i], `epoch ${i + 1} dealt`);
      assert.strictEqual(s.claimed, claimed, `epoch ${i + 1} claimed`);
    });
    assert.strictEqual(state.lots.filter((l) => l.owner !== null).length, 72);
  });

  it('discarded deeds stay unowned and remain available', () => {
    const state = newGame();
    const dealt = [...state.pending];
    const kept = dealt.slice(0, state.draftCount);
    draftPlots(state, 0, kept);
    const unkept = dealt.filter((id) => !kept.includes(id));
    assert.strictEqual(new Set(state.lots.filter((l) => l.owner !== null).map((l) => l.id)).size, 20);
    assert.ok(unkept.length > 0);
    assert.deepStrictEqual(state.pending, []);
  });

  it('returns discarded deeds to the pool and re-deals them in later epochs', () => {
    const state = newGame();
    const dealt = [...state.pending];
    const kept = dealt.slice(0, state.draftCount);
    draftPlots(state, 0, kept);
    const unkept = dealt.filter((id) => !kept.includes(id) && state.lots[id].owner === null);
    assert.ok(unkept.length > 0, 'at least one discarded deed stays unowned');
    for (const id of unkept) assert.strictEqual(state.lots[id].owner, null, `deed ${id}`);

    beginBuild(state);
    collectIncome(state);
    // An order-preserving rng deals the lowest unowned ids first, so a discarded
    // deed with a low id must come back in the next epoch's candidates.
    let tick = 0;
    nextYear(state, () => (tick++) / 1e6);
    const unowned = state.lots.filter((l) => l.owner === null).map((l) => l.id);
    assert.deepStrictEqual(state.pending, unowned.slice(0, state.pending.length));
    for (const id of state.pending) assert.strictEqual(state.lots[id].owner, null);
    const lowestUnkept = Math.min(...unkept);
    if (unowned.indexOf(lowestUnkept) < state.pending.length) {
      assert.ok(state.pending.includes(lowestUnkept), 'discarded deed re-dealt');
    }
  });

  it('defines the 6 shop categories with exact names, codes, target sizes and quotas', () => {
    assert.deepStrictEqual(
      SHOPS.map((s) => [s.name, s.code, s.size, s.quota]),
      [
        ['DEX Swap', 'DX', 3, 20],
        ['Memecoin Lounge', 'ML', 3, 20],
        ['Staking Vault', 'SV', 4, 20],
        ['Lending Protocol', 'LP', 4, 20],
        ['Derivatives Exchange', 'DE', 5, 20],
        ['Validator Citadel', 'VC', 6, 20],
      ]
    );
    assert.strictEqual(SHOPS.reduce((n, s) => n + s.quota, 0), 120);
  });

  it('keeps the 120-tile bag conserved: 20 per category, 100 drawn, 20 left', () => {
    assert.strictEqual(SHOPS.length, 6);
    const fresh = newGame();
    startYear(fresh);
    const total = (s: typeof fresh) =>
      s.bag.length + s.players.reduce((n, p) => n + p.tiles.reduce((a, b) => a + b, 0), 0) +
      s.lots.filter((l) => l.shop !== null).length;
    assert.strictEqual(total(fresh), 120);
    assert.deepStrictEqual(TILE_DEAL_SCHEDULE, [5, 4, 4, 4, 4, 4]);
    const { state, snapshots } = playFullGame();
    assert.strictEqual(snapshots[0].bag, 120 - 20);
    assert.strictEqual(state.bag.length, 20);
    assert.strictEqual(total(state), 120);
  });
});

describe('rules audit: adjacency and payouts', () => {
  it('connects parcels iff same block and orthogonally adjacent', () => {
    for (const a of LOT_DEFINITIONS) {
      for (const b of LOT_DEFINITIONS) {
        if (a.id === b.id) continue;
        const expected =
          a.block === b.block && Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
        assert.strictEqual(ADJACENCY_GRAPH[a.id].includes(b.id), expected, `${a.id}-${b.id}`);
      }
    }
    assert.strictEqual(ADJACENCY_GRAPH.length, TOTAL_LOTS);
  });

  it('uses the non-linear payout tables with a jump of at least +30 on completion', () => {
    assert.deepStrictEqual([...INCOMPLETE], [0, 10, 20, 40, 60, 80]);
    assert.deepStrictEqual([...COMPLETE], [0, 0, 0, 50, 80, 110, 140]);
    SHOPS.forEach((shop, type) => {
      assert.ok(COMPLETE[shop.size] - INCOMPLETE[shop.size - 1] >= 30, SHOPS[type].name);
      assert.strictEqual(groupIncome(type, shop.size), COMPLETE[shop.size]);
    });
  });

  it('blocks expanding a completed cluster in canBuildShop', () => {
    const state = newGame();
    const block = LOT_DEFINITIONS.filter((l) => l.block === LOT_DEFINITIONS[0].block);
    const lots = state.lots;
    const type = 0; // size 3
    const path: number[] = [block[0].id];
    while (path.length < 3) {
      const next = ADJACENCY_GRAPH[path[path.length - 1]].find((n) => !path.includes(n));
      assert.notStrictEqual(next, undefined);
      path.push(next as number);
    }
    for (const id of path) {
      lots[id].owner = 0;
      lots[id].shop = type;
    }
    const extra = ADJACENCY_GRAPH[path[2]].find((n) => !path.includes(n))!;
    lots[extra].owner = 0;
    const result = canBuildShop(lots, extra, 0, type);
    assert.strictEqual(result.valid, false);
  });

  it('engine buildTile agrees with canBuildShop on completed clusters', () => {
    const state = newGame();
    draftPlots(state, 0, state.pending.slice(0, state.draftCount));
    beginBuild(state);
    const block = LOT_DEFINITIONS.filter((l) => l.block === LOT_DEFINITIONS[0].block);
    const type = 0; // size 3
    const path: number[] = [block[0].id];
    while (path.length < 3) {
      path.push(ADJACENCY_GRAPH[path[path.length - 1]].find((n) => !path.includes(n))!);
    }
    const extra = ADJACENCY_GRAPH[path[2]].find((n) => !path.includes(n))!;
    for (const id of [...path, extra]) {
      state.lots[id].owner = 0;
      state.lots[id].shop = null;
    }
    state.players[0].tiles[type] = 4;
    for (const id of path) buildTile(state, 0, id, type);

    assert.strictEqual(canBuildShop(state.lots, extra, 0, type, 1).valid, false);
    assert.strictEqual(canPlace(state, 0, extra, type), false);
    assert.throws(() => buildTile(state, 0, extra, type));
    assert.strictEqual(state.lots[extra].shop, null);
    assert.strictEqual(state.players[0].tiles[type], 1);
  });
});

describe('rules audit: OTC trade assets', () => {
  function tradeState() {
    const state = newGame();
    draftPlots(state, 0, state.pending.slice(0, state.draftCount));
    assert.strictEqual(state.phase, 'trade');
    return state;
  }

  it('accepts and moves cash, rack tiles and parcels together in one bilateral deal', () => {
    const state = tradeState();
    const me = state.players[0];
    const bot = state.players[1];
    const myTile = me.tiles.findIndex((n) => n > 0);
    const botTile = bot.tiles.findIndex((n) => n > 0);
    const myLot = state.lots.find((l) => l.owner === 0)!.id;
    const botLot = state.lots.find((l) => l.owner === 1)!.id;
    const give = { cash: 5, tiles: [0, 0, 0, 0, 0, 0], lots: [myLot] };
    const take = { cash: 3, tiles: [0, 0, 0, 0, 0, 0], lots: [botLot] };
    give.tiles[myTile] = 1;
    take.tiles[botTile] = 1;
    const offer = { partner: 1, fromPlayer: 0, toPlayer: 1, give, take };
    const before = { meCash: me.cash, botCash: bot.cash, meTiles: [...me.tiles], botTiles: [...bot.tiles] };

    assert.strictEqual(validateOffer(state, offer), true);
    applyTrade(state, offer);

    assert.strictEqual(me.cash, before.meCash - 5 + 3);
    assert.strictEqual(bot.cash, before.botCash + 5 - 3);
    assert.strictEqual(state.lots[myLot].owner, 1);
    assert.strictEqual(state.lots[botLot].owner, 0);
    assert.deepStrictEqual(me.tiles, before.meTiles.map((n, s) => n - give.tiles[s] + take.tiles[s]));
    assert.deepStrictEqual(bot.tiles, before.botTiles.map((n, s) => n + give.tiles[s] - take.tiles[s]));
  });

  it('allows offering a built parcel and keeps its placed shop', () => {
    const state = tradeState();
    const myLot = state.lots.find((l) => l.owner === 0)!;
    myLot.shop = 2;
    const offer = {
      partner: 1, fromPlayer: 0, toPlayer: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [myLot.id] },
      take: { cash: 1, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.strictEqual(validateOffer(state, offer), true);
    applyTrade(state, offer);
    assert.strictEqual(myLot.owner, 1);
    assert.strictEqual(myLot.shop, 2);
  });

  it('rejects trading more tiles than held, and any deal outside the trade phase', () => {
    const state = tradeState();
    const empty = state.players[0].tiles.findIndex((n) => n === 0);
    const tooMany = [0, 0, 0, 0, 0, 0];
    tooMany[empty === -1 ? 0 : empty] = (state.players[0].tiles[empty === -1 ? 0 : empty] ?? 0) + 1;
    const base = { partner: 1, fromPlayer: 0, toPlayer: 1, take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] } };
    assert.throws(() => validateOffer(state, { ...base, give: { cash: 0, tiles: tooMany, lots: [] } }));

    const ok = { ...base, give: { cash: 1, tiles: [0, 0, 0, 0, 0, 0], lots: [] } };
    assert.strictEqual(validateOffer(state, ok), true);
    for (const phase of ['receive', 'build', 'income', 'ended'] as const) {
      state.phase = phase;
      assert.throws(() => validateOffer(state, ok), /Trade phase/, phase);
    }
  });
});

describe('rules audit: ranking tie-breakers', () => {
  it('orders by cash, then deployed shops, then owned parcels', () => {
    const state = newGame();
    state.players.forEach((p) => (p.cash = 100));
    state.lots.forEach((l) => { l.owner = null; l.shop = null; });
    // player 1: more cash wins
    state.players[1].cash = 200;
    // players 2 and 3 tie on cash; 3 has more shops
    state.lots[0].owner = 3; state.lots[0].shop = 0;
    state.lots[1].owner = 2;
    state.lots[2].owner = 2;
    // players 0 vs 2: same cash and shops(0) -> parcels
    const order = rankings(state).map((p) => p.id);
    assert.deepStrictEqual(order, [1, 3, 2, 0]);
  });
});
