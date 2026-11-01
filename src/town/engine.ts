import { BOARD_REVISION, plotNeighbors } from './board-layout';
import { calculateStakingBoost, calculateTradeTax } from '../tokenomics/flywheel';
import type {
  GamePhase,
  GameState,
  Lot,
  MatchEntryMode,
  OfferSide,
  Player,
  RandomSource,
  Shop,
  ShopGroup,
  TradeEvaluation,
  TradeOffer,
} from './types';

export const SHOPS: Shop[] = [
  { id: 'coffee', name: 'Coffee', english: 'Coffee House', code: 'CF', size: 3, color: '#825d43' },
  {
    id: 'banhmi',
    name: 'Bakery',
    english: 'Corner Bakery',
    code: 'BK',
    size: 3,
    color: '#b7782c',
  },
  { id: 'pho', name: 'Noodles', english: 'Noodle Kitchen', code: 'ND', size: 4, color: '#b85539' },
  {
    id: 'flowers',
    name: 'Flowers',
    english: 'Flower Studio',
    code: 'FL',
    size: 4,
    color: '#a16586',
  },
  { id: 'tailor', name: 'Tailor', english: 'Silk Tailor', code: 'ST', size: 5, color: '#587c9a' },
  {
    id: 'grocery',
    name: 'Grocery',
    english: 'Corner Grocer',
    code: 'CG',
    size: 6,
    color: '#648454',
  },
];

export const DISTRICTS = [
  'Sherwood',
  'Clocktower',
  'Harborview',
  'Lantern Hall',
  'Grand Market',
  'Maple Lane',
];
export const COLORS = ['#39a883', '#eec353', '#dc6f57', '#7fb5cf', '#ab47bc', '#ec407a'];
export const KEEP = [5, 4, 3, 2, 2, 2];
export const COMPLETE = [0, 0, 0, 50, 80, 110, 140];
export const INCOMPLETE = [0, 10, 20, 40, 60, 80];

export function getTodayHarborSeedKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hashHarborSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h === 0 ? 0x6d2b79f5 : h >>> 0;
}

function stepStateRng(state: GameState): number {
  let t = ((state.rngState ?? 0x6d2b79f5) + 0x6d2b79f5) >>> 0;
  state.rngState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function resolveRng(state: GameState, provided?: RandomSource): RandomSource {
  if (provided && provided !== Math.random) {
    return provided;
  }
  if (typeof state.rngState === 'number' && Number.isFinite(state.rngState)) {
    return () => stepStateRng(state);
  }
  return Math.random;
}

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  return items
    .map((value) => ({ key: rng(), value }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}

export const neighbors = plotNeighbors;

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

    result.push({ shop: lot.shop, lots: ids, size: ids.length });
  }

  return result;
}

export function groupIncome(shop: number, count: number): number {
  const target = SHOPS[shop].size;
  return Math.floor(count / target) * COMPLETE[target] + INCOMPLETE[count % target];
}

export function income(state: GameState, player: number, isStaked = false): number {
  const raw = groups(state, player).reduce(
    (total, group) => total + groupIncome(group.shop, group.size),
    0,
  );
  return player === 0 && isStaked ? calculateStakingBoost(raw, true) : raw;
}

export function holdings(state: GameState, player: number): Lot[] {
  return state.lots.filter((lot) => lot.owner === player);
}

export function newGame(
  rng: RandomSource = Math.random,
  entryMode: MatchEntryMode = 'casual',
  dailySeed?: string,
): GameState {
  const resolvedDailySeed =
    entryMode === 'daily' ? dailySeed || getTodayHarborSeedKey() : dailySeed;
  const initialRngState =
    resolvedDailySeed && rng === Math.random
      ? hashHarborSeed(`robin-town-daily:${resolvedDailySeed}`)
      : undefined;

  const state: GameState = {
    version: 1,
    boardRevision: BOARD_REVISION,
    year: 1,
    phase: 'receive',
    players: ['You', 'Cole', 'Maya', 'Clara'].map((name, id) => ({
      id,
      name,
      cash: 50,
      tiles: [0, 0, 0, 0, 0, 0],
    })),
    lots: Array.from({ length: 72 }, (_, id) => ({ id, owner: null, shop: null })),
    bag: [],
    pending: [],
    draftCount: 0,
    logs: [],
    lastIncome: [],
    trades: 0,
    entryMode,
    dailySeed: resolvedDailySeed,
    rngState: initialRngState,
    matchSettled: false,
  };

  const activeRng = resolveRng(state, rng);
  state.bag = shuffle(
    Array.from({ length: 120 }, (_, index) => index % 6),
    activeRng,
  );

  startYear(state, rng);
  return state;
}

