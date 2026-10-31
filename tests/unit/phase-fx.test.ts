import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/engine/engine.js';
import { LOT_DEFINITIONS, CELL_SIZE, plotNeighbors } from '../../src/engine/board-layout.js';
import type { GameState } from '../../src/engine/types.js';
import {
  CLAIM_FLASH_MS,
  CLAIM_FLY_MS,
  PLAYER_COLORS,
  claimFlightState,
  claimOrigin,
} from '../../src/ui/board.js';
import { buildClaimFlashes, buildHarvestEffects, epochContinueLabel } from '../../src/ui/phase-fx.js';
import { HudManager } from '../../src/ui/hud.js';

describe('Phase 5: epoch summary continue label', () => {
  it('points at the next epoch for epochs 1..5', () => {
    for (let y = 1; y <= 5; y++) assert.equal(epochContinueLabel(y), `Continue to Epoch ${y + 1}`);
  });

  it('never offers "Epoch 7": the last epoch leads into the final settlement', () => {
    assert.equal(epochContinueLabel(6), 'View Final Settlement');
    assert.ok(!epochContinueLabel(6).includes('7'));
  });
});

describe('Phase 1: claim flight animation', () => {
  it('launches the human token from the bottom tray and bot tokens from the top ribbon', () => {
    assert.ok(claimOrigin(0).y > 0);
    for (const bot of [1, 2, 3]) assert.ok(claimOrigin(bot).y < 0);
    assert.ok(claimOrigin(1).x < claimOrigin(2).x && claimOrigin(2).x < claimOrigin(3).x);
  });

  it('flies from the origin onto the parcel centre, then rings out and expires', () => {
    const flash = { lotId: 10, color: PLAYER_COLORS[2], start: 1000, ownerId: 2 };
    const def = LOT_DEFINITIONS[10];
    const centre = { x: def.x + CELL_SIZE / 2, y: def.y + CELL_SIZE / 2 };

    assert.equal(claimFlightState(flash, 999), null, 'not launched yet');
    const launch = claimFlightState(flash, 1000)!;
    assert.deepEqual({ x: launch.x, y: launch.y }, claimOrigin(2));
    assert.equal(launch.landed, false);

    const mid = claimFlightState(flash, 1000 + CLAIM_FLY_MS / 2)!;
    assert.ok(mid.progress > 0 && mid.progress < 1);

    const landed = claimFlightState(flash, 1000 + CLAIM_FLY_MS)!;
    assert.equal(landed.landed, true);
    assert.deepEqual({ x: landed.x, y: landed.y }, centre);

    assert.equal(claimFlightState(flash, 1000 + CLAIM_FLY_MS + CLAIM_FLASH_MS + 1), null);
  });

  it('builds one staggered, owner-coloured flash for every parcel claimed in the draft', () => {
    const state = createGame();
    const before = state.lots.map((l) => l.owner);
    state.lots[3].owner = 0;
    state.lots[7].owner = 0;
    state.lots[20].owner = 2;
    const flashes = buildClaimFlashes(before, state, 500, 100);
    assert.deepEqual(flashes.map((f) => [f.lotId, f.ownerId]), [[3, 0], [7, 0], [20, 2]]);
    assert.deepEqual(flashes.map((f) => f.start), [500, 600, 700]);
    assert.equal(flashes[2].color, PLAYER_COLORS[2]);
  });
});

/** Gives `player` a connected run of `count` lots of `shop`, starting at `seed`. */
function placeRun(state: GameState, player: number, shop: number, seed: number, count: number): number[] {
  const run = [seed];
  while (run.length < count) {
    const next = run.flatMap((id) => plotNeighbors(id)).find((n) => !run.includes(n) && state.lots[n].owner === null);
    assert.ok(next !== undefined, 'board has room for the run');
    run.push(next);
  }
  for (const id of run) {
    state.lots[id].owner = player;
    state.lots[id].shop = shop;
  }
  return run;
}

describe('Phase 4: harvest highlights every player', () => {
  it('lights up scoring clusters and raises badges for all four players, boosting only the human', () => {
    const state = createGame();
    for (const l of state.lots) { l.owner = null; l.shop = null; }
    placeRun(state, 0, 0, 0, 3); // human: complete DEX (size 3)
    placeRun(state, 1, 2, 30, 2); // Sherwood: partial vault
    placeRun(state, 3, 0, 60, 3); // Luna: complete DEX

    const fx = buildHarvestEffects(state, true, 0, 100);
    const owners = fx.glows.map((g) => PLAYER_COLORS.indexOf(g.color));
    assert.deepEqual(owners, [0, 1, 3]);
    assert.deepEqual(fx.glows.map((g) => g.complete), [true, false, true]);
    assert.equal(fx.floaters.length, 3);
    assert.match(fx.floaters[0].text, /x1\.20/, 'human badge shows the staking boost');
    assert.doesNotMatch(fx.floaters[1].text, /x1\.20/);
    assert.doesNotMatch(fx.floaters[2].text, /x1\.20/);
    assert.equal(fx.floaters[2].color, PLAYER_COLORS[3]);
    assert.deepEqual(fx.floaters.map((f) => f.start), [0, 100, 200]);
  });

  it('skips the boost when unstaked', () => {
    const state = createGame();
    for (const l of state.lots) { l.owner = null; l.shop = null; }
    placeRun(state, 0, 0, 0, 3);
    const fx = buildHarvestEffects(state, false, 0);
    assert.doesNotMatch(fx.floaters[0].text, /x1\.20/);
  });
});

describe('Phase 1: deed tray counter', () => {
  it('reads exactly "Selected X / Y deeds"', () => {
    const container = { innerHTML: '', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement;
    const hud = new HudManager(container, {} as never);
    const state = createGame();
    hud.render(state, [state.pending[0]], null, 'Sim', false);
    assert.ok(container.innerHTML.includes(`Selected 1 / ${state.draftCount} deeds`), 'tray counter text');
  });
});
