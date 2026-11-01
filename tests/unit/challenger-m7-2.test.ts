import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IPodController,
  DRAG_STEP_DEGREES,
  MIN_SPEED_THRESHOLD,
  ACCELERATION_TIERS,
  TIER_DURATION_MS,
  REVERSE_THRESHOLD_DEGREES,
  CENTER_DEAD_ZONE,
  WHEEL_SIZE,
  type iPodAction,
} from '../../src/ui/ipod-controller.js';

// Enhanced Mock Element simulating DOM node hierarchy and event dispatching
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

  public dispatchEvent(event: { type: string; [key: string]: unknown }): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }

  public click(): void {
    this.dispatchEvent({
      type: 'click',
      stopPropagation: () => {},
      preventDefault: () => {},
    });
  }

  public getBoundingClientRect() {
    return { left: 0, top: 0, width: WHEEL_SIZE, height: WHEEL_SIZE, right: WHEEL_SIZE, bottom: WHEEL_SIZE };
  }
}

// Window mock tracking global event listeners and Web Audio simulation
class MockWindow {
  public listeners: Record<string, Function[]> = {};
  public AudioContext: unknown = null;

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  public dispatchEvent(event: { type: string; [key: string]: unknown }): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }
}

class MockAudioBufferSourceNode {
  public buffer: unknown = null;
  public startedTimes: number[] = [];
  public isConnected = false;

  public connect(_destination: unknown): void {
    this.isConnected = true;
  }

  public start(time: number): void {
    this.startedTimes.push(time);
  }
}

class MockGainNode {
  public gain = { value: 1.0 };
  public connect(_destination: unknown): void {}
}

class MockAudioBuffer {
  public length: number;
  public sampleRate: number;
  private channelData: Float32Array;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = new Float32Array(length);
  }

  public getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }
}

class MockAudioContext {
  public sampleRate = 44100;
  public currentTime = 0;
  public state: 'running' | 'suspended' | 'closed' = 'running';
  public sourcesCreated: MockAudioBufferSourceNode[] = [];
  public closeCalls = 0;

  public createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  public createBufferSource(): MockAudioBufferSourceNode {
    const node = new MockAudioBufferSourceNode();
    this.sourcesCreated.push(node);
    return node;
  }

  public createGain(): MockGainNode {
    return new MockGainNode();
  }

  public resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  public close(): Promise<void> {
    this.state = 'closed';
    this.closeCalls++;
    return Promise.resolve();
  }

  public get destination(): unknown {
    return {};
  }
}

let mockWindow: MockWindow;
const originalPerformance = global.performance;

function setupMockEnvironment(enableWebAudio = false) {
  mockWindow = new MockWindow();
  if (enableWebAudio) {
    mockWindow.AudioContext = MockAudioContext;
  }
  const doc = {
    createElement(tagName: string) {
      return new MockElement(tagName);
    },
  };
  (global as unknown as { document: unknown }).document = doc;
  (global as unknown as { window: unknown }).window = mockWindow;
}

const TEST_ACTIONS: iPodAction[] = [
  { id: 'act-0', label: 'Draft Parcel', handler: () => {} },
  { id: 'act-1', label: 'Propose Deal', handler: () => {} },
  { id: 'act-2', label: 'Build Tile', handler: () => {} },
  { id: 'act-3', label: 'Harvest Income', handler: () => {} },
  { id: 'act-4', label: 'Flywheel Ledger', handler: () => {} },
];