export function newDailyGame(seedKey: string = getTodayHarborSeedKey()): GameState {
  return newGame(Math.random, 'daily', seedKey);
}

const LEGACY_PLAYER_NAMES: Record<string, string> = {
  Linh: 'Cole',
  Minh: 'Maya',
  An: 'Clara',
  Archer: 'Cole',
  Marina: 'Maya',
};

const LEGACY_LOG_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\bBanh Mi Bakery\b/g, 'Corner Bakery'],
  [/\bBanh Mi\b/g, 'Bakery'],
  [/\bPho Kitchen\b/g, 'Noodle Kitchen'],
  [/\bPho\b/g, 'Noodles'],
  [/\bTan Dinh\b/g, 'Sherwood'],
  [/\bBen Thanh\b/g, 'Clocktower'],
  [/\bThao Dien\b/g, 'Harborview'],
  [/\bCho Lon\b/g, 'Lantern Hall'],
  [/\bBinh Thanh\b/g, 'Grand Market'],
  [/\bPhu Nhuan\b/g, 'Maple Lane'],
  [/\bLinh\b/g, 'Cole'],
  [/\bMinh\b/g, 'Maya'],
  [/\bAn\b/g, 'Clara'],
  [/\bArcher\b/g, 'Cole'],
  [/\bMarina\b/g, 'Maya'],
];

export function migrateEnglishState(state: GameState): boolean {
  let changed = false;
  for (const player of state.players) {
    const mapped = LEGACY_PLAYER_NAMES[player.name];
    if (mapped) {
      player.name = mapped;
      changed = true;
    }
  }
  state.logs = state.logs.map((entry) => {
    let updated = entry;
    for (const [pattern, replacement] of LEGACY_LOG_REPLACEMENTS) {
      updated = updated.replace(pattern, replacement);
    }
    if (updated !== entry) changed = true;
    return updated;
  });
  return changed;
}

export function updateBoardLayout(state: GameState): boolean {
  if (state.boardRevision === BOARD_REVISION) return false;
  state.boardRevision = BOARD_REVISION;

  if (state.lots.some((lot) => lot.owner !== null)) {
    log(
      state,
      'The city map now has irregular blocks. Plot numbers, owners, shops, and $wif balances are preserved.',
    );
  }

  return true;
}

function drawTiles(state: GameState, player: number, count: number): void {
  for (let index = 0; index < count && state.bag.length > 0; index++) {
    const shop = state.bag.pop();
    if (shop === undefined) break;
    state.players[player].tiles[shop]++;
  }
}

function plotScore(state: GameState, id: number, player: number): number {
  return neighbors(id).reduce((score, neighbor) => {
    const owner = state.lots[neighbor].owner;
    return score + (owner === player ? 3 : owner === null ? 1 : 0);
  }, 0);
}

function botDraft(state: GameState, player: number, count: number, rng: RandomSource): void {
  const offered = shuffle(
    state.lots
      .filter((lot) => lot.owner === null && !state.pending.includes(lot.id))
      .map((lot) => lot.id),
    rng,
  ).slice(0, count + 2);

  for (let index = 0; index < count && offered.length > 0; index++) {
    offered.sort((a, b) => plotScore(state, b, player) - plotScore(state, a, player));
    const id = offered.shift();
    if (id === undefined) break;
    state.lots[id].owner = player;
  }
}

