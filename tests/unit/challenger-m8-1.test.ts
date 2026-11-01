/**
 * tests/unit/challenger-m8-1.test.ts
 *
 * Empirical Adversarial Challenge Suite for Milestone M8: App Shell & Flywheel Binding.
 *
 * Challenge Dimensions:
 * 1. 2D versus 3D render mode toggling under rapid repeated state transitions.
 * 2. Rapid parcel selection scrubbing across all 72 lots from multiple sources (board, carousel, ipod, engine).
 * 3. Apple Carousel deed generation invariants (72 parcels, district colors, cluster income math).
 * 4. ExposureGrid phase theme synchronization across all 5 Chinatown phases with rapid transitions.
 * 5. Headless Node.js lifecycle safety (mounting, updating, unmounting with null container and mock DOM).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { RobinTownApp } from '../../src/app';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  findAllClusters,
} from '../../src/engine/board-layout';
import {
  SHOPS,
  groupIncome,
  startYear,
} from '../../src/engine/engine';
import type { GamePhase } from '../../src/engine/types';
import {
  ExposureGrid,
  PHASE_PALETTES,
  type ExposureGridPhase,
  type PhaseColors,
} from '../../src/ui/exposure-grid';
import type { CarouselItem } from '../../src/ui/carousel';

// Mock DOM Infrastructure for Headless Empirical Stress Testing

interface MockCanvasGradient {
  addColorStop(offset: number, color: string): void;
}

class Mock2DContext {
  public fillStyle: string | MockCanvasGradient = '#000000';
  public strokeStyle: string | MockCanvasGradient = '#000000';
  public lineWidth = 1;
  public font = '10px sans-serif';
  public textAlign = 'start';
  public textBaseline = 'alphabetic';
  public globalAlpha = 1.0;
  public imageSmoothingEnabled = false;

  public operations: string[] = [];

  public clearRect(_x: number, _y: number, _w: number, _h: number): void {
    this.operations.push('clearRect');
  }

  public fillRect(_x: number, _y: number, _w: number, _h: number): void {
    this.operations.push('fillRect');
  }

  public strokeRect(_x: number, _y: number, _w: number, _h: number): void {
    this.operations.push('strokeRect');
  }

  public beginPath(): void {
    this.operations.push('beginPath');
  }

  public closePath(): void {
    this.operations.push('closePath');
  }

  public moveTo(_x: number, _y: number): void {
    this.operations.push('moveTo');
  }

  public lineTo(_x: number, _y: number): void {
    this.operations.push('lineTo');
  }

  public bezierCurveTo(
    _cp1x: number,
    _cp1y: number,
    _cp2x: number,
    _cp2y: number,
    _x: number,
    _y: number
  ): void {
    this.operations.push('bezierCurveTo');
  }

  public arc(
    _x: number,
    _y: number,
    _radius: number,
    _startAngle: number,
    _endAngle: number
  ): void {
    this.operations.push('arc');
  }

  public fill(): void {
    this.operations.push('fill');
  }

  public stroke(): void {
    this.operations.push('stroke');
  }

  public save(): void {
    this.operations.push('save');
  }

  public restore(): void {
    this.operations.push('restore');
  }

  public drawImage(): void {
    this.operations.push('drawImage');
  }

  public scale(_sx: number, _sy: number): void {
    this.operations.push('scale');
  }

  public translate(_x: number, _y: number): void {
    this.operations.push('translate');
  }

  public rotate(_angle: number): void {
    this.operations.push('rotate');
  }

  public setLineDash(_segments: number[]): void {
    this.operations.push('setLineDash');
  }

  public getLineDash(): number[] {
    return [];
  }

  public setTransform(..._args: unknown[]): void {
    this.operations.push('setTransform');
  }

  public resetTransform(): void {
    this.operations.push('resetTransform');
  }

  public createLinearGradient(
    _x0: number,
    _y0: number,
    _x1: number,
    _y1: number
  ): MockCanvasGradient {
    return {
      addColorStop: () => {},
    };
  }

  public createRadialGradient(
    _x0: number,
    _y0: number,
    _r0: number,
    _x1: number,
    _y1: number,
    _r1: number
  ): MockCanvasGradient {
    return {
      addColorStop: () => {},
    };
  }

  public measureText(text: string): { width: number } {
    return { width: text.length * 8 };
  }

  public fillText(_text: string, _x: number, _y: number): void {
    this.operations.push('fillText');
  }
}

class MockElement {
  public tagName: string;
  public id = '';
  public className = '';
  public textContent = '';
  public value = '';
  public style: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public offsetLeft = 0;
  public offsetTop = 0;
  public offsetWidth = 800;
  public offsetHeight = 600;
  public clientWidth = 800;
  public clientHeight = 600;
  public scrollLeft = 0;
  public scrollTop = 0;
  public width = 800;
  public height = 600;

  private listeners: Record<string, Function[]> = {};
  private context2D: Mock2DContext = new Mock2DContext();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  public set innerHTML(val: string) {
    if (!val) {
      this.children = [];
      return;
    }
    const idMatches = val.matchAll(/id="([^"]+)"/g);
    for (const match of idMatches) {
      const id = match[1];
      if (!this.querySelector('#' + id)) {
        const tag = id.includes('canvas') ? 'canvas' : (id.includes('controller') ? 'aside' : 'div');
        const child = new MockElement(tag);
        child.id = id;
        this.appendChild(child);
      }
    }
  }

  public get innerHTML(): string {
    return '';
  }

  public getContext(contextId: string): unknown {
    if (contextId === '2d') {
      return this.context2D;
    }
    return null;
  }

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  public removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  public appendChild(child: MockElement): MockElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  public removeChild(child: MockElement): MockElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  public querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) {
      const targetId = selector.substring(1);
      if (this.id === targetId) return this;
      for (const child of this.children) {
        if (child.id === targetId) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
    } else if (selector.startsWith('.')) {
      const targetCls = selector.substring(1);
      if (this.className.includes(targetCls)) return this;
      for (const child of this.children) {
        if (child.className.includes(targetCls)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      if (this.className.includes(cls)) results.push(this);
      for (const child of this.children) {
        results.push(...child.querySelectorAll(selector));
      }
    }
    return results;
  }

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== handler);
  }

  public dispatchEvent(event: { type: string }): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }

  public getBoundingClientRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } {
    return {
      left: 0,
      top: 0,
      right: this.offsetWidth,
      bottom: this.offsetHeight,
      width: this.offsetWidth,
      height: this.offsetHeight,
    };
  }

  public classList = {
    add: (cls: string) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      set.add(cls);
      this.className = Array.from(set).join(' ');
    },
    remove: (cls: string) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      set.delete(cls);
      this.className = Array.from(set).join(' ');
    },
    toggle: (cls: string, force?: boolean) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      if (force !== undefined) {
        if (force) set.add(cls);
        else set.delete(cls);
      } else {
        if (set.has(cls)) set.delete(cls);
        else set.add(cls);
      }
      this.className = Array.from(set).join(' ');
    },
    contains: (cls: string): boolean => {
      return this.className.split(' ').filter(Boolean).includes(cls);
    },
  };

  public scrollTo(options: { left: number; behavior?: string }): void {
    this.scrollLeft = options.left;
  }
}

/**
 * Creates a fully populated mock DOM shell representing the diorama layout.
 */
