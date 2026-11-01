/**
 * src/ui/ipod-dock.ts
 *
 * Collapsible Floating iPod Classic Dock Component for Robin-Town.
 * Encapsulates the iPod Classic controller in a non-obstructing floating dock,
 * providing smooth collapse/expand transitions without occluding board interaction parcels,
 * procedural WebAudio click feedback on 15-degree rotary steps, and lo-fi phase track integration.
 */

import { IPodController, type iPodAction, type iPodOptions } from './ipod-controller';
import { AudioSynthesizer, getAudioSynthesizer } from './audio';

export interface IPodDockOptions {
  container?: HTMLElement;
  initialPhase?: string;
  initialActions?: iPodAction[];
  onAction?: (action: iPodAction) => void;
  audioSynthesizer?: AudioSynthesizer;
  initialCollapsed?: boolean;
}

export class IPodDock {
  private container: HTMLElement;
  private dockElement: HTMLElement | null = null;
  private cardElement: HTMLElement | null = null;
  private scaleHostElement: HTMLElement | null = null;
  private miniPillElement: HTMLElement | null = null;
  private controller: IPodController | null = null;
  private synthesizer: AudioSynthesizer;

  private isCollapsed = false;
  private isMounted = false;
  private currentPhase = 'receive';
  private currentYear = 1;
  private onActionCallback?: (action: iPodAction) => void;
  private initialActions: iPodAction[] = [];

  constructor(options: IPodDockOptions = {}) {
    this.container = options.container || (typeof document !== 'undefined' ? document.body : (null as unknown as HTMLElement));
    this.currentPhase = options.initialPhase || 'receive';
    this.initialActions = options.initialActions || [];
    this.onActionCallback = options.onAction;
    this.synthesizer = options.audioSynthesizer || getAudioSynthesizer();
    this.isCollapsed = options.initialCollapsed ?? false;
  }

  public getIsCollapsed(): boolean {
    return this.isCollapsed;
  }

  public getController(): IPodController | null {
    return this.controller;
  }

  public getCurrentPhase(): string {
    return this.currentPhase;
  }

