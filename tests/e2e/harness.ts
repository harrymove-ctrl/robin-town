/**
 * tests/e2e/harness.ts
 *
 * Master E2E testing harness for robin-town.
 * Supplies deterministic random sources, headless DOM and canvas mocks,
 * mock EIP-1193 Web3 providers, in-memory multiplayer clusters, game state
 * simulators, and domain invariant verifiers.
 */

import * as assert from 'node:assert/strict';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  findAllClusters,
} from '../../src/engine/board-layout';
import {
  SHOPS,
  advancePhase,
  beginBuild,
  buildTile,
  claimPlots,
  collectIncome,
  createGame,
  draftPlots,
  executeTrade,
  finishYear,
  groups,
  income,
  neighbors,
  nextYear,
  rankings,
  startYear,
} from '../../src/engine/engine';
import {
  botBuild,
  botDraft,
  evaluateTradeOffer,
} from '../../src/engine/bot';
import type {
  GameConfig,
  GamePhase,
  GameState,
  Lot,
  OfferSide,
  Player,
  RandomSource,
  TradeEvaluation,
  TradeOffer,
} from '../../src/engine/types';
import {
  BURN_ADDRESS,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  type MatchPoolResult,
  type PointSwapResult,
} from '../../src/tokenomics/flywheel';
import {
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_RPC_URL,
  WalletAdapter,
  normalizeAddress,
  hexWeiToTokens,
  tokensToHexWei,
  parseChainId,
} from '../../src/tokenomics/wallet';
import {
  MemoryTransport,
  MemoryTransportHub,
  NetworkRoom,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from '../../src/network/room';
import { RobinTownApp, type FinalSettlementResult } from '../../src/app';
import { AudioSynthesizer } from '../../src/ui/audio';
import { BoardRenderer, type Canvas2DContextLike } from '../../src/ui/board';
import { CameraController, boardToScreen, screenToBoard } from '../../src/ui/camera';
import { TradeDeskController } from '../../src/ui/trade-desk';
import {
  projectActionBarViewModel,
  projectDrawerViewModel,
  projectLogFeedViewModel,
  projectPlayerRibbonViewModel,
  projectTopBarViewModel,
} from '../../src/ui/hud';

/**
 * Creates a deterministic 32-bit Linear Congruential Generator.
 */
export function createDeterministicRng(seed = 42): RandomSource {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Options for configuring a test game instance.
 */
export interface TestGameOptions {
  seed?: number;
  startingCash?: number;
  players?: Array<{ name: string; address?: string; avatar?: string }>;
  autoStart?: boolean;
}

/**
 * Factory creating an initialized GameState.
 */
export function createTestGame(options: TestGameOptions = {}): GameState {
  const rng = createDeterministicRng(options.seed ?? 42);
  const players = options.players ?? [
    { name: 'Trader (Human)', address: '0x1000000000000000000000000000000000000000', avatar: 'avatar_0.png' },
    { name: 'Sherwood (Bot)', address: '0x2000000000000000000000000000000000000001', avatar: 'avatar_1.png' },
    { name: 'Apex (Bot)', address: '0x3000000000000000000000000000000000000002', avatar: 'avatar_3.png' },
    { name: 'Luna (Bot)', address: '0x4000000000000000000000000000000000000003', avatar: 'avatar_2.png' },
  ];

  const state = createGame(
    {
      players,
      startingCash: options.startingCash ?? 50,
      seed: options.seed ?? 42,
    },
    rng
  );

  return state;
}

/**
 * Advances the game through drafting into the trade phase.
 */
export function advanceToTradePhase(game: GameState, humanDraftLots?: number[]): void {
  assert.equal(game.phase, 'receive', 'Must be in receive phase to advance to trade');
  const needed = game.draftCount;
  const humanDraft = humanDraftLots ?? game.pending.slice(0, needed);
  assert.equal(humanDraft.length, needed, 'Human draft selection count mismatch');

  draftPlots(game, 0, humanDraft);
  assert.equal(game.phase, 'trade', 'Phase must advance to trade');
}

/**
 * Advances the game through trading into the build phase.
 */
export function advanceToBuildPhase(game: GameState): void {
  assert.equal(game.phase, 'trade', 'Must be in trade phase to advance to build');
  advancePhase(game);
  assert.equal(game.phase, 'build', 'Phase must advance to build');
}

/**
 * Advances the game through building into the income phase.
 */
export function advanceToIncomePhase(game: GameState): void {
  assert.equal(game.phase, 'build', 'Must be in build phase to advance to income');
  botBuild(game, 1);
  botBuild(game, 2);
  botBuild(game, 3);
  advancePhase(game);
  assert.equal(game.phase, 'income', 'Phase must advance to income');
}

/**
 * Collects income and advances to the next year or game end.
 */
export function advanceToNextYear(game: GameState, rng?: RandomSource): void {
  assert.equal(game.phase, 'income', 'Must be in income phase to advance to next year');
  collectIncome(game);
  nextYear(game, rng ?? createDeterministicRng(game.year * 100));
}

/**
 * Full match simulation result summary.
 */
export interface MatchSimulationResult {
  finalState: GameState;
  finalSettlement: FinalSettlementResult;
  yearSummaries: Array<{
    year: number;
    draftCount: number;
    yearIncome: number[];
    balances: number[];
  }>;
  totalTrades: number;
}

/**
 * Simulates a complete 6-year match deterministically.
 */
export function runFullMatchSimulation(options: { seed?: number } = {}): MatchSimulationResult {
  const seed = options.seed ?? 777;
  const app = new RobinTownApp(null, { isStaked: true });

  const yearSummaries: MatchSimulationResult['yearSummaries'] = [];

  for (let yr = 1; yr <= 6; yr++) {
    const state = app.getGameState();
    const currentYear = state.year;
    const currentDraftCount = state.draftCount;

    app.quickDraft();

    app.openTradeDesk(1);
    app.finishTrading();

    const ownedLots = state.lots.filter((l) => l.owner === 0 && l.shop === null);
    if (ownedLots.length > 0) {
      for (let sIdx = 0; sIdx < 6; sIdx++) {
        if (state.players[0].tiles[sIdx] > 0) {
          app.selectShopType(sIdx);
          app.buildOnLot(ownedLots[0].id);
          break;
        }
      }
    }

    const harvest = app.harvestYield();
    const balances = state.players.map((p) => p.cash);

    yearSummaries.push({
      year: currentYear,
      draftCount: currentDraftCount,
      yearIncome: [...harvest.payouts],
      balances,
    });

    if (yr < 6) {
      app.advanceToNextYear();
    }
  }

  const finalSettlement = app.getFinalSettlement();

  return {
    finalState: app.getGameState() as GameState,
    finalSettlement,
    yearSummaries,
    totalTrades: app.getGameState().trades,
  };
}

/**
 * Headless recording mock implementing Canvas2DContextLike.
 */
export class MockCanvasContext implements Canvas2DContextLike {
  public drawCalls: Array<{ type: string; args: unknown[] }> = [];
  public fillStyle: unknown = '#000000';
  public strokeStyle: unknown = '#FFFFFF';
  public lineWidth = 1;
  public font = '10px monospace';
  public textAlign = 'left';
  public textBaseline = 'top';
  public globalAlpha = 1;
  public imageSmoothingEnabled = false;

  public save(): void {
    this.drawCalls.push({ type: 'save', args: [] });
  }
  public restore(): void {
    this.drawCalls.push({ type: 'restore', args: [] });
  }
  public translate(x: number, y: number): void {
    this.drawCalls.push({ type: 'translate', args: [x, y] });
  }
  public scale(x: number, y: number): void {
    this.drawCalls.push({ type: 'scale', args: [x, y] });
  }
  public clearRect(x: number, y: number, w: number, h: number): void {
    this.drawCalls.push({ type: 'clearRect', args: [x, y, w, h] });
  }
  public fillRect(x: number, y: number, w: number, h: number): void {
    this.drawCalls.push({ type: 'fillRect', args: [x, y, w, h] });
  }
  public strokeRect(x: number, y: number, w: number, h: number): void {
    this.drawCalls.push({ type: 'strokeRect', args: [x, y, w, h] });
  }
  public fillText(text: string, x: number, y: number): void {
    this.drawCalls.push({ type: 'fillText', args: [text, x, y] });
  }
  public strokeText(text: string, x: number, y: number): void {
    this.drawCalls.push({ type: 'strokeText', args: [text, x, y] });
  }
  public beginPath(): void {
    this.drawCalls.push({ type: 'beginPath', args: [] });
  }
  public closePath(): void {
    this.drawCalls.push({ type: 'closePath', args: [] });
  }
  public arc(x: number, y: number, r: number, s: number, e: number): void {
    this.drawCalls.push({ type: 'arc', args: [x, y, r, s, e] });
  }
  public fill(): void {
    this.drawCalls.push({ type: 'fill', args: [] });
  }
  public stroke(): void {
    this.drawCalls.push({ type: 'stroke', args: [] });
  }
  public drawImage(image: unknown, dx: number, dy: number, dw?: number, dh?: number): void {
    this.drawCalls.push({ type: 'drawImage', args: [image, dx, dy, dw, dh] });
  }
  public setLineDash(segments: number[]): void {
    this.drawCalls.push({ type: 'setLineDash', args: [segments] });
  }
}

/**
 * Options for configuring a MockEip1193Provider.
 */
export interface MockEip1193Options {
  accounts?: string[];
  chainId?: string;
  balanceWei?: string;
  failOnMethod?: string;
  errorMessage?: string;
}

/**
 * Mock EIP-1193 Web3 provider supporting accounts, chain switches, and signatures.
 */
export class MockEip1193Provider {
  public accounts: string[];
  public chainId: string;
  public balanceWei: string;
  public failOnMethod: string | null;
  public errorMessage: string;
  private listeners = new Map<string, Set<Function>>();

  constructor(options: MockEip1193Options = {}) {
    this.accounts = options.accounts ?? ['0x1111111111111111111111111111111111111111'];
    this.chainId = options.chainId ?? '0xb627';
    this.balanceWei = options.balanceWei ?? '0x56bc75e2d63100000';
    this.failOnMethod = options.failOnMethod ?? null;
    this.errorMessage = options.errorMessage ?? 'Simulated RPC failure';
  }

  public async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    if (this.failOnMethod && args.method === this.failOnMethod) {
      throw new Error(this.errorMessage);
    }
    switch (args.method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [...this.accounts];
      case 'eth_chainId':
        return this.chainId;
      case 'eth_getBalance':
        return this.balanceWei;
      case 'wallet_switchEthereumChain': {
        const target = (args.params?.[0] as { chainId?: string })?.chainId;
        if (target) {
          this.chainId = target;
          this.emit('chainChanged', this.chainId);
        }
        return null;
      }
      case 'wallet_addEthereumChain': {
        const target = (args.params?.[0] as { chainId?: string })?.chainId;
        if (target) {
          this.chainId = target;
          this.emit('chainChanged', this.chainId);
        }
        return null;
      }
      case 'eth_sendTransaction':
        return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      case 'personal_sign':
        return '0x998877665544332211009988776655443322110099887766554433221100';
      default:
        return null;
    }
  }

  public on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  public removeListener(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  public emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(...args);
      }
    }
  }
}

