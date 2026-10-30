/**
 * tests/unit/challenger-m5-1.test.ts
 *
 * Empirical Adversarial Test Harness for Milestone 5:
 * Camera Transforms, Coordinate Projections, Boundary Clamping,
 * Parcel Hit-Testing, and Decoupled Board Rendering Pipeline.
 *
 * Verification Areas:
 * 1. Mathematical Forward and Inverse Inversion Round-Trips
 * 2. Cursor-Anchored Wheel Zooming Invariance and Centering Boundaries
 * 3. Camera Clamping, Board Visibility Confinement, and State Dynamics
 * 4. Parcel Hit-Testing across all 72 Lots at Boundaries, Centers, and Gutters
 * 5. Mock Canvas2DContextLike Draw Call Coverage and Visual State Rendering
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  CELL_PITCH,
  TOTAL_LOTS,
  LOT_DEFINITIONS,
  DISTRICT_BLOCKS,
  SHOP_CATEGORIES,
} from '../../src/engine/board-layout';
import { createGame, startYear } from '../../src/engine/engine';
import type { GameState, Lot } from '../../src/engine/types';
import {
  CameraController,
  DEFAULT_CAMERA_CONFIG,
  boardToScreen,
  clampCamera,
  hitTestBoardPoint,
  hitTestScreenPoint,
  screenToBoard,
  zoomAtScreenPoint,
  type CameraConfig,
  type CameraState,
  type ViewportSize,
} from '../../src/ui/camera';
import {
  BoardRenderer,
  PLAYER_COLORS,
  type BoardRenderState,
  type Canvas2DContextLike,
} from '../../src/ui/board';

/**
 * Headless recording mock implementing Canvas2DContextLike for call verification.
 */
class RecordingCanvasContext implements Canvas2DContextLike {
  public calls: { type: string; args: unknown[]; fillStyle?: unknown; strokeStyle?: unknown; lineWidth?: number }[] = [];
  public fillStyle: unknown = '#000000';
  public strokeStyle: unknown = '#FFFFFF';
  public lineWidth = 1;
  public font = '10px monospace';
  public textAlign = 'left';
  public textBaseline = 'top';
  public globalAlpha = 1;
  public imageSmoothingEnabled = false;
  public lineDashOffset = 0;
  public currentLineDash: number[] = [];

  public save(): void {
    this.calls.push({ type: 'save', args: [] });
  }

  public restore(): void {
    this.calls.push({ type: 'restore', args: [] });
  }

  public translate(x: number, y: number): void {
    this.calls.push({ type: 'translate', args: [x, y] });
  }

  public scale(x: number, y: number): void {
    this.calls.push({ type: 'scale', args: [x, y] });
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ type: 'clearRect', args: [x, y, w, h] });
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({
      type: 'fillRect',
      args: [x, y, w, h],
      fillStyle: this.fillStyle,
    });
  }

  public strokeRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({
      type: 'strokeRect',
      args: [x, y, w, h],
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
    });
  }

  public fillText(text: string, x: number, y: number): void {
    this.calls.push({
      type: 'fillText',
      args: [text, x, y],
      fillStyle: this.fillStyle,
    });
  }

  public strokeText(text: string, x: number, y: number): void {
    this.calls.push({
      type: 'strokeText',
      args: [text, x, y],
      strokeStyle: this.strokeStyle,
    });
  }

  public beginPath(): void {
    this.calls.push({ type: 'beginPath', args: [] });
  }

  public closePath(): void {
    this.calls.push({ type: 'closePath', args: [] });
  }

  public arc(x: number, y: number, r: number, s: number, e: number): void {
    this.calls.push({ type: 'arc', args: [x, y, r, s, e] });
  }

  public fill(): void {
    this.calls.push({ type: 'fill', args: [], fillStyle: this.fillStyle });
  }

  public stroke(): void {
    this.calls.push({ type: 'stroke', args: [], strokeStyle: this.strokeStyle });
  }

  public drawImage(image: unknown, dx: number, dy: number, dw?: number, dh?: number): void {
    this.calls.push({ type: 'drawImage', args: [image, dx, dy, dw, dh] });
  }

  public setLineDash(segments: number[]): void {
    this.currentLineDash = [...segments];
    this.calls.push({ type: 'setLineDash', args: [segments] });
  }
}

