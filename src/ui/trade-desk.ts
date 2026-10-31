/**
 * src/ui/trade-desk.ts
 *
 * Interactive Bilateral OTC Liquidity Desk and Escrow Modal for robin-town.
 * Manages two-column visual asset staging, counterparty selection across 3 AI bots,
 * cash steppers with balance validation, parcel/tile checklists, 1% micro-tax breakdown,
 * bot quote messages, shortfall meters, one-click counteroffers, and deal execution.
 */

import { DISTRICT_BLOCKS } from '../engine/board-layout';
import {
  applyTradeTax,
  calculateTradeTax,
  createInitialFlywheelState,
  type FlywheelState,
  type TradeTaxResult,
} from '../tokenomics/flywheel';
import {
  BOT_PERSONALITIES,
  getBotPersonality,
  type BotPersonality,
} from '../engine/bot';
import {
  DISTRICT_NAMES,
  SHOPS,
  emptyOffer,
  evaluateOffer,
  executeTrade,
  validateOffer,
} from '../engine/engine';
import type {
  GameState,
  Lot,
  OfferSide,
  Player,
  Shop,
  TradeEvaluation,
  TradeOffer,
} from '../engine/types';

/** Text of the stamp that slams onto the desk when a deal executes. */
export const ORDER_FILLED_STAMP = 'ORDER FILLED';

/** Bot acceptance threshold as shown on the desk, e.g. 1.00x / 1.15x / 0.95x. */
export function formatMargin(margin: number): string {
  return `${margin.toFixed(2)}x`;
}

export interface TradeDeskConfig {
  defaultPartnerId?: number;
  tradeTaxRate?: number;
  flywheelState?: FlywheelState;
  onTradeExecuted?: (offer: TradeOffer, evaluation: TradeEvaluation, taxResult?: TradeTaxResult | null) => void;
  onAudioTrigger?: (cue: 'deal-stamp' | 'coin-chime' | 'error-buzzer' | 'click') => void;
  onClose?: () => void;
}

export interface TradeDeskState {
  isOpen: boolean;
  proposerId: number;
  partnerId: number;
  give: OfferSide;
  take: OfferSide;
  evaluation: TradeEvaluation | null;
  taxBreakdown: {
    giveTax: TradeTaxResult;
    takeTax: TradeTaxResult;
  };
  validationError: string | null;
  lastExecutedOffer: TradeOffer | null;
  lastExecutedTax?: TradeTaxResult | null;
  isFilledAnimationActive: boolean;
}

/**
 * Headless TradeDeskController managing all negotiation logic and state transitions
 * without DOM dependencies, fully testable in Node.js test runners.
 */
export class TradeDeskController {
  private state: GameState;
  private deskState: TradeDeskState;
  private config: TradeDeskConfig;
  private flywheelState: FlywheelState;

  constructor(gameState: GameState, config: TradeDeskConfig = {}) {
    this.state = gameState;
    this.config = config;
    this.flywheelState = config.flywheelState ?? createInitialFlywheelState();
    const initialPartner = config.defaultPartnerId ?? 1;

    this.deskState = {
      isOpen: false,
      proposerId: 0,
      partnerId: initialPartner,
      give: emptyOffer(),
      take: emptyOffer(),
      evaluation: null,
      taxBreakdown: {
        giveTax: calculateTradeTax(0),
        takeTax: calculateTradeTax(0),
      },
      validationError: null,
      lastExecutedOffer: null,
      lastExecutedTax: null,
      isFilledAnimationActive: false,
    };
  }

  public getDeskState(): Readonly<TradeDeskState> {
    return this.deskState;
  }

  public getFlywheelState(): Readonly<FlywheelState> {
    return this.flywheelState;
  }

  public getCommunityVault(): number {
    return this.flywheelState.totalStakingYield;
  }

  public getGameState(): Readonly<GameState> {
    return this.state;
  }

  public updateGameState(nextState: GameState): void {
    this.state = nextState;
    this.recalculate();
  }