export function startYear(state: GameState, rng: RandomSource = Math.random): void {
  const activeRng = resolveRng(state, rng);
  state.phase = 'receive';
  state.lastIncome = [];
  const count = KEEP[state.year - 1];
  state.draftCount = count;
  state.pending = shuffle(
    state.lots.filter((lot) => lot.owner === null).map((lot) => lot.id),
    activeRng,
  ).slice(0, count + 2);

  for (let player = 0; player < state.players.length; player++) {
    drawTiles(state, player, state.year === 1 ? 5 : 4);
  }

  log(
    state,
    `Year ${state.year}: new addresses and ${state.year === 1 ? 5 : 4} shop tiles arrived.`,
  );
}

export function claimPlots(
  state: GameState,
  ids: number[],
  rng: RandomSource = Math.random,
): number[] {
  const activeRng = resolveRng(state, rng);
  if (state.phase !== 'receive') {
    throw Error('You can choose addresses only at the start of a year.');
  }

  if (
    !Array.isArray(ids) ||
    ids.length !== state.draftCount ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !state.pending.includes(id) || state.lots[id].owner !== null)
  ) {
    throw Error(`Choose exactly ${state.draftCount} of your offered plots.`);
  }

  for (const id of ids) state.lots[id].owner = 0;
  state.pending = [];

  for (let player = 1; player < state.players.length; player++) {
    botDraft(state, player, state.draftCount, activeRng);
  }

  state.phase = 'trade';
  log(state, `You claimed plots ${ids.map((id) => id + 1).join(', ')}.`);
  return ids;
}

export function beginBuild(state: GameState): void {
  if (state.phase !== 'trade') throw Error('Finish choosing your plots first.');
  state.phase = 'build';
  log(state, 'Trading closed. Time to open your shops.');
}

export function canPlace(state: GameState, player: number, id: number, shop: number): boolean {
  if (!Number.isInteger(id) || !state.lots[id] || !Number.isInteger(shop) || !SHOPS[shop]) {
    return false;
  }

  const lot = state.lots[id];
  return lot.owner === player && lot.shop === null && state.players[player].tiles[shop] >= 1;
}

export function placeShop(
  state: GameState,
  id: number,
  shop: number,
  player = 0,
): { id: number; shop: number } {
  if (state.phase !== 'build') throw Error('Shops open during the Build phase.');
  if (!canPlace(state, player, id, shop)) {
    throw Error('Choose your own empty plot and a tile you have in hand.');
  }

  state.lots[id].shop = shop;
  state.players[player].tiles[shop]--;
  log(state, `${state.players[player].name} opened ${SHOPS[shop].name} on plot ${id + 1}.`);
  return { id, shop };
}

export function botBuild(state: GameState, player: number): void {
  let guard = 0;
  while (guard++ < 30) {
    let best: { id: number; shop: number; score: number } | null = null;

    for (const lot of holdings(state, player).filter((candidate) => candidate.shop === null)) {
      for (let shop = 0; shop < SHOPS.length; shop++) {
        if (!canPlace(state, player, lot.id, shop)) continue;

        const adjacent = neighbors(lot.id).filter(
          (id) => state.lots[id].owner === player && state.lots[id].shop === shop,
        ).length;
        const possible = neighbors(lot.id).filter(
          (id) => state.lots[id].owner === player && state.lots[id].shop === null,
        ).length;
        const before = income(state, player);
        lot.shop = shop;
        const delta = income(state, player) - before;
        lot.shop = null;
        const score =
          delta * 2 +
          adjacent * 8 +
          possible * 2 +
          state.players[player].tiles[shop] -
          SHOPS[shop].size;

        if (!best || score > best.score) best = { id: lot.id, shop, score };
      }
    }

    if (!best) break;
    placeShop(state, best.id, best.shop, player);
  }
}

export function finishYear(state: GameState, isStaked = false): number[] {
  if (state.phase !== 'build') throw Error('Finish trading before collecting income.');

  for (let player = 1; player < state.players.length; player++) botBuild(state, player);
  state.lastIncome = state.players.map((player) => income(state, player.id, isStaked));
  for (let player = 0; player < state.players.length; player++) {
    state.players[player].cash += state.lastIncome[player];
  }

  const stakeTag = isStaked && state.lastIncome[0] > 0 ? ' (with 1.20x $wif Staking Boost)' : '';
  log(state, `Year ${state.year} closed. You earned ${state.lastIncome[0]} $wif${stakeTag}.`);
  state.phase = state.year === 6 ? 'ended' : 'income';
  return state.lastIncome;
}