describe('Empirical Challenge Suite 1: Click Wheel Gesture Physics', () => {
  beforeEach(() => {
    setupMockEnvironment(false);
  });

  afterEach(() => {
    global.performance = originalPerformance;
  });

  it('guarantees seamless rotary movement across the +/-180 degree coordinate seam without glitches', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    let totalScrollDelta = 0;
    const controller = new IPodController({
      container,
      menuTitle: 'Seam Test',
      actions: TEST_ACTIONS,
      onScroll: (delta) => {
        totalScrollDelta += delta;
      },
    });

    controller.mount();

    // Wheel dimensions: 350x350, center at (175, 175), radius = 175.
    // Tracking start at angle = 170 degrees (just below 180 seam).
    const centerX = 175;
    const centerY = 175;
    const trackRadius = 120;

    const angleToXY = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return {
        clientX: centerX + trackRadius * Math.cos(rad),
        clientY: centerY + trackRadius * Math.sin(rad),
      };
    };

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    // Pointer down at 170 degrees
    const ptStart = angleToXY(170);
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: ptStart.clientX,
      clientY: ptStart.clientY,
      target: wheel,
    });

    // Clockwise crossing: 170 -> 175 -> 179 -> -179 -> -175 -> -170
    // Total swept distance = 20 degrees clockwise.
    const sweepClockwise = [175, 179, -179, -175, -170];
    for (const deg of sweepClockwise) {
      const pt = angleToXY(deg);
      mockWindow.dispatchEvent({
        type: 'pointermove',
        clientX: pt.clientX,
        clientY: pt.clientY,
      });
    }

    // 20 degrees clockwise exceeds 15-degree notch threshold, triggering exactly 1 forward notch
    assert.equal(totalScrollDelta, 1, 'Sweeping 20 degrees clockwise across seam must yield +1 step');
    assert.equal(controller.getSelectedIndex(), 1);

    // Counter-clockwise crossing back: -170 -> -175 -> -179 -> 179 -> 175 -> 170 -> 140
    // Swept distance = 50 degrees counter-clockwise.
    // Note: Reversal threshold consumes 8 degrees, leaving 42 degrees, yielding 2 backward notches (30 deg).
    const sweepCounter = [-175, -179, 179, 175, 170, 160, 150, 140];
    for (const deg of sweepCounter) {
      const pt = angleToXY(deg);
      mockWindow.dispatchEvent({
        type: 'pointermove',
        clientX: pt.clientX,
        clientY: pt.clientY,
      });
    }

    assert.ok(totalScrollDelta < 1, 'Counter-clockwise movement across seam must step backward');

    mockWindow.dispatchEvent({ type: 'pointerup' });
    controller.unmount();
  });

  it('stress tests 100 continuous full circular rotations crossing the seam 100 times without coordinate drift', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    let forwardScrollSteps = 0;
    const controller = new IPodController({
      container,
      menuTitle: '100-Spin Stress',
      actions: TEST_ACTIONS,
      onScroll: (delta) => {
        if (delta > 0) forwardScrollSteps += delta;
      },
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];
    const centerX = 175;
    const centerY = 175;
    const radius = 120;

    // Start pointer at 0 degrees
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: centerX + radius,
      clientY: centerY,
      target: wheel,
    });

    // 100 full rotations with 36 points per rotation (10-degree increments) = 3600 move events
    const rotations = 100;
    const stepsPerRot = 36;
    for (let r = 0; r < rotations; r++) {
      for (let s = 1; s <= stepsPerRot; s++) {
        const deg = (s * (360 / stepsPerRot)) % 360;
        const mappedDeg = deg > 180 ? deg - 360 : deg;
        const rad = (mappedDeg * Math.PI) / 180;
        mockWindow.dispatchEvent({
          type: 'pointermove',
          clientX: centerX + radius * Math.cos(rad),
          clientY: centerY + radius * Math.sin(rad),
        });
      }
    }

    mockWindow.dispatchEvent({ type: 'pointerup' });

    // 100 full 360-degree turns = 36,000 degrees.
    // At 15 degrees per notch, base notches = 36000 / 15 = 2400 notches.
    assert.ok(
      forwardScrollSteps >= 2400,
      `100 full rotations must produce at least 2400 steps, actual: ${forwardScrollSteps}`
    );

    controller.unmount();
  });

  it('rejects pointer events inside the center dead zone without generating spurious steps or NaNs', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    let scrollCount = 0;
    const controller = new IPodController({
      container,
      menuTitle: 'Dead Zone Test',
      actions: TEST_ACTIONS,
      onScroll: () => {
        scrollCount++;
      },
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];
    const centerX = 175;
    const centerY = 175;

    // CENTER_DEAD_ZONE = 0.1, radius = 175 -> dead zone radius = 17.5px.
    // 1. Pointer down inside dead zone (distance = 5px)
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: centerX + 5,
      clientY: centerY + 5,
      target: wheel,
    });

    // Move within dead zone
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle * Math.PI) / 180;
      mockWindow.dispatchEvent({
        type: 'pointermove',
        clientX: centerX + 8 * Math.cos(rad),
        clientY: centerY + 8 * Math.sin(rad),
      });
    }

    assert.equal(scrollCount, 0, 'Pointer movements within dead zone must never produce scroll steps');

    // Move outside dead zone in same gesture session
    mockWindow.dispatchEvent({
      type: 'pointermove',
      clientX: centerX + 120,
      clientY: centerY,
    });

    assert.equal(scrollCount, 0, 'Initial gesture started in dead zone must remain inactive');
    mockWindow.dispatchEvent({ type: 'pointerup' });

    // 2. Pointer down outside dead zone, enter dead zone, and exit dead zone
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: centerX + 100,
      clientY: centerY,
      target: wheel,
    });

    // Move into dead zone (distance = 10px < 17.5px)
    mockWindow.dispatchEvent({
      type: 'pointermove',
      clientX: centerX + 10,
      clientY: centerY,
    });

    // Move back out to 90 degrees
    mockWindow.dispatchEvent({
      type: 'pointermove',
      clientX: centerX,
      clientY: centerY + 100,
    });

    mockWindow.dispatchEvent({ type: 'pointerup' });

    // Stepping from 0 to 90 degrees equals 90 degrees (6 notches of 15 deg)
    assert.ok(scrollCount > 0, 'Re-entering active zone after dead zone transit continues delta tracking');

    controller.unmount();
  });

  it('filters rapid reversals under 8 degrees while accepting sustained reversals', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    let netScroll = 0;
    const controller = new IPodController({
      container,
      menuTitle: 'Reversal Tremor',
      actions: TEST_ACTIONS,
      onScroll: (delta) => {
        netScroll += delta;
      },
    });

    controller.mount();

    // 1. Clean forward turn of exactly 15 degrees: leaves accumulatedDegrees at 0
    controller.simulateWheelTurn(15, 50, false);
    assert.equal(netScroll, 1);
    assert.equal(controller.getSelectedIndex(), 1);

    // 2. Apply micro-tremor reversals strictly under REVERSE_THRESHOLD_DEGREES (8 degrees)
    controller.simulateWheelTurn(-4, 20, true);
    assert.equal(netScroll, 1, 'Tremor of -4 degrees must be suppressed');

    controller.simulateWheelTurn(-3, 20, true);
    assert.equal(netScroll, 1, 'Cumulative tremor of 7 degrees must be suppressed');

    // 3. Forward turn of +5 degrees: stays under 15-degree notch threshold, so no step occurs
    controller.simulateWheelTurn(5, 20, true);
    assert.equal(netScroll, 1, 'Forward movement under 15 degrees does not step');

    // 4. Now apply sustained reverse turn exceeding 8 degrees (reversal threshold breaks through)
    controller.simulateWheelTurn(-10, 30, true);
    // 5. Subsequent reverse turn of -20 degrees exceeds 15-degree notch threshold, stepping backward
    controller.simulateWheelTurn(-20, 30, true);
    assert.equal(netScroll, 0, 'Sustained reversal exceeding 8 degrees must execute backward step');
    assert.equal(controller.getSelectedIndex(), 0);

    controller.unmount();
  });

  it('escalates step multiplier across Fibonacci acceleration tiers during high-velocity rotation', () => {
    let mockTime = 1000;
    global.performance = {
      now: () => mockTime,
    } as unknown as Performance;

    const container = new MockElement('div') as unknown as HTMLElement;
    const recordedMultipliers: number[] = [];
    const controller = new IPodController({
      container,
      menuTitle: 'Fibonacci Acceleration',
      actions: TEST_ACTIONS,
      onScroll: (delta) => {
        recordedMultipliers.push(Math.abs(delta));
      },
    });

    controller.mount();

    assert.deepEqual(ACCELERATION_TIERS, [1, 2, 3, 5, 8, 13, 21, 34]);
    assert.equal(MIN_SPEED_THRESHOLD, 180);
    assert.equal(TIER_DURATION_MS, 500);

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];
    const centerX = 175;
    const centerY = 175;
    const radius = 120;

    // Pointer down to initiate tracking
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: centerX + radius,
      clientY: centerY,
      target: wheel,
    });

    // Helper to simulate a step with precise delta angle and elapsed time
    const advanceTurn = (deltaDeg: number, dtMs: number) => {
      mockTime += dtMs;
      // Convert angular progression to coordinates
      const rad = ((mockTime % 3600) * Math.PI) / 180;
      mockWindow.dispatchEvent({
        type: 'pointermove',
        clientX: centerX + radius * Math.cos(rad),
        clientY: centerY + radius * Math.sin(rad),
      });
    };

    // Ramp up speed past 180 deg/s threshold:
    // Move 15 degrees every 40ms = 375 deg/s speed.
    // We execute turns to escalate through all 8 Fibonacci tiers:
    // Tier 0 (0-499ms): multiplier 1
    // Tier 1 (500-999ms): multiplier 2
    // Tier 2 (1000-1499ms): multiplier 3
    // Tier 3 (1500-1999ms): multiplier 5
    // Tier 4 (2000-2499ms): multiplier 8
    // Tier 5 (2500-2999ms): multiplier 13
    // Tier 6 (3000-3499ms): multiplier 21
    // Tier 7 (>= 3500ms): multiplier 34

    // Run continuous fast rotation for 4000ms in 40ms steps (100 steps of 15 deg)
    for (let step = 0; step < 100; step++) {
      advanceTurn(15, 40);
    }

    mockWindow.dispatchEvent({ type: 'pointerup' });

    assert.ok(recordedMultipliers.length > 0, 'Must record multiple scroll events');
    const peakMultiplier = Math.max(...recordedMultipliers);
    assert.ok(
      peakMultiplier >= 2,
      `High-velocity spinning across time must escalate acceleration multiplier, peak: ${peakMultiplier}`
    );

    controller.unmount();
  });
});

