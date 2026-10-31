/**
 * src/app.ts
 *
 * GameApp coordinator for robin-town.
 * Orchestrates the full single-player match loop across 6 years and 5 phases
 * against Sherwood, Apex, and Luna. Wires parcel drafting, bilateral OTC trading,
 * protocol deployment, 1.20x staking yield harvest, and Year 6 final settlement.
 * Manages dual-mode wallet, multiplayer rooms, camera, board renderer, and procedural audio.
 */

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  TOTAL_LOTS,
  canBuildShop,
  findAllClusters,
  findAllPlayerClusters,
} from './engine/board-layout';
import {
  BOT_PERSONALITIES,
  botDraft,
  generateBotTradeOffer,
} from './engine/bot';
import {
  COMPLETE,
  INCOMPLETE,
  SHOPS,
  advancePhase,
  applyTrade,
  beginBuild,
  buildTile,
  claimPlots,
  collectIncome,
  createGame,
  draftPlots,
  groupIncome,
  nextYear,
  rankings,
  validateOffer,
  startYear,
} from './engine/engine';
import type { GameConfig, GamePhase, GameState, Player, TradeOffer } from './engine/types';
import {
  BURN_ADDRESS,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  type MatchPoolResult,
  type PointSwapResult,
} from './tokenomics/flywheel';
import {
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_RPC_URL,
  WalletAdapter,
  type WalletAccount,
} from './tokenomics/wallet';
import {
  BroadcastChannelTransport,
  NetworkRoom,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  type RoomState,
} from './network/room';
import { AudioSynthesizer, getAudioSynthesizer } from './ui/audio';
import { BoardRenderer, FLOATER_MS, PLAYER_COLORS, type BoardRenderState } from './ui/board';
import { CameraController } from './ui/camera';
import { ThreeBoardRenderer } from './ui/board-3d';
import {
  HudManager,
  type DrawerViewModel,
  type PlayerRibbonViewModel,
  type TopBarViewModel,
} from './ui/hud';
import { TradeDeskController, TradeDeskModal } from './ui/trade-desk';

export interface FinalSettlementResult {
  rankings: Player[];
  matchPool: MatchPoolResult;
  playerPoints: number;
  pointSwap: PointSwapResult;
}

export interface RobinTownAppConfig {
  autoStart?: boolean;
  gameConfig?: GameConfig;
  audio?: AudioSynthesizer;
  isStaked?: boolean;
}

/**
 * Main coordinator application for robin-town.
 */
export class RobinTownApp {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Domain controllers
  private state: GameState;
  private camera: CameraController;
  private boardRenderer: BoardRenderer;
  private board3d: ThreeBoardRenderer | null = null;
  private board3dKey = '';
  private board3dResizeObserver: ResizeObserver | null = null;
  private tradeDeskController: TradeDeskController;
  private tradeDeskModal: TradeDeskModal | null = null;
  private hudManager: HudManager | null = null;
  private audio: AudioSynthesizer;
  private walletAdapter: WalletAdapter;
  private networkRoom: NetworkRoom | null = null;

  // Active interaction state
  private selectedDraftLots: number[] = [];
  private selectedShopType: number | null = null;
  private selectedLotId: number | null = null;
  private hoveredLotId: number | null = null;
  private isStaked = true;
  private isWalletModalOpen = false;
  private isSettlementModalOpen = false;
  private isRulesModalOpen = false;
  private isEpochSummaryOpen = false;
  private isProposalsOpen = false;
  private incomingOffers: TradeOffer[] = [];
  private claimFlashes: { lotId: number; color: string; start: number }[] = [];
  private floaters: { lotId: number; text: string; start: number }[] = [];
  private epochSummary: { year: number; payouts: number[] } | null = null;
  private isRoomModalOpen = false;
  private roomCodeInput = '';

  // Animation frame ID
  private animFrameId: number | null = null;