export function nextYear(state: GameState, rng: RandomSource = Math.random): void {
  if (state.phase !== 'income') throw Error('Collect this year income first.');
  state.year++;
  startYear(state, rng);
}

export function log(state: GameState, message: string): void {
  state.logs.unshift(message);
  if (state.logs.length > 100) state.logs.length = 100;
}

function sideValue(state: GameState, side: OfferSide, recipient: number): number {
  const tiles = side.tiles.reduce(
    (value, count, shop) =>
      value +
      count *
        (10 +
          state.players[recipient].tiles[shop] * 1.5 +
          groups(state, recipient).filter(
            (group) => group.shop === shop && group.size < SHOPS[shop].size,
          ).length *
            6),
    0,
  );

  const lots = side.lots.reduce((value, id) => {
    const lot = state.lots[id];
    const adjacency = neighbors(id).filter(
      (neighbor) => state.lots[neighbor].owner === recipient,
    ).length;
    return value + 18 + adjacency * 14 + (lot.shop === null ? 0 : 15 + 10 * (7 - state.year));
  }, 0);

  return side.cash + tiles + lots;
}

export function emptyOffer(): OfferSide {
  return { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] };
}

export function validateOffer(state: GameState, offer: TradeOffer): boolean {
  if (state.phase !== 'trade') throw Error('Deals are available only during the Trade phase.');
  if (!offer || !Number.isInteger(offer.partner) || offer.partner < 1 || offer.partner >= state.players.length) {
    throw Error('Choose a trading partner.');
  }

  const sides: [OfferSide, number][] = [
    [offer.give, 0],
    [offer.take, offer.partner],
  ];
  for (const [side, player] of sides) {
    if (
      !side ||
      !Number.isInteger(side.cash) ||
      side.cash < 0 ||
      side.cash > state.players[player].cash
    ) {
      throw Error('Cash must be a whole number within the owner balance.');
    }
    if (
      !Array.isArray(side.tiles) ||
      side.tiles.length !== 6 ||
      side.tiles.some(
        (count, shop) =>
          !Number.isInteger(count) || count < 0 || count > state.players[player].tiles[shop],
      )
    ) {
      throw Error('A player cannot trade more shop tiles than they hold.');
    }
    if (
      !Array.isArray(side.lots) ||
      new Set(side.lots).size !== side.lots.length ||
      side.lots.some(
        (id) => !Number.isInteger(id) || !state.lots[id] || state.lots[id].owner !== player,
      )
    ) {
      throw Error('Each plot can be offered once by its current owner.');
    }
  }

  if (
    ![offer.give, offer.take].some(
      (side) => side.cash || side.lots.length || side.tiles.some(Boolean),
    )
  ) {
    throw Error('Add $wif cash, a shop tile, or a plot to the deal.');
  }
  return true;
}

export function evaluateOffer(state: GameState, offer: TradeOffer): TradeEvaluation {
  validateOffer(state, offer);
  const offered = sideValue(state, offer.give, offer.partner);
  const requested = sideValue(state, offer.take, offer.partner);
  const margin = [0, 1.04, 1.09, 1.01, 1.06, 1.02][offer.partner] ?? 1.05;

  return {
    accepted: offered >= requested * margin,
    shortfall: Math.max(0, Math.ceil(requested * margin - offered)),
  };
}