  public mount(): void {
    if (this.isMounted || !this.container || typeof document === 'undefined') return;
    this.isMounted = true;

    // Outer non-obstructing floating dock container
    const dock = document.createElement('aside');
    dock.id = 'robin-ipod-dock';
    dock.className = `robin-ipod-dock ${this.isCollapsed ? 'collapsed' : 'expanded'}`;
    dock.setAttribute('role', 'complementary');
    dock.setAttribute('aria-label', 'iPod Classic Controller Dock');
    dock.setAttribute('data-collapsed', String(this.isCollapsed));
    this.dockElement = dock;

    // Card wrapper
    const card = document.createElement('div');
    card.className = 'robin-ipod-card';
    this.cardElement = card;

    // Mini pill header (always visible when collapsed or expanded)
    const bar = document.createElement('div');
    bar.className = 'robin-ipod-bar';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'robin-ipod-dock-title';
    titleGroup.innerHTML = `<span class="dock-badge">♫</span> <span class="dock-title-text">${this.formatTitle()}</span>`;

    const controlsGroup = document.createElement('div');
    controlsGroup.className = 'robin-ipod-dock-controls';

    // Mini play/pause toggle
    const miniPlayBtn = document.createElement('button');
    miniPlayBtn.type = 'button';
    miniPlayBtn.className = 'ipod-dock-mini-play';
    miniPlayBtn.setAttribute('aria-label', 'Toggle music playback');
    miniPlayBtn.innerHTML = '▶';
    miniPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlayback();
    });

    // Collapse / Expand toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ipod-dock-toggle-btn';
    toggleBtn.setAttribute('aria-label', this.isCollapsed ? 'Expand iPod Classic' : 'Collapse iPod Classic');
    toggleBtn.innerHTML = this.isCollapsed ? '▲' : '▼';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    controlsGroup.appendChild(miniPlayBtn);
    controlsGroup.appendChild(toggleBtn);
    bar.appendChild(titleGroup);
    bar.appendChild(controlsGroup);
    card.appendChild(bar);

    // Scale host for full iPod chassis
    const scale = document.createElement('div');
    scale.className = 'robin-ipod-scale';
    scale.style.display = this.isCollapsed ? 'none' : 'block';
    this.scaleHostElement = scale;

    card.appendChild(scale);
    dock.appendChild(card);
    this.container.appendChild(dock);

    // Mount nested IPodController inside scale host
    this.controller = new IPodController({
      container: scale,
      menuTitle: this.formatTitle(),
      actions: this.initialActions.length > 0 ? this.initialActions : this.getDefaultActionsForPhase(this.currentPhase),
      onSelect: (action) => {
        if (this.onActionCallback) {
          this.onActionCallback(action);
        }
      },
    });
    this.controller.mount();
  }

  public collapse(): void {
    if (this.isCollapsed) return;
    this.isCollapsed = true;
    this.updateDockState();
  }

  public expand(): void {
    if (!this.isCollapsed) return;
    this.isCollapsed = false;
    this.updateDockState();
  }

  public toggle(): void {
    this.isCollapsed = !this.isCollapsed;
    this.updateDockState();
  }

  public setPhase(phase: string, year = 1): void {
    this.currentPhase = phase;
    this.currentYear = year;
    const title = this.formatTitle();

    if (this.dockElement) {
      const titleTextEl = this.dockElement.querySelector('.dock-title-text');
      if (titleTextEl) {
        titleTextEl.textContent = title;
      }
    }

    if (this.controller) {
      this.controller.setPhaseActions(phase);
    }
  }

  public togglePlayback(): void {
    if (this.controller) {
      this.controller.pressPlay();
    }
    this.synthesizer.toggleMute();
    this.updateMiniPlayButton();
  }

  private updateMiniPlayButton(): void {
    if (!this.dockElement) return;
    const miniBtn = this.dockElement.querySelector('.ipod-dock-mini-play');
    if (!miniBtn) return;
    const isPlaying = this.controller ? this.controller.isPlaying() : true;
    miniBtn.innerHTML = isPlaying ? '❚❚' : '▶';
  }

  private updateDockState(): void {
    if (!this.dockElement || !this.scaleHostElement) return;

    this.dockElement.setAttribute('data-collapsed', String(this.isCollapsed));
    this.dockElement.classList.toggle('collapsed', this.isCollapsed);
    this.dockElement.classList.toggle('expanded', !this.isCollapsed);

    const toggleBtn = this.dockElement.querySelector('.ipod-dock-toggle-btn');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', this.isCollapsed ? 'Expand iPod Classic' : 'Collapse iPod Classic');
      toggleBtn.innerHTML = this.isCollapsed ? '▲' : '▼';
    }

    if (this.isCollapsed) {
      this.scaleHostElement.style.display = 'none';
    } else {
      this.scaleHostElement.style.display = 'block';
    }
  }

  private formatTitle(): string {
    return `Y${this.currentYear} · ${this.currentPhase.toUpperCase()}`;
  }

  private getDefaultActionsForPhase(phase: string): iPodAction[] {
    switch (phase) {
      case 'receive':
        return [
          { id: 'draft-parcel', label: 'Draft Parcel', handler: () => {} },
          { id: 'view-deeds', label: 'View Deeds', handler: () => {} },
          { id: 'auto-draft', label: 'Auto Draft', handler: () => {} },
        ];
      case 'trade':
        return [
          { id: 'open-otc', label: 'Open OTC Desk', handler: () => {} },
          { id: 'propose-swap', label: 'Propose Swap', handler: () => {} },
          { id: 'close-trade', label: 'Close Trade Phase', handler: () => {} },
        ];
      case 'build':
        return [
          { id: 'build-shop', label: 'Build Shop Tile', handler: () => {} },
          { id: 'cluster-bonus', label: 'Inspect Clusters', handler: () => {} },
          { id: 'finish-build', label: 'Finish Construction', handler: () => {} },
        ];
      case 'income':
        return [
          { id: 'collect-payout', label: 'Collect Payouts', handler: () => {} },
          { id: 'claim-wif', label: 'Claim $wif Rewards', handler: () => {} },
          { id: 'next-year', label: 'Advance To Next Year', handler: () => {} },
        ];
      case 'ended':
        return [
          { id: 'claim-purse', label: 'Claim Podium Purse', handler: () => {} },
          { id: 'swap-points', label: 'Swap Points to $wif', handler: () => {} },
          { id: 'new-match', label: 'Start New Match', handler: () => {} },
        ];
      default:
        return [
          { id: 'play', label: 'Start Match', handler: () => {} },
          { id: 'rules', label: 'Game Rules', handler: () => {} },
          { id: 'settings', label: 'Settings', handler: () => {} },
        ];
    }
  }

  public unmount(): void {
    this.isMounted = false;
    if (this.controller) {
      this.controller.unmount();
      this.controller = null;
    }
    if (this.dockElement && this.dockElement.parentElement) {
      this.dockElement.parentElement.removeChild(this.dockElement);
    }
    this.dockElement = null;
    this.cardElement = null;
    this.scaleHostElement = null;
  }
}