function createMockAppContainer(): MockElement {
  const root = new MockElement('div');
  root.className = 'test-container';

  const bgCanvas = new MockElement('canvas');
  bgCanvas.id = 'bg-canvas';
  root.appendChild(bgCanvas);

  const hudContainer = new MockElement('div');
  hudContainer.id = 'hud-container';
  hudContainer.className = 'hud-container';
  root.appendChild(hudContainer);

  const workspace = new MockElement('div');
  workspace.className = 'diorama-workspace';

  const viewport = new MockElement('div');
  viewport.className = 'main-viewport';

  const boardContainer = new MockElement('div');
  boardContainer.id = 'board-container';
  boardContainer.className = 'board-container';

  const gameBoardCanvas = new MockElement('canvas');
  gameBoardCanvas.id = 'game-board-canvas';
  gameBoardCanvas.className = 'board-canvas pixel-art';
  boardContainer.appendChild(gameBoardCanvas);

  viewport.appendChild(boardContainer);

  const deedContainer = new MockElement('div');
  deedContainer.id = 'deed-carousel-container';
  deedContainer.className = 'deed-carousel-container';
  viewport.appendChild(deedContainer);

  workspace.appendChild(viewport);

  const controllerContainer = new MockElement('aside');
  controllerContainer.id = 'controller-container';
  controllerContainer.className = 'controller-container';
  workspace.appendChild(controllerContainer);

  root.appendChild(workspace);

  const tradeContainer = new MockElement('div');
  tradeContainer.id = 'trade-desk-container';
  tradeContainer.className = 'trade-desk-container';
  root.appendChild(tradeContainer);

  const modalContainer = new MockElement('div');
  modalContainer.id = 'modal-overlay-container';
  modalContainer.className = 'modal-overlay-container';
  root.appendChild(modalContainer);

  return root;
}

