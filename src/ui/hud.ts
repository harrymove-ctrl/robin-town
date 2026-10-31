/**
 * src/ui/hud.ts
 *
 * Heads-Up Display (HUD) view model projections and DOM presentation layer for robin-town.
 * Implements the top bar (calendar, phase banner, wallet pill, audio toggle),
 * 4-player status ribbon, context-sensitive action bar, activity log terminal,
 * and bottom inventory drawer.
 */

import {
  DISTRICT_BLOCKS,
  SHOP_CATEGORIES,
  TOTAL_LOTS,
} from '../engine/board-layout';
import { SHOPS } from '../engine/engine';
import type { GamePhase, GameState, Player } from '../engine/types';

export interface TopBarViewModel {
  year: number;
  maxYears: number;
  phase: GamePhase;
  phaseTitle: string;
  phaseSubtitle: string;
  isStaked: boolean;
}

export interface PlayerCardViewModel {
  id: number;
  name: string;
  addressShort: string;
  avatar: string;
  cashFormatted: string;
  cash: number;
  tileCount: number;
  parcelCount: number;
  isActive: boolean;
  isStaked: boolean;
  colorHex: string;
}

export interface PlayerRibbonViewModel {
  players: PlayerCardViewModel[];
}

export interface ActionButtonConfig {
  id: string;
  label: string;
  primary: boolean;
  disabled: boolean;
  shortcut?: string;
  tooltip?: string;
}

export interface ActionBarViewModel {
  phase: GamePhase;
  buttons: ActionButtonConfig[];
  instructions: string;
}

export interface ModuleTileSlot {
  shopType: number;
  name: string;
  code: string;
  colorHex: string;
  targetSize: number;
  count: number;
  isSelected: boolean;
}

export interface DraftDeedCard {
  lotId: number;
  lotNumber: number;
  districtId: number;
  districtName: string;
  districtColor: string;
  isSelected: boolean;
}

export interface DrawerViewModel {
  isOpen: boolean;
  mode: 'modules' | 'draft';
  modules: ModuleTileSlot[];
  draftDeeds: DraftDeedCard[];
  selectedCount: number;
  requiredCount: number;
}

export interface LogItemViewModel {
  id: number;
  tag: string;
  tagColor: string;
  message: string;
  timestamp: string;
}

export const PLAYER_COLORS: readonly string[] = Object.freeze([
  '#00C805',
  '#EEC353',
  '#29B6F6',
  '#FF7043',
]);

const PHASE_TITLES: Record<GamePhase, { title: string; subtitle: string }> = {
  receive: {
    title: 'Phase 1: Parcel Allocation',
    subtitle: 'Draft city parcel deeds to claim starting real estate',
  },
  trade: {
    title: 'Phase 2: OTC Liquidity Desk',
    subtitle: 'Propose asset swaps with Sherwood, Apex, or Luna',
  },
  build: {
    title: 'Phase 3: Protocol Deployment',
    subtitle: 'Deploy protocol shop modules onto owned empty parcels',
  },
  income: {
    title: 'Phase 4: Yield Harvest',
    subtitle: 'Collect annual yield from active connected storefronts',
  },
  ended: {
    title: 'Phase 5: Final Settlement',
    subtitle: 'Review trader rankings, podium purse distribution, and token burns',
  },
};

/**
 * Pure projection: Top bar situational view model.
 */
export function projectTopBarViewModel(
  state: GameState,
  isStaked = true
): TopBarViewModel {
  const info = PHASE_TITLES[state.phase] || {
    title: state.phase,
    subtitle: '',
  };
  return {
    year: state.year,
    maxYears: 6,
    phase: state.phase,
    phaseTitle: info.title,
    phaseSubtitle: info.subtitle,
    isStaked,
  };
}

/**
 * Pure projection: 4-player status ribbon.
 */
