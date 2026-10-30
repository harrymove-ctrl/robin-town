/**
 * iPod Classic Interactive Controller for Robin-Town (Milestone M7)
 * Pure TypeScript retro tactile game controller featuring an upper LCD screen,
 * lower circular click wheel with Math.atan2 delta tracking, 15-degree notch quantization,
 * velocity acceleration, procedural mechanical click audio synthesis via Web Audio API,
 * 4 quadrant buttons (MENU, PLAY/PAUSE, PREV, NEXT) and center SELECT button,
 * and hierarchical Chinatown phase action menus.
 */

export interface iPodAction {
  id: string;
  label: string;
  handler: () => void;
  submenu?: {
    title: string;
    actions: iPodAction[];
  };
}

export interface iPodOptions {
  container: HTMLElement;
  menuTitle: string;
  actions: iPodAction[];
  onScroll?: (delta: number) => void;
  onSelect?: (activeAction: iPodAction) => void;
  onMenu?: () => void;
}

export const DRAG_STEP_DEGREES = 15;
export const MIN_SPEED_THRESHOLD = 180;
export const ACCELERATION_TIERS = [1, 2, 3, 5, 8, 13, 21, 34];
export const TIER_DURATION_MS = 500;
export const ACCELERATION_STALE_MS = 250;
export const REVERSE_THRESHOLD_DEGREES = 8;
export const CENTER_DEAD_ZONE = 0.1;
export const WHEEL_SIZE = 350;
export const SELECT_BUTTON_PERCENT = (100 / 350) * 100; // 28.57%

interface MenuStackItem {
  title: string;
  actions: iPodAction[];
  selectedIndex: number;
}

export class IPodController {
  private container: HTMLElement;
  private menuTitle: string;
  private actions: iPodAction[] = [];
  private onScrollCallback?: (delta: number) => void;
  private onSelectCallback?: (activeAction: iPodAction) => void;
  private onMenuCallback?: () => void;

  // Navigation Stack
  private menuStack: MenuStackItem[] = [];
  private selectedIndex = 0;

  // DOM Elements
  private rootElement: HTMLElement | null = null;
  private screenElement: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private playStateElement: HTMLElement | null = null;
  private breadcrumbElement: HTMLElement | null = null;
  private listElement: HTMLElement | null = null;
  private wheelElement: HTMLElement | null = null;
  private selectButtonElement: HTMLElement | null = null;

  // Rotational Physics State
  private isPointerTracking = false;
  private previousAngle: number | null = null;
  private accumulatedDegrees = 0;
  private lastAngleChangeTime = 0;
  private rotationDirection = 0;
  private reverseAccumulator = 0;
  private smoothedSpeed = 0;
  private fastRotateStartTime = 0;

  // Audio Synthesis State
  private audioContext: AudioContext | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private lastClickTime = 0;
  private isAudioMuted = false;

  // Status
  private isMounted = false;
  private isPlayingState = true;

  // Bound listeners
  private boundOnPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundOnPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundOnPointerUp: ((e: PointerEvent) => void) | null = null;

  constructor(options: iPodOptions) {
    this.container = options.container;
    this.menuTitle = options.menuTitle || 'Robin-Town';
    this.actions = [...(options.actions || [])];
    this.onScrollCallback = options.onScroll;
    this.onSelectCallback = options.onSelect;
    this.onMenuCallback = options.onMenu;
  }

