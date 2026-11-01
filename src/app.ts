/**
 * src/app.ts
 *
 * GameApp coordinator for robin-town.
 * Orchestrates the full single-player match loop across 6 years and 5 phases
 * against Sherwood, Apex, and Luna. Wires parcel drafting, bilateral OTC trading,
 * protocol deployment, 1.20x staking yield harvest, and Year 6 final settlement.
 * Manages dual-mode wallet, multiplayer rooms, camera, board renderer,
 * 3D Three.js scene, Apple Carousel, iPod Classic controller, SolaceUI exposure-grid shader,
 * and deflationary $wif economic flywheel.
 */

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  canBuildShop,
  findAllClusters,
} from './engine/board-layout';
import {
  BOT_PERSONALITIES,
  botDraft,
} from './engine/bot';
import {
  SHOPS,
  advancePhase,
  beginBuild,
  buildTile,
  claimPlots,
  collectIncome,
  createGame,
  draftPlots,
  groupIncome,
  nextYear,
  rankings,
  startYear,
} from './engine/engine';
import type { GameConfig, GamePhase, GameState, Player } from './engine/types';
import {
  BURN_ADDRESS,
  applyMatchPayouts,
  applyPointSwap,
  applyTradeTax,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  createInitialFlywheelState,
  type FlywheelState,
  type MatchPoolResult,
  type PointSwapResult,
  type TradeTaxResult,
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
import { BoardRenderer, type BoardRenderState } from './ui/board';
import {
  ThreeBoardRenderer,
  isWebGLAvailable,
  type Board3DRenderer,
} from './ui/board-3d';
import { CameraController } from './ui/camera';
import { AppleCarousel, type CarouselItem } from './ui/carousel';
import {
  ExposureGrid,
  type ExposureGridPhase,
  type ExposureGridRenderer,
} from './ui/exposure-grid';
import {
  SolaceBackground,
  type SolacePhase,
} from './ui/solace-background';
import {
  WalletFlywheelController,
  WalletFlywheelModal,
} from './ui/wallet-flywheel-modal';
import {
  HudManager,
  type DrawerViewModel,
  type PlayerRibbonViewModel,
  type TopBarViewModel,
} from './ui/hud';
import { IPodController, type iPodAction } from './ui/ipod-controller';
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
  private bgCanvas: HTMLCanvasElement | null = null;

  // Domain controllers
  private state: GameState;
  private camera: CameraController;
  private boardRenderer: BoardRenderer;
  private board3DRenderer: ThreeBoardRenderer | null = null;
  private carousel: AppleCarousel | null = null;
  private ipodController: IPodController | null = null;
  private exposureGrid: ExposureGrid | null = null;
  private tradeDeskController: TradeDeskController;
  private tradeDeskModal: TradeDeskModal | null = null;
  private hudManager: HudManager | null = null;
  private audio: AudioSynthesizer;
  private walletAdapter: WalletAdapter;
  private networkRoom: NetworkRoom | null = null;
  private solaceBackground: SolaceBackground | null = null;
  private walletFlywheelController: WalletFlywheelController | null = null;
  private walletFlywheelModal: WalletFlywheelModal | null = null;

  // Economic flywheel state
  private flywheelState: FlywheelState;
  private hasSettledMatchPool = false;

  // Visual mode and selection state
  private renderMode: '2d' | '3d' = '3d';
  private isSelectingLot = false;
  private selectedDraftLots: number[] = [];
  private selectedShopType: number | null = null;
  private selectedLotId: number | null = null;
  private hoveredLotId: number | null = null;
  private isStaked = true;
  private isWalletModalOpen = false;
  private isSettlementModalOpen = false;
  private isRoomModalOpen = false;
  private isPointSwapModalOpen = false;
  private roomCodeInput = '';

  // Animation and event listeners
  private animFrameId: number | null = null;
  private handleResizeBound = () => this.handleResize();
  private handleKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);

  constructor(container: HTMLElement | null = null, config: RobinTownAppConfig = {}) {
    this.container = container;
    this.isStaked = config.isStaked ?? true;
    this.audio = config.audio ?? getAudioSynthesizer();
    this.walletAdapter = new WalletAdapter({ mode: 'simulation' });
    this.flywheelState = createInitialFlywheelState();

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

    // Start Year 1 automatically
    startYear(this.state);

    // Initialize camera and board renderer
    this.camera = new CameraController();
    this.boardRenderer = new BoardRenderer(this.camera);

    // Initialize TradeDeskController with flywheel state binding
    this.tradeDeskController = new TradeDeskController(this.state, {
      flywheelState: this.flywheelState,
      onAudioTrigger: (cue) => {
        if (cue === 'deal-stamp') this.audio.playDealStamp();
        else if (cue === 'coin-chime') this.audio.playCoinChime();
        else if (cue === 'error-buzzer') this.audio.playErrorBuzzer();
        else if (cue === 'click') this.audio.playClick();
      },
      onTradeExecuted: (offer, evaluation, taxResult) => {
        if (taxResult) {
          this.flywheelState = applyTradeTax(this.flywheelState, taxResult);
        }
        this.syncCarouselDeeds();
        if (this.board3DRenderer) {
          this.board3DRenderer.render(this.state, this.selectedLotId);
        }
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

  public getBoard3DRenderer(): ThreeBoardRenderer | null {
    return this.board3DRenderer;
  }

  public getCarousel(): AppleCarousel | null {
    return this.carousel;
  }

  public getIPodController(): IPodController | null {
    return this.ipodController;
  }

  public getExposureGrid(): ExposureGrid | null {
    return this.exposureGrid;
  }

  public getTradeDeskController(): TradeDeskController {
    return this.tradeDeskController;
  }

  public getWalletAdapter(): WalletAdapter {
    return this.walletAdapter;
  }

  public getFlywheelState(): Readonly<FlywheelState> {
    return this.flywheelState;
  }

  public getRenderMode(): '2d' | '3d' {
    return this.renderMode;
  }

  public getAudio(): AudioSynthesizer {
    return this.audio;
  }

  /**
   * Toggles between 3D Diorama and 2D Tactical View.
   */
  public toggleRenderMode(): '2d' | '3d' {
    this.renderMode = this.renderMode === '3d' ? '2d' : '3d';
    if (this.canvas) {
      this.canvas.style.display = this.renderMode === '2d' ? 'block' : 'none';
    }
    if (this.renderMode === '2d') {
      this.board3DRenderer?.pause();
    } else {
      this.board3DRenderer?.resume();
    }
    if (typeof document !== 'undefined' && document.body?.dataset) {
      document.body.dataset.viewMode = this.renderMode === '3d' ? 'city-3d' : '2d';
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('robin_town_view_mode', this.renderMode === '3d' ? 'city-3d' : '2d');
      }
    } catch {}
    this.renderAll();
    return this.renderMode;
  }

  /**
   * Mounts the application inside a DOM root element.
   */
  public mount(container: HTMLElement): void {
    this.container = container;
    this.container.innerHTML = `
      <div class="robin-town-shell">
        <canvas id="bg-canvas"></canvas>
        <div id="hud-container" class="hud-container"></div>
        <div class="diorama-workspace">
          <div class="main-viewport">
            <div id="board-container" class="board-container">
              <canvas id="game-board-canvas" class="board-canvas pixel-art"></canvas>
            </div>
            <div id="deed-carousel-container" class="deed-carousel-container"></div>
          </div>
          <aside id="controller-container" class="controller-container"></aside>
        </div>
        <div id="trade-desk-container" class="trade-desk-container"></div>
        <div id="modal-overlay-container" class="modal-overlay-container"></div>
      </div>
    `;

    // 1. Mount SolaceUI ExposureGrid shader background on #bg-canvas
    this.bgCanvas = this.container.querySelector('#bg-canvas') as HTMLCanvasElement;
    if (this.bgCanvas) {
      this.exposureGrid = new ExposureGrid({
        canvas: this.bgCanvas,
        phaseTheme: this.state.phase as ExposureGridPhase,
      });
      this.exposureGrid.mount();
      this.solaceBackground = new SolaceBackground({
        canvas: this.bgCanvas,
        phase: 'default',
        intensity: 0.85,
      });
      this.solaceBackground.mount();
    }

    // 2. 2D fallback canvas setup
    this.canvas = this.container.querySelector('#game-board-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.camera.attach(this.canvas);
      this.handleResize();
    }

    // 3. Mount 3D ThreeBoardRenderer if WebGL is available
    const boardContainer = this.container.querySelector('#board-container') as HTMLElement;
    if (boardContainer && isWebGLAvailable()) {
      this.board3DRenderer = new ThreeBoardRenderer({
        container: boardContainer,
        onSelectLot: (lotId) => {
          this.selectLot(lotId, 'board');
        },
        onHoverLot: (lotId) => {
          this.hoveredLotId = lotId;
        },
      });
      this.board3DRenderer.mount();
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
      this.renderMode = '3d';
    } else {
      this.renderMode = '2d';
    }
    if (typeof document !== 'undefined' && document.body?.dataset) {
      document.body.dataset.viewMode = this.renderMode === '3d' ? 'city-3d' : '2d';
    }

    // 4. Mount Apple Carousel on #deed-carousel-container
    const carouselContainer = this.container.querySelector('#deed-carousel-container') as HTMLElement;
    if (carouselContainer) {
      const items = this.buildCarouselItems();
      this.carousel = new AppleCarousel({
        container: carouselContainer,
        items,
        autoplayDurationMs: 6000,
        onSelect: (item) => {
          this.selectLot(item.id, 'carousel');
        },
      });
      this.carousel.mount();
    }

    // 5. Mount iPod Classic Controller on #controller-container
    const controllerContainer = this.container.querySelector('#controller-container') as HTMLElement;
    if (controllerContainer) {
      this.ipodController = new IPodController({
        container: controllerContainer,
        menuTitle: this.getPhaseTitle(this.state.phase),
        actions: this.buildIPodPhaseActions(this.state.phase),
        onScroll: (delta) => {
          this.handleIPodScroll(delta);
        },
        onSelect: (action) => {
          action.handler();
        },
        onMenu: () => {
          this.ipodController?.setActions(
            this.getPhaseTitle(this.state.phase),
            this.buildIPodPhaseActions(this.state.phase)
          );
        },
      });
      this.ipodController.mount();
    }

    // 6. Mount HUD manager
    const hudEl = this.container.querySelector('#hud-container') as HTMLElement;
    if (hudEl) {
      this.hudManager = new HudManager(hudEl, {
        onActionClick: (actionId) => this.handleActionClick(actionId),
        onTileSelect: (shopType) => this.selectShopType(shopType),
        onDraftToggle: (lotId) => this.toggleDraftLot(lotId),
        onWalletClick: () => this.openWalletModal(),
        onAudioToggle: () => {
          this.audio.toggleMute();
          this.renderAll();
        },
        onViewToggle: () => {
          this.toggleRenderMode();
        },
      });
    }

    // 7. Mount Trade Desk modal
    const tradeEl = this.container.querySelector('#trade-desk-container') as HTMLElement;
    if (tradeEl) {
      this.tradeDeskModal = new TradeDeskModal(tradeEl, this.tradeDeskController);
    }

    // 8. Mount Wallet Flywheel modal
    this.walletFlywheelController = new WalletFlywheelController({
      walletAdapter: this.walletAdapter,
      flywheelState: this.flywheelState,
      onResetSimulation: () => this.renderAll(),
      onVoteCast: (result) => {
        this.flywheelState = result.state ? result.state : result;
        this.renderAll();
      },
    });
    const walletModalEl = this.container.querySelector('#wallet-flywheel-container') as HTMLElement;
    if (walletModalEl) {
      this.walletFlywheelModal = new WalletFlywheelModal(walletModalEl, this.walletFlywheelController);
      this.walletFlywheelModal.mount();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResizeBound);
    }

    this.bindCanvasInteraction();
    this.bindKeyboardShortcuts();
    this.preloadAssets();
    this.startRenderLoop();
    this.renderAll();
  }

  /**
   * Builds carousel deed representations for all 72 board parcels.
   */
  public buildCarouselItems(): CarouselItem[] {
    const clusters = findAllClusters(this.state.lots);
    return LOT_DEFINITIONS.map((def) => {
      const lot = this.state.lots[def.id] || {
        id: def.id,
        owner: null,
        shop: null,
      };
      const ownerName = lot.owner !== null ? this.state.players[lot.owner]?.name || `Player ${lot.owner}` : 'Vacant';
      const shopObj = lot.shop !== null ? SHOPS[lot.shop] : null;
      const shopName = shopObj ? shopObj.name : 'Vacant';
      const district = DISTRICT_BLOCKS[def.block] || { name: 'District', accentHex: '#888888' };

      // Calculate lot annual income if owned and built
      let lotIncome = 0;
      if (lot.owner !== null && lot.shop !== null) {
        const cluster = clusters.find((c) => c.lots.includes(def.id) && c.playerId === lot.owner);
        if (cluster) {
          const totalClusterIncome = groupIncome(cluster.shopType, cluster.size);
          lotIncome = Math.round(totalClusterIncome / Math.max(1, cluster.size));
        }
      }

      return {
        id: def.id,
        title: `Parcel #${def.id + 1}`,
        district: def.districtName || district.name,
        color: district.accentHex,
        owner: ownerName,
        shop: shopName,
        income: lotIncome,
      };
    });
  }

  /**
   * Refreshes carousel deed items to match the current game state.
   */
  private syncCarouselDeeds(): void {
    if (!this.carousel) return;
    const items = this.buildCarouselItems();
    this.carousel.setItems(items);
  }

  /**
   * Handles iPod click wheel rotational movement for carousel deed scrubbing.
   */
  private handleIPodScroll(delta: number): void {
    if (this.carousel) {
      if (delta > 0) {
        this.carousel.next();
      } else if (delta < 0) {
        this.carousel.prev();
      }
      const item = this.carousel.getCurrentItem();
      if (item) {
        this.selectLot(item.id, 'ipod');
      }
    }
  }

  /**
   * Unified lot selection dispatcher with re-entrancy protection.
   */
  public selectLot(
    lotId: number,
    source: 'board' | 'carousel' | 'ipod' | 'engine' = 'engine'
  ): void {
    if (lotId < 0 || lotId >= TOTAL_LOTS) return;
    if (this.isSelectingLot) return;
    this.isSelectingLot = true;

    try {
      this.selectedLotId = lotId;

      // Center 3D camera if not sourced from 3D board click
      if (source !== 'board' && this.board3DRenderer) {
        this.board3DRenderer.focusLot(lotId);
      }

      // Scroll carousel slide if not sourced from carousel selection
      if (source !== 'carousel' && this.carousel) {
        this.carousel.goTo(lotId);
      }

      // Execute phase actions for board and iPod physical inputs
      if (source === 'board' || source === 'ipod') {
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
      }

      this.renderAll();
    } finally {
      this.isSelectingLot = false;
    }
  }

  /**
   * Updates ExposureGrid shader background and iPod menu to match current phase.
   */
  private syncPhaseTheme(): void {
    if (this.exposureGrid) {
      this.exposureGrid.setPhaseTheme(this.state.phase as ExposureGridPhase, 800);
    }
    if (this.ipodController) {
      this.ipodController.setActions(
        this.getPhaseTitle(this.state.phase),
        this.buildIPodPhaseActions(this.state.phase)
      );
    }
  }

  private getPhaseTitle(phase: GamePhase): string {
    switch (phase) {
      case 'receive':
        return 'Allocation Draft';
      case 'trade':
        return 'OTC Liquidity Desk';
      case 'build':
        return 'Protocol Deployment';
      case 'income':
        return 'Yield Harvest';
      case 'ended':
        return 'Final Settlement';
      default:
        return 'Robin-Town';
    }
  }

  /**
   * Builds the action menu for the iPod Classic controller per game phase.
   */
  public buildIPodPhaseActions(phase: GamePhase): iPodAction[] {
    const walletSubmenu: iPodAction = {
      id: 'wallet-menu',
      label: 'Wallet & Flywheel',
      handler: () => {},
      submenu: {
        title: 'Wallet Desk',
        actions: [
          {
            id: 'toggle-mode',
            label: 'Toggle Wallet Mode',
            handler: () => {
              const currentMode = this.walletAdapter.getState().mode;
              this.walletAdapter.setMode(currentMode === 'simulation' ? 'web3' : 'simulation');
              this.renderAll();
            },
          },
          {
            id: 'cycle-sim',
            label: 'Switch Sim Account',
            handler: () => {
              const currentAddr = this.walletAdapter.getState().account?.address.toLowerCase();
              const idx = DEFAULT_SIMULATED_ACCOUNTS.findIndex(
                (a) => a.address.toLowerCase() === currentAddr
              );
              const nextIdx = (idx + 1) % DEFAULT_SIMULATED_ACCOUNTS.length;
              this.walletAdapter.switchAccount(DEFAULT_SIMULATED_ACCOUNTS[nextIdx].address);
              this.renderAll();
            },
          },
          {
            id: 'reset-sim-balance',
            label: 'Reset Sim Balances',
            handler: () => {
              this.walletAdapter.resetSimulation();
              this.renderAll();
            },
          },
          {
            id: 'open-wallet-dialog',
            label: 'Open Full Wallet Dialog',
            handler: () => {
              this.openWalletModal();
            },
          },
        ],
      },
    };

    switch (phase) {
      case 'receive':
        return [
          {
            id: 'confirm-draft',
            label: 'Confirm Selected Deeds',
            handler: () => {
              this.confirmDraft(this.selectedDraftLots);
            },
          },
          {
            id: 'quick-draft',
            label: 'Quick Draft (Auto)',
            handler: () => {
              this.quickDraft();
            },
          },
          {
            id: 'toggle-parcel',
            label: 'Toggle Focused Deed',
            handler: () => {
              if (this.selectedLotId !== null) {
                this.toggleDraftLot(this.selectedLotId);
              }
            },
          },
          {
            id: 'browse-available',
            label: 'Browse Deal Tray',
            handler: () => {},
            submenu: {
              title: 'Deal Tray Deeds',
              actions: (this.state.pending || []).map((lotId) => ({
                id: `tray-lot-${lotId}`,
                label: `Parcel #${lotId + 1}`,
                handler: () => {
                  this.selectLot(lotId, 'ipod');
                  this.toggleDraftLot(lotId);
                },
              })),
            },
          },
          walletSubmenu,
        ];

      case 'trade':
        return [
          {
            id: 'open-otc-propose',
            label: 'Open OTC Liquidity Desk',
            handler: () => {
              this.openTradeDesk();
            },
          },
          {
            id: 'trade-sherwood',
            label: 'Trade with Sherwood',
            handler: () => {
              this.openTradeDesk(1);
            },
          },
          {
            id: 'trade-apex',
            label: 'Trade with Apex',
            handler: () => {
              this.openTradeDesk(2);
            },
          },
          {
            id: 'trade-luna',
            label: 'Trade with Luna',
            handler: () => {
              this.openTradeDesk(3);
            },
          },
          {
            id: 'finish-trading',
            label: 'Close Trading Phase',
            handler: () => {
              this.finishTrading();
            },
          },
          walletSubmenu,
        ];

      case 'build':
        return [
          {
            id: 'pick-shop-category',
            label: 'Select Protocol Module',
            handler: () => {},
            submenu: {
              title: 'Protocol Modules',
              actions: [0, 1, 2, 3, 4, 5].map((shopType) => {
                const shop = SHOPS[shopType];
                const count = this.state.players[0].tiles[shopType] || 0;
                return {
                  id: `shop-mod-${shopType}`,
                  label: `${shop.name} (x${count})`,
                  handler: () => {
                    this.selectShopType(shopType);
                  },
                };
              }),
            },
          },
          {
            id: 'deploy-on-focused',
            label: 'Deploy on Focused Lot',
            handler: () => {
              if (this.selectedLotId !== null) {
                this.buildOnLot(this.selectedLotId);
              }
            },
          },
          {
            id: 'clear-shop-choice',
            label: 'Clear Module Selection',
            handler: () => {
              this.selectShopType(null);
            },
          },
          {
            id: 'finish-building',
            label: 'Finish Construction',
            handler: () => {
              this.harvestYield();
            },
          },
          walletSubmenu,
        ];

      case 'income':
        return [
          {
            id: 'advance-next-year',
            label: 'Advance to Next Year',
            handler: () => {
              this.advanceToNextYear();
            },
          },
          {
            id: 'toggle-staking',
            label: `Staking Boost (${this.isStaked ? '1.20x ON' : 'OFF'})`,
            handler: () => {
              this.isStaked = !this.isStaked;
              this.renderAll();
            },
          },
          walletSubmenu,
        ];

      case 'ended':
        return [
          {
            id: 'open-settlement',
            label: 'View Final Settlement',
            handler: () => {
              this.openSettlementModal();
            },
          },
          {
            id: 'swap-points-wif',
            label: 'Swap Points for $wif',
            handler: () => {
              this.openPointSwapModal();
            },
          },
          {
            id: 'start-fresh-match',
            label: 'Start Fresh Match',
            handler: () => {
              this.startNewGame();
            },
          },
          walletSubmenu,
        ];

      default:
        return [
          {
            id: 'default-new-game',
            label: 'Start New Match',
            handler: () => {
              this.startNewGame();
            },
          },
          walletSubmenu,
        ];
    }
  }

  private handleResize(): void {
    if (!this.container) return;
    const boardBox = this.container.querySelector('#board-container') as HTMLElement;
    const w = Math.max(320, boardBox?.clientWidth || 800);
    const h = Math.max(240, boardBox?.clientHeight || 600);
    this.camera.setViewport(w, h);
    if (this.canvas) {
      this.boardRenderer.resizeCanvas(this.canvas, { width: w, height: h });
    }
    if (this.board3DRenderer) {
      this.board3DRenderer.resize(w, h);
    }
    if (this.exposureGrid && typeof window !== 'undefined') {
      this.exposureGrid.resize(window.innerWidth, window.innerHeight);
    }
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
    if (typeof requestAnimationFrame === 'undefined') return;

    const loop = () => {
      this.camera.update();
      if (this.renderMode === '2d') {
        this.drawBoard();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.camera.detach();
    this.tradeDeskModal?.destroy();
    this.board3DRenderer?.unmount();
    this.carousel?.unmount();
    this.ipodController?.unmount();
    this.exposureGrid?.unmount();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResizeBound);
      window.removeEventListener('keydown', this.handleKeyDownBound);
    }
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
    };

    this.boardRenderer.render(this.ctx, vp, renderState);
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
      this.audio.isMuted(),
      this.flywheelState.totalBurned,
      this.renderMode
    );

    this.tradeDeskModal?.render();
    this.renderModalOverlays();

    // Re-render 3D scene if present
    if (this.board3DRenderer) {
      this.board3DRenderer.render(this.state, this.selectedLotId);
    }
  }

  private bindCanvasInteraction(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const lotId = this.camera.hitTest(sx, sy);
      if (lotId !== this.hoveredLotId) {
        this.hoveredLotId = lotId;
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const lotId = this.camera.hitTest(sx, sy);
      if (lotId !== null) {
        this.selectLot(lotId, 'board');
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isWalletModalOpen || this.isSettlementModalOpen || this.isRoomModalOpen || this.isPointSwapModalOpen) {
      if (e.key === 'Escape') {
        this.closeModals();
      }
      return;
    }

    if (e.key === 't' || e.key === 'T') {
      if (this.state.phase === 'trade') {
        this.openTradeDesk();
      }
    } else if (e.key === 'q' || e.key === 'Q') {
      if (this.state.phase === 'receive') {
        this.quickDraft();
      }
    } else if (e.key === 'v' || e.key === 'V') {
      this.toggleRenderMode();
    } else if (e.key === ' ') {
      e.preventDefault();
      this.handleSpaceKey();
    } else if (e.key === 'Escape') {
      this.selectedShopType = null;
      this.selectedLotId = null;
      this.renderAll();
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDownBound);
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
        this.openPointSwapModal();
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
      draftPlots(this.state, 0, lotIds);
      this.selectedDraftLots = [];
      this.tradeDeskController.updateGameState(this.state);
      this.syncCarouselDeeds();
      if (this.board3DRenderer) {
        this.board3DRenderer.render(this.state, this.selectedLotId);
      }
      this.syncPhaseTheme();
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
    this.syncPhaseTheme();
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
      this.syncCarouselDeeds();
      if (this.board3DRenderer) {
        this.board3DRenderer.render(this.state, this.selectedLotId);
      }
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
      this.flywheelState.totalStakingYield += bonus;
      playerHarvest = boosted;
    }

    this.syncCarouselDeeds();
    if (this.board3DRenderer) {
      this.board3DRenderer.render(this.state, this.selectedLotId);
    }
    this.syncPhaseTheme();
    this.audio.playCoinChime();
    this.renderAll();

    const currentPhase = this.state.phase as GamePhase;
    if (currentPhase === 'ended') {
      if (!this.hasSettledMatchPool) {
        this.hasSettledMatchPool = true;
        const finalRankings = rankings(this.state);
        const pool = calculateMatchPayouts(1000, finalRankings.map((p) => p.id));
        this.flywheelState = applyMatchPayouts(this.flywheelState, pool);
      }
      this.audio.playGameOverFanfare();
      this.openSettlementModal();
    }

    return {
      totalHarvest: playerHarvest,
      payouts: incomeResult.payouts,
    };
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
      if (!this.hasSettledMatchPool) {
        this.hasSettledMatchPool = true;
        const finalRankings = rankings(this.state);
        const pool = calculateMatchPayouts(1000, finalRankings.map((p) => p.id));
        this.flywheelState = applyMatchPayouts(this.flywheelState, pool);
      }
      this.audio.playGameOverFanfare();
      this.openSettlementModal();
    } else {
      nextYear(this.state);
      this.audio.playYearFanfare();
      this.tradeDeskController.updateGameState(this.state);
    }

    this.syncCarouselDeeds();
    if (this.board3DRenderer) {
      this.board3DRenderer.render(this.state, this.selectedLotId);
    }
    this.syncPhaseTheme();
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

    if (!this.hasSettledMatchPool) {
      this.hasSettledMatchPool = true;
      this.flywheelState = applyMatchPayouts(this.flywheelState, pool);
    }

    return {
      rankings: finalRankings,
      matchPool: pool,
      playerPoints: points,
      pointSwap: swap,
    };
  }

  public swapPointsForWif(points: number): PointSwapResult {
    const res = calculatePointSwap(points, 0.10, 0.03);
    this.flywheelState = applyPointSwap(this.flywheelState, res);

    // Credit net tokens to current active simulated account
    const walletState = this.walletAdapter.getState();
    if (walletState.account && res.netWif > 0) {
      if (walletState.mode === 'simulation') {
        const simMap = (this.walletAdapter as unknown as { simBalances?: Map<string, number> }).simBalances;
        if (simMap) {
          const addr = walletState.account.address.toLowerCase().trim();
          const currentBal = simMap.get(addr) ?? walletState.account.balance;
          simMap.set(addr, currentBal + res.netWif);
        }
      }
    }

    this.audio.playCoinChime();
    this.renderAll();
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
    startYear(this.state);
    this.hasSettledMatchPool = false;
    this.selectedDraftLots = [];
    this.selectedShopType = null;
    this.selectedLotId = null;
    this.closeModals();
    this.tradeDeskController.updateGameState(this.state);
    this.syncCarouselDeeds();
    if (this.board3DRenderer) {
      this.board3DRenderer.render(this.state, this.selectedLotId);
    }
    this.syncPhaseTheme();
    this.audio.playPhaseFanfare();
    this.renderAll();
  }

  // Modals management
  public openWalletModal(): void {
    if (this.walletFlywheelModal) {
      this.walletFlywheelModal.open();
      return;
    }
    this.isWalletModalOpen = true;
    this.renderAll();
  }

  public openSettlementModal(): void {
    this.isSettlementModalOpen = true;
    this.renderAll();
  }

  public openRoomModal(): void {
    this.isRoomModalOpen = true;
    this.renderAll();
  }

  public openPointSwapModal(): void {
    this.isPointSwapModalOpen = true;
    this.renderAll();
  }

  public closeModals(): void {
    this.isWalletModalOpen = false;
    this.isSettlementModalOpen = false;
    this.isRoomModalOpen = false;
    this.isPointSwapModalOpen = false;
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
    } else if (this.isRoomModalOpen) {
      modalEl.innerHTML = this.renderRoomModalHTML();
      this.bindRoomModalEvents(modalEl);
    } else if (this.isPointSwapModalOpen) {
      modalEl.innerHTML = this.renderPointSwapModalHTML();
      this.bindPointSwapModalEvents(modalEl);
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
                <span class="text-accent">${settlement.matchPool.burnedAmount} $wif (to dead address)</span>
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

          <div class="settlement-actions" style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn-secondary" data-action="open-point-swap">Redeem Points for $wif</button>
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
      } else if (target.dataset.action === 'open-point-swap') {
        this.openPointSwapModal();
      } else if (target.dataset.action === 'new-match') {
        this.startNewGame();
      }
    });
  }

  private renderPointSwapModalHTML(): string {
    const points = this.calculatePlayerPoints(0);
    const swap = calculatePointSwap(points, 0.10, 0.03);
    const walletState = this.walletAdapter.getState();
    const balance = walletState.account?.balance ?? 0;

    return `
      <div class="modal-backdrop" data-modal-close="true"></div>
      <div class="modal-dialog point-swap-modal">
        <header class="modal-header">
          <h3>Point-to-$wif Redemption Desk</h3>
          <button class="btn-close" data-modal-close="true">&times;</button>
        </header>
        <div class="modal-body">
          <p class="tab-desc">Convert performance score points into liquid $wif tokens credited directly to your connected wallet.</p>
          <div class="point-swap-card">
            <div class="swap-metrics">
              <div class="metric-row">
                <span>Earned Score Points:</span>
                <span class="font-bold">${points.toLocaleString()} pts</span>
              </div>
              <div class="metric-row">
                <span>Gross Conversion (10:1):</span>
                <span>${swap.grossWif.toLocaleString()} $wif</span>
              </div>
              <div class="metric-row">
                <span>3% Deflationary Burn Tax:</span>
                <span class="text-accent">-${swap.burnedWif.toLocaleString()} $wif (burned to dead address)</span>
              </div>
              <div class="metric-row">
                <span>Net Token Credit:</span>
                <span class="text-green font-bold">+${swap.netWif.toLocaleString()} $wif</span>
              </div>
              <div class="metric-row">
                <span>Current Wallet Balance:</span>
                <span>${balance.toLocaleString()} $wif</span>
              </div>
            </div>
          </div>
          <div class="settlement-actions" style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn-secondary" data-modal-close="true">Cancel</button>
            <button class="btn-primary" data-action="confirm-swap" ${points <= 0 ? 'disabled' : ''}>
              Confirm Swap & Credit ${swap.netWif} $wif
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindPointSwapModalEvents(modalEl: HTMLElement): void {
    modalEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-modal-close], [data-action]') as HTMLElement | null;
      if (!target) return;

      if (target.dataset.modalClose) {
        this.closeModals();
      } else if (target.dataset.action === 'confirm-swap') {
        const points = this.calculatePlayerPoints(0);
        this.swapPointsForWif(points);
        this.closeModals();
      }
    });
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