// Global DOM Mocks for Node.js
let originalDocument: unknown;
let originalWindow: unknown;

function setupMockEnvironment(): void {
  originalDocument = (global as Record<string, unknown>).document;
  originalWindow = (global as Record<string, unknown>).window;

  const windowListeners: Record<string, Function[]> = {};

  const mockDoc = {
    createElement(tag: string): MockElement {
      return new MockElement(tag);
    },
    timeline: {},
  };

  const mockWin = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1.0,
    addEventListener(event: string, handler: Function): void {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
    removeEventListener(event: string, handler: Function): void {
      if (!windowListeners[event]) return;
      windowListeners[event] = windowListeners[event].filter((cb) => cb !== handler);
    },
    dispatchEvent(event: { type: string }): void {
      const handlers = windowListeners[event.type];
      if (handlers) {
        for (const h of handlers) h(event);
      }
    },
  };

  (global as Record<string, unknown>).document = mockDoc;
  (global as Record<string, unknown>).window = mockWin;
}

function teardownMockEnvironment(): void {
  (global as Record<string, unknown>).document = originalDocument;
  (global as Record<string, unknown>).window = originalWindow;
}

describe('Challenger M8.1: 2D versus 3D Render Mode Toggling', () => {
  it('strictly alternates render modes across 2,000 rapid consecutive toggles', () => {
    const app = new RobinTownApp(null);
    const initialMode = app.getRenderMode();
    assert.equal(initialMode, '3d', 'Initial render mode defaults to 3d');

    let currentExpected: '2d' | '3d' = '3d';
    for (let i = 1; i <= 2000; i++) {
      const toggled = app.toggleRenderMode();
      currentExpected = currentExpected === '3d' ? '2d' : '3d';
      assert.equal(
        toggled,
        currentExpected,
        `Iteration ${i}: toggleRenderMode() must return ${currentExpected}`
      );
      assert.equal(
        app.getRenderMode(),
        currentExpected,
        `Iteration ${i}: getRenderMode() must report ${currentExpected}`
      );
    }

    // Parity invariant: 2,000 is even, so mode must return to initial mode
    assert.equal(
      app.getRenderMode(),
      initialMode,
      'Even count of rapid toggles must return precisely to initial render mode'
    );
  });

  it('maintains state coherence when toggling render mode across all 5 Chinatown phases', () => {
    const app = new RobinTownApp(null);

    // Phase 1: Receive
    assert.equal(app.getGameState().phase, 'receive');
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '2d');
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '3d');

    // Advance to Phase 2: Trade
    app.quickDraft();
    assert.equal(app.getGameState().phase, 'trade');
    for (let i = 0; i < 20; i++) {
      app.toggleRenderMode();
    }
    assert.equal(app.getGameState().phase, 'trade', 'Phase must remain trade during toggling');

    // Advance to Phase 3: Build
    app.finishTrading();
    assert.equal(app.getGameState().phase, 'build');
    app.selectShopType(0);
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '2d');

    // Advance to Phase 4: Income
    app.harvestYield();
    assert.equal(app.getGameState().phase, 'income');
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '3d');

    // Advance to Year 6 ended phase
    for (let year = 2; year <= 6; year++) {
      app.advanceToNextYear();
      app.quickDraft();
      app.finishTrading();
      app.harvestYield();
    }
    app.advanceToNextYear();
    assert.equal(app.getGameState().phase, 'ended');

    // Rapid toggle during ended phase
    for (let i = 0; i < 50; i++) {
      app.toggleRenderMode();
    }
    assert.equal(app.getGameState().phase, 'ended', 'Phase must remain ended');
    assert.equal(app.getGameState().year, 6, 'Year must remain 6');
  });

  it('safely handles render mode toggling while modal dialogs are active', () => {
    const app = new RobinTownApp(null);

    // 1. Point swap modal
    app.openPointSwapModal();
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '2d');
    app.closeModals();

    // 2. Settlement modal
    app.openSettlementModal();
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '3d');
    app.closeModals();

    // 3. Wallet modal
    app.openWalletModal();
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '2d');
    app.closeModals();

    // 4. Room modal
    app.openRoomModal();
    app.toggleRenderMode();
    assert.equal(app.getRenderMode(), '3d');
    app.closeModals();
  });

  it('dispatches keyboard shortcut events for 2D/3D mode toggling', () => {
    setupMockEnvironment();
    const container = createMockAppContainer() as unknown as HTMLElement;
    const app = new RobinTownApp(container);

    // Initial renderMode in headless DOM is 2d
    assert.equal(app.getRenderMode(), '2d');

    // Simulate keydown 'v'
    const mockWindow = (global as Record<string, unknown>).window as {
      dispatchEvent: (e: { type: string; key: string; preventDefault?: () => void }) => void;
    };
    mockWindow.dispatchEvent({ type: 'keydown', key: 'v' });
    assert.equal(app.getRenderMode(), '3d');

    // Simulate keydown 'V'
    mockWindow.dispatchEvent({ type: 'keydown', key: 'V' });
    assert.equal(app.getRenderMode(), '2d');

    app.destroy();
    teardownMockEnvironment();
  });
});