  public mount(): void {
    if (this.isMounted || !this.container) return;
    this.isMounted = true;
    this.renderDOM();
    this.bindEvents();
    this.updateScreen();
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public setSelectedIndex(index: number): void {
    if (this.actions.length === 0) {
      this.selectedIndex = 0;
      return;
    }
    this.selectedIndex = Math.max(0, Math.min(this.actions.length - 1, index));
    this.updateScreen();
  }

  public getActiveAction(): iPodAction | null {
    if (this.actions.length === 0) return null;
    return this.actions[this.selectedIndex] || null;
  }

  public isMuted(): boolean {
    return this.isAudioMuted;
  }

  public toggleMute(): boolean {
    this.isAudioMuted = !this.isAudioMuted;
    return this.isAudioMuted;
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public setPlaying(playing: boolean): void {
    this.isPlayingState = playing;
    this.updateStatusIcon();
  }

  private renderDOM(): void {
    if (typeof document === 'undefined') return;

    const root = document.createElement('div');
    root.className = 'ipod-classic-chassis';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'iPod Classic Controller');
    this.rootElement = root;

    // 1. Upper LCD Screen
    const screen = document.createElement('div');
    screen.className = 'ipod-screen';
    screen.setAttribute('role', 'region');
    screen.setAttribute('aria-label', 'iPod Screen Display');
    this.screenElement = screen;

    // Title / Status Bar
    const titleBar = document.createElement('div');
    titleBar.className = 'ipod-title-bar';

    const playIcon = document.createElement('div');
    playIcon.className = 'ipod-status-icon ipod-play-state';
    playIcon.setAttribute('aria-label', 'Playback state');
    this.playStateElement = playIcon;
    titleBar.appendChild(playIcon);

    const titleText = document.createElement('div');
    titleText.className = 'ipod-title';
    titleText.textContent = this.menuTitle;
    this.titleElement = titleText;
    titleBar.appendChild(titleText);

    const battery = document.createElement('div');
    battery.className = 'ipod-battery-icon';
    battery.setAttribute('aria-label', 'Battery full');
    for (let i = 0; i < 4; i++) {
      const cell = document.createElement('div');
      cell.className = 'ipod-battery-cell';
      battery.appendChild(cell);
    }
    titleBar.appendChild(battery);
    screen.appendChild(titleBar);

    // Breadcrumb header
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'ipod-breadcrumb';
    breadcrumb.style.display = 'none';
    this.breadcrumbElement = breadcrumb;
    screen.appendChild(breadcrumb);

    // Scrollable action list
    const list = document.createElement('ul');
    list.className = 'ipod-menu-items';
    list.setAttribute('role', 'listbox');
    list.setAttribute('tabindex', '0');
    this.listElement = list;
    screen.appendChild(list);

    root.appendChild(screen);

    // 2. Lower Circular Click Wheel
    const wheel = document.createElement('div');
    wheel.className = 'ipod-click-wheel';
    wheel.style.touchAction = 'none';
    this.wheelElement = wheel;

    // Four Quadrant Buttons (MENU, PLAY/PAUSE, PREV, NEXT)
    const btnMenu = document.createElement('button');
    btnMenu.type = 'button';
    btnMenu.className = 'ipod-wheel-button ipod-btn-menu';
    btnMenu.setAttribute('aria-label', 'Menu');
    btnMenu.textContent = 'MENU';
    btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pressMenu();
    });
    wheel.appendChild(btnMenu);