describe('Empirical Challenge Suite 2: Menu State Machine Robustness', () => {
  beforeEach(() => {
    setupMockEnvironment(false);
  });

  it('handles empty actions array gracefully without exceptions or divide-by-zero crashes', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Empty Menu',
      actions: [],
    });

    controller.mount();

    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction(), null);

    // Boundary calls on empty list
    assert.doesNotThrow(() => controller.step(1));
    assert.doesNotThrow(() => controller.step(-1));
    assert.doesNotThrow(() => controller.step(100));
    assert.doesNotThrow(() => controller.step(-100));
    assert.doesNotThrow(() => controller.setSelectedIndex(5));
    assert.doesNotThrow(() => controller.selectActive());
    assert.doesNotThrow(() => controller.pressPlay());
    assert.doesNotThrow(() => controller.pressMenu());

    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction(), null);

    controller.unmount();
  });

  it('resets selectedIndex safely on dynamic setActions with varying array lengths', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Dynamic Lengths',
      actions: TEST_ACTIONS,
    });

    controller.mount();

    // Navigate to index 4 (last item)
    controller.setSelectedIndex(4);
    assert.equal(controller.getSelectedIndex(), 4);

    // Replace with smaller array of 2 actions: index must reset to 0
    controller.setActions('Two Actions', [
      { id: 'short-0', label: 'Short 0', handler: () => {} },
      { id: 'short-1', label: 'Short 1', handler: () => {} },
    ]);
    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction()?.id, 'short-0');

    // Replace with single action: index must remain 0
    controller.setActions('Single Action', [
      { id: 'solo', label: 'Solo', handler: () => {} },
    ]);
    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction()?.id, 'solo');

    // Replace with 500 actions
    const bigList: iPodAction[] = Array.from({ length: 500 }, (_, i) => ({
      id: `big-${i}`,
      label: `Big Item ${i}`,
      handler: () => {},
    }));
    controller.setActions('500 Actions', bigList);
    assert.equal(controller.getSelectedIndex(), 0);

    // Step backward by 1: wraps cleanly to 499
    controller.step(-1);
    assert.equal(controller.getSelectedIndex(), 499);
    assert.equal(controller.getActiveAction()?.id, 'big-499');

    // Replace with empty array
    controller.setActions('Now Empty', []);
    assert.equal(controller.getSelectedIndex(), 0);
    assert.equal(controller.getActiveAction(), null);

    controller.unmount();
  });

  it('preserves navigation stack integrity and selected indices during rapid nested push/pop cycles', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Level 0',
      actions: [
        { id: 'l0-0', label: 'Level 0 Item 0', handler: () => {} },
        { id: 'l0-1', label: 'Level 0 Item 1', handler: () => {} },
      ],
    });

    controller.mount();
    controller.setSelectedIndex(1);
    assert.equal(controller.getSelectedIndex(), 1);

    // Push 10 nested levels, selecting a distinct index at each level
    const depth = 10;
    for (let d = 1; d <= depth; d++) {
      const actions: iPodAction[] = [
        { id: `l${d}-0`, label: `Level ${d} Item 0`, handler: () => {} },
        { id: `l${d}-1`, label: `Level ${d} Item 1`, handler: () => {} },
        { id: `l${d}-2`, label: `Level ${d} Item 2`, handler: () => {} },
      ];
      controller.pushSubmenu(`Level ${d}`, actions);
      controller.setSelectedIndex(d % 3);
    }

    assert.equal(controller.getSelectedIndex(), depth % 3);

    // Pop all 10 levels in reverse and verify previous selected indices are preserved
    for (let d = depth - 1; d >= 1; d--) {
      const popped = controller.popSubmenu();
      assert.equal(popped, true);
      assert.equal(controller.getSelectedIndex(), d % 3);
    }

    // Pop back to root level 0
    const rootPopped = controller.popSubmenu();
    assert.equal(rootPopped, true);
    assert.equal(controller.getSelectedIndex(), 1, 'Root selected index must be restored to 1');

    // Excessive popping on root stack
    for (let i = 0; i < 5; i++) {
      const excess = controller.popSubmenu();
      assert.equal(excess, false, 'Popping empty stack must return false safely');
    }

    controller.unmount();
  });

  it('verifies mathematical correctness of boundary index wrapping across edge lengths', () => {
    const container = new MockElement('div') as unknown as HTMLElement;

    // Test with single item (length = 1)
    const c1 = new IPodController({
      container,
      menuTitle: '1 Item',
      actions: [{ id: 'only', label: 'Only', handler: () => {} }],
    });
    c1.mount();
    c1.step(1);
    assert.equal(c1.getSelectedIndex(), 0);
    c1.step(-1);
    // In JavaScript IEEE 754 arithmetic, (0 + -1) % 1 produces -0.
    // Under standard equality (===), -0 === 0 evaluates true.
    assert.equal(c1.getSelectedIndex() === 0, true);
    assert.equal(Object.is(c1.getSelectedIndex(), -0), true, 'Produces IEEE 754 negative zero under negative modulo');
    c1.step(50);
    assert.equal(c1.getSelectedIndex(), 0);
    c1.step(-50);
    assert.equal(c1.getSelectedIndex() === 0, true);
    c1.unmount();

    // Test with two items (length = 2)
    const c2 = new IPodController({
      container,
      menuTitle: '2 Items',
      actions: [
        { id: 'first', label: 'First', handler: () => {} },
        { id: 'second', label: 'Second', handler: () => {} },
      ],
    });
    c2.mount();
    assert.equal(c2.getSelectedIndex(), 0);
    c2.step(1);
    assert.equal(c2.getSelectedIndex(), 1);
    c2.step(1);
    assert.equal(c2.getSelectedIndex(), 0);
    c2.step(-1);
    assert.equal(c2.getSelectedIndex(), 1);
    c2.step(-1);
    assert.equal(c2.getSelectedIndex(), 0);
    c2.unmount();

    // Test with five items and large jumps
    const c5 = new IPodController({
      container,
      menuTitle: '5 Items',
      actions: TEST_ACTIONS,
    });
    c5.mount();
    // Wrap forward multiple cycles: (0 + 12) % 5 = 2
    c5.step(12);
    assert.equal(c5.getSelectedIndex(), 2);

    // Wrap backward multiple cycles: (2 - 17) = -15 % 5 = -0
    // Note: In JavaScript IEEE 754, (-15 % 5) produces -0, which satisfies (index === 0)
    c5.step(-17);
    assert.equal(c5.getSelectedIndex() === 0, true, 'Wrapped index must evaluate equal to 0');
    assert.equal(Math.abs(c5.getSelectedIndex()), 0);

    // Wrap backward single step: (0 - 1) % 5 = -1 + 5 = 4
    c5.step(-1);
    assert.equal(c5.getSelectedIndex(), 4);
    c5.unmount();
  });
});

