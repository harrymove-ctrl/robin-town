/**
 * src/ui/phase-fx.ts
 *
 * Pure helpers that turn game-state transitions into board animation data:
 * draft claim flights, harvest cluster glows and yield badges, and the
 * epoch-summary continue label. Kept DOM-free so they are unit-testable.
 */

import { findAllPlayerClusters } from '../engine/board-layout';
import { SHOPS } from '../engine/engine';
import type { GameState, OfferSide, TradeOffer } from '../engine/types';
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

function describeSide(side: OfferSide): string {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(`<strong>${side.cash} $wif</strong>`);
  (side.tiles as number[]).forEach((n, s) => {
    if (typeof n === 'number' && n > 0) parts.push(`<strong>${n}x ${SHOPS[s]?.name ?? 'tile'}</strong> tile${n > 1 ? 's' : ''}`);
  });
  for (const id of side.lots) parts.push(`<strong>Parcel ${id + 1}</strong>`);
  return parts.join(' + ') || 'nothing';
}

/**
 * One-line summary of an incoming bot proposal, written from the human's side
 * (`offer.give` = what the human hands over, `offer.take` = what the bot pays).
 */
export function describeProposal(botName: string, offer: TradeOffer): string {
  const swap = offer.give.cash === 0 && offer.take.cash === 0;
  const verb = swap ? 'proposes a cluster swap' : 'offers';
  const why = swap ? ' Both of you grow a cluster.' : '';
  return `<strong>${botName}</strong> ${verb}: ${describeSide(offer.take)} for your ${describeSide(offer.give)}.${why}`;
}