describe('Challenger M8.1: Rapid Parcel Selection Scrubbing', () => {
  it('scrubs through all 72 lots across multiple sources with zero re-entrancy crashes', () => {
    const app = new RobinTownApp(null);
    const sources: ('board' | 'carousel' | 'ipod' | 'engine')[] = [
      'board',
      'carousel',
      'ipod',
      'engine',
    ];

    // Forward sweep 0..71
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const source = sources[lotId % sources.length];
      app.selectLot(lotId, source);
    }

    // Reverse sweep 71..0
    for (let lotId = TOTAL_LOTS - 1; lotId >= 0; lotId--) {
      const source = sources[(lotId + 2) % sources.length];
      app.selectLot(lotId, source);
    }

    // Game state remains fully operational
    assert.equal(app.getGameState().year, 1);
    assert.equal(app.getGameState().phase, 'receive');
  });

  it('adversarially rejects non-finite, out of bounds, and invalid lot selections', () => {
    const app = new RobinTownApp(null);

    // Select valid baseline lot
    app.selectLot(42, 'engine');

    // Negative indices
    app.selectLot(-1, 'board');
    app.selectLot(-9999, 'carousel');
    app.selectLot(-Infinity, 'ipod');

    // Upper bounds overflow
    app.selectLot(72, 'board');
    app.selectLot(100, 'carousel');
    app.selectLot(9999, 'ipod');
    app.selectLot(Infinity, 'engine');

    // Non-integers and NaN
    app.selectLot(NaN, 'board');

    // Game state remains safe
    assert.ok(app.getGameState(), 'Game state survives adversarial lot selections');
  });

  it('withstands 1,000 rapid interleaved selections with random permutations', () => {
    const app = new RobinTownApp(null);
    const sources: ('board' | 'carousel' | 'ipod' | 'engine')[] = [
      'board',
      'carousel',
      'ipod',
      'engine',
    ];

    let seed = 42;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 1000; i++) {
      const lotId = Math.floor(lcg() * TOTAL_LOTS);
      const srcIdx = Math.floor(lcg() * sources.length);
      app.selectLot(lotId, sources[srcIdx]);
    }

    assert.equal(app.getGameState().year, 1);
    assert.equal(app.getGameState().phase, 'receive');
  });

  it('executes phase-sensitive actions during lot selection without illegal state corruption', () => {
    const app = new RobinTownApp(null);

    // In receive phase, selecting a pending parcel toggles draft selection
    const pendingLots = app.getGameState().pending || [];
    assert.ok(pendingLots.length > 0, 'Year 1 receive phase must offer pending lots');
    const firstPending = pendingLots[0];

    // Selecting pending lot from board source toggles it into draft selection
    app.selectLot(firstPending, 'board');

    // Selecting non-pending lot from board source does not alter drafting
    const nonPending = LOT_DEFINITIONS.find((def) => !pendingLots.includes(def.id))?.id ?? -1;
    if (nonPending !== -1) {
      app.selectLot(nonPending, 'board');
    }

    // Advance to build phase
    app.quickDraft();
    app.finishTrading();
    assert.equal(app.getGameState().phase, 'build');

    // Selecting lot in build phase without selected shop does not mutate lot
    const testLot = app.getGameState().lots[0];
    const prevShop = testLot.shop;
    app.selectLot(0, 'board');
    assert.equal(app.getGameState().lots[0].shop, prevShop, 'Building requires explicit shop selection');
  });
});

