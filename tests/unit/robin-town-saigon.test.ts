import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  COMPLETE,
  DISTRICTS,
  KEEP,
  SHOPS,
  beginBuild,
  botTradeRound,
  chooseSmartDraftPlots,
  claimPlots,
  emptyOffer,
  findNextSmartBuild,
  findSmartPlayerTrade,
  finishYear,
  holdings,
  income,
  migrateEnglishState,
  newGame,
  nextYear,
  placeShop,
  rankings,
  trade,
  validSave,
} from '../../src/town/engine';
import { adjustDraft, makeDraft } from '../../src/town/trading';
import { toEngine3DState } from '../../src/town/bridge-3d';
import { GAME_IMAGES } from '../../src/town/preload';

describe('Robin-Town Authentic Saigon-Town Clone & $wif Integration', () => {
  it('runs a full 6-year match with 1.20x $wif staking boost and 1% OTC cash tax', () => {
    const state = newGame(() => 0.42, 'ranked');
    assert.equal(state.year, 1);
    assert.equal(state.phase, 'receive');
    assert.equal(state.draftCount, KEEP[0]);
    assert.equal(state.lots.length, 72);
    assert.equal(DISTRICTS.length, 6);
    assert.equal(SHOPS.length, 6);

    for (let yr = 1; yr <= 6; yr++) {
      assert.equal(state.year, yr);
      assert.equal(state.phase, 'receive');
      const picks = state.pending.slice(0, state.draftCount);
      claimPlots(state, picks, () => 0.25);
      assert.equal(state.phase, 'trade');

      if (yr === 1) {
        const partnerLot = state.lots.find((l) => l.owner === 1)?.id ?? null;
        if (partnerLot !== null) {
          const offer = {
            partner: 1,
            give: { ...emptyOffer(), cash: 45 },
            take: { ...emptyOffer(), lots: [partnerLot] },
          };
          const res = trade(state, offer);
          if (res.accepted) {
            assert.ok((res.taxAmount ?? 0) >= 1, '1% $wif cash tax must be calculated');
          }
        }
      }

      beginBuild(state);
      assert.equal(state.phase, 'build');

      const emptyMine = state.lots.filter((l) => l.owner === 0 && l.shop === null);
      for (const lot of emptyMine) {
        const shopIdx = state.players[0].tiles.findIndex((c) => c > 0);
        if (shopIdx >= 0) {
          placeShop(state, lot.id, shopIdx, 0);
        }
      }

      const rawBase = income(state, 0, false);
      const stakedPay = income(state, 0, true);
      if (rawBase > 0) {
        assert.ok(stakedPay >= rawBase, '1.20x staked payday must boost or match base income');
      }

      finishYear(state, true);
      if (yr < 6) {
        assert.equal(state.phase, 'income');
        nextYear(state, () => 0.35);
      } else {
        assert.equal(state.phase, 'ended');
      }
    }

    const finalOrder = rankings(state);
    assert.equal(finalOrder.length, 4);
    assert.ok(validSave(state), 'Completed 6-year state must pass validSave schema');
    assert.equal(COMPLETE[3], 50);
    assert.equal(COMPLETE[6], 140);
  });

  it('maps live town state cleanly into 3D ThreeBoardRenderer state', () => {
    const state = newGame(() => 0.11);
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;

    const mapped = toEngine3DState(state);
    assert.equal(mapped.lots.length, 72);
    assert.equal(mapped.lots[0].isComplete, true, '3 connected Coffee Houses form a complete 3D cluster');
    assert.equal(mapped.players.length, 4);
  });

  it('supports Bargaining Table draft adjustments for $wif, tiles, and plots', () => {
    const state = newGame(() => 0.5);
    claimPlots(state, state.pending.slice(0, state.draftCount), () => 0.5);
    const draft = makeDraft(state, 1);
    adjustDraft(state, draft, 'give', 'cash', 0, 20);
    assert.equal(draft.give.cash, 20);
    adjustDraft(state, draft, 'give', 'cash', 0, -10);
    assert.equal(draft.give.cash, 10);
  });

  it('verifies every preloaded Saigon-Town Aseprite image exists in public/', () => {
    const publicRoot = path.resolve(process.cwd(), 'public');
    for (const rel of GAME_IMAGES) {
      const full = path.join(publicRoot, rel.replace(/^\//, ''));
      assert.ok(fs.existsSync(full), `Expected Aseprite game image to exist: ${full}`);
    }
  });

  it('maintains 100% English source text, shop names, district names, and neighbor names', () => {
    const vietnameseDiacritics = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/;
    const walkTsFiles = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkTsFiles(full));
        else if (entry.name.endsWith('.ts')) out.push(full);
      }
      return out;
    };

    for (const full of walkTsFiles(path.resolve(process.cwd(), 'src'))) {
      const content = fs.readFileSync(full, 'utf8');
      assert.equal(
        vietnameseDiacritics.test(content),
        false,
        `File ${full} must remain 100% English with zero Vietnamese diacritics`,
      );
    }

    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.equal(vietnameseDiacritics.test(html), false, 'index.html must be 100% English');

    assert.deepEqual(
      SHOPS.map((s) => s.name),
      ['Coffee', 'Bakery', 'Noodles', 'Flowers', 'Tailor', 'Grocery'],
    );
    assert.deepEqual(DISTRICTS, [
      'Sherwood',
      'Clocktower',
      'Harborview',
      'Lantern Hall',
      'Grand Market',
      'Maple Lane',
    ]);

    const fresh = newGame(() => 0.42);
    assert.deepEqual(
      fresh.players.map((p) => p.name),
      ['You', 'Cole', 'Maya', 'Clara'],
    );

    const legacy = newGame(() => 0.42);
    legacy.players[1].name = 'Linh';
    legacy.players[2].name = 'Minh';
    legacy.players[3].name = 'An';
    legacy.logs = ['Linh opened Banh Mi in Tan Dinh.', 'Minh traded Pho in Cho Lon with An.'];
    assert.equal(migrateEnglishState(legacy), true);
    assert.deepEqual(
      legacy.players.map((p) => p.name),
      ['You', 'Cole', 'Maya', 'Clara'],
    );
    assert.deepEqual(legacy.logs, [
      'Cole opened Bakery in Sherwood.',
      'Maya traded Noodles in Lantern Hall with Clara.',
    ]);
  });

  it('executes bot-to-bot OTC deals in botTradeRound and smart A-to-Z 6-year Fast Play', () => {
    const setup = newGame(() => 0.37, 'casual');
    claimPlots(setup, chooseSmartDraftPlots(setup), () => 0.37);
    // Give Cole (1) 2 Coffee tiles + 1 surplus Tailor, and Maya (2) 2 Tailor tiles + 1 surplus Coffee
    setup.players[1].tiles = [2, 0, 0, 0, 1, 0];
    setup.players[2].tiles = [1, 0, 0, 0, 2, 0];
    const round = botTradeRound(setup);
    assert.ok(round.deals.length >= 1, 'Cole and Maya should swap surplus tiles to grow their sets');
    assert.ok(
      round.deals[0].summary.includes('Cole') && round.deals[0].summary.includes('Maya'),
      'Bot deal summary must name both AI neighbors',
    );

    // Run full 6-year A-to-Z smart Fast Play simulation with You + Cole + Maya + Clara
    let seed = 17;
    const rng = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const sim = newGame(rng, 'ranked');
    for (let yr = 1; yr <= 6; yr++) {
      assert.equal(sim.year, yr);
      assert.equal(sim.phase, 'receive');
      const smartDraft = chooseSmartDraftPlots(sim);
      assert.equal(smartDraft.length, KEEP[yr - 1]);
      claimPlots(sim, smartDraft, rng);
      assert.equal(sim.phase, 'trade');

      const offer = findSmartPlayerTrade(sim);
      if (offer) {
        const res = trade(sim, offer);
        assert.equal(res.accepted, true);
      }
      botTradeRound(sim);
      beginBuild(sim);
      assert.equal(sim.phase, 'build');

      let buildGuard = 0;
      while (buildGuard++ < 20) {
        const step = findNextSmartBuild(sim);
        if (!step) break;
        placeShop(sim, step.id, step.shop, 0);
      }

      finishYear(sim, true);
      if (yr < 6) {
        assert.equal(sim.phase, 'income');
        nextYear(sim, rng);
      } else {
        assert.equal(sim.phase, 'ended');
      }
    }

    assert.equal(sim.phase, 'ended');
    assert.ok(validSave(sim), 'A-to-Z Fast Play final state must pass validSave');
    for (let p = 0; p < 4; p++) {
      const builtCount = holdings(sim, p).filter((l) => l.shop !== null).length;
      assert.ok(builtCount >= 8, `Player ${sim.players[p].name} must actively build shops across 6 years`);
      assert.ok(sim.players[p].cash > 150, `Player ${sim.players[p].name} must earn $wif income`);
    }
  });
});