/**
 * In-memory cluster representing a multi-client room session.
 */
export interface MultiplayerCluster {
  roomCode: string;
  host: NetworkRoom;
  peers: NetworkRoom[];
  all: NetworkRoom[];
  disconnectAll: () => void;
}

/**
 * Creates an in-memory multiplayer cluster with connected rooms.
 */
export async function createMultiplayerCluster(
  roomCode: string,
  clientCount = 4
): Promise<MultiplayerCluster> {
  const normalized = normalizeRoomCode(roomCode);
  const rooms: NetworkRoom[] = [];

  for (let i = 0; i < clientCount; i++) {
    const isHost = i === 0;
    const name = isHost ? 'Host Trader' : `Trader ${i}`;
    const transport = new MemoryTransport(normalized, `client_${i}_${Date.now()}`);
    const room = new NetworkRoom({
      roomCode: normalized,
      localPlayer: {
        name,
        address: `0x${(i + 1).toString().padStart(40, '0')}`,
        avatar: `avatar_${i}.png`,
      },
      isHost,
      transport,
    });
    rooms.push(room);
  }

  const host = rooms[0];
  await host.start();

  const peers: NetworkRoom[] = [];
  for (let i = 1; i < rooms.length; i++) {
    const peer = rooms[i];
    await peer.start();
    peers.push(peer);
  }

  return {
    roomCode: normalized,
    host,
    peers,
    all: rooms,
    disconnectAll: () => {
      for (const r of rooms) {
        r.stop();
      }
      MemoryTransportHub.clearAll();
    },
  };
}

