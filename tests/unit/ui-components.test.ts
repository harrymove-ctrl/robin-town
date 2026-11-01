/**
 * tests/unit/ui-components.test.ts
 *
 * Comprehensive unit test suite for Milestone 12 UI Components:
 * 1. SolaceBackground: SolaceUI exposure-grid WebGL2 shader with warm palette, Canvas2D fallback,
 *    and zero layout shift resize handling.
 * 2. WalletFlywheelModal: Dual-mode wallet connection, real-time flywheel metrics, and governance voting UI.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';

import {
  SOLACE_WARM_PALETTES,
  SolaceBackground,
  drawSolaceCanvas2DFallback,
  type SolacePalette,
  type SolacePhase,
} from '../../src/ui/solace-background';

import {
  WalletFlywheelController,
  WalletFlywheelModal,
  type WalletFlywheelViewModel,
} from '../../src/ui/wallet-flywheel-modal';

import {
  WalletAdapter,
  DEFAULT_SIMULATED_ACCOUNTS,
} from '../../src/tokenomics/wallet';

import { createInitialFlywheelState } from '../../src/tokenomics/flywheel';

/**
 * Mock Canvas Element supporting 2D context drawing recording.
 */
function createMockCanvas(width = 800, height = 600) {
  const listeners: Record<string, Function[]> = {};
  const drawCalls: { method: string; args: unknown[] }[] = [];

  const styleRecord: Record<string, string> = {};

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
    style: styleRecord,
    getContext(type: string) {
      if (type === '2d') {
        return mockCtx;
      }
      return null; // Simulate headless Node where WebGL2 is absent
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

/**
 * Mock DOM Container for UI Modal testing.
 */
function createMockContainer(): HTMLElement {
  const listeners: Record<string, Function[]> = {};
  const element = {
    innerHTML: '',
    querySelector(selector: string) {
      if (selector === '.wallet-flywheel-dialog') {
        return element;
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
    _listeners: listeners,
  } as unknown as HTMLElement;

  return element;
}

describe('Suite 1: SolaceUI Background WebGL2 Shader and Warm Palettes', () => {
  it('defines valid RGB channel values bounded [0, 1] for all Solace warm palettes', () => {
    const phases: SolacePhase[] = ['default', 'receive', 'trade', 'build', 'income', 'ended'];
    const channels: (keyof SolacePalette)[] = ['grid', 'accent', 'secondary', 'ink', 'paper'];

    for (const phase of phases) {
      const pal = SOLACE_WARM_PALETTES[phase];
      assert.ok(pal, `Palette for phase ${phase} must exist`);

      for (const channel of channels) {
        const comp = pal[channel];
        assert.strictEqual(comp.length, 3, `${channel} in ${phase} must have 3 RGB channels`);
        for (let i = 0; i < 3; i++) {
          assert.ok(
            comp[i] >= 0.0 && comp[i] <= 1.0,
            `Component ${i} of ${channel} in ${phase} must be between 0 and 1, got ${comp[i]}`
          );
        }
      }
    }
  });

  it('instantiates and mounts cleanly in headless Node via Canvas2D fallback', () => {
    const canvas = createMockCanvas(800, 600);
    const bg = new SolaceBackground({
      canvas,
      phase: 'trade',
      intensity: 0.9,
    });

    assert.strictEqual(bg.getCanvas(), canvas);
    assert.strictEqual(bg.isWebGL(), false);

    bg.mount();

    // Verify Canvas2D fallback executed drawing commands
    assert.ok(canvas._drawCalls.length > 0, 'Canvas2D fallback should have executed drawing calls');
    const clearRect = canvas._drawCalls.find((c) => c.method === 'clearRect');
    assert.ok(clearRect, 'Should clear canvas in fallback rendering');

    bg.unmount();
  });

  it('enforces layout shift prevention by pinning canvas CSS dimensions to 100%', () => {
    const canvas = createMockCanvas(800, 600);
    const bg = new SolaceBackground({ canvas });

    // Verify CSS styles are explicitly pinned to eliminate layout shift
    assert.strictEqual(canvas.style.position, 'absolute');
    assert.strictEqual(canvas.style.top, '0');
    assert.strictEqual(canvas.style.left, '0');
    assert.strictEqual(canvas.style.width, '100%');
    assert.strictEqual(canvas.style.height, '100%');

    // Trigger resize
    bg.resize(1024, 768);

    // Verify CSS width/height remains unchanged (no CLS layout jump)
    assert.strictEqual(canvas.style.width, '100%');
    assert.strictEqual(canvas.style.height, '100%');

    bg.unmount();
  });

  it('handles devicePixelRatio clamping without layout shift or memory explosion', () => {
    const canvas = createMockCanvas(400, 300);
    const bg = new SolaceBackground({
      canvas,
      maxDpr: 1.5,
    });

    bg.resize(400, 300);
    // 400 * 1.5 maxDpr = 600
    assert.ok(canvas.width >= 400 && canvas.width <= 600);

    bg.unmount();
  });

  it('drawSolaceCanvas2DFallback executes celestial sunburst and grid strokes', () => {
    const canvas = createMockCanvas(600, 400);
    drawSolaceCanvas2DFallback(canvas, SOLACE_WARM_PALETTES.default, 0.85);

    const methods = canvas._drawCalls.map((c) => c.method);
    assert.ok(methods.includes('save'));
    assert.ok(methods.includes('clearRect'));
    assert.ok(methods.includes('fillRect'));
    assert.ok(methods.includes('arc'));
    assert.ok(methods.includes('bezierCurveTo'));
    assert.ok(methods.includes('stroke'));
    assert.ok(methods.includes('restore'));
  });
});

describe('Suite 2: WalletFlywheelController Headless Logic', () => {
  it('initializes with default seed proposals and active simulation wallet', () => {
    const walletAdapter = new WalletAdapter({ mode: 'simulation' });
    const flywheelState = createInitialFlywheelState();
    const controller = new WalletFlywheelController({ walletAdapter, flywheelState });

    const vm = controller.getViewModel();
    assert.strictEqual(vm.activeTab, 'wallet');
    assert.strictEqual(vm.walletMode, 'simulation');
    assert.strictEqual(vm.activeName, 'Alice');
    assert.strictEqual(vm.proposals.length, 3);
    assert.ok(vm.selectedProposal);
    assert.strictEqual(vm.selectedProposal?.id, 'RTP-1');
  });

  it('calculates burn preview and executes governance voting burns', async () => {
    const walletAdapter = new WalletAdapter({ mode: 'simulation' });
    const flywheelState = createInitialFlywheelState();
    const controller = new WalletFlywheelController({ walletAdapter, flywheelState });

    // Set voting power to 800
    controller.setVotingPower(800);
    assert.strictEqual(controller.getViewModel().calculatedBurnAmount, 40); // 5% of 800 = 40

    // Cast vote FOR RTP-3
    const res = await controller.castVote('RTP-3', true, 800);
    assert.strictEqual(res.vote.proposalId, 'RTP-3');
    assert.strictEqual(res.vote.burnAmount, 40);

    // Verify flywheel totalBurned increased by 40
    assert.strictEqual(controller.getFlywheelState().totalBurned, 40);
  });

  it('updates proposal selection and vote support options', () => {
    const walletAdapter = new WalletAdapter({ mode: 'simulation' });
    const controller = new WalletFlywheelController({ walletAdapter });

    controller.selectProposal('RTP-2');
    assert.strictEqual(controller.getViewModel().selectedProposal?.id, 'RTP-2');

    controller.setVoteSupport(false);
    assert.strictEqual(controller.getViewModel().voteSupport, false);
  });
});

describe('Suite 3: WalletFlywheelModal Presentation Component', () => {
  it('mounts, opens, and closes cleanly in mock DOM environment', () => {
    const container = createMockContainer();
    const walletAdapter = new WalletAdapter({ mode: 'simulation' });
    const controller = new WalletFlywheelController({ walletAdapter });
    const modal = new WalletFlywheelModal(container, controller);

    modal.mount();
    assert.strictEqual(modal.isOpen(), false);

    modal.open('flywheel');
    assert.strictEqual(modal.isOpen(), true);
    assert.ok(container.innerHTML.includes('Total $wif Burned'));

    modal.close();
    assert.strictEqual(modal.isOpen(), false);
    assert.strictEqual(container.innerHTML, '');

    modal.unmount();
  });

  it('renders all three tabs (wallet, flywheel, governance) with Solace theme', () => {
    const container = createMockContainer();
    const walletAdapter = new WalletAdapter({ mode: 'simulation' });
    const controller = new WalletFlywheelController({ walletAdapter });
    const modal = new WalletFlywheelModal(container, controller);

    modal.mount();

    // Tab 1: Wallet
    modal.open('wallet');
    assert.ok(container.innerHTML.includes('Dual-Mode Wallet'));
    assert.ok(container.innerHTML.includes('Alice'));
    assert.ok(container.innerHTML.includes('Bob'));

    // Tab 2: Flywheel
    modal.open('flywheel');
    assert.ok(container.innerHTML.includes('Flywheel Metrics'));
    assert.ok(container.innerHTML.includes('Community Staking Vault'));

    // Tab 3: Governance
    modal.open('governance');
    assert.ok(container.innerHTML.includes('Governance Voting'));
    assert.ok(container.innerHTML.includes('RTP-1'));

    modal.unmount();
  });
});
