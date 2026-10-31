/**
 * src/engine/bot.ts
 *
 * Deterministic AI Bot Heuristics and Trade Negotiation Engine for robin-town.
 * Implements drafting heuristics, building heuristics, and trade evaluation
 * for Sherwood, Apex, and Luna personas.
 */

import {
  ADJACENCY_GRAPH,
  canBuildShop,
  getNeighbors,
  LOT_DEFINITIONS,
  plotNeighbors,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
} from './board-layout';
import type {
  GameState,
  Lot,
  OfferSide,
  RandomSource,
  TradeEvaluation,
  TradeOffer,
} from './types';

export interface BotPersonality {
  id: number;
  name: string;
  title: string;
  avatar: string;
  /** Acceptance threshold: the bot wants `profitMargin` x the value it gives up. */
  profitMargin: number;
  riskTolerance: number;
  /**
   * Appetite for swapping loose (unclustered) shop tiles. 1 = neutral. Above 1 the
   * bot values tiles it receives higher and loose tiles it gives up lower.
   */
  looseTileBias?: number;
  preferredShops: number[];
  preferredDistricts: number[];
  dialogue: {
    greeting: string;
    thinking: string;
    accepted: string;
    counteroffer: string;
    rejected: string;
  };
}

export type BotProfile = BotPersonality;

export interface TileContext {
  ownedMatchingTiles: number;
  canCompleteThisTurn: boolean;
}

export interface LotContext {
  adjacentFriendlyPlots: number;
  hasMatchingShopAdjacent: boolean;
  isOccupied: boolean;
}

export interface BotState {
  tiles: Record<number, TileContext>;
  lots: Record<number, LotContext>;
}

export const BOT_PERSONALITIES: Record<number, BotPersonality> = {
  1: {
    id: 1,
    name: 'Sherwood',
    title: 'The Conservative Yield Seeker',
    avatar: 'avatar_1.png',
    // Retail / balanced: fair value, likes the Size 3 and Size 4 shops.
    profitMargin: 1.0,
    riskTolerance: 0.5,
    preferredShops: [0, 1, 2],
    preferredDistricts: [0, 2],
    dialogue: {
      greeting: 'Welcome to Sherwood. Let us construct sustainable liquidity together.',
      thinking: 'Evaluating yield projections on this swap...',
      accepted: 'Transaction confirmed! A fair deal for both our portfolios.',
      counteroffer: 'Almost balanced, anon. Add a few more $wif to bridge the valuation spread.',
      rejected: 'The yield metrics do not align. Let us revisit when the market shifts.',
    },
  },
  2: {
    id: 2,
    name: 'Apex',
    title: 'The High-Frequency Arbitrage Shark',
    avatar: 'avatar_3.png',
    // Wall Street monopoly hunter: aggressive valuation, hoards Size 5 / Size 6 keystones.
    profitMargin: 1.15,
    riskTolerance: 0.2,
    preferredShops: [4, 5],
    preferredDistricts: [1, 5],
    dialogue: {
      greeting: 'Time is gas. Bring me genuine alpha or do not trade.',
      thinking: 'Calculating risk-adjusted return and order book depth...',
      accepted: 'Arbitrage confirmed. Transaction executed at maximum efficiency.',
      counteroffer: 'Negative expected value on my end. Cover my shortfall or stay sidelined.',
      rejected: 'Unacceptable spread. I do not subsidize retail mistakes.',
    },
  },
  3: {
    id: 3,
    name: 'Luna',
    title: 'The Liquid Market Maker',
    avatar: 'avatar_2.png',
    // DeFi high-tempo speculator: discounts to keep capital moving, eager to swap loose tiles.
    profitMargin: 0.95,
    riskTolerance: 0.85,
    looseTileBias: 1.25,
    preferredShops: [1, 0, 3],
    preferredDistricts: [4, 3],
    dialogue: {
      greeting: 'Pull up a terminal! Deep liquidity makes everyone wealthy.',
      thinking: 'Balancing liquidity pools and inventory turnover...',
      accepted: 'Order filled! Capital velocity is all that matters.',
      counteroffer: 'Just a tiny sliver short on valuation. Match the baseline and it is yours.',
      rejected: 'Too illiquid for my books right now. Give me something that flows.',
    },
  },
};

