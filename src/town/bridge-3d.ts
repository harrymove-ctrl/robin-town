import { PLOT_LAYOUT } from './board-layout';
import { SHOPS, groups } from './engine';
import type { GameState as TownGameState } from './types';
import type { GameState as Engine3DGameState } from '../engine/types';

const SIM_ADDRESSES = [
  '0x1000000000000000000000000000000000000001',
  '0x2000000000000000000000000000000000000002',
  '0x3000000000000000000000000000000000000003',
  '0x4000000000000000000000000000000000000004',
];

/**
 * Maps the live Robin-Town (saigon-town) GameState into the schema expected by ThreeBoardRenderer
 * so switching to 3D City Mode renders all 72 parcels, owners, built shops, and golden completion halos.
 */
export function toEngine3DState(state: TownGameState): Engine3DGameState {
  const completedLots = new Set<number>();
  for (let p = 0; p < state.players.length; p++) {
    for (const g of groups(state, p)) {
      const target = SHOPS[g.shop]?.size ?? 99;
      if (g.size >= target) {
        for (const id of g.lots) completedLots.add(id);
      }
    }
  }

  return {
    version: 1,
    boardRevision: state.boardRevision,
    year: state.year,
    phase: state.phase,
    players: state.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      address: SIM_ADDRESSES[idx] ?? SIM_ADDRESSES[0],
      cash: p.cash,
      tiles: [...p.tiles],
      ownedLots: state.lots.filter((l) => l.owner === p.id).map((l) => l.id),
    })),
    lots: state.lots.map((l) => {
      const cell = PLOT_LAYOUT[l.id] ?? { block: Math.floor(l.id / 12), col: 0, row: 0 };
      const targetSize = l.shop !== null ? SHOPS[l.shop]?.size : undefined;
      return {
        id: l.id,
        displayId: l.id + 1,
        block: cell.block,
        col: cell.col,
        row: cell.row,
        owner: l.owner,
        shop: l.shop,
        shopSize: targetSize,
        isComplete: completedLots.has(l.id),
      };
    }),
    bag: [...state.bag],
    pending: [...state.pending],
    draftCount: state.draftCount,
    logs: [...state.logs],
    lastIncome: [...state.lastIncome],
    trades: state.trades,
  };
}
