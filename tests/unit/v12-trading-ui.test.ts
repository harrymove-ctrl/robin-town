import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimPlots, chooseSmartDraftPlots, newDailyGame } from '../../src/town/engine.js';
import { createTrading } from '../../src/town/trading.js';

describe('v1.2 OTC Smart Deal Banner, Deal Thermometer & Synergy Highlights', () => {
  it('renders Smart Win-Win banner, live deal thermometer states, and synergy badges in OTC Bargaining', () => {
    const prevDoc = globalThis.document;
    const modalBodyStub = { innerHTML: '' };
    const modalStub = {
      classList: {
        add: () => {},
        remove: () => {},
      },
      querySelector: () => null,
    };
    globalThis.document = {
      querySelector: (sel: string) => {
        if (sel === '#modal') return modalStub;
        if (sel === '#modal .modal-body') return modalBodyStub;
        return null;
      },
    } as unknown as Document;

    try {
      const state = newDailyGame('2026-11-01');
      claimPlots(state, chooseSmartDraftPlots(state), () => 0.42);
      assert.equal(state.phase, 'trade');

      const trading = createTrading({
        getState: () => state,
        sprite: (_kind, id) => `<i data-sprite="${id}"></i>`,
        token: (p) => `<i data-token="${p}"></i>`,
        modal: (_title, body) => {
          modalBodyStub.innerHTML = body;
        },
        closeModal: () => {},
        onChanged: () => {},
        playSound: () => {},
        onTrading: () => {},
      });

      trading.open(1);
      assert.ok(
        modalBodyStub.innerHTML.includes('deal-meter empty'),
        'Empty mat should display live reaction prompt',
      );
      assert.ok(
        modalBodyStub.innerHTML.includes('synergy-adj') ||
          modalBodyStub.innerHTML.includes('synergy-fit') ||
          modalBodyStub.innerHTML.includes('smart-deal-bar'),
        'OTC modal should highlight win-win deals or synergy items',
      );

      assert.equal(typeof trading.openSmart, 'function');
      trading.openSmart!();
      assert.ok(
        modalBodyStub.innerHTML.includes('deal-meter accepted'),
        'openSmart() should prefill a Fair Win-Win offer ready for acceptance',
      );

      // Test 1-click Clear button via handle()
      trading.handle({ dataset: { bargain: 'clear-mat' } } as unknown as HTMLElement);
      assert.ok(modalBodyStub.innerHTML.includes('deal-meter empty'), 'Clear button should reset offer mat');

      // Test adding 1 neighbor shop tile triggers close/wide shortfall meter, then sweeten brings it to accepted
      const partnerTileIdx = state.players[1]!.tiles.findIndex((n) => n > 0);
      if (partnerTileIdx >= 0) {
        trading.open(1);
        trading.handle({
          dataset: { bargain: 'asset', side: 'take', kind: 'tile', index: String(partnerTileIdx) },
        } as unknown as HTMLElement);
        assert.ok(
          modalBodyStub.innerHTML.includes('deal-meter close') ||
            modalBodyStub.innerHTML.includes('deal-meter wide'),
          'Adding a neighbor tile without payment should display live value gap',
        );
        trading.handle({
          dataset: { bargain: 'sweeten', shortfall: '45' },
        } as unknown as HTMLElement);
        assert.ok(
          modalBodyStub.innerHTML.includes('deal-meter accepted'),
          'Sweetening the offer should turn the live deal thermometer green (accepted)',
        );
      }
    } finally {
      globalThis.document = prevDoc;
    }
  });
});
