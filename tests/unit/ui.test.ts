/**
 * tests/unit/ui.test.ts
 *
 * Comprehensive unit test suite for Milestone 5 UI components in robin-town.
 * Tests camera transforms, coordinate projections, decoupled canvas rendering,
 * headless TradeDeskController, procedural audio synthesizer safety, HUD view models,
 * GameApp match coordinator, and dual-mode wallet / multiplayer integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
} from '../../src/engine/board-layout';
import { createGame, draftPlots, emptyOffer, startYear } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import { RobinTownApp } from '../../src/app';
import { AudioSynthesizer } from '../../src/ui/audio';
import {
  BoardRenderer,
  type BoardRenderState,
  type Canvas2DContextLike,
} from '../../src/ui/board';
import {
  CameraController,
  boardToScreen,
  clampCamera,
  hitTestBoardPoint,
  hitTestScreenPoint,
  screenToBoard,
  zoomAtScreenPoint,
} from '../../src/ui/camera';
import {
  projectActionBarViewModel,
  projectDrawerViewModel,
  projectLogFeedViewModel,
  projectPlayerRibbonViewModel,
  projectTopBarViewModel,
} from '../../src/ui/hud';
import { TradeDeskController } from '../../src/ui/trade-desk';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../src/network/room';
import { WalletAdapter } from '../../src/tokenomics/wallet';

/**
 * Headless recording mock implementing Canvas2DContextLike.
 */
class MockCanvasContext implements Canvas2DContextLike {
  public drawCalls: { type: string; args: unknown[] }[] = [];
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

describe('Camera Transforms and Coordinate Inversion System', () => {
  const viewport = { width: 1200, height: 800 };
  const camera = { x: 550, y: 365, zoom: 1.0 };

  it('preserves all 72 parcel coordinate bounds in world space', () => {
    assert.equal(LOT_DEFINITIONS.length, 72);
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const lot = LOT_DEFINITIONS[i];
      assert.ok(lot.x >= 0, `Lot ${i} x must be >= 0`);
      assert.ok(lot.y >= 0, `Lot ${i} y must be >= 0`);
      assert.ok(lot.x + CELL_SIZE <= BOARD_WIDTH, `Lot ${i} right edge out of board`);
      assert.ok(lot.y + CELL_SIZE <= BOARD_HEIGHT, `Lot ${i} bottom edge out of board`);
    }
  });

  it('guarantees exact mathematical round-trip inversion between screen and board coordinates', () => {
    const testPoints = [
      { bx: 100, by: 150 },
      { bx: 550, by: 365 },
      { bx: 920, by: 650 },
      { bx: 0, by: 0 },
      { bx: 1100, by: 730 },
    ];
    const testZooms = [0.5, 0.75, 1.0, 1.5, 2.0, 2.5];

    for (const zoom of testZooms) {
      const cam = { x: 500, y: 400, zoom };
      for (const pt of testPoints) {
        const screen = boardToScreen(pt.bx, pt.by, cam, viewport);
        const inverted = screenToBoard(screen.x, screen.y, cam, viewport);
        assert.ok(Math.abs(inverted.x - pt.bx) < 1e-5, `Round-trip mismatch on x at zoom ${zoom}`);
        assert.ok(Math.abs(inverted.y - pt.by) < 1e-5, `Round-trip mismatch on y at zoom ${zoom}`);
      }
    }
  });

  it('preserves cursor-anchored board coordinates when zooming around an off-center screen point', () => {
    const cursorScreen = { sx: 350, sy: 250 };
    const initialCam = { x: 450, y: 350, zoom: 1.0 };

    const boardUnderCursorBefore = screenToBoard(
      cursorScreen.sx,
      cursorScreen.sy,
      initialCam,
      viewport
    );

    const zoomedCam = zoomAtScreenPoint(
      cursorScreen.sx,
      cursorScreen.sy,
      1.8,
      initialCam,
      viewport
    );

    const boardUnderCursorAfter = screenToBoard(
      cursorScreen.sx,
      cursorScreen.sy,
      zoomedCam,
      viewport
    );

    assert.ok(
      Math.abs(boardUnderCursorBefore.x - boardUnderCursorAfter.x) < 1e-4,
      'Zoom anchor shifted horizontally'
    );
    assert.ok(
      Math.abs(boardUnderCursorBefore.y - boardUnderCursorAfter.y) < 1e-4,
      'Zoom anchor shifted vertically'
    );
  });

  it('accurately hit-tests parcel centers, corners, and gutter points', () => {
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const lot = LOT_DEFINITIONS[i];
      // Test center
      const hitCenter = hitTestBoardPoint(lot.x + 25, lot.y + 25);
      assert.equal(hitCenter, lot.id, `Center hit failed for lot ${i}`);

      // Test top-left corner
      const hitTL = hitTestBoardPoint(lot.x, lot.y);
      assert.equal(hitTL, lot.id, `Top-left hit failed for lot ${i}`);

      // Test bottom-right interior point
      const hitBR = hitTestBoardPoint(lot.x + 49, lot.y + 49);
      assert.equal(hitBR, lot.id, `Bottom-right hit failed for lot ${i}`);
    }

    // Out-of-bounds hit-testing
    assert.equal(hitTestBoardPoint(-10, 50), null);
    assert.equal(hitTestBoardPoint(1150, 400), null);
    assert.equal(hitTestBoardPoint(500, -20), null);
    assert.equal(hitTestBoardPoint(500, 800), null);

    // Screen-to-lot hit-testing
    const lot0 = LOT_DEFINITIONS[0];
    const screenLot0 = boardToScreen(lot0.x + 25, lot0.y + 25, camera, viewport);
    const hitScreen = hitTestScreenPoint(screenLot0.x, screenLot0.y, camera, viewport);
    assert.equal(hitScreen, 0);
  });