export function trade(state: GameState, offer: TradeOffer): TradeEvaluation {
  const result = evaluateOffer(state, offer);
  if (!result.accepted) return result;

  const you = state.players[0];
  const partner = state.players[offer.partner];
  const giveTax = calculateTradeTax(offer.give.cash);
  const takeTax = calculateTradeTax(offer.take.cash);

  you.cash += takeTax.netCash - offer.give.cash;
  partner.cash += giveTax.netCash - offer.take.cash;

  for (let shop = 0; shop < 6; shop++) {
    you.tiles[shop] += offer.take.tiles[shop] - offer.give.tiles[shop];
    partner.tiles[shop] += offer.give.tiles[shop] - offer.take.tiles[shop];
  }

  for (const id of offer.give.lots) state.lots[id].owner = offer.partner;
  for (const id of offer.take.lots) state.lots[id].owner = 0;
  state.trades++;
  const plots = offer.give.lots.length + offer.take.lots.length;
  const tiles =
    offer.give.tiles.reduce((total, count) => total + count, 0) +
    offer.take.tiles.reduce((total, count) => total + count, 0);
  const totalTax = giveTax.taxAmount + takeTax.taxAmount;
  const taxNote = totalTax > 0 ? ` (${totalTax} $wif routed to Vault)` : '';
  log(
    state,
    `Deal ${state.trades}: you and ${partner.name} traded ${plots} plots, ${tiles} tiles, and $wif${taxNote}.`,
  );
  return { ...result, taxAmount: totalTax };
}

export interface BotTradeSummary {
  from: number;
  to: number;
  summary: string;
  taxAmount: number;
}

function isSurplusTileFor(state: GameState, player: number, shop: number): boolean {
  const held = state.players[player].tiles[shop];
  if (held <= 0) return false;
  const openGroups = groups(state, player).filter(
    (g) => g.shop === shop && g.size < SHOPS[shop].size,
  ).length;
  return openGroups === 0 && held < SHOPS[shop].size;
}

function wantsTile(state: GameState, player: number, shop: number): number {
  const openGroups = groups(state, player).filter(
    (g) => g.shop === shop && g.size < SHOPS[shop].size,
  );
  const held = state.players[player].tiles[shop];
  if (openGroups.length > 0) {
    const largest = Math.max(...openGroups.map((g) => g.size));
    return 14 + largest * 8 + held * 3;
  }
  if (held >= 2) {
    return 8 + held * 4;
  }
  return 0;
}

export function botTradeRound(state: GameState): {
  deals: BotTradeSummary[];
  totalTax: number;
} {
  if (state.phase !== 'trade') return { deals: [], totalTax: 0 };

  const deals: BotTradeSummary[] = [];
  let totalTax = 0;
  const pairs: [number, number][] = [
    [1, 2],
    [2, 3],
    [1, 3],
  ];

  for (const [a, b] of pairs) {
    if (!state.players[a] || !state.players[b]) continue;
    const playerA = state.players[a];
    const playerB = state.players[b];

    let bestSwap: {
      shopFromA: number;
      shopFromB: number;
      cashFromA: number;
      cashFromB: number;
      score: number;
    } | null = null;

    for (let sA = 0; sA < SHOPS.length; sA++) {
      if (!isSurplusTileFor(state, a, sA)) continue;
      const bDesire = wantsTile(state, b, sA);
      if (bDesire <= 0) continue;

      for (let sB = 0; sB < SHOPS.length; sB++) {
        if (sA === sB || !isSurplusTileFor(state, b, sB)) continue;
        const aDesire = wantsTile(state, a, sB);
        if (aDesire <= 0) continue;

        const diff = aDesire - bDesire;
        let cashFromA = 0;
        let cashFromB = 0;
        if (diff > 4) {
          cashFromA = Math.min(20, Math.floor(playerA.cash * 0.25), Math.round(diff));
        } else if (diff < -4) {
          cashFromB = Math.min(20, Math.floor(playerB.cash * 0.25), Math.round(-diff));
        }
        const score = aDesire + bDesire;
        if (!bestSwap || score > bestSwap.score) {
          bestSwap = { shopFromA: sA, shopFromB: sB, cashFromA, cashFromB, score };
        }
      }
    }

    if (bestSwap) {
      const taxA = calculateTradeTax(bestSwap.cashFromA);
      const taxB = calculateTradeTax(bestSwap.cashFromB);
      playerA.tiles[bestSwap.shopFromA]--;
      playerB.tiles[bestSwap.shopFromA]++;
      playerB.tiles[bestSwap.shopFromB]--;
      playerA.tiles[bestSwap.shopFromB]++;
      playerA.cash += taxB.netCash - bestSwap.cashFromA;
      playerB.cash += taxA.netCash - bestSwap.cashFromB;

      const dealTax = taxA.taxAmount + taxB.taxAmount;
      totalTax += dealTax;
      state.trades++;

      const cashPart =
        bestSwap.cashFromA > 0
          ? ` (+${bestSwap.cashFromA} $wif)`
          : bestSwap.cashFromB > 0
            ? ` (+${bestSwap.cashFromB} $wif)`
            : '';
      const summary = `${playerA.name} and ${playerB.name} swapped ${SHOPS[bestSwap.shopFromA].name} for ${SHOPS[bestSwap.shopFromB].name}${cashPart}`;
      log(state, `Deal ${state.trades}: ${summary}.`);
      deals.push({ from: a, to: b, summary, taxAmount: dealTax });
      continue;
    }

    // Fallback: isolated empty plot swap when each bot holds a plot next to the other bot
    const isoA = holdings(state, a).find(
      (lot) =>
        lot.shop === null &&
        neighbors(lot.id).every((n) => state.lots[n].owner !== a) &&
        neighbors(lot.id).some((n) => state.lots[n].owner === b),
    );
    const isoB = holdings(state, b).find(
      (lot) =>
        lot.shop === null &&
        neighbors(lot.id).every((n) => state.lots[n].owner !== b) &&
        neighbors(lot.id).some((n) => state.lots[n].owner === a),
    );
    if (isoA && isoB) {
      isoA.owner = b;
      isoB.owner = a;
      state.trades++;
      const summary = `${playerA.name} and ${playerB.name} swapped plots #${isoA.id + 1} and #${isoB.id + 1}`;
      log(state, `Deal ${state.trades}: ${summary}.`);
      deals.push({ from: a, to: b, summary, taxAmount: 0 });
    }
  }

  return { deals, totalTax };
}

