/**
 * src/ui/phase-fx.ts
 *
 * Pure helpers that turn game-state transitions into board animation data:
 * draft claim flights, harvest cluster glows and yield badges, and the
 * epoch-summary continue label. Kept DOM-free so they are unit-testable.
 */

import { findAllPlayerClusters } from '../engine/board-layout';
import type { GameState } from '../engine/types';
import { calculateStakingBoost } from '../tokenomics/flywheel';
import { PLAYER_COLORS, type ClaimFlash, type HarvestGlow } from './board';

/** Label of the epoch summary's continue button: the last epoch leads into the final settlement. */
export function epochContinueLabel(year: number, finalYear = 6): string {
  return year >= finalYear ? 'View Final Settlement' : `Continue to Epoch ${year + 1}`;
}

/**
 * Claim animations for every parcel that changed hands during the draft
 * (the human's picks and the bots'), staggered so the tokens fly in one by one.
 */
export function buildClaimFlashes(
  ownersBefore: readonly (number | null)[],
  state: Readonly<GameState>,
  start: number,
  stagger = 90
): ClaimFlash[] {
  const claimed = state.lots
    .filter((l) => l.owner !== null && ownersBefore[l.id] !== l.owner)
    .sort((a, b) => (a.owner as number) - (b.owner as number) || a.id - b.id);
  return claimed.map((lot, i) => ({
    lotId: lot.id,
    ownerId: lot.owner as number,
    color: PLAYER_COLORS[lot.owner as number] ?? '#FFFFFF',
    start: start + i * stagger,
  }));
}

/** Harvest glows and yield badges for every player's scoring clusters. */
export function buildHarvestEffects(
  state: Readonly<GameState>,
  isStaked: boolean,
  start: number,
  stagger = 140
): { glows: HarvestGlow[]; floaters: { lotId: number; text: string; start: number; color: string }[] } {
  const glows: HarvestGlow[] = [];
  const floaters: { lotId: number; text: string; start: number; color: string }[] = [];
  let i = 0;
  for (const player of state.players) {
    const color = PLAYER_COLORS[player.id] ?? '#FFFFFF';
    for (const cluster of findAllPlayerClusters(state.lots, player.id)) {
      if (cluster.annualIncome <= 0) continue;
      const at = start + i * stagger;
      i++;
      glows.push({ lots: [...cluster.lots], color, complete: cluster.isComplete, start: at });
      const boost = isStaked && player.id === 0;
      const paid = boost ? calculateStakingBoost(cluster.annualIncome, true) : cluster.annualIncome;
      const suffix = boost && paid !== cluster.annualIncome ? ` (${cluster.annualIncome} x1.20)` : '';
      floaters.push({ lotId: cluster.lots[0], text: `+${paid} $wif${suffix}`, start: at, color });
    }
  }
  return { glows, floaters };
}
