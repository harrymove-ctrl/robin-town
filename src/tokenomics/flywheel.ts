/**
 * src/tokenomics/flywheel.ts
 *
 * $wif Tokenomics Flywheel and Economic Engine for robin-town.
 * Implements pure deterministic math for competitive match buy-in pools,
 * deflationary burn sinks, community staking vault allocations, podium prize
 * distributions, casual point-to-$wif redemptions, OTC trade micro-taxes,
 * and staking yield multipliers.
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
}

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
});

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

export interface FlywheelState {
  totalBurned: number;
  totalStakingYield: number;
  totalPrizesDisbursed: number;
  totalMatches: number;
  totalSwaps: number;
  totalTradesTaxed: number;
}

export function createInitialFlywheelState(): FlywheelState {
  return {
    totalBurned: 0,
    totalStakingYield: 0,
    totalPrizesDisbursed: 0,
    totalMatches: 0,
    totalSwaps: 0,
    totalTradesTaxed: 0,
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