export function chooseSmartDraftPlots(state: GameState): number[] {
  if (state.phase !== 'receive' || state.pending.length === 0) return [];
  const pendingSet = new Set(state.pending);
  const ownedDistricts = new Set(
    holdings(state, 0).map((lot) => Math.floor(lot.id / 12)),
  );

  return [...state.pending]
    .map((id) => {
      const adjMine = neighbors(id).filter((n) => state.lots[n].owner === 0).length;
      const adjPending = neighbors(id).filter((n) => pendingSet.has(n)).length;
      const adjFree = neighbors(id).filter((n) => state.lots[n].owner === null).length;
      const sameDistrict = ownedDistricts.has(Math.floor(id / 12)) ? 2 : 0;
      return {
        id,
        score: adjMine * 7 + adjPending * 4 + sameDistrict + adjFree,
      };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, state.draftCount)
    .map((entry) => entry.id);
}

export function findSmartPlayerTrade(state: GameState): TradeOffer | null {
  if (state.phase !== 'trade') return null;
  const you = state.players[0];

  for (let partnerId = 1; partnerId < state.players.length; partnerId++) {
    const partner = state.players[partnerId];
    for (let wantedShop = 0; wantedShop < SHOPS.length; wantedShop++) {
      if (partner.tiles[wantedShop] <= 0) continue;
      const myDesire = wantsTile(state, 0, wantedShop);
      if (myDesire <= 0) continue;

      for (let giveShop = 0; giveShop < SHOPS.length; giveShop++) {
        if (giveShop === wantedShop || !isSurplusTileFor(state, 0, giveShop)) continue;
        const giveTiles = [0, 0, 0, 0, 0, 0];
        const takeTiles = [0, 0, 0, 0, 0, 0];
        giveTiles[giveShop] = 1;
        takeTiles[wantedShop] = 1;

        const baseOffer: TradeOffer = {
          partner: partnerId,
          give: { cash: 0, tiles: giveTiles, lots: [] },
          take: { cash: 0, tiles: takeTiles, lots: [] },
        };
        const check = evaluateOffer(state, baseOffer);
        if (check.accepted) return baseOffer;
        if (check.shortfall > 0 && check.shortfall <= 25 && you.cash - check.shortfall >= 30) {
          const sweetened: TradeOffer = {
            partner: partnerId,
            give: { cash: check.shortfall, tiles: giveTiles, lots: [] },
            take: { cash: 0, tiles: takeTiles, lots: [] },
          };
          if (evaluateOffer(state, sweetened).accepted) return sweetened;
        }
      }
    }

    // Check if neighbor holds an empty plot directly adjacent to one of our plots
    const targetLot = holdings(state, partnerId).find(
      (lot) =>
        lot.shop === null &&
        neighbors(lot.id).some((n) => state.lots[n].owner === 0) &&
        neighbors(lot.id).every((n) => state.lots[n].owner !== partnerId),
    );
    const myIsolated = holdings(state, 0).find(
      (lot) =>
        lot.shop === null &&
        neighbors(lot.id).every((n) => state.lots[n].owner !== 0),
    );
    if (targetLot && myIsolated) {
      const lotSwap: TradeOffer = {
        partner: partnerId,
        give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [myIsolated.id] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [targetLot.id] },
      };
      const evalSwap = evaluateOffer(state, lotSwap);
      if (evalSwap.accepted) return lotSwap;
      if (evalSwap.shortfall > 0 && evalSwap.shortfall <= 30 && you.cash - evalSwap.shortfall >= 30) {
        const sweetenedSwap: TradeOffer = {
          partner: partnerId,
          give: { cash: evalSwap.shortfall, tiles: [0, 0, 0, 0, 0, 0], lots: [myIsolated.id] },
          take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [targetLot.id] },
        };
        if (evaluateOffer(state, sweetenedSwap).accepted) return sweetenedSwap;
      }
    }
  }

  return null;
}

