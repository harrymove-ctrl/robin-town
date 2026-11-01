import {
  SHOPS,
  holdings,
  emptyOffer,
  evaluateOffer,
  findSmartPlayerTrade,
  groups,
  neighbors,
  trade,
} from './engine';
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
  onProposeHumanTrade?: (offer: TradeOffer) => boolean;
  isHumanPartner?: (partnerSeat: number) => boolean;
  playSound: (kind?: SoundEffect) => void;
  onTrading: (active: boolean) => void;
  speak?: (mood: BotMood, person: number) => void;
}

export interface TradingController {
  open(partner?: number, prefillLot?: number | null, prefillShop?: number | null): void;
  openSmart?(): void;
  cancel(): void;
  dismiss(): void;
  handle(element: HTMLElement): void;
  cashChanged(element: HTMLInputElement, normalize?: boolean): void;
  resolveExternalTradeResult?(accepted: boolean, partnerName: string, taxAmount?: number): void;
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
  onProposeHumanTrade,
  isHumanPartner,
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
  function formatSideSummary(side: OfferSide): string {
    const parts: string[] = [];
    if (side.cash > 0) parts.push(`${side.cash} $wif`);
    side.tiles.forEach((cnt, idx) => {
      if (cnt > 0) parts.push(`${cnt}× ${shopName(idx)}`);
    });
    if (side.lots.length > 0) {
      parts.push(`Plot ${side.lots.map((id) => '#' + (id + 1)).join(', ')}`);
    }
    return parts.join(' + ') || 'Nothing';
  }
  function tileFitsYou(s: GameState, shopIdx: number): boolean {
    if ((s.players[0]?.tiles[shopIdx] ?? 0) >= 2) return true;
    return groups(s, 0).some((g) => g.shop === shopIdx && g.size < (SHOPS[shopIdx]?.size ?? 3));
  }
  function lotAdjacentToYou(s: GameState, lotId: number): boolean {
    return neighbors(lotId).some((nid) => s.lots[nid]?.owner === 0);
  }
  function smartDealBanner(s: GameState, busy: boolean): string {
    if (busy || status === 'accepted') return '';
    const smart = findSmartPlayerTrade(s);
    if (!smart || isHumanPartner?.(smart.partner)) return '';
    const partnerName = s.players[smart.partner]?.name ?? 'Neighbor';
    const sameAlreadyLoaded =
      draft.partner === smart.partner &&
      draft.give.cash === smart.give.cash &&
      draft.take.cash === smart.take.cash &&
      draft.give.lots.join(',') === smart.give.lots.join(',') &&
      draft.take.lots.join(',') === smart.take.lots.join(',') &&
      draft.give.tiles.join(',') === smart.give.tiles.join(',') &&
      draft.take.tiles.join(',') === smart.take.tiles.join(',');
    if (sameAlreadyLoaded) return '';
    return `<div class="smart-deal-bar" role="region" aria-label="Smart win-win deal suggestion">
      <span class="smart-deal-tag">💡 WIN-WIN</span>
      <span class="smart-deal-copy">Give <strong>${formatSideSummary(smart.give)}</strong> to <strong>${partnerName}</strong> for <strong>${formatSideSummary(smart.take)}</strong></span>
      <button type="button" class="smart-deal-btn" data-bargain="smart-prefill">Load Deal ⇄</button>
    </div>`;
  }
  function liveDealMeter(s: GameState, partnerName: string, busy: boolean): string {
    if (busy || isHumanPartner?.(draft.partner)) return '';
    if (!hasItems(draft.give) && !hasItems(draft.take)) {
      return `<div class="deal-meter empty"><span>⚖️</span><span>Place $wif, shop pieces, or street plots on either side to see ${partnerName}'s live reaction.</span></div>`;
    }
    try {
      const check = evaluateOffer(s, draft);
      const youCash = playerAt(s, 0).cash;
      if (check.accepted) {
        return `<div class="deal-meter accepted"><span>✓</span><span><strong>Fair Win-Win!</strong> ${partnerName} likes this package and is ready to shake hands.</span><button type="button" class="deal-meter-clear" data-bargain="clear-mat">Clear</button></div>`;
      }
      if (check.shortfall > 0 && check.shortfall <= 30 && draft.give.cash + check.shortfall <= youCash) {
        return `<div class="deal-meter close"><span>≈</span><span><strong>Almost there!</strong> Add <strong>+${check.shortfall} $wif</strong> (or 1 piece) for ${partnerName} to accept.</span><button type="button" class="deal-meter-sweeten" data-bargain="sweeten" data-shortfall="${check.shortfall}">+${check.shortfall} $wif ✓</button><button type="button" class="deal-meter-clear" data-bargain="clear-mat">Clear</button></div>`;
      }
      return `<div class="deal-meter wide"><span>◔</span><span>Needs ~<strong>${check.shortfall} $wif</strong> more value (cash, tile, or adjacent plot) for ${partnerName}.</span><button type="button" class="deal-meter-clear" data-bargain="clear-mat">Clear</button></div>`;
    } catch {
      return '';
    }
  }
  function inventory(player: number, side: TradeSide): string {
    const s = getState(),
      p = playerAt(s, player),
      d = draft[side];
    return `<section class="barter-side"><div class="barter-owner">${token(player)}<strong>${player === 0 ? 'You give' : p.name + ' gives'}</strong><small>${p.cash} $wif</small></div>
      <div class="offer-tray" aria-label="Selected offer">${hasItems(d) ? `${d.cash ? `<span class="offer-chip cash-chip">${d.cash} $wif</span>` : ''}${d.tiles.map((n, i) => (n ? `<button data-bargain="remove" data-side="${side}" data-kind="tile" data-index="${i}" aria-label="Remove one ${shopName(i)}">${sprite('shops', shopSprite(i))}<b>×${n}</b><em>−</em></button>` : '')).join('')}${d.lots.map((id) => `<button data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${id}" aria-label="Remove plot ${id + 1}"><span class="offer-address">${id + 1}</span><em>−</em></button>`).join('')}` : `<span class="empty-tray">Tap items below to place them on the mat</span>`}</div>
      <div class="cash-stepper"><span>$wif</span><button data-bargain="cash" data-side="${side}" data-delta="-10" aria-label="Less $wif">−10</button><label><span class="sr-only">Cash offered ${side}</span><input data-bargain-cash="${side}" type="number" inputmode="numeric" min="0" max="${p.cash}" step="1" value="${d.cash}"> $wif</label><button data-bargain="cash" data-side="${side}" data-delta="10" aria-label="More $wif">+10</button></div>
      <p class="stash-label">SHOP PIECES · TAP TO ADD</p><div class="barter-grid">${SHOPS.map((shop, i) => {
        const avail = (p.tiles[i] ?? 0) - (d.tiles[i] ?? 0);
        const fits = side === 'take' && (p.tiles[i] ?? 0) > 0 && tileFitsYou(s, i);
        return `<button class="stash-slot ${d.tiles[i] ? 'selected' : ''} ${fits ? 'synergy-fit' : ''}" data-bargain="asset" data-side="${side}" data-kind="tile" data-index="${i}" ${p.tiles[i] === d.tiles[i] ? 'disabled' : ''} aria-label="${shop.name}, ${avail} available">${sprite('shops', shopSprite(i))}<strong>${shop.name}</strong><small>×${avail}${fits ? ' · ★' : ''}</small>${d.tiles[i] ? `<b class="slot-added">+${d.tiles[i]}</b>` : ''}</button>`;
      }).join('')}</div>
      <p class="stash-label">ADDRESSES · BUILT SHOPS INCLUDED</p><div class="barter-plots">${
        holdings(s, player)
          .map((l) => {
            const adj = side === 'take' && lotAdjacentToYou(s, l.id);
            return `<button class="plot-slot ${d.lots.includes(l.id) ? 'selected' : ''} ${adj ? 'synergy-adj' : ''}" data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${l.id}" aria-pressed="${d.lots.includes(l.id)}" title="${adj ? 'Directly adjacent to one of your plots!' : `Plot #${l.id + 1}`}" aria-label="Plot ${l.id + 1}${l.shop !== null ? ', ' + shopName(l.shop) : ''}${adj ? ', adjacent to yours' : ''}">${l.shop !== null ? sprite('shops', shopSprite(l.shop)) : '<span class="empty-property">⌂</span>'}<b>${l.id + 1}${adj ? '★' : ''}</b>${d.lots.includes(l.id) ? '<i>✓</i>' : ''}</button>`;
          })
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
          `<button data-bargain="person" data-player="${n.id}" aria-pressed="${n.id === p.id}" ${busy ? 'disabled' : ''}>${token(n.id)}<strong>${n.name}</strong><span>${isHumanPartner?.(n.id) ? '🟢 Live Player' : [null, 'Neighborly', 'Sharp', 'Easygoing'][n.id]}</span></button>`,
      )
      .join('')}</div>
    ${smartDealBanner(s, busy)}
    <div class="bargain-dialogue ${status}" role="status" aria-live="polite"><span class="bargain-face" aria-hidden="true">${{ idle: '☺', thinking: '◔', rejected: 'ಠ', accepted: '♥' }[status]}</span><div><strong>${p.name}${busy ? ' · · ·' : ''}</strong><p>${message}</p></div>${done ? '<span class="deal-stamp">DEAL!</span>' : ''}</div>
    ${
      done
        ? `<div class="deal-receipt"><strong>Deal sealed. Your plots, shop pieces, and $wif changed hands.</strong><p>${lastTax > 0 ? `1% OTC protocol fee (${lastTax} $wif) routed into the Robinhood Chain Staking Vault.` : 'Direct asset swap settled with zero cash fee.'}</p><button class="primary" data-bargain="again">Another deal</button><button class="secondary" data-action="close">Back to town</button></div>`
        : `${liveDealMeter(s, p.name, busy)}<fieldset class="barter-table" ${busy ? 'disabled' : ''}><legend class="sr-only">Your two-sided trade offer</legend>${inventory(0, 'give')}<div class="barter-divider" aria-hidden="true">⇄</div>${inventory(p.id, 'take')}</fieldset>
    <div class="barter-bottom"><span>Tap an item to add it. ★ marks tiles and plots that connect to your shops! (1% $wif cash fee feeds Staking Vault)</span>${status === 'rejected' && shortfall > 0 && draft.give.cash + shortfall <= playerAt(s, 0).cash ? `<button class="secondary" data-bargain="counter">Add ${shortfall} $wif</button>` : ''}<button class="primary bargain-submit" data-bargain="propose" ${busy || (!hasItems(draft.give) && !hasItems(draft.take)) ? 'disabled' : ''}>${busy ? 'Counting the offer…' : 'How about this?'}</button></div>`
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
  function openSmart(): void {
    const smart = findSmartPlayerTrade(getState());
    if (!smart) {
      open(1);
      return;
    }
    cancel();
    modal('Let us make a deal.', '', 'ROBIN-TOWN BARGAINING TABLE');
    draft = JSON.parse(JSON.stringify(smart)) as TradeOffer;
    active = true;
    status = 'idle';
    lastTax = 0;
    message = 'Here is a win-win swap that helps both of our storefronts! Ready to shake on it?';
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
    } else if (action === 'smart-prefill') {
      const smart = findSmartPlayerTrade(getState());
      if (smart) {
        draft = JSON.parse(JSON.stringify(smart)) as TradeOffer;
        status = 'idle';
        shortfall = 0;
        message = 'That swap connects both of our blocks nicely. Ready to shake hands?';
      }
    } else if (action === 'sweeten') {
      const addAmt = Math.max(0, Number(el.dataset.shortfall || 0));
      if (addAmt > 0) {
        adjustDraft(getState(), draft, 'give', 'cash', 0, addAmt);
        status = 'idle';
        shortfall = 0;
        message = 'Now that is a generous offer! Ready to shake on it?';
      }
    } else if (action === 'clear-mat') {
      draft = makeDraft(getState(), draft.partner);
      status = 'idle';
      shortfall = 0;
      intro();
    } else if (action === 'again') {
      draft = makeDraft(getState(), draft.partner);
      status = 'idle';
      lastTax = 0;
      intro();
    } else if (action === 'propose') {
      if (isHumanPartner?.(draft.partner) && onProposeHumanTrade) {
        const sent = onProposeHumanTrade(JSON.parse(JSON.stringify(draft)) as TradeOffer);
        if (sent) {
          status = 'thinking';
          message = `Sent live OTC offer to ${getState().players[draft.partner]?.name ?? 'Trader'}. Waiting for their reply…`;
          render();
          return;
        }
      }
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
  function resolveExternalTradeResult(
    accepted: boolean,
    partnerName: string,
    taxAmount = 0,
  ): void {
    if (!active) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastTax = taxAmount;
    if (accepted) {
      status = 'accepted';
      message = `${partnerName} accepted your live OTC deal!`;
      playSound('deal');
    } else {
      status = 'rejected';
      shortfall = 0;
      message = `${partnerName} declined this offer. Adjust the bundle or try another neighbor.`;
      playSound('reject');
    }
    render();
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
  return {
    open,
    openSmart,
    cancel,
    dismiss,
    handle,
    cashChanged,
    resolveExternalTradeResult,
    isOpen: () => active,
  };
}