  constructor(container: HTMLElement | null = null, config: RobinTownAppConfig = {}) {
    this.container = container;
    this.isStaked = config.isStaked ?? true;
    this.audio = config.audio ?? getAudioSynthesizer();
    this.walletAdapter = new WalletAdapter({ mode: 'simulation' });

    // Initialize core game state
    this.state = createGame(config.gameConfig || {
      players: [
        { name: 'You (Trader)', address: '0x1000000000000000000000000000000000000000', avatar: 'avatar_0.png' },
        { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001', avatar: 'avatar_1.png' },
        { name: 'Apex', address: '0x3000000000000000000000000000000000000002', avatar: 'avatar_3.png' },
        { name: 'Luna', address: '0x4000000000000000000000000000000000000003', avatar: 'avatar_2.png' },
      ],
      startingCash: 50,
    });

    // createGame already opens Epoch 1 (deeds and tiles)

    // Initialize camera and board renderer
    this.camera = new CameraController();
    this.boardRenderer = new BoardRenderer(this.camera);

    // Initialize TradeDeskController
    this.tradeDeskController = new TradeDeskController(this.state, {
      onAudioTrigger: (cue) => {
        if (cue === 'deal-stamp') this.audio.playDealStamp();
        else if (cue === 'coin-chime') this.audio.playCoinChime();
        else if (cue === 'error-buzzer') this.audio.playErrorBuzzer();
        else if (cue === 'click') this.audio.playClick();
      },
      onTradeExecuted: () => {
        this.renderAll();
      },
    });

    if (this.container) {
      this.mount(this.container);
    }
  }

  public getGameState(): Readonly<GameState> {
    return this.state;
  }

  public getCameraController(): CameraController {
    return this.camera;
  }

  public getBoardRenderer(): BoardRenderer {
    return this.boardRenderer;
  }

  public getTradeDeskController(): TradeDeskController {
    return this.tradeDeskController;
  }

  public getWalletAdapter(): WalletAdapter {
    return this.walletAdapter;
  }

  public getAudio(): AudioSynthesizer {
    return this.audio;
  }

  /**
   * Mounts the application inside a DOM root element.
   */
  public mount(container: HTMLElement): void {
    this.container = container;
    this.container.innerHTML = `
      <div class="robin-town-shell">
        <div id="hud-container" class="hud-container"></div>
        <div id="board-container" class="board-container">
          <canvas id="game-board-canvas" class="board-canvas pixel-art"></canvas>
        </div>
        <div id="trade-desk-container" class="trade-desk-container"></div>
        <div id="modal-overlay-container" class="modal-overlay-container"></div>
      </div>
    `;

    this.canvas = this.container.querySelector('#game-board-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.camera.attach(this.canvas);
      this.handleResize();
      window.addEventListener('resize', this.handleResize.bind(this));
    }

    // Mount HUD manager
    const hudEl = this.container.querySelector('#hud-container') as HTMLElement;
    if (hudEl) {
      this.hudManager = new HudManager(hudEl, {
        onActionClick: (actionId) => this.handleActionClick(actionId),
        onTileSelect: (shopType) => this.selectShopType(shopType),
        onDraftToggle: (lotId) => this.toggleDraftLot(lotId),
        onWalletClick: () => this.openWalletModal(),
        onRulesClick: () => this.openRulesModal(),
        onPlayerClick: (playerId) => {
          if (this.state.phase === 'trade' && playerId !== 0) this.openTradeDesk(playerId);
        },
        onDeedHover: (lotId) => {
          this.hoveredLotId = lotId;
        },
        onLobbyClick: () => this.openRoomModal(),
        onAudioToggle: () => {
          this.audio.toggleMute();
          this.renderAll();
        },
      });
    }

    // Mount Trade Desk modal
    const tradeEl = this.container.querySelector('#trade-desk-container') as HTMLElement;
    if (tradeEl) {
      this.tradeDeskModal = new TradeDeskModal(tradeEl, this.tradeDeskController);
    }

    this.bindCanvasInteraction();
    this.bindKeyboardShortcuts();
    if (new URLSearchParams(window.location.search).get('view') === '3d') {
      this.setBoard3dEnabled(true);
    }
    this.preloadAssets();
    this.startRenderLoop();
    this.renderAll();
  }

  private handleResize(): void {
    if (!this.canvas || !this.container) return;
    const boardBox = this.container.querySelector('#board-container') as HTMLElement;
    const w = boardBox ? boardBox.clientWidth : window.innerWidth;
    const h = boardBox ? boardBox.clientHeight : window.innerHeight;
    this.camera.setViewport(w, h);
    this.boardRenderer.resizeCanvas(this.canvas, { width: w, height: h });
    this.board3d?.resize(w, h);
  }

  /**
   * Switches between the default 2D canvas board and the Three.js diorama board.
   * Falls back to 2D when WebGL is unavailable.
   */
  public setBoard3dEnabled(enabled: boolean): void {
    const boardBox = this.container?.querySelector('#board-container') as HTMLElement | null;
    if (!boardBox || !this.canvas) return;

    if (!enabled) {
      this.removeDioramaHook();
      this.board3dResizeObserver?.disconnect();
      this.board3dResizeObserver = null;
      this.board3d?.unmount();
      this.board3d = null;
      this.canvas.style.visibility = '';
      return;
    }
    if (this.board3d) return;

    const renderer = new ThreeBoardRenderer({
      container: boardBox,
      width: boardBox.clientWidth || window.innerWidth,
      height: boardBox.clientHeight || window.innerHeight,
      onSelectLot: (lotId) => this.handleLotClick(lotId),
      onHoverLot: (lotId) => {
        this.hoveredLotId = lotId;
        this.board3dKey = '';
      },
    });
    renderer.mount();
    if (!renderer.getActiveCamera() || !boardBox.querySelector('canvas:not(#game-board-canvas)')) {
      return; // WebGL unavailable: keep the 2D board
    }
    this.board3d = renderer;
    this.board3dKey = '';
    // The HUD changes height per phase, so track the board container, not just the window.
    if (typeof ResizeObserver !== 'undefined') {
      this.board3dResizeObserver = new ResizeObserver(() => this.handleResize());
      this.board3dResizeObserver.observe(boardBox);
    }
    this.canvas.style.visibility = 'hidden';
    this.installDioramaHook(renderer);
  }

  /**
   * Exposes the deterministic QA handle the diorama kit scripts (shoot, audit,
   * frames) expect: window.__diorama = { freeze(t), getState(), renderAt(t) }
   * and window.__dioramaReady once the first frame is up.
   */
  private installDioramaHook(renderer: ThreeBoardRenderer): void {
    if (typeof window === 'undefined') return;
    const target = window as unknown as {
      __diorama?: {
        freeze(t: number): void;
        renderAt(t: number): void;
        getState(): unknown;
        projectLot(lotId: number): { x: number; y: number } | null;
      };
      __dioramaReady?: boolean;
    };
    target.__diorama = {
      freeze: (t: number) => renderer.freeze(t),
      renderAt: (t: number) => renderer.renderAt(t),
      getState: () => renderer.getDioramaState(),
      projectLot: (lotId: number) => renderer.projectLotToNdc(lotId),
    };
    // The first board.render() runs on the next render-loop frame; mark ready after it.
    target.__dioramaReady = false;
    const markReady = () => {
      if (this.board3d === renderer) target.__dioramaReady = true;
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(markReady));
    } else {
      markReady();
    }
  }

