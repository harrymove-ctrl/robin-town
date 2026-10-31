import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app.js';
import { createGame } from '../../src/engine/engine.js';
import { createSeededRandom, parseSeedParam } from '../../src/engine/rng.js';
import type { GameState } from '../../src/engine/types.js';

const silentAudio = new Proxy({}, { get: () => () => false }) as never;

/** Plays draft -> trade -> build -> harvest -> next epoch with the app's own controls. */
function playEpochs(app: RobinTownApp, epochs: number): GameState {
  for (let i = 0; i < epochs; i++) {
    app.quickDraft();
    app.finishTrading();
    app.harvestYield();
    app.advanceToNextYear();
  }
  return app.getGameState() as GameState;
}

const snapshot = (s: GameState) => ({
  year: s.year,
  pending: [...s.pending],
  owners: s.lots.map((l) => l.owner),
  shops: s.lots.map((l) => l.shop),
  tiles: s.players.map((p) => [...p.tiles]),
  cash: s.players.map((p) => p.cash),
  bag: [...s.bag],
});

describe('Seeded RNG for reproducible QA matches', () => {
  it('produces identical sequences for the same seed and different ones otherwise', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const c = createSeededRandom(43);
    const seqA = Array.from({ length: 20 }, a);
    assert.deepEqual(Array.from({ length: 20 }, b), seqA);
    assert.notDeepEqual(Array.from({ length: 20 }, c), seqA);
    assert.ok(seqA.every((x) => x >= 0 && x < 1));
  });

  it('deals the same opening board from createGame for a given seed', () => {
    const g1 = createGame(undefined, createSeededRandom(7));
    const g2 = createGame(undefined, createSeededRandom(7));
    assert.deepEqual(snapshot(g1), snapshot(g2));
    assert.notDeepEqual(createGame(undefined, createSeededRandom(8)).pending, g1.pending);
  });

  it('replays a whole multi-epoch app session identically with the same seed', () => {
    const s1 = snapshot(playEpochs(new RobinTownApp(null, { seed: 1234, audio: silentAudio }), 3));
    const s2 = snapshot(playEpochs(new RobinTownApp(null, { seed: 1234, audio: silentAudio }), 3));
    assert.equal(s1.year, 4);
    assert.deepEqual(s1, s2);
  });

  it('restarts the same deal on a fresh match in a seeded session', () => {
    const app = new RobinTownApp(null, { seed: 99, audio: silentAudio });
    const opening = snapshot(app.getGameState() as GameState);
    playEpochs(app, 1);
    app.startNewGame();
    assert.deepEqual(snapshot(app.getGameState() as GameState), opening);
  });

  it('parses ?seed=<n> and ignores missing or junk values', () => {
    assert.equal(parseSeedParam('?seed=42'), 42);
    assert.equal(parseSeedParam('?view=3d&seed=0'), 0);
    assert.equal(parseSeedParam(''), null);
    assert.equal(parseSeedParam('?seed='), null);
    assert.equal(parseSeedParam('?seed=abc'), null);
    assert.equal(parseSeedParam('?seed=1.5'), null);
  });
});
