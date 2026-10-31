import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app.js';
import { findMutualSwap, generateBotTradeOffer } from '../../src/engine/bot.js';
import { plotNeighbors } from '../../src/engine/board-layout.js';
import { applyTrade, createGame, validateOffer } from '../../src/engine/engine.js';
import type { GameState, TradeOffer } from '../../src/engine/types.js';
import { FLOATER_MS } from '../../src/ui/board.js';
import { ORDER_FILLED_STAMP, TradeDeskController, TradeDeskModal, formatMargin } from '../../src/ui/trade-desk.js';
import { describeProposal } from '../../src/ui/phase-fx.js';

function blankTradeState(): GameState {
  const state = createGame();
  for (const l of state.lots) {
    l.owner = null;
    l.shop = null;
    l.isComplete = false;
  }
  for (const p of state.players) p.tiles = [0, 0, 0, 0, 0, 0];
  state.pending = [];
  state.phase = 'trade';
  return state;
}

/** A simple path a-b-c-d of lots where only consecutive lots touch. */
function findPath(): [number, number, number, number] {
  for (let a = 0; a < 72; a++) {
    for (const b of plotNeighbors(a)) {
      for (const c of plotNeighbors(b)) {
        if (c === a || plotNeighbors(a).includes(c)) continue;
        for (const d of plotNeighbors(c)) {
          if (d === b || d === a || plotNeighbors(a).includes(d) || plotNeighbors(b).includes(d)) continue;
          return [a, b, c, d];
        }
      }
    }
  }
  throw new Error('no path');
}

const friendlyNeighbours = (state: GameState, lotId: number, owner: number) =>
  plotNeighbors(lotId).filter((n) => state.lots[n].owner === owner).length;

describe('Incoming bot proposals: mutually beneficial cluster swaps', () => {
  it('proposes a parcel-for-parcel swap that joins up holdings for both sides', () => {
    const state = blankTradeState();
    const [a, b, c, d] = findPath();
    state.lots[a].owner = 1; // Sherwood
    state.lots[b].owner = 0; // human parcel wedged against Sherwood
    state.lots[c].owner = 1; // Sherwood parcel wedged against the human
    state.lots[d].owner = 0;

    const swap = findMutualSwap(1, 0, state);
    assert.ok(swap, 'a swap is found');
    assert.equal(swap.kind, 'parcel-swap');
    assert.ok(swap.botGain > 0 && swap.targetGain > 0);
    assert.deepEqual(swap.offer.take.lots, [b], 'bot asks for the human parcel it borders');
    assert.deepEqual(swap.offer.give.lots, [c], 'bot gives the parcel next to the human');
    assert.equal(swap.offer.give.cash + swap.offer.take.cash, 0);

    const offer = generateBotTradeOffer(1, 0, state)!;
    assert.deepEqual(offer, swap.offer, 'swaps take priority over cash bids');

    // Express it as the human's trade and apply: both sides end up more connected.
    const human: TradeOffer = { fromPlayer: 0, toPlayer: 1, partner: 1, give: offer.take, take: offer.give };
    assert.ok(validateOffer(state, human));
    applyTrade(state, human);
    assert.equal(state.lots[b].owner, 1);
    assert.equal(state.lots[c].owner, 0);
    assert.ok(friendlyNeighbours(state, b, 1) > 0);
    assert.ok(friendlyNeighbours(state, c, 0) > 0);
  });

  it('proposes a tile-for-tile swap when each side holds the tile the other can cluster with', () => {
    const state = blankTradeState();
    const [a, b, x, y] = findPath();
    // Luna: open Memecoin (shop 1) cluster at a with vacant b beside it, holding a loose Vault (2) tile.
    state.lots[a].owner = 3; state.lots[a].shop = 1;
    state.lots[b].owner = 3;
    state.players[3].tiles[2] = 1;
    // Human: open Vault cluster at x with vacant y beside it, holding a Memecoin tile they cannot use.
    state.lots[x].owner = 0; state.lots[x].shop = 2;
    state.lots[y].owner = 0;
    state.players[0].tiles[1] = 1;
    const swap = findMutualSwap(3, 0, state);
    assert.ok(swap);
    assert.equal(swap.kind, 'tile-swap', 'Luna leads with loose-tile swaps');
    assert.deepEqual(swap.offer.give.tiles, [0, 0, 1, 0, 0, 0]);
    assert.deepEqual(swap.offer.take.tiles, [0, 1, 0, 0, 0, 0]);
  });

  it('finds nothing when no swap helps both sides', () => {
    const state = blankTradeState();
    state.lots[0].owner = 1;
    state.lots[71].owner = 0;
    assert.equal(findMutualSwap(1, 0, state), null);
  });

  it('describes swaps and cash bids from the human side', () => {
    const swapText = describeProposal('Sherwood', {
      fromPlayer: 0, toPlayer: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [4] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [9] },
    });
    assert.match(swapText, /cluster swap/);
    assert.match(swapText, /Parcel 10.*for your.*Parcel 5/);
    const cashText = describeProposal('Apex', {
      fromPlayer: 0, toPlayer: 2,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [4] },
      take: { cash: 40, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
    });
    assert.match(cashText, /offers: <strong>40 \$wif<\/strong> for your <strong>Parcel 5/);
  });
});

