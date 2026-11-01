/**
 * src/tokenomics/flywheel.ts
 *
 * $wif Tokenomics Flywheel and Economic Engine for robin-town.
 * Implements pure deterministic math for competitive match buy-in pools,
 * deflationary burn sinks, community staking vault allocations, podium prize
 * distributions, casual point-to-$wif redemptions, OTC trade micro-taxes,
 * staking yield multipliers, and community governance voting burns.
 */

export { BURN_ADDRESS } from './types';
export type * from './types';

import { BURN_ADDRESS } from './types';
import type {
  FlywheelConfig,
  PodiumPayout,
  MatchPoolResult,
  PointSwapResult,
  TradeTaxResult,
  FlywheelState,
  ProposalCategory,
  ProposalStatus,
  GovernanceProposal,
  GovernanceVote,
  GovernanceVoteResult,
} from './types';

export const DEFAULT_FLYWHEEL_CONFIG: Readonly<FlywheelConfig> = Object.freeze({
  buyInAmount: 1000,
  burnRate: 0.05,
  vaultRate: 0.05,
  purseRate: 0.90,
  podiumShares: [0.60, 0.25, 0.15],
  pointToWifRate: 0.10,
  swapBurnTax: 0.03,
  tradeMicroTax: 0.01,
  stakingMultiplier: 1.20,
  burnAddress: BURN_ADDRESS,
  governanceBurnRate: 0.02,
});

export function createInitialFlywheelState(): FlywheelState {
  return {
    totalBurned: 0,
    totalStakingYield: 0,
    totalPrizesDisbursed: 0,
    totalMatches: 0,
    totalSwaps: 0,
    totalTradesTaxed: 0,
    totalGovernanceVotes: 0,
    totalGovernanceBurned: 0,
    proposals: {},
    votes: [],
  };
}

/**
 * Calculates competitive match buy-in pool allocations and podium payouts.
 *
 * @param buyInPerPlayer Amount in $wif contributed by each participant.
 * @param rankings Array of player IDs sorted from first place to last place.
 * @param config Optional partial configuration overriding defaults.
 * @returns Complete accounting of burned tokens, vault allocation, purse, and payouts.
 */
export function calculateMatchPayouts(
  buyInPerPlayer: number,
  rankings: number[],
  config?: Partial<FlywheelConfig>
): MatchPoolResult {
  if (buyInPerPlayer < 0 || !Number.isFinite(buyInPerPlayer)) {
    throw new Error('buyInPerPlayer must be a non-negative finite number');
  }

  const cfg: FlywheelConfig = {
    ...DEFAULT_FLYWHEEL_CONFIG,
    ...config,
  };

  const playerCount = rankings.length;
  if (playerCount === 0) {
    return {
      totalPool: 0,
      burnedAmount: 0,
      vaultAmount: 0,
      purseAmount: 0,
      burnAddress: cfg.burnAddress,
      payouts: {},
      podium: [],
    };
  }

  const totalPool = Math.round(buyInPerPlayer * playerCount);
  const burnedAmount = Math.floor(totalPool * cfg.burnRate);
  const vaultAmount = Math.floor(totalPool * cfg.vaultRate);
  const purseAmount = totalPool - burnedAmount - vaultAmount;

  const payouts: Record<number, number> = {};
  for (const pid of rankings) {
    payouts[pid] = 0;
  }

  const podium: PodiumPayout[] = [];
  let distributedPurse = 0;

  for (let i = 0; i < cfg.podiumShares.length && i < playerCount; i++) {
    const pid = rankings[i];
    const share = cfg.podiumShares[i];
    const payout = Math.floor(purseAmount * share);

    payouts[pid] = payout;
    distributedPurse += payout;
    podium.push({
      rank: i + 1,
      playerId: pid,
      payout,
      percentage: share,
    });
  }

  // Allocate rounding dust to first place winner to guarantee exact purse conservation
  const purseDust = purseAmount - distributedPurse;
  if (purseDust > 0 && podium.length > 0) {
    const firstPlaceId = podium[0].playerId;
    payouts[firstPlaceId] += purseDust;
    podium[0].payout += purseDust;
  }

  return {
    totalPool,
    burnedAmount,
    vaultAmount,
    purseAmount,
    burnAddress: cfg.burnAddress,
    payouts,
    podium,
  };
}

/**
 * Calculates token swap for converting casual in-game points to $wif tokens.
 *
 * @param points Earned in-game score points.
 * @param swapRate Conversion ratio (default 0.10, meaning 10 points per 1 $wif).
 * @param burnTaxRate Deflationary burn tax rate deducted on redemption (default 0.03).
 * @returns Gross $wif, burned tokens sent to dead address, and net $wif received.
 */