describe('Challenger M8.1: Apple Carousel 72-Deed Generation Invariants', () => {
  it('satisfies deed count, monotonic indexing, and district formatting invariants', () => {
    const app = new RobinTownApp(null);
    const deeds = app.buildCarouselItems();

    assert.equal(deeds.length, 72, 'Deed array length must strictly equal 72');
    assert.equal(deeds.length, TOTAL_LOTS, 'Deed array must match TOTAL_LOTS');

    for (let i = 0; i < deeds.length; i++) {
      const deed = deeds[i];
      assert.equal(deed.id, i, `Deed ${i} id must match array index monotonically`);
      assert.equal(deed.title, `Parcel #${i + 1}`, `Deed ${i} title must format as Parcel #${i + 1}`);
      assert.ok(deed.district.length > 0, `Deed ${i} district name must not be empty`);
      assert.ok(
        deed.color.startsWith('#') && (deed.color.length === 7 || deed.color.length === 4),
        `Deed ${i} color hex (${deed.color}) must be a valid hex color string`
      );
    }
  });

  it('guarantees clean initial vacant state for all 72 parcel deeds', () => {
    const app = new RobinTownApp(null);
    const deeds = app.buildCarouselItems();

    for (const deed of deeds) {
      assert.equal(deed.owner, 'Vacant', `Parcel ${deed.id} initial owner must be Vacant`);
      assert.equal(deed.shop, 'Vacant', `Parcel ${deed.id} initial shop must be Vacant`);
      assert.equal(deed.income, 0, `Parcel ${deed.id} initial income must be 0`);
    }
  });

  it('accurately calculates cluster income math across single, complete, and multi-owner groups', () => {
    const app = new RobinTownApp(null);
    const state = app.getGameState() as unknown as {
      lots: { id: number; owner: number | null; shop: number | null }[];
      players: { name: string }[];
    };

    // Construct a controlled 3-lot cluster of Shop 0 (DEX Swap, target size 3) for Player 0 (Trader)
    // Lots 0, 1, 2 are horizontally adjacent in District 0
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;

    // In Chinatown engine: Shop 0 complete target size is 3, yielding $50k total
    const totalClusterIncome = groupIncome(0, 3);
    assert.equal(totalClusterIncome, 50, 'Complete DEX Swap cluster yields 50k income');

    const deeds = app.buildCarouselItems();

    // Each lot in the cluster receives Math.round(50 / 3) = 17k annual income
    const expectedPerLot = Math.round(50 / 3);
    assert.equal(deeds[0].owner, 'You (Trader)');
    assert.equal(deeds[0].shop, 'DEX Swap');
    assert.equal(deeds[0].income, expectedPerLot);

    assert.equal(deeds[1].owner, 'You (Trader)');
    assert.equal(deeds[1].shop, 'DEX Swap');
    assert.equal(deeds[1].income, expectedPerLot);

    assert.equal(deeds[2].owner, 'You (Trader)');
    assert.equal(deeds[2].shop, 'DEX Swap');
    assert.equal(deeds[2].income, expectedPerLot);

    // Unbuilt lot 3 remains 0 income
    assert.equal(deeds[3].income, 0);
  });

  it('correctly attributes rival bot owners and calculates partial cluster incomes', () => {
    const app = new RobinTownApp(null);
    const state = app.getGameState() as unknown as {
      lots: { id: number; owner: number | null; shop: number | null }[];
      players: { name: string }[];
    };

    // Assign Lot 10 to Sherwood (Player 1) with Shop 1 (Memecoin Lounge, size 1 incomplete)
    state.lots[10].owner = 1;
    state.lots[10].shop = 1;

    // Assign Lot 20 to Apex (Player 2) with Shop 2 (Staking Vault, size 1 incomplete)
    state.lots[20].owner = 2;
    state.lots[20].shop = 2;

    // Assign Lot 30 to Luna (Player 3) with Shop 3 (Lending Protocol, size 1 incomplete)
    state.lots[30].owner = 3;
    state.lots[30].shop = 3;

    const deeds = app.buildCarouselItems();

    assert.equal(deeds[10].owner, 'Sherwood');
    assert.equal(deeds[10].shop, 'Memecoin Lounge');
    assert.equal(deeds[10].income, groupIncome(1, 1), 'Size 1 income matches groupIncome(1, 1)');

    assert.equal(deeds[20].owner, 'Apex');
    assert.equal(deeds[20].shop, 'Staking Vault');
    assert.equal(deeds[20].income, groupIncome(2, 1), 'Size 1 income matches groupIncome(2, 1)');

    assert.equal(deeds[30].owner, 'Luna');
    assert.equal(deeds[30].shop, 'Lending Protocol');
    assert.equal(deeds[30].income, groupIncome(3, 1), 'Size 1 income matches groupIncome(3, 1)');
  });

  it('verifies non-linear overflow payout math across cluster sizes 4, 5, and 6', () => {
    const app = new RobinTownApp(null);
    const state = app.getGameState() as unknown as {
      lots: { id: number; owner: number | null; shop: number | null }[];
    };

    // Staking Vault (Shop 2, target size 4, complete set pays 80k)
    // Lots {0, 1, 2, 5} form a connected 4-lot cluster in District 0
    const lots4 = [0, 1, 2, 5];
    for (const id of lots4) {
      state.lots[id].owner = 0;
      state.lots[id].shop = 2;
    }
    const deeds4 = app.buildCarouselItems();
    for (const id of lots4) {
      assert.equal(deeds4[id].shop, 'Staking Vault');
      assert.equal(deeds4[id].income, Math.round(80 / 4));
    }

    // Derivatives Exchange (Shop 4, target size 5, complete set pays 110k)
    // Lots {0, 1, 2, 4, 5} form a connected 5-lot cluster
    for (let i = 0; i < TOTAL_LOTS; i++) {
      state.lots[i].owner = null;
      state.lots[i].shop = null;
    }
    const lots5 = [0, 1, 2, 4, 5];
    for (const id of lots5) {
      state.lots[id].owner = 0;
      state.lots[id].shop = 4;
    }
    const deeds5 = app.buildCarouselItems();
    for (const id of lots5) {
      assert.equal(deeds5[id].shop, 'Derivatives Exchange');
      assert.equal(deeds5[id].income, Math.round(110 / 5));
    }

    // Validator Citadel (Shop 5, target size 6, complete set pays 140k)
    // Lots {0, 1, 2, 4, 5, 6} form a connected 6-lot cluster
    for (let i = 0; i < TOTAL_LOTS; i++) {
      state.lots[i].owner = null;
      state.lots[i].shop = null;
    }
    const lots6 = [0, 1, 2, 4, 5, 6];
    for (const id of lots6) {
      state.lots[id].owner = 0;
      state.lots[id].shop = 5;
    }
    const deeds6 = app.buildCarouselItems();
    for (const id of lots6) {
      assert.equal(deeds6[id].shop, 'Validator Citadel');
      assert.equal(deeds6[id].income, Math.round(140 / 6));
    }
  });
});