/**
 * Polyfills lightweight DOM globals for headless UI testing.
 */
export function setupHeadlessDom(): () => void {
  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;

  const listeners = new Map<string, Set<Function>>();

  const mockWindow = {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener: (event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeEventListener: (event: string, handler: Function) => {
      listeners.get(event)?.delete(handler);
    },
  };

  (globalThis as any).window = mockWindow;

  return () => {
    (globalThis as any).window = previousWindow;
    (globalThis as any).document = previousDocument;
  };
}

/**
 * Invariant Verifier: Enforces strict conservation of all 72 board parcels.
 */
export function verifyParcelConservation(state: GameState): void {
  assert.equal(state.lots.length, 72, 'Must have exactly 72 lots');
  const seenIds = new Set<number>();

  for (let i = 0; i < state.lots.length; i++) {
    const lot = state.lots[i];
    assert.equal(lot.id, i, `Lot index ${i} must have matching id`);
    assert.ok(!seenIds.has(lot.id), `Duplicate lot id ${lot.id}`);
    seenIds.add(lot.id);

    if (lot.owner !== null) {
      assert.ok(
        lot.owner >= 0 && lot.owner < state.players.length,
        `Owner index ${lot.owner} out of bounds`
      );
    }
    if (lot.shop !== null) {
      assert.ok(lot.shop >= 0 && lot.shop <= 5, `Shop category ${lot.shop} out of bounds`);
      assert.ok(lot.owner !== null, `Occupied lot ${lot.id} must be owned`);
    }
  }
}

/**
 * Invariant Verifier: Enforces strict conservation of all 120 shop tiles.
 */
export function verifyTilePoolConservation(state: GameState): void {
  const shopTotals = [0, 0, 0, 0, 0, 0];

  for (const shop of state.bag) {
    assert.ok(shop >= 0 && shop <= 5, `Bag tile ${shop} out of bounds`);
    shopTotals[shop]++;
  }

  for (const p of state.players) {
    for (let s = 0; s < 6; s++) {
      shopTotals[s] += p.tiles[s] || 0;
    }
  }

  for (const lot of state.lots) {
    if (lot.shop !== null) {
      shopTotals[lot.shop]++;
    }
  }

  const grandTotal = shopTotals.reduce((a, b) => a + b, 0);
  assert.equal(grandTotal, 120, `Total tiles across system must equal 120, got ${grandTotal}`);

  for (let s = 0; s < 6; s++) {
    assert.equal(shopTotals[s], 20, `Shop category ${s} total must equal 20, got ${shopTotals[s]}`);
  }
}

/**
 * Invariant Verifier: Enforces currency non-negativity and balance consistency.
 */
export function verifyTokenomicsBalance(state: GameState): void {
  for (const p of state.players) {
    assert.ok(!Number.isNaN(p.cash), `Player ${p.id} cash is NaN`);
    assert.ok(p.cash >= 0, `Player ${p.id} cash cannot be negative`);
  }
}

/**
 * Invariant Verifier: Enforces valid orthogonal adjacency and cluster bounds.
 */
export function verifyAdjacencyInvariants(state: GameState): void {
  for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
    const playerGroups = groups(state, pIdx);
    for (const g of playerGroups) {
      const targetSize = SHOPS[g.shop].size;
      assert.ok(g.size >= 1, 'Group size must be at least 1');
      assert.ok(g.lots.length === g.size, 'Group lots length must equal group size');
      if (g.isComplete) {
        assert.ok(g.size >= targetSize, 'Complete group size must meet target size');
      }
    }
  }
}