export const BOT_PROFILES = BOT_PERSONALITIES;

export function getBotPersonality(botId: number): BotPersonality {
  return (
    BOT_PERSONALITIES[botId] ?? {
      id: botId,
      name: `Bot ${botId}`,
      title: 'Automated Market Participant',
      avatar: 'avatar_1.png',
      profitMargin: 1.04,
      riskTolerance: 0.5,
      preferredShops: [0, 1],
      preferredDistricts: [0, 1],
      dialogue: {
        greeting: 'Ready to trade.',
        thinking: 'Evaluating offer...',
        accepted: 'Deal accepted.',
        counteroffer: 'Counteroffer proposed.',
        rejected: 'Deal rejected.',
      },
    }
  );
}

/**
 * Heuristic score for drafting parcel deeds.
 */
export function plotScore(
  arg1: number | GameState,
  arg2: number,
  arg3?: number | GameState
): number {
  let lotId: number;
  let botId: number;
  let state: GameState;

  if (typeof arg1 === 'number') {
    lotId = arg1;
    botId = arg2;
    state = arg3 as GameState;
  } else {
    state = arg1;
    lotId = arg2;
    botId = arg3 as number;
  }

  const neighbors = getNeighbors(lotId);
  const personality = getBotPersonality(botId);
  const districtId = LOT_DEFINITIONS[lotId].block;

  // Grid degree bonus
  let score = neighbors.length * 2;

  let lotsOwnedInSameDistrict = 0;
  for (const lot of state.lots) {
    if (lot.owner === botId && lot.block === districtId) {
      lotsOwnedInSameDistrict++;
    }
  }
  score += lotsOwnedInSameDistrict * 3;

  for (const neighborId of neighbors) {
    const neighborLot = state.lots[neighborId];
    if (neighborLot.owner === botId) {
      // Friendly adjacency bonus
      score += 14;
      if (neighborLot.shop !== null) {
        const targetSize = SHOP_TARGET_SIZES[neighborLot.shop];
        const matchingCluster = state.lots.filter(
          (l) => l.owner === botId && l.shop === neighborLot.shop
        );
        if (matchingCluster.length < targetSize) {
          score += 16;
          if (state.players[botId]?.tiles[neighborLot.shop] > 0) {
            score += 8;
          }
        }
      }
    } else if (neighborLot.owner !== null) {
      // Opponent adjacent
      if (neighborLot.shop !== null) {
        const opponentId = neighborLot.owner;
        const targetSize = SHOP_TARGET_SIZES[neighborLot.shop];
        const oppCluster = state.lots.filter(
          (l) => l.owner === opponentId && l.shop === neighborLot.shop
        );
        if (oppCluster.length < targetSize) {
          // Defensive blocking bonus
          score += botId === 2 ? 12 : 6;
        }
      }
    }
  }

  // Persona district affinity
  if (personality.preferredDistricts.includes(districtId)) {
    score += botId === 2 ? 8 : 5;
  }

  // Erratic variance for Luna
  if (botId === 3) {
    score += ((lotId * 7 + (state.year || 1) * 13) % 7) - 3;
  }

  return score;
}

/**
 * Automated parcel drafting for bot.
 * Supports both signatures:
 * botDraft(botId, candidateLotIds, countToKeep, state) -> number[]
 * botDraft(state, botId, count, rng) -> void
 */
export function botDraft(
  arg1: number | GameState,
  arg2: number[] | number,
  arg3: number,
  arg4?: GameState | RandomSource
): number[] | void {
  if (typeof arg1 === 'number') {
    const botId = arg1;
    const candidateLotIds = arg2 as number[];
    const countToKeep = arg3;
    const state = arg4 as GameState;

    const scored = candidateLotIds.map((id) => ({
      id,
      score: plotScore(id, botId, state),
    }));

    scored.sort((a, b) => b.score - a.score || a.id - b.id);
    return scored.slice(0, countToKeep).map((entry) => entry.id);
  }

  const state = arg1;
  const botId = arg2 as number;
  const count = arg3;
  const rng = (arg4 as RandomSource) || Math.random;

  const unowned = state.lots
    .filter((lot) => lot.owner === null && !state.pending.includes(lot.id))
    .map((lot) => lot.id);

  const candidates = unowned
    .map((val) => ({ key: rng(), val }))
    .sort((a, b) => a.key - b.key)
    .map((e) => e.val)
    .slice(0, count + 2);

  for (let i = 0; i < count && candidates.length > 0; i++) {
    candidates.sort((a, b) => plotScore(state, b, botId) - plotScore(state, a, botId));
    const chosen = candidates.shift();
    if (chosen === undefined) break;
    state.lots[chosen].owner = botId;
  }
}

