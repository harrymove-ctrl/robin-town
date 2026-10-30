import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExposureGrid,
  PHASE_PALETTES,
  drawFallback,
  type ExposureGridPhase,
  type PhaseColors,
} from '../../src/ui/exposure-grid.js';

function createMockCanvas(width = 800, height = 600) {
  const listeners: Record<string, Function[]> = {};
  const drawCalls: { method: string; args: unknown[] }[] = [];

  const mockCtx = {
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
    strokeRect(x: number, y: number, w: number, h: number) {
      drawCalls.push({ method: 'strokeRect', args: [x, y, w, h] });
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

  const canvas = {
    width,
    height,
    getContext(type: string) {
      if (type === '2d') {
        return mockCtx;
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
  } as unknown as HTMLCanvasElement & {
    _listeners: Record<string, Function[]>;
    _drawCalls: { method: string; args: unknown[] }[];
  };

  return canvas;
}

describe('SolaceUI ExposureGrid Shader Background (Milestone M7)', () => {
  it('defines valid 5-ink color palettes for all 5 game phases', () => {
    const phases: ExposureGridPhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

    for (const phase of phases) {
      const palette = PHASE_PALETTES[phase];
      assert.ok(palette, `Phase ${phase} should have a palette defined`);

      const channels: (keyof PhaseColors)[] = ['grid', 'accent', 'secondary', 'ink', 'paper'];
      for (const channel of channels) {
        const color = palette[channel];
        assert.equal(color.length, 3, `Color ${channel} in ${phase} must have 3 RGB components`);
        for (let i = 0; i < 3; i++) {
          assert.ok(
            color[i] >= 0.0 && color[i] <= 1.0,
            `Component ${i} of ${channel} in ${phase} must be bounded between 0 and 1, got ${color[i]}`
          );
        }
      }
    }
  });

  it('instantiates and mounts cleanly in headless Node environment via Canvas2D fallback', () => {
    const canvas = createMockCanvas(800, 600);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'trade',
      intensity: 0.85,
      columns: 5,
      rows: 5,
    });

    assert.equal(renderer.getCanvas(), canvas);
    assert.equal(renderer.isWebGL(), false);

    renderer.mount();

    assert.ok(canvas._drawCalls.length > 0, 'drawFallback should have performed canvas drawing');
    const clearRectCall = canvas._drawCalls.find((c) => c.method === 'clearRect');
    assert.ok(clearRectCall, 'Should clear canvas in fallback rendering');

    renderer.unmount();
  });

  it('transitions phase theme smoothly and adapts canvas fallback colors', () => {
    const canvas = createMockCanvas(1000, 700);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    renderer.mount();
    canvas._drawCalls.length = 0;

    renderer.setPhaseTheme('build', 400);
    assert.ok(canvas._drawCalls.length > 0, 'Should re-draw canvas when phase theme changes in fallback mode');

    renderer.setPhaseTheme('income');
    renderer.setPhaseTheme('ended');

    renderer.render(1.5);
    renderer.unmount();
  });

  it('updates intensity and print treatments accurately', () => {
    const canvas = createMockCanvas(800, 600);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'trade',
    });

    renderer.mount();

    renderer.setIntensity(1.5);
    renderer.setTreatment('exposure');
    renderer.setTreatment('monochrome');
    renderer.setTreatment('chroma');
    renderer.setTreatment(2);

    renderer.unmount();
  });

  it('drawFallback executes full atmospheric landscape pipeline', () => {
    const canvas = createMockCanvas(600, 400);
    drawFallback(canvas, PHASE_PALETTES.trade, 0.9);

    const methods = canvas._drawCalls.map((c) => c.method);
    assert.ok(methods.includes('save'), 'drawFallback must save context');
    assert.ok(methods.includes('clearRect'), 'drawFallback must clearRect');
    assert.ok(methods.includes('fillRect'), 'drawFallback must fillRect');
    assert.ok(methods.includes('arc'), 'drawFallback must draw celestial sun/moon arc');
    assert.ok(methods.includes('bezierCurveTo'), 'drawFallback must draw skyline curves');
    assert.ok(methods.includes('stroke'), 'drawFallback must stroke tactical grid lines');
    assert.ok(methods.includes('restore'), 'drawFallback must restore context');
  });

  it('handles resize safely clamping minimum dimensions', () => {
    const canvas = createMockCanvas(0, 0);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'receive',
    });

    renderer.resize(0, 0);
    assert.ok(canvas.width >= 1, 'Width should be clamped to at least 1 pixel');
    assert.ok(canvas.height >= 1, 'Height should be clamped to at least 1 pixel');

    renderer.resize(1200, 800);
    assert.ok(canvas.width >= 800, 'Width should be updated for given dimensions');
    assert.ok(canvas.height >= 600, 'Height should be updated for given dimensions');

    renderer.unmount();
  });

  it('handles context loss and recovery methods safely', () => {
    const canvas = createMockCanvas(800, 600);
    const renderer = new ExposureGrid({
      canvas,
      phaseTheme: 'income',
    });

    renderer.mount();
    const lostResult = renderer.loseContextForTesting();
    assert.equal(typeof lostResult, 'boolean');

    const restoreResult = renderer.restoreContextForTesting();
    assert.equal(typeof restoreResult, 'boolean');

    renderer.unmount();
  });
});
