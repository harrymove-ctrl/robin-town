import { SHOPS, holdings, emptyOffer, trade } from './engine';
import { query as $, required as get, errorMessage } from './dom';
import type { GameState, TradeOffer, OfferSide, Player } from './types';
import type { SoundEffect, BotMood } from './audio';

export type TradeSide = 'give' | 'take';
export type TradeAssetKind = 'cash' | 'tile' | 'lot';
type TradeStatus = 'idle' | 'thinking' | 'rejected' | 'accepted';

export interface TradingOptions {
  getState: () => GameState;
  sprite: (kind: string, name: string, className?: string, extra?: string) => string;
  token: (player: number, className?: string) => string;
  modal: (title: string, content: string, eyebrow?: string) => void;
  closeModal: () => void;
  onChanged: () => void;
  onTradeTax?: (taxAmount: number) => void;
  playSound: (kind?: SoundEffect) => void;
  onTrading: (active: boolean) => void;
  speak?: (mood: BotMood, person: number) => void;
}

export interface TradingController {
  open(partner?: number, prefillLot?: number | null, prefillShop?: number | null): void;
  cancel(): void;
  dismiss(): void;
  handle(element: HTMLElement): void;
  cashChanged(element: HTMLInputElement, normalize?: boolean): void;
  isOpen(): boolean;
}

function isTradeSide(value: unknown): value is TradeSide {
  return value === 'give' || value === 'take';
}
function isAssetKind(value: unknown): value is TradeAssetKind {
  return value === 'cash' || value === 'tile' || value === 'lot';
}
function playerAt(state: GameState, index: number): Player {
  const player = state.players[index];
  if (!player) throw Error('Choose a neighbor.');
  return player;
}

export function makeDraft(
  state: GameState,
  partner: number,
  prefillLot: number | null = null,
  prefillShop: number | null = null,
): TradeOffer {
  if (![1, 2, 3].includes(partner)) throw Error('Choose a neighbor.');
  const player = playerAt(state, partner);
  const draft: TradeOffer = { partner, give: emptyOffer(), take: emptyOffer() };
  if (prefillLot !== null && state.lots[prefillLot]?.owner === partner)
    draft.take.lots = [prefillLot];
  if (prefillShop !== null && (player.tiles[prefillShop] ?? 0) > 0)
    draft.take.tiles[prefillShop] = 1;
  return draft;
}
export function adjustDraft(
  state: GameState,
  draft: TradeOffer,
  side: TradeSide,
  kind: TradeAssetKind,
  index: number,
  delta = 1,
): TradeOffer | undefined {
  if (!isTradeSide(side)) return;
  const p = playerAt(state, side === 'give' ? 0 : draft.partner),
    d = draft[side];
  if (kind === 'cash') d.cash = Math.max(0, Math.min(p.cash, d.cash + delta));
  if (kind === 'tile' && Number.isInteger(index) && index >= 0 && index < 6)
    d.tiles[index] = Math.max(0, Math.min(p.tiles[index] ?? 0, (d.tiles[index] ?? 0) + delta));
  if (kind === 'lot' && state.lots[index]?.owner === p.id)
    d.lots = d.lots.includes(index) ? d.lots.filter((id) => id !== index) : [...d.lots, index];
  return draft;
}

