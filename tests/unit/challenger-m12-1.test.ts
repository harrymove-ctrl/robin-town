/**
 * tests/unit/challenger-m12-1.test.ts
 *
 * Empirical Challenger M12.1 Adversarial Stress Test Harness.
 * Validates tokenomics invariants, match pool fee distributions,
 * governance voting burns, dead address routing, and token conservation.
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
  createGovernanceProposal,
  registerGovernanceProposal,
  calculateGovernanceVote,
  castGovernanceVote,
  resolveGovernanceProposal,
  type FlywheelState,
  type MatchPoolResult,
} from '../../src/tokenomics/flywheel';

import {
  WalletAdapter,
  DEFAULT_SIMULATED_ACCOUNTS,
} from '../../src/tokenomics/wallet';

import {
  WalletFlywheelController,
} from '../../src/ui/wallet-flywheel-modal';

/**
 * Deterministic linear congruential generator for reproducible fuzz testing.
 */
function createPrng(seed = 987654321): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Challenger M12.1 Suite 1: 1,000 $wif Match Pool Calculations Across 3, 4, 5, and 6 Players', () => {
  it('verifies 3-player match: 3000 pool, 150 burn (5%), 150 vault (5%), 2700 purse (90%), podium 1620 / 675 / 405', () => {
    const rankings = [10, 20, 30];
    const res = calculateMatchPayouts(1000, rankings);

    // Exact sums and allocations
    assert.strictEqual(res.totalPool, 3000);
    assert.strictEqual(res.burnedAmount, 150);
    assert.strictEqual(res.vaultAmount, 150);
    assert.strictEqual(res.purseAmount, 2700);

    // Exact podium prizes
    assert.strictEqual(res.payouts[10], 1620);
    assert.strictEqual(res.payouts[20], 675);
    assert.strictEqual(res.payouts[30], 405);

    // Exact sum verification: 150 + 150 + 2700 = 3000
    const totalSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(totalSinks, 3000);

    // Exact purse verification: 1620 + 675 + 405 = 2700
    const totalPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalPayouts, 2700);
    assert.strictEqual(res.burnAddress, BURN_ADDRESS);
  });

  it('verifies 4-player match: 4000 pool, 200 burn (5%), 200 vault (5%), 3600 purse (90%), podium 2160 / 900 / 540', () => {
    const rankings = [0, 1, 2, 3];
    const res = calculateMatchPayouts(1000, rankings);

    assert.strictEqual(res.totalPool, 4000);
    assert.strictEqual(res.burnedAmount, 200);
    assert.strictEqual(res.vaultAmount, 200);
    assert.strictEqual(res.purseAmount, 3600);

    assert.strictEqual(res.payouts[0], 2160);
    assert.strictEqual(res.payouts[1], 900);
    assert.strictEqual(res.payouts[2], 540);
    assert.strictEqual(res.payouts[3], 0);

    const totalSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(totalSinks, 4000);

    const totalPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalPayouts, 3600);
  });

  it('verifies 5-player match: 5000 pool, 250 burn (5%), 250 vault (5%), 4500 purse (90%), podium 2700 / 1125 / 675', () => {
    const rankings = [1, 2, 3, 4, 5];
    const res = calculateMatchPayouts(1000, rankings);

    assert.strictEqual(res.totalPool, 5000);
    assert.strictEqual(res.burnedAmount, 250);
    assert.strictEqual(res.vaultAmount, 250);
    assert.strictEqual(res.purseAmount, 4500);

    assert.strictEqual(res.payouts[1], 2700);
    assert.strictEqual(res.payouts[2], 1125);
    assert.strictEqual(res.payouts[3], 675);
    assert.strictEqual(res.payouts[4], 0);
    assert.strictEqual(res.payouts[5], 0);

    const totalSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(totalSinks, 5000);

    const totalPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalPayouts, 4500);
  });

  it('verifies 6-player match: 6000 pool, 300 burn (5%), 300 vault (5%), 5400 purse (90%), podium 3240 / 1350 / 810', () => {
    const rankings = [100, 200, 300, 400, 500, 600];
    const res = calculateMatchPayouts(1000, rankings);

    assert.strictEqual(res.totalPool, 6000);
    assert.strictEqual(res.burnedAmount, 300);
    assert.strictEqual(res.vaultAmount, 300);
    assert.strictEqual(res.purseAmount, 5400);

    assert.strictEqual(res.payouts[100], 3240);
    assert.strictEqual(res.payouts[200], 1350);
    assert.strictEqual(res.payouts[300], 810);
    assert.strictEqual(res.payouts[400], 0);
    assert.strictEqual(res.payouts[500], 0);
    assert.strictEqual(res.payouts[600], 0);

    const totalSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(totalSinks, 6000);

    const totalPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalPayouts, 5400);
  });

  it('handles empty participant rankings cleanly without division by zero', () => {
    const res = calculateMatchPayouts(1000, []);
    assert.strictEqual(res.totalPool, 0);
    assert.strictEqual(res.burnedAmount, 0);
    assert.strictEqual(res.vaultAmount, 0);
    assert.strictEqual(res.purseAmount, 0);
    assert.deepStrictEqual(res.payouts, {});
    assert.deepStrictEqual(res.podium, []);
  });

  it('throws descriptive error on negative or non-finite buy-in stakes', () => {
    assert.throws(
      () => calculateMatchPayouts(-100, [0, 1, 2]),
      /buyInPerPlayer must be a non-negative finite number/
    );
    assert.throws(
      () => calculateMatchPayouts(Number.NaN, [0, 1, 2]),
      /buyInPerPlayer must be a non-negative finite number/
    );
    assert.throws(
      () => calculateMatchPayouts(Number.POSITIVE_INFINITY, [0, 1, 2]),
      /buyInPerPlayer must be a non-negative finite number/
    );
  });
});