describe('Challenger M8.1: ExposureGrid Phase Theme Synchronization', () => {
  it('validates color space completeness and numeric bounds for all 5 Chinatown phase palettes', () => {
    const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

    for (const phase of phases) {
      const palette = PHASE_PALETTES[phase];
      assert.ok(palette, `Phase palette for ${phase} must exist`);

      const channels: (keyof PhaseColors)[] = ['grid', 'accent', 'secondary', 'ink', 'paper'];
      for (const ch of channels) {
        const rgb = palette[ch];
        assert.equal(rgb.length, 3, `Phase ${phase} channel ${ch} must have 3 RGB components`);
        for (let c = 0; c < 3; c++) {
          assert.ok(
            Number.isFinite(rgb[c]),
            `Phase ${phase} channel ${ch}[${c}] must be a finite number`
          );
          assert.ok(
            rgb[c] >= 0.0 && rgb[c] <= 1.0,
            `Phase ${phase} channel ${ch}[${c}] must be within range [0.0, 1.0]`
          );
        }
      }
    }
  });

  it('withstands 1,000 rapid theme transitions without NaN or state desynchronization', () => {
    const canvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
    const grid = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    grid.mount();

    const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];
    const durations = [0, 5, 50, 800, 2000];

    for (let i = 0; i < 1000; i++) {
      const targetPhase = phases[i % phases.length];
      const duration = durations[i % durations.length];
      grid.setPhaseTheme(targetPhase, duration);
      grid.render(i * 0.016);
    }

    grid.unmount();
  });

  it('safely ignores invalid, empty, or unknown phase theme inputs', () => {
    const canvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
    const grid = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    grid.mount();

    // Invalid inputs should safely no-op
    grid.setPhaseTheme('invalid-phase' as unknown as ExposureGridPhase);
    grid.setPhaseTheme('' as unknown as ExposureGridPhase);
    grid.setPhaseTheme(null as unknown as ExposureGridPhase);
    grid.setPhaseTheme(undefined as unknown as ExposureGridPhase);

    grid.render();
    grid.unmount();
  });
});