export function findNextSmartBuild(state: GameState): { id: number; shop: number } | null {
  if (state.phase !== 'build') return null;
  let best: { id: number; shop: number; score: number } | null = null;

  for (const lot of holdings(state, 0).filter((candidate) => candidate.shop === null)) {
    for (let shop = 0; shop < SHOPS.length; shop++) {
      if (!canPlace(state, 0, lot.id, shop)) continue;

      const adjacent = neighbors(lot.id).filter(
        (id) => state.lots[id].owner === 0 && state.lots[id].shop === shop,
      ).length;
      const possible = neighbors(lot.id).filter(
        (id) => state.lots[id].owner === 0 && state.lots[id].shop === null,
      ).length;
      const before = income(state, 0);
      lot.shop = shop;
      const delta = income(state, 0) - before;
      lot.shop = null;
      const score =
        delta * 2 +
        adjacent * 8 +
        possible * 2 +
        state.players[0].tiles[shop] -
        SHOPS[shop].size;

      if (!best || score > best.score) best = { id: lot.id, shop, score };
    }
  }

  return best ? { id: best.id, shop: best.shop } : null;
}

export function rankings(state: GameState): Player[] {
  return [...state.players].sort(
    (a, b) =>
      b.cash - a.cash ||
      state.lots.filter((lot) => lot.owner === b.id && lot.shop !== null).length -
        state.lots.filter((lot) => lot.owner === a.id && lot.shop !== null).length,
  );
}

/**
 * Symmetric seat-perspective mapper (0 <-> seat) for real-time cross-device multiplayer.
 * Ensures every connected human peer views their own seat as player 0 ("You") locally.
 */
export function perspectiveSwapState(state: GameState, seat: number): GameState {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState;
  if (!Number.isInteger(seat) || seat <= 0 || seat >= cloned.players.length) {
    return cloned;
  }
  const mapIdx = (idx: number | null): number | null => {
    if (idx === null) return null;
    if (idx === 0) return seat;
    if (idx === seat) return 0;
    return idx;
  };
  const p0 = cloned.players[0];
  const pk = cloned.players[seat];
  cloned.players[0] = { ...pk, id: 0 };
  cloned.players[seat] = { ...p0, id: seat };
  for (const lot of cloned.lots) {
    lot.owner = mapIdx(lot.owner);
  }
  if (cloned.lastIncome.length > seat) {
    const inc0 = cloned.lastIncome[0];
    cloned.lastIncome[0] = cloned.lastIncome[seat];
    cloned.lastIncome[seat] = inc0;
  }
  return cloned;
}

/**
 * Executes a mutually accepted human-to-human OTC trade between any two seats.
 */