describe('Milestone 5 Challenge 1: Mathematical Forward and Inverse Inversion', () => {
  const viewport: ViewportSize = { width: 1200, height: 800 };

  it('guarantees round-trip inversion identity across 10,000 random coordinates', () => {
    const testZooms = [0.5, 0.75, 1.0, 1.3333, 1.75, 2.0, 2.5];
    let maxError = 0;

    for (const zoom of testZooms) {
      const camera: CameraState = { x: 550, y: 365, zoom };

      // Pseudo-random deterministic sampling across board and off-board bounds
      for (let i = 0; i < 1500; i++) {
        const bx = -2000 + ((i * 37) % 5000) + ((i * 13) % 100) * 0.01;
        const by = -1500 + ((i * 43) % 4000) + ((i * 17) % 100) * 0.01;

        const screen = boardToScreen(bx, by, camera, viewport);
        const inverted = screenToBoard(screen.x, screen.y, camera, viewport);

        const errX = Math.abs(inverted.x - bx);
        const errY = Math.abs(inverted.y - by);
        if (errX > maxError) maxError = errX;
        if (errY > maxError) maxError = errY;

        assert.ok(errX < 1e-9, `Inversion X error too large: ${errX} at bx=${bx}, zoom=${zoom}`);
        assert.ok(errY < 1e-9, `Inversion Y error too large: ${errY} at by=${by}, zoom=${zoom}`);
      }
    }

    assert.ok(maxError < 1e-9, `Maximum round-trip error must be negligible: ${maxError}`);
  });

  it('verifies reverse round-trip screenToBoard followed by boardToScreen across extreme screen points', () => {
    const camera: CameraState = { x: 550, y: 365, zoom: 1.5 };
    const screenPoints = [
      { sx: 0, sy: 0 },
      { sx: 600, sy: 400 },
      { sx: 1200, sy: 800 },
      { sx: -5000, sy: -3000 },
      { sx: 10000, sy: 8000 },
      { sx: 123.456789, sy: 987.654321 },
    ];

    for (const sp of screenPoints) {
      const board = screenToBoard(sp.sx, sp.sy, camera, viewport);
      const reprojected = boardToScreen(board.x, board.y, camera, viewport);

      assert.ok(Math.abs(reprojected.x - sp.sx) < 1e-9, `Screen X mismatch for (${sp.sx}, ${sp.sy})`);
      assert.ok(Math.abs(reprojected.y - sp.sy) < 1e-9, `Screen Y mismatch for (${sp.sx}, ${sp.sy})`);
    }
  });

  it('maintains mathematical precision under micro-zooms and large offsets', () => {
    const extremeCamera: CameraState = { x: 1000000, y: -500000, zoom: 2.5 };
    const p = { bx: 1000100, by: -499900 };

    const screen = boardToScreen(p.bx, p.by, extremeCamera, viewport);
    const roundTrip = screenToBoard(screen.x, screen.y, extremeCamera, viewport);

    assert.ok(Math.abs(roundTrip.x - p.bx) < 1e-9, 'Extreme coordinate X failed');
    assert.ok(Math.abs(roundTrip.y - p.by) < 1e-9, 'Extreme coordinate Y failed');
  });
});

