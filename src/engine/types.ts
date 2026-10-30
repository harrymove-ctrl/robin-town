/**
 * src/engine/types.ts
 *
 * Core data contracts, interfaces, and schemas for robin-town.
 * Pure deterministic game state, board parcels, shop groups, trade offers,
 * and AI bot evaluations with zero DOM dependencies.
 */

export type GamePhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';

export type RandomSource = () => number;

export interface Player {
  id: number;
  name: string;
  address: string;
  cash: number;
  tiles: number[];
  avatar?: string;
  ownedLots?: number[];
}

export interface Lot {
  id: number;
  displayId: number;
  block: number;
  col: number;
  row: number;
  owner: number | null;
  shop: number | null;
  shopSize?: number;
  isComplete?: boolean;
}

export interface Shop {
  id: string;
  name: string;
  code: string;
  size: number;
  color: string;
  quota: number;
}

export interface ShopGroup {
  shop: number;
  lots: number[];
  size: number;
  isComplete?: boolean;
  payout?: number;
}

export interface OfferSide {
  cash: number;
  tiles: number[] | { type: number; id?: number }[];
  lots: number[];
}

export interface TradeOffer {
  fromPlayer?: number;
  toPlayer?: number;
  partner?: number;
  give: OfferSide;
  take: OfferSide;
}

export interface TradeEvaluation {
  accepted: boolean;
  shortfall: number;
  counterOffer?: OfferSide;
  quoteMessage?: string;
  valueReceived?: number;
  valueSurrendered?: number;
  requiredValue?: number;
}

export interface GameConfig {
  players?: { name: string; address?: string; avatar?: string }[];
  startingCash?: number;
  seed?: number;
}

export interface GameState {
  version: 1;
  boardRevision?: number;
  year: number;
  phase: GamePhase;
  players: Player[];
  lots: Lot[];
  bag: number[];
  pending: number[];
  draftCount: number;
  pendingTiles?: number[][];
  tileDraftCount?: number;
  logs: string[];
  lastIncome: number[];
  trades: number;
}

export type GameAction =
  | { type: 'START_YEAR' }
  | { type: 'DRAFT_PLOTS'; playerId: number; lotIds: number[] }
  | { type: 'DRAFT_TILES'; playerId: number; keptShopIndices: number[] }
  | { type: 'BEGIN_BUILD' }
  | { type: 'BUILD_TILE'; playerId: number; lotId: number; shopType: number }
  | { type: 'EXECUTE_TRADE'; offer: TradeOffer }
  | { type: 'COLLECT_INCOME' }
  | { type: 'NEXT_YEAR' };