export function projectPlayerRibbonViewModel(
  state: GameState,
  isStaked = true
): PlayerRibbonViewModel {
  const cards: PlayerCardViewModel[] = state.players.map((p, idx) => {
    const ownedCount = state.lots.filter((lot) => lot.owner === p.id).length;
    const tileSum = p.tiles.reduce((sum, count) => sum + count, 0);
    const addr = p.address || `0x${(idx + 1).toString().padStart(4, '0')}...0000`;
    const shortAddr =
      addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

    return {
      id: p.id,
      name: p.name,
      addressShort: shortAddr,
      avatar: p.avatar || `avatar_${idx}.png`,
      cashFormatted: p.cash.toLocaleString() + ' $wif',
      cash: p.cash,
      tileCount: tileSum,
      parcelCount: ownedCount,
      isActive: idx === 0,
      isStaked: idx === 0 && isStaked,
      colorHex: PLAYER_COLORS[idx] || '#FFFFFF',
    };
  });

  return { players: cards };
}

/**
 * Pure projection: Context-sensitive action bar.
 */
export function projectActionBarViewModel(
  state: GameState,
  selectedDraftLotIds: number[] = [],
  selectedShopType: number | null = null
): ActionBarViewModel {
  const buttons: ActionButtonConfig[] = [];
  let instructions = '';

  switch (state.phase) {
    case 'receive': {
      const selectedCount = selectedDraftLotIds.length;
      const required = state.draftCount;
      const isComplete = selectedCount === required;
      instructions = `Choose ${required} parcel deeds from the deal tray below (${selectedCount}/${required} selected)`;
      buttons.push({
        id: 'confirm-draft',
        label: `Confirm Deeds (${selectedCount}/${required})`,
        primary: true,
        disabled: !isComplete,
        shortcut: 'Enter',
        tooltip: 'Claim chosen deeds and progress to Trading',
      });
      buttons.push({
        id: 'quick-draft',
        label: 'Quick Draft (Auto)',
        primary: false,
        disabled: false,
        shortcut: 'Q',
        tooltip: 'Automatically select optimal deeds by network heuristic',
      });
      break;
    }
    case 'trade': {
      instructions = 'Bilateral negotiation open. Swap cash, modules, and plots with counterparties';
      buttons.push({
        id: 'open-trade-desk',
        label: 'Open Trade Desk',
        primary: true,
        disabled: false,
        shortcut: 'T',
        tooltip: 'Launch interactive bilateral OTC liquidity desk',
      });
      buttons.push({
        id: 'finish-trading',
        label: 'Proceed to Deployments',
        primary: false,
        disabled: false,
        shortcut: 'Space',
        tooltip: 'Conclude trading phase and advance to shop construction',
      });
      break;
    }
    case 'build': {
      if (selectedShopType !== null) {
        const shop = SHOPS[selectedShopType];
        instructions = `Selected ${shop.name} (${shop.code}). Click a highlighted parcel to build`;
        buttons.push({
          id: 'cancel-shop-selection',
          label: 'Deselect Module',
          primary: false,
          disabled: false,
          shortcut: 'Escape',
        });
      } else {
        instructions = 'Select a protocol module from the bottom rack to deploy onto empty lots';
      }
      buttons.push({
        id: 'finish-building',
        label: 'Harvest Yield',
        primary: true,
        disabled: false,
        shortcut: 'Space',
        tooltip: 'Finish construction and disburse annual yield across city',
      });
      break;
    }
    case 'income': {
      instructions = `Epoch ${state.year} yield distributed. Review ledger and advance`;
      const isLastYear = state.year >= 6;
      buttons.push({
        id: isLastYear ? 'view-final-settlement' : 'next-epoch',
        label: isLastYear ? 'Final Settlement' : `Advance to Epoch ${state.year + 1}`,
        primary: true,
        disabled: false,
        shortcut: 'Space',
        tooltip: isLastYear ? 'View final rankings and prize distribution' : 'Proceed to next year',
      });
      break;
    }
    case 'ended': {
      instructions = 'Match concluded. Sovereign podium prize purse distributed';
      buttons.push({
        id: 'play-again',
        label: 'New Match',
        primary: true,
        disabled: false,
        shortcut: 'N',
        tooltip: 'Start a fresh 6-epoch competitive match',
      });
      buttons.push({
        id: 'swap-points',
        label: 'Swap Points to $wif',
        primary: false,
        disabled: false,
        tooltip: 'Convert casual performance score to $wif tokens with 3% burn tax',
      });
      break;
    }
  }

  return {
    phase: state.phase,
    buttons,
    instructions,
  };
}