export function executeAcceptedPlayerTrade(
  state: GameState,
  fromSeat: number,
  toSeat: number,
  give: OfferSide,
  take: OfferSide,
): { accepted: boolean; taxAmount: number } {
  if (state.phase !== 'trade') {
    throw Error('Deals are available only during the Trade phase.');
  }
  const pFrom = state.players[fromSeat];
  const pTo = state.players[toSeat];
  if (!pFrom || !pTo || fromSeat === toSeat) {
    throw Error('Invalid trading seats.');
  }
  if (give.cash < 0 || give.cash > pFrom.cash || take.cash < 0 || take.cash > pTo.cash) {
    throw Error('Insufficient $wif cash for trade.');
  }
  for (let s = 0; s < 6; s++) {
    if ((give.tiles[s] || 0) > pFrom.tiles[s] || (take.tiles[s] || 0) > pTo.tiles[s]) {
      throw Error('Shop tile counts changed before settlement.');
    }
  }
  if (
    give.lots.some((id) => state.lots[id]?.owner !== fromSeat) ||
    take.lots.some((id) => state.lots[id]?.owner !== toSeat)
  ) {
    throw Error('Plot ownership changed before settlement.');
  }

  const giveTax = calculateTradeTax(give.cash);
  const takeTax = calculateTradeTax(take.cash);
  pFrom.cash += takeTax.netCash - give.cash;
  pTo.cash += giveTax.netCash - take.cash;

  for (let s = 0; s < 6; s++) {
    const g = give.tiles[s] || 0;
    const t = take.tiles[s] || 0;
    pFrom.tiles[s] += t - g;
    pTo.tiles[s] += g - t;
  }
  for (const id of give.lots) state.lots[id].owner = toSeat;
  for (const id of take.lots) state.lots[id].owner = fromSeat;
  state.trades++;

  const totalTax = giveTax.taxAmount + takeTax.taxAmount;
  log(
    state,
    `Live PvP Deal ${state.trades}: ${pFrom.name} and ${pTo.name} settled an OTC swap.`,
  );
  return { accepted: true, taxAmount: totalTax };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonnegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPhase(value: unknown): value is GamePhase {
  return (
    value === 'receive' ||
    value === 'trade' ||
    value === 'build' ||
    value === 'income' ||
    value === 'ended'
  );
}

function isPlayer(value: unknown, index: number): value is Player {
  return (
    isRecord(value) &&
    value.id === index &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    isNonnegativeFinite(value.cash) &&
    isArray(value.tiles) &&
    value.tiles.length === 6 &&
    value.tiles.every(isNonnegativeInteger)
  );
}

function isLot(value: unknown, index: number): value is Lot {
  return (
    isRecord(value) &&
    value.id === index &&
    (value.owner === null || (isNonnegativeInteger(value.owner) && value.owner < 6)) &&
    (value.shop === null || (isNonnegativeInteger(value.shop) && value.shop < 6))
  );
}

export function validSave(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.boardRevision === undefined || isNonnegativeInteger(value.boardRevision)) &&
    isNonnegativeInteger(value.year) &&
    value.year >= 1 &&
    value.year <= 6 &&
    isPhase(value.phase) &&
    isArray(value.players) &&
    value.players.length >= 3 &&
    value.players.length <= 6 &&
    value.players.every(isPlayer) &&
    isArray(value.lots) &&
    value.lots.length === 72 &&
    value.lots.every(isLot) &&
    isArray(value.bag) &&
    value.bag.every((shop) => isNonnegativeInteger(shop) && shop < 6) &&
    isArray(value.pending) &&
    value.pending.every((id) => isNonnegativeInteger(id) && id < 72) &&
    isArray(value.logs) &&
    value.logs.every((message) => typeof message === 'string') &&
    isArray(value.lastIncome) &&
    value.lastIncome.every(isNonnegativeFinite) &&
    isNonnegativeInteger(value.draftCount) &&
    value.draftCount >= 1 &&
    value.draftCount <= 6 &&
    isNonnegativeInteger(value.trades) &&
    (value.dailySeed === undefined || typeof value.dailySeed === 'string') &&
    (value.rngState === undefined ||
      (typeof value.rngState === 'number' && Number.isFinite(value.rngState)))
  );
}
