/**
 * src/tokenomics/types.ts
 *
 * Core tokenomics type definitions for robin-town.
 * Defines configuration, result structures, lifecycle states, and governance
 * contracts for the $wif token economic flywheel on Robinhood Chain.
 */

export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export interface FlywheelConfig {
  buyInAmount: number;
  burnRate: number;
  vaultRate: number;
  purseRate: number;
  podiumShares: number[];
  pointToWifRate: number;
  swapBurnTax: number;
  tradeMicroTax: number;
  stakingMultiplier: number;
  burnAddress: string;
  governanceBurnRate: number;
}

export interface PodiumPayout {
  rank: number;
  playerId: number;
  payout: number;
  percentage: number;
}

export interface MatchPoolResult {
  totalPool: number;
  burnedAmount: number;
  vaultAmount: number;
  purseAmount: number;
  burnAddress: string;
  payouts: Record<number, number>;
  podium: PodiumPayout[];
}

export interface PointSwapResult {
  points: number;
  grossWif: number;
  burnedWif: number;
  netWif: number;
  burnAddress: string;
}

export interface TradeTaxResult {
  grossCash: number;
  taxAmount: number;
  netCash: number;
  vaultAmount: number;
  burnedAmount: number;
}

export type ProposalCategory = 'tax' | 'rules' | 'rewards' | 'district' | 'treasury' | 'general';
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed';

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: ProposalCategory;
  forVotes: number;
  againstVotes: number;
  totalBurned: number;
  startTime: number;
  endTime: number;
  status: ProposalStatus;
  targetConfig?: Partial<FlywheelConfig>;
}

export interface GovernanceVote {
  proposalId: string;
  voterAddress: string;
  support: boolean;
  votingPower: number; // in $wif
  burnAmount: number; // burned on vote
  burnAddress: string;
  timestamp: number;
}

export interface GovernanceVoteResult extends FlywheelState {
  state: FlywheelState;
  vote: GovernanceVote;
  proposal: GovernanceProposal;
  burnAddress: string;
  burnedAmount: number;
}

export interface FlywheelState {
  totalBurned: number;
  totalStakingYield: number;
  totalPrizesDisbursed: number;
  totalMatches: number;
  totalSwaps: number;
  totalTradesTaxed: number;
  totalGovernanceVotes: number;
  totalGovernanceBurned: number;
  proposals: Record<string, GovernanceProposal>;
  votes: GovernanceVote[];
}
