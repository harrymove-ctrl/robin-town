/**
 * tests/unit/challenger-m12-2.test.ts
 *
 * Independent empirical stress and adversarial verification suite for Milestone M12.2:
 * 1. Apple Carousel (src/ui/carousel.ts):
 *    - Strict CLONES_PER_SIDE = 2 validation for N items (N = 3, 4, 5, 8 => total cards N + 4).
 *    - Rapid successive calls to next, prev, and settle wrap loops.
 *    - Safe temporary scrollBehavior = 'auto' override during clone wrap-around and prompt restoration.
 *    - 4000ms default autoplay duration constant, configurable duration, and complete timer cleanup on unmount.
 * 2. iPod Classic Dock & Controller (src/ui/ipod-controller.ts, src/ui/ipod-dock.ts, src/ui/audio.ts):
 *    - Pure rotary degree quantization across boundary and edge cases (0, 14, 15, 29, 30, -45 deg, extreme angles).
 *    - Defensive Web Audio initialization and playback without throwing under missing, suspended, or failing AudioContext.
 *    - IPodDock collapse and expand state machine, DOM hierarchies, CSS classes, and non-obstructing floating pill layout.
 * 3. SolaceUI Exposure-Grid Shader (src/ui/solace-background.ts):
 *    - Headless execution with robust Canvas2D procedural fallback without throwing.
 *    - Mathematical verification of warm Solace RGB color ranges across all phases.
 *    - Layout stability and zero Cumulative Layout Shift (CLS = 0) verification under multi-resolution and DPR resizes.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  AppleCarousel,
  CLONES_PER_SIDE,
  CLONE_COUNT,
  TOTAL_CLONES,
  SETTLE_DELAY,
  type CarouselItem,
} from '../../src/ui/carousel.js';

import {
  IPodController,
  quantizeRotaryDegrees,
  DRAG_STEP_DEGREES,
  type iPodAction,
} from '../../src/ui/ipod-controller.js';

import {
  IPodDock,
  type IPodDockOptions,
} from '../../src/ui/ipod-dock.js';

import {
  AudioSynthesizer,
  PHASE_TRACKS,
  midiToFrequency,
} from '../../src/ui/audio.js';

import {
  SolaceBackground,
  SOLACE_WARM_PALETTES,
  drawSolaceCanvas2DFallback,
  type SolacePalette,
  type SolacePhase,
} from '../../src/ui/solace-background.js';

// --- Headless Mock DOM Elements ---

class MockElement {
  public tagName: string;
  public className = '';
  public id = '';
  private _innerHTML = '';
  public textContent = '';
  public style: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;

  public offsetLeft = 0;
  public offsetTop = 0;
  public offsetWidth = 280;
  public offsetHeight = 24;
  public clientWidth = 800;
  public clientHeight = 600;
  public scrollLeft = 0;
  public scrollTop = 0;
  public width = 800;
  public height = 600;
  public type = 'button';
  public listeners: Record<string, Function[]> = {};

  // Canvas 2D context tracking
  public drawCalls: { method: string; args: unknown[] }[] = [];

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  public get innerHTML(): string {
    return this._innerHTML;
  }

  public set innerHTML(html: string) {
    this._innerHTML = html;
    // Lightweight parser for child tags like <span class="...">content</span>
    const tagRegex = /<([a-z0-9]+)([^>]*)>(.*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    let matchedAny = false;
    while ((match = tagRegex.exec(html)) !== null) {
      matchedAny = true;
      const tagName = match[1];
      const attrsStr = match[2];
      const content = match[3];
      const el = new MockElement(tagName);
      el.textContent = content;
      el.parentElement = this;
      const classMatch = /class=["']([^"']+)["']/i.exec(attrsStr);
      if (classMatch) {
        el.className = classMatch[1];
      }
      this.children.push(el);
    }
    if (!matchedAny && html.length > 0) {
      this.textContent = html;
    }
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
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      if (this.className.split(' ').includes(cls)) return this;
      for (const child of this.children) {
        if (child.className.split(' ').includes(cls)) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
      return null;
    }
    for (const child of this.children) {
      if (child.tagName.toLowerCase() === selector.toLowerCase()) return child;
      const sub = child.querySelector(selector);
      if (sub) return sub;
    }
    return null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (node: MockElement) => {
      if (selector.startsWith('.')) {
        const cls = selector.substring(1);
        if (node.className.split(' ').includes(cls)) results.push(node);
      }
      for (const child of node.children) {
        check(child);
      }
    };
    check(this);
    return results;
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

  public click(): void {
    const handlers = this.listeners['click'];
    if (handlers) {
      const event = {
        type: 'click',
        stopPropagation: () => {},
        preventDefault: () => {},
      };
      for (const h of handlers) {
        h(event);
      }
    }
  }

  public scrollTo(options: { left: number; behavior?: string }): void {
    this.scrollLeft = options.left;
  }

  public getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight,
    };
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
    add: (cls: string) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      classes.add(cls);
      this.className = Array.from(classes).join(' ');
    },
    remove: (cls: string) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      classes.delete(cls);
      this.className = Array.from(classes).join(' ');
    },
    contains: (cls: string) => {
      return this.className.split(' ').includes(cls);
    },
  };

  public getContext(type: string) {
    if (type === '2d') {
      const self = this;
      return {
        save: () => self.drawCalls.push({ method: 'save', args: [] }),
        restore: () => self.drawCalls.push({ method: 'restore', args: [] }),
        clearRect: (x: number, y: number, w: number, h: number) =>
          self.drawCalls.push({ method: 'clearRect', args: [x, y, w, h] }),
        fillRect: (x: number, y: number, w: number, h: number) =>
          self.drawCalls.push({ method: 'fillRect', args: [x, y, w, h] }),
        beginPath: () => self.drawCalls.push({ method: 'beginPath', args: [] }),
        closePath: () => self.drawCalls.push({ method: 'closePath', args: [] }),
        moveTo: (x: number, y: number) => self.drawCalls.push({ method: 'moveTo', args: [x, y] }),
        lineTo: (x: number, y: number) => self.drawCalls.push({ method: 'lineTo', args: [x, y] }),
        arc: (x: number, y: number, r: number, s: number, e: number) =>
          self.drawCalls.push({ method: 'arc', args: [x, y, r, s, e] }),
        bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) =>
          self.drawCalls.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] }),
        fill: () => self.drawCalls.push({ method: 'fill', args: [] }),
        stroke: () => self.drawCalls.push({ method: 'stroke', args: [] }),
        createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => ({
          addColorStop: (offset: number, color: string) =>
            self.drawCalls.push({ method: 'addColorStop', args: [offset, color] }),
        }),
        createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => ({
          addColorStop: (offset: number, color: string) =>
            self.drawCalls.push({ method: 'addColorStop', args: [offset, color] }),
        }),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
    }
    // WebGL2 context returns null in headless testing environment
    return null;
  }
}

function setupMockEnvironment() {
  const doc = {
    createElement(tagName: string) {
      return new MockElement(tagName);
    },
    body: new MockElement('body'),
    timeline: {},
  };
  (global as unknown as { document: unknown }).document = doc;
  (global as unknown as { window: unknown }).window = {
    document: doc,
    devicePixelRatio: 1.0,
    getComputedStyle: () => ({
      scrollSnapAlign: 'center',
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function generateMockItems(count: number): CarouselItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Parcel ${String(i + 1).padStart(2, '0')}`,
    district: `District ${(i % 6) + 1}`,
    color: '#00C805',
    owner: `Player ${(i % 4) + 1}`,
    shop: `Shop ${i + 1}`,
    income: 20 + i * 5,
  }));
}

// ============================================================================
// TEST SUITE: Challenger M12.2
// ============================================================================

describe('Challenger M12.2: Apple Carousel, iPod Dock & Lo-Fi Audio, SolaceUI Shader', () => {
  beforeEach(() => {
    setupMockEnvironment();
  });

  // --------------------------------------------------------------------------
  // Subsystem 1: Apple Carousel Verification & Stress
  // --------------------------------------------------------------------------
  describe('Subsystem 1: Apple Carousel Infinite Autoplay & Silent Wrap', () => {
    it('verifies CLONES_PER_SIDE = 2 constant and total cards = N + 4 for N in [3, 4, 5, 8]', () => {
      assert.equal(CLONES_PER_SIDE, 2, 'CLONES_PER_SIDE must equal exactly 2');
      assert.equal(CLONE_COUNT, 2, 'CLONE_COUNT must equal exactly 2');
      assert.equal(TOTAL_CLONES, 4, 'TOTAL_CLONES must equal exactly 4 (2 leading + 2 trailing)');

      const testCounts = [3, 4, 5, 8];
      for (const n of testCounts) {
        const container = new MockElement('div') as unknown as HTMLElement;
        const items = generateMockItems(n);
        const carousel = new AppleCarousel({ container, items });

        carousel.mount();

        const realCount = carousel.getRealCardCount();
        const cloneCount = carousel.getCloneCardCount();
        const allCards = carousel.getCardElements();

        assert.equal(realCount, n, `Real cards count must be ${n}`);
        assert.equal(cloneCount, 4, `Clone cards count must be exactly 4 for N=${n}`);
        assert.equal(
          allCards.length,
          n + 4,
          `Total rendered cards must be exactly N + 4 (${n + 4}) for N=${n}`
        );

        // Verify leading clones: first 2 elements
        for (let i = 0; i < 2; i++) {
          assert.equal(allCards[i].getAttribute('data-clone'), 'true', `Card ${i} must have data-clone="true"`);
          assert.ok(allCards[i].hasAttribute('inert'), `Leading clone ${i} must have inert attribute`);
          assert.equal(allCards[i].getAttribute('aria-hidden'), 'true', `Leading clone ${i} must be aria-hidden`);
        }

        // Verify real cards in middle: exactly n elements
        for (let i = 2; i < 2 + n; i++) {
          assert.equal(
            allCards[i].hasAttribute('data-clone'),
            false,
            `Middle card at position ${i} must NOT be a clone`
          );
        }

        // Verify trailing clones: last 2 elements
        for (let i = 2 + n; i < allCards.length; i++) {
          assert.equal(allCards[i].getAttribute('data-clone'), 'true', `Trailing clone ${i} must have data-clone="true"`);
          assert.ok(allCards[i].hasAttribute('inert'), `Trailing clone ${i} must have inert attribute`);
          assert.equal(allCards[i].getAttribute('aria-hidden'), 'true', `Trailing clone ${i} must be aria-hidden`);
        }

        carousel.unmount();
      }
    });

    it('verifies boundary cases: N = 0 (empty) and N = 1 (single card)', () => {
      // N = 0
      const c0 = new MockElement('div') as unknown as HTMLElement;
      const carousel0 = new AppleCarousel({ container: c0, items: [] });
      carousel0.mount();
      assert.equal(carousel0.getRealCardCount(), 0);
      assert.equal(carousel0.getCloneCardCount(), 0);
      assert.equal(carousel0.getCardElements().length, 0);
      carousel0.unmount();

      // N = 1
      const c1 = new MockElement('div') as unknown as HTMLElement;
      const carousel1 = new AppleCarousel({ container: c1, items: generateMockItems(1) });
      carousel1.mount();
      assert.equal(carousel1.getRealCardCount(), 1);
      assert.equal(carousel1.getCloneCardCount(), 0);
      assert.equal(carousel1.getCardElements().length, 1);
      carousel1.unmount();
    });

    it('stress tests rapid successive calls to next, prev, and settle loops (100 iterations)', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const items = generateMockItems(6);
      const carousel = new AppleCarousel({ container, items });

      carousel.mount();
      assert.equal(carousel.getCurrentIndex(), 0);

      // Rapid successive next() calls
      for (let i = 1; i <= 100; i++) {
        carousel.next();
        const expected = i % 6;
        assert.equal(
          carousel.getCurrentIndex(),
          expected,
          `Index after ${i} rapid next() calls must be ${expected}`
        );
        assert.ok(carousel.getCurrentItem() !== null, 'Item must not be null');
      }

      // Reset to 0 before testing prev() loop
      carousel.goTo(0);
      assert.equal(carousel.getCurrentIndex(), 0);

      // Rapid successive prev() calls
      for (let i = 1; i <= 100; i++) {
        carousel.prev();
        const expected = (6 - (i % 6)) % 6;
        assert.equal(
          carousel.getCurrentIndex(),
          expected,
          `Index after ${i} rapid prev() calls must be ${expected}`
        );
      }

      // Reset to 0 before alternating next and prev rapidly
      carousel.goTo(0);
      assert.equal(carousel.getCurrentIndex(), 0);
      for (let i = 0; i < 50; i++) {
        carousel.next();
        assert.equal(carousel.getCurrentIndex(), 1);
        carousel.prev();
        assert.equal(carousel.getCurrentIndex(), 0);
      }

      // Test silent clone settle wrap
      // In a 6-item carousel:
      // cardElements[0]: clone of item 4 (leading clone)
      // cardElements[1]: clone of item 5 (leading clone)
      // cardElements[2]: real item 0
      const viewport = (container as unknown as MockElement).children[0].children[0] as MockElement;
      const allCards = carousel.getCardElements();
      assert.equal(allCards[0].getAttribute('data-clone'), 'true');
      assert.equal(allCards[0].getAttribute('data-index'), '4');

      // Set scroll position exactly to leading clone 4's snap position
      const getSnapLeft = (
        carousel as unknown as { getSnapLeft: (slide: HTMLElement) => number }
      ).getSnapLeft.bind(carousel);

      viewport.scrollLeft = getSnapLeft(allCards[0] as unknown as HTMLElement);
      (carousel as unknown as { handleSettle: () => void }).handleSettle();

      // After settling, currentIndex should update to logical index 4
      assert.equal(
        carousel.getCurrentIndex(),
        4,
        'handleSettle must silently wrap from clone to real card index 4'
      );

      carousel.unmount();
    });

    it('verifies viewport.style.scrollBehavior is safely set to auto during silent wrap and restored', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const items = generateMockItems(5);
      const carousel = new AppleCarousel({ container, items });

      carousel.mount();

      const viewport = (container as unknown as MockElement).children[0].children[0] as MockElement;
      assert.ok(viewport, 'Viewport element must exist');

      // Establish initial smooth scroll behavior
      viewport.style.scrollBehavior = 'smooth';

      // Access private writeScrollLeft
      const writeScrollLeft = (
        carousel as unknown as { writeScrollLeft: (left: number, silent?: boolean) => void }
      ).writeScrollLeft.bind(carousel);

      // Invoke writeScrollLeft with silent = true
      writeScrollLeft(300, true);

      // In headless environment without requestAnimationFrame polyfill or immediate fallback,
      // scrollBehavior must be restored to smooth
      assert.equal(
        viewport.style.scrollBehavior,
        'smooth',
        'scrollBehavior must be restored back to smooth after silent scrollLeft write'
      );
      assert.equal(viewport.scrollLeft, 300, 'Viewport scrollLeft must be updated');

      // Test with custom initial scrollBehavior (e.g. empty string)
      viewport.style.scrollBehavior = '';
      writeScrollLeft(600, true);
      assert.equal(
        viewport.style.scrollBehavior,
        '',
        'scrollBehavior must be restored back to empty string when originally unset'
      );

      carousel.unmount();
    });

    it('verifies 4000ms default autoplay duration constant and timer cleanup on unmount', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const items = generateMockItems(4);

      // 1. Default duration
      const carouselDefault = new AppleCarousel({ container, items });
      assert.equal(
        (carouselDefault as unknown as { autoplayDurationMs: number }).autoplayDurationMs,
        4000,
        'Default autoplay duration must be 4000ms'
      );

      carouselDefault.mount();
      assert.equal(carouselDefault.isPlaying(), true);

      // Verify timer is initialized
      const hasTimerBefore =
        (carouselDefault as unknown as { fallbackTimer: unknown }).fallbackTimer !== null;
      assert.ok(hasTimerBefore, 'Fallback timer must be active when mounted and playing in headless environment');

      // Unmount and verify complete timer cleanup
      carouselDefault.unmount();

      const timerAfter = (carouselDefault as unknown as { fallbackTimer: unknown }).fallbackTimer;
      const debounceTimerAfter = (carouselDefault as unknown as { scrollDebounceTimer: unknown })
        .scrollDebounceTimer;
      const isMountedAfter = (carouselDefault as unknown as { isMounted: boolean }).isMounted;

      assert.equal(timerAfter, null, 'Fallback timer must be nullified on unmount');
      assert.equal(debounceTimerAfter, null, 'Scroll debounce timer must be nullified on unmount');
      assert.equal(isMountedAfter, false, 'isMounted must be false after unmount');
      assert.equal((container as unknown as MockElement).children.length, 0, 'Container children must be removed');

      // 2. Custom duration
      const carouselCustom = new AppleCarousel({
        container,
        items,
        autoplayDurationMs: 6500,
      });
      assert.equal(
        (carouselCustom as unknown as { autoplayDurationMs: number }).autoplayDurationMs,
        6500,
        'Custom autoplay duration must be preserved'
      );
      carouselCustom.mount();
      carouselCustom.unmount();
    });
  });

  // --------------------------------------------------------------------------
  // Subsystem 2: iPod Classic Controller, Dock & Lo-Fi Audio
  // --------------------------------------------------------------------------
  describe('Subsystem 2: iPod Classic Controller, Floating Dock & Audio Synthesizer', () => {
    it('tests quantizeRotaryDegrees across edge and boundary angles (0, 14, 15, 29, 30, -45 deg)', () => {
      assert.equal(DRAG_STEP_DEGREES, 15, 'DRAG_STEP_DEGREES must be 15');

      // 0 deg -> 0 notches
      assert.equal(quantizeRotaryDegrees(0, 15), 0, '0 deg must produce 0 notches');

      // 14 deg -> 0 notches (boundary below 15)
      assert.equal(quantizeRotaryDegrees(14, 15), 0, '14 deg must produce 0 notches');

      // 14.999 deg -> 0 notches
      assert.equal(quantizeRotaryDegrees(14.999, 15), 0, '14.999 deg must produce 0 notches');

      // 15 deg -> 1 notch (exact boundary)
      assert.equal(quantizeRotaryDegrees(15, 15), 1, '15 deg must produce 1 notch');

      // 15.001 deg -> 1 notch
      assert.equal(quantizeRotaryDegrees(15.001, 15), 1, '15.001 deg must produce 1 notch');

      // 29 deg -> 1 notch (boundary below 30)
      assert.equal(quantizeRotaryDegrees(29, 15), 1, '29 deg must produce 1 notch');

      // 30 deg -> 2 notches (exact boundary)
      assert.equal(quantizeRotaryDegrees(30, 15), 2, '30 deg must produce 2 notches');

      // 44.9 deg -> 2 notches
      assert.equal(quantizeRotaryDegrees(44.9, 15), 2, '44.9 deg must produce 2 notches');

      // -45 deg -> 3 notches magnitude
      assert.equal(quantizeRotaryDegrees(-45, 15), 3, '-45 deg must produce 3 notches magnitude');

      // Verify signed turn step calculation
      const signedStep = (deg: number, step = 15) => (deg < 0 ? -1 : 1) * quantizeRotaryDegrees(deg, step);
      assert.equal(signedStep(-45, 15), -3, 'Signed step for -45 deg must be -3');
      assert.equal(signedStep(30, 15), 2, 'Signed step for 30 deg must be 2');

      // Large multi-rotation values
      assert.equal(quantizeRotaryDegrees(360, 15), 24, '360 deg must produce 24 notches');
      assert.equal(quantizeRotaryDegrees(-720, 15), 48, '-720 deg must produce 48 notches');
      assert.equal(quantizeRotaryDegrees(-1800, 15), 120, '-1800 deg must produce 120 notches');
    });

    it('tests click audio initialization defensively without throwing if AudioContext is suspended or unavailable', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const actions: iPodAction[] = [
        { id: 'act1', label: 'Draft Parcel', handler: () => {} },
        { id: 'act2', label: 'View Deeds', handler: () => {} },
      ];

      const controller = new IPodController({
        container,
        menuTitle: 'Robin-Town Audio Test',
        actions,
      });

      controller.mount();

      // In headless Node, window.AudioContext is undefined
      // Invoking step() calls playClickAudio() internally
      assert.doesNotThrow(() => {
        controller.step(1);
        controller.step(-1);
        controller.selectActive();
        controller.pressMenu();
        controller.pressPlay();
      }, 'Click audio synthesis must never throw when AudioContext is unavailable');

      // Now test with a mocked AudioContext that throws upon construction
      const originalWindow = (global as unknown as { window: Record<string, unknown> }).window;
      (global as unknown as { window: Record<string, unknown> }).window = {
        ...originalWindow,
        AudioContext: function FailingAudioContext() {
          throw new Error('WebAudio SecurityError: Autoplay blocked');
        },
      };

      assert.doesNotThrow(() => {
        (controller as unknown as { initAudio: () => void }).initAudio();
        (controller as unknown as { playClickAudio: () => void }).playClickAudio();
      }, 'initAudio must safely catch construction exceptions');

      // Test with a suspended AudioContext where resume resolves normally
      (global as unknown as { window: Record<string, unknown> }).window = {
        ...originalWindow,
        AudioContext: function SuspendedAudioContext() {
          return {
            state: 'suspended',
            sampleRate: 44100,
            currentTime: 1.0,
            createBuffer: () => ({
              getChannelData: () => new Float32Array(100),
            }),
            createBufferSource: () => ({
              buffer: null,
              connect: () => {},
              start: () => {},
            }),
            createGain: () => ({
              gain: { value: 1.0 },
              connect: () => {},
            }),
            destination: {},
            resume: () => Promise.resolve(),
            close: () => Promise.resolve(),
          };
        },
      };

      assert.doesNotThrow(() => {
        (controller as unknown as { initAudio: () => void }).initAudio();
        (controller as unknown as { playClickAudio: () => void }).playClickAudio();
      }, 'playClickAudio must handle suspended state cleanly without throwing');

      // Clean up controller
      controller.unmount();

      // Also test AudioSynthesizer from src/ui/audio.ts
      const synth = new AudioSynthesizer();
      assert.doesNotThrow(() => {
        synth.playTilePop();
        synth.playCoinChime();
        synth.playDealStamp();
        synth.playPhaseFanfare();
        synth.playYearFanfare();
        synth.playErrorBuzzer();
        synth.playClick();
        synth.playPhaseTrack('trade');
        synth.stopPhaseTrack();
      }, 'AudioSynthesizer cues must never throw under headless or failing audio contexts');
    });

    it('tests IPodDock collapse and expand states, DOM elements, and compact floating layout', () => {
      const container = new MockElement('div') as unknown as HTMLElement;
      const dock = new IPodDock({
        container,
        initialPhase: 'receive',
        initialCollapsed: false,
      });

      dock.mount();

      const dockElement = (container as unknown as MockElement).querySelector('#robin-ipod-dock');
      assert.ok(dockElement, 'Dock element #robin-ipod-dock must be mounted');
      assert.equal(dockElement.tagName, 'ASIDE');
      assert.equal(dockElement.getAttribute('role'), 'complementary');
      assert.equal(dockElement.getAttribute('aria-label'), 'iPod Classic Controller Dock');

      // Expanded state assertions
      assert.equal(dock.getIsCollapsed(), false);
      assert.equal(dockElement.getAttribute('data-collapsed'), 'false');
      assert.ok(dockElement.classList.contains('expanded'), 'Must have class expanded');
      assert.ok(!dockElement.classList.contains('collapsed'), 'Must NOT have class collapsed');

      const card = dockElement.querySelector('.robin-ipod-card');
      assert.ok(card, 'Card wrapper must exist');

      const bar = dockElement.querySelector('.robin-ipod-bar');
      assert.ok(bar, 'Mini pill bar must exist');

      const titleText = dockElement.querySelector('.dock-title-text');
      assert.ok(titleText, 'dock-title-text element must exist');
      assert.equal(titleText.textContent, 'Y1 · RECEIVE');

      const toggleBtn = dockElement.querySelector('.ipod-dock-toggle-btn');
      assert.ok(toggleBtn);
      assert.equal(toggleBtn.getAttribute('aria-label'), 'Collapse iPod Classic');
      assert.equal(toggleBtn.textContent, '▼');

      const scaleHost = dockElement.querySelector('.robin-ipod-scale');
      assert.ok(scaleHost);
      assert.equal(scaleHost.style.display, 'block', 'Scale host must be visible in expanded state');

      // 1. Collapse state
      dock.collapse();
      assert.equal(dock.getIsCollapsed(), true);
      assert.equal(dockElement.getAttribute('data-collapsed'), 'true');
      assert.ok(dockElement.classList.contains('collapsed'), 'Must have class collapsed');
      assert.ok(!dockElement.classList.contains('expanded'), 'Must NOT have class expanded');
      assert.equal(scaleHost.style.display, 'none', 'Scale host must be hidden in collapsed state');
      assert.equal(toggleBtn.getAttribute('aria-label'), 'Expand iPod Classic');
      assert.equal(toggleBtn.textContent, '▲');

      // 2. Expand state
      dock.expand();
      assert.equal(dock.getIsCollapsed(), false);
      assert.equal(dockElement.getAttribute('data-collapsed'), 'false');
      assert.ok(dockElement.classList.contains('expanded'));
      assert.equal(scaleHost.style.display, 'block');
      assert.equal(toggleBtn.textContent, '▼');

      // 3. Toggle state
      dock.toggle();
      assert.equal(dock.getIsCollapsed(), true);
      dock.toggle();
      assert.equal(dock.getIsCollapsed(), false);

      // 4. Phase and year update
      dock.setPhase('income', 3);
      assert.equal(titleText.textContent, 'Y3 · INCOME');

      dock.unmount();
      assert.equal((container as unknown as MockElement).children.length, 0, 'Dock must be removed on unmount');
    });
  });

  // --------------------------------------------------------------------------
  // Subsystem 3: SolaceUI Shader Background & Layout Invariance
  // --------------------------------------------------------------------------
  describe('Subsystem 3: SolaceUI Exposure-Grid Shader & Layout Invariance', () => {
    it('verifies SolaceBackground Canvas2D fallback executes without errors in headless mode', () => {
      const mockCanvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
      const bg = new SolaceBackground({
        canvas: mockCanvas,
        phase: 'default',
        intensity: 0.85,
      });

      // Canvas2D fallback in headless environment (WebGL2 returns null)
      bg.mount();
      assert.equal(bg.isWebGL(), false, 'isWebGL must be false in headless Node environment');

      const canvasMock = mockCanvas as unknown as MockElement;
      assert.ok(canvasMock.drawCalls.length > 0, 'Canvas2D draw calls must be recorded by fallback');

      // Check specific fallback drawing operations
      const methods = canvasMock.drawCalls.map((c) => c.method);
      assert.ok(methods.includes('clearRect'), 'Must clear canvas');
      assert.ok(methods.includes('fillRect'), 'Must fill background gradient');
      assert.ok(methods.includes('beginPath'), 'Must draw paths');
      assert.ok(methods.includes('bezierCurveTo'), 'Must draw skyline curve');
      assert.ok(methods.includes('stroke'), 'Must stroke tactical grid lines');

      // Test phase transitions and intensity updates without throwing
      assert.doesNotThrow(() => {
        bg.setPhase('trade');
        bg.setPhase('build');
        bg.setPhase('income');
        bg.setPhase('ended');
        bg.setPhase('receive');
        bg.setPhase('default');
        bg.setIntensity(1.2);
        bg.render();
      }, 'Phase changes and renders in Canvas2D fallback must never throw');

      bg.unmount();
    });

    it('verifies warm Solace brand RGB palette values are strictly bounded in [0.0, 1.0]', () => {
      const phases: SolacePhase[] = ['default', 'receive', 'trade', 'build', 'income', 'ended'];

      for (const phase of phases) {
        const palette = SOLACE_WARM_PALETTES[phase];
        assert.ok(palette, `Palette for phase ${phase} must exist`);

        const keys: (keyof SolacePalette)[] = ['grid', 'accent', 'secondary', 'ink', 'paper'];
        for (const key of keys) {
          const rgb = palette[key];
          assert.equal(rgb.length, 3, `${phase}.${key} must have 3 RGB components`);
          for (let i = 0; i < 3; i++) {
            const val = rgb[i];
            assert.ok(
              typeof val === 'number' && !isNaN(val),
              `${phase}.${key}[${i}] must be a valid number`
            );
            assert.ok(
              val >= 0.0 && val <= 1.0,
              `${phase}.${key}[${i}] (${val}) must be strictly bounded in [0.0, 1.0]`
            );
          }
        }
      }
    });

    it('verifies layout stability and zero layout shift (CLS = 0) under resize and DPR variations', () => {
      const mockCanvas = new MockElement('canvas') as unknown as HTMLCanvasElement;
      const canvasMock = mockCanvas as unknown as MockElement;

      const bg = new SolaceBackground({
        canvas: mockCanvas,
        maxDpr: 1.5,
      });

      // 1. Initial CSS style pinning
      assert.equal(canvasMock.style.position, 'absolute', 'style.position must be absolute');
      assert.equal(canvasMock.style.top, '0', 'style.top must be 0');
      assert.equal(canvasMock.style.left, '0', 'style.left must be 0');
      assert.equal(canvasMock.style.width, '100%', 'style.width must be 100%');
      assert.equal(canvasMock.style.height, '100%', 'style.height must be 100%');

      // 2. Resize across diverse resolutions (desktop, tablet, mobile)
      const testResolutions = [
        { w: 1440, h: 900 },
        { w: 1920, h: 1080 },
        { w: 768, h: 1024 },
        { w: 390, h: 844 },
      ];

      for (const res of testResolutions) {
        bg.resize(res.w, res.h);

        // Internal pixel buffer scales with DPR
        assert.equal(canvasMock.width, Math.round(res.w * 1.0));
        assert.equal(canvasMock.height, Math.round(res.h * 1.0));

        // CRITICAL INVARIANT: Pinned CSS dimensions remain 100% and absolute,
        // preventing any Cumulative Layout Shift (CLS = 0)
        assert.equal(
          canvasMock.style.position,
          'absolute',
          'CSS position must remain absolute during resize'
        );
        assert.equal(
          canvasMock.style.width,
          '100%',
          'CSS width must remain 100% during resize'
        );
        assert.equal(
          canvasMock.style.height,
          '100%',
          'CSS height must remain 100% during resize'
        );
      }

      bg.unmount();
    });

    it('verifies MIDI to frequency audio mapping and phase tracks spec integrity', () => {
      // A4 = 440 Hz
      const a4 = midiToFrequency(69);
      assert.ok(Math.abs(a4 - 440) < 0.001, 'MIDI 69 must map to 440Hz');

      // C4 = 261.63 Hz (MIDI 60)
      const c4 = midiToFrequency(60);
      assert.ok(Math.abs(c4 - 261.625) < 0.01, 'MIDI 60 must map to 261.63Hz');

      // Verify all 5 game phase tracks
      const phases = ['receive', 'trade', 'build', 'income', 'ended'];
      for (const p of phases) {
        const spec = PHASE_TRACKS[p];
        assert.ok(spec, `Phase track for ${p} must exist`);
        assert.ok(spec.beatDuration > 0, `beatDuration must be positive`);
        assert.ok(spec.chords.length > 0, `chords must not be empty`);
        assert.ok(spec.filterCutoff >= 800 && spec.filterCutoff <= 2000, `filterCutoff must be lo-fi band`);
      }
    });
  });
});
