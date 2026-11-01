import { registerGameTools } from './model-context';
import { query as $, required as get, eventElement, errorMessage } from './dom';
import type { GameState, GamePhase, Lot, MatchEntryMode, ShopGroup } from './types';
import type { SoundEffect } from './audio';
import type { Camera, Point } from './camera';
import { researchMarkup } from './research';
import {
  SHOPS,
  DISTRICTS,
  COMPLETE,
  INCOMPLETE,
  KEEP,
  newGame,
  groups,
  groupIncome,
  income,
  holdings,
  claimPlots,
  beginBuild,
  canPlace,
  placeShop,
  finishYear,
  nextYear,
  rankings,
  validSave,
  updateBoardLayout,
  migrateEnglishState,
} from './engine';
import { createGameAudio } from './audio';
import { createTrading } from './trading';
import { zodiacImages } from './zodiac';
import { BLOCK_LAYOUTS, PLOT_LAYOUT } from './board-layout';
import { cameraFor, dragCamera, wheelCamera } from './camera';
import { MapInput } from './map-input';
import { preloadGameImages, GAME_IMAGES } from './preload';
import { installMobileGuards } from './mobile';

import {
  BURN_ADDRESS,
  DEFAULT_FLYWHEEL_CONFIG,
  applyMatchPayouts,
  applyPointSwap,
  calculateMatchPayouts,
  calculatePointSwap,
  createInitialFlywheelState,
  type FlywheelState,
} from '../tokenomics/flywheel';
import {
  BURN_EXPLORER_URL,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_MAINNET_CHAIN_ID,
  WIF_BLOCKSCOUT_TOKEN_URL,
  WIF_TOKEN_CONTRACT_ADDRESS,
  WalletAdapter,
  fetchLiveOnChainWifProof,
  type OnChainWifProof,
} from '../tokenomics/wallet';
import {
  NetworkRoom,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from '../network/room';
import { isWebGLAvailable } from '../ui/board-3d';
import { RobinCity3DRenderer } from './city-3d/robin-city-3d';
import type { CameraPresetMode, CityAtmosphereMode } from './city-3d/types-3d';
import { AppleCarousel, type CarouselItem } from '../ui/carousel';
import { ExposureGrid } from '../ui/exposure-grid';
import { IPodController, type iPodAction } from '../ui/ipod-controller';

export type BoardViewMode = '2d' | 'tabletop-3d' | 'city-3d';

const SAVE_KEY = 'robintown-save-v2';
const FLYWHEEL_KEY = 'robintown-flywheel-v1';
const VIEW_MODE_KEY = 'robintown-view-mode-v1';
const ATMO_3D_KEY = 'robintown-atmo-3d-v1';

interface EconomySnapshot {
  flywheel: FlywheelState;
  townPoints: number;
  stakedWif: number;
  communityVotes: number;
  simBalances: Record<string, number>;
  activeSimAddress: string;
}

const SPRITES = ['coffee', 'banhmi', 'pho', 'flowers', 'tailor', 'grocery'];
const LANDMARKS = ['tan-dinh', 'ben-thanh', 'thao-dien', 'cho-lon', 'binh-thanh', 'phu-nhuan'];
const DISTRICT_ACCENTS = ['#39a883', '#eec353', '#29b6f6', '#dc6f57', '#a78bfa', '#34d399'];
const ZODIAC = [
  ['Snake', 'Snake', 'snake'],
  ['Horse', 'Horse', 'horse'],
  ['Goat', 'Goat', 'goat'],
  ['Monkey', 'Monkey', 'monkey'],
  ['Rooster', 'Rooster', 'rooster'],
  ['Dog', 'Dog', 'dog'],
] as const;
const TOKEN_COLORS = ['#39a883', '#eec353', '#dc6f57', '#7fb5cf'];

type Timer = ReturnType<typeof setTimeout>;
interface PieceDrag {
  type: 'shop' | 'counter';
  index: number;
  el: HTMLElement;
  id: number;
  x: number;
  y: number;
  active: boolean;
}

const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

const money = (n: number) => `${n.toLocaleString('en-US')} <span class="money-symbol">$wif</span>`;

export function mountRobinTown(): void {
  let state: GameState;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    state = validSave(saved) ? saved : newGame();
  } catch {
    state = newGame();
  }
  const migratedNames = migrateEnglishState(state);
  const layoutUpdated = updateBoardLayout(state);
  if (migratedNames) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {}
  }

  const wallet = new WalletAdapter({ mode: 'simulation', autoConnect: true });
  let flywheel: FlywheelState = createInitialFlywheelState();
  let townPoints = 180;
  let stakedWif = 0;
  let communityVotes = 0;
  let simBalanceOverrides: Record<string, number> = {};
  let selectedEntryMode: MatchEntryMode = state.entryMode ?? 'casual';

  try {
    const rawEcon = JSON.parse(localStorage.getItem(FLYWHEEL_KEY) ?? 'null') as Partial<EconomySnapshot> | null;
    if (rawEcon) {
      if (rawEcon.flywheel) flywheel = { ...flywheel, ...rawEcon.flywheel };
      if (typeof rawEcon.townPoints === 'number') townPoints = rawEcon.townPoints;
      if (typeof rawEcon.stakedWif === 'number') stakedWif = rawEcon.stakedWif;
      if (typeof rawEcon.communityVotes === 'number') communityVotes = rawEcon.communityVotes;
      if (rawEcon.activeSimAddress) void wallet.switchAccount(rawEcon.activeSimAddress).catch(() => {});
      if (rawEcon.simBalances) {
        for (const [addr, bal] of Object.entries(rawEcon.simBalances)) {
          if (typeof bal === 'number' && Number.isFinite(bal)) {
            simBalanceOverrides[addr.toLowerCase()] = bal;
          }
        }
      }
    }
  } catch {}

  let viewMode: BoardViewMode = isWebGLAvailable() ? 'city-3d' : 'tabletop-3d';
  let last2DMode: '2d' | 'tabletop-3d' = 'tabletop-3d';
  try {
    const savedMode = localStorage.getItem(VIEW_MODE_KEY);
    if (savedMode === '2d' || savedMode === 'tabletop-3d' || (savedMode === 'city-3d' && isWebGLAvailable())) {
      viewMode = savedMode;
      if (savedMode === '2d' || savedMode === 'tabletop-3d') {
        last2DMode = savedMode;
      }
    }
  } catch {}

  let ledgerPage = 0;
  let view: 'play' | 'research' = 'play';
  let selectedShop: number | null = null;
  let selectedLot: number | null = null;
  let chosen: number[] = [];
  let partner = 1;
  let lastFocus: HTMLElement | null = null;
  let toastTimer: Timer | undefined;
  let freshLots: number[] = [];
  let drag: PieceDrag | null = null;
  let suppressClick = false;
  let rackOpen = state.phase === 'build';
  let menuOpen = true;
  let ipodOpen = false;
  let sessionStarted = false;
  let assetsReady = false;
  let assetFailures: string[] = [];
  let loadingCount = 0;
  let loadingPromise: Promise<unknown> | null = null;
  let cameraCenter: Point = { x: 550, y: 365 };
  let camera: Camera | null = null;
  let cameraInitialized = false;
  let cameraScale: number | null = null;
  let lastInputType = 'mouse';
  const mapInput = new MapInput();
  let mapTapBlockUntil = 0;
  let hudResizeObserver: ResizeObserver | null = null;
  let observedPhase = '';
  let renderedYear = state.year;
  let phaseTimer: Timer | undefined;
  let phaseDelay: Timer | undefined;
  let cashFrame = 0;
  let payout: { before: number[]; start: number } | null = null;
  let freshTimer: Timer | undefined;

  // Interactive 3D & Gadget Subsystems
  let board3D: RobinCity3DRenderer | null = null;
  let cameraPreset3D: CameraPresetMode = 'neighborhood';
  let atmosphere3D: CityAtmosphereMode = 'day';
  try {
    const savedAtmo = localStorage.getItem(ATMO_3D_KEY);
    if (savedAtmo === 'day' || savedAtmo === 'sunset' || savedAtmo === 'night') {
      atmosphere3D = savedAtmo;
    }
  } catch {}
  let startShader: ExposureGrid | null = null;
  let cityShader: ExposureGrid | null = null;
  let startCarousel: AppleCarousel | null = null;
  let ipodController: IPodController | null = null;
  let activeRoom: NetworkRoom | null = null;
  let activeRoomCode: string | null = null;
  let activeRoomUnsub: (() => void) | null = null;
  let onChainProof: OnChainWifProof | null = null;
  let onChainProofLoading = false;

  function refreshOnChainProof(): void {
    if (onChainProofLoading) return;
    onChainProofLoading = true;
    void fetchLiveOnChainWifProof()
      .then((proof) => {
        if (proof) {
          onChainProof = proof;
          if (get('#modal').open && get('#modal').dataset.wifHub === 'true') {
            openWifHub();
          }
        }
      })
      .finally(() => {
        onChainProofLoading = false;
      });
  }

  function bindRoomSession(room: NetworkRoom, code: string): void {
    activeRoomUnsub?.();
    activeRoom?.stop();
    activeRoom = room;
    activeRoomCode = code;
    const unsubState = room.onStateChange((rState) => {
      if (rState.status === 'playing' && rState.players.length > 0) {
        rState.players.forEach((rp) => {
          if (rp.seat !== null && rp.seat >= 0 && rp.seat < state.players.length && rp.name) {
            state.players[rp.seat].name = rp.seat === 0 ? state.players[0].name : rp.name;
          }
        });
      }
      if (get('#modal').open && get('#modal').dataset.wifHub === 'true') {
        openWifHub();
      }
      render();
    });
    const unsubStatus = room.transport.onStatusChange(() => {
      if (get('#modal').open && get('#modal').dataset.wifHub === 'true') {
        openWifHub();
      }
    });
    activeRoomUnsub = () => {
      unsubState();
      unsubStatus();
    };
    void room.start().catch(() => {});
  }

  const isStaked = () => stakedWif >= 500;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gameAudio = createGameAudio({ onChange: () => updateSoundButton() });

  function effectiveAccountBalance(address: string | undefined, fallbackBalance: number): number {
    if (!address) return fallbackBalance;
    const key = address.toLowerCase();
    return key in simBalanceOverrides ? simBalanceOverrides[key] : fallbackBalance;
  }

  function activeWalletBalance(): number {
    const wState = wallet.getState();
    const acc = wState.account;
    if (!acc) return 0;
    if (wState.mode === 'simulation') {
      return effectiveAccountBalance(acc.address, acc.balance);
    }
    return acc.balance;
  }

  function saveEconomy() {
    try {
      const simBalances: Record<string, number> = {};
      for (const acc of wallet.getSimulatedAccounts()) {
        simBalances[acc.address.toLowerCase()] = effectiveAccountBalance(acc.address, acc.balance);
      }
      const wState = wallet.getState();
      const snapshot: EconomySnapshot = {
        flywheel,
        townPoints,
        stakedWif,
        communityVotes,
        simBalances,
        activeSimAddress: wState.account?.address ?? wallet.getSimulatedAccounts()[0].address,
      };
      localStorage.setItem(FLYWHEEL_KEY, JSON.stringify(snapshot));
    } catch {}
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      saveEconomy();
    } catch {
      toast('Progress cannot be saved. Keep this tab open.');
    }
  }

  function adjustActiveWalletBalance(delta: number, burnSink = false): boolean {
    const wState = wallet.getState();
    const acc = wState.account;
    if (!acc) return false;
    if (wState.mode === 'simulation') {
      const current = effectiveAccountBalance(acc.address, acc.balance);
      const next = current + delta;
      if (next < 0) return false;
      simBalanceOverrides[acc.address.toLowerCase()] = next;
      if (delta < 0) {
        const dest = burnSink ? BURN_ADDRESS : '0x9999999999999999999999999999999999999999';
        void wallet.transfer(dest, Math.abs(delta)).catch(() => {});
      }
      saveEconomy();
      return true;
    }
    return delta >= 0;
  }

  const trading = createTrading({
    getState: () => state,
    sprite,
    token,
    modal,
    closeModal,
    onChanged: () => {
      townPoints += 15;
      changed();
    },
    onTradeTax: (taxAmount) => {
      flywheel = {
        ...flywheel,
        totalStakingYield: flywheel.totalStakingYield + taxAmount,
        totalTradesTaxed: flywheel.totalTradesTaxed + 1,
      };
      saveEconomy();
    },
    playSound,
    onTrading: (v) => gameAudio.setTrading(v),
    speak: (m, p) => gameAudio.speak(m, p),
  });

  function changed() {
    save();
    render();
  }

  function toast(message: string) {
    get('#toast').textContent = message;
    get('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => get('#toast').classList.remove('show'), 3800);
  }

  function modal(title: string, content: string, eyebrow = 'ROBIN TOWN') {
    cancelMapGesture();
    dismissPhase();
    delete get('#modal').dataset.settings;
    delete get('#modal').dataset.wifHub;
    get('#modal').classList.remove('ledger-dialog');
    if (trading.isOpen()) trading.cancel();
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    get('#modal').setAttribute('aria-label', title);
    get('#modal').innerHTML =
      `<div class="modal-header"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><button class="close" aria-label="Close dialog" data-action="close">×</button></div><div class="modal-body">${content}</div>`;
    if (!get('#modal').open) get('#modal').showModal();
    get('#modal').scrollTop = 0;
  }

  function closeModal() {
    trading.dismiss();
    get('#modal').close();
    lastFocus?.focus?.();
  }

  function sprite(kind: string, name: string, cls = '', extra = '') {
    return `<img class="pixel ${cls}" src="/assets/saigon/${kind}/${name}.png?v=en2" alt="" draggable="false" ${extra}>`;
  }

  function zodiacSprite(index: number, cls = '') {
    return `<img class="pixel ${cls}" src="${zodiacImages[ZODIAC[index][2]]}" alt="${ZODIAC[index][0]}" draggable="false">`;
  }

  function token(player: number, cls = '') {
    return sprite('materials', 'stool-' + player + '-v8', 'owner-token ' + cls);
  }

  function lotLabel(l: Lot) {
    return `Plot ${l.id + 1}, ${DISTRICTS[Math.floor(l.id / 12)]}, ${l.owner === null ? 'unclaimed' : l.owner === 0 ? 'yours' : state.players[l.owner].name}${l.shop === null ? '' : ', ' + SHOPS[l.shop].name}`;
  }

  function phaseName(p: GamePhase = state.phase) {
    return {
      receive: 'Receive',
      trade: 'Trade',
      build: 'Build',
      income: 'Payday',
      ended: 'Finale',
    }[p];
  }

  function board() {
    return DISTRICTS.map((name, b) => {
      const layout = BLOCK_LAYOUTS[b];
      return `<section class="district district-${b}" style="left:${layout.x}px;top:${layout.y}px" aria-label="${name}"><div class="district-identity"><span class="landmark-medallion">${sprite('signs', LANDMARKS[b] + '-v6')}</span><strong>${name}</strong><span class="district-number">${String(b + 1).padStart(2, '0')}</span></div><div class="district-grid">${state.lots
        .slice(b * 12, b * 12 + 12)
        .map((l) => {
          const cell = PLOT_LAYOUT[l.id],
            offered = state.pending.includes(l.id),
            picked = chosen.includes(l.id),
            shop = l.shop === null ? null : SHOPS[l.shop],
            valid =
              state.phase === 'build' &&
              selectedShop !== null &&
              canPlace(state, 0, l.id, selectedShop);
          return `<button data-lot="${l.id}" class="lot ${l.owner !== null ? 'owned' : ''} ${l.owner === 0 ? 'mine' : ''} ${offered ? 'offered' : ''} ${picked ? 'picked' : ''} ${selectedLot === l.id ? 'inspected' : ''} ${shop ? 'built' : ''} ${valid ? 'buildable' : ''} ${freshLots.includes(l.id) ? 'fresh' : ''} ${state.phase === 'build' && l.owner === 0 && l.shop === null ? 'ready-plot' : ''}" aria-label="${lotLabel(l)}" aria-pressed="${picked || selectedLot === l.id}" style="grid-column:${cell.col + 1};grid-row:${cell.row + 1};--piece-delay:${Math.max(0, Math.min(12, freshLots.indexOf(l.id))) * 40}ms"><span class="plot-number">${l.id + 1}</span>${shop && l.shop !== null ? sprite('shops', SPRITES[l.shop], 'built-shop') : '<span class="plot-edge"></span>'}${l.owner !== null ? token(l.owner) : picked ? token(0, 'draft-token') : ''}${valid && selectedShop !== null ? sprite('shops', SPRITES[selectedShop], 'build-ghost') : ''}${shop ? `<span class="plot-target" title="Complete with ${shop.size} connected shops">${shop.size}</span>` : ''}</button>`;
        })
        .join('')}</div></section>`;
    }).join('');
  }

  function calendar() {
    const z = ZODIAC[state.year - 1],
      label = `Year ${state.year}/6 · ${z[0]}`;
    return `<aside class="calendar paper-calendar" aria-label="Robin-Town year calendar"><div class="calendar-sheet"><button class="calendar-date" data-action="years" aria-label="${label}. View all six years"><span class="calendar-heading">ROBIN TOWN</span><small class="calendar-caption">YEAR</small><strong class="calendar-digit">${state.year}</strong><span class="calendar-animal">${zodiacSprite(state.year - 1)}<b>${z[0]}</b></span><span class="calendar-footnote">${state.year} / 6 · View years</span></button></div></aside>`;
  }

  function playerCard() {
    return `<div class="player-rail">${state.players.map((p, i) => `<div class="player-pocket ${i === 0 ? 'your-pocket' : ''}" style="--player-color:${TOKEN_COLORS[i]}"><button class="pocket-main" data-action="${i !== 0 && state.phase === 'trade' ? 'trade-player' : 'player-info'}" data-player="${i}" aria-label="${i === 0 ? 'Your inventory' : p.name}, ${p.cash} $wif"><span class="pocket-token">${token(i)}<b>${i === 0 ? 'YOU' : p.name.toUpperCase()}</b></span><span class="wallet"><strong data-wallet="${i}">${money(p.cash)}</strong><span class="hand-total" aria-label="${p.tiles.reduce((n, x) => n + x, 0)} shop pieces">▧ ${p.tiles.reduce((n, x) => n + x, 0)}</span><small>+${income(state, i, isStaked())} $wif / yr</small></span></button><div class="pocket-inventory" aria-label="Unused shop pieces">${p.tiles.map((n, s) => (n ? `<button data-action="glance-shop" data-player="${i}" data-shop-index="${s}" title="${SHOPS[s].name} ×${n}" aria-label="${p.name}, ${SHOPS[s].name}, ${n}">${sprite('shops', SPRITES[s])}<b>${n}</b></button>` : '')).join('') || `<span>Empty rack</span>`}<button class="inventory-more" data-action="player-info" data-player="${i}" aria-label="View inventory">⋯</button></div></div>`).join('')}</div>`;
  }

  function hudUtilities() {
    const wState = wallet.getState();
    const balance = Math.floor(activeWalletBalance());
    const shortLabel =
      wState.mode === 'web3' && wState.account
        ? `${wState.account.address.slice(0, 6)}…`
        : `${wState.account?.name ?? 'Sim'}`;
    return `<div class="robin-hud-utilities">
      <button class="view-toggle-btn" data-action="view-toggle" title="Toggle 3D City / Tabletop view (Hotkey: V)" aria-label="Toggle 3D City and Tabletop board view">
        <span class="view-toggle-icon">${viewMode === 'city-3d' ? '🏙️' : '🗺️'}</span>
        <span class="view-toggle-label">${viewMode === 'city-3d' ? '3D City' : 'Board'}</span>
        <span class="view-toggle-swap" aria-hidden="true">⇄</span>
      </button>
      <div class="view-mode-segmented" role="group" aria-label="Board view mode">
        <button class="view-mode-btn ${viewMode === '2d' ? 'active' : ''}" data-action="set-view" data-view-mode="2d" title="Flat 2D Aseprite street map">2D</button>
        <button class="view-mode-btn ${viewMode === 'tabletop-3d' ? 'active' : ''}" data-action="set-view" data-view-mode="tabletop-3d" title="3D tilted tabletop Aseprite street map">3D Tilt</button>
        <button class="view-mode-btn ${viewMode === 'city-3d' ? 'active' : ''}" data-action="set-view" data-view-mode="city-3d" title="Full Three.js WebGL 3D City diorama">3D City</button>
      </div>
      <button class="wif-hud-pill" data-action="wif-hub" aria-label="Open $wif Flywheel, Wallet, and Rooms">
        <span class="wif-hud-burn">🔥 ${flywheel.totalBurned.toLocaleString('en-US')}</span>
        <span>${escape(shortLabel)}: ${balance.toLocaleString('en-US')} $wif</span>
        ${isStaked() ? '<span class="wif-hud-boost">1.20x</span>' : ''}
      </button>
      <button class="ipod-hud-btn ${ipodOpen ? 'active' : ''}" data-action="toggle-ipod" aria-pressed="${ipodOpen}" aria-label="Toggle iPod Classic controller">♫ iPod</button>
      <button class="hud-menu" data-action="menu" aria-label="Game menu">☰<small>Menu</small></button>
    </div>`;
  }

  function phaseCard() {
    let title: string, body: string, action: string;
    switch (state.phase) {
      case 'receive':
        title = 'Claim your corner.';
        body = `Place your stools on ${state.draftCount} glowing plots.`;
        action = `<div class="claim-tools"><button data-drag-token="0" class="counter-stack" aria-label="Drag your stool onto a glowing plot">${[0, 1, 2, 3].map((n) => token(0, `stack-${n}`)).join('')}</button><div class="address-strip">${state.pending.map((id) => `<button data-lot="${id}" class="address-slip ${chosen.includes(id) ? 'selected' : ''}" aria-pressed="${chosen.includes(id)}" aria-label="Plot ${id + 1}, ${DISTRICTS[Math.floor(id / 12)]}">${sprite('ui', 'plot-mini-v9', 'draft-ground')}<span class="draft-address">${id + 1}</span>${chosen.includes(id) ? token(0, 'draft-stool') : ''}<span class="draft-district">${String(Math.floor(id / 12) + 1).padStart(2, '0')}</span></button>`).join('')}</div><button class="primary" data-action="claim" ${chosen.length !== state.draftCount ? 'disabled' : ''}>Keep ${chosen.length}/${state.draftCount} ✓</button></div>`;
        break;
      case 'trade':
        title = 'Who holds your missing piece?';
        body = 'Tap a neighbor, their shop piece, or their street plot to bargain in $wif.';
        action = `<button class="primary" data-action="trade">Bargain ⇄</button><button class="secondary" data-action="build">Build →</button>`;
        break;
      case 'build':
        title = 'Open for business.';
        body = 'Choose a shop piece below, drag it onto your plot, or tap your plot for quick build.';
        action = `<span class="payday-preview">Next payday <b>${income(state, 0, isStaked())} $wif</b></span><button class="primary" data-action="collect">Finish & collect →</button>`;
        break;
      case 'income':
        title = 'A thriving year on the block.';
        body = `Your storefronts brought in ${state.lastIncome[0]} $wif${isStaked() ? ' (1.20x staked boost)' : ''}.`;
        action = `<button class="primary" data-action="next">Welcome year ${state.year + 1} →</button><button class="secondary" data-action="income">Earnings</button>`;
        break;
      default:
        title = 'Six years. One thriving $wif town.';
        body = 'See who grew the richest neighborhood fortune and settle your $wif rewards.';
        action = `<button class="primary" data-action="results">Final standings ★</button>`;
    }
    return `<section class="turn-scroll"><div class="phase-heading"><span class="phase-medal">${{ receive: '01', trade: '02', build: '03', income: '04', ended: '★' }[state.phase]}</span><div><small>${phaseName()}</small><h2>${title}</h2></div><button class="replay-guide" data-action="guide" aria-label="Replay phase guide">?</button></div><p>${body}</p><div class="phase-actions">${action}</div></section>`;
  }

  function hand() {
    return `<section class="tile-rack" aria-label="Your shop pieces"><div class="rack-label"><span>YOUR SHOP PIECES</span><button class="ledger-shortcut" data-action="businesses"><span aria-hidden="true">▤</span> Open ledger ↗</button></div><div class="shop-tray">${SHOPS.map((s, i) => `<button class="shop-piece ${selectedShop === i ? 'active' : ''} ${state.players[0].tiles[i] === 0 ? 'depleted' : ''}" data-shop="${i}" data-drag-shop="${i}" aria-pressed="${selectedShop === i}" aria-label="${s.name}: ${state.players[0].tiles[i]} in your rack. Connect ${s.size} matching shops of your color for ${COMPLETE[s.size]} $wif each year"><span class="piece-count"><small>Have</small> ${state.players[0].tiles[i]}</span>${sprite('shops', SPRITES[i])}<strong>${s.name}</strong><small class="shop-requirement"><span>Connect</span> <b>${s.size}</b> <span class="requirement-tail">tiles</span></small><span class="shop-payout">${COMPLETE[s.size]} $wif <em>/ year</em></span></button>`).join('')}</div><div class="rack-hint">Same shop + your stool color + shared edge = connected business. Stake 500 $wif in the Hub for a 1.20x annual payday boost!</div></section>`;
  }

  function selection() {
    if (selectedLot === null) return '';
    const l = state.lots[selectedLot],
      g =
        l.shop === null || l.owner === null
          ? null
          : groups(state, l.owner).find((grp) => grp.lots.includes(l.id));
    const build =
      state.phase === 'build' && l.owner === 0
        ? `<div class="quick-build"><small>${l.shop === null ? 'OPEN HERE' : 'EXPAND THIS BUSINESS'}</small><div>${
            SHOPS.map((s, i) => {
              if (!state.players[0].tiles[i] || (l.shop !== null && i !== l.shop)) return '';
              return `<button data-action="quick-build" data-id="${l.id}" data-index="${i}" aria-label="${l.shop === null ? 'Build' : 'Select'} ${s.name}">${sprite('shops', SPRITES[i])}<strong>${s.name}</strong><small>×${state.players[0].tiles[i]} · ${s.size} → ${COMPLETE[s.size]} $wif</small></button>`;
            }).join('') || `<span>No matching pieces in your rack.</span>`
          }</div></div>`
        : '';
    const offeredCanPick = state.phase === 'receive' && state.pending.includes(l.id);
    return `<div class="plot-inspector"><div class="inspector-top"><span class="inspector-address">${l.id + 1}</span><div><strong>${DISTRICTS[Math.floor(l.id / 12)]}</strong><small>${l.owner === null ? 'Unclaimed' : l.owner === 0 ? 'Your plot' : state.players[l.owner].name}${l.shop !== null ? ' · ' + SHOPS[l.shop].name : ''}</small>${g ? `<small>${g.size}/${SHOPS[g.shop].size} connected · ${groupIncome(g.shop, g.size)} $wif/yr</small>` : ''}</div>${offeredCanPick ? `<button class="primary" data-lot="${l.id}">${chosen.includes(l.id) ? 'Lift stool' : 'Place stool'}</button>` : ''}${state.phase === 'trade' && l.owner !== null && l.owner !== 0 ? `<button class="primary" data-action="trade-lot" data-id="${l.id}">Bargain ⇄</button>` : ''}<button class="close" data-action="deselect" aria-label="Close">×</button></div>${build}</div>`;
  }

  function streetScene() {
    return `<div class="map-terrain" aria-hidden="true">${sprite('city', 'saigon-city-board-v6', 'city-background')}<span class="street-name street-top">SHERWOOD AVE</span><span class="street-name street-mid">MERCHANT BLVD</span><span class="street-name street-bottom">HARBORFRONT QUAY</span><span class="river-name">ROBINHOOD RIVER</span><div class="vehicle ninja-ride">${sprite('life', 'ninja-lead')}</div><div class="vehicle ninja-return">${sprite('life', 'ninja-lead')}</div><div class="vehicle city-bus">${sprite('life', 'city-bus')}</div><div class="walker crossing-one"><span></span></div><div class="walker crossing-two"><span></span></div><div class="walker crossing-three"><span></span></div></div>`;
  }

  function ensure3DCityMounted() {
    const stage = $('.three-city-stage');
    const host = $('.three-city-canvas-host');
    if (!stage || !host) return;
    if (viewMode !== 'city-3d') {
      board3D?.pause();
      return;
    }
    const shaderCanvas = stage.querySelector<HTMLCanvasElement>('#robin-city-shader');
    if (shaderCanvas && !cityShader) {
      cityShader = new ExposureGrid({
        canvas: shaderCanvas,
        phaseTheme: state.phase,
        intensity: 0.55,
      });
      cityShader.mount();
    }
    cityShader?.setPhaseTheme(state.phase);

    if (!board3D && isWebGLAvailable()) {
      const rect = stage.getBoundingClientRect();
      board3D = new RobinCity3DRenderer({
        container: host,
        width: Math.max(640, rect.width || 1000),
        height: Math.max(420, rect.height || 620),
        initialPreset: cameraPreset3D,
        initialAtmosphere: atmosphere3D,
        onSelectLot: (lotId) => {
          playSound('tap');
          clickLot(lotId);
        },
      });
      board3D.mount();
    } else if (board3D) {
      board3D.resume();
      const rect = stage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        board3D.resize(rect.width, rect.height);
      }
    }
    board3D?.render({
      state,
      selectedLot,
      chosenLots: chosen,
      selectedShop,
    });
    stage
      .querySelectorAll<HTMLButtonElement>('button[data-action="set-3d-preset"]')
      .forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === cameraPreset3D);
      });
    stage
      .querySelectorAll<HTMLButtonElement>('button[data-action="set-3d-atmo"]')
      .forEach((btn) => {
        btn.classList.toggle('active-atmo', btn.dataset.atmo === atmosphere3D);
      });
  }

  function buildIPodActions(): iPodAction[] {
    const phaseActions: iPodAction[] = [];
    if (state.phase === 'receive') {
      phaseActions.push({
        id: 'ipod-auto-pick',
        label: 'Auto-Pick Offered Plots',
        handler: () => {
          chosen = state.pending.slice(0, state.draftCount);
          playSound('place');
          render();
        },
      });
      phaseActions.push({
        id: 'ipod-claim',
        label: `Keep ${chosen.length}/${state.draftCount} Plots`,
        handler: () => {
          if (chosen.length === state.draftCount) act('claim');
          else toast(`Select ${state.draftCount} glowing plots first.`);
        },
      });
    } else if (state.phase === 'trade') {
      phaseActions.push(
        { id: 'ipod-trade-1', label: `Bargain with ${state.players[1].name}`, handler: () => { partner = 1; openTrade(); } },
        { id: 'ipod-trade-2', label: `Bargain with ${state.players[2].name}`, handler: () => { partner = 2; openTrade(); } },
        { id: 'ipod-trade-3', label: `Bargain with ${state.players[3].name}`, handler: () => { partner = 3; openTrade(); } },
        { id: 'ipod-to-build', label: 'Finish Deals -> Build', handler: () => act('build') },
      );
    } else if (state.phase === 'build') {
      phaseActions.push(
        { id: 'ipod-rack', label: rackOpen ? 'Hide Shop Rack' : 'Open Shop Rack', handler: () => act('rack') },
        { id: 'ipod-collect', label: 'Collect $wif Payday', handler: () => act('collect') },
      );
    } else if (state.phase === 'income') {
      phaseActions.push(
        { id: 'ipod-next', label: `Start Year ${state.year + 1}`, handler: () => act('next') },
        { id: 'ipod-earnings', label: 'View Earnings Sheet', handler: () => act('income') },
      );
    } else {
      phaseActions.push({
        id: 'ipod-results',
        label: 'Final $wif Standings',
        handler: () => act('results'),
      });
    }

    phaseActions.push(
      {
        id: 'ipod-view',
        label: `View: ${viewMode === '2d' ? '2D Map' : viewMode === 'tabletop-3d' ? '3D Tilt' : '3D City'}`,
        handler: () => {
          const order: BoardViewMode[] = ['2d', 'tabletop-3d', 'city-3d'];
          const next = order[(order.indexOf(viewMode) + 1) % order.length];
          setViewMode(next);
        },
      },
      {
        id: 'ipod-music',
        label: `Lo-Fi Radio: ${gameAudio.getSettings().music ? 'ON' : 'OFF'}`,
        handler: () => act('music'),
      },
      {
        id: 'ipod-wif-hub',
        label: '$wif Flywheel & Wallet',
        handler: () => openWifHub(),
      },
    );
    return phaseActions;
  }

  function syncIPodDock() {
    const dock = $('#robin-ipod-dock');
    if (!dock) return;
    dock.hidden = !ipodOpen || menuOpen || view !== 'play';
    if (dock.hidden) return;
    const host = dock.querySelector<HTMLElement>('.robin-ipod-scale');
    if (!host) return;
    const title = `Y${state.year} · ${phaseName()}`;
    const actions = buildIPodActions();
    if (!ipodController) {
      ipodController = new IPodController({
        container: host,
        menuTitle: title,
        actions,
      });
      ipodController.mount();
    } else {
      ipodController.setActions(title, actions);
    }
  }

  function setViewMode(next: BoardViewMode) {
    viewMode = next;
    if (next === '2d' || next === 'tabletop-3d') {
      last2DMode = next;
    }
    if (typeof document !== 'undefined' && document.body?.dataset) {
      document.body.dataset.viewMode = viewMode;
    }
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {}
    render();
  }

  function toggleViewMode(): BoardViewMode {
    const next: BoardViewMode = viewMode === 'city-3d' ? last2DMode : 'city-3d';
    setViewMode(next);
    return next;
  }

  function mountGame() {
    if ($('.game-shell')) return;
    get('#app').innerHTML = `<div class="game-shell">
      <header class="game-hud-top"></header>
      <div class="play-stage">
        <section class="board-area">
          <div class="board-frame">
            <div class="map-viewport" tabindex="0">
              <div class="game-world">${streetScene()}<div class="plot-layer"></div></div>
            </div>
            <div class="three-city-stage">
              <canvas id="robin-city-shader" class="robin-shader-canvas" aria-hidden="true"></canvas>
              <div class="three-city-canvas-host"></div>
              <div class="three-city-toolbar">
                <span class="three-city-label">3D Neighborhood</span>
                <button type="button" data-action="set-3d-preset" data-preset="neighborhood" class="active">2D Match</button>
                <button type="button" data-action="set-3d-preset" data-preset="isometric">Iso</button>
                <button type="button" data-action="set-3d-preset" data-preset="street">Street</button>
                <button type="button" data-action="set-3d-preset" data-preset="topdown">Top</button>
                <button type="button" data-action="reset-3d-camera">Reset</button>
                <span class="three-city-sep" aria-hidden="true"></span>
                <button type="button" data-action="set-3d-atmo" data-atmo="day" class="active-atmo" aria-label="Sunlit Day atmosphere">Day</button>
                <button type="button" data-action="set-3d-atmo" data-atmo="sunset" aria-label="Golden Sunset atmosphere">Sunset</button>
                <button type="button" data-action="set-3d-atmo" data-atmo="night" aria-label="Lantern Night atmosphere">Night</button>
                <span class="three-city-sep" aria-hidden="true"></span>
                <button type="button" data-action="view-toggle">2D Map</button>
              </div>
            </div>
          </div>
          <div class="calendar-layer"></div>
          <span class="camera-hint"></span>
          <div class="inspector-layer"></div>
        </section>
      </div>
      <div class="game-hud-bottom"></div>
    </div>
    <aside id="robin-ipod-dock" class="robin-ipod-dock" hidden aria-label="iPod Classic game controller">
      <div class="robin-ipod-card">
        <div class="robin-ipod-bar">
          <span>♫ ROBIN-POD · CLICK WHEEL</span>
          <button type="button" data-action="toggle-ipod" aria-label="Minimize iPod">×</button>
        </div>
        <div class="robin-ipod-scale"></div>
      </div>
    </aside>`;
    hudResizeObserver?.disconnect();
    hudResizeObserver = new ResizeObserver(() => {
      fitMap();
      if (viewMode === 'city-3d') ensure3DCityMounted();
    });
    hudResizeObserver.observe(get('.board-frame'));
  }

  function render() {
    cancelMapGesture();
    document.documentElement.lang = 'en';
    document.body.dataset.phase = state.phase;
    document.body.dataset.viewMode = viewMode;
    const qaDebug = new URLSearchParams(window.location.search).get('debug') === '1';
    if (qaDebug) {
      document.body.dataset.qaDebug = '1';
      let pill = $('#robin-qa-debug-pill');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'robin-qa-debug-pill';
        pill.className = 'robin-qa-debug-pill';
        document.body.appendChild(pill);
      }
      pill.textContent = `QA DEBUG · Y${state.year}/${state.phase} · view=${viewMode} · menu=${menuOpen ? 1 : 0} · pending=${state.pending.length} · burned=${flywheel.totalBurned}`;
    } else {
      delete document.body.dataset.qaDebug;
      $('#robin-qa-debug-pill')?.remove();
    }
    document.body.classList.toggle('notebook-open', view === 'research');
    gameAudio.setPhase(state.phase);
    startShader?.setPhaseTheme(state.phase);
    cityShader?.setPhaseTheme(state.phase);

    if (view === 'research') {
      hudResizeObserver?.disconnect();
      board3D?.unmount();
      board3D = null;
      cityShader?.unmount();
      cityShader = null;
      ipodController?.unmount();
      ipodController = null;
      dismissPhase();
      get('#app').innerHTML = researchMarkup(state, sprite, token);
      return;
    }

    const oldYear = renderedYear,
      oldTray = $('.shop-tray')?.scrollLeft || 0;
    const key = state.year + ':' + state.phase,
      phaseChanged = observedPhase !== key;
    if (phaseChanged) {
      rackOpen = state.phase === 'build';
      if (state.phase === 'receive' || state.phase === 'build') cameraInitialized = false;
    }

    mountGame();
    get('.game-shell').inert = menuOpen;
    document.body.classList.toggle('menu-open', menuOpen);
    renderStartMenu();

    get('.board-area').setAttribute('aria-label', 'Robin-Town neighborhood game board');
    get('.map-viewport').setAttribute(
      'aria-label',
      'Town map. Drag to move, scroll or pinch to zoom. Arrow keys move, plus and minus zoom, zero shows the whole town on desktop.',
    );
    get('.game-hud-top').innerHTML = `<div class="game-brand">ROBIN<span>TOWN</span></div>${playerCard()}${hudUtilities()}`;
    get('.plot-layer').innerHTML = board();
    get('.calendar-layer').innerHTML = calendar();
    get('.camera-hint').textContent =
      viewMode === 'city-3d'
        ? '3D City Mode · Click glowing gold parcels to draft or build'
        : selectedShop !== null && state.phase === 'build'
          ? `${SHOPS[selectedShop].name} · ${SHOPS[selectedShop].size} connected → ${COMPLETE[SHOPS[selectedShop].size]} $wif/yr`
          : desktopMap()
            ? 'Drag to move · scroll to zoom · 0: whole town'
            : 'Swipe to move · pinch to zoom';
    get('.inspector-layer').innerHTML = selection();
    get('.game-hud-bottom').innerHTML = `<div class="rack-drawer ${rackOpen ? 'open' : ''}" id="shop-drawer">${hand()}</div><div class="action-belt"><button class="belt-button ${rackOpen ? 'active' : ''}" data-action="rack" aria-expanded="${rackOpen}" aria-controls="shop-drawer" aria-label="Your shop pieces">${selectedShop !== null && state.phase === 'build' ? sprite('shops', SPRITES[selectedShop], 'selected-piece-icon') : '▧'}<small class="selected-piece-label">${selectedShop !== null && state.phase === 'build' ? SHOPS[selectedShop].name : 'Rack ' + state.players[0].tiles.reduce((a, b) => a + b, 0)}</small></button>${phaseCard()}<button class="belt-button" data-action="businesses" aria-label="Open shop ledger">▤<small>Ledger</small></button></div>`;
    get('.shop-tray').scrollLeft = oldTray;
    updateSoundButton();
    syncIPodDock();

    requestAnimationFrame(() => {
      fitMap();
      ensure3DCityMounted();
      updateGuides();
      animateWallets();
      if (oldYear !== state.year) animateYear();
    });

    renderedYear = state.year;
    if (phaseChanged) {
      observedPhase = key;
      dismissPhase();
      if (!['income', 'ended'].includes(state.phase)) {
        clearTimeout(phaseDelay);
        phaseDelay = setTimeout(() => showPhase(), oldYear === state.year ? 200 : 1100);
      }
    }
  }

  function moveCamera(center: Point) {
    const world = $('.game-world'),
      before = world?.style.transform;
    cameraCenter = center;
    cameraInitialized = true;
    fitMap();
    if (world && before && !reducedMotion())
      world.animate([{ transform: before }, { transform: world.style.transform }], {
        duration: 300,
        easing: 'cubic-bezier(.2,.7,.2,1)',
      });
  }

  function focusLot(id: number) {
    const cell = PLOT_LAYOUT[id];
    moveCamera({ x: cell.x + 25, y: cell.y + 25 });
    board3D?.focusLot(id);
  }

  function desktopMap() {
    return globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
  }

  function fitMap() {
    const vp = $('.map-viewport'),
      world = $('.game-world');
    if (!vp || !world || vp.clientWidth === 0 || vp.clientHeight === 0) return;
    if (!cameraInitialized) {
      const id =
        state.phase === 'receive'
          ? state.pending[0]
          : state.lots.find((l) => l.owner === 0 && l.shop === null)?.id;
      const cell = id === undefined ? null : PLOT_LAYOUT[id];
      cameraCenter = cell
        ? { x: BLOCK_LAYOUTS[cell.block].x + 103, y: BLOCK_LAYOUTS[cell.block].y + 103 }
        : { x: 550, y: 365 };
      cameraInitialized = true;
    }
    camera = cameraFor(
      vp.clientWidth,
      vp.clientHeight,
      cameraCenter,
      cameraScale,
      desktopMap() ? 'contain' : 'cover',
    );
    cameraCenter = { x: camera.x, y: camera.y };
    world.style.transform = `translate(${camera.left}px,${camera.top}px) scale(${camera.scale})`;
  }

  function hasProgress() {
    return (
      sessionStarted ||
      state.year > 1 ||
      state.phase !== 'receive' ||
      state.lots.some((l) => l.owner !== null)
    );
  }

  function buildShowcaseCarouselItems(): CarouselItem[] {
    const districtCards: CarouselItem[] = DISTRICTS.map((name, idx) => ({
      id: idx + 1,
      title: `${name} District`,
      district: `BLOCK 0${idx + 1}`,
      color: DISTRICT_ACCENTS[idx],
      owner: `${state.lots.slice(idx * 12, idx * 12 + 12).filter((l) => l.owner !== null).length}/12 Claimed`,
      shop: `${SHOPS[idx].name} (${SHOPS[idx].size} tiles)`,
      income: COMPLETE[SHOPS[idx].size],
    }));
    return [
      ...districtCards,
      {
        id: 101,
        title: '5% Match Burn + 90% Purse',
        district: '$WIF FLYWHEEL',
        color: '#2ca56d',
        owner: `${flywheel.totalBurned} $wif Burned`,
        shop: '1.20x Staking Yield',
        income: 140,
      },
    ];
  }

  function renderStartMenu() {
    const menu = get('#start-screen');
    menu.hidden = !menuOpen;
    if (!menuOpen) {
      startCarousel?.unmount();
      startCarousel = null;
      startShader?.unmount();
      startShader = null;
      return;
    }

    const walletBalance = Math.floor(activeWalletBalance());

    menu.innerHTML = `<div class="menu-scene" aria-hidden="true"></div>
      <canvas id="robin-start-shader" class="robin-shader-canvas" aria-hidden="true"></canvas>
      <div class="start-panel">
        <div class="robin-kicker-badges">
          <span class="robin-chain-pill">● ROBINHOOD CHAIN · BUILD WITH $WIF</span>
          <span class="robin-chain-pill burn">🔥 ${flywheel.totalBurned.toLocaleString('en-US')} $wif Burned</span>
        </div>
        <h1 class="start-logo">ROBIN<span>TOWN</span></h1>
        <div class="menu-shops" aria-hidden="true">${sprite('shops', 'banhmi')}${sprite('shops', 'coffee')}${sprite('shops', 'pho')}</div>
        <p class="start-description">Pull up a stool. Bargain for street corners, open neighborhood shops, and put $wif to work in a 6-year trading board game.</p>

        <div class="entry-mode-grid" role="group" aria-label="Choose match entry mode">
          <button type="button" class="entry-mode-card ${selectedEntryMode === 'casual' ? 'active' : ''}" data-action="select-entry" data-entry-mode="casual">
            <strong>Casual Town <span class="entry-tag">FREE ENTRY</span></strong>
            <small>No $wif needed to play. Beat AI neighbors, earn Town Points, and swap points to $wif (3% burn).</small>
          </button>
          <button type="button" class="entry-mode-card ${selectedEntryMode === 'ranked' ? 'active' : ''}" data-action="select-entry" data-entry-mode="ranked">
            <strong>Ranked Arena <span class="entry-tag">1,000 $WIF</span></strong>
            <small>4,000 $wif pot: 3,600 $wif Podium Purse, 200 $wif burned forever, 200 $wif to Staking Vault.</small>
          </button>
        </div>

        <div class="start-actions">
          <button class="primary start-play" data-action="resume" ${assetsReady ? '' : 'disabled'}>${hasProgress() ? 'Continue game' : selectedEntryMode === 'ranked' ? 'Enter 1,000 $wif Arena' : 'Start free game'} <span>▶</span></button>
          ${hasProgress() ? `<span class="save-caption">Year ${state.year}/6 · ${phaseName()} · ${state.players[0].cash} $wif (${state.entryMode === 'ranked' ? 'Ranked Arena' : 'Casual Town'})</span><button class="menu-option" data-action="new">New game</button>` : ''}
          <button class="menu-option" data-action="wif-hub">$wif Wallet, Staking & Online Rooms (${walletBalance.toLocaleString('en-US')} $wif)</button>
          <button class="menu-option" data-action="rules">How to play</button>
          <button class="menu-option" data-action="settings">Audio & View Settings</button>
        </div>

        <div class="start-carousel-wrap">
          <div class="start-carousel-header">
            <span>NEIGHBORHOOD DISTRICTS & $WIF YIELDS</span>
            <span>APPLE AUTOPLAY CAROUSEL</span>
          </div>
          <div id="start-apple-carousel"></div>
        </div>

        <div class="load-status" role="status" aria-live="polite">
          <progress max="${GAME_IMAGES.length}" value="${loadingCount}"></progress>
          <span data-load-label></span>
          <button data-action="retry-assets" hidden>Retry</button>
        </div>
        <p class="start-foot">Inspired by Chinatown · 2D + 3D Tabletop + Three.js 3D Living City</p>
        ${hasProgress() ? `<button class="artbook-link" data-action="businesses">Shop ledger</button> · <button class="artbook-link" data-action="history">Town journal</button> · ` : ''}
        <button class="artbook-link" data-action="research">Design notebook & Aseprite artbook</button>
      </div>`;

    const shaderEl = menu.querySelector<HTMLCanvasElement>('#robin-start-shader');
    if (shaderEl) {
      startShader?.unmount();
      startShader = new ExposureGrid({
        canvas: shaderEl,
        phaseTheme: state.phase,
        intensity: 0.65,
      });
      startShader.mount();
    }

    const carouselHost = menu.querySelector<HTMLElement>('#start-apple-carousel');
    if (carouselHost) {
      startCarousel?.unmount();
      startCarousel = new AppleCarousel({
        container: carouselHost,
        items: buildShowcaseCarouselItems(),
        autoplayDurationMs: 4200,
      });
      startCarousel.mount();
    }

    updateLoading();
  }

  function updateLoading() {
    const root = $('#start-screen');
    if (!root || root.hidden) return;
    const label = root.querySelector<HTMLElement>('[data-load-label]'),
      progress = root.querySelector('progress'),
      start = root.querySelector<HTMLButtonElement>('[data-action="resume"]'),
      retry = root.querySelector<HTMLButtonElement>('[data-action="retry-assets"]');
    if (progress) {
      progress.value = loadingCount;
      progress.hidden = assetsReady;
    }
    if (start) start.disabled = !assetsReady;
    if (retry) retry.hidden = !assetFailures.length;
    if (label)
      label.textContent = assetFailures.length
        ? 'Some artwork could not load. Tap Retry.'
        : assetsReady
          ? 'The neighborhood is ready on Robinhood Chain'
          : `Opening the neighborhood… ${loadingCount}/${GAME_IMAGES.length}`;
  }

  function warmAssets() {
    if (loadingPromise) return loadingPromise;
    assetsReady = false;
    assetFailures = [];
    loadingCount = 0;
    updateLoading();
    loadingPromise = preloadGameImages((count) => {
      loadingCount = count;
      updateLoading();
    })
      .then((result) => {
        assetFailures = result.failed;
        assetsReady = !assetFailures.length;
        updateLoading();
      })
      .finally(() => (loadingPromise = null));
    return loadingPromise;
  }

  function gameMenu() {
    cancelMapGesture();
    cancelDrag();
    dismissPhase();
    if (get('#modal').open) closeModal();
    menuOpen = true;
    render();
    requestAnimationFrame(() =>
      $('#start-screen [data-action="resume"]')?.focus({ preventScroll: true }),
    );
  }

  function audioSettings() {
    const a = gameAudio.getSettings();
    modal(
      'Audio & Tabletop View',
      `<div class="settings-switches">
        <button class="setting-switch" data-action="music" id="music-toggle" aria-pressed="${a.music}">
          <span><strong>♫ Robin-Town Lo-Fi Radio</strong><small>Synthesized score shifts with each phase</small></span>
          <b data-audio-state></b>
        </button>
        <button class="setting-switch" data-action="sound" id="sound-toggle" aria-pressed="${a.sfx}">
          <span><strong>♪ Tabletop & Neighbor Sounds</strong><small>Stool taps, shop openings, bargaining voices</small></span>
          <b data-audio-state></b>
        </button>
        <button class="setting-switch" data-action="cycle-view">
          <span><strong>◈ Board Camera Perspective</strong><small>Switch between 2D Flat, 3D Tabletop Tilt, and 3D City</small></span>
          <b>${viewMode === '2d' ? '2D Flat' : viewMode === 'tabletop-3d' ? '3D Tilt' : '3D City'} ⇄</b>
        </button>
      </div>
      <p class="audio-note">Preferences save automatically in your browser.</p>
      <div class="modal-actions"><button class="primary" data-action="close">Done ✓</button></div>`,
      'ROBIN TOWN · SETTINGS',
    );
    get('#modal').dataset.settings = 'true';
    updateSoundButton();
  }

  function openWifHub() {
    if (!onChainProof) refreshOnChainProof();
    const wState = wallet.getState();
    const simAccounts = wallet.getSimulatedAccounts();
    const activeAddr = wState.account?.address ?? '';
    const activeBal = Math.floor(activeWalletBalance());
    const swapQuote = calculatePointSwap(townPoints);
    const roomSnap = activeRoom?.state;
    const connectedPeers = roomSnap?.players.filter((p) => p.connected) ?? [];
    const wsActive = activeRoom?.isCloudRelayActive() ?? false;

    modal(
      '$wif Flywheel, Wallet & Online Rooms',
      `<div class="wif-hub-grid">
        <div class="wif-stat-box"><small>🔥 Burned Forever</small><strong>${flywheel.totalBurned.toLocaleString('en-US')} $wif</strong></div>
        <div class="wif-stat-box"><small>🏦 Staking Vault</small><strong>${flywheel.totalStakingYield.toLocaleString('en-US')} $wif</strong></div>
        <div class="wif-stat-box"><small>🏆 Podium Paid</small><strong>${flywheel.totalPrizesDisbursed.toLocaleString('en-US')} $wif</strong></div>
        <div class="wif-stat-box"><small>🌾 Town Points</small><strong>${townPoints.toLocaleString('en-US')} pts</strong></div>
      </div>

      <section class="wif-hub-section">
        <h3>1. Dual-Mode Wallet & Official $wif ERC-20 (${ROBINHOOD_CHAIN_NAME} · Chain ID ${ROBINHOOD_CHAIN_ID})</h3>
        <p>Play immediately with pre-funded accounts (0 $wif required to enter) or connect an EIP-1193 wallet with ERC-20 <code>$wif</code> (<a href="${WIF_BLOCKSCOUT_TOKEN_URL}" target="_blank" rel="noopener"><code>${WIF_TOKEN_CONTRACT_ADDRESS.slice(0, 8)}…${WIF_TOKEN_CONTRACT_ADDRESS.slice(-4)}</code></a> on Mainnet Chain ID ${ROBINHOOD_MAINNET_CHAIN_ID}).</p>
        <div class="wif-row-actions" style="margin-bottom:8px">
          ${simAccounts
            .map(
              (acc) =>
                `<button type="button" class="wif-sim-pill ${wState.mode === 'simulation' && acc.address === activeAddr ? 'active' : ''}" data-action="select-sim-wallet" data-address="${acc.address}">${escape(acc.name)} · ${Math.floor(effectiveAccountBalance(acc.address, acc.balance)).toLocaleString('en-US')} $wif</button>`,
            )
            .join('')}
        </div>
        <div class="wif-row-actions">
          <button type="button" class="secondary" data-action="connect-web3">${wState.mode === 'web3' && wState.status === 'connected' ? `Connected: ${activeAddr.slice(0, 8)}…` : 'Connect Web3 Wallet (Chain 46631)'}</button>
          <span class="muted" style="font-size:12px">Active Balance: <strong>${activeBal.toLocaleString('en-US')} $wif</strong></span>
          ${
            onChainProof
              ? `<span class="robin-chain-pill" style="font-size:11px">● On-Chain Block #${onChainProof.mainnetBlockNumber.toLocaleString('en-US')} · <a href="${BURN_EXPLORER_URL}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">${Math.round(onChainProof.burnedDeadBalanceWif).toLocaleString('en-US')} $wif burned on 0x…dEaD</a></span>`
              : `<button type="button" class="artbook-link" data-action="refresh-onchain" style="font-size:11px">Verify live Robinhood Chain RPC</button>`
          }
        </div>
      </section>

      <section class="wif-hub-section">
        <h3>2. $wif Staking Yield Boost (1.20x Shop Paydays)</h3>
        <p>Lock 500 $wif in the neighborhood Staking Vault to multiply all your annual storefront paydays by <strong>1.20x</strong>.</p>
        <div class="wif-row-actions">
          <button type="button" class="primary" data-action="toggle-stake">${isStaked() ? 'Unstake 500 $wif (Active 1.20x)' : 'Stake 500 $wif -> Activate 1.20x Boost'}</button>
          <span class="muted" style="font-size:12px">${isStaked() ? 'Staked: 500 $wif earning boosted street yield' : 'Currently unstaked (1.00x base yield)'}</span>
        </div>
      </section>

      <section class="wif-hub-section">
        <h3>3. Swap Casual Town Points to $wif (3% Deflationary Burn)</h3>
        <p>Earn Town Points from every deal and year-end harvest in Casual Mode, then redeem points for $wif (10 pts = 1 $wif, 3% burned to <code>${BURN_ADDRESS.slice(0, 10)}…dEaD</code>).</p>
        <div class="wif-row-actions">
          <button type="button" class="primary" data-action="swap-points" ${swapQuote.netWif <= 0 ? 'disabled' : ''}>Swap ${townPoints} pts -> +${swapQuote.netWif} $wif (Burn ${swapQuote.burnedWif} $wif)</button>
          <button type="button" class="secondary" data-action="vote-burn">🔥 Burn 100 $wif Community Vote (${communityVotes} cast)</button>
        </div>
      </section>

      <section class="wif-hub-section">
        <h3>4. Cross-Device Online Multiplayer Room Lobby (WebSocket + P2P)</h3>
        <p>Create a 6-character room code or share an invite link so players on separate laptops, phones, or tabs join the same lobby over live WebSocket relay.</p>
        <div class="wif-row-actions">
          <button type="button" class="secondary" data-action="create-room">Create Room Code</button>
          <input id="join-room-input" class="room-code-input" type="text" maxlength="6" placeholder="CODE6X" value="${activeRoomCode ?? ''}" aria-label="6-character room code" />
          <button type="button" class="secondary" data-action="join-room">Join Room</button>
          ${activeRoomCode ? `<button type="button" class="secondary" data-action="copy-room-link">Copy Invite Link</button>` : ''}
        </div>
        ${
          activeRoomCode
            ? `<div class="wif-row-actions" style="margin-top:8px">
                <span class="robin-chain-pill">Room ${activeRoomCode} · ${connectedPeers.length || 1}/4 Players · ${wsActive ? '● Cloud WebSocket Live' : '● Local P2P Ready'}</span>
                <span class="muted" style="font-size:12px">Seats: ${connectedPeers.map((p) => `${escape(p.name)} (Seat ${(p.seat ?? 0) + 1}${p.isReady ? ' ✓' : ''})`).join(', ') || 'Waiting for players'}</span>
                ${
                  activeRoom?.isLocalHost()
                    ? `<button type="button" class="primary" data-action="start-online-room">Launch Online Table ▶</button>`
                    : `<button type="button" class="secondary" data-action="toggle-room-ready">${activeRoom?.getLocalPlayer()?.isReady ? 'Ready ✓' : 'Mark Ready'}</button>`
                }
              </div>`
            : ''
        }
      </section>

      <div class="modal-actions"><button class="primary" data-action="close">Back to Robin-Town ✓</button></div>`,
      'ROBINHOOD CHAIN · $WIF ECONOMIC ENGINE',
    );
    get('#modal').dataset.wifHub = 'true';
  }

  function yearBook() {
    modal(
      'Six Zodiac Years in Robin-Town',
      `<div class="year-list">${ZODIAC.map((z, i) => `<button class="${i + 1 === state.year ? 'current' : ''}" data-action="year-info" data-year="${i + 1}">${zodiacSprite(i)}<span>Year ${i + 1} · ${z[0]}</span><span>${i + 1 === state.year ? 'Now' : i + 1 < state.year ? '✓' : ''}</span></button>`).join('')}</div>`,
      'THE ROBIN-TOWN CALENDAR',
    );
  }

  function updateGuides() {
    document
      .querySelectorAll<HTMLElement>('.guide-target')
      .forEach((e) => e.classList.remove('guide-target'));
    const selector = {
      receive:
        chosen.length === state.draftCount ? '[data-action="claim"]' : '.lot.offered:not(.picked)',
      trade: '.player-pocket:not(.your-pocket) .pocket-main',
      build: selectedShop === null ? '.shop-piece:not(.depleted)' : '.lot.buildable',
      income: '[data-action="next"]',
      ended: '[data-action="results"]',
    }[state.phase];
    document.querySelectorAll(selector).forEach((e) => e.classList.add('guide-target'));
  }

  function showPhase() {
    clearTimeout(phaseDelay);
    if (view !== 'play' || menuOpen || get('#modal').open) return;
    clearTimeout(phaseTimer);
    const descriptions: Record<GamePhase, string> = {
      receive: `Choose ${state.draftCount} glowing addresses. Place your green stools, then keep your selection.`,
      trade:
        'Tap a neighbor or one of their plots. Offer $wif, plots, or shop tiles to bargain for missing pieces.',
      build:
        'Pick a shop from your rack and tap your empty plot, drag it straight onto the street, or tap your plot for quick build.',
      income:
        'Every business has paid its owner in $wif. Start the next zodiac year whenever you are ready.',
      ended:
        'The sixth payday is complete! Open the final standings to settle your $wif rewards.',
    };
    get('#phase-cue').innerHTML =
      `<section class="phase-announcement"><button data-action="dismiss-phase" class="close" aria-label="Dismiss guide">×</button><small>YEAR ${state.year} · ${ZODIAC[state.year - 1][0]}</small><h2>${phaseName()}</h2><p>${descriptions[state.phase]}</p>${state.phase === 'receive' ? `<div class="deal-reels">${state.pending.map((id, i) => `<span style="--deal-delay:${i * 90}ms"><b>${id + 1}</b></span>`).join('')}</div>` : state.phase === 'build' ? `<div class="cue-sprites">${sprite('shops', 'coffee')}${sprite('shops', 'banhmi')}${sprite('shops', 'pho')}</div>` : state.phase === 'trade' ? `<div class="cue-tokens">${token(0)}<b>⇄</b>${token(1)}</div>` : ''}<button class="primary" data-action="dismiss-phase">Let us go →</button><div class="cue-countdown"></div></section>`;
    get('#phase-cue').classList.add('show');
    playSound('phase');
    phaseTimer = setTimeout(dismissPhase, 6500);
  }

  function dismissPhase() {
    clearTimeout(phaseTimer);
    clearTimeout(phaseDelay);
    $('#phase-cue')?.classList.remove('show');
  }

  function animateYear() {
    playSound('year');
    if (reducedMotion()) return;
    $('.calendar-sheet')?.animate(
      [
        { transform: 'perspective(350px) rotateX(-45deg)', filter: 'brightness(1.35)' },
        { transform: 'perspective(350px) rotateX(0deg)', filter: 'brightness(1)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }

  function clickLot(id: number) {
    dismissPhase();
    if (state.phase === 'receive') {
      if (!state.pending.includes(id)) {
        selectedLot = id;
        render();
        return;
      }
      selectedLot = null;
      if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
      else if (chosen.length < state.draftCount) {
        chosen.push(id);
        freshLots = [id];
        playSound('place');
      } else toast(`Keep ${state.draftCount} addresses. Lift a stool first.`);
      render();
      scheduleFreshClear();
      return;
    }
    if (state.phase === 'build' && selectedShop !== null && canPlace(state, 0, id, selectedShop)) {
      buildPiece(id, selectedShop);
      return;
    }
    selectedLot = id;
    render();
  }

  function buildPiece(id: number, shop: number) {
    const before = income(state, 0, isStaked());
    placeShop(state, id, shop);
    selectedLot = null;
    freshLots = [id];
    townPoints += 10;
    playSound('build');
    if (!state.players[0].tiles[shop]) selectedShop = null;
    changed();
    scheduleFreshClear();
    const g = groups(state, 0).find((grp) => grp.lots.includes(id));
    toast(
      `${SHOPS[shop].name} · ${g?.size ?? 1}/${SHOPS[shop].size} connected · +${income(state, 0, isStaked()) - before} $wif/yr`,
    );
    return { id, shop, annualIncome: income(state, 0, isStaked()) };
  }

  function scheduleFreshClear() {
    clearTimeout(freshTimer);
    freshTimer = setTimeout(() => {
      freshLots = [];
      document.querySelectorAll<HTMLElement>('.fresh').forEach((el) => el.classList.remove('fresh'));
    }, 1800);
  }

  function updateSoundButton() {
    const a = gameAudio.getSettings();
    for (const [selector, on, label] of [
      ['#music-toggle', a.music, 'Music'],
      ['#sound-toggle', a.sfx, 'Game sounds'],
    ] as const) {
      const el = $(selector);
      if (!el) continue;
      el.setAttribute('aria-pressed', String(on));
      el.setAttribute('aria-label', `${label}: ${on ? 'on' : 'off'}`);
      const stateLabel = el.querySelector<HTMLElement>('[data-audio-state]');
      if (stateLabel) stateLabel.textContent = on ? 'On' : 'Off';
    }
  }

  function playSound(kind: SoundEffect = 'tap') {
    gameAudio.play(kind);
  }

  function animateWallets() {
    if (!payout) return;
    cancelAnimationFrame(cashFrame);
    const p = payout,
      elapsed = performance.now() - p.start,
      t = reducedMotion() ? 1 : Math.min(1, Math.max(0, (elapsed - 350) / 1600)),
      ease = 1 - Math.pow(1 - t, 3);
    state.players.forEach((player, i) => {
      const el = $(`[data-wallet="${i}"]`);
      if (el) {
        el.innerHTML = money(Math.round(p.before[i] + (player.cash - p.before[i]) * ease));
        el.classList.toggle('wallet-counting', t < 1);
      }
    });
    if (t < 1) cashFrame = requestAnimationFrame(animateWallets);
    else payout = null;
  }

  function celebratePayday(before: number[]) {
    dismissPhase();
    payout = { before, start: performance.now() };
    playSound('income');
    animateWallets();
    const fx = get('#effects');
    fx.innerHTML = '';
    if (!reducedMotion())
      state.players.forEach((_, i) => {
        const to = $(`[data-wallet="${i}"]`)?.getBoundingClientRect();
        if (!to) return;
        const sources = holdings(state, i)
          .filter((l) => l.shop !== null)
          .slice(0, 5);
        sources.forEach((l, n) => {
          const r = $(`[data-lot="${l.id}"]`)?.getBoundingClientRect();
          if (!r) return;
          const el = document.createElement('div');
          el.className = 'flying-note';
          el.innerHTML = sprite('life', 'game-banknote');
          fx.append(el);
          const sx = r.x + r.width / 2,
            sy = r.y + r.height / 2,
            tx = to.x + to.width / 2,
            ty = to.y + to.height / 2;
          const anim = el.animate(
            [
              { transform: `translate(${sx}px,${sy}px) rotate(-18deg) scale(.6)`, opacity: 0 },
              {
                offset: 0.18,
                transform: `translate(${sx}px,${sy - 40}px) rotate(8deg) scale(1.1)`,
                opacity: 1,
              },
              { transform: `translate(${tx}px,${ty}px) rotate(0) scale(.5)`, opacity: 0 },
            ],
            {
              duration: 1500,
              delay: n * 100 + i * 70,
              easing: 'cubic-bezier(.3,.1,.4,1)',
              fill: 'both',
            },
          );
          anim.onfinish = () => el.remove();
        });
      });
    const banner = document.createElement('div');
    banner.className = 'payday-banner';
    banner.innerHTML = `<small>YEAR-END $WIF PAYDAY</small><strong>+${state.lastIncome[0]} $wif</strong><span>${isStaked() ? '1.20x $wif Staking Boost applied!' : 'Your storefronts are paying off'}</span>`;
    fx.append(banner);
    setTimeout(() => banner.remove(), 3200);
  }

  function openTrade(prefillLot: number | null = null, prefillShop: number | null = null) {
    if (state.phase !== 'trade')
      return toast('Trading opens right after you claim your addresses.');
    if (prefillLot !== null) partner = state.lots[prefillLot].owner ?? partner;
    trading.open(partner, prefillLot, prefillShop);
  }

  function playerInfo(id: number) {
    const p = state.players[id];
    modal(
      id === 0 ? 'Your inventory.' : `${p.name} · Inventory`,
      `<div class="neighbor-summary">${token(p.id)}<strong>${money(p.cash)}</strong><span>${holdings(state, id).length} plots · ${income(state, id, isStaked())} $wif/yr</span></div><p>${id === 0 ? 'Choose a shop piece to place during the Build phase.' : state.phase === 'trade' ? 'Tap any shop below to start a $wif bargain for that piece.' : 'Unused shop pieces held by this neighbor. Bargain for them during Trade.'}</p><div class="neighbor-shop-grid">${SHOPS.map((s, i) => `<button data-action="glance-shop" data-player="${id}" data-shop-index="${i}" ${p.tiles[i] === 0 ? 'disabled' : ''}>${sprite('shops', SPRITES[i])}<strong>${s.name} ×${p.tiles[i]}</strong><small>${s.size} tiles → ${COMPLETE[s.size]} $wif</small></button>`).join('')}</div><p class="mini-label">ADDRESSES</p><div class="neighbor-lots">${
        holdings(state, id)
          .map(
            (l) =>
              `<button data-action="inspect-player-lot" data-id="${l.id}">${l.shop !== null ? sprite('shops', SPRITES[l.shop]) : token(id)}<b>${l.id + 1}</b></button>`,
          )
          .join('') || 'None yet.'
      }</div>${state.phase === 'trade' && id !== 0 ? `<button class="primary wide" data-action="trade-player" data-player="${id}">Bargain with ${p.name} ⇄</button>` : ''}${id === 0 ? `<button class="secondary wide" data-action="businesses">Business ledger</button>` : ''}`,
    );
  }

  function rules() {
    modal(
      'Build a corner worth coming back to.',
      `<p>You and three neighbors (Cole, Maya, and Clara) have six zodiac years to grow a thriving commercial district on Robinhood Chain. Most $wif after Year 6 wins.</p>
      <ol>
        <li><strong>Receive.</strong> Choose from your glowing offered addresses (${KEEP.join(', ')} plots in years 1 to 6) and draw shop tiles (5 in year 1, then 4 each year).</li>
        <li><strong>Trade.</strong> Bargain freely with neighbors using $wif cash, empty plots, built shops, and unused shop tiles. A 1% micro-fee on $wif cash transfers feeds the Staking Vault.</li>
        <li><strong>Build.</strong> Place shop tiles onto your own empty plots for free. Drag from the rack or tap a plot for the quick build menu.</li>
        <li><strong>Payday & $wif Flywheel.</strong> Connected shops of the same type and stool color pay $wif every year (boosted 1.20x when you stake 500 $wif in the Hub).</li>
      </ol>
      <h3>Annual Storefront Yield Table</h3>
      <table><thead><tr><th>Connected Tiles</th><th>Growing Group</th><th>Complete Set</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map((n) => `<tr><td>${n}</td><td>${n === 6 ? 'n/a' : INCOMPLETE[n] + ' $wif'}</td><td>${n >= 3 ? COMPLETE[n] + ' $wif' : 'n/a'}</td></tr>`).join('')}</tbody></table>
      <p class="rules-note">Casual Mode requires zero $wif to enter and awards Town Points swappable for $wif (3% burn). Ranked Mode pools 4,000 $wif (90% podium, 5% burned to 0x…dEaD, 5% to Staking Vault).</p>
      <button class="primary wide" data-action="close">Back to Robin-Town</button>`,
      'HOW TO PLAY · ROBIN TOWN',
    );
  }

  function incomeModal() {
    modal(
      'This year $wif earnings.',
      `<p>Every business in the neighborhood has paid its owner.</p>${state.players.map((p, i) => `<div class="score-row">${token(i)}<span>${i === 0 ? 'You' : escape(p.name)}</span><strong>+${money(state.lastIncome[i] ?? 0)}</strong><span class="muted">Total ${p.cash} $wif</span></div>`).join('')}<div class="modal-actions"><button class="primary" data-action="${state.phase === 'ended' ? 'results' : 'next'}">${state.phase === 'ended' ? 'Final standings' : 'Begin year ' + (state.year + 1)} →</button></div>`,
      phaseName('income'),
    );
  }

  function settleMatchFlywheelIfNeeded(rankedOrder: number[]) {
    if (state.matchSettled) return null;
    state.matchSettled = true;
    const bonusPoints = Math.max(50, state.players[0].cash);
    townPoints += bonusPoints;
    let rankedPayout = 0;
    let burned = 0;
    if (state.entryMode === 'ranked') {
      const pool = calculateMatchPayouts(DEFAULT_FLYWHEEL_CONFIG.buyInAmount, rankedOrder);
      flywheel = applyMatchPayouts(flywheel, pool);
      rankedPayout = pool.payouts[0] ?? 0;
      burned = pool.burnedAmount;
      if (rankedPayout > 0) adjustActiveWalletBalance(rankedPayout);
    }
    save();
    return { bonusPoints, rankedPayout, burned };
  }

  function results() {
    const ranked = rankings(state),
      top = ranked[0].cash,
      topTiles = state.lots.filter((l) => l.owner === ranked[0].id && l.shop !== null).length,
      winners = ranked.filter(
        (p) =>
          p.cash === top &&
          state.lots.filter((l) => l.owner === p.id && l.shop !== null).length === topTiles,
      );
    const settlement = settleMatchFlywheelIfNeeded(ranked.map((p) => p.id));
    const swapPreview = calculatePointSwap(townPoints);

    modal(
      winners.length > 1
        ? 'A shared neighborhood victory!'
        : ranked[0].id === 0
          ? 'Robin-Town is yours!'
          : `${escape(ranked[0].name)} wins the six-year crown!`,
      `<p>All six zodiac paydays are counted on Robinhood Chain.</p>
      ${ranked.map((p, i) => `<div class="score-row ${winners.some((w) => w.id === p.id) ? 'winner' : ''}"><span>${i + 1}</span>${token(p.id)}<span>${p.id === 0 ? 'You' : escape(p.name)}</span><strong>${money(p.cash)}</strong></div>`).join('')}
      <div class="wif-hub-section" style="margin-top:12px">
        <h3>$wif Flywheel Settlement</h3>
        <p>${
          state.entryMode === 'ranked'
            ? `Ranked 4,000 $wif Pool settled: 200 $wif permanently burned, 200 $wif sent to Staking Vault.${settlement && settlement.rankedPayout > 0 ? ` You won +${settlement.rankedPayout.toLocaleString('en-US')} $wif!` : ''}`
            : `You earned Town Points from your ${state.players[0].cash} $wif street empire! Total redeemable: ${townPoints} pts (+${swapPreview.netWif} $wif net, ${swapPreview.burnedWif} $wif burned).`
        }</p>
        <div class="wif-row-actions">
          <button type="button" class="secondary" data-action="wif-hub">Open $wif Hub & Swap Points</button>
        </div>
      </div>
      <p class="muted">You completed ${state.trades} trades and earned ${income(state, 0, isStaked())} $wif/yr in Year 6.</p>
      <div class="modal-actions"><button class="secondary" data-action="close">Explore the town</button><button class="primary" data-action="new">Play again</button></div>`,
      'SIX YEARS · FINAL $WIF STANDINGS',
    );
  }

  function shopEntry(g: ShopGroup, index: number) {
    const shop = SHOPS[g.shop],
      target = shop.size,
      completed = Math.floor(g.size / target),
      remainder = g.size % target,
      earned = groupIncome(g.shop, g.size);
    return `<article class="ledger-entry"><div class="entry-illustration">${sprite('shops', SPRITES[g.shop])}<span>${String(index + 1).padStart(2, '0')}</span></div><div class="entry-writing"><div class="entry-title"><h3>${shop.name}</h3><strong>${earned}<small> $wif/yr</small></strong></div><p class="entry-address">${DISTRICTS[Math.floor(g.lots[0] / 12)]} · Plots ${g.lots.map((x) => x + 1).join(', ')}</p><div class="entry-progress"><span>${g.size} / ${target} connected</span><span class="ink-stamp ${completed ? 'complete' : ''}">${completed ? 'COMPLETE' : 'GROWING'}</span></div><p class="entry-note">${completed ? `${completed} complete set${completed > 1 ? 's' : ''}${remainder ? ' + ' + remainder + ' extra tiles' : ''}.` : `Add ${target - g.size} matching connected tile${target - g.size > 1 ? 's' : ''} to earn ${COMPLETE[target]} $wif/year.`}</p></div></article>`;
  }

  function businesses(page = 0) {
    const all = groups(state, 0),
      count = Math.max(1, Math.ceil(all.length / 6));
    ledgerPage = Math.max(0, Math.min(count - 1, page));
    const start = ledgerPage * 6,
      spread = all.slice(start, start + 6),
      left = spread.slice(0, 3),
      right = spread.slice(3),
      total = income(state, 0, isStaked());
    modal(
      'Your shop ledger',
      `<div class="ledger-binding"><span class="book-ribbon" aria-hidden="true"></span><div class="book-spread"><section class="book-page left-page"><div class="page-heading"><span>ROBIN TOWN</span><span>YEAR ${state.year}</span></div>${ledgerPage === 0 ? `<div class="ledger-book-title"><small>THE NEIGHBORHOOD ACCOUNTS</small><h2>Your shop ledger</h2><p>Storefronts, street addresses & annual $wif yield</p></div>` : `<h2 class="ledger-continuation">The accounts continue…</h2>`}${left.map((g, i) => shopEntry(g, start + i)).join('') || `<div class="empty-ledger">${sprite('shops', 'coffee')}<h3>A blank page. A new beginning.</h3><p>Open a shop on one of your plots. Its street address and annual $wif income will be recorded here.</p></div>`}<span class="page-number">${ledgerPage * 2 + 1}</span></section><section class="book-page right-page"><div class="page-heading"><span>BUSINESS INCOME</span><span>Ledger 01</span></div>${right.map((g, i) => shopEntry(g, start + 3 + i)).join('')}${right.length < 3 ? `<div class="book-margin-note"><strong>A note for tomorrow</strong><p>Matching shops of your stool color must share an edge inside the same district block. Roads and diagonal corners do not connect.</p><p>Stake 500 $wif in the Hub to multiply all annual shop payouts by 1.20x.</p></div>` : ''}<div class="ledger-tally"><span>ALL YOUR SHOPS · EACH YEAR${isStaked() ? ' (1.20X STAKED)' : ''}</span><strong>${total}<small> $wif</small></strong><div>${all.length} business groups · ${holdings(state, 0).filter((l) => l.shop !== null).length} placed pieces</div></div><div class="ledger-signature">Recorded on Robinhood Chain</div><span class="page-number">${ledgerPage * 2 + 2}</span></section></div></div><nav class="book-navigation" aria-label="Ledger pages"><button data-action="ledger-prev" class="book-tab" ${ledgerPage === 0 ? 'disabled' : ''}>← Previous</button><span>${ledgerPage + 1} / ${count}</span><button data-action="ledger-next" class="book-tab" ${ledgerPage === count - 1 ? 'disabled' : ''}>Next →</button></nav>`,
      'THE SHOPKEEPER LEDGER',
    );
    get('#modal').classList.add('ledger-dialog');
  }

  function startFreshSession() {
    if (selectedEntryMode === 'ranked') {
      const ok = adjustActiveWalletBalance(-DEFAULT_FLYWHEEL_CONFIG.buyInAmount);
      if (!ok) {
        toast('Need at least 1,000 $wif in wallet for Ranked Arena. Switch wallet or play Casual.');
        return;
      }
      toast('1,000 $wif buy-in locked! 4,000 $wif Ranked Arena pot is live.');
    }
    cancelAnimationFrame(cashFrame);
    payout = null;
    get('#effects').innerHTML = '';
    state = newGame(Math.random, selectedEntryMode);
    observedPhase = '';
    selectedLot = null;
    selectedShop = null;
    chosen = [];
    freshLots = [];
    cameraInitialized = false;
    cameraScale = null;
    rackOpen = false;
    view = 'play';
    menuOpen = false;
    sessionStarted = true;
    closeModal();
    changed();
    requestAnimationFrame(() => {
      $('.map-viewport')?.focus({ preventScroll: true });
      showPhase();
    });
  }

  function act(action: string | undefined, el?: HTMLElement) {
    const data = el?.dataset ?? {};
    switch (action) {
      case 'close':
        closeModal();
        break;
      case 'play':
        view = 'play';
        gameMenu();
        break;
      case 'select-entry':
        selectedEntryMode = data.entryMode === 'ranked' ? 'ranked' : 'casual';
        renderStartMenu();
        break;
      case 'resume':
        if (!assetsReady) return;
        void gameAudio.unlock();
        if (!hasProgress()) {
          startFreshSession();
          return;
        }
        menuOpen = false;
        sessionStarted = true;
        view = 'play';
        render();
        requestAnimationFrame(() => {
          $('.map-viewport')?.focus({ preventScroll: true });
          showPhase();
        });
        break;
      case 'retry-assets':
        void warmAssets();
        break;
      case 'research':
        closeModal();
        menuOpen = false;
        get('#start-screen').hidden = true;
        document.body.classList.remove('menu-open');
        view = 'research';
        render();
        window.scrollTo({ top: 0 });
        break;
      case 'set-view': {
        const mode = data.viewMode;
        if (mode === '2d' || mode === 'tabletop-3d' || mode === 'city-3d') {
          setViewMode(mode);
        }
        break;
      }
      case 'view-toggle':
        toggleViewMode();
        break;
      case 'cycle-view': {
        const order: BoardViewMode[] = ['2d', 'tabletop-3d', 'city-3d'];
        setViewMode(order[(order.indexOf(viewMode) + 1) % order.length]);
        audioSettings();
        break;
      }
      case 'set-3d-preset': {
        const preset = data.preset as CameraPresetMode | undefined;
        if (
          preset === 'neighborhood' ||
          preset === 'isometric' ||
          preset === 'street' ||
          preset === 'topdown'
        ) {
          cameraPreset3D = preset;
          board3D?.setCameraPreset(preset);
          $('.three-city-stage')
            ?.querySelectorAll<HTMLButtonElement>('button[data-action="set-3d-preset"]')
            .forEach((btn) => {
              btn.classList.toggle('active', btn.dataset.preset === cameraPreset3D);
            });
        }
        break;
      }
      case 'reset-3d-camera':
        cameraPreset3D = 'neighborhood';
        board3D?.setCameraPreset('neighborhood');
        board3D?.resetCamera();
        $('.three-city-stage')
          ?.querySelectorAll<HTMLButtonElement>('button[data-action="set-3d-preset"]')
          .forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.preset === 'neighborhood');
          });
        break;
      case 'set-3d-atmo': {
        const atmo = data.atmo as CityAtmosphereMode | undefined;
        if (atmo === 'day' || atmo === 'sunset' || atmo === 'night') {
          atmosphere3D = atmo;
          board3D?.setAtmosphere(atmo);
          try {
            localStorage.setItem(ATMO_3D_KEY, atmo);
          } catch {}
          $('.three-city-stage')
            ?.querySelectorAll<HTMLButtonElement>('button[data-action="set-3d-atmo"]')
            .forEach((btn) => {
              btn.classList.toggle('active-atmo', btn.dataset.atmo === atmosphere3D);
            });
        }
        break;
      }
      case 'toggle-ipod':
        ipodOpen = !ipodOpen;
        render();
        break;
      case 'wif-hub':
        openWifHub();
        break;
      case 'select-sim-wallet':
        if (data.address) {
          const targetAddress = data.address;
          void wallet.setMode('simulation').then(async () => {
            await wallet.switchAccount(targetAddress);
            saveEconomy();
            openWifHub();
            render();
          });
        }
        break;
      case 'connect-web3':
        void wallet.setMode('web3').then(async () => {
          await wallet.connect();
          const st = wallet.getState();
          if (st.status !== 'connected') {
            wallet.setMode('simulation');
            toast('No browser Web3 wallet detected. Using instant Simulation Wallet.');
          } else {
            toast(`Connected to ${ROBINHOOD_CHAIN_NAME}!`);
          }
          saveEconomy();
          if (get('#modal').dataset.wifHub === 'true') openWifHub();
          render();
        });
        break;
      case 'toggle-stake':
        if (isStaked()) {
          adjustActiveWalletBalance(500);
          stakedWif = 0;
          toast('Unstaked 500 $wif from Vault.');
        } else {
          if (!adjustActiveWalletBalance(-500)) {
            toast('Need 500 $wif in active wallet to activate 1.20x Staking Boost.');
            break;
          }
          stakedWif = 500;
          toast('Staked 500 $wif! All your annual shop paydays now earn 1.20x $wif.');
        }
        saveEconomy();
        openWifHub();
        render();
        break;
      case 'swap-points': {
        const res = calculatePointSwap(townPoints);
        if (res.netWif <= 0) {
          toast('Earn at least 20 Town Points to swap for $wif.');
          break;
        }
        flywheel = applyPointSwap(flywheel, res);
        townPoints = 0;
        adjustActiveWalletBalance(res.netWif);
        saveEconomy();
        toast(`Swapped points for +${res.netWif} $wif (${res.burnedWif} $wif burned to 0x…dEaD)!`);
        openWifHub();
        render();
        break;
      }
      case 'vote-burn':
        if (!adjustActiveWalletBalance(-100, true)) {
          toast('Need 100 $wif in wallet to cast a Community Burn Vote.');
          break;
        }
        communityVotes += 1;
        flywheel = { ...flywheel, totalBurned: flywheel.totalBurned + 100 };
        saveEconomy();
        toast('🔥 100 $wif permanently burned for Robin-Town Community Vote!');
        openWifHub();
        render();
        break;
      case 'refresh-onchain':
        refreshOnChainProof();
        toast('Querying live Robinhood Chain RPC for $wif contract state…');
        break;
      case 'create-room': {
        const code = generateRoomCode();
        const wAcc = wallet.getState().account;
        const room = new NetworkRoom({
          roomCode: code,
          isHost: true,
          localPlayer: {
            name: wAcc?.name ?? 'You',
            address: wAcc?.address ?? '0x1000000000000000000000000000000000000001',
          },
        });
        bindRoomSession(room, code);
        toast(`Online Multiplayer Room ${code} created! Share the code or invite link.`);
        openWifHub();
        break;
      }
      case 'join-room': {
        const input = $('#join-room-input') as HTMLInputElement | null;
        const code = normalizeRoomCode(input?.value ?? '');
        if (!isValidRoomCode(code)) {
          toast('Enter a valid 6-character alphanumeric room code.');
          break;
        }
        const wAcc = wallet.getState().account;
        const room = new NetworkRoom({
          roomCode: code,
          isHost: false,
          localPlayer: {
            name: wAcc?.name ?? 'Trader',
            address: wAcc?.address ?? '0x1000000000000000000000000000000000000001',
          },
        });
        bindRoomSession(room, code);
        toast(`Connecting to Online Room ${code}…`);
        openWifHub();
        break;
      }
      case 'copy-room-link': {
        if (!activeRoomCode) break;
        const url = `${window.location.origin}/?room=${activeRoomCode}`;
        void navigator.clipboard?.writeText(url).catch(() => {});
        toast(`Copied invite link: ${url}`);
        break;
      }
      case 'toggle-room-ready': {
        if (!activeRoom) break;
        activeRoom.toggleReady();
        openWifHub();
        break;
      }
      case 'start-online-room': {
        if (!activeRoom) break;
        try {
          activeRoom.startMatch();
        } catch {
          // Even if a remote guest has not toggled ready yet, allow launching immediately
        }
        startFreshSession();
        toast(`Launched Online Room ${activeRoomCode ?? ''}!`);
        break;
      }
      case 'rules':
        rules();
        break;
      case 'sound':
        gameAudio.setSfx(!gameAudio.getSettings().sfx);
        void gameAudio.unlock().then(() => playSound());
        toast(gameAudio.getSettings().sfx ? '♪ Tap sounds on' : 'Tap sounds off');
        break;
      case 'music':
        gameAudio.setMusic(!gameAudio.getSettings().music);
        void gameAudio.unlock();
        toast(
          gameAudio.getSettings().music
            ? '♫ Robin-Town lo-fi radio on'
            : 'Music off',
        );
        syncIPodDock();
        break;
      case 'guide':
        if (get('#modal').open) closeModal();
        showPhase();
        break;
      case 'dismiss-phase':
        dismissPhase();
        updateGuides();
        break;
      case 'menu':
        gameMenu();
        break;
      case 'settings':
      case 'audio-settings':
        audioSettings();
        break;
      case 'rack':
        rackOpen = !rackOpen;
        render();
        break;
      case 'years':
        yearBook();
        break;
      case 'year-info': {
        const y = Number(data.year),
          z = ZODIAC[y - 1];
        modal(
          `Year ${y} · ${z[0]}`,
          `<div class="zodiac-detail">${zodiacSprite(y - 1)}<p>The year of the ${z[1].toLowerCase()}.</p></div><p>${y === state.year ? 'Your current neighborhood year.' : y < state.year ? 'This year is complete.' : 'Finish the current year to turn the next calendar page.'}</p><div class="year-rewards"><strong>${KEEP[y - 1]} <small>new plots</small></strong><span>+</span><strong>${y === 1 ? 5 : 4} <small>shop pieces</small></strong></div><p class="rules-note">Six successive zodiac animals from Snake through Dog.</p>`,
          'ZODIAC YEAR CYCLE',
        );
        break;
      }
      case 'player-info':
        playerInfo(Number(data.player));
        break;
      case 'glance-shop': {
        const id = Number(data.player),
          shop = Number(data.shopIndex);
        if (id === 0) {
          closeModal();
          selectedShop = shop;
          selectedLot = null;
          rackOpen = true;
          render();
          if (state.phase !== 'build') toast('You can place this piece during Build.');
        } else if (state.phase === 'trade') {
          partner = id;
          openTrade(null, shop);
        } else playerInfo(id);
        break;
      }
      case 'inspect-player-lot': {
        const id = Number(data.id);
        closeModal();
        if (state.phase === 'trade' && state.lots[id].owner !== 0) openTrade(id);
        else {
          selectedLot = id;
          render();
          focusLot(id);
        }
        break;
      }
      case 'trade-player':
        partner = Number(data.player);
        openTrade();
        break;
      case 'claim': {
        freshLots = [...chosen];
        claimPlots(state, chosen);
        chosen = [];
        selectedLot = null;
        townPoints += 10;
        changed();
        scheduleFreshClear();
        playSound('build');
        toast('Addresses claimed! Bargain with neighbors or head to Build.');
        break;
      }
      case 'trade':
        openTrade();
        break;
      case 'trade-lot':
        openTrade(Number(data.id));
        break;
      case 'build':
        modal(
          'All deals done for this year?',
          `<p>Starting Build closes the Bargaining Table for Year ${state.year}. Placed storefronts are permanent.</p><div class="modal-actions"><button class="secondary" data-action="close">Keep bargaining</button><button class="primary" data-action="confirm-build">Open the shops →</button></div>`,
          phaseName('build'),
        );
        break;
      case 'confirm-build':
        beginBuild(state);
        selectedLot = null;
        selectedShop = null;
        closeModal();
        changed();
        break;
      case 'quick-build': {
        const id = Number(data.id),
          shop = Number(data.index);
        if (state.lots[id].shop === null) buildPiece(id, shop);
        else {
          selectedShop = shop;
          selectedLot = null;
          render();
          toast('Tap one of your empty plots next to this business.');
        }
        break;
      }
      case 'place':
        if (selectedLot !== null && selectedShop !== null) buildPiece(selectedLot, selectedShop);
        break;
      case 'deselect':
        selectedLot = null;
        render();
        break;
      case 'collect': {
        const possible = holdings(state, 0).some((l) =>
          SHOPS.some((_, s) => canPlace(state, 0, l.id, s)),
        );
        if (possible)
          modal(
            'Collect this year $wif payday?',
            `<p>You still have empty plots and matching shop tiles in your rack. Unused tiles carry over to next year, or you can open more shops right now.</p><div class="modal-actions"><button class="secondary" data-action="close">Keep building</button><button class="primary" data-action="confirm-collect">Collect $wif income</button></div>`,
          );
        else act('confirm-collect');
        break;
      }
      case 'confirm-collect': {
        const built = new Set(state.lots.filter((l) => l.shop !== null).map((l) => l.id)),
          cash = state.players.map((p) => p.cash);
        finishYear(state, isStaked());
        townPoints += Math.max(15, Math.floor((state.lastIncome[0] ?? 0) / 2));
        freshLots = state.lots.filter((l) => l.shop !== null && !built.has(l.id)).map((l) => l.id);
        selectedLot = null;
        selectedShop = null;
        closeModal();
        changed();
        scheduleFreshClear();
        celebratePayday(cash);
        break;
      }
      case 'income':
        incomeModal();
        break;
      case 'next': {
        cancelAnimationFrame(cashFrame);
        payout = null;
        get('#effects').innerHTML = '';
        nextYear(state);
        chosen = [];
        selectedLot = null;
        selectedShop = null;
        closeModal();
        changed();
        break;
      }
      case 'results':
        results();
        break;
      case 'businesses':
        businesses();
        break;
      case 'ledger-prev':
        businesses(ledgerPage - 1);
        playSound('place');
        break;
      case 'ledger-next':
        businesses(ledgerPage + 1);
        playSound('place');
        break;
      case 'history':
        modal(
          'The Robin-Town Journal',
          `<ul class="history">${state.logs.map((l) => `<li>${escape(l)}</li>`).join('')}</ul>`,
        );
        break;
      case 'new':
        if (!assetsReady) {
          toast('Let the Aseprite artwork finish loading first.');
          break;
        }
        modal(
          'Start a fresh six-year town?',
          `<p>This replaces your current town progress in ${selectedEntryMode === 'ranked' ? 'Ranked 1,000 $wif Arena' : 'Casual Free Mode'}.</p><div class="modal-actions"><button class="secondary" data-action="close">Keep current town</button><button class="primary" data-action="confirm-new">Start fresh town</button></div>`,
        );
        break;
      case 'confirm-new':
        startFreshSession();
        break;
    }
  }

  function preserveControlFocus(el: HTMLElement) {
    if (document.activeElement !== document.body) return;
    for (const attr of ['data-lot', 'data-shop', 'data-action'])
      if (el.hasAttribute(attr)) {
        document
          .querySelector<HTMLElement>(`[${attr}="${el.getAttribute(attr)}"]`)
          ?.focus({ preventScroll: true });
        break;
      }
  }

  document.addEventListener('click', (e) => {
    if (eventElement(e)?.closest('.robin-ipod-scale') || eventElement(e)?.closest('.apple-carousel')) {
      return;
    }
    if (
      eventElement(e)?.closest<HTMLElement>('.map-viewport') &&
      (mapInput.blocksClick || performance.now() < mapTapBlockUntil)
    ) {
      e.preventDefault();
      return;
    }
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      return;
    }
    const barter = eventElement(e)?.closest<HTMLElement>('[data-bargain]');
    if (barter) {
      trading.handle(barter);
      return;
    }
    const el = eventElement(e)?.closest<HTMLElement>('[data-action],[data-lot],[data-shop]');
    if (!el || el.hasAttribute('disabled')) return;
    try {
      playSound('tap');
      if (el.dataset.lot !== undefined) {
        clickLot(Number(el.dataset.lot));
        if (el.classList.contains('address-slip')) focusLot(Number(el.dataset.lot));
      } else if (el.dataset.shop !== undefined) {
        dismissPhase();
        const shop = Number(el.dataset.shop);
        selectedShop = selectedShop === shop ? null : shop;
        selectedLot = null;
        if (selectedShop !== null && state.phase === 'build' && lastInputType === 'touch')
          rackOpen = false;
        render();
        if (state.phase !== 'build') toast('Keep this piece in mind for Build.');
        else if (state.players[0].tiles[shop] === 0) toast('You have none of this piece.');
      } else act(el.dataset.action, el);
      preserveControlFocus(el);
    } catch (error) {
      toast(errorMessage(error));
    }
  });

  function clearDrop() {
    document
      .querySelectorAll<HTMLElement>('.drop-target')
      .forEach((l) => l.classList.remove('drop-target'));
    board3D?.setDropTargetLot(null);
  }

  function cancelDrag() {
    drag = null;
    get('#drag-piece').className = '';
    get('#drag-piece').innerHTML = '';
    document.body.classList.remove('dragging');
    clearDrop();
  }

  function cancelMapGesture() {
    const ids = [...mapInput.points.keys()],
      vp = $('.map-viewport'),
      consumed = mapInput.clear(true);
    if (consumed) mapTapBlockUntil = performance.now() + 450;
    for (const id of ids)
      try {
        if (vp?.hasPointerCapture(id)) vp.releasePointerCapture(id);
      } catch {}
  }

  function mapPoint(e: MouseEvent, vp: HTMLElement) {
    const r = vp.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function applyMapCamera(next: Camera) {
    cameraScale = next.scale;
    cameraCenter = { x: next.x, y: next.y };
    fitMap();
  }

  document.addEventListener(
    'wheel',
    (e) => {
      if (viewMode === 'city-3d') return;
      const vp = eventElement(e)?.closest?.<HTMLElement>('.map-viewport');
      if (!vp || menuOpen || get('#modal').open) return;
      if (e.cancelable) e.preventDefault();
      if (drag || mapInput.blocksClick || !Number.isFinite(e.deltaY) || e.deltaY === 0) return;
      if (!camera) fitMap();
      if (!camera) return;
      $('.game-world')
        ?.getAnimations()
        .forEach((a) => a.cancel());
      applyMapCamera(
        wheelCamera(vp.clientWidth, vp.clientHeight, camera, mapPoint(e, vp), e.deltaY, e.deltaMode),
      );
    },
    { passive: false },
  );

  document.addEventListener('pointerdown', (e) => {
    if (menuOpen || get('#modal').open || e.button !== 0) return;
    if (eventElement(e)?.closest('.robin-ipod-card') || eventElement(e)?.closest('.three-city-stage')) {
      return;
    }
    const vp = eventElement(e)?.closest<HTMLElement>('.map-viewport');
    if (vp) {
      if (drag) return;
      if (!mapInput.blocksClick) mapTapBlockUntil = 0;
      if (!camera) fitMap();
      if (!camera) return;
      if (
        mapInput.down(e.pointerId, mapPoint(e, vp), { ...camera }, vp.clientWidth, vp.clientHeight)
      ) {
        $('.game-world')
          ?.getAnimations()
          .forEach((a) => a.cancel());
        if (mapInput.active) {
          mapTapBlockUntil = performance.now() + 450;
          for (const id of mapInput.points.keys())
            try {
              vp.setPointerCapture(id);
            } catch {}
        }
      }
      return;
    }
    if (drag || mapInput.points.size || e.pointerType !== 'mouse') return;
    const shop = eventElement(e)?.closest<HTMLElement>('[data-drag-shop]'),
      counter = eventElement(e)?.closest<HTMLElement>('[data-drag-token]');
    let type: PieceDrag['type'] | null = null,
      index = 0;
    if (
      shop &&
      state.phase === 'build' &&
      state.players[0].tiles[Number(shop.dataset.dragShop)] > 0
    ) {
      type = 'shop';
      index = Number(shop.dataset.dragShop);
    } else if (counter && state.phase === 'receive') {
      type = 'counter';
      index = 0;
    }
    const source = shop || counter;
    if (type && source)
      drag = {
        type,
        index,
        el: source,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        active: false,
      };
  });

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!mapInput.points.has(e.pointerId)) return;
      const vp = $('.map-viewport');
      if (!vp) {
        cancelMapGesture();
        return;
      }
      const next = mapInput.move(e.pointerId, mapPoint(e, vp));
      if (!next) return;
      if (e.cancelable) e.preventDefault();
      mapTapBlockUntil = performance.now() + 450;
      try {
        vp.setPointerCapture(e.pointerId);
      } catch {}
      applyMapCamera(next);
    },
    { passive: false },
  );

  document.addEventListener('pointerup', (e) => {
    if (!mapInput.points.has(e.pointerId) && !mapInput.ignored.has(e.pointerId)) return;
    const vp = $('.map-viewport');
    if (camera && mapInput.up(e.pointerId, { ...camera })) mapTapBlockUntil = performance.now() + 450;
    try {
      if (vp?.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
    } catch {}
  });

  document.addEventListener('pointercancel', (e) => {
    if (mapInput.points.has(e.pointerId) || mapInput.ignored.has(e.pointerId)) {
      if (camera) mapInput.up(e.pointerId, { ...camera });
      cancelMapGesture();
    }
  });

  document.addEventListener('lostpointercapture', (e) => {
    if (eventElement(e)?.matches?.('.map-viewport') && mapInput.points.has(e.pointerId))
      cancelMapGesture();
  });

  window.addEventListener('blur', () => {
    cancelMapGesture();
    mapInput.clear();
  });
  window.addEventListener('resize', cancelMapGesture);

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.active && Math.hypot(dx, dy) < 6) return;
      if (!drag.active) {
        drag.active = true;
        try {
          drag.el.setPointerCapture(e.pointerId);
        } catch {}
        document.body.classList.add('dragging');
        if (drag.type === 'shop') {
          selectedShop = drag.index;
          document
            .querySelectorAll<HTMLElement>('.lot')
            .forEach((l) =>
              l.classList.toggle(
                'buildable',
                canPlace(state, 0, Number(l.dataset.lot), selectedShop ?? -1),
              ),
            );
        }
        get('#drag-piece').innerHTML =
          drag.type === 'shop' ? sprite('shops', SPRITES[drag.index]) : token(0);
        get('#drag-piece').className = 'show' + (drag.type === 'counter' ? ' token-drag' : '');
      }
      if (e.cancelable) e.preventDefault();
      get('#drag-piece').style.left = e.clientX + 'px';
      get('#drag-piece').style.top = e.clientY + 'px';
      clearDrop();
      if (viewMode === 'city-3d' && board3D) {
        const id3d = board3D.pickLotAtClientPoint(e.clientX, e.clientY);
        if (id3d !== null) {
          const valid =
            drag.type === 'counter'
              ? state.pending.includes(id3d)
              : canPlace(state, 0, id3d, drag.index);
          board3D.setDropTargetLot(valid ? id3d : null);
        }
      } else {
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-lot]');
        if (target) {
          const id = Number(target.dataset.lot),
            valid =
              drag.type === 'counter'
                ? state.pending.includes(id)
                : canPlace(state, 0, id, drag.index);
          if (valid) target.classList.add('drop-target');
        }
      }
    },
    { passive: false },
  );

  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const ended = drag;
    const id3d =
      viewMode === 'city-3d' && board3D
        ? board3D.pickLotAtClientPoint(e.clientX, e.clientY)
        : null;
    const target =
      viewMode === 'city-3d'
        ? null
        : document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-lot]');
    cancelDrag();
    if (!ended.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 250);
    try {
      const resolvedId = id3d !== null ? id3d : target ? Number(target.dataset.lot) : null;
      if (resolvedId === null) {
        render();
        return;
      }
      const id = resolvedId;
      if (ended.type === 'counter') {
        if (!state.pending.includes(id)) toast('Place your stool on one of the glowing addresses.');
        else if (chosen.includes(id)) toast('You already placed a stool here.');
        else clickLot(id);
      } else if (canPlace(state, 0, id, ended.index)) buildPiece(id, ended.index);
      else {
        toast('That shop needs one of your empty addresses.');
        render();
      }
    } catch (error) {
      toast(errorMessage(error));
      render();
    }
  });

  document.addEventListener('pointercancel', () => {
    if (drag?.active) {
      cancelDrag();
      render();
    } else cancelDrag();
  });

  window.addEventListener('blur', () => {
    if (drag) {
      cancelDrag();
      render();
    }
  });

  window.addEventListener('resize', fitMap);

  let keyboardNavigation = false;
  document.addEventListener(
    'keydown',
    () => {
      keyboardNavigation = true;
    },
    { capture: true },
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      keyboardNavigation = false;
      lastInputType = e.pointerType;
    },
    { capture: true, passive: true },
  );
  document.addEventListener('focusin', (e) => {
    const lot = eventElement(e)?.closest<HTMLElement>('[data-lot]'),
      vp = $('.map-viewport');
    if (!keyboardNavigation || !lot || !vp?.contains(lot)) return;
    requestAnimationFrame(() => {
      if (!lot.isConnected || document.activeElement !== lot) return;
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
      focusLot(Number(lot.dataset.lot));
    });
  });

  document.addEventListener('keydown', (e) => {
    const modal = $('#modal') as HTMLDialogElement | null;
    if (modal?.open || menuOpen) return;
    if (e.key === 'v' || e.key === 'V') {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleViewMode();
        return;
      }
    }
    if (e.key === 'Escape') {
      dismissPhase();
      cancelDrag();
      selectedShop = null;
      selectedLot = null;
      if (ipodOpen) ipodOpen = false;
      render();
    }
    const vp = $('.map-viewport');
    if (!vp || !vp.contains(eventElement(e)) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['+', '=', '-', '0'].includes(e.key)) {
      e.preventDefault();
      if (drag || mapInput.blocksClick) return;
      if (!camera) fitMap();
      if (!camera) return;
      $('.game-world')
        ?.getAnimations()
        .forEach((a) => a.cancel());
      const w = vp.clientWidth,
        h = vp.clientHeight;
      applyMapCamera(
        e.key === '0'
          ? cameraFor(w, h, { x: 550, y: 365 }, null, desktopMap() ? 'contain' : 'cover')
          : wheelCamera(w, h, camera, { x: w / 2, y: h / 2 }, e.key === '-' ? 100 : -100),
      );
    } else if (
      e.target === vp &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      e.preventDefault();
      cameraCenter = dragCamera(
        camera ?? cameraFor(vp.clientWidth, vp.clientHeight),
        e.key === 'ArrowLeft' ? 45 : e.key === 'ArrowRight' ? -45 : 0,
        e.key === 'ArrowUp' ? 45 : e.key === 'ArrowDown' ? -45 : 0,
      );
      fitMap();
    }
  });

  function sizeOverlays() {
    const vv = window.visualViewport,
      height = vv?.height || window.innerHeight;
    document.documentElement.style.setProperty('--available-height', height + 'px');
    document.documentElement.style.setProperty(
      '--dialog-center',
      (vv?.offsetTop || 0) + height / 2 + 'px',
    );
  }
  window.visualViewport?.addEventListener('resize', sizeOverlays);
  window.visualViewport?.addEventListener('scroll', sizeOverlays);
  window.addEventListener('resize', sizeOverlays);
  sizeOverlays();

  document.addEventListener('change', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.matches('[data-bargain-cash]'))
      trading.cashChanged(e.target);
  });
  document.addEventListener('input', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.matches('[data-bargain-cash]'))
      trading.cashChanged(e.target, false);
  });
  get('#modal').addEventListener('cancel', () => trading.dismiss());
  get('#modal').addEventListener('close', () => {
    if (!get('#modal').open) trading.cancel();
  });
  get('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) {
      const r = get('#modal').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeModal();
    }
  });

  for (const event of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
    document.addEventListener(
      event,
      (e) => {
        if (event === 'pointerdown' && e instanceof PointerEvent && e.pointerType !== 'mouse') return;
        const s = gameAudio.getSettings();
        if (s.sfx || s.music) void gameAudio.unlock();
      },
      { capture: true, passive: true },
    );

  installMobileGuards();
  get('#phase-cue').addEventListener('pointerenter', () => clearTimeout(phaseTimer));
  get('#phase-cue').addEventListener('focusin', () => clearTimeout(phaseTimer));
  get('#phase-cue').addEventListener('pointerleave', () => {
    if (get('#phase-cue').classList.contains('show')) phaseTimer = setTimeout(dismissPhase, 4500);
  });

  render();
  save();
  void warmAssets();
  refreshOnChainProof();

  // Auto-join cross-device online room if URL contains ?room=CODE6X
  try {
    const urlRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
    if (isValidRoomCode(urlRoom)) {
      const wAcc = wallet.getState().account;
      const room = new NetworkRoom({
        roomCode: urlRoom,
        isHost: false,
        localPlayer: {
          name: wAcc?.name && wAcc.name !== 'Alice' ? wAcc.name : 'Bob',
          address: wAcc?.address ?? '0x2000000000000000000000000000000000000002',
        },
      });
      bindRoomSession(room, urlRoom);
      setTimeout(() => {
        openWifHub();
        toast(`Joined Online Room ${urlRoom} via invite link!`);
      }, 450);
    }
  } catch {}

  if (layoutUpdated && state.lots.some((l) => l.owner !== null))
    setTimeout(
      () =>
        toast(
          'The neighborhood map is ready. Your street addresses and $wif balances are preserved.',
        ),
      700,
    );

  registerGameTools({
    getState: () => state,
    claim: (ids) => {
      claimPlots(state, ids);
      chosen = [];
      changed();
    },
    startBuild: () => {
      beginBuild(state);
      selectedShop = null;
      selectedLot = null;
      changed();
    },
    buildPiece,
    act,
    changed,
    playSound,
    speak: gameAudio.speak,
    onTradeTax: (taxAmount) => {
      flywheel = {
        ...flywheel,
        totalStakingYield: flywheel.totalStakingYield + taxAmount,
        totalTradesTaxed: flywheel.totalTradesTaxed + 1,
      };
      saveEconomy();
    },
  });
}
