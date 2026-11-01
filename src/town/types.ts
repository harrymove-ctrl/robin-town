export type GamePhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';

export type RandomSource = () => number;

export interface Player {
  id: number;
  name: string;
  cash: number;
  tiles: number[];
}

export interface Lot {
  id: number;
  owner: number | null;
  shop: number | null;
}

export interface Shop {
  id: string;
  name: string;
  english: string;
  code: string;
  size: number;
  color: string;
}

export interface ShopGroup {
  shop: number;
  lots: number[];
  size: number;
}

export interface OfferSide {
  cash: number;
  tiles: number[];
  lots: number[];
}

export interface TradeOffer {
  partner: number;
  give: OfferSide;
  take: OfferSide;
}

export interface TradeEvaluation {
  accepted: boolean;
  shortfall: number;
  taxAmount?: number;
}

export type MatchEntryMode = 'casual' | 'ranked';

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
  logs: string[];
  lastIncome: number[];
  trades: number;
  entryMode?: MatchEntryMode;
  matchSettled?: boolean;
}