  it('clamps camera zoom levels strictly between 0.5x and 2.5x', () => {
    const clampedUnder = clampCamera({ x: 550, y: 365, zoom: 0.2 }, viewport);
    assert.equal(clampedUnder.zoom, 0.5);

    const clampedOver = clampCamera({ x: 550, y: 365, zoom: 3.5 }, viewport);
    assert.equal(clampedOver.zoom, 2.5);
  });

  it('exercises CameraController interactive panning, zooming, and smooth update lerp', () => {
    const controller = new CameraController(viewport);
    assert.equal(controller.getState().zoom, 1.0);

    // Zoom in first so board does not fit fully within viewport
    controller.setZoom(2.0);
    controller.pan(100, 50);
    assert.notEqual(controller.getState().x, 550);

    // Zoom
    controller.setZoom(1.5);
    assert.equal(controller.getTargetState().zoom, 1.5);

    controller.zoomBy(1.2);
    assert.ok(controller.getTargetState().zoom > 1.5);

    // Reset
    controller.reset();
    assert.equal(controller.getTargetState().x, 550);
    assert.equal(controller.getTargetState().y, 365);
    assert.equal(controller.getTargetState().zoom, 1.0);

    // Fit to viewport
    controller.fitToViewport();
    assert.ok(controller.getTargetState().zoom > 0);

    // Update lerp
    controller.centerOn(500, 400, 1.2);
    let iterations = 0;
    while (controller.update() && iterations < 100) {
      iterations++;
    }
    assert.ok(Math.abs(controller.getState().x - 500) < 0.01);
  });
});