/**
 * Automated shop placement for bot.
 * Supports both signatures:
 * botBuild(botId, state) -> { lotId, shopType }[]
 * botBuild(state, botId) -> void
 */
export function botBuild(
  arg1: number | GameState,
  arg2: GameState | number
): { lotId: number; shopType: number }[] | void {
  const isQueryStyle = typeof arg1 === 'number';
  const botId = isQueryStyle ? (arg1 as number) : (arg2 as number);
  const state = isQueryStyle ? (arg2 as GameState) : (arg1 as GameState);

  const placements: { lotId: number; shopType: number }[] = [];
  const personality = getBotPersonality(botId);

  let safetyLoop = 0;
  while (safetyLoop++ < 30) {
    let bestMove: { lotId: number; shopType: number; score: number } | null = null;
    const vacantLots = state.lots.filter(
      (lot) => lot.owner === botId && lot.shop === null
    );

    for (const lot of vacantLots) {
      for (let s = 0; s < SHOP_CATEGORIES.length; s++) {
        const tilesHeld = state.players[botId]?.tiles[s] ?? 0;
        if (tilesHeld <= 0) continue;

        // Verify placement validity with strict capacity check
        const validation = canBuildShop(state.lots, lot.id, botId, s, tilesHeld);
        if (!validation.valid) continue;

        const targetSize = SHOP_TARGET_SIZES[s];
        const neighbors = plotNeighbors(lot.id);
        const adjacentMatching = neighbors.filter(
          (nid) => state.lots[nid].owner === botId && state.lots[nid].shop === s
        ).length;
        const adjacentVacant = neighbors.filter(
          (nid) => state.lots[nid].owner === botId && state.lots[nid].shop === null
        ).length;

        const resultingSize = validation.resultingClusterSize ?? 1;
        const completesShop = resultingSize === targetSize;

        let score = 0;
        if (completesShop) {
          score += 50;
        } else if (resultingSize > 1) {
          score += 20 + adjacentMatching * 8;
        }

        score += adjacentVacant * 2;
        score += Math.min(tilesHeld, targetSize) * 4;

        if (personality.preferredShops.includes(s)) {
          score += 15;
        }

        if (state.year >= 5 && resultingSize === 1 && targetSize >= 5) {
          score -= 25;
        }

        if (!bestMove || score > bestMove.score) {
          bestMove = { lotId: lot.id, shopType: s, score };
        }
      }
    }

    if (!bestMove || bestMove.score <= 0) break;

    // Apply deployment
    state.lots[bestMove.lotId].shop = bestMove.shopType;
    state.lots[bestMove.lotId].shopSize = SHOP_TARGET_SIZES[bestMove.shopType];
    state.players[botId].tiles[bestMove.shopType]--;
    placements.push({ lotId: bestMove.lotId, shopType: bestMove.shopType });
  }

  if (isQueryStyle) {
    return placements;
  }
}

/**
 * Value of an unplaced shop tile.
 * Supports both:
 * calculateTileValue(tileCtx, epoch)
 * calculateTileValue(shopType, botId, state)
 */