  private removeDioramaHook(): void {
    if (typeof window === 'undefined') return;
    const target = window as unknown as { __diorama?: unknown; __dioramaReady?: boolean };
    delete target.__diorama;
    target.__dioramaReady = false;
  }

  private preloadAssets(): void {
    const assets: [string, string][] = [
      ['board_map', 'assets/board/board_map.png'],
      ['shop_0', 'assets/shops/shop_0.png'],
      ['shop_1', 'assets/shops/shop_1.png'],
      ['shop_2', 'assets/shops/shop_2.png'],
      ['shop_3', 'assets/shops/shop_3.png'],
      ['shop_4', 'assets/shops/shop_4.png'],
      ['shop_5', 'assets/shops/shop_5.png'],
      ['token_0', 'assets/tokens/token_0.png'],
      ['token_1', 'assets/tokens/token_1.png'],
      ['token_2', 'assets/tokens/token_2.png'],
      ['token_3', 'assets/tokens/token_3.png'],
    ];

    for (const [key, path] of assets) {
      this.boardRenderer.loadAsset(key, path).catch(() => {
        // Fallback to procedural drawing if asset fails
      });
    }
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.camera.update();
      this.drawBoard();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.camera.detach();
    this.tradeDeskModal?.destroy();
  }

  private drawBoard(): void {
    if (!this.ctx || !this.canvas) return;
    const vp = this.camera.getViewport();

    // Determine valid and invalid build target lots if a shop is selected
    const validLots: number[] = [];
    const invalidLots: number[] = [];

    if (this.state.phase === 'build' && this.selectedShopType !== null) {
      for (let i = 0; i < TOTAL_LOTS; i++) {
        const lot = this.state.lots[i];
        if (lot.owner === 0 && lot.shop === null) {
          const res = canBuildShop(this.state.lots, i, 0, this.selectedShopType);
          if (res.valid) {
            validLots.push(i);
          } else {
            invalidLots.push(i);
          }
        }
      }
    }

    const renderState: BoardRenderState = {
      gameState: this.state,
      selectedLotId: this.selectedLotId,
      hoveredLotId: this.hoveredLotId,
      validBuildLots: validLots,
      invalidBuildLots: invalidLots,
      activePlayerId: 0,
      selectedShopType: this.selectedShopType,
      now: performance.now(),
      pendingLots: this.state.phase === 'receive' ? this.state.pending ?? [] : [],
      draftLots: this.selectedDraftLots,
      buildPreview: this.computeBuildPreview(validLots),
      floaters: this.floaters,
      claimFlashes: this.claimFlashes,
    };

    if (this.board3d) {
      const lots = this.state.lots;
      const key = [
        this.state.phase,
        this.selectedLotId,
        this.hoveredLotId,
        this.selectedDraftLots.join(','),
        validLots.join(','),
        lots.map((l) => `${l.owner ?? '-'}${l.shop ?? '-'}`).join(''),
        (this.state.pending ?? []).join(','),
      ].join('|');
      if (key !== this.board3dKey) {
        this.board3dKey = key;
        this.board3d.render(this.state, this.selectedLotId, {
          pendingLots: this.state.phase === 'receive' ? this.state.pending ?? [] : [],
          draftLots: this.selectedDraftLots,
          validBuildLots: validLots,
        });
      }
      return;
    }

    this.boardRenderer.render(this.ctx, vp, renderState);
  }

  /** Projected cluster size and yield for the hovered build target. */
  private computeBuildPreview(validLots: number[]): BoardRenderState['buildPreview'] {
    const lotId = this.hoveredLotId;
    if (lotId === null || this.selectedShopType === null || !validLots.includes(lotId)) return null;
    const res = canBuildShop(this.state.lots, lotId, 0, this.selectedShopType);
    if (!res.valid || res.resultingClusterSize === undefined) return null;
    const target = SHOPS[this.selectedShopType].size;
    const size = res.resultingClusterSize;
    const before = size - 1;
    const gain = groupIncome(this.selectedShopType, size) - groupIncome(this.selectedShopType, before);
    const sign = gain >= 0 ? '+' : '';
    return {
      lotId,
      complete: !!res.isComplete,
      text: `${before}/${target} -> ${size}/${target}${res.isComplete ? ' COMPLETE!' : ''} ${sign}${gain} $wif/yr`,
    };
  }

  private renderAll(): void {
    if (!this.container) return;
    const walletState = this.walletAdapter.getState();
    const balance = walletState.account?.balance ?? 0;
    const walletLabel =
      walletState.mode === 'simulation'
        ? `Sim: ${balance.toLocaleString()} $wif`
        : `Chain: ${balance.toLocaleString()} $wif`;

    this.hudManager?.render(
      this.state,
      this.selectedDraftLots,
      this.selectedShopType,
      walletLabel,
      this.audio.isMuted()
    );

    this.tradeDeskModal?.render();
    this.renderModalOverlays();
  }

