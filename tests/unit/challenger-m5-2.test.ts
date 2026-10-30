/**
 * tests/unit/challenger-m5-2.test.ts
 *
 * Empirical Adversarial Test Harness for Milestone 5 Match Loop and Trade Desk.
 * Tests:
 * 1. TradeDeskController Edge Cases (zero assets, exceeding balance, unowned parcels, negative inputs)
 * 2. Counterparty Switching and Escrow State Invariants
 * 3. 1% Micro-Tax Calculation Consistency (gross, tax, net, vault)
 * 4. One-Click Counteroffer Fulfillment and Atomic Deal Execution
 * 5. End-to-End Match Loop Simulation through Year 6 Settlement and Podium Purse Math
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TradeDeskController } from '../../src/ui/trade-desk';
import { RobinTownApp } from '../../src/app';
import {
  createGame,
  startYear,
  emptyOffer,
  rankings,
} from '../../src/engine/engine';
import {
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  calculateTradeTax,
  applyTradeTax,
  createInitialFlywheelState,
} from '../../src/tokenomics/flywheel';
import type { GameState } from '../../src/engine/types';

describe('Adversarial Challenge 1: TradeDeskController Edge Cases', () => {
  it('rejects zero-asset offers with validation error and blocks execution', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    const controller = new TradeDeskController(game);
    controller.open(1);

    const deskState = controller.getDeskState();
    assert.equal(deskState.isOpen, true);
    assert.equal(deskState.give.cash, 0);
    assert.equal(deskState.take.cash, 0);
    assert.equal(deskState.validationError, 'Add cash, a shop tile, or a plot to the deal.');
    assert.equal(deskState.evaluation, null);
    assert.equal(controller.canApplyCounteroffer(), false);

    const executed = controller.executeTrade();
    assert.equal(executed, false);
    assert.equal(game.trades, 0);
  });

  it('clamps negative, float, and non-numeric cash inputs safely', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[1].cash = 100;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Negative give cash clamps to 0
    controller.setGiveCash(-50);
    assert.equal(controller.getDeskState().give.cash, 0);

    // Negative take cash clamps to 0
    controller.setTakeCash(-100);
    assert.equal(controller.getDeskState().take.cash, 0);

    // Float give cash is floored
    controller.setGiveCash(45.9);
    assert.equal(controller.getDeskState().give.cash, 45);

    // Negative adjustments clamp to 0
    controller.adjustGiveCash(-200);
    assert.equal(controller.getDeskState().give.cash, 0);

    // Adjust take cash safely
    controller.setTakeCash(30);
    controller.adjustTakeCash(-100);
    assert.equal(controller.getDeskState().take.cash, 0);
  });

  it('strictly limits cash offers to player liquid balances', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';
    game.players[0].cash = 50;
    game.players[1].cash = 75;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Attempting to set cash above liquid balance clamps to balance
    controller.setGiveCash(1000);
    assert.equal(controller.getDeskState().give.cash, 50);

    controller.setTakeCash(500);
    assert.equal(controller.getDeskState().take.cash, 75);

    // Adjusting beyond balance clamps to balance
    controller.setGiveCash(30);
    controller.adjustGiveCash(50);
    assert.equal(controller.getDeskState().give.cash, 50);

    // External reduction of balance triggers validation error on recalculate
    game.players[0].cash = 20;
    controller.updateGameState(game);
    assert.ok(controller.getDeskState().validationError?.includes('balance'));
    assert.equal(controller.getDeskState().evaluation, null);
    assert.equal(controller.executeTrade(), false);
  });

  it('rejects offering or requesting unowned parcels', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    // Assign parcel 0 to player 0 and parcel 1 to player 1
    game.lots[0].owner = 0;
    game.lots[1].owner = 1;
    game.lots[2].owner = 2;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Proposer cannot offer parcel 1 (owned by Sherwood) or parcel 2 (owned by Apex)
    assert.throws(
      () => controller.toggleGiveLot(1),
      /Cannot offer lot 1: not owned by proposer/
    );
    assert.throws(
      () => controller.toggleGiveLot(2),
      /Cannot offer lot 2: not owned by proposer/
    );

    // Proposer cannot request parcel 0 (owned by proposer) or parcel 2 (owned by Apex) from partner 1
    assert.throws(
      () => controller.toggleTakeLot(0),
      /Cannot request lot 0: not owned by partner/
    );
    assert.throws(
      () => controller.toggleTakeLot(2),
      /Cannot request lot 2: not owned by partner/
    );

    // Out-of-bounds parcel IDs throw cleanly
    assert.throws(() => controller.toggleGiveLot(-1));
    assert.throws(() => controller.toggleTakeLot(99));

    // Valid parcel toggle adds and removes
    controller.toggleGiveLot(0);
    assert.deepEqual(controller.getDeskState().give.lots, [0]);
    controller.toggleGiveLot(0);
    assert.deepEqual(controller.getDeskState().give.lots, []);
  });

  it('strictly clamps module tile staging to held inventory limits', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    // Player 0 holds 2 tiles of shop type 0 and 0 of type 1
    game.players[0].tiles = [2, 0, 0, 0, 0, 0];
    game.players[1].tiles = [0, 3, 0, 0, 0, 0];

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Staging more than held clamps to held
    controller.setGiveTiles(0, 10);
    assert.equal((controller.getDeskState().give.tiles as number[])[0], 2);

    // Staging when held is 0 clamps to 0
    controller.setGiveTiles(1, 1);
    assert.equal((controller.getDeskState().give.tiles as number[])[1], 0);

    // Negative counts clamp to 0
    controller.setGiveTiles(0, -5);
    assert.equal((controller.getDeskState().give.tiles as number[])[0], 0);

    // Take tiles clamped to partner inventory
    controller.setTakeTiles(1, 50);
    assert.equal((controller.getDeskState().take.tiles as number[])[1], 3);

    // Invalid shop indices do not crash
    controller.setGiveTiles(6, 1);
    controller.setGiveTiles(-1, 1);
    controller.setTakeTiles(10, 1);
  });
});

describe('Adversarial Challenge 2: Counterparty Switching and Invariants', () => {
  it('preserves human give assets while cleanly resetting counterparty take assets on partner switch', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    game.players[0].cash = 100;
    game.players[0].tiles = [3, 0, 0, 0, 0, 0];
    game.lots[0].owner = 0;

    game.players[1].cash = 100;
    game.players[1].tiles = [0, 2, 0, 0, 0, 0];
    game.lots[1].owner = 1;

    game.players[2].cash = 100;
    game.lots[2].owner = 2;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Stage human assets (give)
    controller.setGiveCash(40);
    controller.setGiveTiles(0, 2);
    controller.toggleGiveLot(0);

    // Stage partner assets (take)
    controller.setTakeCash(30);
    controller.setTakeTiles(1, 1);
    controller.toggleTakeLot(1);

    assert.equal(controller.getDeskState().give.cash, 40);
    assert.equal((controller.getDeskState().give.tiles as number[])[0], 2);
    assert.deepEqual(controller.getDeskState().give.lots, [0]);

    assert.equal(controller.getDeskState().take.cash, 30);
    assert.equal((controller.getDeskState().take.tiles as number[])[1], 1);
    assert.deepEqual(controller.getDeskState().take.lots, [1]);

    // Switch to partner 2 (Apex)
    controller.setPartner(2);
    assert.equal(controller.getDeskState().partnerId, 2);

    // Verify give assets are preserved
    assert.equal(controller.getDeskState().give.cash, 40);
    assert.equal((controller.getDeskState().give.tiles as number[])[0], 2);
    assert.deepEqual(controller.getDeskState().give.lots, [0]);

    // Verify take assets are cleanly reset
    assert.equal(controller.getDeskState().take.cash, 0);
    assert.deepEqual(controller.getDeskState().take.lots, []);
    assert.deepEqual(controller.getDeskState().take.tiles, [0, 0, 0, 0, 0, 0]);

    // Switch to partner 3 (Luna)
    controller.setPartner(3);
    assert.equal(controller.getDeskState().partnerId, 3);
    assert.equal(controller.getDeskState().give.cash, 40);
    assert.equal(controller.getDeskState().take.cash, 0);
  });

  it('rejects invalid partner IDs and self-trading', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Proposer ID is 0, cannot trade with self
    assert.throws(() => controller.setPartner(0), /Invalid counterparty ID: 0/);

    // IDs outside [1, 3] are rejected
    assert.throws(() => controller.setPartner(4), /Invalid counterparty ID: 4/);
    assert.throws(() => controller.setPartner(-1), /Invalid counterparty ID: -1/);

    // Partner remains active
    assert.equal(controller.getDeskState().partnerId, 1);
  });

  it('returns distinct bot personalities with appropriate profit margins', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    const controller = new TradeDeskController(game);
    controller.open(1);
    assert.equal(controller.getActivePartnerProfile().name, 'Sherwood');
    assert.equal(controller.getActivePartnerProfile().profitMargin, 1.04);

    controller.setPartner(2);
    assert.equal(controller.getActivePartnerProfile().name, 'Apex');
    assert.equal(controller.getActivePartnerProfile().profitMargin, 1.09);

    controller.setPartner(3);
    assert.equal(controller.getActivePartnerProfile().name, 'Luna');
    assert.equal(controller.getActivePartnerProfile().profitMargin, 1.01);
  });
});

describe('Adversarial Challenge 3: 1% OTC Micro-Tax Calculation Consistency', () => {
  it('guarantees gross = net + tax and tax = vault conservation across 1,000 cash values', () => {
    for (let cash = 0; cash <= 1000; cash++) {
      const taxRes = calculateTradeTax(cash, 0.01);
      assert.equal(
        taxRes.grossCash,
        taxRes.netCash + taxRes.taxAmount,
        `Conservation failure at cash = ${cash}`
      );
      assert.equal(
        taxRes.vaultAmount,
        taxRes.taxAmount,
        `Vault mismatch at cash = ${cash}`
      );
      assert.equal(taxRes.burnedAmount, 0);
      assert.ok(taxRes.taxAmount <= taxRes.grossCash);
      assert.ok(taxRes.netCash >= 0);
    }
  });

  it('verifies exact micro-tax behavior on critical boundary values', () => {
    // Cash = 0
    const t0 = calculateTradeTax(0, 0.01);
    assert.equal(t0.grossCash, 0);
    assert.equal(t0.taxAmount, 0);
    assert.equal(t0.netCash, 0);
    assert.equal(t0.vaultAmount, 0);

    // Cash = 1: ceil(1 * 0.01) = 1 tax, 0 net
    const t1 = calculateTradeTax(1, 0.01);
    assert.equal(t1.grossCash, 1);
    assert.equal(t1.taxAmount, 1);
    assert.equal(t1.netCash, 0);
    assert.equal(t1.vaultAmount, 1);

    // Cash = 50: ceil(50 * 0.01) = 1 tax, 49 net
    const t50 = calculateTradeTax(50, 0.01);
    assert.equal(t50.grossCash, 50);
    assert.equal(t50.taxAmount, 1);
    assert.equal(t50.netCash, 49);

    // Cash = 99: ceil(99 * 0.01) = 1 tax, 98 net
    const t99 = calculateTradeTax(99, 0.01);
    assert.equal(t99.grossCash, 99);
    assert.equal(t99.taxAmount, 1);
    assert.equal(t99.netCash, 98);

    // Cash = 100: ceil(100 * 0.01) = 1 tax, 99 net
    const t100 = calculateTradeTax(100, 0.01);
    assert.equal(t100.grossCash, 100);
    assert.equal(t100.taxAmount, 1);
    assert.equal(t100.netCash, 99);

    // Cash = 101: ceil(101 * 0.01) = 2 tax, 99 net
    const t101 = calculateTradeTax(101, 0.01);
    assert.equal(t101.grossCash, 101);
    assert.equal(t101.taxAmount, 2);
    assert.equal(t101.netCash, 99);

    // Cash = 1999: ceil(1999 * 0.01) = 20 tax, 1979 net
    const t1999 = calculateTradeTax(1999, 0.01);
    assert.equal(t1999.grossCash, 1999);
    assert.equal(t1999.taxAmount, 20);
    assert.equal(t1999.netCash, 1979);

    // Cash = 10000: ceil(100) = 100 tax, 9900 net
    const t10k = calculateTradeTax(10000, 0.01);
    assert.equal(t10k.grossCash, 10000);
    assert.equal(t10k.taxAmount, 100);
    assert.equal(t10k.netCash, 9900);
  });

  it('guarantees barter trades with zero cash are 100% tax-free', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    game.lots[0].owner = 0;
    game.lots[1].owner = 1;

    const controller = new TradeDeskController(game);
    controller.open(1);
    controller.toggleGiveLot(0);
    controller.toggleTakeLot(1);

    const deskState = controller.getDeskState();
    assert.equal(deskState.taxBreakdown.giveTax.taxAmount, 0);
    assert.equal(deskState.taxBreakdown.takeTax.taxAmount, 0);
    assert.equal(deskState.taxBreakdown.giveTax.vaultAmount, 0);
    assert.equal(deskState.taxBreakdown.takeTax.vaultAmount, 0);
  });

  it('accumulates trade micro-tax into global flywheel state', () => {
    let flywheel = createInitialFlywheelState();
    const tradeTax = calculateTradeTax(500, 0.01); // 5 tax, 495 net
    flywheel = applyTradeTax(flywheel, tradeTax);

    assert.equal(flywheel.totalStakingYield, 5);
    assert.equal(flywheel.totalTradesTaxed, 1);
    assert.equal(flywheel.totalBurned, 0);
  });

  it('empirically audits TradeDeskController executeTrade for micro-tax deduction on cash transfers', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    game.players[0].cash = 100;
    game.players[3].cash = 100; // Luna
    game.lots[0].owner = 0;

    const controller = new TradeDeskController(game);
    controller.open(3);

    // Offer lot 0 (parcel, value ~18-24) and request 15 cash from Luna (required ~15.15)
    controller.toggleGiveLot(0);
    controller.setTakeCash(15);

    // Tax breakdown indicates 1 tax and 14 net cash
    assert.equal(controller.getDeskState().taxBreakdown.takeTax.taxAmount, 1);
    assert.equal(controller.getDeskState().taxBreakdown.takeTax.netCash, 14);

    const prevProposerCash = game.players[0].cash;
    const prevPartnerCash = game.players[3].cash;

    const executed = controller.executeTrade();
    assert.equal(executed, true);

    const actualProposerGain = (game.players[0].cash-prevProposerCash);
    const actualPartnerLoss = (prevPartnerCash-game.players[3].cash);

    // Verified remediation:
    // Proposer receives 14 net cash (15 gross cash minus 1 $wif micro-tax)
    // Counterparty partner pays 15 gross cash
    // Community staking vault is credited with 1 $wif tax in flywheel state
    assert.equal(actualProposerGain, 14, 'Proposer should receive 14 net cash after 1% micro-tax deduction');
    assert.equal(actualPartnerLoss, 15, 'Counterparty pays 15 gross cash');
    assert.equal(controller.getCommunityVault(), 1, 'Community vault is credited with 1 $wif tax');
    assert.equal(controller.getFlywheelState().totalTradesTaxed, 1, 'Flywheel totalTradesTaxed is incremented');
  });
});

describe('Adversarial Challenge 4: One-Click Counteroffer Fulfillment', () => {
  it('generates counteroffer, applies it with one click, and fulfills the deal', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    game.players[0].cash = 100;
    game.players[3].cash = 100; // Luna (profitMargin 1.05)

    const controller = new TradeDeskController(game);
    controller.open(3);

    // Proposer requests 20 cash from Luna, offering only 10 cash
    controller.setGiveCash(10);
    controller.setTakeCash(20);

    const evalBefore = controller.getDeskState().evaluation;
    assert.ok(evalBefore);
    assert.equal(evalBefore.accepted, false);
    assert.ok(evalBefore.shortfall > 0);
    assert.ok(evalBefore.counterOffer);
    assert.equal(controller.canApplyCounteroffer(), true);

    // Apply counteroffer with one click
    const applied = controller.applyCounteroffer();
    assert.equal(applied, true);

    // After applying, give cash is increased to meet counteroffer requirement
    const deskStateAfter = controller.getDeskState();
    assert.equal(deskStateAfter.give.cash, evalBefore.counterOffer.cash);
    assert.equal(deskStateAfter.evaluation?.accepted, true);
    assert.equal(controller.canApplyCounteroffer(), false);

    // Execute atomic trade
    const prevTrades = game.trades;
    const executed = controller.executeTrade();
    assert.equal(executed, true);
    assert.equal(game.trades, prevTrades + 1);
    assert.equal(controller.getDeskState().isFilledAnimationActive, true);
    assert.equal(controller.getDeskState().give.cash, 0);
    assert.equal(controller.getDeskState().take.cash, 0);
  });

  it('rejects counteroffer application when human cash is insufficient to meet shortfall', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    game.players[0].cash = 15; // Poor human trader
    game.players[1].cash = 100; // Sherwood (margin 1.15)

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Request 50 cash from Sherwood while offering 10 cash
    controller.setGiveCash(10);
    controller.setTakeCash(50);

    const evalResult = controller.getDeskState().evaluation;
    assert.ok(evalResult);
    assert.equal(evalResult.accepted, false);
    // Required = 50 * 1.15 = 57.5 -> shortfall = 48 cash
    // Total required give cash = 58 cash, but human only has 15 cash
    assert.equal(evalResult.counterOffer, undefined);
    assert.equal(controller.canApplyCounteroffer(), false);

    const applied = controller.applyCounteroffer();
    assert.equal(applied, false);
    assert.equal(controller.getDeskState().give.cash, 10);
  });
});

describe('Adversarial Challenge 5: End-to-End Match Loop Simulation and Podium Math', () => {
  it('executes 5 full 6-year single-player matches cleanly to final settlement', () => {
    for (let match = 1; match <= 5; match++) {
      const app = new RobinTownApp(null);
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      for (let y = 1; y <= 6; y++) {
        // Phase 1: Allocation drafting
        assert.equal(app.getGameState().phase, 'receive');
        const drafted = app.quickDraft();
        assert.ok(drafted.length > 0);
        assert.equal(app.getGameState().phase, 'trade');

        // Phase 2: OTC trading
        app.finishTrading();
        assert.equal(app.getGameState().phase, 'build');

        // Phase 3: Protocol shop deployment
        app.selectShopType(0);
        const ownedLot = app.getGameState().lots.find((l) => l.owner === 0 && l.shop === null);
        if (ownedLot) {
          app.buildOnLot(ownedLot.id);
        }

        // Phase 4: Harvest yield with 1.20x seasonal staking multiplier
        const harvest = app.harvestYield();
        assert.ok(harvest.totalHarvest >= 0);

        // Phase 5: Advance epoch or settle
        if (y < 6) {
          assert.equal(app.getGameState().phase, 'income');
          app.advanceToNextYear();
          assert.equal(app.getGameState().year, y + 1);
        } else {
          // In Year 6, collectIncome in harvestYield advances phase to 'ended'
          assert.equal(app.getGameState().phase, 'ended');
          const settlement = app.getFinalSettlement();
          assert.equal(settlement.rankings.length, 4);
          assert.equal(settlement.matchPool.totalPool, 4000);
        }
      }
    }
  });

  it('guarantees exact 4,000 $wif match pool conservation (200 burn, 200 vault, 3600 purse, 60/25/15 podium)', () => {
    const buyInPerPlayer = 1000;
    const playerRankings = [0, 1, 2, 3];
    const pool = calculateMatchPayouts(buyInPerPlayer, playerRankings);

    assert.equal(pool.totalPool, 4000);
    assert.equal(pool.burnedAmount, 200); // 5%
    assert.equal(pool.vaultAmount, 200); // 5%
    assert.equal(pool.purseAmount, 3600); // 90%

    // Verify 60/25/15 podium shares
    assert.equal(pool.podium[0].percentage, 0.60);
    assert.equal(pool.podium[0].payout, 2160);
    assert.equal(pool.podium[1].percentage, 0.25);
    assert.equal(pool.podium[1].payout, 900);
    assert.equal(pool.podium[2].percentage, 0.15);
    assert.equal(pool.podium[2].payout, 540);

    // 4th place gets zero
    assert.equal(pool.payouts[3], 0);

    // Invariant: burned + vault + sum(podium) === totalPool
    const totalOutflow =
      pool.burnedAmount +
      pool.vaultAmount +
      pool.podium[0].payout +
      pool.podium[1].payout +
      pool.podium[2].payout;
    assert.equal(totalOutflow, pool.totalPool);
  });

  it('verifies 1.20x seasonal staking yield boost arithmetic', () => {
    // Unstaked vs Staked comparisons
    assert.equal(calculateStakingBoost(0, true), 0);
    assert.equal(calculateStakingBoost(100, false), 100);
    assert.equal(calculateStakingBoost(100, true), 120); // 20% bonus
    assert.equal(calculateStakingBoost(250, true), 300);
    assert.equal(calculateStakingBoost(333, true), 399); // Math.floor(333 * 1.20) = 399
  });

  it('verifies point-to-$wif redemption with 3% burn tax and exact conservation', () => {
    const testCases = [
      { points: 0, expectedGross: 0, expectedBurn: 0, expectedNet: 0 },
      { points: 10, expectedGross: 1, expectedBurn: 1, expectedNet: 0 },
      { points: 50, expectedGross: 5, expectedBurn: 1, expectedNet: 4 },
      { points: 100, expectedGross: 10, expectedBurn: 1, expectedNet: 9 },
      { points: 1000, expectedGross: 100, expectedBurn: 3, expectedNet: 97 },
      { points: 2500, expectedGross: 250, expectedBurn: 8, expectedNet: 242 },
    ];

    for (const tc of testCases) {
      const res = calculatePointSwap(tc.points, 0.10, 0.03);
      assert.equal(res.grossWif, tc.expectedGross, `Gross mismatch for ${tc.points} pts`);
      assert.equal(res.burnedWif, tc.expectedBurn, `Burn mismatch for ${tc.points} pts`);
      assert.equal(res.netWif, tc.expectedNet, `Net mismatch for ${tc.points} pts`);
      assert.equal(
        res.grossWif,
        res.burnedWif + res.netWif,
        `Conservation failure for ${tc.points} pts`
      );
    }
  });

  it('empirically audits RobinTownApp getFinalSettlement for dynamic podium ranking alignment', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    // Set Bot 2 (Apex) as the clear winner with 50,000 cash
    game.players[2].cash = 50000;
    // Set Bot 1 (Sherwood) in 2nd place with 20,000 cash
    game.players[1].cash = 20000;
    // Set Bot 3 (Luna) in 3rd place with 10,000 cash
    game.players[3].cash = 10000;
    // Set Player 0 in 4th place with 50 cash
    game.players[0].cash = 50;

    const currentRankings = rankings(game);
    assert.equal(currentRankings[0].id, 2, 'Apex should be rank #1');
    assert.equal(currentRankings[1].id, 1, 'Sherwood should be rank #2');
    assert.equal(currentRankings[2].id, 3, 'Luna should be rank #3');
    assert.equal(currentRankings[3].id, 0, 'Player 0 should be rank #4');

    const settlement = app.getFinalSettlement();

    // Verify whether settlement.matchPool.podium reflects actual winners or hardcoded [0, 1, 2, 3]
    const firstPlaceWinnerId = settlement.rankings[0].id;
    const podiumRank1PlayerId = settlement.matchPool.podium[0].playerId;

    // Affirmative assertion that settlement podium dynamically maps to actual tournament winners
    const isDynamic = podiumRank1PlayerId === firstPlaceWinnerId;
    assert.equal(isDynamic, true, 'Podium rank 1 player must match actual rank 1 winner');
    assert.equal(settlement.matchPool.payouts[2], 2160, 'Apex receives 1st place payout of 2,160 $wif');
    assert.equal(settlement.matchPool.payouts[1], 900, 'Sherwood receives 2nd place payout of 900 $wif');
    assert.equal(settlement.matchPool.payouts[3], 540, 'Luna receives 3rd place payout of 540 $wif');
    assert.equal(settlement.matchPool.payouts[0], 0, 'Player 0 in 4th place receives 0 $wif');
  });
});
