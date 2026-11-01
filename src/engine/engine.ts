/**
 * src/engine/engine.ts
 *
 * Pure deterministic state machine and rules engine for robin-town.
 * Executes parcel drafting, tile distribution, shop deployment, non-linear
 * overflow yield calculations, and atomic OTC asset swaps with zero DOM dependencies.
 */

import {
  BOARD_REVISION,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL_PITCH,
  CELL_SIZE,
  COMPLETE_PAYOUTS,
  INCOMPLETE_PAYOUTS,
  PLOT_LAYOUT,
  plotNeighbors,
  TOTAL_LOTS,
  canBuildShop,
} from './board-layout';
import {
  botBuild,
  botDraft,
  evaluateTradeOffer,
  generateBotTradeOffer,
} from './bot';
import type {
  GameAction,
  GameConfig,
  GamePhase,
  GameState,
  Lot,
  OfferSide,
  Player,
  RandomSource,
  Shop,
  ShopGroup,
  TradeEvaluation,
  TradeOffer,
} from './types';

export const SHOPS: Shop[] = [
  { id: 'dex', name: 'DEX Swap', code: 'DX', size: 3, color: '#39A883', quota: 20 },
  { id: 'memecoin', name: 'Memecoin Lounge', code: 'ML', size: 3, color: '#EEC353', quota: 20 },
  { id: 'vault', name: 'Staking Vault', code: 'SV', size: 4, color: '#B85539', quota: 20 },
  { id: 'lending', name: 'Lending Protocol', code: 'LP', size: 4, color: '#A16586', quota: 20 },
  { id: 'derivatives', name: 'Derivatives Exchange', code: 'DE', size: 5, color: '#587C9A', quota: 20 },
  { id: 'citadel', name: 'Validator Citadel', code: 'VC', size: 6, color: '#648454', quota: 20 },
];

export const DISTRICT_NAMES = [
  'Robinhood District',
  'Wall Street Quarter',
  'Crypto Wharf',
  'Silicon Strip',
  'Memecoin Boulevard',
  'DeFi Citadel',
];

export const COMPLETE = COMPLETE_PAYOUTS;
export const INCOMPLETE = INCOMPLETE_PAYOUTS;

export const PLOT_KEEP_SCHEDULES: Record<number, number[]> = {
  3: [6, 5, 4, 3, 3, 3],
  4: [5, 4, 3, 2, 2, 2],
  5: [4, 3, 2, 2, 2, 1],
  6: [3, 3, 2, 2, 1, 1],
};

export const TILE_DRAW_SCHEDULES: Record<number, number[]> = {
  3: [6, 5, 5, 5, 5, 5],
  4: [5, 4, 4, 4, 4, 4],
  5: [4, 3, 3, 3, 3, 3],
  6: [4, 3, 3, 2, 2, 2],
};

export function getPlotKeepSchedule(playerCount: number): number[] {
  return PLOT_KEEP_SCHEDULES[playerCount] ?? PLOT_KEEP_SCHEDULES[4];
}

export function getTileDrawSchedule(playerCount: number): number[] {
  return TILE_DRAW_SCHEDULES[playerCount] ?? TILE_DRAW_SCHEDULES[4];
}