/**
 * Pure projection: Bottom inventory drawer.
 */
export function projectDrawerViewModel(
  state: GameState,
  playerId = 0,
  selectedShopType: number | null = null,
  selectedDraftLots: number[] = []
): DrawerViewModel {
  const player = state.players[playerId] || state.players[0];
  const isDraftPhase = state.phase === 'receive';

  const modules: ModuleTileSlot[] = SHOP_CATEGORIES.map((cat, sIdx) => ({
    shopType: cat.id,
    name: cat.name,
    code: cat.code,
    colorHex: cat.colorHex,
    targetSize: cat.targetSize,
    count: player.tiles[sIdx] || 0,
    isSelected: selectedShopType === cat.id,
  }));

  const draftDeeds: DraftDeedCard[] = (state.pending || []).map((lotId) => {
    const lotDef = DISTRICT_BLOCKS.find((b) =>
      b.rows.some((row, r) =>
        row.some((c) => {
          const expectedX = b.x + c * 52;
          const expectedY = b.y + r * 52;
          const lot = state.lots[lotId];
          return lot && lot.col === c && lot.row === r && lot.block === b.id;
        })
      )
    );
    const blockId = state.lots[lotId]?.block ?? 0;
    const blockConfig = DISTRICT_BLOCKS[blockId] || DISTRICT_BLOCKS[0];

    return {
      lotId,
      lotNumber: lotId + 1,
      districtId: blockId,
      districtName: blockConfig.name,
      districtColor: blockConfig.accentHex,
      isSelected: selectedDraftLots.includes(lotId),
    };
  });

  return {
    isOpen: true,
    mode: isDraftPhase ? 'draft' : 'modules',
    modules,
    draftDeeds,
    selectedCount: selectedDraftLots.length,
    requiredCount: state.draftCount,
  };
}

/**
 * Pure projection: Event log feed parsing.
 */