describe('Decoupled BoardRenderer Canvas Pipeline', () => {
  it('renders all 72 parcels and district outlines without browser DOM dependencies', () => {
    const camera = new CameraController({ width: 1100, height: 730 });
    const renderer = new BoardRenderer(camera);
    const mockCtx = new MockCanvasContext();

    const game = createGame();
    startYear(game);

    const renderState: BoardRenderState = {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    };

    renderer.render(mockCtx, { width: 1100, height: 730 }, renderState);

    assert.ok(mockCtx.drawCalls.length > 100, 'Expected extensive draw calls');
    const fillRects = mockCtx.drawCalls.filter((c) => c.type === 'fillRect');
    const strokeRects = mockCtx.drawCalls.filter((c) => c.type === 'strokeRect');

    // 72 lot rects + background + district boxes
    assert.ok(fillRects.length >= 72, 'Should draw parcel rects');
    assert.ok(strokeRects.length >= 72, 'Should draw parcel borders');
  });

  it('renders player ownership discs on owned unbuilt parcels', () => {
    const camera = new CameraController({ width: 1100, height: 730 });
    const renderer = new BoardRenderer(camera);
    const mockCtx = new MockCanvasContext();

    const game = createGame();
    startYear(game);

    // Assign lot 5 to Player 0 and lot 10 to Player 1
    game.lots[5].owner = 0;
    game.lots[10].owner = 1;

    renderer.render(mockCtx, { width: 1100, height: 730 }, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const arcs = mockCtx.drawCalls.filter((c) => c.type === 'arc');
    assert.ok(arcs.length >= 2, 'Should render circular ownership token discs');
  });

  it('renders shop categories and golden completion halos for full clusters', () => {
    const camera = new CameraController({ width: 1100, height: 730 });
    const renderer = new BoardRenderer(camera);
    const mockCtx = new MockCanvasContext();

    const game = createGame();
    startYear(game);

    // Build a completed DEX Swap (size 3) in District 0 on lots 0, 1, 2
    game.lots[0].owner = 0;
    game.lots[0].shop = 0;
    game.lots[1].owner = 0;
    game.lots[1].shop = 0;
    game.lots[2].owner = 0;
    game.lots[2].shop = 0;

    renderer.render(mockCtx, { width: 1100, height: 730 }, {
      gameState: game,
      selectedLotId: 0,
      hoveredLotId: 1,
      validBuildLots: [3, 4],
      invalidBuildLots: [5],
    });

    // Check that golden completion halos and interaction overlays were drawn
    const strokeRectCalls = mockCtx.drawCalls.filter((c) => c.type === 'strokeRect');
    assert.ok(strokeRectCalls.length > 72);
  });
});

describe('Headless TradeDeskController and Negotiation Core', () => {
  it('enforces that OTC Trade Desk can only open during trade phase', () => {
    const game = createGame();
    startYear(game);
    assert.equal(game.phase, 'receive');

    const controller = new TradeDeskController(game);
    assert.throws(
      () => controller.open(),
      /available only during the Trade phase/i
    );
  });

  it('switches counterparties cleanly while resetting requested assets', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';

    const controller = new TradeDeskController(game);
    controller.open(1); // Open with Sherwood (ID 1)

    // Stage cash on both sides
    controller.setGiveCash(20);
    controller.setTakeCash(15);
    assert.equal(controller.getDeskState().give.cash, 20);
    assert.equal(controller.getDeskState().take.cash, 15);

    // Switch to Apex (ID 2)
    controller.setPartner(2);
    assert.equal(controller.getDeskState().partnerId, 2);
    assert.equal(controller.getDeskState().give.cash, 20, 'Outgoing offer must be preserved');
    assert.equal(controller.getDeskState().take.cash, 0, 'Incoming request must be reset');
  });

  it('clamps cash staging strictly to player liquid balance limits', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[1].cash = 80;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Attempt negative cash
    controller.setGiveCash(-50);
    assert.equal(controller.getDeskState().give.cash, 0);

    // Attempt excessive cash
    controller.setGiveCash(500);
    assert.equal(controller.getDeskState().give.cash, 100);

    // Partner cash clamp
    controller.setTakeCash(200);
    assert.equal(controller.getDeskState().take.cash, 80);
  });

  it('computes 1% OTC micro-tax accurately across diverse transfer amounts', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';
    game.players[0].cash = 200;
    game.players[1].cash = 200;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // 100 $wif cash request: 1 $wif tax, 99 $wif net, 1 $wif vault yield
    controller.setTakeCash(100);
    const tax100 = controller.getDeskState().taxBreakdown.takeTax;
    assert.equal(tax100.grossCash, 100);
    assert.equal(tax100.taxAmount, 1);
    assert.equal(tax100.netCash, 99);
    assert.equal(tax100.vaultAmount, 1);

    // 1 $wif minimum cash request: 1 $wif tax, 0 $wif net without negative values
    controller.setTakeCash(1);
    const tax1 = controller.getDeskState().taxBreakdown.takeTax;
    assert.equal(tax1.grossCash, 1);
    assert.equal(tax1.taxAmount, 1);
    assert.equal(tax1.netCash, 0);

    // 0 $wif: barter exchange is 100% tax free
    controller.setTakeCash(0);
    const tax0 = controller.getDeskState().taxBreakdown.takeTax;
    assert.equal(tax0.taxAmount, 0);
    assert.equal(tax0.netCash, 0);
  });

  it('handles bot evaluation, shortfall detection, and counteroffer fulfillment', () => {
    const game = createGame();
    startYear(game);
    game.phase = 'trade';
    game.players[0].cash = 500;
    game.players[1].cash = 200;

    // Give Sherwood (Player 1) lot 0
    game.lots[0].owner = 1;

    const controller = new TradeDeskController(game);
    controller.open(1);

    // Request Sherwood lot 0 for 0 cash (gross underbid)
    controller.toggleTakeLot(0);
    const evalUnderbid = controller.getDeskState().evaluation;
    assert.ok(evalUnderbid !== null);
    assert.equal(evalUnderbid.accepted, false);
    assert.ok(evalUnderbid.shortfall > 0);

    // Check and apply counteroffer
    assert.ok(controller.canApplyCounteroffer());
    const applied = controller.applyCounteroffer();
    assert.equal(applied, true);

    const evalAccepted = controller.getDeskState().evaluation;
    assert.ok(evalAccepted !== null);
    assert.equal(evalAccepted.accepted, true);

    // Execute accepted trade
    const executed = controller.executeTrade();
    assert.equal(executed, true);
    assert.equal(game.lots[0].owner, 0, 'Lot ownership must transfer to Player 0');
    assert.equal(controller.getDeskState().isFilledAnimationActive, true);
  });
});