describe('Challenger M12.1 Suite 2: Fuzz Testing Arbitrary Match Stakes with Zero Token Leakage Oracle', () => {
  const specificStakes = [500, 1000, 2500, 7777, 1, 7, 13, 99, 101, 333, 777, 12345, 999999];

  for (const playerCount of [3, 4, 5, 6]) {
    for (const stake of specificStakes) {
      it(`enforces exact token conservation for ${playerCount}p with stake ${stake} $wif`, () => {
        const rankings = Array.from({ length: playerCount }, (_, idx) => idx + 1);
        const res = calculateMatchPayouts(stake, rankings);

        const totalPool = Math.round(stake * playerCount);
        assert.strictEqual(res.totalPool, totalPool);

        // 1. Sinks conservation
        const sumSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
        assert.strictEqual(sumSinks, totalPool);

        // 2. Purse conservation across podium and dust
        const sumPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
        assert.strictEqual(sumPayouts, res.purseAmount);

        // 3. Absolute zero token leakage
        const totalDisbursed = res.burnedAmount + res.vaultAmount + sumPayouts;
        assert.strictEqual(totalDisbursed, totalPool);

        // 4. Podium monotonicity: 1st >= 2nd >= 3rd >= non-podium (0)
        assert.ok(res.payouts[1] >= res.payouts[2]);
        assert.ok(res.payouts[2] >= res.payouts[3]);
        for (let p = 4; p <= playerCount; p++) {
          assert.strictEqual(res.payouts[p], 0);
        }
      });
    }
  }

  it('fuzzes 100 random stakes across all player counts (3, 4, 5, 6) ensuring 100% conservation', () => {
    const rng = createPrng(424242);

    for (let i = 0; i < 100; i++) {
      const playerCount = 3 + Math.floor(rng() * 4); // 3, 4, 5, or 6
      const randomStake = Math.floor(rng() * 50000) + 1; // 1 to 50,000 $wif
      const rankings = Array.from({ length: playerCount }, (_, idx) => idx);

      const res = calculateMatchPayouts(randomStake, rankings);
      const sumSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
      const sumPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);

      assert.strictEqual(sumSinks, res.totalPool);
      assert.strictEqual(sumPayouts, res.purseAmount);
      assert.strictEqual(res.burnedAmount + res.vaultAmount + sumPayouts, res.totalPool);
    }
  });
});