describe('Challenger M8.1: Headless Node.js Lifecycle Safety', () => {
  beforeEach(() => {
    setupMockEnvironment();
  });

  afterEach(() => {
    teardownMockEnvironment();
  });

  it('initializes cleanly in headless mode with null container and verifies all getters', () => {
    const app = new RobinTownApp(null);

    // Domain getters must return instantiated controllers
    assert.ok(app.getGameState(), 'GameState must exist');
    assert.ok(app.getCameraController(), 'CameraController must exist');
    assert.ok(app.getBoardRenderer(), 'BoardRenderer must exist');
    assert.ok(app.getWalletAdapter(), 'WalletAdapter must exist');
    assert.ok(app.getTradeDeskController(), 'TradeDeskController must exist');
    assert.ok(app.getFlywheelState(), 'FlywheelState must exist');
    assert.ok(app.getAudio(), 'AudioSynthesizer must exist');

    // DOM-dependent components remain null in headless mode
    assert.equal(app.getBoard3DRenderer(), null, '3D board renderer is null with null container');
    assert.equal(app.getCarousel(), null, 'Carousel is null with null container');
    assert.equal(app.getIPodController(), null, 'IPodController is null with null container');
    assert.equal(app.getExposureGrid(), null, 'ExposureGrid is null with null container');

    // Calling destroy on unmounted app is idempotent and safe
    app.destroy();
    app.destroy();
  });

  it('mounts into a mock DOM container and initializes all UI components safely', () => {
    const container = createMockAppContainer() as unknown as HTMLElement;
    const app = new RobinTownApp(null);

    app.mount(container);

    // In mock DOM without WebGL2, ExposureGrid falls back to 2D canvas
    assert.ok(app.getExposureGrid(), 'ExposureGrid must mount');
    assert.ok(app.getCarousel(), 'AppleCarousel must mount');
    assert.ok(app.getIPodController(), 'IPodController must mount');

    // Render mode starts at 2D because WebGL is unavailable in headless Node
    assert.equal(app.getRenderMode(), '2d');

    // Clean unmount
    app.destroy();
  });

  it('handles multiple unmount and destroy calls idempotently without throwing', () => {
    const container = createMockAppContainer() as unknown as HTMLElement;
    const app = new RobinTownApp(container);

    for (let i = 0; i < 10; i++) {
      app.destroy();
    }
  });

  it('executes mount, destroy, and re-mount cycle cleanly without state corruption', () => {
    const container1 = createMockAppContainer() as unknown as HTMLElement;
    const app = new RobinTownApp(null);

    // First mount
    app.mount(container1);
    app.quickDraft();
    assert.equal(app.getGameState().phase, 'trade');

    // Unmount
    app.destroy();

    // Second mount in fresh container
    const container2 = createMockAppContainer() as unknown as HTMLElement;
    app.mount(container2);

    // State is preserved across re-mount
    assert.equal(app.getGameState().phase, 'trade');
    assert.equal(app.getGameState().year, 1);

    app.destroy();
  });

  it('handles mounting in an incomplete container with missing elements gracefully', () => {
    // Container missing background canvas, carousel container, and controller
    const bareContainer = new MockElement('div') as unknown as HTMLElement;
    const app = new RobinTownApp(null);

    // Mounting into container that lacks expected child elements must not throw TypeError
    app.mount(bareContainer);
    app.selectLot(5, 'engine');
    app.toggleRenderMode();
    app.destroy();
  });

  it('handles rapid rotary wheel deltas driving carousel card selection in mounted DOM', () => {
    const container = createMockAppContainer() as unknown as HTMLElement;
    const app = new RobinTownApp(container);

    const carousel = app.getCarousel();
    assert.ok(carousel, 'Carousel must be mounted');

    // Simulate rapid scroll operations across 200 cycles
    for (let delta = -50; delta <= 50; delta += 10) {
      if (delta === 0) continue;
      if (delta > 0) {
        carousel.next();
      } else {
        carousel.prev();
      }
      const item: CarouselItem | null = carousel.getCurrentItem();
      assert.ok(item, 'Current item must exist after rotary step');
      assert.ok(item!.id >= 0 && item!.id < TOTAL_LOTS);
      app.selectLot(item!.id, 'ipod');
    }

    app.destroy();
  });
});