describe('Procedural Audio Synthesizer Safety', () => {
  it('instantiates cleanly and safely in headless Node.js environments', () => {
    const audio = new AudioSynthesizer();
    assert.equal(typeof audio.getVolume(), 'number');
    assert.equal(typeof audio.isMuted(), 'boolean');

    // Safe execution of sound methods
    audio.playTilePop();
    audio.playCoinChime();
    audio.playDealStamp();
    audio.playPhaseFanfare();
    audio.playYearFanfare();
    audio.playErrorBuzzer();
    audio.playClick();
  });

  it('clamps volume and toggles mute state correctly', () => {
    const audio = new AudioSynthesizer();
    audio.setVolume(1.5);
    assert.equal(audio.getVolume(), 1.0);

    audio.setVolume(-0.5);
    assert.equal(audio.getVolume(), 0.0);

    audio.setVolume(0.8);
    assert.equal(audio.getVolume(), 0.8);

    const initialMute = audio.isMuted();
    const toggled = audio.toggleMute();
    assert.equal(toggled, !initialMute);
    assert.equal(audio.isMuted(), !initialMute);
  });
});

describe('HUD View Model Projections', () => {
  it('projects top bar view model across game phases', () => {
    const game = createGame();
    startYear(game);

    const vmReceive = projectTopBarViewModel(game);
    assert.equal(vmReceive.year, 1);
    assert.equal(vmReceive.phase, 'receive');
    assert.ok(vmReceive.phaseTitle.includes('Allocation'));

    game.phase = 'trade';
    const vmTrade = projectTopBarViewModel(game);
    assert.ok(vmTrade.phaseTitle.includes('Liquidity Desk'));

    game.phase = 'build';
    const vmBuild = projectTopBarViewModel(game);
    assert.ok(vmBuild.phaseTitle.includes('Deployment'));

    game.phase = 'income';
    const vmIncome = projectTopBarViewModel(game);
    assert.ok(vmIncome.phaseTitle.includes('Harvest'));

    game.phase = 'ended';
    const vmEnded = projectTopBarViewModel(game);
    assert.ok(vmEnded.phaseTitle.includes('Final Settlement'));
  });

  it('projects 4-player status ribbon with formatted currency and stats', () => {
    const game = createGame();
    startYear(game);
    game.players[0].cash = 15400;

    const ribbon = projectPlayerRibbonViewModel(game);
    assert.equal(ribbon.players.length, 4);

    const p0 = ribbon.players[0];
    assert.equal(p0.id, 0);
    assert.ok(p0.cashFormatted.includes('15,400 $wif'));
    assert.equal(p0.isStaked, true);
    assert.equal(p0.colorHex, '#00C805');
  });

  it('projects context-sensitive action bar buttons for each phase', () => {
    const game = createGame();
    startYear(game);

    // Receive phase: confirm disabled until exact count selected
    const actReceive = projectActionBarViewModel(game, [1, 2]);
    const confirmBtn = actReceive.buttons.find((b) => b.id === 'confirm-draft');
    assert.ok(confirmBtn);
    assert.equal(confirmBtn.disabled, true);

    const actReceiveFull = projectActionBarViewModel(game, [1, 2, 3, 4, 5]);
    const confirmBtnFull = actReceiveFull.buttons.find((b) => b.id === 'confirm-draft');
    assert.equal(confirmBtnFull?.disabled, false);

    // Trade phase: has open trade desk and finish trading buttons
    game.phase = 'trade';
    const actTrade = projectActionBarViewModel(game);
    assert.ok(actTrade.buttons.some((b) => b.id === 'open-trade-desk'));
    assert.ok(actTrade.buttons.some((b) => b.id === 'finish-trading'));
  });

  it('projects drawer inventory rack and deed drafting rack', () => {
    const game = createGame();
    startYear(game);

    // Phase 1 receive drawer
    const drawerDraft = projectDrawerViewModel(game, 0, null, [0, 1]);
    assert.equal(drawerDraft.mode, 'draft');
    assert.equal(drawerDraft.selectedCount, 2);

    // Phase 3 build drawer
    game.phase = 'build';
    const drawerModules = projectDrawerViewModel(game, 0, 1);
    assert.equal(drawerModules.mode, 'modules');
    assert.equal(drawerModules.modules.length, 6);
    assert.equal(drawerModules.modules[1].isSelected, true);
  });

  it('projects activity terminal log feed with semantic colored badges', () => {
    const logs = [
      'Trader drafted Deed 5',
      'OTC Trade executed with Sherwood',
      'Deployed DEX Swap on Parcel 12',
      'Harvest distributed 150 $wif',
      'Flywheel burned 200 $wif',
    ];

    const feed = projectLogFeedViewModel(logs);
    assert.equal(feed.length, 5);
    assert.equal(feed[0].tag, 'DEED');
    assert.equal(feed[1].tag, 'OTC');
    assert.equal(feed[2].tag, 'DEPLOY');
    assert.equal(feed[3].tag, 'YIELD');
    assert.equal(feed[4].tag, 'FLY');
  });
});