export function calculatePointSwap(
  points: number,
  swapRate: number = DEFAULT_FLYWHEEL_CONFIG.pointToWifRate,
  burnTaxRate: number = DEFAULT_FLYWHEEL_CONFIG.swapBurnTax
): PointSwapResult {
  if (points <= 0 || !Number.isFinite(points)) {
    return {
      points: 0,
      grossWif: 0,
      burnedWif: 0,
      netWif: 0,
      burnAddress: DEFAULT_FLYWHEEL_CONFIG.burnAddress,
    };
  }

  const grossWif = Math.floor(points * swapRate);
  if (grossWif <= 0) {
    return {
      points,
      grossWif: 0,
      burnedWif: 0,
      netWif: 0,
      burnAddress: DEFAULT_FLYWHEEL_CONFIG.burnAddress,
    };
  }

  const burnedWif = Math.ceil(grossWif * burnTaxRate);
  const netWif = Math.max(0, grossWif - burnedWif);

  return {
    points,
    grossWif,
    burnedWif,
    netWif,
    burnAddress: DEFAULT_FLYWHEEL_CONFIG.burnAddress,
  };
}

/**
 * Calculates in-game OTC trade micro-tax on cash transfers.
 *
 * @param cashAmount Amount of $wif cash transferred in the trade.
 * @param taxRate Transaction fee percentage (default 0.01 for 1%).
 * @returns Net cash transferred to counterparty and tax routed to community staking vault.
 */
export function calculateTradeTax(
  cashAmount: number,
  taxRate: number = DEFAULT_FLYWHEEL_CONFIG.tradeMicroTax
): TradeTaxResult {
  if (cashAmount <= 0 || !Number.isFinite(cashAmount)) {
    return {
      grossCash: 0,
      taxAmount: 0,
      netCash: 0,
      vaultAmount: 0,
      burnedAmount: 0,
    };
  }

  const taxAmount = Math.min(cashAmount, Math.ceil(cashAmount * taxRate));
  const netCash = cashAmount - taxAmount;

  return {
    grossCash: cashAmount,
    taxAmount,
    netCash,
    vaultAmount: taxAmount,
    burnedAmount: 0,
  };
}

/**
 * Calculates seasonal staking yield boost for staked participants.
 *
 * @param baseReward Base yield or payout earned in $wif.
 * @param isStaked Whether player has an active staked position.
 * @param multiplier Yield multiplier (default 1.20 for 20% bonus).
 * @returns Boosted reward in $wif.
 */
export function calculateStakingBoost(
  baseReward: number,
  isStaked: boolean,
  multiplier: number = DEFAULT_FLYWHEEL_CONFIG.stakingMultiplier
): number {
  if (baseReward <= 0 || !Number.isFinite(baseReward)) {
    return 0;
  }
  if (!isStaked) {
    return Math.floor(baseReward);
  }
  return Math.floor(baseReward * multiplier);
}

/**
 * Updates FlywheelState accumulator with match pool outcomes.
 */
export function applyMatchPayouts(
  state: FlywheelState,
  result: MatchPoolResult
): FlywheelState {
  return {
    ...state,
    totalBurned: state.totalBurned + result.burnedAmount,
    totalStakingYield: state.totalStakingYield + result.vaultAmount,
    totalPrizesDisbursed: state.totalPrizesDisbursed + result.purseAmount,
    totalMatches: state.totalMatches + 1,
  };
}

/**
 * Updates FlywheelState accumulator with point swap outcomes.
 */
export function applyPointSwap(
  state: FlywheelState,
  result: PointSwapResult
): FlywheelState {
  return {
    ...state,
    totalBurned: state.totalBurned + result.burnedWif,
    totalSwaps: state.totalSwaps + 1,
  };
}

/**
 * Updates FlywheelState accumulator with OTC trade tax outcomes.
 */
export function applyTradeTax(
  state: FlywheelState,
  result: TradeTaxResult
): FlywheelState {
  return {
    ...state,
    totalStakingYield: state.totalStakingYield + result.vaultAmount,
    totalBurned: state.totalBurned + result.burnedAmount,
    totalTradesTaxed: state.totalTradesTaxed + 1,
  };
}

/**
 * Creates a valid GovernanceProposal descriptor with initialized tallies and active status.
 */
export function createGovernanceProposal(
  id: string,
  title: string,
  description: string,
  proposer: string,
  category: ProposalCategory = 'general',
  durationMs: number = 7 * 24 * 3600 * 1000,
  targetConfig?: Partial<FlywheelConfig>
): GovernanceProposal {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Proposal id must be a non-empty string');
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Proposal title must be a non-empty string');
  }
  if (!proposer || typeof proposer !== 'string' || proposer.trim().length === 0) {
    throw new Error('Proposal proposer must be a valid address string');
  }

  const now = Date.now();
  return {
    id: id.trim(),
    title: title.trim(),
    description: description ? description.trim() : '',
    proposer: proposer.trim(),
    category,
    forVotes: 0,
    againstVotes: 0,
    totalBurned: 0,
    startTime: now,
    endTime: now + durationMs,
    status: 'active',
    targetConfig,
  };
}

/**
 * Registers or updates a GovernanceProposal in FlywheelState.
 */
export function registerGovernanceProposal(
  state: FlywheelState,
  proposal: GovernanceProposal
): FlywheelState {
  return {
    ...state,
    proposals: {
      ...(state.proposals ?? {}),
      [proposal.id]: proposal,
    },
  };
}

