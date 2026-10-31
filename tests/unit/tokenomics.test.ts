/**
 * tests/unit/tokenomics.test.ts
 *
 * Comprehensive unit test suite for $wif Tokenomics Flywheel and Economic Model.
 * Verifies standard 4-player buy-in pool allocations, deflationary burn sink,
 * community staking vault, podium distributions, casual point swaps,
 * OTC trade micro-taxes, staking boosts, and FlywheelState tracking.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  BURN_ADDRESS,
  DEFAULT_FLYWHEEL_CONFIG,
  createInitialFlywheelState,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateTradeTax,
  calculateStakingBoost,
  applyMatchPayouts,
  applyPointSwap,
  applyTradeTax,
  calculateTreasuryPoints,
  POINTS_PER_SHOP,
  POINTS_PER_COMPLETE_CLUSTER,
} from '../../src/tokenomics/flywheel';

describe('Suite 1: Tokenomics Constants and Default Configuration', () => {
  it('defines canonical burn address 0x...dEaD', () => {
    assert.strictEqual(BURN_ADDRESS, '0x000000000000000000000000000000000000dEaD');
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.burnAddress, BURN_ADDRESS);
  });

  it('configures default economic flywheel rates matching Robinhood Chain specifications', () => {
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.buyInAmount, 1000);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.burnRate, 0.05);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.vaultRate, 0.05);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.purseRate, 0.90);
    assert.deepStrictEqual(DEFAULT_FLYWHEEL_CONFIG.podiumShares, [0.60, 0.25, 0.15]);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.pointToWifRate, 0.10);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.swapBurnTax, 0.03);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.tradeMicroTax, 0.01);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.stakingMultiplier, 1.20);
  });

  it('guarantees pool allocation rates sum exactly to 100%', () => {
    const sum =
      DEFAULT_FLYWHEEL_CONFIG.burnRate +
      DEFAULT_FLYWHEEL_CONFIG.vaultRate +
      DEFAULT_FLYWHEEL_CONFIG.purseRate;
    assert.strictEqual(Math.round(sum * 100), 100);
  });

  it('guarantees podium prize shares sum exactly to 100%', () => {
    const podiumSum = DEFAULT_FLYWHEEL_CONFIG.podiumShares.reduce((a, b) => a + b, 0);
    assert.strictEqual(Math.round(podiumSum * 100), 100);
  });
});

describe('Suite 2: Standard 4-Player Match Buy-In Pool and Podium Payouts', () => {
  const rankings = [0, 1, 2, 3]; // Player 0 (1st), Player 1 (2nd), Player 2 (3rd), Player 3 (4th)

  it('calculates exact 4,000 $wif match pool for 4 players at 1,000 $wif buy-in', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.totalPool, 4000);
  });

  it('allocates 5% deflationary burn sink (200 $wif) routed to burn address', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.burnedAmount, 200);
    assert.strictEqual(res.burnAddress, BURN_ADDRESS);
  });

  it('allocates 5% community staking vault (200 $wif) routed to yield contract', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.vaultAmount, 200);
  });

  it('allocates 90% prize purse (3,600 $wif)', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.purseAmount, 3600);
  });

  it('distributes 1st place gold payout of 2,160 $wif (60% of purse)', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.payouts[0], 2160);
    assert.strictEqual(res.podium[0].payout, 2160);
    assert.strictEqual(res.podium[0].percentage, 0.60);
  });

  it('distributes 2nd place silver payout of 900 $wif (25% of purse)', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.payouts[1], 900);
    assert.strictEqual(res.podium[1].payout, 900);
    assert.strictEqual(res.podium[1].percentage, 0.25);
  });

  it('distributes 3rd place bronze payout of 540 $wif (15% of purse)', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.payouts[2], 540);
    assert.strictEqual(res.podium[2].payout, 540);
    assert.strictEqual(res.podium[2].percentage, 0.15);
  });

  it('awards 4th place 0 $wif payout', () => {
    const res = calculateMatchPayouts(1000, rankings);
    assert.strictEqual(res.payouts[3], 0);
  });

  it('preserves exact token conservation across pool sinks and disbursements', () => {
    const res = calculateMatchPayouts(1000, rankings);
    const sumSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(sumSinks, res.totalPool);

    const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDisbursed, res.purseAmount);
  });
});

describe('Suite 3: Match Buy-In Pool Edge Cases and Boundary Handling', () => {
  it('handles empty rankings array cleanly', () => {
    const res = calculateMatchPayouts(1000, []);
    assert.strictEqual(res.totalPool, 0);
    assert.strictEqual(res.burnedAmount, 0);
    assert.strictEqual(res.vaultAmount, 0);
    assert.strictEqual(res.purseAmount, 0);
    assert.deepStrictEqual(res.payouts, {});
    assert.deepStrictEqual(res.podium, []);
  });

  it('handles zero buy-in match cleanly', () => {
    const res = calculateMatchPayouts(0, [0, 1, 2, 3]);
    assert.strictEqual(res.totalPool, 0);
    assert.strictEqual(res.burnedAmount, 0);
    assert.strictEqual(res.vaultAmount, 0);
    assert.strictEqual(res.purseAmount, 0);
    assert.strictEqual(res.payouts[0], 0);
  });

  it('throws descriptive error on negative buy-in amount', () => {
    assert.throws(
      () => calculateMatchPayouts(-100, [0, 1, 2, 3]),
      /buyInPerPlayer must be a non-negative finite number/
    );
  });

  it('handles non-standard player counts like 2 players', () => {
    const res = calculateMatchPayouts(1000, [10, 20]);
    assert.strictEqual(res.totalPool, 2000);
    assert.strictEqual(res.burnedAmount, 100);
    assert.strictEqual(res.vaultAmount, 100);
    assert.strictEqual(res.purseAmount, 1800);
    assert.strictEqual(res.podium.length, 2);
    const totalDisbursed = res.payouts[10] + res.payouts[20];
    assert.strictEqual(totalDisbursed, res.purseAmount);
  });

  it('allocates rounding dust to first place winner guaranteeing zero token leakage', () => {
    const res = calculateMatchPayouts(333, [0, 1, 2, 3]);
    assert.strictEqual(res.totalPool, 1332);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, 1332);
    const sumPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumPayouts, res.purseAmount);
  });

  it('supports custom flywheel configuration overrides', () => {
    const customConfig = {
      burnRate: 0.10,
      vaultRate: 0.10,
      purseRate: 0.80,
    };
    const res = calculateMatchPayouts(1000, [0, 1, 2, 3], customConfig);
    assert.strictEqual(res.totalPool, 4000);
    assert.strictEqual(res.burnedAmount, 400);
    assert.strictEqual(res.vaultAmount, 400);
    assert.strictEqual(res.purseAmount, 3200);
  });
});

describe('Suite 4: Casual In-Game Point Swap Calculations', () => {
  it('converts 1,000 points to 100 gross $wif with 3 $wif burned and 97 net $wif', () => {
    const res = calculatePointSwap(1000);
    assert.strictEqual(res.points, 1000);
    assert.strictEqual(res.grossWif, 100);
    assert.strictEqual(res.burnedWif, 3);
    assert.strictEqual(res.netWif, 97);
    assert.strictEqual(res.burnAddress, BURN_ADDRESS);
  });

  it('converts 10 points to 1 gross $wif with 1 burned $wif and 0 net $wif', () => {
    const res = calculatePointSwap(10);
    assert.strictEqual(res.grossWif, 1);
    assert.strictEqual(res.burnedWif, 1);
    assert.strictEqual(res.netWif, 0);
  });

  it('handles sub-threshold points resulting in 0 gross and 0 net', () => {
    const res = calculatePointSwap(9);
    assert.strictEqual(res.grossWif, 0);
    assert.strictEqual(res.burnedWif, 0);
    assert.strictEqual(res.netWif, 0);
  });

  it('handles 0 points cleanly without errors', () => {
    const res = calculatePointSwap(0);
    assert.strictEqual(res.grossWif, 0);
    assert.strictEqual(res.burnedWif, 0);
    assert.strictEqual(res.netWif, 0);
  });

  it('handles negative or invalid points gracefully', () => {
    const res = calculatePointSwap(-500);
    assert.strictEqual(res.points, 0);
    assert.strictEqual(res.grossWif, 0);
    assert.strictEqual(res.netWif, 0);
  });

  it('supports custom swap rate and burn tax rate', () => {
    const res = calculatePointSwap(500, 0.20, 0.05);
    assert.strictEqual(res.grossWif, 100);
    assert.strictEqual(res.burnedWif, 5);
    assert.strictEqual(res.netWif, 95);
  });
});

describe('Suite 5: In-Game OTC Trade Micro-Tax Calculations', () => {
  it('deducts 1% fee on 100 $wif cash trade (1 $wif tax, 99 $wif net)', () => {
    const res = calculateTradeTax(100);
    assert.strictEqual(res.grossCash, 100);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 99);
    assert.strictEqual(res.vaultAmount, 1);
    assert.strictEqual(res.burnedAmount, 0);
  });

  it('rounds up micro-tax using Math.ceil for small amounts', () => {
    const res = calculateTradeTax(50);
    assert.strictEqual(res.grossCash, 50);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 49);
    assert.strictEqual(res.vaultAmount, 1);
  });

  it('handles minimum cash trade of 1 $wif without negative balances', () => {
    const res = calculateTradeTax(1);
    assert.strictEqual(res.grossCash, 1);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 0);
  });

  it('handles zero cash trade cleanly', () => {
    const res = calculateTradeTax(0);
    assert.strictEqual(res.grossCash, 0);
    assert.strictEqual(res.taxAmount, 0);
    assert.strictEqual(res.netCash, 0);
    assert.strictEqual(res.vaultAmount, 0);
  });

  it('handles negative cash input gracefully', () => {
    const res = calculateTradeTax(-100);
    assert.strictEqual(res.grossCash, 0);
    assert.strictEqual(res.taxAmount, 0);
    assert.strictEqual(res.netCash, 0);
  });

  it('supports custom trade micro-tax rate', () => {
    const res = calculateTradeTax(200, 0.02);
    assert.strictEqual(res.taxAmount, 4);
    assert.strictEqual(res.netCash, 196);
    assert.strictEqual(res.vaultAmount, 4);
  });
});

describe('Suite 6: Staking Yield Multiplier and Boost Calculations', () => {
  it('applies 1.20x multiplier to base reward for staked participants', () => {
    const boosted = calculateStakingBoost(100, true);
    assert.strictEqual(boosted, 120);
  });

  it('returns unboosted base reward for unstaked participants', () => {
    const unboosted = calculateStakingBoost(100, false);
    assert.strictEqual(unboosted, 100);
  });

  it('applies Math.floor to fractional boosted rewards', () => {
    assert.strictEqual(calculateStakingBoost(55, true), 66);
    assert.strictEqual(calculateStakingBoost(53, true), 63);
  });

  it('handles zero and negative base rewards safely', () => {
    assert.strictEqual(calculateStakingBoost(0, true), 0);
    assert.strictEqual(calculateStakingBoost(-50, true), 0);
  });

  it('supports custom multiplier parameters', () => {
    const boosted = calculateStakingBoost(100, true, 1.35);
    assert.strictEqual(boosted, 135);
  });
});

describe('Suite 7: FlywheelState Accumulator and Lifecycle Invariants', () => {
  it('initializes clean zeroed FlywheelState', () => {
    const state = createInitialFlywheelState();
    assert.strictEqual(state.totalBurned, 0);
    assert.strictEqual(state.totalStakingYield, 0);
    assert.strictEqual(state.totalPrizesDisbursed, 0);
    assert.strictEqual(state.totalMatches, 0);
    assert.strictEqual(state.totalSwaps, 0);
    assert.strictEqual(state.totalTradesTaxed, 0);
  });

  it('accumulates match payout sinks and prizes over multiple matches', () => {
    let state = createInitialFlywheelState();
    const match1 = calculateMatchPayouts(1000, [0, 1, 2, 3]);
    state = applyMatchPayouts(state, match1);

    assert.strictEqual(state.totalBurned, 200);
    assert.strictEqual(state.totalStakingYield, 200);
    assert.strictEqual(state.totalPrizesDisbursed, 3600);
    assert.strictEqual(state.totalMatches, 1);

    const match2 = calculateMatchPayouts(1000, [3, 2, 1, 0]);
    state = applyMatchPayouts(state, match2);

    assert.strictEqual(state.totalBurned, 400);
    assert.strictEqual(state.totalStakingYield, 400);
    assert.strictEqual(state.totalPrizesDisbursed, 7200);
    assert.strictEqual(state.totalMatches, 2);
  });

  it('accumulates point swap burned tokens', () => {
    let state = createInitialFlywheelState();
    const swap1 = calculatePointSwap(1000);
    state = applyPointSwap(state, swap1);

    assert.strictEqual(state.totalBurned, 3);
    assert.strictEqual(state.totalSwaps, 1);

    const swap2 = calculatePointSwap(2000);
    state = applyPointSwap(state, swap2);

    assert.strictEqual(state.totalBurned, 9);
    assert.strictEqual(state.totalSwaps, 2);
  });

  it('accumulates OTC trade micro-taxes into community staking yield', () => {
    let state = createInitialFlywheelState();
    const trade1 = calculateTradeTax(100);
    state = applyTradeTax(state, trade1);

    assert.strictEqual(state.totalStakingYield, 1);
    assert.strictEqual(state.totalTradesTaxed, 1);

    const trade2 = calculateTradeTax(300);
    state = applyTradeTax(state, trade2);

    assert.strictEqual(state.totalStakingYield, 4);
    assert.strictEqual(state.totalTradesTaxed, 2);
  });

  it('maintains strict mathematical conservation across combined multi-activity simulation', () => {
    let state = createInitialFlywheelState();

    for (let i = 0; i < 5; i++) {
      const match = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      state = applyMatchPayouts(state, match);
    }

    for (let i = 0; i < 10; i++) {
      const swap = calculatePointSwap(1000);
      state = applyPointSwap(state, swap);
    }

    for (let i = 0; i < 8; i++) {
      const trade = calculateTradeTax(100);
      state = applyTradeTax(state, trade);
    }

    assert.strictEqual(state.totalBurned, 1030);
    assert.strictEqual(state.totalStakingYield, 1008);
    assert.strictEqual(state.totalPrizesDisbursed, 18000);
    assert.strictEqual(state.totalMatches, 5);
    assert.strictEqual(state.totalSwaps, 10);
    assert.strictEqual(state.totalTradesTaxed, 8);
  });
});

describe('Suite: Casual Treasury Points formula', () => {
  it('scores cash + placedShops * 50 + completeClusters * 100', () => {
    assert.strictEqual(POINTS_PER_SHOP, 50);
    assert.strictEqual(POINTS_PER_COMPLETE_CLUSTER, 100);
    assert.strictEqual(calculateTreasuryPoints(0, 0, 0), 0);
    assert.strictEqual(calculateTreasuryPoints(120, 0, 0), 120);
    assert.strictEqual(calculateTreasuryPoints(120, 7, 0), 120 + 350);
    assert.strictEqual(calculateTreasuryPoints(120, 7, 2), 120 + 350 + 200);
  });

  it('feeds the 3% swap burn at 10 points = 1 $wif', () => {
    const points = calculateTreasuryPoints(500, 10, 3); // 500 + 500 + 300 = 1300
    const swap = calculatePointSwap(points, 0.1, 0.03);
    assert.strictEqual(points, 1300);
    assert.strictEqual(swap.grossWif, 130);
    assert.strictEqual(swap.burnedWif + swap.netWif, 130);
  });
});