export function projectLogFeedViewModel(logs: string[]): LogItemViewModel[] {
  return logs.slice(0, 25).map((line, idx) => {
    let tag = 'SYS';
    let tagColor = '#9CA3AF';
    const upper = line.toUpperCase();

    if (upper.includes('DRAFT') || upper.includes('DEED')) {
      tag = 'DEED';
      tagColor = '#00C805';
    } else if (upper.includes('TRADE') || upper.includes('OTC') || upper.includes('ORDER')) {
      tag = 'OTC';
      tagColor = '#00F0FF';
    } else if (upper.includes('BUILD') || upper.includes('DEPLOY')) {
      tag = 'DEPLOY';
      tagColor = '#A855F7';
    } else if (upper.includes('INCOME') || upper.includes('HARVEST') || upper.includes('PAID') || upper.includes('YIELD')) {
      tag = 'YIELD';
      tagColor = '#EEC353';
    } else if (upper.includes('BURN') || upper.includes('VAULT') || upper.includes('TAX') || upper.includes('FLY')) {
      tag = 'FLY';
      tagColor = '#FF7043';
    }

    return {
      id: idx,
      tag,
      tagColor,
      message: line,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  });
}

export interface HudEventHandlers {
  onActionClick?: (actionId: string) => void;
  onTileSelect?: (shopType: number) => void;
  onDraftToggle?: (lotId: number) => void;
  onWalletClick?: () => void;
  onAudioToggle?: () => void;
  onDraftHover?: (lotId: number | null) => void;
}

/**
 * DOM Heads-Up Display Coordinator mounting the top bar, ribbon, actions, and drawer.
 */
export class HudManager {
  private container: HTMLElement;
  private handlers: HudEventHandlers;
  private feedCollapsed = false;

  constructor(container: HTMLElement, handlers: HudEventHandlers = {}) {
    this.container = container;
    this.handlers = handlers;
    this.bindEvents();
  }

  public render(
    state: GameState,
    selectedDraftLots: number[] = [],
    selectedShopType: number | null = null,
    walletLabel = 'Off-Chain Sim: 10,000 $wif',
    isAudioMuted = false
  ): void {
    const topBar = projectTopBarViewModel(state);
    const ribbon = projectPlayerRibbonViewModel(state);
    const actions = projectActionBarViewModel(state, selectedDraftLots, selectedShopType);
    const drawer = projectDrawerViewModel(state, 0, selectedShopType, selectedDraftLots);
    const logs = projectLogFeedViewModel(state.logs);

    this.container.innerHTML = `
      <!-- Top Bar Navigation -->
      <header class="hud-topbar">
        <div class="calendar-rail" aria-label="Epoch Calendar">
          ${[1, 2, 3, 4, 5, 6].map((yr) => {
            const isDone = yr < topBar.year;
            const isCurrent = yr === topBar.year;
            return `
              <div class="calendar-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}">
                <span class="node-year">Y${yr}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="phase-banner">
          <h2 class="phase-title">${topBar.phaseTitle}</h2>
          <span class="phase-subtitle">${topBar.phaseSubtitle}</span>
        </div>

        <div class="topbar-actions">
          <button class="wallet-pill" data-action="wallet-toggle" title="Switch between Simulation and Robinhood Chain">
            <span class="status-dot"></span>
            <span class="wallet-label">${walletLabel}</span>
          </button>
          <button class="audio-toggle-btn ${isAudioMuted ? 'muted' : ''}" data-action="audio-toggle" title="Toggle Sound">
            ${isAudioMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <!-- 4-Player Status Ribbon -->
      <section class="player-ribbon" aria-label="Trader Status">
        ${ribbon.players.map((p) => `
          <div class="player-card ${p.isActive ? 'active' : ''}" style="--player-accent: ${p.colorHex}">
            <img src="assets/avatars/${p.avatar}" class="player-avatar pixel-art" alt="${p.name}" />
            <div class="player-meta">
              <div class="player-header-row">
                <span class="player-name">${p.name}</span>
                ${p.isStaked ? '<span class="staked-badge">1.20x</span>' : ''}
              </div>
              <span class="player-cash">${p.cashFormatted}</span>
              <div class="player-stats-row">
                <span title="Unplaced Protocol Modules">Tiles: ${p.tileCount}</span>
                <span title="Owned District Parcels">Lots: ${p.parcelCount}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </section>

      <!-- Real-Time Activity Log Feed -->
      <aside class="activity-feed-panel ${this.feedCollapsed ? 'collapsed' : ''}" aria-label="Market Feed">
        <button class="feed-header" data-action="feed-toggle" title="Collapse or expand the feed">
          <span>Terminal Feed</span><span>${this.feedCollapsed ? '▴' : '▾'}</span>
        </button>
        <div class="feed-content" id="activity-feed-scroll">
          ${logs.map((item) => `
            <div class="log-entry">
              <span class="log-tag" style="color: ${item.tagColor}">[${item.tag}]</span>
              <span class="log-msg">${item.message}</span>
            </div>
          `).join('')}
        </div>
      </aside>

      <!-- Bottom Dock: Action Bar and Drawer -->
      <footer class="hud-bottom-dock">
        <div class="action-bar-container">
          <span class="action-instruction">${actions.instructions}</span>
          <div class="action-buttons-row">
            ${actions.buttons.map((btn) => `
              <button
                class="btn-action ${btn.primary ? 'btn-primary' : 'btn-secondary'}"
                data-action-id="${btn.id}"
                ${btn.disabled ? 'disabled' : ''}
                title="${btn.tooltip || ''}"
              >
                ${btn.label}
                ${btn.shortcut ? `<span class="shortcut-pill">${btn.shortcut}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Collapsible Bottom Drawer -->
        <div class="inventory-drawer ${drawer.isOpen ? 'open' : ''}">
          ${drawer.mode === 'draft' ? `
            <div class="drawer-tray draft-tray">
              <div class="tray-title">Available Deeds (${drawer.selectedCount}/${drawer.requiredCount} selected):</div>
              <div class="draft-cards-row">
                ${drawer.draftDeeds.map((d) => `
                  <button
                    class="deed-card ${d.isSelected ? 'selected' : ''}"
                    data-draft-lot="${d.lotId}"
                    style="--district-accent: ${d.districtColor}"
                  >
                    <span class="deed-num">#${d.lotNumber}</span>
                    <span class="deed-district">${d.districtName.split(' ')[0]}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="drawer-tray modules-tray">
              <div class="tray-title">Protocol Modules Inventory:</div>
              <div class="module-slots-row">
                ${drawer.modules.map((m) => `
                  <button
                    class="module-slot ${m.isSelected ? 'selected' : ''} ${m.count === 0 ? 'empty' : ''}"
                    data-shop-type="${m.shopType}"
                    ${m.count === 0 ? 'disabled' : ''}
                  >
                    <img src="assets/shops/shop_${m.shopType}.png" class="module-icon pixel-art" alt="${m.name}" />
                    <span class="module-code">${m.code}</span>
                    <span class="module-count">x${m.count}</span>
                    <span class="module-size">Size ${m.targetSize}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `}
        </div>
      </footer>
    `;

    // Auto scroll activity feed to bottom
    const feed = this.container.querySelector('#activity-feed-scroll');
    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    this.container.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest(
        '[data-action], [data-action-id], [data-shop-type], [data-draft-lot]'
      ) as HTMLElement | null;
      if (!target) return;

      if (target.dataset.action === 'feed-toggle') {
        this.feedCollapsed = !this.feedCollapsed;
        const panel = this.container.querySelector('.activity-feed-panel');
        panel?.classList.toggle('collapsed', this.feedCollapsed);
        const arrow = target.querySelector('span:last-child');
        if (arrow) arrow.textContent = this.feedCollapsed ? '▴' : '▾';
      } else if (target.dataset.action === 'wallet-toggle') {
        this.handlers.onWalletClick?.();
      } else if (target.dataset.action === 'audio-toggle') {
        this.handlers.onAudioToggle?.();
      } else if (target.dataset.actionId) {
        this.handlers.onActionClick?.(target.dataset.actionId);
      } else if (target.dataset.shopType !== undefined) {
        this.handlers.onTileSelect?.(parseInt(target.dataset.shopType, 10));
      } else if (target.dataset.draftLot !== undefined) {
        this.handlers.onDraftToggle?.(parseInt(target.dataset.draftLot, 10));
      }
    });

    // Hovering a deed card highlights its parcel on the board
    const hoverLot = (e: Event, entering: boolean): void => {
      const card = (e.target as HTMLElement).closest('[data-draft-lot]') as HTMLElement | null;
      if (!card || card.dataset.draftLot === undefined) return;
      this.handlers.onDraftHover?.(entering ? parseInt(card.dataset.draftLot, 10) : null);
    };
    this.container.addEventListener('mouseover', (e) => hoverLot(e, true));
    this.container.addEventListener('mouseout', (e) => hoverLot(e, false));
  }
}