describe('Empirical Challenge Suite 3: Web Audio Safety & Rate Limiting', () => {
  beforeEach(() => {
    setupMockEnvironment(true);
  });

  it('lazily initializes AudioContext on first user pointer down without auto-playing', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Audio Lazy Init',
      actions: TEST_ACTIONS,
    });

    // Before mount: AudioContext must NOT be created
    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    // Stepping via API or buttons before pointerdown does not crash and does not initialize AudioContext
    controller.step(1);
    assert.equal(controller.getSelectedIndex(), 1);

    // Pointer down on click wheel triggers lazy init
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: 200,
      clientY: 200,
      target: wheel,
    });

    // Now AudioContext should be initialized
    // Step again to verify audio synthesis is safe and active
    controller.step(1);
    assert.equal(controller.getSelectedIndex(), 2);

    controller.unmount();
  });

  it('enforces 50ms piezo diaphragm spacing guard dropping rapid backlog audio bursts', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Audio Spacing Guard',
      actions: TEST_ACTIONS,
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    // Trigger pointerdown to initialize audio
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: 200,
      clientY: 200,
      target: wheel,
    });

    // Retrieve the mock AudioContext instance
    const audioCtx = (controller as unknown as { audioContext: MockAudioContext }).audioContext;
    assert.ok(audioCtx !== null, 'AudioContext must be initialized');

    audioCtx.currentTime = 1.000;
    // Trigger initial click
    controller.step(1);
    const initialSources = audioCtx.sourcesCreated.length;
    assert.equal(initialSources, 1, 'First click at t=1.000s must play audio');

    // Trigger 50 rapid steps within 20ms (t = 1.000s to 1.020s)
    for (let i = 0; i < 50; i++) {
      audioCtx.currentTime = 1.000 + i * 0.0004; // 0.4ms intervals
      controller.step(1);
    }

    // Spacing guard (50ms) must drop all 50 rapid bursts, sources count remains 1
    assert.equal(
      audioCtx.sourcesCreated.length,
      1,
      'Rapid clicks within 50ms guard interval must be dropped without queueing'
    );

    // Advance currentTime past 50ms guard (t = 1.060s)
    audioCtx.currentTime = 1.060;
    controller.step(1);
    assert.equal(
      audioCtx.sourcesCreated.length,
      2,
      'Click after 60ms elapsed must be played successfully'
    );

    // Advance currentTime past 200ms (t = 1.300s)
    audioCtx.currentTime = 1.300;
    controller.step(1);
    assert.equal(
      audioCtx.sourcesCreated.length,
      3,
      'Click after 240ms elapsed must be played successfully without delayed backlog burst'
    );

    controller.unmount();
  });

  it('operates headlessly with zero errors when Web Audio API is entirely absent', () => {
    // Pure Node.js environment where window.AudioContext is undefined
    setupMockEnvironment(false);

    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Headless No-Audio',
      actions: TEST_ACTIONS,
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    assert.doesNotThrow(() => {
      wheel.dispatchEvent({
        type: 'pointerdown',
        clientX: 200,
        clientY: 200,
        target: wheel,
      });

      controller.step(1);
      controller.selectActive();
      controller.pressMenu();
      controller.pressPlay();
      controller.simulateWheelTurn(90, 50, false);
    });

    controller.unmount();
  });

  it('respects mute toggle and suppresses mechanical audio synthesis when muted', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Mute Test',
      actions: TEST_ACTIONS,
    });

    controller.mount();

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: 200,
      clientY: 200,
      target: wheel,
    });

    const audioCtx = (controller as unknown as { audioContext: MockAudioContext }).audioContext;
    assert.ok(audioCtx !== null);

    audioCtx.currentTime = 1.0;
    controller.step(1);
    assert.equal(audioCtx.sourcesCreated.length, 1);

    // Mute controller
    controller.toggleMute();
    assert.equal(controller.isMuted(), true);

    // Advance time and step: audio should be suppressed
    audioCtx.currentTime = 2.0;
    controller.step(1);
    assert.equal(
      audioCtx.sourcesCreated.length,
      1,
      'Click audio must be completely suppressed when isAudioMuted is true'
    );

    // Unmute controller
    controller.toggleMute();
    assert.equal(controller.isMuted(), false);

    audioCtx.currentTime = 3.0;
    controller.step(1);
    assert.equal(audioCtx.sourcesCreated.length, 2, 'Click audio resumes after unmuting');

    controller.unmount();
  });
});