describe('OTC desk preloading', () => {
  it('openTradeDesk(partner, lot) preloads that bot parcel into the take side', () => {
    const app = new RobinTownApp(null);
    const state = app.getGameState() as GameState;
    state.phase = 'trade';
    const lot = state.lots.find((l) => l.owner === null)!;
    lot.owner = 2;
    app.openTradeDesk(2, lot.id);
    const desk = app.getTradeDeskController().getDeskState();
    assert.equal(desk.isOpen, true);
    assert.equal(desk.partnerId, 2);
    assert.deepEqual(desk.take.lots, [lot.id]);
    assert.deepEqual(desk.give.lots, []);
  });

  it('infers the partner from the parcel owner and ignores parcels the partner does not own', () => {
    const state = blankTradeState();
    state.lots[5].owner = 3;
    state.lots[6].owner = 0;
    const desk = new TradeDeskController(state);
    desk.open(undefined, 5);
    assert.equal(desk.getDeskState().partnerId, 3);
    assert.deepEqual(desk.getDeskState().take.lots, [5]);
    desk.open(1, 6);
    assert.deepEqual(desk.getDeskState().take.lots, []);
  });

  it('Counter opens the desk prefilled with the proposal terms', () => {
    const app = new RobinTownApp(null);
    const state = app.getGameState() as GameState;
    state.phase = 'trade';
    const free = state.lots.filter((l) => l.owner === null);
    free[0].owner = 0;
    free[1].owner = 1;
    state.players[0].tiles[3] = 1;
    const offer: TradeOffer = {
      fromPlayer: 0, toPlayer: 1, partner: 1,
      give: { cash: 0, tiles: [0, 0, 0, 1, 0, 0], lots: [free[0].id] },
      take: { cash: 12, tiles: [0, 0, 0, 0, 0, 0], lots: [free[1].id] },
    };
    (app as unknown as { incomingOffers: TradeOffer[] }).incomingOffers = [offer];
    app.counterProposal(0);
    const desk = app.getTradeDeskController().getDeskState();
    assert.equal(desk.isOpen, true);
    assert.equal(desk.partnerId, 1);
    assert.deepEqual(desk.give.lots, [free[0].id]);
    assert.deepEqual(desk.give.tiles, [0, 0, 0, 1, 0, 0]);
    assert.deepEqual(desk.take.lots, [free[1].id]);
    assert.equal(desk.take.cash, 12);
    assert.ok(desk.evaluation, 'desk evaluates the prefilled deal');
  });
});

/** Minimal container that just captures innerHTML. */
function fakeContainer(): HTMLElement {
  return {
    innerHTML: '',
    classList: { add() {}, remove() {} },
    addEventListener() {},
  } as unknown as HTMLElement;
}

describe('One-click Match Bot Ask and the ORDER FILLED stamp', () => {
  it('fills the shortfall in one click, executes, and stamps ORDER FILLED', () => {
    const state = blankTradeState();
    state.players[0].cash = 200;
    state.players[2].cash = 200;
    const stamps: string[] = [];
    const desk = new TradeDeskController(state, { onAudioTrigger: (cue) => stamps.push(cue) });
    const view = new TradeDeskModal(fakeContainer(), desk);
    const el = (view as unknown as { container: HTMLElement }).container;

    desk.open(2);
    desk.setTakeCash(100); // ask Apex for 100 with nothing in return
    view.render();
    const shortfall = desk.getDeskState().evaluation!.shortfall;
    assert.equal(shortfall, 115, 'Apex wants 1.15x');
    assert.ok(desk.canApplyCounteroffer());
    assert.ok(el.innerHTML.includes(`Match Bot Ask (+${shortfall} $wif)`));
    assert.ok(!el.innerHTML.includes(`stamp-box`), "no stamp before execution");

    assert.equal(desk.applyCounteroffer(), true);
    assert.equal(desk.getDeskState().give.cash, shortfall);
    assert.equal(desk.getDeskState().evaluation!.accepted, true, 'one click is enough');

    assert.equal(desk.executeTrade(), true);
    view.render();
    assert.equal(desk.getDeskState().isFilledAnimationActive, true);
    assert.ok(el.innerHTML.includes(`<div class="stamp-box">${ORDER_FILLED_STAMP}</div>`));
    assert.equal(ORDER_FILLED_STAMP, 'ORDER FILLED');
    assert.ok(!el.innerHTML.includes('FILLED!'));
    assert.ok(stamps.includes('deal-stamp'));
  });

  it('hides Match Bot Ask when the player cannot afford the shortfall', () => {
    const state = blankTradeState();
    state.players[0].cash = 10;
    state.players[2].cash = 200;
    const desk = new TradeDeskController(state);
    desk.open(2);
    desk.setTakeCash(100);
    assert.equal(desk.canApplyCounteroffer(), false);
    assert.equal(desk.applyCounteroffer(), false);
  });

  it('formats persona thresholds to two decimals', () => {
    assert.equal(formatMargin(1), '1.00x');
    assert.equal(formatMargin(1.15), '1.15x');
    assert.equal(formatMargin(0.95), '0.95x');
  });
});

describe('Phase 5: final settlement opens automatically', () => {
  it('opens the settlement modal after the Epoch 6 harvest badges play', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const app = new RobinTownApp(null);
      const state = app.getGameState() as GameState;
      state.year = 6;
      state.phase = 'build';
      app.harvestYield();
      assert.equal(state.phase, 'ended');
      const open = () => (app as unknown as { isSettlementModalOpen: boolean }).isSettlementModalOpen;
      assert.equal(open(), false, 'waits for the harvest animation');
      mock.timers.tick(FLOATER_MS + 300);
      assert.equal(open(), true);
    } finally {
      mock.timers.reset();
    }
  });
});