export const PLOT_KEEP_SCHEDULE = PLOT_KEEP_SCHEDULES[4];
export const TILE_DEAL_SCHEDULE = [6, 5, 5, 5, 5, 5];
export const TILE_KEEP_SCHEDULE = [5, 4, 3, 2, 2, 2];
export const KEEP = PLOT_KEEP_SCHEDULE;

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  return items
    .map((value) => ({ key: rng(), value }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}

export const neighbors = plotNeighbors;

/**
 * BFS connected component discovery for player's shops.
 */
export function groups(state: GameState, player: number): ShopGroup[] {
  const seen = new Set<number>();
  const result: ShopGroup[] = [];

  for (const lot of state.lots) {
    if (lot.owner !== player || lot.shop === null || seen.has(lot.id)) continue;

    const stack = [lot.id];
    const ids: number[] = [];
    seen.add(lot.id);

    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) break;
      ids.push(id);

      for (const neighbor of neighbors(id)) {
        const next = state.lots[neighbor];
        if (next.owner === player && next.shop === lot.shop && !seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    const target = SHOPS[lot.shop].size;
    result.push({
      shop: lot.shop,
      lots: ids.sort((a, b) => a - b),
      size: ids.length,
      isComplete: ids.length >= target,
      payout: groupIncome(lot.shop, ids.length),
    });
  }

  return result;
}

/**
 * Canonical Chinatown non-linear overflow payout formula.
 */
export function groupIncome(shop: number, count: number): number {
  if (count <= 0) return 0;
  if (shop < 0 || shop >= SHOPS.length) return 0;
  const target = SHOPS[shop].size;
  const fullSets = Math.floor(count / target);
  const remainder = count % target;
  return fullSets * COMPLETE[target] + INCOMPLETE[remainder];
}

/**
 * Total annual yield for a player across all connected shop groups.
 */
export function income(state: GameState, player: number): number {
  return groups(state, player).reduce((total, group) => total + (group.payout || 0), 0);
}

/**
 * Holdings lookup for player.
 */
export function holdings(state: GameState, player: number): Lot[] {
  return state.lots.filter((lot) => lot.owner === player);
}

/**
 * Placement validation.
 */
export function canPlace(state: GameState, player: number, id: number, shop: number): boolean {
  if (!Number.isInteger(id) || !state.lots[id] || !Number.isInteger(shop) || !SHOPS[shop]) {
    return false;
  }
  const tileCount = state.players[player]?.tiles[shop] ?? 0;
  return canBuildShop(state.lots, id, player, shop, tileCount).valid;
}

/**
 * Factory for creating a brand new game state.
 */
export function createGame(config?: GameConfig, rng: RandomSource = Math.random): GameState {
  const startingCash = config?.startingCash ?? 50;
  const defaultBots = [
    { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001', avatar: 'avatar_1.png' },
    { name: 'Apex', address: '0x3000000000000000000000000000000000000002', avatar: 'avatar_2.png' },
    { name: 'Luna', address: '0x4000000000000000000000000000000000000003', avatar: 'avatar_3.png' },
    { name: 'Nexus', address: '0x5000000000000000000000000000000000000004', avatar: 'avatar_1.png' },
    { name: 'Solace', address: '0x6000000000000000000000000000000000000005', avatar: 'avatar_2.png' },
  ];
  const defaultPlayers: Player[] = [
    {
      id: 0,
      name: 'You',
      address: '0x1000000000000000000000000000000000000000',
      cash: startingCash,
      tiles: [0, 0, 0, 0, 0, 0],
      avatar: 'avatar_0.png',
      ownedLots: [],
    },
    {
      id: 1,
      name: 'Sherwood',
      address: '0x2000000000000000000000000000000000000001',
      cash: startingCash,
      tiles: [0, 0, 0, 0, 0, 0],
      avatar: 'avatar_1.png',
      ownedLots: [],
    },
    {
      id: 2,
      name: 'Apex',
      address: '0x3000000000000000000000000000000000000002',
      cash: startingCash,
      tiles: [0, 0, 0, 0, 0, 0],
      avatar: 'avatar_2.png',
      ownedLots: [],
    },
    {
      id: 3,
      name: 'Luna',
      address: '0x4000000000000000000000000000000000000003',
      cash: startingCash,
      tiles: [0, 0, 0, 0, 0, 0],
      avatar: 'avatar_3.png',
      ownedLots: [],
    },
  ];

  const players: Player[] = config?.players
    ? config.players.map((p, idx) => ({
        id: idx,
        name: p.name,
        address:
          p.address ??
          (idx === 0
            ? '0x1000000000000000000000000000000000000000'
            : (defaultBots[idx - 1]?.address ??
               `0x${(idx + 1).toString().padStart(40, '0')}`)),
        cash: startingCash,
        tiles: [0, 0, 0, 0, 0, 0],
        avatar:
          p.avatar ??
          (idx === 0
            ? 'avatar_0.png'
            : (defaultBots[idx - 1]?.avatar ?? `avatar_${idx % 4}.png`)),
        ownedLots: [],
      }))
    : defaultPlayers;

  // Initialize exactly 72 lots from PLOT_LAYOUT
  const lots: Lot[] = PLOT_LAYOUT.map((plot) => ({
    id: plot.id,
    displayId: plot.displayId,
    block: plot.block,
    col: plot.col,
    row: plot.row,
    owner: null,
    shop: null,
    shopSize: undefined,
    isComplete: false,
  }));

  // Bag of exactly 120 tiles: 20 per category
  const bag = shuffle(
    Array.from({ length: 120 }, (_, index) => index % 6),
    rng
  );

  const state: GameState = {
    version: 1,
    boardRevision: BOARD_REVISION,
    year: 1,
    phase: 'receive',
    players,
    lots,
    bag,
    pending: [],
    draftCount: 0,
    logs: [],
    lastIncome: [],
    trades: 0,
    incomingOffers: [],
  };

  startYear(state, rng);
  return state;
}

/**
 * Flexible wrapper for newGame supporting both (rng) and (config, rng) signatures.
 */
export function newGame(
  arg1?: RandomSource | GameConfig,
  arg2?: RandomSource | GameConfig
): GameState {
  let config: GameConfig | undefined;
  let rng: RandomSource = Math.random;

  if (typeof arg1 === 'function') {
    rng = arg1;
    if (typeof arg2 === 'object') config = arg2;
  } else if (typeof arg1 === 'object') {
    config = arg1;
    if (typeof arg2 === 'function') rng = arg2;
  }

  return createGame(config, rng);
}

/**
 * Phase 1 start: deals candidate deeds and distributes tiles.
 */
export function startYear(state: GameState, rng: RandomSource = Math.random): GameState {
  state.phase = 'receive';
  state.lastIncome = [];
  const schedule = getPlotKeepSchedule(state.players.length);
  const count = schedule[state.year - 1] ?? schedule[schedule.length - 1];
  state.draftCount = count;

  const unclaimed = state.lots
    .filter((lot) => lot.owner === null)
    .map((lot) => lot.id);

  state.pending = shuffle(unclaimed, rng).slice(
    0,
    Math.min(count + 2, unclaimed.length)
  );

  // Distribute shop tiles according to player count schedule
  const tileSchedule = getTileDrawSchedule(state.players.length);
  const tileCount = tileSchedule[state.year - 1] ?? 4;
  for (let player = 0; player < state.players.length; player++) {
    drawTiles(state, player, tileCount);
  }

  log(
    state,
    `Epoch ${state.year} opened. New allocation deeds and ${tileCount} protocol modules arrived.`
  );
  return state;
}

/**
 * Blindly draws shop tiles from bag into player inventory.
 */
export function drawTiles(state: GameState, player: number, count: number): void {
  for (let index = 0; index < count && state.bag.length > 0; index++) {
    const shop = state.bag.pop();
    if (shop === undefined) break;
    state.players[player].tiles[shop]++;
  }
}

/**
 * Phase 1 parcel drafting for human player and automated bots.
 */
export function draftPlots(
  state: GameState,
  playerId: number,
  lotIds: number[],
  rng: RandomSource = Math.random
): GameState {
  if (state.phase !== 'receive') {
    throw Error('Allocation deeds can be selected only during the Allocation phase.');
  }
  if (
    !Array.isArray(lotIds) ||
    lotIds.length !== state.draftCount ||
    new Set(lotIds).size !== lotIds.length ||
    lotIds.some((id) => !state.pending.includes(id) || state.lots[id].owner !== null)
  ) {
    throw Error(`Select exactly ${state.draftCount} deeds from your allocation options.`);
  }

  for (const id of lotIds) {
    state.lots[id].owner = playerId;
  }
  state.pending = [];

  // Automated bot drafting for remaining bots
  for (let botId = 1; botId < state.players.length; botId++) {
    if (botId !== playerId) {
      botDraft(state, botId, state.draftCount, rng);
    }
  }

  state.phase = 'trade';
  state.incomingOffers = [];

  for (let botId = 1; botId < state.players.length; botId++) {
    if (botId !== playerId) {
      const offer = generateBotTradeOffer(botId, playerId, state);
      if (offer) {
        state.incomingOffers.push(offer);
        const lotNumber = (offer.take.lots[0] ?? 0) + 1;
        log(
          state,
          `${state.players[botId].name} proposed an OTC trade: ${offer.give.cash} $wif for Parcel ${lotNumber}.`
        );
      }
    }
  }

  log(
    state,
    `${state.players[playerId].name} claimed parcels ${lotIds.map((id) => id + 1).join(', ')}.`
  );
  return state;
}

export function claimPlots(
  state: GameState,
  ids: number[],
  rng: RandomSource = Math.random
): number[] {
  draftPlots(state, 0, ids, rng);
  return state.lots.filter((l) => l.owner === 0).map((l) => l.id);
}

/**
 * Advance phase in turn cycle.
 */
export function advancePhase(state: GameState): GameState {
  if (state.phase === 'trade') {
    state.phase = 'build';
    state.incomingOffers = [];
    log(state, 'OTC Liquidity Desk closed. Protocol deployment initiated.');
  } else if (state.phase === 'income') {
    if (state.year < 6) {
      state.year++;
      startYear(state);
    } else {
      state.phase = 'ended';
      log(state, 'Match completed. Final Settlement reached.');
    }
  }
  return state;
}

export function beginBuild(state: GameState): void {
  if (state.phase !== 'trade') throw Error('Finish choosing your plots first.');
  advancePhase(state);
}

/**
 * Deploy shop tile from inventory onto empty owned lot.
 */
export function buildTile(
  state: GameState,
  playerId: number,
  lotId: number,
  shopType: number
): GameState {
  if (state.phase !== 'build') {
    throw Error('Shops open during the Build phase.');
  }
  const tileCount = state.players[playerId]?.tiles[shopType] ?? 0;
  const validation = canBuildShop(state.lots, lotId, playerId, shopType, tileCount);
  if (!validation.valid) {
    const reason = validation.reason || 'Choose your own empty plot and a tile you have in hand.';
    log(state, `Build rejected on Parcel ${lotId + 1}: ${reason}`);
    throw Error(reason);
  }

  state.lots[lotId].shop = shopType;
  state.lots[lotId].shopSize = SHOPS[shopType].size;
  state.players[playerId].tiles[shopType]--;

  // Update cluster completeness flags across all groups owned by this player
  const playerGroups = groups(state, playerId);
  for (const g of playerGroups) {
    for (const lid of g.lots) {
      state.lots[lid].isComplete = g.isComplete;
    }
  }

  log(
    state,
    `${state.players[playerId].name} deployed ${SHOPS[shopType].name} on Parcel ${lotId + 1}.`
  );
  return state;
}

export function placeShop(
  state: GameState,
  id: number,
  shop: number,
  player = 0
): { id: number; shop: number } {
  buildTile(state, player, id, shop);
  return { id, shop };
}

/**
 * Phase 5 harvest: collects yield for all players.
 */
export function collectIncome(state: GameState): { state: GameState; payouts: number[] } {
  if (state.phase !== 'build') {
    throw Error('Deployment must conclude before yield harvest.');
  }

  // Execute greedy bot builds
  for (let botId = 1; botId < state.players.length; botId++) {
    botBuild(state, botId);
  }

  state.lastIncome = state.players.map((p) => income(state, p.id));
  for (let p = 0; p < state.players.length; p++) {
    state.players[p].cash += state.lastIncome[p];
  }

  log(
    state,
    `Epoch ${state.year} harvest complete. Player earned ${state.lastIncome[0]} $wif yield.`
  );
  state.phase = state.year === 6 ? 'ended' : 'income';
  return { state, payouts: [...state.lastIncome] };
}

export function finishYear(state: GameState): number[] {
  return collectIncome(state).payouts;
}

export function nextYear(state: GameState, rng: RandomSource = Math.random): void {
  if (state.phase !== 'income') {
    throw Error('Harvest annual yield first.');
  }
  state.year++;
  startYear(state, rng);
}

export const endYear = nextYear;

export function emptyOffer(): OfferSide {
  return { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] };
}

/**
 * Validates trade offer legality before execution.
 */
export function validateOffer(state: GameState, offer: TradeOffer): boolean {
  if (state.phase !== 'trade') {
    throw Error('Deals are available only during the Trade phase.');
  }
  const partner = offer.toPlayer ?? offer.partner;
  const proposer = offer.fromPlayer ?? 0;
  if (
    !Number.isInteger(partner) ||
    partner === undefined ||
    partner < 0 ||
    partner >= state.players.length ||
    partner === proposer
  ) {
    throw Error('Choose a trading partner.');
  }
  if (!Number.isInteger(proposer) || proposer < 0 || proposer >= state.players.length) {
    throw Error('Invalid trade proposer.');
  }

  const sides: [OfferSide, number][] = [
    [offer.give, proposer],
    [offer.take, partner],
  ];

  for (const [side, player] of sides) {
    if (
      !side ||
      !Number.isInteger(side.cash) ||
      side.cash < 0 ||
      side.cash > state.players[player].cash
    ) {
      throw Error('Cash must be a whole number within the owner’s balance.');
    }

    if (Array.isArray(side.tiles)) {
      if (
        side.tiles.length === 6 &&
        side.tiles.every((val) => typeof val === 'number')
      ) {
        for (let s = 0; s < 6; s++) {
          const count = side.tiles[s] as number;
          if (
            !Number.isInteger(count) ||
            count < 0 ||
            count > state.players[player].tiles[s]
          ) {
            throw Error('A player cannot trade more shop tiles than they hold.');
          }
        }
      }
    }

    if (
      !Array.isArray(side.lots) ||
      new Set(side.lots).size !== side.lots.length ||
      side.lots.some(
        (id) => !Number.isInteger(id) || !state.lots[id] || state.lots[id].owner !== player
      )
    ) {
      throw Error('Each plot can be offered once by its current owner.');
    }
  }

  const hasGiveAssets =
    offer.give.cash > 0 ||
    offer.give.lots.length > 0 ||
    (Array.isArray(offer.give.tiles) &&
      offer.give.tiles.some((t) => (typeof t === 'number' ? t > 0 : Boolean(t))));
  const hasTakeAssets =
    offer.take.cash > 0 ||
    offer.take.lots.length > 0 ||
    (Array.isArray(offer.take.tiles) &&
      offer.take.tiles.some((t) => (typeof t === 'number' ? t > 0 : Boolean(t))));

  if (!hasGiveAssets && !hasTakeAssets) {
    throw Error('Add cash, a shop tile, or a plot to the deal.');
  }

  return true;
}

/**
 * Evaluates trade offer against counterparty bot.
 */
export function evaluateOffer(state: GameState, offer: TradeOffer): TradeEvaluation {
  validateOffer(state, offer);
  const partner = offer.toPlayer ?? offer.partner ?? 1;
  return evaluateTradeOffer(offer, partner, state);
}

/**
 * Atomically executes trade if accepted.
 */
export function executeTrade(
  state: GameState,
  offer: TradeOffer
): { state: GameState; evaluation: TradeEvaluation } {
  const evaluation = evaluateOffer(state, offer);
  if (!evaluation.accepted) return { state, evaluation };

  const proposer = state.players[offer.fromPlayer ?? 0];
  const partner = state.players[offer.toPlayer ?? offer.partner!];

  // Transfer cash
  proposer.cash += offer.take.cash - offer.give.cash;
  partner.cash += offer.give.cash - offer.take.cash;

  // Transfer tiles
  if (
    Array.isArray(offer.give.tiles) &&
    offer.give.tiles.length === 6 &&
    typeof offer.give.tiles[0] === 'number' &&
    Array.isArray(offer.take.tiles) &&
    offer.take.tiles.length === 6 &&
    typeof offer.take.tiles[0] === 'number'
  ) {
    for (let s = 0; s < 6; s++) {
      const giveCount = offer.give.tiles[s] as number;
      const takeCount = offer.take.tiles[s] as number;
      proposer.tiles[s] += takeCount - giveCount;
      partner.tiles[s] += giveCount - takeCount;
    }
  }

  // Transfer parcels
  for (const id of offer.give.lots) state.lots[id].owner = partner.id;
  for (const id of offer.take.lots) state.lots[id].owner = proposer.id;

  // Recalculate cluster completeness on transferred and surrounding occupied parcels
  if (offer.give.lots.length > 0 || offer.take.lots.length > 0) {
    const affectedPlayers = [proposer.id, partner.id];
    for (const pid of affectedPlayers) {
      for (const lot of state.lots) {
        if (lot.owner === pid) {
          lot.isComplete = false;
        }
      }
      const playerGroups = groups(state, pid);
      for (const g of playerGroups) {
        for (const lid of g.lots) {
          state.lots[lid].isComplete = g.isComplete;
        }
      }
    }
  }

  if (state.incomingOffers && state.incomingOffers.length > 0) {
    state.incomingOffers = state.incomingOffers.filter((o) => {
      if (o === offer) return false;
      const oPartner = o.toPlayer ?? o.partner ?? 0;
      return o.take.lots.every((lid) => state.lots[lid].owner === oPartner);
    });
  }

  state.trades++;
  log(
    state,
    `Order ${state.trades} FILLED: ${proposer.name} and ${partner.name} exchanged assets.`
  );
  return { state, evaluation };
}

export function trade(state: GameState, offer: TradeOffer): TradeEvaluation {
  return executeTrade(state, offer).evaluation;
}

/**
 * Rankings based on cash, placed shops, and owned parcels.
 */
export function rankings(state: GameState): Player[] {
  return [...state.players].sort(
    (a, b) =>
      b.cash - a.cash ||
      state.lots.filter((l) => l.owner === b.id && l.shop !== null).length -
        state.lots.filter((l) => l.owner === a.id && l.shop !== null).length ||
      state.lots.filter((l) => l.owner === b.id).length -
        state.lots.filter((l) => l.owner === a.id).length
  );
}

export function log(state: GameState, message: string): void {
  state.logs.unshift(message);
  if (state.logs.length > 100) state.logs.length = 100;
}

export function validSave(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.year === 'number' &&
    s.year >= 1 &&
    s.year <= 6 &&
    Array.isArray(s.players) &&
    s.players.length >= 3 &&
    s.players.length <= 6 &&
    Array.isArray(s.lots) &&
    s.lots.length === 72 &&
    Array.isArray(s.bag) &&
    Array.isArray(s.logs)
  );
}

export function updateBoardLayout(state: GameState): boolean {
  if (state.boardRevision === BOARD_REVISION) return false;
  state.boardRevision = BOARD_REVISION;
  for (const lot of state.lots) {
    const layout = PLOT_LAYOUT[lot.id];
    if (layout) {
      lot.block = layout.block;
      lot.col = layout.col;
      lot.row = layout.row;
    }
  }
  return true;
}

export { botBuild, botDraft, evaluateTradeOffer };
