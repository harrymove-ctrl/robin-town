import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IPodController,
  DRAG_STEP_DEGREES,
  ACCELERATION_TIERS,
  REVERSE_THRESHOLD_DEGREES,
  type iPodAction,
} from '../../src/ui/ipod-controller.js';

// Minimal mock DOM node for headless Node.js
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
  public offsetTop = 0;
  public offsetHeight = 24;
  public scrollTop = 0;
  public clientHeight = 160;
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

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
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

  public getBoundingClientRect() {
    return { left: 0, top: 0, width: 350, height: 350, right: 350, bottom: 350 };
  }
}

function setupMockDocument() {
  const doc = {
    createElement(tagName: string) {
      return new MockElement(tagName);
    },
  };
  (global as unknown as { document: unknown }).document = doc;
}

const SAMPLE_ACTIONS: iPodAction[] = [
  { id: 'draft-parcel', label: 'Draft Parcel', handler: () => {} },
  { id: 'propose-trade', label: 'Propose Trade', handler: () => {} },
  { id: 'build-shop', label: 'Build Shop', handler: () => {} },
  { id: 'collect-income', label: 'Collect Income', handler: () => {} },
  { id: 'settings', label: 'Settings', handler: () => {} },
];

describe('iPod Classic Interactive Controller (Milestone M7)', () => {
  beforeEach(() => {
    setupMockDocument();
  });

  it('renders upper LCD screen and lower click wheel with quadrant buttons', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Robin-Town Menu',
      actions: SAMPLE_ACTIONS,
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    assert.equal(chassis.className, 'ipod-classic-chassis');

    const screen = chassis.children[0];
    assert.equal(screen.className, 'ipod-screen');

    const wheel = chassis.children[1];
    assert.equal(wheel.className, 'ipod-click-wheel');

    // Verify 4 quadrant buttons and 1 select button
    assert.equal(wheel.children.length, 5);

    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction()?.label, 'Draft Parcel');

    controller.unmount();
  });

  it('steps selection forward and backward with bounds wrapping', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    let scrolledDelta = 0;
    const controller = new IPodController({
      container,
      menuTitle: 'Robin-Town Actions',
      actions: SAMPLE_ACTIONS,
      onScroll: (delta) => {
        scrolledDelta = delta;
      },
    });

    controller.mount();

    controller.step(1);
    assert.equal(controller.getSelectedIndex(), 1);
    assert.equal(scrolledDelta, 1);

    controller.step(2);
    assert.equal(controller.getSelectedIndex(), 3);

    controller.step(-1);
    assert.equal(controller.getSelectedIndex(), 2);

    // Backward wrapping
    controller.step(-3);
    assert.equal(controller.getSelectedIndex(), 4);

    // Forward wrapping
    controller.step(1);
    assert.equal(controller.getSelectedIndex(), 0);

    controller.unmount();
  });

  it('executes active action upon selectActive and invokes handlers', () => {
    let actionFired = false;
    let selectedAction: iPodAction | null = null;

    const testActions: iPodAction[] = [
      {
        id: 'action-1',
        label: 'Action 1',
        handler: () => {
          actionFired = true;
        },
      },
      { id: 'action-2', label: 'Action 2', handler: () => {} },
    ];

    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Action Test',
      actions: testActions,
      onSelect: (action) => {
        selectedAction = action;
      },
    });

    controller.mount();
    controller.selectActive();

    assert.equal(actionFired, true, 'Handler of selected action must be executed');
    assert.ok(selectedAction !== null);
    assert.equal((selectedAction as iPodAction).id, 'action-1');

    controller.unmount();
  });

  it('supports hierarchical submenu navigation and breadcrumbs', () => {
    const subActions: iPodAction[] = [
      { id: 'sub-1', label: 'Sub 1', handler: () => {} },
      { id: 'sub-2', label: 'Sub 2', handler: () => {} },
    ];

    const rootActions: iPodAction[] = [
      {
        id: 'nav-sub',
        label: 'Open Submenu',
        handler: () => {},
        submenu: {
          title: 'Submenu Screen',
          actions: subActions,
        },
      },
    ];

    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Root Screen',
      actions: rootActions,
    });

    controller.mount();
    assert.equal(controller.getActiveAction()?.label, 'Open Submenu');

    // Trigger submenu via select
    controller.selectActive();
    assert.equal(controller.getActiveAction()?.label, 'Sub 1');

    // Press MENU to pop submenu
    const popped = controller.popSubmenu();
    assert.equal(popped, true);
    assert.equal(controller.getActiveAction()?.label, 'Open Submenu');

    // Popping root returns false
    const rootPopped = controller.popSubmenu();
    assert.equal(rootPopped, false);

    controller.unmount();
  });

  it('toggles play/pause state and mute controls', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Playback Test',
      actions: SAMPLE_ACTIONS,
    });

    controller.mount();

    assert.equal(controller.isPlaying(), true);
    controller.pressPlay();
    assert.equal(controller.isPlaying(), false);
    controller.pressPlay();
    assert.equal(controller.isPlaying(), true);

    assert.equal(controller.isMuted(), false);
    const muted = controller.toggleMute();
    assert.equal(muted, true);
    assert.equal(controller.isMuted(), true);

    controller.unmount();
  });

  it('simulates 15-degree notch wheel rotation with quantization and acceleration', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Wheel Simulation',
      actions: SAMPLE_ACTIONS,
    });

    controller.mount();
    assert.equal(controller.getSelectedIndex(), 0);

    // 15 degrees yields 1 notch step
    controller.simulateWheelTurn(15);
    assert.equal(controller.getSelectedIndex(), 1);

    // 30 degrees yields 2 notch steps
    controller.simulateWheelTurn(30);
    assert.equal(controller.getSelectedIndex(), 3);

    // Negative turn steps backward
    controller.simulateWheelTurn(-15);
    assert.equal(controller.getSelectedIndex(), 2);

    controller.unmount();
  });

  it('maps Chinatown phase actions accurately across all 5 phases', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Chinatown Phases',
      actions: [],
    });

    controller.mount();

    // 1. Receive
    controller.setPhaseActions('receive');
    assert.equal(controller.getActiveAction()?.id, 'draft-parcel');

    // 2. Trade
    controller.setPhaseActions('trade');
    assert.equal(controller.getActiveAction()?.id, 'open-otc');

    // 3. Build
    controller.setPhaseActions('build');
    assert.equal(controller.getActiveAction()?.id, 'deploy-shop');

    // 4. Income
    controller.setPhaseActions('income');
    assert.equal(controller.getActiveAction()?.id, 'collect-revenue');

    // 5. Ended
    controller.setPhaseActions('ended');
    assert.equal(controller.getActiveAction()?.id, 'podium-purse');

    controller.unmount();
  });

  it('suppresses microscopic angular tremor below reversal threshold during continuous turn', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Tremor Test',
      actions: SAMPLE_ACTIONS,
    });

    controller.mount();
    assert.equal(controller.getSelectedIndex(), 0);

    // Initial forward turn
    controller.simulateWheelTurn(15, 50, false);
    assert.equal(controller.getSelectedIndex(), 1);

    // Tiny 5-degree reverse tremor (under REVERSE_THRESHOLD_DEGREES = 8)
    controller.simulateWheelTurn(-5, 50, true);
    // Index should NOT reverse because tremor is suppressed
    assert.equal(controller.getSelectedIndex(), 1);

    // Accumulated opposite turn exceeding threshold (e.g. -25 degrees) overcomes filter
    controller.simulateWheelTurn(-25, 50, true);
    assert.equal(controller.getSelectedIndex(), 0);

    controller.unmount();
  });

  it('triggers quadrant and select button clicks properly', () => {
    let menuClicked = false;
    let actionExecuted = false;

    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Button Test',
      actions: [
        {
          id: 'act-0',
          label: 'Action 0',
          handler: () => {
            actionExecuted = true;
          },
        },
        { id: 'act-1', label: 'Action 1', handler: () => {} },
      ],
      onMenu: () => {
        menuClicked = true;
      },
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];
    const btnMenu = wheel.children[0];
    const btnPlay = wheel.children[1];
    const btnPrev = wheel.children[2];
    const btnNext = wheel.children[3];
    const btnSelect = wheel.children[4];

    // Test PREV and NEXT buttons
    assert.equal(controller.getSelectedIndex(), 0);
    btnNext.click();
    assert.equal(controller.getSelectedIndex(), 1);
    btnPrev.click();
    assert.equal(controller.getSelectedIndex(), 0);

    // Test PLAY button
    assert.equal(controller.isPlaying(), true);
    btnPlay.click();
    assert.equal(controller.isPlaying(), false);

    // Test SELECT button
    btnSelect.click();
    assert.equal(actionExecuted, true);

    // Test MENU button
    btnMenu.click();
    assert.equal(menuClicked, true);

    controller.unmount();
  });

  it('unmounts cleanly and cleans up DOM elements and listeners', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Cleanup Test',
      actions: SAMPLE_ACTIONS,
    });

    controller.mount();
    assert.equal((container as unknown as MockElement).children.length, 1);

    controller.unmount();
    assert.equal((container as unknown as MockElement).children.length, 0);
  });
});