    const btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'ipod-wheel-button ipod-btn-play';
    btnPlay.setAttribute('aria-label', 'Play or Pause');
    btnPlay.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="4,4 12,12 4,20"/><rect x="14" y="4" width="3" height="16"/><rect x="19" y="4" width="3" height="16"/></svg>`;
    btnPlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pressPlay();
    });
    wheel.appendChild(btnPlay);

    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'ipod-wheel-button ipod-btn-prev';
    btnPrev.setAttribute('aria-label', 'Previous');
    btnPrev.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="11,12 20,4 20,20"/><polygon points="2,12 11,4 11,20"/><rect x="1" y="4" width="2" height="16"/></svg>`;
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      this.step(-1);
    });
    wheel.appendChild(btnPrev);

    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'ipod-wheel-button ipod-btn-next';
    btnNext.setAttribute('aria-label', 'Next');
    btnNext.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="4,4 13,12 4,20"/><polygon points="13,4 22,12 13,20"/><rect x="21" y="4" width="2" height="16"/></svg>`;
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      this.step(1);
    });
    wheel.appendChild(btnNext);

    // Center Select Button
    const btnSelect = document.createElement('button');
    btnSelect.type = 'button';
    btnSelect.className = 'ipod-select-button';
    btnSelect.setAttribute('aria-label', 'Select active action');
    btnSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectActive();
    });
    this.selectButtonElement = btnSelect;
    wheel.appendChild(btnSelect);

    root.appendChild(wheel);
    this.container.appendChild(root);

    this.updateStatusIcon();
  }

  private updateStatusIcon(): void {
    if (!this.playStateElement) return;
    this.playStateElement.innerHTML = this.isPlayingState
      ? `<svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor"><polygon points="1,1 9,5 1,9"/></svg>`
      : `<svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>`;
  }

  private updateScreen(): void {
    if (!this.listElement || !this.titleElement) return;

    this.titleElement.textContent = this.menuTitle;

    // Update breadcrumb
    if (this.breadcrumbElement) {
      if (this.menuStack.length > 0) {
        this.breadcrumbElement.style.display = 'block';
        const trail = [...this.menuStack.map((s) => s.title), this.menuTitle];
        this.breadcrumbElement.innerHTML = trail.join(' &gt; ');
      } else {
        this.breadcrumbElement.style.display = 'none';
      }
    }

    // Render list items
    this.listElement.innerHTML = '';
    this.actions.forEach((action, index) => {
      const li = document.createElement('li');
      li.id = `ipod-item-${index}`;
      li.className = 'ipod-menu-item';
      li.setAttribute('role', 'option');

      const isSelected = index === this.selectedIndex;
      if (isSelected) {
        li.setAttribute('data-selected', 'true');
        li.setAttribute('aria-selected', 'true');
      } else {
        li.setAttribute('aria-selected', 'false');
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'ipod-item-title';
      labelSpan.textContent = action.label;
      li.appendChild(labelSpan);

      if (action.submenu) {
        const chevron = document.createElement('span');
        chevron.className = 'ipod-chevron';
        chevron.textContent = '>';
        li.appendChild(chevron);
      }

      li.addEventListener('click', () => {
        this.setSelectedIndex(index);
        this.selectActive();
      });

      this.listElement?.appendChild(li);
    });

    this.listElement.setAttribute('aria-activedescendant', `ipod-item-${this.selectedIndex}`);
    this.revealActiveRow();
  }

  private revealActiveRow(): void {
    if (!this.listElement) return;
    const activeItem = this.listElement.children[this.selectedIndex] as HTMLElement | undefined;
    if (!activeItem) return;

    const rowTop = activeItem.offsetTop || 0;
    const rowHeight = activeItem.offsetHeight || 24;
    const listScrollTop = this.listElement.scrollTop || 0;
    const listHeight = this.listElement.clientHeight || 160;

    if (rowTop < listScrollTop) {
      this.listElement.scrollTop = rowTop;
    } else if (rowTop + rowHeight > listScrollTop + listHeight) {
      this.listElement.scrollTop = rowTop + rowHeight - listHeight;
    }
  }

  private bindEvents(): void {
    if (!this.wheelElement) return;

    this.boundOnPointerDown = (e: PointerEvent) => {
      // Ignore clicks on center select button or quadrant buttons
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'BUTTON') return;

      this.initAudio();
      this.isPointerTracking = true;
      this.previousAngle = this.getPointerAngle(e.clientX, e.clientY);
      this.accumulatedDegrees = 0;
      this.reverseAccumulator = 0;
      this.rotationDirection = 0;
      this.lastAngleChangeTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.smoothedSpeed = 0;
      this.fastRotateStartTime = 0;
    };

    this.boundOnPointerMove = (e: PointerEvent) => {
      if (!this.isPointerTracking || this.previousAngle === null) return;

      const currentAngle = this.getPointerAngle(e.clientX, e.clientY);
      if (currentAngle === null) return;

      // Shortest signed turn delta in [-180, 180]
      const delta = (((((currentAngle - this.previousAngle) % 360) + 540) % 360) - 180);
      this.previousAngle = currentAngle;

      this.processAngularMovement(delta);
    };

    this.boundOnPointerUp = () => {
      this.isPointerTracking = false;
      this.previousAngle = null;
      this.accumulatedDegrees = 0;
      this.rotationDirection = 0;
      this.reverseAccumulator = 0;
      this.smoothedSpeed = 0;
      this.fastRotateStartTime = 0;
    };

    this.wheelElement.addEventListener('pointerdown', this.boundOnPointerDown);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.boundOnPointerMove);
      window.addEventListener('pointerup', this.boundOnPointerUp);
    }
  }

  private getPointerAngle(clientX: number, clientY: number): number | null {
    if (!this.wheelElement) return null;

    const rect = this.wheelElement.getBoundingClientRect
      ? this.wheelElement.getBoundingClientRect()
      : { left: 0, top: 0, width: WHEEL_SIZE, height: WHEEL_SIZE };

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const radius = rect.width / 2;

    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Dead zone check: ignore clicks too close to center
    if (dist < radius * CENTER_DEAD_ZONE) {
      return null;
    }

    // Angle in degrees in [-180, 180]
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  private processAngularMovement(delta: number): void {
    if (Math.abs(delta) < 0.001) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = Math.max(1, now - this.lastAngleChangeTime);
    this.lastAngleChangeTime = now;

    // Direction reversal threshold filter
    const moveSign = delta > 0 ? 1 : -1;
    if (this.rotationDirection !== 0 && moveSign !== this.rotationDirection) {
      this.reverseAccumulator += Math.abs(delta);
      if (this.reverseAccumulator < REVERSE_THRESHOLD_DEGREES) {
        return; // Suppress minor tremor
      }
      this.rotationDirection = moveSign;
      this.reverseAccumulator = 0;
      this.accumulatedDegrees = 0;
    } else {
      this.rotationDirection = moveSign;
      this.reverseAccumulator = 0;
    }

    // Velocity acceleration
    const instantSpeed = (Math.abs(delta) / dt) * 1000; // deg/s
    const clampedSpeed = Math.min(instantSpeed, 400);
    this.smoothedSpeed += 0.15 * (clampedSpeed - this.smoothedSpeed);

    let multiplier = 1;
    if (this.smoothedSpeed > MIN_SPEED_THRESHOLD) {
      if (this.fastRotateStartTime === 0) {
        this.fastRotateStartTime = now;
      }
      const fastDuration = now - this.fastRotateStartTime;
      const tierIndex = Math.min(
        ACCELERATION_TIERS.length - 1,
        Math.floor(fastDuration / TIER_DURATION_MS)
      );
      multiplier = ACCELERATION_TIERS[tierIndex];
    } else {
      this.fastRotateStartTime = 0;
    }

    // 15-degree notch quantization
    this.accumulatedDegrees += Math.abs(delta);
    if (this.accumulatedDegrees >= DRAG_STEP_DEGREES) {
      const notches = Math.floor(this.accumulatedDegrees / DRAG_STEP_DEGREES);
      this.accumulatedDegrees = this.accumulatedDegrees % DRAG_STEP_DEGREES;

      const totalSteps = notches * moveSign * multiplier;
      this.step(totalSteps);
    }
  }

  public step(direction: number): void {
    if (this.actions.length === 0 || direction === 0) return;

    const prevIndex = this.selectedIndex;
    const count = this.actions.length;
    this.selectedIndex = (this.selectedIndex + direction) % count;
    if (this.selectedIndex < 0) {
      this.selectedIndex += count;
    }

    this.playClickAudio();
    this.updateScreen();

    if (this.onScrollCallback) {
      this.onScrollCallback(direction);
    }
  }

  public selectActive(): void {
    if (this.actions.length === 0) return;
    const action = this.actions[this.selectedIndex];
    if (!action) return;

    this.playClickAudio();

    if (action.submenu) {
      this.pushSubmenu(action.submenu.title, action.submenu.actions);
      return;
    }

    if (typeof action.handler === 'function') {
      action.handler();
    }
    if (this.onSelectCallback) {
      this.onSelectCallback(action);
    }
  }

  public pressMenu(): void {
    this.playClickAudio();
    if (this.popSubmenu()) {
      return;
    }
    if (this.onMenuCallback) {
      this.onMenuCallback();
    }
  }

  public pressPlay(): void {
    this.playClickAudio();
    this.setPlaying(!this.isPlayingState);
  }

  public setActions(title: string, actions: iPodAction[]): void {
    this.menuTitle = title;
    this.actions = [...actions];
    this.selectedIndex = 0;
    this.updateScreen();
  }

  public pushSubmenu(title: string, actions: iPodAction[]): void {
    this.menuStack.push({
      title: this.menuTitle,
      actions: this.actions,
      selectedIndex: this.selectedIndex,
    });
    this.menuTitle = title;
    this.actions = [...actions];
    this.selectedIndex = 0;
    this.updateScreen();
  }

  public popSubmenu(): boolean {
    if (this.menuStack.length === 0) return false;
    const prev = this.menuStack.pop();
    if (!prev) return false;

    this.menuTitle = prev.title;
    this.actions = prev.actions;
    this.selectedIndex = prev.selectedIndex;
    this.updateScreen();
    return true;
  }

  public setPhaseActions(phase: string): void {
    switch (phase) {
      case 'receive':
        this.setActions('Receive Phase', [
          { id: 'draft-parcel', label: 'Draft Parcel', handler: () => {} },
          { id: 'view-deeds', label: 'View Deeds', handler: () => {} },
          { id: 'auto-draft', label: 'Auto Draft (Bot)', handler: () => {} },
          { id: 'year-summary', label: 'Year Allocation', handler: () => {} },
        ]);
        break;
      case 'trade':
        this.setActions('Trade Desk', [
          { id: 'open-otc', label: 'Open OTC Desk', handler: () => {} },
          { id: 'propose-swap', label: 'Propose Swap', handler: () => {} },
          { id: 'counteroffer', label: 'Review Counteroffer', handler: () => {} },
          { id: 'transfer-cash', label: 'Send Cash Stage', handler: () => {} },
          { id: 'end-trading', label: 'Close Trade Phase', handler: () => {} },
        ]);
        break;
      case 'build':
        this.setActions('Build Phase', [
          { id: 'deploy-shop', label: 'Build Shop Tile', handler: () => {} },
          { id: 'cluster-bonus', label: 'Inspect Cluster Bonus', handler: () => {} },
          { id: 'upgrade-tier', label: 'Upgrade Protocol Shop', handler: () => {} },
          { id: 'complete-build', label: 'Finish Construction', handler: () => {} },
        ]);
        break;
      case 'income':
        this.setActions('Income Harvest', [
          { id: 'collect-revenue', label: 'Collect Payouts', handler: () => {} },
          { id: 'claim-wif', label: 'Claim $wif Rewards', handler: () => {} },
          { id: 'view-ledger', label: 'Inspect Financial Ledger', handler: () => {} },
          { id: 'next-year', label: 'Advance To Next Year', handler: () => {} },
        ]);
        break;
      case 'ended':
        this.setActions('Match Summary', [
          { id: 'podium-purse', label: 'Claim Podium Purse', handler: () => {} },
          { id: 'swap-wif', label: 'Swap Points to $wif', handler: () => {} },
          { id: 'burn-stats', label: 'Inspect Burn Sinks', handler: () => {} },
          { id: 'new-game', label: 'Start New Match', handler: () => {} },
        ]);
        break;
      default:
        this.setActions('Robin-Town', [
          { id: 'play', label: 'Start Game', handler: () => {} },
          { id: 'rules', label: 'Game Rules', handler: () => {} },
          { id: 'settings', label: 'Audio & Controls', handler: () => {} },
        ]);
        break;
    }
  }

  public simulateWheelTurn(degrees: number, durationMs = 50, continuous = false): void {
    if (!continuous) {
      this.rotationDirection = 0;
      this.reverseAccumulator = 0;
      this.accumulatedDegrees = 0;
    }
    const steps = 5;
    const stepDelta = degrees / steps;
    const stepDt = durationMs / steps;

    for (let i = 0; i < steps; i++) {
      this.lastAngleChangeTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - (steps - i) * stepDt;
      this.processAngularMovement(stepDelta);
    }
  }

  // --- Procedural Mechanical Click Audio via Web Audio API ---

  private initAudio(): void {
    if (this.audioContext || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.clickBuffer = this.createClickBuffer(this.audioContext);
    } catch {
      this.audioContext = null;
    }
  }

  private createClickBuffer(context: AudioContext): AudioBuffer {
    const { sampleRate } = context;
    // 3 milliseconds audio buffer
    const length = Math.round(sampleRate * 0.003);
    const buffer = context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const decay = sampleRate * 0.0007;

    // Lehmer LCG constant seed = 7
    let seed = 7;
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647) * 2 - 1;
      data[i] = noise * 0.72 * Math.exp(-i / decay);
    }

    return buffer;
  }

  private playClickAudio(): void {
    if (this.isAudioMuted || !this.audioContext || !this.clickBuffer) return;

    const now = this.audioContext.currentTime;
    // 50ms piezo diaphragm spacing limit
    if (now - this.lastClickTime < 0.05) return;
    this.lastClickTime = now;

    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = this.clickBuffer;

      const gain = this.audioContext.createGain();
      gain.gain.value = 0.3;

      source.connect(gain);
      gain.connect(this.audioContext.destination);
      source.start(now);
    } catch {
      // Safe no-op
    }
  }

  public unmount(): void {
    this.isMounted = false;

    if (this.wheelElement && this.boundOnPointerDown) {
      this.wheelElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    }
    if (typeof window !== 'undefined') {
      if (this.boundOnPointerMove) {
        window.removeEventListener('pointermove', this.boundOnPointerMove);
      }
      if (this.boundOnPointerUp) {
        window.removeEventListener('pointerup', this.boundOnPointerUp);
      }
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Safe no-op
      }
      this.audioContext = null;
    }

    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
    }

    this.rootElement = null;
    this.screenElement = null;
    this.titleElement = null;
    this.playStateElement = null;
    this.breadcrumbElement = null;
    this.listElement = null;
    this.wheelElement = null;
    this.selectButtonElement = null;
  }
}