describe('Challenger M12.1 Suite 3: Governance Voting Anti-Sybil Fee Math and Dead Address Burn', () => {
  const voter = '0x1000000000000000000000000000000000000001';

  it('guarantees burn destination is canonical dead address 0x000000000000000000000000000000000000dEaD', () => {
    const vote = calculateGovernanceVote('prop-alpha', voter, true, 1000);
    assert.strictEqual(vote.burnAddress, '0x000000000000000000000000000000000000dEaD');
    assert.strictEqual(vote.burnAddress, BURN_ADDRESS);
    assert.strictEqual(DEFAULT_FLYWHEEL_CONFIG.burnAddress, '0x000000000000000000000000000000000000dEaD');
  });

  it('empirically verifies 2% anti-sybil fee round-up across sample voting powers', () => {
    const powers = [1, 2, 10, 49, 50, 51, 99, 100, 101, 250, 500, 1000, 2500, 7777, 10000, 50000];

    for (const p of powers) {
      const vote = calculateGovernanceVote('prop-1', voter, true, p);
      const expectedBurn = Math.max(1, Math.ceil(p * 0.02));
      assert.strictEqual(
        vote.burnAmount,
        expectedBurn,
        `Mismatch for voting power ${p}: expected ${expectedBurn}, got ${vote.burnAmount}`
      );
    }
  });

  it('verifies round-up threshold boundaries for 2% anti-sybil fee', () => {
    // 1 to 50 power rounds up to 1
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 1).burnAmount, 1);
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 50).burnAmount, 1);

    // 51 to 100 power rounds up to 2
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 51).burnAmount, 2);
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 100).burnAmount, 2);

    // 101 to 150 power rounds up to 3
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 101).burnAmount, 3);
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 150).burnAmount, 3);

    // 7777 power: 7777 * 0.02 = 155.54 -> ceil = 156
    assert.strictEqual(calculateGovernanceVote('p', voter, true, 7777).burnAmount, 156);
  });

  it('rejects invalid inputs on calculateGovernanceVote', () => {
    assert.throws(() => calculateGovernanceVote('', voter, true, 100), /proposalId must be a valid non-empty string/);
    assert.throws(() => calculateGovernanceVote('   ', voter, true, 100), /proposalId must be a valid non-empty string/);
    assert.throws(() => calculateGovernanceVote('prop', '', true, 100), /voterAddress must be a valid address string/);
    assert.throws(() => calculateGovernanceVote('prop', '   ', true, 100), /voterAddress must be a valid address string/);
    assert.throws(() => calculateGovernanceVote('prop', voter, true, 0), /votingPower must be a positive finite number/);
    assert.throws(() => calculateGovernanceVote('prop', voter, true, -50), /votingPower must be a positive finite number/);
    assert.throws(() => calculateGovernanceVote('prop', voter, true, Number.NaN), /votingPower must be a positive finite number/);
    assert.throws(() => calculateGovernanceVote('prop', voter, true, 100, -0.1), /burnRate must be a number between 0 and 1/);
    assert.throws(() => calculateGovernanceVote('prop', voter, true, 100, 1.1), /burnRate must be a number between 0 and 1/);
  });
});

