/**
 * tests/unit/hud-dock.test.ts
 *
 * View-model coverage for the HUD ribbon, phase stepper and bottom dock:
 * adjacency badges on candidate deeds, payout curves on module slots,
 * per-player yield and parcel capacity.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { newGame } from '../../src/engine/engine';
import { plotNeighbors } from '../../src/engine/board-layout';
import {
  payoutCurveText,
  projectDrawerViewModel,
  projectPlayerRibbonViewModel,
  projectTopBarViewModel,
} from '../../src/ui/hud';

describe('HUD dock view models', () => {
  it('flags candidate deeds that neighbour a parcel the player owns', () => {
    const state = newGame();
    state.lots.forEach((lot) => (lot.owner = null));
    const owned = 20;
    state.lots[owned].owner = 0;
    const neighbour = plotNeighbors(owned)[0];
    const far = state.lots.find((l) => l.id !== owned && !plotNeighbors(owned).includes(l.id))!.id;
    state.pending = [neighbour, far];

    const drawer = projectDrawerViewModel(state, 0);
    assert.strictEqual(drawer.mode, 'draft');
    const byLot = new Map(drawer.draftDeeds.map((d) => [d.lotId, d]));
    assert.strictEqual(byLot.get(neighbour)!.isAdjacent, true);
    assert.strictEqual(byLot.get(far)!.isAdjacent, false);
  });

  it('does not treat a bot-owned neighbour as adjacent for the player', () => {
    const state = newGame();
    state.lots.forEach((lot) => (lot.owner = null));
    state.lots[20].owner = 2;
    const neighbour = plotNeighbors(20)[0];
    state.pending = [neighbour];
    assert.strictEqual(projectDrawerViewModel(state, 0).draftDeeds[0].isAdjacent, false);
    assert.strictEqual(projectDrawerViewModel(state, 2).draftDeeds[0].isAdjacent, true);
  });

  it('shows the full district name and lot number on each deed', () => {
    const state = newGame();
    const deed = projectDrawerViewModel(state, 0).draftDeeds[0];
    assert.strictEqual(deed.lotNumber, deed.lotId + 1);
    assert.ok(deed.districtName.length > 6);
  });

  it('lists payout curves and complete payouts on module slots', () => {
    const state = newGame();
    state.phase = 'build';
    const drawer = projectDrawerViewModel(state, 0);
    assert.strictEqual(drawer.mode, 'modules');
    assert.deepStrictEqual(
      drawer.modules.map((m) => m.completePayout),
      [50, 50, 80, 80, 110, 140]
    );
    assert.strictEqual(payoutCurveText(3), '1: 10, 2: 20, COMPLETE (3): 50 $wif');
    assert.strictEqual(
      payoutCurveText(6),
      '1: 10, 2: 20, 3: 40, 4: 60, 5: 80, COMPLETE (6): 140 $wif'
    );
  });

  it('reports parcel capacity and annual yield per player', () => {
    const state = newGame();
    const ribbon = projectPlayerRibbonViewModel(state);
    assert.strictEqual(ribbon.players.length, 4);
    for (const p of ribbon.players) {
      assert.strictEqual(p.parcelCapacity, 18);
      assert.strictEqual(p.annualYield, 0);
      assert.match(p.avatarHd, /_hd\.png$/);
    }
  });

  it('marks phase steps done, current and todo in order', () => {
    const state = newGame();
    const statuses = (phase: typeof state.phase) => {
      state.phase = phase;
      return projectTopBarViewModel(state).phaseSteps.map((s) => s.status);
    };
    assert.deepStrictEqual(statuses('receive'), ['current', 'todo', 'todo', 'todo', 'todo']);
    assert.deepStrictEqual(statuses('build'), ['done', 'done', 'current', 'todo', 'todo']);
    assert.deepStrictEqual(statuses('ended'), ['done', 'done', 'done', 'done', 'current']);
    assert.deepStrictEqual(
      projectTopBarViewModel(state).phaseSteps.map((s) => s.label),
      ['Allocation', 'Trade', 'Build', 'Harvest', 'Settlement']
    );
  });
});
