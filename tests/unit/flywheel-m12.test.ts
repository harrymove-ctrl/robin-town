/**
 * tests/unit/flywheel-m12.test.ts
 *
 * Comprehensive Milestone 12 test suite for $wif Tokenomics Flywheel and Community Governance.
 * Covers:
 * 1. Community governance proposals and vote data models.
 * 2. Governance voting fee burn math and explicit routing to 0x...dEaD.
 * 3. FlywheelState cumulative tracking across governance burns.
 * 4. Input validation and boundary error handling.
 * 5. Verification of 1,000 $wif arena matches across 3, 4, 5, and 6 player scaling.
 * 6. Verification of 3% point swap burn and 1% OTC trade micro-tax.
 * 7. Combined multi-activity economic conservation stress test.
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
} from '../../src/tokenomics/flywheel';

describe('Suite 1: Governance Proposal Lifecycle and Data Models', () => {
  it('creates a proposal with initialized tallies and active status', () => {
    const prop = createGovernanceProposal(
      'prop-1',
      'Reduce OTC Micro-Tax to 0.5%',
      'Lower trading friction in Chinatown marketplace',
      '0x1000000000000000000000000000000000000001',
      'tax',
      7 * 24 * 3600 * 1000,
      { tradeMicroTax: 0.005 }
    );

    assert.strictEqual(prop.id, 'prop-1');
    assert.strictEqual(prop.title, 'Reduce OTC Micro-Tax to 0.5%');
    assert.strictEqual(prop.category, 'tax');
    assert.strictEqual(prop.forVotes, 0);
    assert.strictEqual(prop.againstVotes, 0);
    assert.strictEqual(prop.totalBurned, 0);
    assert.strictEqual(prop.status, 'active');
    assert.strictEqual(prop.targetConfig?.tradeMicroTax, 0.005);
  });

  it('registers proposal into FlywheelState cleanly', () => {
    const state = createInitialFlywheelState();
    const prop = createGovernanceProposal(
      'prop-2',
      'Increase Staking Multiplier',
      'Reward long term liquidity providers',
      '0x2000000000000000000000000000000000000002',
      'rewards'
    );
    const updated = registerGovernanceProposal(state, prop);

    assert.ok(updated.proposals['prop-2']);
    assert.strictEqual(updated.proposals['prop-2'].title, 'Increase Staking Multiplier');
    assert.strictEqual(updated.totalBurned, 0);
  });

  it('rejects empty proposal id, title, or proposer', () => {
    assert.throws(
      () => createGovernanceProposal('', 'Title', 'Desc', '0x1'),
      /Proposal id must be a non-empty string/
    );
    assert.throws(
      () => createGovernanceProposal('prop-1', '', 'Desc', '0x1'),
      /Proposal title must be a non-empty string/
    );
    assert.throws(
      () => createGovernanceProposal('prop-1', 'Title', 'Desc', ''),
      /Proposal proposer must be a valid address string/
    );
  });

  it('resolves proposal status based on quorum and votes', () => {
    const prop = createGovernanceProposal('prop-3', 'Title', 'Desc', '0x1');
    prop.forVotes = 150;
    prop.againstVotes = 50;

    assert.strictEqual(resolveGovernanceProposal(prop, 100), 'passed');

    prop.againstVotes = 200;
    assert.strictEqual(resolveGovernanceProposal(prop, 100), 'rejected');

    prop.forVotes = 10;
    prop.againstVotes = 10;
    assert.strictEqual(resolveGovernanceProposal(prop, 100), 'rejected');
  });
});

describe('Suite 2: Community Governance Vote Casting and Deflationary Burn Math', () => {
  const voter = '0x1000000000000000000000000000000000000001';

  it('calculates governance vote with 2% burn (100 voting power yielding 2 $wif burn)', () => {
    const vote = calculateGovernanceVote('prop-1', voter, true, 100);

    assert.strictEqual(vote.proposalId, 'prop-1');
    assert.strictEqual(vote.voterAddress, voter);
    assert.strictEqual(vote.support, true);
    assert.strictEqual(vote.votingPower, 100);
    assert.strictEqual(vote.burnAmount, 2);
    assert.strictEqual(vote.burnAddress, BURN_ADDRESS);
  });

  it('calculates governance vote with dissenting support (support=false)', () => {
    const vote = calculateGovernanceVote('prop-1', voter, false, 250);

    assert.strictEqual(vote.support, false);
    assert.strictEqual(vote.votingPower, 250);
    assert.strictEqual(vote.burnAmount, 5);
    assert.strictEqual(vote.burnAddress, BURN_ADDRESS);
  });

  it('guarantees burn address is canonical dead address 0x...dEaD', () => {
    const vote = calculateGovernanceVote('prop-1', voter, true, 1000);
    assert.strictEqual(vote.burnAddress, '0x000000000000000000000000000000000000dEaD');
    assert.strictEqual(vote.burnAddress, BURN_ADDRESS);
  });

  it('applies Math.ceil minimum burn of 1 $wif on fractional fees', () => {
    const vote = calculateGovernanceVote('prop-1', voter, true, 10);
    assert.strictEqual(vote.burnAmount, 1);
  });

  it('supports custom governance burn rate override', () => {
    const vote = calculateGovernanceVote('prop-1', voter, true, 500, 0.05);
    assert.strictEqual(vote.burnAmount, 25);
  });

  it('supports zero burn rate option cleanly', () => {
    const vote = calculateGovernanceVote('prop-1', voter, true, 500, 0);
    assert.strictEqual(vote.burnAmount, 0);
  });
});

describe('Suite 3: FlywheelState Governance Tracking and State Invariants', () => {
  const voter1 = '0x1000000000000000000000000000000000000001';
  const voter2 = '0x2000000000000000000000000000000000000002';

  it('tracks cumulative totalBurned when casting votes', () => {
    const state = createInitialFlywheelState();
    const result = castGovernanceVote(state, 'prop-1', voter1, true, 100, 0.02);

    assert.strictEqual(result.totalBurned, 2);
    assert.strictEqual(result.state.totalBurned, 2);
    assert.strictEqual(result.burnedAmount, 2);
    assert.strictEqual(result.burnAddress, BURN_ADDRESS);
  });

  it('tracks totalGovernanceBurned and totalGovernanceVotes counters', () => {
    let state = createInitialFlywheelState();
    state = castGovernanceVote(state, 'prop-1', voter1, true, 100, 0.02).state;
    state = castGovernanceVote(state, 'prop-1', voter2, false, 200, 0.02).state;

    assert.strictEqual(state.totalGovernanceVotes, 2);
    assert.strictEqual(state.totalGovernanceBurned, 6);
    assert.strictEqual(state.totalBurned, 6);
  });

  it('preserves FlywheelState immutability', () => {
    const state = createInitialFlywheelState();
    const next = castGovernanceVote(state, 'prop-1', voter1, true, 100);

    assert.strictEqual(state.totalBurned, 0);
    assert.strictEqual(state.totalGovernanceVotes, 0);
    assert.strictEqual(next.state.totalBurned, 2);
    assert.strictEqual(next.state.totalGovernanceVotes, 1);
  });

  it('records votes into state.votes history array', () => {
    let state = createInitialFlywheelState();
    state = castGovernanceVote(state, 'prop-1', voter1, true, 100).state;
    state = castGovernanceVote(state, 'prop-1', voter2, false, 300).state;

    assert.strictEqual(state.votes.length, 2);
    assert.strictEqual(state.votes[0].voterAddress, voter1);
    assert.strictEqual(state.votes[0].support, true);
    assert.strictEqual(state.votes[1].voterAddress, voter2);
    assert.strictEqual(state.votes[1].support, false);
  });

  it('updates proposal forVotes and totalBurned on affirmative vote', () => {
    const initial = createInitialFlywheelState();
    const prop = createGovernanceProposal('prop-1', 'Title', 'Desc', voter1);
    const withProp = registerGovernanceProposal(initial, prop);

    const result = castGovernanceVote(withProp, 'prop-1', voter1, true, 500, 0.02);

    assert.strictEqual(result.proposal.forVotes, 500);
    assert.strictEqual(result.proposal.againstVotes, 0);
    assert.strictEqual(result.proposal.totalBurned, 10);
  });

  it('updates proposal againstVotes and totalBurned on negative vote', () => {
    const initial = createInitialFlywheelState();
    const prop = createGovernanceProposal('prop-1', 'Title', 'Desc', voter1);
    const withProp = registerGovernanceProposal(initial, prop);

    const result = castGovernanceVote(withProp, 'prop-1', voter2, false, 350, 0.02);

    assert.strictEqual(result.proposal.forVotes, 0);
    assert.strictEqual(result.proposal.againstVotes, 350);
    assert.strictEqual(result.proposal.totalBurned, 7);
  });

  it('auto-creates proposal descriptor if voting on unregistered proposalId', () => {
    const state = createInitialFlywheelState();
    const result = castGovernanceVote(state, 'prop-auto-99', voter1, true, 100);

    assert.ok(result.state.proposals['prop-auto-99']);
    assert.strictEqual(result.proposal.id, 'prop-auto-99');
    assert.strictEqual(result.proposal.forVotes, 100);
    assert.strictEqual(result.proposal.totalBurned, 2);
  });
});

describe('Suite 4: Input Validation and Boundary Security', () => {
  const state = createInitialFlywheelState();
  const voter = '0x1000000000000000000000000000000000000001';

  it('throws error on zero voting power', () => {
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', voter, true, 0),
      /votingPower must be a positive finite number/
    );
  });

  it('throws error on negative voting power', () => {
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', voter, true, -100),
      /votingPower must be a positive finite number/
    );
  });

  it('throws error on non-finite voting power', () => {
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', voter, true, Number.NaN),
      /votingPower must be a positive finite number/
    );
  });

  it('throws error on empty proposalId', () => {
    assert.throws(
      () => castGovernanceVote(state, '', voter, true, 100),
      /proposalId must be a valid non-empty string/
    );
  });

  it('throws error on empty voterAddress', () => {
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', '', true, 100),
      /voterAddress must be a valid address string/
    );
  });

  it('throws error on burnRate outside 0 to 1 range', () => {
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', voter, true, 100, -0.01),
      /burnRate must be a number between 0 and 1/
    );
    assert.throws(
      () => castGovernanceVote(state, 'prop-1', voter, true, 100, 1.5),
      /burnRate must be a number between 0 and 1/
    );
  });
});

describe('Suite 5: Verification of 1,000 $wif Match Pools Across 3, 4, 5, and 6 Players', () => {
  it('verifies 3-player match: 3000 pool, 150 burn (5%), 150 vault (5%), 2700 purse (90%), podium 1620 / 675 / 405', () => {
    const res = calculateMatchPayouts(1000, [0, 1, 2]);
    assert.strictEqual(res.totalPool, 3000);
    assert.strictEqual(res.burnedAmount, 150);
    assert.strictEqual(res.vaultAmount, 150);
    assert.strictEqual(res.purseAmount, 2700);
    assert.strictEqual(res.payouts[0], 1620);
    assert.strictEqual(res.payouts[1], 675);
    assert.strictEqual(res.payouts[2], 405);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, 3000);
  });

  it('verifies 4-player match: 4000 pool, 200 burn (5%), 200 vault (5%), 3600 purse (90%), podium 2160 / 900 / 540', () => {
    const res = calculateMatchPayouts(1000, [0, 1, 2, 3]);
    assert.strictEqual(res.totalPool, 4000);
    assert.strictEqual(res.burnedAmount, 200);
    assert.strictEqual(res.vaultAmount, 200);
    assert.strictEqual(res.purseAmount, 3600);
    assert.strictEqual(res.payouts[0], 2160);
    assert.strictEqual(res.payouts[1], 900);
    assert.strictEqual(res.payouts[2], 540);
    assert.strictEqual(res.payouts[3], 0);
  });

  it('verifies 5-player match: 5000 pool, 250 burn (5%), 250 vault (5%), 4500 purse (90%), podium 2700 / 1125 / 675', () => {
    const res = calculateMatchPayouts(1000, [0, 1, 2, 3, 4]);
    assert.strictEqual(res.totalPool, 5000);
    assert.strictEqual(res.burnedAmount, 250);
    assert.strictEqual(res.vaultAmount, 250);
    assert.strictEqual(res.purseAmount, 4500);
    assert.strictEqual(res.payouts[0], 2700);
    assert.strictEqual(res.payouts[1], 1125);
    assert.strictEqual(res.payouts[2], 675);
    assert.strictEqual(res.payouts[3], 0);
    assert.strictEqual(res.payouts[4], 0);
  });

  it('verifies 6-player match: 6000 pool, 300 burn (5%), 300 vault (5%), 5400 purse (90%), podium 3240 / 1350 / 810', () => {
    const res = calculateMatchPayouts(1000, [0, 1, 2, 3, 4, 5]);
    assert.strictEqual(res.totalPool, 6000);
    assert.strictEqual(res.burnedAmount, 300);
    assert.strictEqual(res.vaultAmount, 300);
    assert.strictEqual(res.purseAmount, 5400);
    assert.strictEqual(res.payouts[0], 3240);
    assert.strictEqual(res.payouts[1], 1350);
    assert.strictEqual(res.payouts[2], 810);
    assert.strictEqual(res.payouts[3], 0);
    assert.strictEqual(res.payouts[4], 0);
    assert.strictEqual(res.payouts[5], 0);
  });

  it('allocates rounding dust to first place winner on non-divisible pool', () => {
    const res = calculateMatchPayouts(777, [0, 1, 2, 3]);
    assert.strictEqual(res.totalPool, 3108);
    const sumSinks = res.burnedAmount + res.vaultAmount + res.purseAmount;
    assert.strictEqual(sumSinks, 3108);
    const sumPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumPayouts, res.purseAmount);
  });
});

describe('Suite 6: Verification of 3% Point Swap Burn and 1% OTC Trade Micro-Tax', () => {
  it('verifies 3% burn on 1,000 point swap (100 gross $wif, 3 burned, 97 net)', () => {
    const res = calculatePointSwap(1000);
    assert.strictEqual(res.grossWif, 100);
    assert.strictEqual(res.burnedWif, 3);
    assert.strictEqual(res.netWif, 97);
    assert.strictEqual(res.burnAddress, BURN_ADDRESS);
  });

  it('verifies 3% burn on 10,000 point swap (1,000 gross $wif, 30 burned, 970 net)', () => {
    const res = calculatePointSwap(10000);
    assert.strictEqual(res.grossWif, 1000);
    assert.strictEqual(res.burnedWif, 30);
    assert.strictEqual(res.netWif, 970);
  });

  it('verifies sub-threshold points yield 0 gross and 0 net', () => {
    const res = calculatePointSwap(5);
    assert.strictEqual(res.grossWif, 0);
    assert.strictEqual(res.burnedWif, 0);
    assert.strictEqual(res.netWif, 0);
  });

  it('verifies 1% OTC trade micro-tax on 100 $wif cash transfer', () => {
    const res = calculateTradeTax(100);
    assert.strictEqual(res.grossCash, 100);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 99);
    assert.strictEqual(res.vaultAmount, 1);
  });

  it('verifies 1% OTC trade micro-tax on 1,000 $wif cash transfer', () => {
    const res = calculateTradeTax(1000);
    assert.strictEqual(res.grossCash, 1000);
    assert.strictEqual(res.taxAmount, 10);
    assert.strictEqual(res.netCash, 990);
    assert.strictEqual(res.vaultAmount, 10);
  });

  it('applies Math.ceil on odd cash transfer (75 cash transfer yielding 1 tax, 74 net)', () => {
    const res = calculateTradeTax(75);
    assert.strictEqual(res.grossCash, 75);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 74);
  });
});

describe('Suite 7: Combined Multi-Activity Flywheel Conservation Stress Test', () => {
  it('maintains absolute conservation across matches, swaps, trades, and governance votes', () => {
    let state = createInitialFlywheelState();
    const voter = '0x1000000000000000000000000000000000000001';

    let expectedBurned = 0;
    let expectedVault = 0;
    let expectedDisbursed = 0;

    // 4 matches with varying player counts (3, 4, 5, 6)
    const playerConfigs = [[0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]];
    for (const ranking of playerConfigs) {
      const match = calculateMatchPayouts(1000, ranking);
      state = applyMatchPayouts(state, match);
      expectedBurned += match.burnedAmount;
      expectedVault += match.vaultAmount;
      expectedDisbursed += match.purseAmount;
    }

    // 12 point swaps
    for (let i = 1; i <= 12; i++) {
      const swap = calculatePointSwap(i * 500);
      state = applyPointSwap(state, swap);
      expectedBurned += swap.burnedWif;
    }

    // 20 OTC trade micro-taxes
    for (let i = 1; i <= 20; i++) {
      const trade = calculateTradeTax(i * 100);
      state = applyTradeTax(state, trade);
      expectedVault += trade.vaultAmount;
    }

    // 8 governance votes
    for (let i = 1; i <= 8; i++) {
      const voteResult = castGovernanceVote(
        state,
        `prop-${(i % 3) + 1}`,
        voter,
        i % 2 === 0,
        i * 250,
        0.02
      );
      state = voteResult.state;
      expectedBurned += voteResult.burnedAmount;
    }

    assert.strictEqual(state.totalBurned, expectedBurned);
    assert.strictEqual(state.totalStakingYield, expectedVault);
    assert.strictEqual(state.totalPrizesDisbursed, expectedDisbursed);
    assert.strictEqual(state.totalMatches, 4);
    assert.strictEqual(state.totalSwaps, 12);
    assert.strictEqual(state.totalTradesTaxed, 20);
    assert.strictEqual(state.totalGovernanceVotes, 8);
    assert.ok(state.totalGovernanceBurned > 0);
    assert.strictEqual(state.votes.length, 8);
  });
});