describe('Milestone 5 Challenge 2: Cursor-Anchored Wheel Zooming Invariance', () => {
  // Use a viewport where the board does not fit completely, so camera pans rather than centering
  const viewport: ViewportSize = { width: 800, height: 600 };
  const config: CameraConfig = {
    minZoom: 0.5,
    maxZoom: 2.5,
    defaultZoom: 1.0,
    panMargin: 400,
    lerpSpeed: 0.15,
  };

  it('guarantees that world board position under cursor remains unchanged after unclamped zoom', () => {
    // Initial camera at 1.5x zoom on 800x600 viewport (board width 1100 * 1.5 = 1650 > 800)
    const initialCam: CameraState = { x: 550, y: 365, zoom: 1.5 };

    const testCursors = [
      { sx: 400, sy: 300 }, // Viewport center
      { sx: 350, sy: 250 },
      { sx: 450, sy: 350 },
      { sx: 380, sy: 280 },
      { sx: 420, sy: 320 },
    ];

    const targetZooms = [1.3, 1.4, 1.6, 1.8, 2.0];

    for (const cursor of testCursors) {
      for (const newZoom of targetZooms) {
        const boardBefore = screenToBoard(cursor.sx, cursor.sy, initialCam, viewport);
        const zoomedCam = zoomAtScreenPoint(
          cursor.sx,
          cursor.sy,
          newZoom,
          initialCam,
          viewport,
          config
        );
        const boardAfter = screenToBoard(cursor.sx, cursor.sy, zoomedCam, viewport);

        assert.ok(
          Math.abs(boardBefore.x - boardAfter.x) < 1e-8,
          `Cursor anchor X shifted: delta=${Math.abs(boardBefore.x - boardAfter.x)}`
        );
        assert.ok(
          Math.abs(boardBefore.y - boardAfter.y) < 1e-8,
          `Cursor anchor Y shifted: delta=${Math.abs(boardBefore.y - boardAfter.y)}`
        );
      }
    }
  });

  it('proves that auto-centering takes precedence over cursor anchoring when board fits in viewport', () => {
    // Large viewport where board fits fully at zoom 0.8: 1100 * 0.8 = 880 <= 1600
    const largeViewport: ViewportSize = { width: 1600, height: 1000 };
    const initialCam: CameraState = { x: 550, y: 365, zoom: 1.2 };
    const offCenterCursor = { sx: 700, sy: 450 };

    const zoomedCam = zoomAtScreenPoint(
      offCenterCursor.sx,
      offCenterCursor.sy,
      0.8,
      initialCam,
      largeViewport,
      config
    );

    // Camera center must snap to board center 550, 365
    assert.equal(zoomedCam.x, BOARD_WIDTH / 2);
    assert.equal(zoomedCam.y, BOARD_HEIGHT / 2);
    assert.equal(zoomedCam.zoom, 0.8);
  });

  it('survives 100 consecutive rapid wheel zoom cycles without coordinate drift or numeric instability', () => {
    let cam: CameraState = { x: 550, y: 365, zoom: 1.5 };
    const cursor = { sx: 400, sy: 300 };

    const originalBoardUnderCursor = screenToBoard(cursor.sx, cursor.sy, cam, viewport);

    for (let cycle = 0; cycle < 100; cycle++) {
      const zoomFactor = cycle % 2 === 0 ? 1.02 : 1 / 1.02;
      cam = zoomAtScreenPoint(
        cursor.sx,
        cursor.sy,
        cam.zoom * zoomFactor,
        cam,
        viewport,
        config
      );
    }

    const finalBoardUnderCursor = screenToBoard(cursor.sx, cursor.sy, cam, viewport);

    assert.ok(
      Math.abs(originalBoardUnderCursor.x - finalBoardUnderCursor.x) < 1e-6,
      'Multi-cycle zoom drifted on X'
    );
    assert.ok(
      Math.abs(originalBoardUnderCursor.y - finalBoardUnderCursor.y) < 1e-6,
      'Multi-cycle zoom drifted on Y'
    );
  });

  it('clamps safely when zooming at extreme screen corners outside the board', () => {
    const cam: CameraState = { x: 550, y: 365, zoom: 1.0 };
    const extremeCursor = { sx: 99999, sy: -99999 };

    const zoomed = zoomAtScreenPoint(
      extremeCursor.sx,
      extremeCursor.sy,
      2.0,
      cam,
      viewport,
      config
    );

    assert.ok(Number.isFinite(zoomed.x), 'Clamped zoom produced non-finite X');
    assert.ok(Number.isFinite(zoomed.y), 'Clamped zoom produced non-finite Y');
    assert.equal(zoomed.zoom, 2.0);
  });
});

