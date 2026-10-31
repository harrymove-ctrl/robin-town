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