describe('GameApp Match Loop Coordinator Simulation', () => {
  it('executes a complete match cycle through the RobinTownApp coordinator', () => {
    const app = new RobinTownApp(null);
    const initialGame = app.getGameState();
    assert.equal(initialGame.year, 1);
    assert.equal(initialGame.phase, 'receive');

    // Phase 1: Parcel drafting
    const draftedLots = app.quickDraft();
    assert.equal(draftedLots.length, initialGame.draftCount);
    assert.equal(app.getGameState().phase, 'trade');

    // Phase 2: OTC trading
    app.openTradeDesk(1);
    app.finishTrading();
    assert.equal(app.getGameState().phase, 'build');

    // Phase 3: Protocol shop building
    app.selectShopType(0);
    // Find an owned lot for player 0
    const ownedLot = app.getGameState().lots.find((l) => l.owner === 0);
    if (ownedLot) {
      app.buildOnLot(ownedLot.id);
    }

    // Phase 4: Harvest yield with 1.20x staking multiplier
    const harvest = app.harvestYield();
    assert.ok(harvest.totalHarvest >= 0);

    // Phase 5: Advance to Year 2
    app.advanceToNextYear();
    assert.equal(app.getGameState().year, 2);
    assert.equal(app.getGameState().phase, 'receive');
  });

  it('computes Year 6 podium purse and point-to-$wif swap with 3% burn tax', () => {
    const app = new RobinTownApp(null);
    const settlement = app.getFinalSettlement();

    // 4,000 $wif match pool breakdown
    assert.equal(settlement.matchPool.totalPool, 4000);
    assert.equal(settlement.matchPool.burnedAmount, 200); // 5%
    assert.equal(settlement.matchPool.vaultAmount, 200); // 5%
    assert.equal(settlement.matchPool.purseAmount, 3600); // 90%

    // 60/25/15 podium distribution for top 3 finishers
    const payouts = settlement.matchPool.podium;
    assert.equal(payouts.length, 3);
    assert.equal(payouts[0].payout, 2160); // 60%
    assert.equal(payouts[1].payout, 900); // 25%
    assert.equal(payouts[2].payout, 540); // 15%
    assert.equal(settlement.matchPool.payouts[3], 0); // 4th place gets 0

    // Point swap: 100 points -> 10 gross $wif, 3% burn tax (1 $wif), 9 net $wif
    const swap = app.swapPointsForWif(100);
    assert.equal(swap.grossWif, 10);
    assert.equal(swap.burnedWif, 1);
    assert.equal(swap.netWif, 9);
  });
});