  private bindCanvasInteraction(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.board3d) return;
      const rect = this.canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const lotId = this.camera.hitTest(sx, sy);
      if (lotId !== this.hoveredLotId) {
        this.hoveredLotId = lotId;
        this.container?.querySelectorAll('.deed-card').forEach((el) => {
          const card = el as HTMLElement;
          card.classList.toggle('spotlight', lotId !== null && card.dataset.draftLot === String(lotId));
        });
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const lotId = this.camera.hitTest(sx, sy);
      if (lotId !== null) {
        this.handleLotClick(lotId);
      }
    });
  }

  private handleLotClick(lotId: number): void {
    this.selectedLotId = lotId;

    if (this.state.phase === 'receive') {
      if (this.state.pending && this.state.pending.includes(lotId)) {
        this.toggleDraftLot(lotId);
      }
    } else if (this.state.phase === 'build') {
      if (this.selectedShopType !== null) {
        this.buildOnLot(lotId);
      }
    } else if (this.state.phase === 'trade') {
      const lot = this.state.lots[lotId];
      if (lot && lot.owner !== null && lot.owner !== 0) {
        this.openTradeDesk(lot.owner);
      }
    }

    this.renderAll();
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (this.isWalletModalOpen || this.isSettlementModalOpen || this.isRoomModalOpen || this.isRulesModalOpen || this.isEpochSummaryOpen || this.isProposalsOpen) {
        if (e.key === 'Escape') {
          this.closeModals();
        }
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        this.setBoard3dEnabled(!this.board3d);
      } else if (e.key === 't' || e.key === 'T') {
        if (this.state.phase === 'trade') {
          this.openTradeDesk();
        }
      } else if (e.key === 'q' || e.key === 'Q') {
        if (this.state.phase === 'receive') {
          this.quickDraft();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        this.handleSpaceKey();
      } else if (e.key === 'Escape') {
        this.selectedShopType = null;
        this.selectedLotId = null;
        this.renderAll();
      }
    });
  }

  private handleSpaceKey(): void {
    if (this.state.phase === 'trade') {
      this.finishTrading();
    } else if (this.state.phase === 'build') {
      this.harvestYield();
    } else if (this.state.phase === 'income') {
      this.advanceToNextYear();
    }
  }

  public handleActionClick(actionId: string): void {
    switch (actionId) {
      case 'confirm-draft':
        this.confirmDraft(this.selectedDraftLots);
        break;
      case 'quick-draft':
        this.quickDraft();
        break;
      case 'open-trade-desk':
        this.openTradeDesk();
        break;
      case 'finish-trading':
        this.finishTrading();
        break;
      case 'finish-building':
        this.harvestYield();
        break;
      case 'cancel-shop-selection':
        this.selectedShopType = null;
        this.renderAll();
        break;
      case 'next-epoch':
        this.advanceToNextYear();
        break;
      case 'view-final-settlement':
        this.openSettlementModal();
        break;
      case 'play-again':
        this.startNewGame();
        break;
      case 'swap-points':
        this.swapPointsForWif(this.calculatePlayerPoints(0));
        break;
    }
  }

  // Phase 1: Allocation drafting
  public toggleDraftLot(lotId: number): void {
    if (this.state.phase !== 'receive') return;
    const idx = this.selectedDraftLots.indexOf(lotId);
    if (idx >= 0) {
      this.selectedDraftLots.splice(idx, 1);
      this.audio.playClick();
    } else {
      if (this.selectedDraftLots.length < this.state.draftCount) {
        this.selectedDraftLots.push(lotId);
        this.audio.playTilePop();
      } else {
        this.audio.playErrorBuzzer();
      }
    }
    this.renderAll();
  }

  public confirmDraft(lotIds: number[]): boolean {
    if (this.state.phase !== 'receive') return false;
    if (lotIds.length !== this.state.draftCount) {
      this.audio.playErrorBuzzer();
      return false;
    }

    try {
      const dealt = [...(this.state.pending ?? [])];
      draftPlots(this.state, 0, lotIds);
      const start = performance.now();
      this.claimFlashes = dealt
        .filter((id) => this.state.lots[id].owner !== null)
        .map((id) => ({
          lotId: id,
          color: PLAYER_COLORS[this.state.lots[id].owner as number] ?? '#FFFFFF',
          start,
        }));
      this.selectedDraftLots = [];
      this.incomingOffers = this.collectBotProposals();
      this.isProposalsOpen = this.incomingOffers.length > 0;
      this.tradeDeskController.updateGameState(this.state);
      this.audio.playPhaseFanfare();
      this.renderAll();
      return true;
    } catch {
      this.audio.playErrorBuzzer();
      return false;
    }
  }

  public quickDraft(): number[] {
    if (this.state.phase !== 'receive') return [];
    // Automated heuristic draft for player 0
    const pending = [...(this.state.pending || [])];
    const keepCount = this.state.draftCount;

    // Sort pending parcels by heuristic score
    const bestLots = pending.slice(0, keepCount);
    this.selectedDraftLots = bestLots;
    this.confirmDraft(bestLots);
    return bestLots;
  }

  // Phase 2: OTC Liquidity Desk
  public openTradeDesk(partnerId?: number): void {
    if (this.state.phase !== 'trade') return;
    this.tradeDeskController.open(partnerId);
    this.tradeDeskModal?.render();
  }

  public finishTrading(): void {
    if (this.state.phase !== 'trade') return;
    this.tradeDeskController.close();
    advancePhase(this.state);
    this.audio.playPhaseFanfare();
    this.renderAll();
  }

  // Phase 3: Protocol shop deployment
  public selectShopType(shopType: number | null): void {
    this.selectedShopType = shopType;
    this.audio.playClick();
    this.renderAll();
  }

  public buildOnLot(lotId: number): boolean {
    if (this.state.phase !== 'build' || this.selectedShopType === null) return false;
    const val = canBuildShop(this.state.lots, lotId, 0, this.selectedShopType);
    if (!val.valid) {
      this.audio.playErrorBuzzer();
      return false;
    }

    try {
      buildTile(this.state, 0, lotId, this.selectedShopType);
      this.audio.playTilePop();
      this.renderAll();
      return true;
    } catch {
      this.audio.playErrorBuzzer();
      return false;
    }
  }

  // Phase 4: Yield harvest
  public harvestYield(): { totalHarvest: number; payouts: number[] } {
    if (this.state.phase !== 'build') {
      return { totalHarvest: 0, payouts: [] };
    }

    const incomeResult = collectIncome(this.state);
    let playerHarvest = incomeResult.payouts[0] || 0;

    // Apply seasonal 1.20x staking yield multiplier
    if (this.isStaked && playerHarvest > 0) {
      const boosted = calculateStakingBoost(playerHarvest, true);
      const bonus = boosted - playerHarvest;
      this.state.players[0].cash += bonus;
      playerHarvest = boosted;
    }

    this.audio.playCoinChime();
    this.raiseYieldFloaters();
    if ((this.state.phase as GamePhase) === 'income') {
      const payouts = [...incomeResult.payouts];
      payouts[0] = playerHarvest;
      this.epochSummary = { year: this.state.year, payouts };
      // Let the yield badges play over the board before the summary card covers it.
      setTimeout(() => {
        if ((this.state.phase as GamePhase) === 'income') {
          this.isEpochSummaryOpen = true;
          this.renderAll();
        }
      }, FLOATER_MS + 300);
    }
    this.renderAll();

    const currentPhase = this.state.phase as GamePhase;
    if (currentPhase === 'ended') {
      this.audio.playGameOverFanfare();
      this.openSettlementModal();
    }

    return {
      totalHarvest: playerHarvest,
      payouts: incomeResult.payouts,
    };
  }

  /** Floats a +XX $wif badge above each of the player's clusters, noting the staking boost. */
  private raiseYieldFloaters(): void {
    const start = performance.now();
    this.floaters = findAllPlayerClusters(this.state.lots, 0).map((cluster, i) => {
      const boosted = this.isStaked ? calculateStakingBoost(cluster.annualIncome, true) : cluster.annualIncome;
      const suffix = this.isStaked && boosted !== cluster.annualIncome ? ` (${cluster.annualIncome} x1.20)` : '';
      return { lotId: cluster.lots[0], text: `+${boosted} $wif${suffix}`, start: start + i * 250 };
    });
  }

  /** Picks up to two valid, bot-initiated offers for the player's parcels. */
  private collectBotProposals(): TradeOffer[] {
    const offers: TradeOffer[] = [];
    for (let botId = 1; botId < 4 && offers.length < 2; botId++) {
      const raw = generateBotTradeOffer(botId, 0, this.state);
      if (!raw) continue;
      // Re-express as the player's trade: they give the parcel, the bot gives cash.
      const offer: TradeOffer = {
        fromPlayer: 0,
        toPlayer: botId,
        partner: botId,
        give: raw.take,
        take: raw.give,
      };
      try {
        if (validateOffer(this.state, offer)) offers.push(offer);
      } catch {
        // Stale or unaffordable proposal: skip it.
      }
    }
    return offers;
  }

  public acceptProposal(index: number): boolean {
    const offer = this.incomingOffers[index];
    let valid = false;
    try {
      valid = !!offer && this.state.phase === 'trade' && validateOffer(this.state, offer);
    } catch {
      valid = false;
    }
    if (!offer || !valid) {
      this.audio.playErrorBuzzer();
      return false;
    }
    applyTrade(this.state, offer);
    this.incomingOffers.splice(index, 1);
    this.isProposalsOpen = this.incomingOffers.length > 0;
    this.tradeDeskController.updateGameState(this.state);
    this.audio.playCoinChime();
    this.renderAll();
    return true;
  }

  public counterProposal(index: number): void {
    const offer = this.incomingOffers[index];
    if (!offer) return;
    this.incomingOffers.splice(index, 1);
    this.isProposalsOpen = false;
    this.openTradeDesk(offer.toPlayer);
    this.renderAll();
  }

  public dismissProposal(index: number): void {
    this.incomingOffers.splice(index, 1);
    this.isProposalsOpen = this.incomingOffers.length > 0;
    this.renderAll();
  }

  // Phase 5: Advance to next year or final settlement
  public advanceToNextYear(): void {
    if (this.state.phase === 'ended') {
      this.openSettlementModal();
      return;
    }
    if (this.state.phase !== 'income') return;

    if (this.state.year >= 6) {
      this.state.phase = 'ended';
      this.audio.playGameOverFanfare();
      this.openSettlementModal();
    } else {
      nextYear(this.state);
      this.audio.playYearFanfare();
      this.tradeDeskController.updateGameState(this.state);
    }

    this.selectedDraftLots = [];
    this.selectedShopType = null;
    this.renderAll();
  }

  public calculatePlayerPoints(playerId = 0): number {
    const p = this.state.players[playerId];
    if (!p) return 0;
    const placedShops = this.state.lots.filter((l) => l.owner === playerId && l.shop !== null).length;
    const completeClusters = findAllClusters(this.state.lots).filter(
      (c) => c.playerId === playerId && c.isComplete
    ).length;
    return p.cash + placedShops * 50 + completeClusters * 100;
  }

  public getFinalSettlement(): FinalSettlementResult {
    const finalRankings = rankings(this.state);
    const pool = calculateMatchPayouts(1000, finalRankings.map((p) => p.id));
    const points = this.calculatePlayerPoints(0);
    const swap = calculatePointSwap(points, 0.10, 0.03);

    return {
      rankings: finalRankings,
      matchPool: pool,
      playerPoints: points,
      pointSwap: swap,
    };
  }

  public swapPointsForWif(points: number): PointSwapResult {
    const res = calculatePointSwap(points, 0.10, 0.03);
    this.audio.playCoinChime();
    return res;
  }

  public startNewGame(config?: GameConfig): void {
    this.state = createGame(config || {
      players: [
        { name: 'You (Trader)', address: '0x1000000000000000000000000000000000000000', avatar: 'avatar_0.png' },
        { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001', avatar: 'avatar_1.png' },
        { name: 'Apex', address: '0x3000000000000000000000000000000000000002', avatar: 'avatar_3.png' },
        { name: 'Luna', address: '0x4000000000000000000000000000000000000003', avatar: 'avatar_2.png' },
      ],
      startingCash: 50,
    });
    this.selectedDraftLots = [];
    this.selectedShopType = null;
    this.selectedLotId = null;
    this.closeModals();
    this.tradeDeskController.updateGameState(this.state);
    this.audio.playPhaseFanfare();
    this.renderAll();
  }

  // Modals management
  public openWalletModal(): void {
    this.isWalletModalOpen = true;
    this.renderAll();
  }

  public openSettlementModal(): void {
    this.isSettlementModalOpen = true;
    this.renderAll();
  }

  public openRulesModal(): void {
    this.isRulesModalOpen = true;
    this.renderAll();
  }

  public openRoomModal(): void {
    this.isRoomModalOpen = true;
    this.renderAll();
  }

  public closeModals(): void {
    this.isWalletModalOpen = false;
    this.isSettlementModalOpen = false;
    this.isRoomModalOpen = false;
    this.isRulesModalOpen = false;
    this.isEpochSummaryOpen = false;
    this.isProposalsOpen = false;
    this.renderAll();
  }

  private renderModalOverlays(): void {
    if (!this.container) return;
    const modalEl = this.container.querySelector('#modal-overlay-container') as HTMLElement;
    if (!modalEl) return;

    if (this.isWalletModalOpen) {
      modalEl.innerHTML = this.renderWalletModalHTML();
      this.bindWalletModalEvents(modalEl);
    } else if (this.isSettlementModalOpen) {
      modalEl.innerHTML = this.renderSettlementModalHTML();
      this.bindSettlementModalEvents(modalEl);
    } else if (this.isProposalsOpen) {
      modalEl.innerHTML = this.renderProposalsModalHTML();
      modalEl.addEventListener('click', this.handleProposalClick);
    } else if (this.isEpochSummaryOpen) {
      modalEl.innerHTML = this.renderEpochSummaryHTML();
      modalEl.querySelector('[data-action="epoch-continue"]')?.addEventListener('click', () => {
        this.isEpochSummaryOpen = false;
        this.advanceToNextYear();
      });
      modalEl.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', () => this.closeModals()));
    } else if (this.isRulesModalOpen) {
      modalEl.innerHTML = this.renderRulesModalHTML();
      modalEl.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', () => this.closeModals()));
    } else if (this.isRoomModalOpen) {
      modalEl.innerHTML = this.renderRoomModalHTML();
      this.bindRoomModalEvents(modalEl);
    } else {
      modalEl.innerHTML = '';
    }
  }

  private renderWalletModalHTML(): string {
    const walletState = this.walletAdapter.getState();
    const isSim = walletState.mode === 'simulation';
    const activeAddr = walletState.account?.address || '';
    const balance = walletState.account?.balance ?? 0;

    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog wallet-modal">
        <header class="modal-header">
          <h3>Dual-Mode Wallet Configuration</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </header>
        <div class="modal-tabs">
          <button class="tab-btn ${isSim ? 'active' : ''}" data-wallet-mode="simulation">
            Off-Chain Simulation
          </button>
          <button class="tab-btn ${!isSim ? 'active' : ''}" data-wallet-mode="web3">
            Robinhood Chain Testnet
          </button>
        </div>
        <div class="modal-body">
          ${isSim ? `
            <p class="tab-desc">Instant deterministic accounts with pre-funded 10,000 $wif balances for zero-friction gameplay.</p>
            <div class="accounts-list">
              ${DEFAULT_SIMULATED_ACCOUNTS.map((acc) => `
                <label class="account-row ${acc.address.toLowerCase() === activeAddr.toLowerCase() ? 'selected' : ''}">
                  <input type="radio" name="sim-account" value="${acc.address}" ${acc.address.toLowerCase() === activeAddr.toLowerCase() ? 'checked' : ''} />
                  <span class="account-name">${acc.name}</span>
                  <span class="account-addr">${acc.address.slice(0, 8)}...</span>
                  <span class="account-bal">${acc.balance.toLocaleString()} $wif</span>
                </label>
              `).join('')}
            </div>
            <button class="btn-secondary btn-reset-sim" data-action="reset-sim">Reset Simulation Balances</button>
          ` : `
            <p class="tab-desc">Connect directly to Robinhood Chain Testnet (Chain ID ${ROBINHOOD_CHAIN_ID}).</p>
            <div class="web3-details-box">
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value text-green">${walletState.status.toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span class="label">RPC URL:</span>
                <span class="value">${ROBINHOOD_RPC_URL}</span>
              </div>
              <div class="detail-row">
                <span class="label">Address:</span>
                <span class="value">${activeAddr || 'Not connected'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Balance:</span>
                <span class="value">${balance.toLocaleString()} $wif</span>
              </div>
            </div>
            <button class="btn-primary btn-connect-web3" data-action="connect-web3">Connect Web3 Wallet</button>
          `}
        </div>
      </div>
    `;
  }

  private bindWalletModalEvents(modalEl: HTMLElement): void {
    modalEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-modal-close], [data-wallet-mode], [data-action]') as HTMLElement | null;
      if (!target) return;

      if (target.dataset.modalClose) {
        this.closeModals();
      } else if (target.dataset.walletMode) {
        this.walletAdapter.setMode(target.dataset.walletMode as 'simulation' | 'web3');
        this.renderAll();
      } else if (target.dataset.action === 'reset-sim') {
        this.walletAdapter.resetSimulation();
        this.renderAll();
      } else if (target.dataset.action === 'connect-web3') {
        this.walletAdapter.connect().then(() => this.renderAll());
      }
    });

    modalEl.addEventListener('change', (e) => {
      const radio = e.target as HTMLInputElement;
      if (radio.name === 'sim-account') {
        this.walletAdapter.switchAccount(radio.value);
        this.renderAll();
      }
    });
  }

  private renderSettlementModalHTML(): string {
    const settlement = this.getFinalSettlement();
    const winner = settlement.rankings[0];

    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog settlement-modal">
        <header class="modal-header">
          <h3>Final Epoch Settlement (Epoch 6)</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </header>
        <div class="modal-body">
          <div class="winner-crown-box">
            <span class="crown-icon">👑</span>
            <h4>Sovereign Winner: ${winner.name}</h4>
            <span class="winner-cash">Final Liquid Cash: ${winner.cash.toLocaleString()} $wif</span>
          </div>

          <!-- Podium Purse Distribution -->
          <div class="podium-breakdown-card">
            <h4>4,000 $wif Match Pool Sinks and Podium Purse</h4>
            <div class="purse-metrics">
              <div class="metric-row">
                <span>5% Permanent Burn:</span>
                <span class="text-accent">${settlement.matchPool.burnedAmount} $wif (to 0x...dEaD)</span>
              </div>
              <div class="metric-row">
                <span>5% Community Vault:</span>
                <span class="text-purple">${settlement.matchPool.vaultAmount} $wif</span>
              </div>
              <div class="metric-row">
                <span>90% Prize Purse:</span>
                <span class="text-green">${settlement.matchPool.purseAmount} $wif</span>
              </div>
            </div>
            <div class="podium-ranks">
              ${settlement.matchPool.podium.map((p) => `
                <div class="rank-item rank-${p.rank}">
                  <span class="rank-num">#${p.rank}</span>
                  <span class="rank-share">${p.percentage * 100}%</span>
                  <span class="rank-amount">${p.payout} $wif</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Casual Performance Point Swap -->
          <div class="point-swap-card">
            <h4>Casual Score Point-to-$wif Swap (10:1 Ratio with 3% Burn)</h4>
            <div class="swap-metrics">
              <div class="metric-row">
                <span>Performance Score:</span>
                <span>${settlement.playerPoints} points</span>
              </div>
              <div class="metric-row">
                <span>Gross Swap:</span>
                <span>${settlement.pointSwap.grossWif} $wif</span>
              </div>
              <div class="metric-row">
                <span>3% Burn Tax:</span>
                <span class="text-accent">-${settlement.pointSwap.burnedWif} $wif</span>
              </div>
              <div class="metric-row">
                <span>Net Token Payout:</span>
                <span class="text-green font-bold">+${settlement.pointSwap.netWif} $wif</span>
              </div>
            </div>
          </div>

          <div class="settlement-actions">
            <button class="btn-primary" data-action="new-match">Start Fresh Match</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindSettlementModalEvents(modalEl: HTMLElement): void {
    modalEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-modal-close], [data-action]') as HTMLElement | null;
      if (!target) return;

      if (target.dataset.modalClose) {
        this.closeModals();
      } else if (target.dataset.action === 'new-match') {
        this.startNewGame();
      }
    });
  }

  private handleProposalClick = (e: Event): void => {
    const target = (e.target as HTMLElement).closest('[data-proposal-action], [data-modal-close]') as HTMLElement | null;
    if (!target) return;
    const modalEl = e.currentTarget as HTMLElement;
    modalEl.removeEventListener('click', this.handleProposalClick);
    if (target.dataset.modalClose) {
      this.closeModals();
      return;
    }
    const index = parseInt(target.dataset.proposalIndex as string, 10);
    if (target.dataset.proposalAction === 'accept') this.acceptProposal(index);
    else if (target.dataset.proposalAction === 'counter') this.counterProposal(index);
    else this.dismissProposal(index);
  };

  private renderProposalsModalHTML(): string {
    const rows = this.incomingOffers.map((offer, i) => {
      const bot = this.state.players[offer.toPlayer ?? 1];
      const lots = offer.give.lots.map((id) => `Parcel ${id + 1}`).join(', ') || 'no parcels';
      return `
        <div class="proposal-row">
          <p><strong>${bot.name}</strong> offers <strong>${offer.take.cash} $wif</strong> for your ${lots}.</p>
          <button class="btn-primary" data-proposal-action="accept" data-proposal-index="${i}">Accept</button>
          <button class="btn-secondary" data-proposal-action="counter" data-proposal-index="${i}">Counter</button>
          <button class="btn-secondary" data-proposal-action="dismiss" data-proposal-index="${i}">Dismiss</button>
        </div>`;
    }).join('');
    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog proposals-modal">
        <div class="modal-header">
          <h3>Incoming Trade Proposals</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </div>
        <div class="modal-body">${rows}</div>
      </div>
    `;
  }

  private renderEpochSummaryHTML(): string {
    const summary = this.epochSummary;
    const rows = this.state.players.map((p) => `
      <tr><td>${p.name}</td><td class="text-green">+${summary?.payouts[p.id] ?? 0}</td><td>${p.cash.toLocaleString()}</td></tr>`).join('');
    const nextEpoch = (summary?.year ?? this.state.year) + 1;
    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog epoch-summary-modal">
        <div class="modal-header">
          <h3>Epoch ${summary?.year ?? this.state.year} Summary</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </div>
        <div class="modal-body">
          <table class="payout-table">
            <thead><tr><th>Trader</th><th>Yield</th><th>Balance ($wif)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <button class="btn-primary" data-action="epoch-continue">Continue to Epoch ${nextEpoch}</button>
        </div>
      </div>
    `;
  }

  private renderRulesModalHTML(): string {
    const phases = [
      ['Allocation', 'Pick deeds from the candidate pool to claim city parcels.'],
      ['OTC Desk', 'Trade $wif, tiles and parcels one-to-one with the AI traders.'],
      ['Deployment', 'Place protocol tiles on your empty parcels; touching tiles of one type form a cluster.'],
      ['Yield Harvest', 'Each cluster pays out $wif; completed clusters pay far more.'],
      ['Epoch Transition', 'Repeat for 6 epochs, then final settlement.'],
    ];
    const payoutRows = SHOPS.map((shop) => `
      <tr>
        <td>${shop.name}</td>
        <td>${shop.size}</td>
        <td>${INCOMPLETE[shop.size - 1]}</td>
        <td class="text-green">${COMPLETE[shop.size]}</td>
      </tr>`).join('');
    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog rules-modal">
        <div class="modal-header">
          <h3>Rules &amp; Payouts</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </div>
        <div class="modal-body">
          <ol class="rules-phases">
            ${phases.map(([name, text]) => `<li><strong>${name}:</strong> ${text}</li>`).join('')}
          </ol>
          <table class="payout-table">
            <thead><tr><th>Protocol</th><th>Size</th><th>Incomplete (size-1)</th><th>COMPLETE</th></tr></thead>
            <tbody>${payoutRows}</tbody>
          </table>
          <p>Partial clusters pay ${INCOMPLETE.slice(1).join(' / ')} $wif for 1 to 5 tiles. A completed cluster cannot be expanded.</p>
          <p>$wif flywheel: settlement converts points to $wif and 3% is burned, so supply shrinks as more matches finish.</p>
        </div>
      </div>
    `;
  }

  private renderRoomModalHTML(): string {
    const roomState = this.networkRoom?.state;

    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog room-modal">
        <header class="modal-header">
          <h3>Multiplayer Matchmaker (BroadcastChannel)</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </header>
        <div class="modal-body">
          ${!this.networkRoom ? `
            <div class="room-setup-options">
              <div class="setup-option">
                <h4>Host New Room</h4>
                <p>Create a 4-seat lobby with shareable 6-character room code.</p>
                <button class="btn-primary" data-action="create-room">Create Room</button>
              </div>
              <div class="setup-option">
                <h4>Join Existing Room</h4>
                <div class="room-code-input-row">
                  <input
                    type="text"
                    id="room-code-field"
                    placeholder="6-CHAR CODE"
                    maxlength="6"
                    value="${this.roomCodeInput}"
                  />
                  <button class="btn-secondary" data-action="join-room">Join</button>
                </div>
              </div>
            </div>
          ` : `
            <div class="room-lobby-view">
              <div class="lobby-code-badge">
                <span>ROOM CODE:</span>
                <strong>${roomState?.code}</strong>
              </div>
              <div class="lobby-seats-grid">
                ${[0, 1, 2, 3].map((seatIdx) => {
                  const occupant = roomState?.players.find((p) => p.seat === seatIdx && p.connected);
                  return `
                    <div class="seat-card ${occupant ? 'occupied' : 'empty'}">
                      <span class="seat-label">Seat ${seatIdx + 1}</span>
                      ${occupant ? `
                        <span class="occupant-name">${occupant.name}</span>
                        <span class="ready-badge ${occupant.isReady ? 'ready' : ''}">
                          ${occupant.isReady ? 'READY' : 'WAITING'}
                        </span>
                      ` : `
                        <span class="ai-autofill-badge">AI Bot Autofill</span>
                      `}
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="lobby-actions">
                <button class="btn-secondary" data-action="leave-room">Leave Room</button>
                <button class="btn-secondary" data-action="toggle-ready">Toggle Ready</button>
                ${this.networkRoom.isLocalHost() ? `
                  <button class="btn-primary" data-action="start-room-match">Launch Match (Autofill Bots)</button>
                ` : ''}
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  private bindRoomModalEvents(modalEl: HTMLElement): void {
    modalEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-modal-close], [data-action]') as HTMLElement | null;
      if (!target) return;

      if (target.dataset.modalClose) {
        this.closeModals();
      } else if (target.dataset.action === 'create-room') {
        const code = generateRoomCode();
        this.networkRoom = new NetworkRoom({
          roomCode: code,
          localPlayer: {
            name: 'You (Host)',
            address: '0x1000000000000000000000000000000000000000',
            avatar: 'avatar_0.png',
          },
          isHost: true,
        });
        void this.networkRoom.start();
        this.renderAll();
      } else if (target.dataset.action === 'join-room') {
        const input = modalEl.querySelector('#room-code-field') as HTMLInputElement;
        const code = normalizeRoomCode(input?.value || '');
        if (isValidRoomCode(code)) {
          this.networkRoom = new NetworkRoom({
            roomCode: code,
            localPlayer: {
              name: 'Player Peer',
              address: '0x1000000000000000000000000000000000000000',
              avatar: 'avatar_0.png',
            },
            isHost: false,
          });
          void this.networkRoom.start();
          this.renderAll();
        } else {
          this.audio.playErrorBuzzer();
        }
      } else if (target.dataset.action === 'toggle-ready') {
        this.networkRoom?.toggleReady();
        this.renderAll();
      } else if (target.dataset.action === 'leave-room') {
        this.networkRoom?.stop();
        this.networkRoom = null;
        this.renderAll();
      } else if (target.dataset.action === 'start-room-match') {
        this.networkRoom?.startMatch();
        this.closeModals();
      }
    });
  }
}