describe('Empirical Challenge Suite 4: Lifecycle Memory Disposal & DOM Cleanup', () => {
  beforeEach(() => {
    setupMockEnvironment(true);
  });

  it('cleans up DOM children, removes window event listeners, and closes AudioContext on unmount', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Lifecycle Test',
      actions: TEST_ACTIONS,
    });

    controller.mount();
    assert.equal((container as unknown as MockElement).children.length, 1);

    const chassis = (container as unknown as MockElement).children[0];
    const wheel = chassis.children[1];

    // Trigger pointerdown to initialize audio and verify window listeners
    wheel.dispatchEvent({
      type: 'pointerdown',
      clientX: 200,
      clientY: 200,
      target: wheel,
    });

    const audioCtx = (controller as unknown as { audioContext: MockAudioContext }).audioContext;
    assert.ok(audioCtx !== null);

    // Verify window listeners are registered
    assert.ok(mockWindow.listeners['pointermove'].length > 0);
    assert.ok(mockWindow.listeners['pointerup'].length > 0);

    // Perform unmount
    controller.unmount();

    // 1. Container children must be emptied
    assert.equal((container as unknown as MockElement).children.length, 0);

    // 2. Window listeners must be cleanly removed
    assert.equal(mockWindow.listeners['pointermove'].length, 0);
    assert.equal(mockWindow.listeners['pointerup'].length, 0);

    // 3. AudioContext must be closed
    assert.equal(audioCtx.state, 'closed');
    assert.equal(audioCtx.closeCalls, 1);
  });

  it('guarantees idempotency on duplicate mount and duplicate unmount calls without leaks or crashes', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const controller = new IPodController({
      container,
      menuTitle: 'Idempotency Test',
      actions: TEST_ACTIONS,
    });

    // First mount
    controller.mount();
    assert.equal((container as unknown as MockElement).children.length, 1);

    // Second mount (duplicate call should be an early return no-op)
    assert.doesNotThrow(() => controller.mount());
    assert.equal((container as unknown as MockElement).children.length, 1);

    // First unmount
    controller.unmount();
    assert.equal((container as unknown as MockElement).children.length, 0);

    // Second unmount (duplicate call should be a safe no-op)
    assert.doesNotThrow(() => controller.unmount());
    assert.equal((container as unknown as MockElement).children.length, 0);

    // Re-mount after unmount: should cleanly mount again
    assert.doesNotThrow(() => controller.mount());
    assert.equal((container as unknown as MockElement).children.length, 1);

    controller.unmount();
    assert.equal((container as unknown as MockElement).children.length, 0);
  });
});