export function calculateTileValue(
  arg1: TileContext | number,
  arg2: number,
  arg3?: GameState
): number {
  if (typeof arg1 === 'object') {
    const tileCtx = arg1;
    const epoch = arg2;
    return (
      10 +
      tileCtx.ownedMatchingTiles * 8 +
      (tileCtx.canCompleteThisTurn ? 25 : 0) +
      (7 - epoch) * 3
    );
  }

  const shopType = arg1;
  const botId = arg2;
  const state = arg3 as GameState;
  const epoch = state?.year ?? 1;

  const ownedMatching = state?.players[botId]?.tiles[shopType] ?? 0;
  const targetSize = SHOP_TARGET_SIZES[shopType];
  const matchingPlots = state.lots.filter(
    (l) => l.owner === botId && l.shop === shopType
  );
  const canCompleteThisTurn =
    matchingPlots.length === targetSize - 1 &&
    matchingPlots.some((plot) =>
      plotNeighbors(plot.id).some(
        (nid) => state.lots[nid].owner === botId && state.lots[nid].shop === null
      )
    );

  const persona = getBotPersonality(botId);
  const personaBonus = persona.preferredShops.includes(shopType) ? (botId === 2 ? 5 : 3) : 0;

  return (
    10 +
    ownedMatching * 8 +
    (canCompleteThisTurn ? 25 : 0) +
    (7 - epoch) * 3 +
    personaBonus
  );
}

/**
 * Value of a parcel deed.
 * Supports both:
 * calculateLotValue(lotCtx)
 * calculateLotValue(lotId, botId, state)
 */
export function calculateLotValue(
  arg1: LotContext | number,
  arg2?: number,
  arg3?: GameState
): number {
  if (typeof arg1 === 'object') {
    const lotCtx = arg1;
    return (
      18 +
      lotCtx.adjacentFriendlyPlots * 14 +
      (lotCtx.hasMatchingShopAdjacent ? 20 : 0) +
      (lotCtx.isOccupied ? 15 : 0)
    );
  }

  const lotId = arg1;
  const botId = arg2 as number;
  const state = arg3 as GameState;
  const lot = state?.lots[lotId];
  if (!lot) return 18;

  const neighbors = plotNeighbors(lotId);
  const adjacentFriendlyPlots = neighbors.filter(
    (nid) => state.lots[nid].owner === botId
  ).length;

  const hasMatchingShopAdjacent = neighbors.some((nid) => {
    const neighbor = state.lots[nid];
    return (
      neighbor.owner === botId &&
      neighbor.shop !== null &&
      !neighbor.isComplete
    );
  });

  const isOccupied = lot.shop !== null;
  const epoch = state?.year ?? 1;
  const persona = getBotPersonality(botId);
  const districtAffinity = persona.preferredDistricts.includes(lot.block)
    ? botId === 2
      ? 6
      : 3
    : 0;

  return (
    18 +
    adjacentFriendlyPlots * 14 +
    (hasMatchingShopAdjacent ? 20 : 0) +
    (isOccupied ? 15 + (7 - epoch) * 5 : 0) +
    districtAffinity
  );
}

/**
 * Evaluates an escrow OfferSide.
 * Supports both:
 * evaluateOfferSide(side, botState, epoch)
 * evaluateSideValue(side, botId, state)
 */
export function evaluateOfferSide(
  side: OfferSide,
  stateOrBotState: BotState | GameState,
  epochOrBotId?: number
): number {
  let value = side.cash;

  // Check if stateOrBotState is a BotState with contextual records
  if (
    typeof stateOrBotState === 'object' &&
    'tiles' in stateOrBotState &&
    !Array.isArray(stateOrBotState.tiles) &&
    'lots' in stateOrBotState &&
    !Array.isArray(stateOrBotState.lots)
  ) {
    const botState = stateOrBotState as BotState;
    const epoch = (epochOrBotId as number) || 1;

    // Evaluate tiles
    if (Array.isArray(side.tiles)) {
      if (
        side.tiles.length > 0 &&
        typeof side.tiles[0] === 'object' &&
        side.tiles[0] !== null &&
        'type' in side.tiles[0]
      ) {
        for (const t of side.tiles as { type: number; id?: number }[]) {
          const ctx = botState.tiles[t.type] || {
            ownedMatchingTiles: 0,
            canCompleteThisTurn: false,
          };
          value += calculateTileValue(ctx, epoch);
        }
      } else {
        for (let s = 0; s < side.tiles.length; s++) {
          const count = side.tiles[s] as number;
          if (count > 0) {
            const ctx = botState.tiles[s] || {
              ownedMatchingTiles: 0,
              canCompleteThisTurn: false,
            };
            value += count * calculateTileValue(ctx, epoch);
          }
        }
      }
    }

    // Evaluate lots
    for (const lotId of side.lots) {
      const ctx = botState.lots[lotId] || {
        adjacentFriendlyPlots: 0,
        hasMatchingShopAdjacent: false,
        isOccupied: false,
      };
      value += calculateLotValue(ctx);
    }

    return value;
  }

  // Otherwise state is a GameState
  const state = stateOrBotState as GameState;
  const botId = (epochOrBotId as number) || 1;

  if (Array.isArray(side.tiles)) {
    if (
      side.tiles.length > 0 &&
      typeof side.tiles[0] === 'object' &&
      side.tiles[0] !== null &&
      'type' in side.tiles[0]
    ) {
      for (const t of side.tiles as { type: number; id?: number }[]) {
        value += calculateTileValue(t.type, botId, state);
      }
    } else {
      for (let s = 0; s < side.tiles.length; s++) {
        const count = side.tiles[s] as number;
        if (count > 0) {
          value += count * calculateTileValue(s, botId, state);
        }
      }
    }
  }

  for (const lotId of side.lots) {
    value += calculateLotValue(lotId, botId, state);
  }

  return value;
}