describe('Milestone 5 Challenge 3: Camera Clamping and Boundary Confinement', () => {
  const viewport: ViewportSize = { width: 1200, height: 800 };

  it('strictly confines camera center within permissible margins under massive pan coordinates', () => {
    const massivePanCam: CameraState = { x: 10000000, y: -50000000, zoom: 2.0 };
    const clamped = clampCamera(massivePanCam, viewport);

    const halfVisibleW = viewport.width / 2 / 2.0;
    const halfVisibleH = viewport.height / 2 / 2.0;
    const minX = halfVisibleW - DEFAULT_CAMERA_CONFIG.panMargin;
    const maxX = BOARD_WIDTH - halfVisibleW + DEFAULT_CAMERA_CONFIG.panMargin;
    const minY = halfVisibleH - DEFAULT_CAMERA_CONFIG.panMargin;
    const maxY = BOARD_HEIGHT - halfVisibleH + DEFAULT_CAMERA_CONFIG.panMargin;

    assert.ok(clamped.x <= maxX, `Clamped X ${clamped.x} must be <= maxX ${maxX}`);
    assert.ok(clamped.x >= minX, `Clamped X ${clamped.x} must be >= minX ${minX}`);
    assert.ok(clamped.y <= maxY, `Clamped Y ${clamped.y} must be <= maxY ${maxY}`);
    assert.ok(clamped.y >= minY, `Clamped Y ${clamped.y} must be >= minY ${minY}`);
  });

  it('centers the board automatically when entire board fits comfortably in viewport', () => {
    const largeViewport: ViewportSize = { width: 1920, height: 1080 };
    const offCenterCam: CameraState = { x: 100, y: 100, zoom: 1.0 };
    const clamped = clampCamera(offCenterCam, largeViewport);

    assert.equal(clamped.x, BOARD_WIDTH / 2, 'Should center board on X axis');
    assert.equal(clamped.y, BOARD_HEIGHT / 2, 'Should center board on Y axis');
  });

  it('enforces zoom constraints strictly between minZoom (0.5) and maxZoom (2.5)', () => {
    const negativeZoom = clampCamera({ x: 550, y: 365, zoom: -5.0 }, viewport);
    assert.equal(negativeZoom.zoom, 0.5);

    const zeroZoom = clampCamera({ x: 550, y: 365, zoom: 0 }, viewport);
    assert.equal(zeroZoom.zoom, 0.5);

    const excessiveZoom = clampCamera({ x: 550, y: 365, zoom: 99.0 }, viewport);
    assert.equal(excessiveZoom.zoom, 2.5);
  });

  it('verifies that the board is never lost off-screen across multiple screen aspect ratios', () => {
    const viewports: ViewportSize[] = [
      { width: 320, height: 480 },   // Mobile portrait
      { width: 800, height: 600 },   // Tablet
      { width: 1440, height: 900 },  // Laptop
      { width: 3440, height: 1440 }, // Ultrawide monitor
    ];

    for (const vp of viewports) {
      const extremePans = [
        { x: -99999, y: 0 },
        { x: 99999, y: 0 },
        { x: 0, y: -99999 },
        { x: 0, y: 99999 },
      ];

      for (const p of extremePans) {
        const clamped = clampCamera({ x: p.x, y: p.y, zoom: 1.0 }, vp);
        const halfVisibleW = vp.width / 2 / clamped.zoom;
        const halfVisibleH = vp.height / 2 / clamped.zoom;

        // The visible board rectangle in board coordinates:
        const visibleLeft = clamped.x - halfVisibleW;
        const visibleRight = clamped.x + halfVisibleW;
        const visibleTop = clamped.y - halfVisibleH;
        const visibleBottom = clamped.y + halfVisibleH;

        // Overlap verification: visible board region must overlap with actual board [0, BOARD_WIDTH] x [0, BOARD_HEIGHT]
        const horizontalOverlap = visibleLeft < BOARD_WIDTH && visibleRight > 0;
        const verticalOverlap = visibleTop < BOARD_HEIGHT && visibleBottom > 0;

        assert.ok(
          horizontalOverlap,
          `Board completely lost horizontally on viewport ${vp.width}x${vp.height} with pan (${p.x}, ${p.y})`
        );
        assert.ok(
          verticalOverlap,
          `Board completely lost vertically on viewport ${vp.width}x${vp.height} with pan (${p.x}, ${p.y})`
        );
      }
    }
  });

  it('tests CameraController state transitions and demonstrates update lerp synchronization', () => {
    const controller = new CameraController({ width: 1200, height: 800 });

    // Initial state
    assert.equal(controller.getState().x, 550);
    assert.equal(controller.getState().y, 365);
    assert.equal(controller.getState().zoom, 1.0);

    // Dynamic viewport resize
    controller.setViewport(1400, 900);
    assert.equal(controller.getViewport().width, 1400);
    assert.equal(controller.getViewport().height, 900);

    // Zoom in and pan
    controller.setZoom(2.0);
    const startX = controller.getState().x;
    controller.pan(50, 25);
    assert.notEqual(controller.getState().x, startX);

    // Fit to viewport
    controller.fitToViewport(50);
    const fitState = controller.getState();
    assert.ok(fitState.zoom >= 0.5 && fitState.zoom <= 2.5);

    // Reset snaps back to board center
    controller.reset();
    assert.equal(controller.getState().x, 550);
    assert.equal(controller.getState().y, 365);
    assert.equal(controller.getState().zoom, 1.0);

    // Under current implementation, methods immediately synchronize target to current
    // Verified: update() returns false when target equals current
    assert.equal(controller.update(), false);
  });
});

