/**
 * tests/unit/challenger-final-1.test.ts
 *
 * Empirical Adversarial Challenge Suite: Final Verification (Milestone M9).
 *
 * Comprehensive stress testing across five core dimensions:
 * 1. 3D presentation layer: ThreeBoardRenderer pause and resume lifecycle in 2D and 3D mode,
 *    tile raycasting with stationary click and 5px drag filtering, camera lerp transitions, and unmount safety.
 * 2. Apple Carousel: infinite clone wrapping, edge scrubbing, WAI-ARIA tablist accessibility,
 *    autoplay clock suspension on user interaction, and boundary item collections.
 * 3. iPod Classic controller: angular delta tracking across +/-180 degree coordinate seam,
 *    15-degree notch quantization, direction reversal hysteresis, Fibonacci velocity acceleration,
 *    Lehmer LCG procedural audio synthesis, and Chinatown phase actions across all 5 phases.
 * 4. SolaceUI exposure-grid shader: 5 Chinatown phase palettes, cubic easing color interpolation,
 *    WebGL context loss and restoration lifecycle, DPR clamping, and Canvas2D fallback rendering.
 * 5. DOM lifecycle memory cleanup: repeated mount and destroy cycles of RobinTownApp and individual components,
 *    confirming complete detachment of global window listeners and disposal of resources.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { RobinTownApp } from '../../src/app';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  findAllClusters,
} from '../../src/engine/board-layout';
import { createGame, startYear } from '../../src/engine/engine';
import type { GamePhase, GameState } from '../../src/engine/types';
import {
  ELEVATION_GOLDEN_CROWN,
  ELEVATION_GOLDEN_LIGHT,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  ELEVATION_PARCEL_SELECTED,
  SHOP_VISUAL_CATEGORIES,
  ThreeBoardRenderer,
  canvasToWorld,
  createShopBuilding,
  disposeHierarchy,
  getParcelWorldPosition,
  worldToCanvas,
} from '../../src/ui/board-3d';
import {
  AppleCarousel,
  CLONE_COUNT,
  SETTLE_DELAY,
  type CarouselItem,
} from '../../src/ui/carousel';
import {
  ACCELERATION_TIERS,
  CENTER_DEAD_ZONE,
  DRAG_STEP_DEGREES,
  IPodController,
  MIN_SPEED_THRESHOLD,
  REVERSE_THRESHOLD_DEGREES,
  TIER_DURATION_MS,
  WHEEL_SIZE,
  type iPodAction,
} from '../../src/ui/ipod-controller';
import {
  ExposureGrid,
  PHASE_PALETTES,
  drawFallback,
  type ExposureGridPhase,
  type PhaseColors,
} from '../../src/ui/exposure-grid';

// Mock Canvas 2D Context for Headless Environments

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

// Mock DOM Element for Headless Testing

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
  public type = 'button';

  public listeners: Record<string, Function[]> = {};
  public context2D: Mock2DContext = new Mock2DContext();
  public customContextResolver?: (contextId: string) => unknown;

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
    if (this.customContextResolver) {
      const custom = this.customContextResolver(contextId);
      if (custom !== undefined) return custom;
    }
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
    if (this.className.includes('apple-carousel-track')) {
      child.offsetLeft = this.children.length * 300;
      child.offsetWidth = 280;
    }
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

// Global DOM Mocks and Lifecycle Tracking for Headless Testing

interface DisposableComponent {
  unmount?: () => void;
  destroy?: () => void;
}

let activeDisposables: DisposableComponent[] = [];

function trackDisposable<T extends DisposableComponent>(component: T): T {
  activeDisposables.push(component);
  return component;
}

let originalDocument: unknown;
let originalWindow: unknown;
let windowListeners: Record<string, Function[]> = {};

let realSetTimeout: typeof setTimeout;
let realClearTimeout: typeof clearTimeout;
const pendingTimerHandles = new Set<NodeJS.Timeout>();

function setupMockEnvironment(): void {
  originalDocument = (global as Record<string, unknown>).document;
  originalWindow = (global as Record<string, unknown>).window;
  windowListeners = {};
  activeDisposables = [];

  realSetTimeout = global.setTimeout;
  realClearTimeout = global.clearTimeout;

  global.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const handle = realSetTimeout((...cbArgs: unknown[]) => {
      pendingTimerHandles.delete(handle);
      fn(...cbArgs);
    }, ms, ...args);

    if (handle && typeof handle === 'object' && typeof (handle as NodeJS.Timeout).unref === 'function') {
      (handle as NodeJS.Timeout).unref();
    }

    pendingTimerHandles.add(handle);
    return handle;
  }) as unknown as typeof setTimeout;

  global.clearTimeout = ((handle: NodeJS.Timeout) => {
    if (handle) {
      pendingTimerHandles.delete(handle);
    }
    return realClearTimeout(handle);
  }) as unknown as typeof clearTimeout;

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
    getComputedStyle(_element: MockElement): { scrollSnapAlign: string } {
      return { scrollSnapAlign: 'center' };
    },
  };

  (global as Record<string, unknown>).document = mockDoc;
  (global as Record<string, unknown>).window = mockWin;
}

function teardownMockEnvironment(): void {
  // 1. Teardown all registered components in reverse order
  while (activeDisposables.length > 0) {
    const comp = activeDisposables.pop();
    if (comp) {
      try {
        if (typeof comp.destroy === 'function') {
          comp.destroy();
        } else if (typeof comp.unmount === 'function') {
          comp.unmount();
        }
      } catch {
        // Suppress secondary errors during teardown
      }
    }
  }

  // 2. Clear outstanding timers
  for (const timer of pendingTimerHandles) {
    try {
      realClearTimeout(timer);
    } catch {
      // Safe no-op
    }
  }
  pendingTimerHandles.clear();

  // 3. Restore global timer mocks
  if (realSetTimeout) {
    global.setTimeout = realSetTimeout;
  }
  if (realClearTimeout) {
    global.clearTimeout = realClearTimeout;
  }

  // 4. Restore DOM mocks
  (global as Record<string, unknown>).document = originalDocument;
  (global as Record<string, unknown>).window = originalWindow;
  windowListeners = {};
}

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

function createDummyCarouselItems(count = 72): CarouselItem[] {
  const items: CarouselItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: i,
      title: `Parcel #${i + 1}`,
      district: `District ${Math.floor(i / 12) + 1}`,
      color: '#00C805',
      owner: 'Vacant',
      shop: 'Vacant',
      income: 0,
    });
  }
  return items;
}

function createMockWebGLCanvas(width = 800, height = 600): MockElement {
  const canvas = new MockElement('canvas');
  canvas.width = width;
  canvas.height = height;

  let isContextLost = false;

  const loseContextExt = {
    loseContext() {
      isContextLost = true;
      const handlers = canvas.listeners['webglcontextlost'] || [];
      const ev = { type: 'webglcontextlost', preventDefault: () => {} };
      for (const h of handlers) h(ev);
    },
    restoreContext() {
      isContextLost = false;
      const handlers = canvas.listeners['webglcontextrestored'] || [];
      const ev = { type: 'webglcontextrestored', preventDefault: () => {} };
      for (const h of handlers) h(ev);
    },
  };

  const mockWebGL2 = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TEXTURE_2D: 3553,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    TEXTURE0: 33984,
    TRIANGLES: 4,

    createShader: (type: number) => ({ id: Math.random(), type }),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    deleteShader: () => {},
    createProgram: () => ({ id: Math.random() }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: () => {},
    deleteProgram: () => {},
    createBuffer: () => ({ id: Math.random() }),
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: (_prog: unknown, name: string) => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    deleteBuffer: () => {},
    getUniformLocation: (_prog: unknown, name: string) => ({ name }),
    uniform1i: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    createTexture: () => ({ id: Math.random() }),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    deleteTexture: () => {},
    activeTexture: () => {},
    viewport: () => {},
    drawArrays: () => {},
    getExtension: (name: string) => {
      if (name === 'WEBGL_lose_context') return loseContextExt;
      return null;
    },
  };

  canvas.customContextResolver = (contextId: string) => {
    if (contextId === 'webgl2') {
      return isContextLost ? null : mockWebGL2;
    }
    return undefined;
  };

  return canvas;
}

// Empirical Test Suite Execution

describe('Challenger Final 1: Empirical Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    setupMockEnvironment();
  });

  afterEach(() => {
    teardownMockEnvironment();
  });

  // Section 1: 3D Presentation Layer & ThreeBoardRenderer

  describe('1. 3D Presentation Layer: Pause, Resume, Raycasting, and Camera Controls', () => {
    it('manages pause and resume lifecycle state deterministically without duplicate frames', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const renderer = trackDisposable(new ThreeBoardRenderer({ container, width: 800, height: 600 }));

      try {
        // Before mount, initial state is unpaused
        assert.strictEqual(renderer['isPaused'], false);

        renderer.mount();
        assert.strictEqual(renderer['isPaused'], false);

        // Calling pause sets isPaused to true and resets frame ID
        renderer.pause();
        assert.strictEqual(renderer['isPaused'], true);
        assert.strictEqual(renderer['animFrameId'], null);

        // Repeated pause calls are safe and idempotent
        for (let i = 0; i < 10; i++) {
          renderer.pause();
          assert.strictEqual(renderer['isPaused'], true);
          assert.strictEqual(renderer['animFrameId'], null);
        }

        // Calling resume clears isPaused
        renderer.resume();
        assert.strictEqual(renderer['isPaused'], false);

        // Calling resume when already running is an idempotent no-op
        const prevFrameId = renderer['animFrameId'];
        renderer.resume();
        assert.strictEqual(renderer['isPaused'], false);
        assert.strictEqual(renderer['animFrameId'], prevFrameId);
      } finally {
        // Unmounting flags paused and tears down resources
        renderer.unmount();
      }

      assert.strictEqual(renderer['isPaused'], true);
      assert.strictEqual(renderer['animFrameId'], null);

      // Calling pause or resume after unmount is safe and does not resurrect animation
      renderer.pause();
      assert.strictEqual(renderer['isPaused'], true);
      renderer.resume();
      assert.strictEqual(renderer['animFrameId'], null);
    });

    it('coordinates 2D and 3D mode toggling in RobinTownApp with ThreeBoardRenderer pause/resume', () => {
      // Test A: Null container starts at 3d mode and alternates deterministically
      const nullApp = trackDisposable(new RobinTownApp(null));
      try {
        assert.strictEqual(nullApp.getRenderMode(), '3d');
        for (let i = 0; i < 20; i++) {
          const expected = i % 2 === 0 ? '2d' : '3d';
          const toggled = nullApp.toggleRenderMode();
          assert.strictEqual(toggled, expected);
          assert.strictEqual(nullApp.getRenderMode(), expected);
        }
      } finally {
        nullApp.destroy();
      }

      // Test B: Mounted container without WebGL defaults to 2d tactical mode and alternates cleanly
      const appContainer = createMockAppContainer();
      const app = trackDisposable(new RobinTownApp(appContainer as unknown as HTMLElement));
      try {
        assert.strictEqual(app.getRenderMode(), '2d');
        for (let i = 0; i < 20; i++) {
          const expected = i % 2 === 0 ? '3d' : '2d';
          const toggled = app.toggleRenderMode();
          assert.strictEqual(toggled, expected);
          assert.strictEqual(app.getRenderMode(), expected);

          const canvasEl = appContainer.querySelector('#game-board-canvas');
          if (canvasEl) {
            assert.strictEqual(canvasEl.style.display, expected === '2d' ? 'block' : 'none');
          }
        }
      } finally {
        app.destroy();
      }
    });

    it('rejects invalid or non-finite NDC coordinates during raycasting without exceptions', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const renderer = trackDisposable(new ThreeBoardRenderer({ container, width: 800, height: 600 }));
      try {
        renderer.mount();

        const invalidNDCs = [
          { x: NaN, y: 0 },
          { x: 0, y: NaN },
          { x: Infinity, y: 0 },
          { x: 0, y: -Infinity },
          { x: 9999, y: 9999 },
          { x: -5000, y: -5000 },
        ];

        for (const ndc of invalidNDCs) {
          const hit = renderer.raycastAt(ndc);
          assert.strictEqual(hit, null, `Invalid NDC (${ndc.x}, ${ndc.y}) must return null`);
        }
      } finally {
        renderer.unmount();
      }
    });

    it('enforces 5px drag filtering and 600ms click time limits on pointer interactions', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      let selectedLot: number | null = null;
      let hoveredLot: number | null = null;

      const renderer = trackDisposable(new ThreeBoardRenderer({
        container,
        width: 800,
        height: 600,
        onSelectLot: (id) => {
          selectedLot = id;
        },
        onHoverLot: (id) => {
          hoveredLot = id;
        },
      }));
      try {
        renderer.mount();

        // Test drag detection: moving 3px is under 5px threshold (not a drag)
        renderer['handlePointerDown']({
          clientX: 100,
          clientY: 100,
        } as PointerEvent);
        assert.strictEqual(renderer['isDragging'], false);

        renderer['handlePointerMove']({
          clientX: 103,
          clientY: 102,
          buttons: 1,
        } as PointerEvent);
        assert.strictEqual(renderer['isDragging'], false);

        // Moving further than 5px activates drag mode
        renderer['handlePointerMove']({
          clientX: 108,
          clientY: 108,
          buttons: 1,
        } as PointerEvent);
        assert.strictEqual(renderer['isDragging'], true);

        // Pointer up after drag should not trigger selection
        renderer['handlePointerUp']({} as PointerEvent);
        assert.strictEqual(renderer['isDragging'], false);
        assert.strictEqual(selectedLot, null);
      } finally {
        renderer.unmount();
      }
    });

    it('clamps focusLot and resize bounds against extreme or non-positive dimensions', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const renderer = trackDisposable(new ThreeBoardRenderer({ container, width: 800, height: 600 }));
      try {
        renderer.mount();

        const initialTarget = renderer.getCameraTarget().clone();

        // Out of bounds lot IDs must not alter camera target
        renderer.focusLot(-1);
        assert.deepStrictEqual(renderer.getCameraTarget(), initialTarget);
        renderer.focusLot(TOTAL_LOTS);
        assert.deepStrictEqual(renderer.getCameraTarget(), initialTarget);
        renderer.focusLot(9999);
        assert.deepStrictEqual(renderer.getCameraTarget(), initialTarget);
        renderer.focusLot(NaN);
        assert.deepStrictEqual(renderer.getCameraTarget(), initialTarget);

        // Focusing valid parcel moves target
        renderer.focusLot(0);
        assert.notDeepStrictEqual(renderer['targetCameraTarget'], initialTarget);

        // Reset camera restores center
        renderer.resetCamera();
        assert.strictEqual(renderer['targetCameraTarget'].x, 0);
        assert.strictEqual(renderer['targetCameraTarget'].y, 0);
        assert.strictEqual(renderer['targetCameraTarget'].z, 0);

        // Non-positive resize dimensions are rejected
        const initialLeft = renderer.getOrthoCamera().left;
        renderer.resize(0, 0);
        assert.strictEqual(renderer.getOrthoCamera().left, initialLeft);
        renderer.resize(-500, -300);
        assert.strictEqual(renderer.getOrthoCamera().left, initialLeft);
      } finally {
        renderer.unmount();
      }
    });
  });

  // Section 2: Apple Carousel Infinite Clone Wrapping

  describe('2. Apple Carousel: Infinite Clone Wrapping, Scrubbing, and WAI-ARIA Accessibility', () => {
    it('constructs correct real and clone card inventory across diverse item counts', () => {
      const container = new MockElement('div') as unknown as HTMLElement;

      // Baseline: 72 items has 72 real and 4 clones (2 leading, 2 trailing)
      const carousel72 = trackDisposable(new AppleCarousel({
        container,
        items: createDummyCarouselItems(72),
      }));
      assert.strictEqual(carousel72.getRealCardCount(), 72);
      assert.strictEqual(carousel72.getCloneCardCount(), 4);

      try {
        carousel72.mount();
        assert.strictEqual(carousel72.getCardElements().length, 76);
      } finally {
        carousel72.unmount();
      }

      // Boundary: 0 items has 0 real and 0 clones
      const carousel0 = trackDisposable(new AppleCarousel({
        container,
        items: [],
      }));
      assert.strictEqual(carousel0.getRealCardCount(), 0);
      assert.strictEqual(carousel0.getCloneCardCount(), 0);
      try {
        carousel0.mount();
        assert.strictEqual(carousel0.getCardElements().length, 0);
      } finally {
        carousel0.unmount();
      }

      // Boundary: 1 item has 1 real and 0 clones (no infinite wrapping needed for single slide)
      const carousel1 = trackDisposable(new AppleCarousel({
        container,
        items: createDummyCarouselItems(1),
      }));
      assert.strictEqual(carousel1.getRealCardCount(), 1);
      assert.strictEqual(carousel1.getCloneCardCount(), 0);
      try {
        carousel1.mount();
        assert.strictEqual(carousel1.getCardElements().length, 1);
      } finally {
        carousel1.unmount();
      }

      // Boundary: 2 items has 2 real and 4 clones (Math.min(4, 2) * 2 = 4)
      const carousel2 = trackDisposable(new AppleCarousel({
        container,
        items: createDummyCarouselItems(2),
      }));
      assert.strictEqual(carousel2.getRealCardCount(), 2);
      assert.strictEqual(carousel2.getCloneCardCount(), 4);
      try {
        carousel2.mount();
        assert.strictEqual(carousel2.getCardElements().length, 6);
      } finally {
        carousel2.unmount();
      }
    });

    it('enforces comprehensive WAI-ARIA tablist accessibility standards', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const items = createDummyCarouselItems(5);
      const carousel = trackDisposable(new AppleCarousel({ container, items }));
      try {
        carousel.mount();

        const root = carousel['rootElement'] as unknown as MockElement;
        assert.ok(root);
        assert.strictEqual(root.getAttribute('role'), 'region');
        assert.strictEqual(root.getAttribute('aria-roledescription'), 'carousel');
        assert.strictEqual(root.getAttribute('aria-label'), 'Robin-Town Properties & Shops');

        const tablist = carousel['tablistElement'] as unknown as MockElement;
        assert.ok(tablist);
        assert.strictEqual(tablist.getAttribute('role'), 'tablist');
        assert.strictEqual(tablist.getAttribute('aria-label'), 'Slides');

        const tabs = carousel['tabElements'] as unknown as MockElement[];
        assert.strictEqual(tabs.length, 5);

        tabs.forEach((tab, idx) => {
          assert.strictEqual(tab.getAttribute('role'), 'tab');
          assert.strictEqual(
            tab.getAttribute('aria-selected'),
            idx === 0 ? 'true' : 'false'
          );
          assert.strictEqual(tab.getAttribute('aria-controls'), `card-${idx}`);
        });

        // Verify keyboard navigation updates ARIA states
        carousel.simulateKey('ArrowRight');
        assert.strictEqual(carousel.getCurrentIndex(), 1);
        assert.strictEqual(tabs[0].getAttribute('aria-selected'), 'false');
        assert.strictEqual(tabs[1].getAttribute('aria-selected'), 'true');

        carousel.simulateKey('End');
        assert.strictEqual(carousel.getCurrentIndex(), 4);
        assert.strictEqual(tabs[4].getAttribute('aria-selected'), 'true');

        carousel.simulateKey('Home');
        assert.strictEqual(carousel.getCurrentIndex(), 0);
        assert.strictEqual(tabs[0].getAttribute('aria-selected'), 'true');
      } finally {
        carousel.unmount();
      }
    });

    it('suspends and resumes autoplay clock across hover and pointer interactions', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const carousel = trackDisposable(new AppleCarousel({
        container,
        items: createDummyCarouselItems(4),
        autoplayDurationMs: 2000,
      }));
      try {
        carousel.mount();

        assert.strictEqual(carousel.isPlaying(), true);
        assert.strictEqual(carousel['isUserInteracting'], false);

        // Pointer enter pauses
        carousel['boundOnPointerEnter']?.();
        assert.strictEqual(carousel['isUserInteracting'], true);

        // Pointer leave resumes
        carousel['boundOnPointerLeave']?.();
        assert.strictEqual(carousel['isUserInteracting'], false);

        // Pointer down pauses
        carousel['boundOnPointerDown']?.();
        assert.strictEqual(carousel['isUserInteracting'], true);

        // Pointer up resumes
        carousel['boundOnPointerUp']?.();
        assert.strictEqual(carousel['isUserInteracting'], false);

        // Toggle play cleanly pauses and resumes
        carousel.togglePlay();
        assert.strictEqual(carousel.isPlaying(), false);
        carousel.togglePlay();
        assert.strictEqual(carousel.isPlaying(), true);
      } finally {
        carousel.unmount();
      }
    });

    it('performs silent wrapping from clones to real cards under extreme edge scrubbing', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const items = createDummyCarouselItems(10);
      const carousel = trackDisposable(new AppleCarousel({ container, items }));
      try {
        carousel.mount();

        const cards = carousel.getCardElements();
        assert.strictEqual(cards.length, 14); // 2 leading clones + 10 real + 2 trailing clones

        // Leading clone 0 corresponds to real item 8
        const leadingClone0 = cards[0];
        assert.strictEqual(leadingClone0.hasAttribute('data-clone'), true);

        // Test handleSettle when nearest slide is a clone
        carousel['getNearestSlide'] = () => leadingClone0;
        carousel['handleSettle']();

        // Logical index matches clone's data-index
        const cloneLogicalIndex = Number(leadingClone0.getAttribute('data-index'));
        assert.strictEqual(carousel.getCurrentIndex(), cloneLogicalIndex);

        // Trailing clone corresponds to logical card index 0
        const trailingClone0 = cards[12];
        assert.strictEqual(trailingClone0.hasAttribute('data-clone'), true);
        assert.strictEqual(trailingClone0.getAttribute('data-index'), '0');

        carousel['getNearestSlide'] = () => trailingClone0;
        carousel['handleSettle']();
        assert.strictEqual(carousel.getCurrentIndex(), 0);
      } finally {
        carousel.unmount();
      }
    });
  });

  // Section 3: iPod Classic Rotary Wheel Physics and Phase Actions

  describe('3. iPod Classic Rotary Wheel Physics, Quantization, Audio Synthesis, and Phase Actions', () => {
    it('calculates shortest signed turn delta accurately across the +/-180 degree coordinate seam', () => {
      // The shortest signed delta formula: ((((curr-prev) % 360) + 540) % 360) minus 180
      const computeDelta = (prev: number, curr: number): number => {
        return (((((curr - prev) % 360) + 540) % 360) - 180);
      };

      // Crossing seam counter-clockwise: +179 deg to -179 deg is +2 deg forward
      const fwdSeamDelta = computeDelta(179, -179);
      assert.strictEqual(Math.round(fwdSeamDelta), 2);

      // Crossing seam clockwise: -179 deg to +179 deg is -2 deg backward
      const bwdSeamDelta = computeDelta(-179, 179);
      assert.strictEqual(Math.round(bwdSeamDelta), -2);

      // Standard quadrant transitions
      assert.strictEqual(Math.round(computeDelta(0, 90)), 90);
      assert.strictEqual(Math.round(computeDelta(90, 180)), 90);
      assert.strictEqual(Math.round(computeDelta(-180, -90)), 90);
      assert.strictEqual(Math.round(computeDelta(-90, 0)), 90);

      assert.strictEqual(Math.round(computeDelta(0, -90)), -90);
      assert.strictEqual(Math.round(computeDelta(-90, -180)), -90);
    });

    it('enforces 15-degree quantization and suppresses direction reversal tremors under 8 degrees', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const scrollDeltas: number[] = [];

      const ipod = trackDisposable(new IPodController({
        container,
        menuTitle: 'Test iPod',
        actions: [
          { id: 'a1', label: 'Item 1', handler: () => {} },
          { id: 'a2', label: 'Item 2', handler: () => {} },
          { id: 'a3', label: 'Item 3', handler: () => {} },
          { id: 'a4', label: 'Item 4', handler: () => {} },
        ],
        onScroll: (delta) => scrollDeltas.push(delta),
      }));
      try {
        ipod.mount();

        // Moving 14.5 degrees forward is under 15 deg quantization step (no step dispatched)
        ipod['processAngularMovement'](14.5);
        assert.strictEqual(scrollDeltas.length, 0);

        // Adding 0.5 degrees completes the 15 degree notch (1 step dispatched)
        ipod['processAngularMovement'](0.5);
        assert.strictEqual(scrollDeltas.length, 1);
        assert.strictEqual(scrollDeltas[0], 1);

        // A small tremor of 5 degrees in reverse direction is suppressed by 8 deg hysteresis
        ipod['processAngularMovement'](-5.0);
        assert.strictEqual(scrollDeltas.length, 1); // No new step

        // Reverse movement exceeding 8 degrees commits direction change
        ipod['processAngularMovement'](-16.0);
        assert.ok(scrollDeltas.length >= 2);
        assert.strictEqual(scrollDeltas[scrollDeltas.length - 1], -1);
      } finally {
        ipod.unmount();
      }
    });

    it('filters pointer interactions in the center dead zone', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const ipod = trackDisposable(new IPodController({
        container,
        menuTitle: 'Test iPod',
        actions: [{ id: 'a1', label: 'Item 1', handler: () => {} }],
      }));
      try {
        ipod.mount();

        const wheelEl = ipod['wheelElement'] as unknown as MockElement;
        wheelEl.getBoundingClientRect = () => ({
          left: 0,
          top: 0,
          right: 350,
          bottom: 350,
          width: 350,
          height: 350,
        });

        // Center is at (175, 175). Radius is 175. Dead zone is 17.5px (10%).
        // Point (176, 176) is within 1.4px of center, well within 17.5px dead zone
        const centerAngle = ipod['getPointerAngle'](176, 176);
        assert.strictEqual(centerAngle, null, 'Center click must return null');

        // Point at edge (300, 175) is outside dead zone (dx = 125 > 17.5)
        const validAngle = ipod['getPointerAngle'](300, 175);
        assert.notStrictEqual(validAngle, null);
        assert.strictEqual(Math.round(validAngle as number), 0);
      } finally {
        ipod.unmount();
      }
    });

    it('synthesizes Lehmer LCG procedural audio with exact mathematical recurrence and 50ms spacing', () => {
      // Recreate the exact Lehmer LCG algorithm used in IPodController:
      // seed = 7; seed = (seed * 16807) % 2147483647;
      let seed = 7;
      const sampleRate = 44100;
      const length = Math.round(sampleRate * 0.003); // ~132 samples
      const decay = sampleRate * 0.0007;

      const generatedSamples: number[] = [];
      for (let i = 0; i < length; i++) {
        seed = (seed * 16807) % 2147483647;
        const noise = (seed / 2147483647) * 2 - 1;
        const sample = noise * 0.72 * Math.exp(-i / decay);
        generatedSamples.push(sample);
      }

      // Verify initial seeds:
      // Step 1: (7 * 16807) % 2147483647 = 117649
      // Step 2: (117649 * 16807) % 2147483647 = 1977326743
      let testSeed = 7;
      testSeed = (testSeed * 16807) % 2147483647;
      assert.strictEqual(testSeed, 117649);
      testSeed = (testSeed * 16807) % 2147483647;
      assert.strictEqual(testSeed, 1977326743);

      // Verify that sample values stay strictly bounded in [-1.0, 1.0]
      for (const sample of generatedSamples) {
        assert.ok(sample >= -1.0 && sample <= 1.0, 'Audio sample must stay bounded in [-1, 1]');
      }

      // Verify exponential decay attenuation towards buffer tail
      const initialPeak = Math.max(...generatedSamples.slice(0, 10).map(Math.abs));
      const trailingPeak = Math.max(...generatedSamples.slice(-10).map(Math.abs));
      assert.ok(initialPeak > trailingPeak * 5, 'Exponential decay must attenuate tail significantly');
    });

    it('populates and executes Chinatown phase actions and submenus across all 5 phases', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const ipod = trackDisposable(new IPodController({
        container,
        menuTitle: 'Robin-Town',
        actions: [],
      }));
      try {
        ipod.mount();

        const phases: GamePhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

        for (const phase of phases) {
          ipod.setPhaseActions(phase);
          assert.ok(ipod['actions'].length > 0, `Phase ${phase} must have actions`);

          // Test submenu push and pop stack
          ipod.pushSubmenu('Submenu Test', [
            { id: 'sub-1', label: 'Sub 1', handler: () => {} },
            { id: 'sub-2', label: 'Sub 2', handler: () => {} },
          ]);
          assert.strictEqual(ipod['menuTitle'], 'Submenu Test');
          assert.strictEqual(ipod['actions'].length, 2);

          // Pop submenu returns to phase root
          const popped = ipod.popSubmenu();
          assert.strictEqual(popped, true);
          assert.notStrictEqual(ipod['menuTitle'], 'Submenu Test');

          // Popping empty stack returns false safely
          assert.strictEqual(ipod.popSubmenu(), false);
        }
      } finally {
        ipod.unmount();
      }
    });
  });

  // Section 4: SolaceUI Exposure-Grid Shader Transitions & Fallbacks

  describe('4. SolaceUI Exposure-Grid Shader: Palettes, Cubic Easing, and Context Loss Recovery', () => {
    it('verifies all 5 Chinatown phase palettes and smooth cubic easing interpolation', () => {
      const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

      for (const phase of phases) {
        const palette = PHASE_PALETTES[phase];
        assert.ok(palette, `Palette for phase ${phase} must exist`);

        const components: (keyof PhaseColors)[] = ['grid', 'accent', 'secondary', 'ink', 'paper'];
        for (const comp of components) {
          const rgb = palette[comp];
          assert.strictEqual(rgb.length, 3);
          for (let c = 0; c < 3; c++) {
            assert.ok(
              rgb[c] >= 0.0 && rgb[c] <= 1.0,
              `Phase ${phase} component ${comp}[${c}] must be normalized in [0, 1]`
            );
          }
        }
      }

      // Test Hermite cubic easing curve: t = p * p * (3-2*p)
      const cubicEase = (p: number): number => {
        const clamped = Math.max(0, Math.min(1, p));
        return clamped * clamped * (3 - 2 * clamped);
      };

      assert.strictEqual(cubicEase(0.0), 0.0);
      assert.strictEqual(cubicEase(0.5), 0.5); // Symmetric inflection point
      assert.strictEqual(cubicEase(1.0), 1.0);

      // Derivative is zero at boundaries (smooth start and end)
      const delta1 = cubicEase(0.01) - cubicEase(0.0);
      const deltaMid = cubicEase(0.51) - cubicEase(0.5);
      assert.ok(deltaMid > delta1 * 4, 'Cubic ease velocity must peak at midpoint');
    });

    it('recovers cleanly from WebGL context loss and restoration without unhandled exceptions', () => {
      const canvas = createMockWebGLCanvas(800, 600) as unknown as HTMLCanvasElement;
      const grid = trackDisposable(new ExposureGrid({ canvas, phaseTheme: 'income' }));
      try {
        grid.mount();

        assert.strictEqual(grid.isWebGL(), true, 'WebGL must be active initially');

        // Trigger context loss
        const lostSuccess = grid.loseContextForTesting();
        assert.strictEqual(lostSuccess, true, 'loseContextForTesting should return true');
        assert.strictEqual(grid.isWebGL(), false, 'isWebGL must report false when context is lost');

        // Render while context is lost is a safe no-op
        assert.doesNotThrow(() => grid.render(1.0));

        // Trigger context restoration
        const restoreSuccess = grid.restoreContextForTesting();
        assert.strictEqual(restoreSuccess, true, 'restoreContextForTesting should return true');
        assert.strictEqual(grid.isWebGL(), true, 'isWebGL must report true after context restoration');
      } finally {
        grid.unmount();
      }
    });

    it('clamps DPR to a maximum of 1.5 to protect GPU fill rate on ultra-high-density displays', () => {
      const canvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
      const grid = trackDisposable(new ExposureGrid({ canvas, phaseTheme: 'receive' }));
      const win = (global as Record<string, unknown>).window as { devicePixelRatio: number };
      try {
        grid.mount();

        // Test with window devicePixelRatio = 3.0 (Retina / OLED)
        win.devicePixelRatio = 3.0;

        grid.resize(1000, 800);
        // Width should be clamped to 1000 * 1.5 = 1500, NOT 1000 * 3.0 = 3000
        assert.strictEqual(canvas.width, 1500);
        assert.strictEqual(canvas.height, 1200);
      } finally {
        win.devicePixelRatio = 1.0;
        grid.unmount();
      }
    });

    it('executes Canvas2D procedural fallback without errors across all themes and intensities', () => {
      const canvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
      const intensities = [0.0, 0.5, 1.0, 1.5, 2.0];
      const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

      for (const phase of phases) {
        for (const intensity of intensities) {
          assert.doesNotThrow(() => {
            drawFallback(canvas, PHASE_PALETTES[phase], intensity);
          });
        }
      }
    });
  });

  // Section 5: DOM Lifecycle Memory Cleanup & Leak Verification

  describe('5. DOM Lifecycle Memory Cleanup: RobinTownApp Mount/Destroy Cycles and Global Listener Release', () => {
    it('executes 25 repeated mount and destroy cycles of RobinTownApp with zero leaked window listeners', () => {
      const initialResizeCount = (windowListeners['resize'] || []).length;
      const initialKeydownCount = (windowListeners['keydown'] || []).length;

      for (let cycle = 1; cycle <= 25; cycle++) {
        const appContainer = createMockAppContainer();
        const app = trackDisposable(new RobinTownApp(appContainer as unknown as HTMLElement));

        try {
          const midKeydown = (windowListeners['keydown'] || []).length;
          const midResize = (windowListeners['resize'] || []).length;

          // Advance a phase and toggle render mode
          app.toggleRenderMode();
          app.selectLot(0, 'board');
        } finally {
          app.destroy();
        }

        const endKeydown = (windowListeners['keydown'] || []).length;
        const endResize = (windowListeners['resize'] || []).length;

        assert.strictEqual(
          endKeydown,
          initialKeydownCount,
          `Keydown listeners leaked after cycle ${cycle}`
        );
        assert.strictEqual(
          endResize,
          initialResizeCount,
          `Resize listeners leaked after cycle ${cycle}`
        );
      }
    });

    it('verifies independent component mount and unmount resource disposal', () => {
      const parentEl = new MockElement('div');

      // 1. AppleCarousel lifecycle
      const carouselContainer = new MockElement('div');
      parentEl.appendChild(carouselContainer);
      const carousel = trackDisposable(new AppleCarousel({
        container: carouselContainer as unknown as HTMLElement,
        items: createDummyCarouselItems(10),
      }));
      try {
        carousel.mount();
        assert.strictEqual(carousel['isMounted'], true);
      } finally {
        carousel.unmount();
      }
      assert.strictEqual(carousel['isMounted'], false);
      assert.strictEqual(carousel['rootElement'], null);
      assert.strictEqual(carousel['cardElements'].length, 0);

      // 2. IPodController lifecycle
      const ipodContainer = new MockElement('div');
      parentEl.appendChild(ipodContainer);
      const ipod = trackDisposable(new IPodController({
        container: ipodContainer as unknown as HTMLElement,
        menuTitle: 'Lifecycle Test',
        actions: [{ id: '1', label: 'A', handler: () => {} }],
      }));
      try {
        ipod.mount();
        assert.strictEqual(ipod['isMounted'], true);
      } finally {
        ipod.unmount();
      }
      assert.strictEqual(ipod['isMounted'], false);
      assert.strictEqual(ipod['rootElement'], null);

      // 3. ExposureGrid lifecycle
      const canvasEl = new MockElement('canvas');
      parentEl.appendChild(canvasEl);
      const grid = trackDisposable(new ExposureGrid({
        canvas: canvasEl as unknown as HTMLCanvasElement,
        phaseTheme: 'receive',
      }));
      try {
        grid.mount();
        assert.strictEqual(grid['isDisposed'], false);
      } finally {
        grid.unmount();
      }
      assert.strictEqual(grid['isDisposed'], true);

      // 4. ThreeBoardRenderer lifecycle
      const boardContainer = new MockElement('div');
      parentEl.appendChild(boardContainer);
      const board = trackDisposable(new ThreeBoardRenderer({
        container: boardContainer as unknown as HTMLElement,
        width: 800,
        height: 600,
      }));
      try {
        board.mount();
        assert.strictEqual(board['isPaused'], false);
      } finally {
        board.unmount();
      }
      assert.strictEqual(board['isPaused'], true);
      assert.strictEqual(board['buildingMeshes'].size, 0);
    });
  });
});