describe('Challenger M12.1 Suite 4: Voter Balance Validation and Rejection Invariants', () => {
  it('rejects vote when voter balance is zero', async () => {
    const wallet = new WalletAdapter({ mode: 'simulation' });
    // Empty Alice balance
    await wallet.transfer(BURN_ADDRESS, 10000);
    assert.strictEqual(wallet.getState().account?.balance, 0);

    const controller = new WalletFlywheelController({ walletAdapter: wallet });

    await assert.rejects(
      async () => {
        await controller.castVote('RTP-1', true, 100);
      },
      /Insufficient \$wif balance \(0 \$wif\) to burn voting fee/
    );

    // Verify error state in view model
    assert.ok(controller.getViewModel().validationError?.includes('Insufficient $wif balance'));
    assert.strictEqual(controller.getFlywheelState().totalBurned, 0);
  });

  it('rejects vote when voter balance is strictly less than required fee', async () => {
    const wallet = new WalletAdapter({ mode: 'simulation' });
    // Leave exactly 10 $wif in Alice account
    await wallet.transfer(BURN_ADDRESS, 9990);
    assert.strictEqual(wallet.getState().account?.balance, 10);

    const controller = new WalletFlywheelController({ walletAdapter: wallet });

    // Requesting 1,000 voting power requires 50 $wif burn fee at 5% rate (or 20 $wif at 2%)
    // Since balance is 10, both rates exceed balance
    await assert.rejects(
      async () => {
        await controller.castVote('RTP-1', true, 1000);
      },
      /Insufficient \$wif balance \(10 \$wif\) to burn voting fee/
    );

    // Verify balance remains exactly 10 with zero leakage
    assert.strictEqual(wallet.getState().account?.balance, 10);
    assert.strictEqual(controller.getFlywheelState().totalBurned, 0);
  });

  it('executes clean burn and balance reduction when balance is sufficient for voting fee', async () => {
    const wallet = new WalletAdapter({ mode: 'simulation' });
    const controller = new WalletFlywheelController({ walletAdapter: wallet });
    const initialBal = wallet.getState().account?.balance!;
    assert.strictEqual(initialBal, 10000);

    // Cast vote with 500 voting power
    const result = await controller.castVote('RTP-1', true, 500);
    const burnFee = result.vote.burnAmount;
    const finalBal = wallet.getState().account?.balance!;

    // Balance must be reduced by exact burn fee
    assert.strictEqual(finalBal, initialBal - burnFee);
    assert.strictEqual(result.vote.burnAddress, BURN_ADDRESS);
    assert.strictEqual(controller.getFlywheelState().totalBurned, burnFee);
    assert.strictEqual(controller.getFlywheelState().totalGovernanceBurned, burnFee);
  });
});

describe('Challenger M12.1 Suite 5: Strict Monotonicity of Deflationary Burns and Governance Metrics', () => {
  it('enforces strict monotonicity across totalBurned, totalGovernanceBurned, and totalGovernanceVotes', () => {
    let state = createInitialFlywheelState();
    const voter = '0x1000000000000000000000000000000000000001';
    const testVotes = [50, 100, 250, 500, 1000, 2500, 7777, 10];

    let prevBurned = 0;
    let prevGovBurned = 0;
    let prevVotes = 0;

    for (let idx = 0; idx < testVotes.length; idx++) {
      const power = testVotes[idx];
      const res = castGovernanceVote(state, 'RTP-TEST', voter, idx % 2 === 0, power);
      state = res.state;

      // Strict monotonicity assertions
      assert.ok(
        state.totalBurned > prevBurned,
        `totalBurned did not strictly increase: ${state.totalBurned} <= ${prevBurned}`
      );
      assert.ok(
        state.totalGovernanceBurned > prevGovBurned,
        `totalGovernanceBurned did not strictly increase: ${state.totalGovernanceBurned} <= ${prevGovBurned}`
      );
      assert.strictEqual(
        state.totalGovernanceVotes,
        prevVotes + 1,
        `totalGovernanceVotes did not increment by exactly 1: ${state.totalGovernanceVotes} !== ${prevVotes + 1}`
      );
      assert.strictEqual(state.votes.length, state.totalGovernanceVotes);

      prevBurned = state.totalBurned;
      prevGovBurned = state.totalGovernanceBurned;
      prevVotes = state.totalGovernanceVotes;
    }

    assert.strictEqual(state.totalGovernanceVotes, testVotes.length);
    assert.strictEqual(state.totalBurned, state.totalGovernanceBurned);
  });

  it('tracks proposal tally fidelity across mixed FOR and AGAINST votes', () => {
    let state = createInitialFlywheelState();
    const prop = createGovernanceProposal('prop-tallies', 'Tally Check', 'Desc', '0x1');
    state = registerGovernanceProposal(state, prop);

    // Vote 1: FOR 1000 power (burn 20)
    state = castGovernanceVote(state, 'prop-tallies', '0x1', true, 1000).state;
    // Vote 2: AGAINST 400 power (burn 8)
    state = castGovernanceVote(state, 'prop-tallies', '0x2', false, 400).state;
    // Vote 3: FOR 250 power (burn 5)
    state = castGovernanceVote(state, 'prop-tallies', '0x3', true, 250).state;

    const updated = state.proposals['prop-tallies'];
    assert.strictEqual(updated.forVotes, 1250);
    assert.strictEqual(updated.againstVotes, 400);
    assert.strictEqual(updated.totalBurned, 33);
    assert.strictEqual(state.totalBurned, 33);
    assert.strictEqual(state.totalGovernanceBurned, 33);
    assert.strictEqual(state.totalGovernanceVotes, 3);
  });
});