describe('Dual-Mode Wallet and Multiplayer Room Integration', () => {
  it('switches between simulation and web3 modes cleanly', async () => {
    const app = new RobinTownApp(null);
    const wallet = app.getWalletAdapter();
    await wallet.connect();

    assert.equal(wallet.getState().mode, 'simulation');
    assert.equal(wallet.getState().status, 'connected');
    assert.equal(wallet.getState().account?.balance, 10000);

    // Switch simulated account
    const accounts = wallet.getSimulatedAccounts();
    assert.equal(accounts.length, 4);

    await wallet.switchAccount(accounts[1].address);
    assert.equal(wallet.getState().account?.name, accounts[1].name);

    // Switch to web3 mode (falls back cleanly when no window.ethereum)
    await wallet.setMode('web3');
    assert.equal(wallet.getState().mode, 'simulation');
    assert.ok(wallet.getState().error?.includes('Web3 provider not detected'));

    // Switch to web3 mode with a valid mock provider
    const mockProvider = {
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0x9999999999999999999999999999999999999999'];
        if (method === 'eth_chainId') return '0xb626';
        if (method === 'eth_getBalance') return '0x0';
        return null;
      },
    };
    const web3Wallet = new WalletAdapter({ mode: 'simulation', provider: mockProvider });
    await web3Wallet.setMode('web3');
    assert.equal(web3Wallet.getState().mode, 'web3');
    assert.equal(web3Wallet.getState().status, 'connected');
  });

  it('validates 6-character room codes for multiplayer matchmaking', () => {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.equal(isValidRoomCode(code), true);
    assert.equal(normalizeRoomCode('abcdef'), 'ABCDEF');
    assert.equal(isValidRoomCode('INVALID_TOO_LONG'), false);
    assert.equal(isValidRoomCode('12'), false);
  });
});