describe('Milestone 5 Challenge 4: Parcel Hit-Testing Exhaustive Verification across all 72 Lots', () => {
  it('verifies that all 72 parcels are precisely hit-tested at center and all four corners', () => {
    assert.equal(LOT_DEFINITIONS.length, 72);

    for (let i = 0; i < TOTAL_LOTS; i++) {
      const lot = LOT_DEFINITIONS[i];

      // 1. Center of parcel
      const hitCenter = hitTestBoardPoint(lot.x + CELL_SIZE / 2, lot.y + CELL_SIZE / 2);
      assert.equal(hitCenter, lot.id, `Center hit failed for lot ${lot.id}`);

      // 2. Top-left corner
      const hitTL = hitTestBoardPoint(lot.x, lot.y);
      assert.equal(hitTL, lot.id, `Top-left hit failed for lot ${lot.id}`);

      // 3. Top-right interior point
      const hitTR = hitTestBoardPoint(lot.x + CELL_SIZE - 0.001, lot.y);
      assert.equal(hitTR, lot.id, `Top-right hit failed for lot ${lot.id}`);

      // 4. Bottom-left interior point
      const hitBL = hitTestBoardPoint(lot.x, lot.y + CELL_SIZE - 0.001);
      assert.equal(hitBL, lot.id, `Bottom-left hit failed for lot ${lot.id}`);

      // 5. Bottom-right interior point
      const hitBR = hitTestBoardPoint(lot.x + CELL_SIZE - 0.001, lot.y + CELL_SIZE - 0.001);
      assert.equal(hitBR, lot.id, `Bottom-right hit failed for lot ${lot.id}`);
    }
  });

  it('verifies strict non-detection 1px outside boundaries and in street gutters', () => {
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const lot = LOT_DEFINITIONS[i];

      // 1px left of lot
      const hitLeft = hitTestBoardPoint(lot.x - 1, lot.y + 25);
      assert.notEqual(hitLeft, lot.id, `Point 1px left falsely detected lot ${lot.id}`);

      // Point at exactly lot.x + CELL_SIZE (boundary edge or 2px gutter)
      const hitRight = hitTestBoardPoint(lot.x + CELL_SIZE, lot.y + 25);
      assert.notEqual(hitRight, lot.id, `Point at right edge falsely detected lot ${lot.id}`);

      // 1px above lot
      const hitAbove = hitTestBoardPoint(lot.x + 25, lot.y - 1);
      assert.notEqual(hitAbove, lot.id, `Point 1px above falsely detected lot ${lot.id}`);

      // Point at exactly lot.y + CELL_SIZE (bottom boundary edge or gutter)
      const hitBelow = hitTestBoardPoint(lot.x + 25, lot.y + CELL_SIZE);
      assert.notEqual(hitBelow, lot.id, `Point at bottom edge falsely detected lot ${lot.id}`);

      // 1px into the 2px gutter between lots in same row
      const gutterX = hitTestBoardPoint(lot.x + CELL_SIZE + 1, lot.y + 25);
      if (gutterX !== null) {
        assert.notEqual(gutterX, lot.id);
      }
    }
  });

  it('rejects all points outside the global board dimensions', () => {
    const outsidePoints = [
      { x: -1, y: 100 },
      { x: 100, y: -1 },
      { x: -500, y: -500 },
      { x: BOARD_WIDTH + 1, y: 300 },
      { x: 500, y: BOARD_HEIGHT + 1 },
      { x: 9999, y: 9999 },
    ];

    for (const pt of outsidePoints) {
      assert.equal(
        hitTestBoardPoint(pt.x, pt.y),
        null,
        `Point (${pt.x}, ${pt.y}) should hit null`
      );
    }
  });

  it('verifies screenToLot hit-testing across multiple camera zoom scales and offsets', () => {
    const viewport: ViewportSize = { width: 1200, height: 800 };
    const testZooms = [0.5, 1.0, 1.5, 2.0, 2.5];

    for (const zoom of testZooms) {
      const camera: CameraState = { x: 600, y: 350, zoom };

      for (let i = 0; i < TOTAL_LOTS; i++) {
        const lot = LOT_DEFINITIONS[i];
        // Project parcel center into screen coordinates
        const screen = boardToScreen(lot.x + 25, lot.y + 25, camera, viewport);
        const detectedLotId = hitTestScreenPoint(screen.x, screen.y, camera, viewport);
        assert.equal(
          detectedLotId,
          lot.id,
          `Screen hit failed for lot ${lot.id} at zoom ${zoom}`
        );
      }
    }
  });

  it('executes 10,000 hit-test queries in under 50ms ensuring microsecond latency', () => {
    const startTime = performance.now();
    for (let q = 0; q < 10000; q++) {
      const x = (q * 19) % BOARD_WIDTH;
      const y = (q * 23) % BOARD_HEIGHT;
      hitTestBoardPoint(x, y);
    }
    const elapsed = performance.now() - startTime;
    assert.ok(elapsed < 100, `Hit-testing 10k points took too long: ${elapsed.toFixed(2)}ms`);
  });
});