describe('Challenger M12.1 Suite 6: Integrated Multi-Activity Flywheel Ecosystem Conservation', () => {
  it('maintains absolute conservation across concurrent matches, swaps, trade micro-taxes, and governance votes', () => {
    let state = createInitialFlywheelState();
    let expectedBurned = 0;
    let expectedVault = 0;
    let expectedPrizes = 0;

    // 1. Matches across 3p, 4p, 5p, 6p
    const matchConfigs = [
      { stake: 1000, players: [0, 1, 2] },
      { stake: 1000, players: [0, 1, 2, 3] },
      { stake: 2500, players: [0, 1, 2, 3, 4] },
      { stake: 7777, players: [0, 1, 2, 3, 4, 5] },
    ];

    for (const mc of matchConfigs) {
      const match = calculateMatchPayouts(mc.stake, mc.players);
      state = applyMatchPayouts(state, match);
      expectedBurned += match.burnedAmount;
      expectedVault += match.vaultAmount;
      expectedPrizes += match.purseAmount;
    }

    // 2. Casual Point Swaps (3% burn tax)
    const swapPoints = [100, 500, 1000, 5000, 12345];
    for (const pts of swapPoints) {
      const swap = calculatePointSwap(pts);
      state = applyPointSwap(state, swap);
      expectedBurned += swap.burnedWif;
    }

    // 3. OTC Trade Micro-Taxes (1% fee to vault)
    const tradeCashes = [50, 100, 250, 1000, 5555];
    for (const cash of tradeCashes) {
      const tax = calculateTradeTax(cash);
      state = applyTradeTax(state, tax);
      expectedVault += tax.vaultAmount;
      expectedBurned += tax.burnedAmount;
    }

    // 4. Governance Voting Burns (2% fee)
    const votes = [100, 500, 1000, 2500, 7777];
    for (let i = 0; i < votes.length; i++) {
      const voteRes = castGovernanceVote(state, 'prop-multi', `0x${i + 1}`, true, votes[i]);
      state = voteRes.state;
      expectedBurned += voteRes.burnedAmount;
    }

    // Assert exact global accounting conservation
    assert.strictEqual(state.totalBurned, expectedBurned);
    assert.strictEqual(state.totalStakingYield, expectedVault);
    assert.strictEqual(state.totalPrizesDisbursed, expectedPrizes);
    assert.strictEqual(state.totalMatches, 4);
    assert.strictEqual(state.totalSwaps, 5);
    assert.strictEqual(state.totalTradesTaxed, 5);
    assert.strictEqual(state.totalGovernanceVotes, 5);
    assert.ok(state.totalGovernanceBurned > 0);
    assert.strictEqual(state.votes.length, 5);
  });
});