  /**
   * Opens the desk aimed at `partnerId`. When `lotId` is one of the partner's
   * parcels it is preloaded into the take side (the partner is inferred from
   * the parcel's owner if no partner is given).
   */
  public open(partnerId?: number, lotId?: number): void {
    if (this.state.phase !== 'trade') {
      throw new Error('OTC Liquidity Desk is available only during the Trade phase.');
    }
    const lot = lotId !== undefined ? this.state.lots[lotId] : undefined;
    if (partnerId === undefined && lot && lot.owner !== null) partnerId = lot.owner;
    this.deskState.isOpen = true;
    if (partnerId !== undefined && partnerId >= 1 && partnerId <= 3) {
      this.deskState.partnerId = partnerId;
    }
    this.deskState.give = emptyOffer();
    this.deskState.take = emptyOffer();
    if (lot && lot.owner === this.deskState.partnerId) {
      this.deskState.take.lots.push(lot.id);
    }
    this.deskState.isFilledAnimationActive = false;
    this.recalculate();
  }

  /**
   * Opens the desk prefilled with an existing deal (e.g. to counter a bot's
   * proposal). Assets the owner no longer holds are dropped and amounts are
   * clamped to current balances.
   */
  public openWithOffer(partnerId: number, give: OfferSide, take: OfferSide): void {
    this.open(partnerId);
    const proposer = this.getProposer();
    const partner = this.getPartner();
    const clampSide = (side: OfferSide, owner: Player): OfferSide => ({
      cash: Math.max(0, Math.min(Math.floor(side.cash || 0), owner.cash)),
      tiles: [0, 1, 2, 3, 4, 5].map((s) =>
        Math.max(0, Math.min(Math.floor(((side.tiles as number[])[s] as number) || 0), owner.tiles[s] ?? 0))
      ),
      lots: side.lots.filter((id) => this.state.lots[id]?.owner === owner.id),
    });
    this.deskState.give = clampSide(give, proposer);
    this.deskState.take = clampSide(take, partner);
    this.recalculate();
  }

  public close(): void {
    this.deskState.isOpen = false;
    this.deskState.isFilledAnimationActive = false;
    if (this.config.onClose) {
      this.config.onClose();
    }
  }

  public setPartner(partnerId: number): void {
    if (partnerId < 1 || partnerId > 3 || partnerId === this.deskState.proposerId) {
      throw new Error(`Invalid counterparty ID: ${partnerId}`);
    }
    this.deskState.partnerId = partnerId;
    // Reset requested assets since new partner owns different assets
    this.deskState.take = emptyOffer();
    this.recalculate();
  }

  public getActivePartnerProfile(): BotPersonality {
    return getBotPersonality(this.deskState.partnerId);
  }

  public getProposer(): Player {
    return this.state.players[this.deskState.proposerId];
  }

  public getPartner(): Player {
    return this.state.players[this.deskState.partnerId];
  }

  public setGiveCash(amount: number): void {
    const proposer = this.getProposer();
    const clamped = Math.max(0, Math.min(Math.floor(amount || 0), proposer.cash));
    this.deskState.give.cash = clamped;
    this.recalculate();
  }

  public adjustGiveCash(delta: number): void {
    this.setGiveCash(this.deskState.give.cash + delta);
  }

  public setTakeCash(amount: number): void {
    const partner = this.getPartner();
    const clamped = Math.max(0, Math.min(Math.floor(amount || 0), partner.cash));
    this.deskState.take.cash = clamped;
    this.recalculate();
  }

  public adjustTakeCash(delta: number): void {
    this.setTakeCash(this.deskState.take.cash + delta);
  }

  public toggleGiveLot(lotId: number): void {
    const lot = this.state.lots[lotId];
    if (!lot || lot.owner !== this.deskState.proposerId) {
      throw new Error(`Cannot offer lot ${lotId}: not owned by proposer.`);
    }
    const idx = this.deskState.give.lots.indexOf(lotId);
    if (idx >= 0) {
      this.deskState.give.lots.splice(idx, 1);
    } else {
      this.deskState.give.lots.push(lotId);
    }
    this.recalculate();
  }

  public toggleTakeLot(lotId: number): void {
    const lot = this.state.lots[lotId];
    if (!lot || lot.owner !== this.deskState.partnerId) {
      throw new Error(`Cannot request lot ${lotId}: not owned by partner.`);
    }
    const idx = this.deskState.take.lots.indexOf(lotId);
    if (idx >= 0) {
      this.deskState.take.lots.splice(idx, 1);
    } else {
      this.deskState.take.lots.push(lotId);
    }
    this.recalculate();
  }

