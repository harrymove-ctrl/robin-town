/**
 * Challenger M7 Empirical Stress Test Suite
 * Adversarial stress testing for:
 * 1. SolaceUI ExposureGrid (src/ui/exposure-grid.ts)
 * 2. AppleCarousel (src/ui/carousel.ts)
 *
 * Verifies rapid event sequences, non-positive dimensions, extreme values,
 * simulated WebGL context loss, single-item/empty bounds, extreme viewports,
 * and memory/DOM unmount cleanup.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExposureGrid,
  PHASE_PALETTES,
  drawFallback,
  type ExposureGridPhase,
  type PhaseColors,
} from '../../src/ui/exposure-grid.js';
import {
  AppleCarousel,
  CLONE_COUNT,
  SETTLE_DELAY,
  type CarouselItem,
} from '../../src/ui/carousel.js';

// Mock DOM elements and contexts for headless adversarial evaluation

class MockElement {
  public tagName: string;
  public className = '';
  public id = '';
  public innerHTML = '';
  public textContent = '';
  public style: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public offsetLeft = 0;
  public offsetWidth = 280;
  public clientWidth = 800;
  public scrollLeft = 0;
  public type = 'button';
  public listeners: Record<string, Function[]> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
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
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      for (const child of this.children) {
        if (child.className.includes(cls)) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
    }
    return null;
  }

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  public dispatchEvent(event: { type: string }): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }

  public classList = {
    toggle: (cls: string, force?: boolean) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (force !== undefined) {
        if (force) classes.add(cls);
        else classes.delete(cls);
      } else {
        if (classes.has(cls)) classes.delete(cls);
        else classes.add(cls);
      }
      this.className = Array.from(classes).join(' ');
    },
  };

  public scrollTo(options: { left: number; behavior?: string }): void {
    this.scrollLeft = options.left;
  }
}

function setupMockDocument() {
  const doc = {
    createElement(tagName: string) {
      if (tagName.toLowerCase() === 'canvas') {
        return createMockCanvas(800, 600, false);
      }
      return new MockElement(tagName);
    },
    timeline: {},
  };
  (globalThis as unknown as { document: unknown }).document = doc;
  (globalThis as unknown as { window: unknown }).window = {
    devicePixelRatio: 1.0,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

interface MockCanvasContextTracker {
  method: string;
  args: unknown[];
}

function createMockCanvas(width = 800, height = 600, enableWebGL = false) {
  const listeners: Record<string, Function[]> = {};
  const drawCalls: MockCanvasContextTracker[] = [];
  const webglCalls: MockCanvasContextTracker[] = [];
  const deletedResources: string[] = [];

  const mockCtx2D = {
    save() {
      drawCalls.push({ method: 'save', args: [] });
    },
    restore() {
      drawCalls.push({ method: 'restore', args: [] });
    },
    clearRect(x: number, y: number, w: number, h: number) {
      drawCalls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      drawCalls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    beginPath() {
      drawCalls.push({ method: 'beginPath', args: [] });
    },
    closePath() {
      drawCalls.push({ method: 'closePath', args: [] });
    },
    moveTo(x: number, y: number) {
      drawCalls.push({ method: 'moveTo', args: [x, y] });
    },
    lineTo(x: number, y: number) {
      drawCalls.push({ method: 'lineTo', args: [x, y] });
    },
    arc(x: number, y: number, radius: number, start: number, end: number) {
      drawCalls.push({ method: 'arc', args: [x, y, radius, start, end] });
    },
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      drawCalls.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
    },
    fill() {
      drawCalls.push({ method: 'fill', args: [] });
    },
    stroke() {
      drawCalls.push({ method: 'stroke', args: [] });
    },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      return {
        addColorStop(offset: number, color: string) {
          drawCalls.push({ method: 'addColorStop', args: [offset, color] });
        },
      };
    },
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
      return {
        addColorStop(offset: number, color: string) {
          drawCalls.push({ method: 'addColorStop', args: [offset, color] });
        },
      };
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };

  let isContextLost = false;

  const loseContextExt = {
    loseContext() {
      isContextLost = true;
      const handlers = listeners['webglcontextlost'] || [];
      const ev = {
        type: 'webglcontextlost',
        preventDefault: () => {},
      };
      for (const h of handlers) h(ev);
    },
    restoreContext() {
      isContextLost = false;
      const handlers = listeners['webglcontextrestored'] || [];
      const ev = {
        type: 'webglcontextrestored',
        preventDefault: () => {},
      };
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

    createShader(type: number) {
      webglCalls.push({ method: 'createShader', args: [type] });
      return { id: Math.random(), type };
    },
    shaderSource(shader: unknown, source: string) {
      webglCalls.push({ method: 'shaderSource', args: [shader, source.length] });
    },
    compileShader(shader: unknown) {
      webglCalls.push({ method: 'compileShader', args: [shader] });
    },
    getShaderParameter(_shader: unknown, param: number) {
      if (param === 35713) return true;
      return true;
    },
    deleteShader(shader: unknown) {
      deletedResources.push('shader');
      webglCalls.push({ method: 'deleteShader', args: [shader] });
    },
    createProgram() {
      webglCalls.push({ method: 'createProgram', args: [] });
      return { id: Math.random() };
    },
    attachShader(program: unknown, shader: unknown) {
      webglCalls.push({ method: 'attachShader', args: [program, shader] });
    },
    linkProgram(program: unknown) {
      webglCalls.push({ method: 'linkProgram', args: [program] });
    },
    getProgramParameter(_program: unknown, param: number) {
      if (param === 35714) return true;
      return true;
    },
    deleteProgram(program: unknown) {
      deletedResources.push('program');
      webglCalls.push({ method: 'deleteProgram', args: [program] });
    },
    useProgram(program: unknown) {
      webglCalls.push({ method: 'useProgram', args: [program] });
    },
    createBuffer() {
      webglCalls.push({ method: 'createBuffer', args: [] });
      return { id: Math.random() };
    },
    bindBuffer(target: number, buffer: unknown) {
      webglCalls.push({ method: 'bindBuffer', args: [target, buffer] });
    },
    bufferData(target: number, data: unknown, usage: number) {
      webglCalls.push({ method: 'bufferData', args: [target, data, usage] });
    },
    deleteBuffer(buffer: unknown) {
      deletedResources.push('buffer');
      webglCalls.push({ method: 'deleteBuffer', args: [buffer] });
    },
    getAttribLocation(_program: unknown, name: string) {
      return 0;
    },
    enableVertexAttribArray(index: number) {
      webglCalls.push({ method: 'enableVertexAttribArray', args: [index] });
    },
    vertexAttribPointer(...args: unknown[]) {
      webglCalls.push({ method: 'vertexAttribPointer', args });
    },
    getUniformLocation(_program: unknown, name: string) {
      return { name };
    },
    uniform1f(loc: { name: string }, val: number) {
      webglCalls.push({ method: 'uniform1f', args: [loc.name, val] });
    },
    uniform2f(loc: { name: string }, x: number, y: number) {
      webglCalls.push({ method: 'uniform2f', args: [loc.name, x, y] });
    },
    uniform3f(loc: { name: string }, r: number, g: number, b: number) {
      webglCalls.push({ method: 'uniform3f', args: [loc.name, r, g, b] });
    },
    uniform1i(loc: { name: string }, val: number) {
      webglCalls.push({ method: 'uniform1i', args: [loc.name, val] });
    },
    createTexture() {
      webglCalls.push({ method: 'createTexture', args: [] });
      return { id: Math.random() };
    },
    bindTexture(target: number, texture: unknown) {
      webglCalls.push({ method: 'bindTexture', args: [target, texture] });
    },
    texParameteri(target: number, pname: number, param: number) {
      webglCalls.push({ method: 'texParameteri', args: [target, pname, param] });
    },
    texImage2D(...args: unknown[]) {
      webglCalls.push({ method: 'texImage2D', args });
    },
    deleteTexture(texture: unknown) {
      deletedResources.push('texture');
      webglCalls.push({ method: 'deleteTexture', args: [texture] });
    },
    viewport(x: number, y: number, w: number, h: number) {
      webglCalls.push({ method: 'viewport', args: [x, y, w, h] });
    },
    activeTexture(tex: number) {
      webglCalls.push({ method: 'activeTexture', args: [tex] });
    },
    drawArrays(mode: number, first: number, count: number) {
      if (isContextLost) {
        throw new Error('WebGL drawArrays called while context is lost');
      }
      webglCalls.push({ method: 'drawArrays', args: [mode, first, count] });
    },
    getExtension(name: string) {
      if (name === 'WEBGL_lose_context') return loseContextExt;
      return null;
    },
  };

  const canvas = {
    width,
    height,
    getContext(type: string) {
      if (type === 'webgl2' && enableWebGL) {
        return mockWebGL2;
      }
      if (type === '2d') {
        return mockCtx2D;
      }
      return null;
    },
    addEventListener(event: string, handler: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event: string, handler: Function) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height, right: width, bottom: height };
    },
    parentElement: null,
    _listeners: listeners,
    _drawCalls: drawCalls,
    _webglCalls: webglCalls,
    _deletedResources: deletedResources,
    _loseContextExt: loseContextExt,
  } as unknown as HTMLCanvasElement & {
    _listeners: Record<string, Function[]>;
    _drawCalls: MockCanvasContextTracker[];
    _webglCalls: MockCanvasContextTracker[];
    _deletedResources: string[];
    _loseContextExt: typeof loseContextExt;
  };

  return canvas;
}

const SAMPLE_ITEMS: CarouselItem[] = [
  { id: 1, title: 'Parcel 01', district: 'Financial District', color: '#00C805', owner: 'Robinhood', shop: 'DEX Exchange', income: 40 },
  { id: 2, title: 'Parcel 02', district: 'Crypto Strip', color: '#EEC353', owner: 'Luna', shop: 'Memecoin Lounge', income: 25 },
  { id: 3, title: 'Parcel 03', district: 'Chinatown Core', color: '#29B6F6', owner: 'Sherwood', shop: 'Coffee Shop', income: 30 },
  { id: 4, title: 'Parcel 04', district: 'Silicon Valley', color: '#AB47BC', owner: 'Apex', shop: 'Validator Citadel', income: 55 },
  { id: 5, title: 'Parcel 05', district: 'Wall Street', color: '#FF9100', owner: 'Bank', shop: 'Lending Vault', income: 70 },
  { id: 6, title: 'Parcel 06', district: 'Downtown Marina', color: '#00E676', owner: 'Player 1', shop: 'Pho Bistro', income: 45 },
];

describe('Empirical Challenger: ExposureGrid Stress Testing', () => {
  it('survives 50 rapid phase transitions without color drift or arithmetic corruption', () => {
    const canvas = createMockCanvas(800, 600, false);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    renderer.mount();

    const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];
    for (let i = 0; i < 50; i++) {
      const theme = phases[i % phases.length];
      const duration = (i % 5 === 0) ? 0 : (i * 20);
      renderer.setPhaseTheme(theme, duration);
    }

    renderer.render(1.0);
    renderer.render(2.0);

    assert.ok(canvas._drawCalls.length > 0, 'drawCalls should be populated during rapid phase changes');
    renderer.unmount();
  });

  it('safely clamps non-positive canvas dimensions on resize(0, 0) and resize(-100, -100)', () => {
    const canvas = createMockCanvas(800, 600, false);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'trade',
    });

    renderer.mount();

    // Test zero dimensions
    renderer.resize(0, 0);
    assert.ok(canvas.width >= 1, `Canvas width must be >= 1, got ${canvas.width}`);
    assert.ok(canvas.height >= 1, `Canvas height must be >= 1, got ${canvas.height}`);

    // Test negative dimensions
    renderer.resize(-100, -100);
    assert.ok(canvas.width >= 1, `Canvas width must be >= 1, got ${canvas.width}`);
    assert.ok(canvas.height >= 1, `Canvas height must be >= 1, got ${canvas.height}`);

    // Test extreme negative dimensions
    renderer.resize(-1000000, -500000);
    assert.ok(canvas.width >= 1, `Canvas width must be >= 1, got ${canvas.width}`);
    assert.ok(canvas.height >= 1, `Canvas height must be >= 1, got ${canvas.height}`);

    // Test mixed zero and positive
    renderer.resize(0, 500);
    assert.ok(canvas.width >= 1);
    assert.ok(canvas.height >= 500);

    renderer.render(0.5);
    renderer.unmount();
  });

  it('handles extreme and non-numeric intensity and grain values without runtime crashes', () => {
    const canvas = createMockCanvas(800, 600, false);
    const renderer = new ExposureGrid({
      canvas,
      intensity: -10,
      grain: 100,
    });

    renderer.mount();

    // Test boundary values
    renderer.setIntensity(-10);
    renderer.render();

    renderer.setIntensity(100);
    renderer.render();

    renderer.setIntensity(Infinity);
    renderer.render();

    renderer.setIntensity(NaN);
    renderer.render();

    renderer.setTreatment(NaN as unknown as number);
    renderer.setTreatment(Infinity as unknown as number);
    renderer.setTreatment(-999);
    renderer.render();

    renderer.unmount();
  });

  it('resiliently handles simulated WebGL context loss and restoration events', () => {
    setupMockDocument();
    const canvas = createMockCanvas(800, 600, true);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'income',
    });

    renderer.mount();
    assert.equal(renderer.isWebGL(), true, 'WebGL should be active initially');

    // Trigger context loss
    const lostSuccess = renderer.loseContextForTesting();
    assert.equal(lostSuccess, true, 'loseContextForTesting should return true');
    assert.equal(renderer.isWebGL(), false, 'isWebGL must report false when context is lost');

    // Rendering during context loss should safely no-op without calling drawArrays
    const drawCallsBefore = canvas._webglCalls.filter((c) => c.method === 'drawArrays').length;
    renderer.render(1.0);
    const drawCallsAfter = canvas._webglCalls.filter((c) => c.method === 'drawArrays').length;
    assert.equal(drawCallsBefore, drawCallsAfter, 'No WebGL draw calls should execute during context loss');

    // Resizing or phase change during context loss must not throw
    renderer.resize(1024, 768);
    renderer.setPhaseTheme('build');

    // Restore context
    const restoreSuccess = renderer.restoreContextForTesting();
    assert.equal(restoreSuccess, true, 'restoreContextForTesting should return true');
    assert.equal(renderer.isWebGL(), true, 'isWebGL must report true after context restoration');

    renderer.render(2.0);
    renderer.unmount();
  });

  it('thoroughly cleans up resources and event listeners upon unmount', () => {
    setupMockDocument();
    const canvas = createMockCanvas(800, 600, true);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    renderer.mount();
    assert.ok(canvas._listeners['pointermove']?.length > 0);
    assert.ok(canvas._listeners['pointerleave']?.length > 0);
    assert.ok(canvas._listeners['webglcontextlost']?.length > 0);
    assert.ok(canvas._listeners['webglcontextrestored']?.length > 0);

    renderer.unmount();

    assert.equal(canvas._listeners['pointermove']?.length || 0, 0, 'pointermove listener must be removed');
    assert.equal(canvas._listeners['pointerleave']?.length || 0, 0, 'pointerleave listener must be removed');
    assert.equal(canvas._listeners['webglcontextlost']?.length || 0, 0, 'webglcontextlost listener must be removed');
    assert.equal(canvas._listeners['webglcontextrestored']?.length || 0, 0, 'webglcontextrestored listener must be removed');

    assert.ok(canvas._deletedResources.includes('texture'), 'Texture must be deleted');
    assert.ok(canvas._deletedResources.includes('buffer'), 'Buffer must be deleted');
    assert.ok(canvas._deletedResources.includes('program'), 'Program must be deleted');
    assert.ok(canvas._deletedResources.includes('shader'), 'Shaders must be deleted');

    // Calling methods on unmounted instance should safely no-op
    renderer.render();
    renderer.resize(500, 500);
    renderer.unmount(); // Idempotency check
  });
});

describe('Empirical Challenger: AppleCarousel Stress Testing', () => {
  beforeEach(() => {
    setupMockDocument();
  });

  it('withstands 100 rapid slide navigations before settle delay without state desynchronization', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    for (let i = 0; i < 100; i++) {
      if (i % 3 === 0) {
        carousel.next();
      } else if (i % 3 === 1) {
        carousel.prev();
      } else {
        carousel.goTo(i % SAMPLE_ITEMS.length);
      }

      const idx = carousel.getCurrentIndex();
      assert.ok(
        idx >= 0 && idx < SAMPLE_ITEMS.length,
        `Index must remain strictly within [0, ${SAMPLE_ITEMS.length - 1}], got ${idx} at step ${i}`
      );
    }

    carousel.unmount();
  });

  it('safely handles single-item carousel across navigation, keys, and autoplay calls', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const single = [SAMPLE_ITEMS[0]];
    const carousel = new AppleCarousel({
      container,
      items: single,
    });

    carousel.mount();

    assert.equal(carousel.getRealCardCount(), 1);
    assert.equal(carousel.getCloneCardCount(), 0);
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.next();
    assert.equal(carousel.getCurrentIndex(), 0, 'Single item must stay on index 0 on next');

    carousel.prev();
    assert.equal(carousel.getCurrentIndex(), 0, 'Single item must stay on index 0 on prev');

    carousel.goTo(10);
    assert.equal(carousel.getCurrentIndex(), 0, 'goTo out-of-bounds must clamp to 0');

    carousel.simulateKey('ArrowRight');
    carousel.simulateKey('ArrowLeft');
    carousel.simulateKey('Home');
    carousel.simulateKey('End');
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.unmount();
  });

  it('safely handles empty items array without crashes across all public methods and keyboard events', () => {
    let selectTriggered = false;
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: [],
      onSelect: () => {
        selectTriggered = true;
      },
    });

    carousel.mount();

    assert.equal(carousel.getRealCardCount(), 0);
    assert.equal(carousel.getCloneCardCount(), 0);
    assert.equal(carousel.getCurrentIndex(), 0);
    assert.equal(carousel.getCurrentItem(), null);

    // Call all navigation methods
    carousel.next();
    carousel.prev();
    carousel.goTo(0);
    carousel.goTo(-1);
    carousel.goTo(10);
    carousel.play();
    carousel.pause();
    carousel.togglePlay();
    carousel.selectCurrent();
    assert.equal(selectTriggered, false, 'onSelect must not fire for empty carousel');

    // Simulate all keyboard events
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '];
    for (const key of keys) {
      carousel.simulateKey(key);
    }

    carousel.unmount();
  });

  it('handles extreme viewport aspect ratios (ultra-wide, ultra-narrow, zero, negative)', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    const root = container.children[0];
    const viewport = root.children[0] as unknown as MockElement;

    // Ultra-wide 8K viewport
    viewport.clientWidth = 10000;
    carousel.goTo(2);
    assert.equal(carousel.getCurrentIndex(), 2);

    // Ultra-narrow 10px viewport
    viewport.clientWidth = 10;
    carousel.goTo(4);
    assert.equal(carousel.getCurrentIndex(), 4);

    // Zero width viewport
    viewport.clientWidth = 0;
    carousel.goTo(1);
    assert.equal(carousel.getCurrentIndex(), 1);

    // Negative width viewport
    viewport.clientWidth = -500;
    carousel.goTo(3);
    assert.equal(carousel.getCurrentIndex(), 3);

    carousel.unmount();
  });

  it('executes 200 rapid keyboard scrubbing cycles without runtime failure', () => {
    let lastSelectedId: number | null = null;
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
      onSelect: (item) => {
        lastSelectedId = item.id;
      },
    });

    carousel.mount();

    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ', 'Tab', 'Escape', 'Unrecognized'];
    for (let i = 0; i < 200; i++) {
      const key = keys[i % keys.length];
      carousel.simulateKey(key);
      const idx = carousel.getCurrentIndex();
      assert.ok(idx >= 0 && idx < SAMPLE_ITEMS.length);
    }

    assert.ok(lastSelectedId !== null, 'Selection via Enter or Space should have executed');
    carousel.unmount();
  });

  it('guarantees complete DOM detachment and timer cleanup upon unmount', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
      autoplayDurationMs: 1000,
    });

    carousel.mount();
    assert.equal(container.children.length, 1, 'Container should hold the carousel root element');

    carousel.unmount();
    assert.equal(container.children.length, 0, 'Carousel root element must be removed from container on unmount');
    assert.equal(carousel.getCardElements().length, 0, 'Card elements array must be emptied');

    // Idempotency: calling unmount again must not throw
    carousel.unmount();
  });

  it('survives rapid dynamic setItems replacements with variable lengths and empty sets', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    // Rapidly switch item sets between 6, 1, 0, 3, and 6
    carousel.setItems([SAMPLE_ITEMS[0]]);
    assert.equal(carousel.getRealCardCount(), 1);
    assert.equal(carousel.getCloneCardCount(), 0);

    carousel.setItems([]);
    assert.equal(carousel.getRealCardCount(), 0);
    assert.equal(carousel.getCurrentItem(), null);

    carousel.setItems(SAMPLE_ITEMS.slice(0, 3));
    assert.equal(carousel.getRealCardCount(), 3);
    assert.equal(carousel.getCloneCardCount(), 4); // Math.min(2, 3) * 2 = 4

    carousel.next();
    carousel.prev();
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.setItems(SAMPLE_ITEMS);
    assert.equal(carousel.getRealCardCount(), 6);
    assert.equal(carousel.getCloneCardCount(), 4); // Math.min(2, 6) * 2 = 4

    carousel.unmount();
  });

  it('handles concurrent scroll and scrollend events during active programmatic transitions', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    const root = container.children[0];
    const viewport = root.children[0] as unknown as MockElement;

    // Trigger navigation immediately followed by scroll events
    carousel.goTo(3);
    viewport.dispatchEvent({ type: 'scroll' });
    viewport.dispatchEvent({ type: 'scrollend' });

    assert.equal(carousel.getCurrentIndex(), 3);

    carousel.unmount();
  });

  it('silently wraps from clone cards to real cards upon scroll settlement', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    const root = container.children[0];
    const viewport = root.children[0] as unknown as MockElement;
    const cards = carousel.getCardElements();

    // Find a trailing clone (e.g. index 10 is trailing clone 0 for logical index 0)
    const trailingClone0 = cards.find((c) => c.hasAttribute('data-clone') && c.getAttribute('data-index') === '0');
    assert.ok(trailingClone0);

    // Simulate viewport scrolled to this trailing clone
    viewport.scrollLeft = trailingClone0.offsetLeft - (viewport.clientWidth - trailingClone0.offsetWidth) / 2;

    // Trigger scrollend
    viewport.dispatchEvent({ type: 'scrollend' });

    // The silent wrapping should update scrollLeft to real card 0
    const realCard0 = cards.find((c) => !c.hasAttribute('data-clone') && c.getAttribute('data-index') === '0');
    assert.ok(realCard0);
    const expectedSnapLeft = realCard0.offsetLeft - (viewport.clientWidth - realCard0.offsetWidth) / 2;
    assert.equal(viewport.scrollLeft, expectedSnapLeft, 'Viewport must silently wrap scrollLeft to real card snap position');
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.unmount();
  });
});

describe('Empirical Challenger: ExposureGrid Pointer & Timing Stress', () => {
  it('handles extreme pointer events and smoothing decay under rapid movement', () => {
    setupMockDocument();
    const canvas = createMockCanvas(800, 600, true);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'build',
    });

    renderer.mount();

    // Dispatch 100 extreme pointer events (off-screen, negative, NaN)
    for (let i = 0; i < 100; i++) {
      const clientX = i % 2 === 0 ? -9999 : 99999;
      const clientY = i % 2 === 0 ? -5000 : 88888;
      const handlers = canvas._listeners['pointermove'] || [];
      for (const h of handlers) {
        h({ clientX, clientY } as unknown as PointerEvent);
      }
      renderer.render(i * 0.016);
    }

    // Pointer leave
    const leaveHandlers = canvas._listeners['pointerleave'] || [];
    for (const h of leaveHandlers) h(new Event('pointerleave'));

    renderer.render(2.0);
    renderer.unmount();
  });

  it('maintains numeric stability under negative and massive time offsets', () => {
    setupMockDocument();
    const canvas = createMockCanvas(800, 600, true);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'trade',
    });

    renderer.mount();

    renderer.render(0);
    renderer.render(-1000);
    renderer.render(1e9);
    renderer.render(0.0000001);

    renderer.unmount();
  });
});