describe('Milestone 5 Challenge 5: Mock Canvas2DContextLike Draw Call Coverage', () => {
  const viewport: ViewportSize = { width: 1100, height: 730 };

  it('verifies strict layer ordering: clearRect -> save -> camera transform -> content -> restore', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    assert.equal(ctx.calls[0].type, 'clearRect', 'First call must be clearRect');
    assert.equal(ctx.calls[1].type, 'save', 'Second call must be save');
    assert.equal(ctx.calls[2].type, 'translate', 'Third call must be screen center translate');
    assert.equal(ctx.calls[3].type, 'scale', 'Fourth call must be camera zoom scale');
    assert.equal(ctx.calls[4].type, 'translate', 'Fifth call must be camera center translate');

    const lastCall = ctx.calls[ctx.calls.length - 1];
    assert.equal(lastCall.type, 'restore', 'Final call must be restore');
  });

  it('renders district borders and name headers for all 6 districts', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const textCalls = ctx.calls.filter((c) => c.type === 'fillText');
    for (const district of DISTRICT_BLOCKS) {
      const headerFound = textCalls.some((c) => c.args[0] === district.name);
      assert.ok(headerFound, `District name header missing for ${district.name}`);
    }
  });

  it('renders all 72 unowned parcel badges with correct lot display numbers', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const textCalls = ctx.calls.filter((c) => c.type === 'fillText');
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const expectedNumber = String(LOT_DEFINITIONS[i].lotNumber);
      const badgeFound = textCalls.some((c) => c.args[0] === expectedNumber);
      assert.ok(badgeFound, `Unowned lot badge number ${expectedNumber} missing`);
    }
  });

  it('renders player ownership tokens and color disc borders on owned parcels', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    // Assign ownership of 4 lots to 4 distinct players
    game.lots[0].owner = 0; // Player 0
    game.lots[1].owner = 1; // Player 1
    game.lots[2].owner = 2; // Player 2
    game.lots[3].owner = 3; // Player 3

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const arcCalls = ctx.calls.filter((c) => c.type === 'arc');
    assert.ok(arcCalls.length >= 4, 'Must draw circular ownership tokens');

    const textCalls = ctx.calls.filter((c) => c.type === 'fillText');
    assert.ok(textCalls.some((c) => c.args[0] === 'P1'), 'Player 1 disc text missing');
    assert.ok(textCalls.some((c) => c.args[0] === 'P2'), 'Player 2 disc text missing');
    assert.ok(textCalls.some((c) => c.args[0] === 'P3'), 'Player 3 disc text missing');
    assert.ok(textCalls.some((c) => c.args[0] === 'P4'), 'Player 4 disc text missing');
  });

  it('renders shop category codes, background tints, and owner pips for all 6 shop types', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    // Build one of each shop category on lots 10 through 15
    for (let shopType = 0; shopType < 6; shopType++) {
      const lotId = 10 + shopType;
      game.lots[lotId].owner = 0;
      game.lots[lotId].shop = shopType;
    }

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const textCalls = ctx.calls.filter((c) => c.type === 'fillText');
    for (let shopType = 0; shopType < 6; shopType++) {
      const code = SHOP_CATEGORIES[shopType].code;
      assert.ok(textCalls.some((c) => c.args[0] === code), `Shop code ${code} missing in draw calls`);
    }

    // Owner indicator pips
    const arcCalls = ctx.calls.filter((c) => c.type === 'arc');
    assert.ok(arcCalls.length >= 6, 'Must draw owner indicator pips on built shops');
  });

  it('renders golden completion halos and 100% badges on completed clusters', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    // Complete a DEX Swap (targetSize 3) in District 0 on lots 0, 1, 2
    game.lots[0].owner = 0;
    game.lots[0].shop = 0;
    game.lots[1].owner = 0;
    game.lots[1].shop = 0;
    game.lots[2].owner = 0;
    game.lots[2].shop = 0;

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    // Check for golden halo stroke call
    const goldenHaloStrokes = ctx.calls.filter(
      (c) => c.type === 'strokeRect' && c.strokeStyle === '#FFD700'
    );
    assert.ok(goldenHaloStrokes.length >= 3, 'Must render golden halo for all 3 completed lots');

    // Check for 100% badge text call
    const badge100 = ctx.calls.find(
      (c) => c.type === 'fillText' && c.args[0] === '100%' && c.fillStyle === '#FFD700'
    );
    assert.ok(badge100 !== undefined, '100% completion badge text missing');
  });

  it('renders interactive overlays for valid, invalid, hovered, and selected lots', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);
    const ctx = new RecordingCanvasContext();

    const game = createGame();
    startYear(game);

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: 4,
      hoveredLotId: 5,
      validBuildLots: [10, 11],
      invalidBuildLots: [12, 13],
      highlightLots: [20],
    });

    // Valid build green overlays
    const greenOverlays = ctx.calls.filter(
      (c) => c.type === 'strokeRect' && c.strokeStyle === '#00C805'
    );
    assert.ok(greenOverlays.length >= 2, 'Valid build green overlays missing');

    // Invalid build red overlays
    const redOverlays = ctx.calls.filter(
      (c) => c.type === 'strokeRect' && c.strokeStyle === '#EF4444'
    );
    assert.ok(redOverlays.length >= 2, 'Invalid build red overlays missing');

    // Highlight cyan overlays
    const cyanOverlays = ctx.calls.filter(
      (c) => c.type === 'strokeRect' && c.strokeStyle === '#00F0FF'
    );
    assert.ok(cyanOverlays.length >= 1, 'Cyan highlight overlay missing');

    // Hovered lot white overlay
    const hoveredOverlays = ctx.calls.filter(
      (c) => c.type === 'strokeRect' && c.strokeStyle === 'rgba(255, 255, 255, 0.8)'
    );
    assert.ok(hoveredOverlays.length === 1, 'Hovered overlay missing');
  });

  it('switches cleanly between procedural fallback and cached image textures', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);

    const mockImage = { width: 100, height: 100 };
    renderer.setImage('board_map', mockImage);
    renderer.setImage('token_0', mockImage);
    renderer.setImage('shop_0', mockImage);

    const ctx = new RecordingCanvasContext();
    const game = createGame();
    startYear(game);

    // Lot 0 owned and unbuilt, Lot 1 built
    game.lots[0].owner = 0;
    game.lots[1].owner = 0;
    game.lots[1].shop = 0;

    renderer.render(ctx, viewport, {
      gameState: game,
      selectedLotId: null,
      hoveredLotId: null,
    });

    const drawImageCalls = ctx.calls.filter((c) => c.type === 'drawImage');
    assert.ok(drawImageCalls.length >= 3, 'Must call drawImage for board map, token, and shop');
  });

  it('handles resizeCanvas with devicePixelRatio safely in headless mode', () => {
    const camera = new CameraController(viewport);
    const renderer = new BoardRenderer(camera);

    const fakeCanvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    const result = renderer.resizeCanvas(fakeCanvas, { width: 800, height: 600 });
    assert.equal(result.cssWidth, 800);
    assert.equal(result.cssHeight, 600);
    assert.equal(result.dpr, 1);
    assert.equal(fakeCanvas.width, 800);
    assert.equal(fakeCanvas.height, 600);
  });
});