  public setGiveTiles(shopType: number, count: number): void {
    if (shopType < 0 || shopType >= 6) return;
    const held = this.getProposer().tiles[shopType] ?? 0;
    const clamped = Math.max(0, Math.min(Math.floor(count || 0), held));
    (this.deskState.give.tiles as number[])[shopType] = clamped;
    this.recalculate();
  }

  public adjustGiveTiles(shopType: number, delta: number): void {
    const current = (this.deskState.give.tiles as number[])[shopType] || 0;
    this.setGiveTiles(shopType, current + delta);
  }

  public setTakeTiles(shopType: number, count: number): void {
    if (shopType < 0 || shopType >= 6) return;
    const held = this.getPartner().tiles[shopType] ?? 0;
    const clamped = Math.max(0, Math.min(Math.floor(count || 0), held));
    (this.deskState.take.tiles as number[])[shopType] = clamped;
    this.recalculate();
  }

  public adjustTakeTiles(shopType: number, delta: number): void {
    const current = (this.deskState.take.tiles as number[])[shopType] || 0;
    this.setTakeTiles(shopType, current + delta);
  }

  public clearEscrow(): void {
    this.deskState.give = emptyOffer();
    this.deskState.take = emptyOffer();
    this.recalculate();
  }

  public recalculate(): void {
    const taxRate = this.config.tradeTaxRate ?? 0.01;
    this.deskState.taxBreakdown = {
      giveTax: calculateTradeTax(this.deskState.give.cash, taxRate),
      takeTax: calculateTradeTax(this.deskState.take.cash, taxRate),
    };

    const offer: TradeOffer = {
      fromPlayer: this.deskState.proposerId,
      toPlayer: this.deskState.partnerId,
      partner: this.deskState.partnerId,
      give: this.deskState.give,
      take: this.deskState.take,
    };

    try {
      validateOffer(this.state, offer);
      this.deskState.validationError = null;
      this.deskState.evaluation = evaluateOffer(this.state, offer);
    } catch (err: unknown) {
      this.deskState.validationError = (err as Error).message;
      this.deskState.evaluation = null;
    }
  }

  public canApplyCounteroffer(): boolean {
    const evalResult = this.deskState.evaluation;
    if (!evalResult || evalResult.accepted || !evalResult.counterOffer) {
      return false;
    }
    const requiredGiveCash = evalResult.counterOffer.cash;
    return requiredGiveCash <= this.getProposer().cash;
  }

  public applyCounteroffer(): boolean {
    if (!this.canApplyCounteroffer()) return false;
    const counter = this.deskState.evaluation!.counterOffer!;
    this.deskState.give.cash = counter.cash;
    this.recalculate();
    if (this.config.onAudioTrigger) {
      this.config.onAudioTrigger('click');
    }
    return true;
  }

  public executeTrade(): boolean {
    if (!this.deskState.evaluation || !this.deskState.evaluation.accepted) {
      if (this.config.onAudioTrigger) {
        this.config.onAudioTrigger('error-buzzer');
      }
      return false;
    }

    const offer: TradeOffer = {
      fromPlayer: this.deskState.proposerId,
      toPlayer: this.deskState.partnerId,
      partner: this.deskState.partnerId,
      give: this.deskState.give,
      take: this.deskState.take,
    };

    const result = executeTrade(this.state, offer);
    if (!result.evaluation.accepted) return false;

    // Deduct 1% OTC micro-tax from the cash recipient and route yield to community staking vault
    const taxRate = this.config.tradeTaxRate ?? 0.01;
    let appliedTax: TradeTaxResult | null = null;

    if (offer.take.cash > offer.give.cash) {
      const grossCash = offer.take.cash - offer.give.cash;
      appliedTax = calculateTradeTax(grossCash, taxRate);
      const recipient = this.state.players[offer.fromPlayer ?? 0];
      recipient.cash -= appliedTax.taxAmount;
      this.flywheelState = applyTradeTax(this.flywheelState, appliedTax);
      if (this.config.flywheelState) {
        this.config.flywheelState.totalStakingYield += appliedTax.vaultAmount;
        this.config.flywheelState.totalBurned += appliedTax.burnedAmount;
        this.config.flywheelState.totalTradesTaxed += 1;
      }
    } else if (offer.give.cash > offer.take.cash) {
      const grossCash = offer.give.cash - offer.take.cash;
      appliedTax = calculateTradeTax(grossCash, taxRate);
      const recipient = this.state.players[offer.toPlayer ?? offer.partner!];
      recipient.cash -= appliedTax.taxAmount;
      this.flywheelState = applyTradeTax(this.flywheelState, appliedTax);
      if (this.config.flywheelState) {
        this.config.flywheelState.totalStakingYield += appliedTax.vaultAmount;
        this.config.flywheelState.totalBurned += appliedTax.burnedAmount;
        this.config.flywheelState.totalTradesTaxed += 1;
      }
    }

    this.deskState.lastExecutedOffer = offer;
    this.deskState.lastExecutedTax = appliedTax;
    this.deskState.isFilledAnimationActive = true;

    if (this.config.onAudioTrigger) {
      this.config.onAudioTrigger('deal-stamp');
      this.config.onAudioTrigger('coin-chime');
    }

    if (this.config.onTradeExecuted) {
      this.config.onTradeExecuted(offer, result.evaluation, appliedTax);
    }

    // Reset escrow staging trays after filled trade
    this.deskState.give = emptyOffer();
    this.deskState.take = emptyOffer();
    this.recalculate();
    return true;
  }
}