export function createTrading({
  getState,
  sprite,
  token,
  modal,
  onChanged,
  onTradeTax,
  playSound,
  onTrading,
  speak = () => {},
}: TradingOptions): TradingController {
  let draft: TradeOffer = { partner: 1, give: emptyOffer(), take: emptyOffer() };
  let active = false;
  let status: TradeStatus = 'idle';
  let message = '',
    shortfall = 0,
    lastTax = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const names = ['coffee', 'banhmi', 'pho', 'flowers', 'tailor', 'grocery'] as const;
  const shopSprite = (index: number): string => names[index] ?? names[0];
  const shopName = (index: number): string => SHOPS[index]?.name ?? 'Shop';
  const hasItems = (side: OfferSide): boolean =>
    side.cash > 0 || side.lots.length > 0 || side.tiles.some((n) => n > 0);
  const greetings = [
    'A spot next door? Pull up a stool, now we are talking!',
    'Let us see what $wif and storefronts you brought to the table.',
    'Have a seat by the street. Let us build a deal that works for both of us.',
  ] as const;
  function intro(): void {
    message = greetings[draft.partner - 1] ?? greetings[0];
  }
  function inventory(player: number, side: TradeSide): string {
    const s = getState(),
      p = playerAt(s, player),
      d = draft[side];
    return `<section class="barter-side"><div class="barter-owner">${token(player)}<strong>${player === 0 ? 'You give' : p.name + ' gives'}</strong><small>${p.cash} $wif</small></div>
      <div class="offer-tray" aria-label="Selected offer">${hasItems(d) ? `${d.cash ? `<span class="offer-chip cash-chip">${d.cash} $wif</span>` : ''}${d.tiles.map((n, i) => (n ? `<button data-bargain="remove" data-side="${side}" data-kind="tile" data-index="${i}" aria-label="Remove one ${shopName(i)}">${sprite('shops', shopSprite(i))}<b>×${n}</b><em>−</em></button>` : '')).join('')}${d.lots.map((id) => `<button data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${id}" aria-label="Remove plot ${id + 1}"><span class="offer-address">${id + 1}</span><em>−</em></button>`).join('')}` : `<span class="empty-tray">Tap items below to place them on the mat</span>`}</div>
      <div class="cash-stepper"><span>$wif</span><button data-bargain="cash" data-side="${side}" data-delta="-10" aria-label="Less $wif">−10</button><label><span class="sr-only">Cash offered ${side}</span><input data-bargain-cash="${side}" type="number" inputmode="numeric" min="0" max="${p.cash}" step="1" value="${d.cash}"> $wif</label><button data-bargain="cash" data-side="${side}" data-delta="10" aria-label="More $wif">+10</button></div>
      <p class="stash-label">SHOP PIECES · TAP TO ADD</p><div class="barter-grid">${SHOPS.map((shop, i) => `<button class="stash-slot ${d.tiles[i] ? 'selected' : ''}" data-bargain="asset" data-side="${side}" data-kind="tile" data-index="${i}" ${p.tiles[i] === d.tiles[i] ? 'disabled' : ''} aria-label="${shop.name}, ${(p.tiles[i] ?? 0) - (d.tiles[i] ?? 0)} available">${sprite('shops', shopSprite(i))}<strong>${shop.name}</strong><small>×${(p.tiles[i] ?? 0) - (d.tiles[i] ?? 0)}</small>${d.tiles[i] ? `<b class="slot-added">+${d.tiles[i]}</b>` : ''}</button>`).join('')}</div>
      <p class="stash-label">ADDRESSES · BUILT SHOPS INCLUDED</p><div class="barter-plots">${
        holdings(s, player)
          .map(
            (l) =>
              `<button class="plot-slot ${d.lots.includes(l.id) ? 'selected' : ''}" data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${l.id}" aria-pressed="${d.lots.includes(l.id)}" aria-label="Plot ${l.id + 1}${l.shop !== null ? ', ' + shopName(l.shop) : ''}">${l.shop !== null ? sprite('shops', shopSprite(l.shop)) : '<span class="empty-property">⌂</span>'}<b>${l.id + 1}</b>${d.lots.includes(l.id) ? '<i>✓</i>' : ''}</button>`,
          )
          .join('') || `<span class="empty-tray">No addresses yet</span>`
      }</div></section>`;
  }
  function body(): string {
    const s = getState(),
      p = playerAt(s, draft.partner),
      busy = status === 'thinking',
      done = status === 'accepted';
    return `<div class="barter-people" role="group" aria-label="Choose a neighbor">${s.players
      .slice(1)
      .map(
        (n) =>
          `<button data-bargain="person" data-player="${n.id}" aria-pressed="${n.id === p.id}" ${busy ? 'disabled' : ''}>${token(n.id)}<strong>${n.name}</strong><span>${[null, 'Neighborly', 'Sharp', 'Easygoing'][n.id]}</span></button>`,
      )
      .join('')}</div>
    <div class="bargain-dialogue ${status}" role="status" aria-live="polite"><span class="bargain-face" aria-hidden="true">${{ idle: '☺', thinking: '◔', rejected: 'ಠ', accepted: '♥' }[status]}</span><div><strong>${p.name}${busy ? ' · · ·' : ''}</strong><p>${message}</p></div>${done ? '<span class="deal-stamp">DEAL!</span>' : ''}</div>
    ${
      done
        ? `<div class="deal-receipt"><strong>Deal sealed. Your plots, shop pieces, and $wif changed hands.</strong><p>${lastTax > 0 ? `1% OTC protocol fee (${lastTax} $wif) routed into the Robinhood Chain Staking Vault.` : 'Direct asset swap settled with zero cash fee.'}</p><button class="primary" data-bargain="again">Another deal</button><button class="secondary" data-action="close">Back to town</button></div>`
        : `<fieldset class="barter-table" ${busy ? 'disabled' : ''}><legend class="sr-only">Your two-sided trade offer</legend>${inventory(0, 'give')}<div class="barter-divider" aria-hidden="true">⇄</div>${inventory(p.id, 'take')}</fieldset>
    <div class="barter-bottom"><span>Tap an item to add it. Tap the tray to remove it. (1% $wif cash fee feeds Staking Vault)</span>${status === 'rejected' && shortfall > 0 && draft.give.cash + shortfall <= playerAt(s, 0).cash ? `<button class="secondary" data-bargain="counter">Add ${shortfall} $wif</button>` : ''}<button class="primary bargain-submit" data-bargain="propose" ${busy || (!hasItems(draft.give) && !hasItems(draft.take)) ? 'disabled' : ''}>${busy ? 'Counting the offer…' : 'How about this?'}</button></div>`
    }`;
  }
  function render(): void {
    if (!active) return;
    const b = $('#modal .modal-body');
    if (b) {
      b.innerHTML = body();
      get('#modal').classList.add('trade-dialog');
    }
  }
  function open(
    partner = 1,
    prefillLot: number | null = null,
    prefillShop: number | null = null,
  ): void {
    cancel();
    modal('Let us make a deal.', '', 'ROBIN-TOWN BARGAINING TABLE');
    draft = makeDraft(getState(), partner, prefillLot, prefillShop);
    active = true;
    status = 'idle';
    lastTax = 0;
    intro();
    render();
    onTrading(true);
    playSound('deal-open');
  }
  function cancel(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    onTrading(false);
    active = false;
    $('#modal')?.classList.remove('trade-dialog');
  }
  function handle(el: HTMLElement): void {
    if (!active) return;
    const action = el.dataset.bargain;
    if (!action) return;
    if (status === 'thinking') return;
    if (action === 'person') {
      draft = makeDraft(getState(), Number(el.dataset.player));
      status = 'idle';
      intro();
    } else if (action === 'again') {
      draft = makeDraft(getState(), draft.partner);
      status = 'idle';
      lastTax = 0;
      intro();
    } else if (action === 'propose') {
      status = 'thinking';
      message = 'Hmm… let me count those plots and $wif.';
      speak('thinking', draft.partner);
      render();
      timer = setTimeout(() => {
        timer = null;
        if (!active || !$('#modal')?.open) return;
        try {
          const result = trade(getState(), draft);
          shortfall = result.shortfall || 0;
          lastTax = result.taxAmount || 0;
          if (result.accepted) {
            status = 'accepted';
            message = 'You have got a deal! Iced coffee on me next time.';
            if (lastTax > 0) onTradeTax?.(lastTax);
            onChanged();
            playSound('deal');
            speak('positive', draft.partner);
          } else {
            status = 'rejected';
            message = `Close! Add ${shortfall} $wif, or show me a different package.`;
            playSound('reject');
            speak('negative', draft.partner);
          }
        } catch (error) {
          status = 'rejected';
          message = errorMessage(error);
          speak('negative', draft.partner);
        }
        render();
      }, 650);
      return;
    } else if (action === 'counter') {
      adjustDraft(getState(), draft, 'give', 'cash', 0, shortfall);
      status = 'idle';
      message = 'That looks much fairer. Ready to shake on it?';
    } else if (action === 'cash') {
      const side = el.dataset.side,
        delta = Number(el.dataset.delta);
      if (!isTradeSide(side) || !Number.isFinite(delta)) return;
      adjustDraft(getState(), draft, side, 'cash', 0, delta);
    } else if (action === 'asset' || action === 'remove') {
      const side = el.dataset.side,
        kind = el.dataset.kind;
      if (!isTradeSide(side) || !isAssetKind(kind)) return;
      adjustDraft(
        getState(),
        draft,
        side,
        kind,
        Number(el.dataset.index),
        action === 'remove' ? -1 : 1,
      );
    }
    if (['cash', 'asset', 'remove'].includes(action) && status === 'rejected') {
      status = 'idle';
      shortfall = 0;
      intro();
    }
    playSound('tap');
    const key = ['bargain', 'side', 'kind', 'index', 'player', 'delta']
      .map((k) => (el.dataset[k] !== undefined ? `[data-${k}="${el.dataset[k]}"]` : ''))
      .join('');
    render();
    if (key) $('#modal')?.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
  }
  function cashChanged(el: HTMLInputElement, normalize = true): void {
    if (!active || status === 'thinking') return;
    const side = el.dataset.bargainCash;
    if (!isTradeSide(side)) return;
    const p = playerAt(getState(), side === 'give' ? 0 : draft.partner);
    draft[side].cash = Math.max(0, Math.min(p.cash, Math.floor(Number(el.value) || 0)));
    if (normalize) el.value = String(draft[side].cash);
    const tray = el.closest('.barter-side')?.querySelector<HTMLElement>('.offer-tray');
    if (!tray) return;
    tray.querySelector('.cash-chip')?.remove();
    if (draft[side].cash) {
      const chip = document.createElement('span');
      chip.className = 'offer-chip cash-chip';
      chip.textContent = draft[side].cash + ' $wif';
      tray.prepend(chip);
    }
    if (hasItems(draft[side])) tray.querySelector('.empty-tray')?.remove();
    else
      tray.innerHTML = `<span class="empty-tray">Tap items below to place them on the mat</span>`;
    if (status === 'rejected') {
      status = 'idle';
      shortfall = 0;
      intro();
      const bubble = get('.bargain-dialogue');
      bubble.className = 'bargain-dialogue idle';
      const text = bubble.querySelector('p'),
        face = bubble.querySelector('.bargain-face');
      if (text) text.textContent = message;
      if (face) face.textContent = '☺';
      $('[data-bargain="counter"]')?.remove();
    }
    get<HTMLButtonElement>('.bargain-submit').disabled =
      !hasItems(draft.give) && !hasItems(draft.take);
  }
  function dismiss(): void {
    if (
      active &&
      status !== 'accepted' &&
      (status === 'rejected' || hasItems(draft.give) || hasItems(draft.take))
    )
      speak('negative', draft.partner);
    cancel();
  }
  return { open, cancel, dismiss, handle, cashChanged, isOpen: () => active };
}