/** Normalises an OfferSide's tiles (count array or `{ type }` list) to six counts. */
export function tileCounts(side: OfferSide): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  if (!Array.isArray(side.tiles)) return counts;
  for (let i = 0; i < side.tiles.length; i++) {
    const t = side.tiles[i] as unknown;
    if (typeof t === 'number') {
      if (i < 6) counts[i] += t;
    } else if (t && typeof t === 'object' && 'type' in t) {
      const type = (t as { type: number }).type;
      if (type >= 0 && type < 6) counts[type]++;
    }
  }
  return counts;
}

/**
 * A tile is "loose" for a bot when it has no open (incomplete) cluster of
 * that shop on the board to grow, so the tile is just sitting in hand.
 */
export function isLooseTileFor(shop: number, botId: number, state: GameState | BotState): boolean {
  if (Array.isArray((state as GameState).lots)) {
    const game = state as GameState;
    return !game.lots.some((l) => l.owner === botId && l.shop === shop && !l.isComplete);
  }
  const ctx = (state as BotState).tiles?.[shop];
  return !ctx || !ctx.canCompleteThisTurn;
}

export const evaluateSideValue = evaluateOfferSide;
export const evaluateSide = evaluateOfferSide;

/**
 * Evaluates trade offer from the bot perspective.
 *
 * In TradeOffer:
 * offer.give: assets proposer offers to the bot (bot receives)
 * offer.take: assets proposer asks from the bot (bot surrenders)
 *
 * valueReceived = evaluateSide(offer.give, bot)
 * valueSurrendered = evaluateSide(offer.take, bot)
 * requiredValue = valueSurrendered * botMargin
 * accepted = valueReceived >= requiredValue
 * shortfall = accepted ? 0 : Math.max(0, Math.ceil(requiredValue-valueReceived))
 * counterOffer tops up give.cash by shortfall (up to human cash limit), and NEVER adds bot cash to take.cash.
 */
