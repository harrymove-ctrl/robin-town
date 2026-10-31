/**
 * tests/unit/gameplay-flow.test.ts
 *
 * Covers bot proposals as shown to the player: applyTrade moves cash and parcels without
 * creating or destroying value.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { newGame, draftPlots, applyTrade, validateOffer } from '../../src/engine/engine';
import type { TradeOffer } from '../../src/engine/types';

describe('applyTrade', () => {
  it('swaps cash and a parcel between the player and a bot', () => {
    const state = newGame();
    draftPlots(state, 0, state.pending.slice(0, state.draftCount));
    const lotId = state.lots.find((l) => l.owner === 0)!.id;
    const offer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [lotId] },
      take: { cash: 40, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    };
    assert.ok(validateOffer(state, offer));
    const totalBefore = state.players.reduce((n, p) => n + p.cash, 0);
    const botCash = state.players[1].cash;
    const playerCash = state.players[0].cash;
    applyTrade(state, offer);
    assert.strictEqual(state.lots[lotId].owner, 1);
    assert.strictEqual(state.players[1].cash, botCash - 40);
    assert.strictEqual(state.players[0].cash, playerCash + 40);
    assert.strictEqual(state.players.reduce((n, p) => n + p.cash, 0), totalBefore);
  });
});