/**
 * DOM View Controller mounting the interactive negotiation modal dialog.
 */
export class TradeDeskModal {
  private controller: TradeDeskController;
  private container: HTMLElement;
  private keydownListener: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, controller: TradeDeskController) {
    this.container = container;
    this.controller = controller;
    this.keydownListener = this.handleKeyDown.bind(this);
    this.bindEvents();
  }

  public render(): void {
    const state = this.controller.getDeskState();
    if (!state.isOpen) {
      this.container.innerHTML = '';
      this.container.classList.remove('modal-open');
      return;
    }

    this.container.classList.add('modal-open');
    const partner = this.controller.getActivePartnerProfile();
    const proposer = this.controller.getProposer();
    const partnerPlayer = this.controller.getPartner();
    const evalResult = state.evaluation;
    const tax = state.taxBreakdown;

    this.container.innerHTML = `
      <div class="trade-modal-backdrop" data-action="close"></div>
      <div class="trade-modal-window" role="dialog" aria-modal="true" aria-labelledby="trade-title">
        <header class="trade-modal-header">
          <div class="header-titles">
            <h2 id="trade-title">OTC Liquidity Desk</h2>
            <span class="subtitle">Bilateral Liquidity Desk (Epoch ${this.controller.getGameState().year})</span>
          </div>
          <button class="btn-close" aria-label="Close Trade Desk" data-action="close">&times;</button>
        </header>

        <!-- Counterparty Selector Tabs -->
        <nav class="partner-selector-tabs" aria-label="Trading Counterparties">
          ${[1, 2, 3].map((id) => {
            const p = getBotPersonality(id);
            const isActive = id === state.partnerId;
            return `
              <button class="partner-tab ${isActive ? 'active' : ''}" data-partner-id="${id}">
                <img src="assets/avatars/${p.avatar}" class="avatar-sprite pixel-art" alt="${p.name}" />
                <div class="partner-tab-info">
                  <span class="partner-name">${p.name}</span>
                  <span class="partner-tag">${p.title} (${formatMargin(p.profitMargin)})</span>
                </div>
              </button>
            `;
          }).join('')}
        </nav>

        <!-- Two-Column Visual Escrow Grid -->
        <div class="escrow-grid">
          <!-- Left Column: Outgoing Offer (Player Give) -->
          <section class="escrow-column column-give">
            <div class="column-header">
              <h3>Outgoing Offer (You Give)</h3>
              <span class="balance-pill">Balance: ${proposer.cash} $wif</span>
            </div>

            <!-- Cash Input Tray -->
            <div class="tray-section">
              <label for="give-cash-input">$wif Capital to Transfer:</label>
              <div class="cash-input-row">
                <input id="give-cash-input" type="number" min="0" max="${proposer.cash}" value="${state.give.cash}" />
                <button class="btn-stepper" data-step-give="10">+10</button>
                <button class="btn-stepper" data-step-give="50">+50</button>
                <button class="btn-stepper" data-step-give="100">+100</button>
                <button class="btn-stepper" data-step-give="1000">+1k</button>
                <button class="btn-stepper btn-clear" data-action="clear-give-cash">Clear</button>
              </div>
            </div>

            <!-- Protocol Modules Section -->
            <div class="tray-section">
              <h4>Protocol Modules: Tap to Stage</h4>
              <div class="tile-selection-list">
                ${SHOPS.map((shop, sIdx) => {
                  const held = proposer.tiles[sIdx] || 0;
                  const staged = (state.give.tiles as number[])[sIdx] || 0;
                  return `
                    <div class="tile-row ${held === 0 ? 'disabled' : ''}">
                      <img src="assets/shops/shop_${sIdx}.png" class="tile-sprite pixel-art" alt="${shop.name}" />
                      <span class="shop-name">${shop.name} (${shop.code})</span>
                      <span class="held-badge">Held: ${held}</span>
                      <div class="stepper-controls">
                        <button class="btn-qty" data-tile-give="${sIdx}" data-delta="-1" ${staged <= 0 ? 'disabled' : ''}>-</button>
                        <span class="staged-count">${staged}</span>
                        <button class="btn-qty" data-tile-give="${sIdx}" data-delta="1" ${staged >= held ? 'disabled' : ''}>+</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- District Parcels Section -->
            <div class="tray-section">
              <h4>District Parcels: Active Protocols Included</h4>
              <div class="parcel-checklist">
                ${this.controller.getGameState().lots
                  .filter((lot) => lot.owner === proposer.id)
                  .map((lot) => {
                    const isChecked = state.give.lots.includes(lot.id);
                    const districtName = DISTRICT_NAMES[lot.block];
                    const shopName = lot.shop !== null ? SHOPS[lot.shop].name : 'Vacant';
                    return `
                      <label class="parcel-card ${isChecked ? 'selected' : ''}" style="--district-accent: ${DISTRICT_BLOCKS[lot.block]?.accentHex ?? '#4b5563'}">
                        <input type="checkbox" data-lot-give="${lot.id}" ${isChecked ? 'checked' : ''} />
                        <div class="parcel-card-body">
                          <span class="parcel-id">Parcel ${lot.id + 1}</span>
                          <span class="parcel-district district-${lot.block}">${districtName}</span>
                          <span class="parcel-shop">${lot.shop !== null ? `<img src="assets/shops/shop_${lot.shop}.png" class="parcel-shop-icon pixel-art" alt="" />` : ''}${shopName}</span>
                        </div>
                      </label>
                    `;
                  }).join('') || '<div class="empty-notice">No parcels owned yet.</div>'}
              </div>
            </div>
          </section>

          <!-- Right Column: Incoming Request (Counterparty Give) -->
          <section class="escrow-column column-take">
            <div class="column-header">
              <h3>Incoming Request (${partner.name} Gives)</h3>
              <span class="balance-pill">Partner Liquid: ${partnerPlayer.cash} $wif</span>
            </div>

            <!-- Cash Request Tray -->
            <div class="tray-section">
              <label for="take-cash-input">$wif Capital Requested:</label>
              <div class="cash-input-row">
                <input id="take-cash-input" type="number" min="0" max="${partnerPlayer.cash}" value="${state.take.cash}" />
                <button class="btn-stepper" data-step-take="10">+10</button>
                <button class="btn-stepper" data-step-take="50">+50</button>
                <button class="btn-stepper" data-step-take="100">+100</button>
                <button class="btn-stepper" data-step-take="1000">+1k</button>
                <button class="btn-stepper btn-clear" data-action="clear-take-cash">Clear</button>
              </div>
            </div>

            <!-- Protocol Modules Section -->
            <div class="tray-section">
              <h4>Counterparty Modules Available</h4>
              <div class="tile-selection-list">
                ${SHOPS.map((shop, sIdx) => {
                  const held = partnerPlayer.tiles[sIdx] || 0;
                  const staged = (state.take.tiles as number[])[sIdx] || 0;
                  return `
                    <div class="tile-row ${held === 0 ? 'disabled' : ''}">
                      <img src="assets/shops/shop_${sIdx}.png" class="tile-sprite pixel-art" alt="${shop.name}" />
                      <span class="shop-name">${shop.name} (${shop.code})</span>
                      <span class="held-badge">Available: ${held}</span>
                      <div class="stepper-controls">
                        <button class="btn-qty" data-tile-take="${sIdx}" data-delta="-1" ${staged <= 0 ? 'disabled' : ''}>-</button>
                        <span class="staged-count">${staged}</span>
                        <button class="btn-qty" data-tile-take="${sIdx}" data-delta="1" ${staged >= held ? 'disabled' : ''}>+</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- District Parcels Section -->
            <div class="tray-section">
              <h4>Counterparty Parcels Owned</h4>
              <div class="parcel-checklist">
                ${this.controller.getGameState().lots
                  .filter((lot) => lot.owner === partnerPlayer.id)
                  .map((lot) => {
                    const isChecked = state.take.lots.includes(lot.id);
                    const districtName = DISTRICT_NAMES[lot.block];
                    const shopName = lot.shop !== null ? SHOPS[lot.shop].name : 'Vacant';
                    return `
                      <label class="parcel-card ${isChecked ? 'selected' : ''}" style="--district-accent: ${DISTRICT_BLOCKS[lot.block]?.accentHex ?? '#4b5563'}">
                        <input type="checkbox" data-lot-take="${lot.id}" ${isChecked ? 'checked' : ''} />
                        <div class="parcel-card-body">
                          <span class="parcel-id">Parcel ${lot.id + 1}</span>
                          <span class="parcel-district district-${lot.block}">${districtName}</span>
                          <span class="parcel-shop">${lot.shop !== null ? `<img src="assets/shops/shop_${lot.shop}.png" class="parcel-shop-icon pixel-art" alt="" />` : ''}${shopName}</span>
                        </div>
                      </label>
                    `;
                  }).join('') || '<div class="empty-notice">Counterparty owns no parcels.</div>'}
              </div>
            </div>
          </section>
        </div>

        <!-- Center Settlement and Micro-Tax Breakdown Bar -->
        <footer class="trade-modal-footer">
          <div class="tax-breakdown-card">
            <h4>OTC Micro-Tax (1% Community Staking Vault Fee)</h4>
            <div class="tax-metrics">
              ${state.take.cash > 0 ? `
                <div class="tax-metric-item">
                  <span class="metric-label">Gross Received:</span>
                  <span class="metric-val">${tax.takeTax.grossCash} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">1% Micro-Tax:</span>
                  <span class="metric-val text-accent">-${tax.takeTax.taxAmount} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">Net Received:</span>
                  <span class="metric-val text-green">${tax.takeTax.netCash} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">Vault Yield:</span>
                  <span class="metric-val text-purple">+${tax.takeTax.vaultAmount} $wif</span>
                </div>
              ` : state.give.cash > 0 ? `
                <div class="tax-metric-item">
                  <span class="metric-label">Gross Sent:</span>
                  <span class="metric-val">${tax.giveTax.grossCash} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">1% Micro-Tax:</span>
                  <span class="metric-val text-accent">-${tax.giveTax.taxAmount} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">Net to Partner:</span>
                  <span class="metric-val text-green">${tax.giveTax.netCash} $wif</span>
                </div>
                <div class="tax-metric-item">
                  <span class="metric-label">Vault Yield:</span>
                  <span class="metric-val text-purple">+${tax.giveTax.vaultAmount} $wif</span>
                </div>
              ` : `
                <div class="tax-metric-item">
                  <span class="metric-label">Barter Trade:</span>
                  <span class="metric-val text-green">100% Tax-Free Non-Cash Exchange</span>
                </div>
              `}
            </div>
          </div>

          <!-- Bot Evaluation and Quote Bubble -->
          <div class="bot-quote-card ${evalResult?.accepted ? 'accepted' : (evalResult ? 'rejected' : 'empty')}">
            <img src="assets/avatars/${partner.avatar}" class="avatar-sprite pixel-art" alt="${partner.name}" />
            <div class="quote-content">
              <span class="quote-author">${partner.name} (${partner.title}):</span>
              <div class="quote-badges">
                <span class="persona-badge" title="Bot profit margin: the bot wants ${formatMargin(partner.profitMargin)} the value it gives up">${partner.name} wants ${formatMargin(partner.profitMargin)}</span>
                ${evalResult
                  ? (evalResult.accepted
                    ? '<span class="verdict-badge accepted">Accepted</span>'
                    : `<span class="verdict-badge shortfall">Shortfall: ${evalResult.shortfall} $wif</span>`)
                  : ''}
              </div>
              <p class="quote-text">${evalResult ? evalResult.quoteMessage : 'Configure an offer to calculate expected value.'}</p>
              ${evalResult && !evalResult.accepted && evalResult.shortfall > 0 ? `
                <div class="shortfall-meter">
                  <span class="shortfall-badge">Valuation Shortfall: ${evalResult.shortfall} $wif</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Action Buttons Bar -->
          <div class="trade-action-bar">
            <button class="btn-secondary" data-action="clear-escrow">Reset Escrow</button>
            ${this.controller.canApplyCounteroffer() ? `
              <button class="btn-counteroffer" data-action="apply-counteroffer">
                Match Bot Ask (+${evalResult!.shortfall} $wif)
              </button>
            ` : ''}
            <button class="btn-primary btn-execute" data-action="execute-trade" ${evalResult?.accepted ? '' : 'disabled'}>
              Broadcast Offer and Fill Deal
            </button>
          </div>
        </footer>

        <!-- Holographic deal stamp overlay -->
        ${state.isFilledAnimationActive ? `
          <div class="deal-stamp-overlay animate-stamp">
            <div class="stamp-box">${ORDER_FILLED_STAMP}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.keydownListener);
    this.container.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest(
        '[data-action], [data-partner-id], [data-step-give], [data-step-take], [data-tile-give], [data-tile-take], [data-lot-give], [data-lot-take]'
      ) as HTMLElement | null;
      if (!target) return;

      if (target.dataset.action === 'close') {
        this.controller.close();
        this.render();
      } else if (target.dataset.partnerId) {
        this.controller.setPartner(parseInt(target.dataset.partnerId, 10));
        this.render();
      } else if (target.dataset.stepGive) {
        this.controller.adjustGiveCash(parseInt(target.dataset.stepGive, 10));
        this.render();
      } else if (target.dataset.stepTake) {
        this.controller.adjustTakeCash(parseInt(target.dataset.stepTake, 10));
        this.render();
      } else if (target.dataset.action === 'clear-give-cash') {
        this.controller.setGiveCash(0);
        this.render();
      } else if (target.dataset.action === 'clear-take-cash') {
        this.controller.setTakeCash(0);
        this.render();
      } else if (target.dataset.tileGive) {
        const s = parseInt(target.dataset.tileGive, 10);
        const delta = parseInt(target.dataset.delta || '0', 10);
        this.controller.adjustGiveTiles(s, delta);
        this.render();
      } else if (target.dataset.tileTake) {
        const s = parseInt(target.dataset.tileTake, 10);
        const delta = parseInt(target.dataset.delta || '0', 10);
        this.controller.adjustTakeTiles(s, delta);
        this.render();
      } else if (target.dataset.lotGive) {
        this.controller.toggleGiveLot(parseInt(target.dataset.lotGive, 10));
        this.render();
      } else if (target.dataset.lotTake) {
        this.controller.toggleTakeLot(parseInt(target.dataset.lotTake, 10));
        this.render();
      } else if (target.dataset.action === 'clear-escrow') {
        this.controller.clearEscrow();
        this.render();
      } else if (target.dataset.action === 'apply-counteroffer') {
        this.controller.applyCounteroffer();
        this.render();
      } else if (target.dataset.action === 'execute-trade') {
        const success = this.controller.executeTrade();
        this.render();
        if (success) {
          setTimeout(() => {
            this.controller.close();
            this.render();
          }, 1200);
        }
      }
    });

    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === 'give-cash-input') {
        this.controller.setGiveCash(parseInt(target.value, 10) || 0);
        this.render();
      } else if (target.id === 'take-cash-input') {
        this.controller.setTakeCash(parseInt(target.value, 10) || 0);
        this.render();
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.controller.getDeskState().isOpen) return;

    if (e.key === 'Escape') {
      this.controller.close();
      this.render();
    } else if (e.key === 'Enter') {
      if (this.controller.getDeskState().evaluation?.accepted) {
        this.controller.executeTrade();
        this.render();
      } else if (this.controller.canApplyCounteroffer()) {
        this.controller.applyCounteroffer();
        this.render();
      }
    } else if (e.key === '1' || e.key === '2' || e.key === '3') {
      this.controller.setPartner(parseInt(e.key, 10));
      this.render();
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownListener);
    }
  }
}