export function evaluateTradeOffer(
  offer: TradeOffer,
  botIdOrPersona: number | { name: string; margin: number },
  stateOrBotState: GameState | BotState,
  proposerCashArg?: number,
  epochArg?: number
): TradeEvaluation {
  const isPersonaObject =
    typeof botIdOrPersona === 'object' && botIdOrPersona !== null;
  const botId = isPersonaObject
    ? offer.toPlayer ?? offer.partner ?? 1
    : (botIdOrPersona as number);

  const personality = isPersonaObject
    ? (botIdOrPersona as { name: string; margin: number })
    : getBotPersonality(botId);
  const botMargin =
    'profitMargin' in personality
      ? (personality as BotPersonality).profitMargin
      : personality.margin;
  const botName = personality.name;

  let proposerCash = proposerCashArg;
  let epoch = epochArg;

  if (proposerCash === undefined && 'players' in stateOrBotState) {
    const proposerId = offer.fromPlayer ?? 0;
    proposerCash = stateOrBotState.players[proposerId]?.cash ?? 0;
  }
  if (epoch === undefined && 'year' in stateOrBotState) {
    epoch = stateOrBotState.year;
  }
  if (proposerCash === undefined) proposerCash = 1000;
  if (epoch === undefined) epoch = 1;

  const sideArg = typeof botIdOrPersona === 'number' ? botId : epoch;
  let valueReceived = evaluateOfferSide(offer.give, stateOrBotState, sideArg);
  let valueSurrendered = evaluateOfferSide(offer.take, stateOrBotState, sideArg);

  // Loose-tile appetite (Luna): tiles coming in are worth more, loose tiles going out less.
  const tileBias = 'looseTileBias' in personality ? (personality as BotPersonality).looseTileBias ?? 1 : 1;
  if (tileBias !== 1) {
    const tilesOnly = (side: OfferSide, filter?: (shop: number) => boolean): OfferSide => ({
      cash: 0,
      lots: [],
      tiles: tileCounts(side).map((n, s) => (!filter || filter(s) ? n : 0)) as OfferSide['tiles'],
    });
    const isLoose = (shop: number) => isLooseTileFor(shop, botId, stateOrBotState);
    const tilesIn = evaluateOfferSide(tilesOnly(offer.give), stateOrBotState, sideArg);
    const looseOut = evaluateOfferSide(tilesOnly(offer.take, isLoose), stateOrBotState, sideArg);
    valueReceived += tilesIn * (tileBias - 1);
    valueSurrendered -= looseOut * (1 - 1 / tileBias);
  }

  const requiredValue = valueSurrendered * botMargin;
  const accepted = valueReceived >= requiredValue;
  const shortfall = accepted
    ? 0
    : Math.max(0, Math.ceil(requiredValue - valueReceived));

  let counterOffer: OfferSide | undefined = undefined;
  if (!accepted && shortfall > 0) {
    const proposedGiveCash = offer.give.cash;
    if (proposedGiveCash + shortfall <= proposerCash) {
      counterOffer = {
        cash: proposedGiveCash + shortfall,
        tiles: Array.isArray(offer.give.tiles)
          ? (offer.give.tiles.slice() as OfferSide['tiles'])
          : [],
        lots: [...offer.give.lots],
      };
    }
  }

  let quoteMessage = '';
  if (accepted) {
    quoteMessage = `${botName} accepts the deal.`;
  } else if (counterOffer) {
    quoteMessage = `${botName} counters: Top up ${shortfall} $wif cash to fill this deal.`;
  } else {
    quoteMessage = `${botName} rejects: Valuation gap is ${shortfall} $wif, exceeding available reserves.`;
  }

  return {
    accepted,
    shortfall,
    counterOffer,
    quoteMessage,
    valueReceived,
    valueSurrendered,
    requiredValue,
  };
}

export const remediatedEvaluation = evaluateTradeOffer;

/**
 * Generate bot-initiated trade offer when bot detects a high synergy asset.
 */
export function generateBotTradeOffer(
  botId: number,
  targetPlayerId: number,
  state: GameState
): TradeOffer | null {
  const botLots = state.lots.filter((l) => l.owner === botId);
  const targetLots = state.lots.filter((l) => l.owner === targetPlayerId);

  // Search for an opponent parcel adjacent to an incomplete bot shop
  for (const botLot of botLots) {
    if (botLot.shop === null || botLot.isComplete) continue;
    const targetNeighbors = plotNeighbors(botLot.id).filter(
      (nid) => state.lots[nid].owner === targetPlayerId && state.lots[nid].shop === null
    );

    if (targetNeighbors.length > 0) {
      const wantedLotId = targetNeighbors[0];
      const wantedLotValue = calculateLotValue(wantedLotId, botId, state);
      const cashOffer = Math.min(state.players[botId].cash, wantedLotValue + 5);

      if (cashOffer > 0) {
        return {
          fromPlayer: botId,
          toPlayer: targetPlayerId,
          partner: targetPlayerId,
          give: { cash: cashOffer, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [wantedLotId] },
        };
      }
    }
  }

  return null;
}