/**
 * Computes deterministic governance vote fee, explicit dead burn address, and vote record.
 *
 * @param proposalId Unique identifier of the target proposal.
 * @param voterAddress Web3 address or simulation wallet casting the vote.
 * @param support True for affirmative (FOR), false for negative (AGAINST).
 * @param votingPower Magnitude of $wif tokens pledged for voting power.
 * @param burnRate Deflationary fee fraction burned on vote (default 0.02 for 2%).
 * @param burnAddress Target dead burn address (default 0x...dEaD).
 */
export function calculateGovernanceVote(
  proposalId: string,
  voterAddress: string,
  support: boolean,
  votingPower: number,
  burnRate: number = DEFAULT_FLYWHEEL_CONFIG.governanceBurnRate,
  burnAddress: string = DEFAULT_FLYWHEEL_CONFIG.burnAddress
): GovernanceVote {
  if (!proposalId || typeof proposalId !== 'string' || proposalId.trim().length === 0) {
    throw new Error('proposalId must be a valid non-empty string');
  }
  if (!voterAddress || typeof voterAddress !== 'string' || voterAddress.trim().length === 0) {
    throw new Error('voterAddress must be a valid address string');
  }
  if (votingPower <= 0 || !Number.isFinite(votingPower)) {
    throw new Error('votingPower must be a positive finite number');
  }
  if (burnRate < 0 || burnRate > 1 || !Number.isFinite(burnRate)) {
    throw new Error('burnRate must be a number between 0 and 1');
  }

  const burnAmount = burnRate > 0 ? Math.max(1, Math.ceil(votingPower * burnRate)) : 0;

  return {
    proposalId: proposalId.trim(),
    voterAddress: voterAddress.trim(),
    support: Boolean(support),
    votingPower,
    burnAmount,
    burnAddress,
    timestamp: Date.now(),
  };
}

/**
 * Casts a community governance vote, burning the vote fee to 0x...dEaD and updating FlywheelState.
 *
 * @param state Current flywheel accumulator state.
 * @param proposalId Proposal identifier being voted upon.
 * @param voterAddress Web3 account or simulated wallet address.
 * @param support True for YES or FOR, false for NO or AGAINST.
 * @param votingPower Amount of $wif voting power applied.
 * @param burnRate Optional fee burn rate override (default 0.02).
 * @returns Dual-compatible result implementing both GovernanceVoteResult and FlywheelState.
 */
export function castGovernanceVote(
  state: FlywheelState,
  proposalId: string,
  voterAddress: string,
  support: boolean,
  votingPower: number,
  burnRate: number = DEFAULT_FLYWHEEL_CONFIG.governanceBurnRate
): GovernanceVoteResult {
  const vote = calculateGovernanceVote(
    proposalId,
    voterAddress,
    support,
    votingPower,
    burnRate,
    DEFAULT_FLYWHEEL_CONFIG.burnAddress
  );

  const existingProposal: GovernanceProposal = state.proposals?.[proposalId] ?? {
    id: proposalId,
    title: `Proposal ${proposalId}`,
    description: 'Community Governance Proposal',
    proposer: voterAddress,
    category: 'general' as const,
    forVotes: 0,
    againstVotes: 0,
    totalBurned: 0,
    startTime: Date.now(),
    endTime: Date.now() + 7 * 24 * 3600 * 1000,
    status: 'active' as const,
  };

  const updatedProposal: GovernanceProposal = {
    ...existingProposal,
    forVotes: vote.support ? existingProposal.forVotes + vote.votingPower : existingProposal.forVotes,
    againstVotes: !vote.support ? existingProposal.againstVotes + vote.votingPower : existingProposal.againstVotes,
    totalBurned: existingProposal.totalBurned + vote.burnAmount,
  };

  const nextProposals: Record<string, GovernanceProposal> = {
    ...(state.proposals ?? {}),
    [proposalId]: updatedProposal,
  };

  const nextVotes: GovernanceVote[] = [...(state.votes ?? []), vote];

  const updatedState: FlywheelState = {
    ...state,
    totalBurned: state.totalBurned + vote.burnAmount,
    totalGovernanceBurned: (state.totalGovernanceBurned ?? 0) + vote.burnAmount,
    totalGovernanceVotes: (state.totalGovernanceVotes ?? 0) + 1,
    proposals: nextProposals,
    votes: nextVotes,
  };

  return {
    ...updatedState,
    state: updatedState,
    vote,
    proposal: updatedProposal,
    burnAddress: vote.burnAddress,
    burnedAmount: vote.burnAmount,
  };
}

/**
 * Resolves a governance proposal based on current tallies and quorum parameters.
 */
export function resolveGovernanceProposal(
  proposal: GovernanceProposal,
  quorum: number = 100
): ProposalStatus {
  const totalVotes = proposal.forVotes + proposal.againstVotes;
  if (totalVotes < quorum) {
    return 'rejected';
  }
  if (proposal.forVotes > proposal.againstVotes) {
    return 'passed';
  }
  return 'rejected';
}
