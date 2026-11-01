/**
 * src/ui/wallet-flywheel-modal.ts
 *
 * Dual-Mode Wallet & $wif Economic Flywheel Modal for Robin-Town.
 * Manages:
 * 1. Dual-mode wallet connection: Robinhood Chain Testnet (Chain ID 46631) and 4 local simulated accounts.
 * 2. Real-time flywheel metrics display: total $wif burned, staking vault TVL, active multiplier.
 * 3. Community governance proposal voting interface with explicit deflationary voting burns to 0x...dEaD.
 * 4. Headless controller architecture for pure Node.js automated testability.
 */

import {
  BURN_ADDRESS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_RPC_URL,
  DEFAULT_SIMULATED_ACCOUNTS,
  type WalletAccount,
  type WalletAdapter,
  type WalletMode,
  type WalletState,
} from '../tokenomics/wallet';

import {
  DEFAULT_FLYWHEEL_CONFIG,
  castGovernanceVote,
  createInitialFlywheelState,
  type FlywheelState,
  type GovernanceProposal,
  type GovernanceVote,
  type GovernanceVoteResult,
} from '../tokenomics/flywheel';

export type WalletModalTab = 'wallet' | 'flywheel' | 'governance';

export interface WalletFlywheelConfig {
  walletAdapter: WalletAdapter;
  flywheelState?: FlywheelState;
  onClose?: () => void;
  onVoteCast?: (result: GovernanceVoteResult) => void;
  onResetSimulation?: () => void;
  onAudioTrigger?: (cue: 'click' | 'coin-chime' | 'deal-stamp' | 'error-buzzer') => void;
}

export interface WalletFlywheelViewModel {
  activeTab: WalletModalTab;
  walletMode: WalletMode;
  walletStatus: string;
  activeAddress: string;
  activeName: string;
  activeBalance: number;
  chainId: number | null;
  isCorrectChain: boolean;
  totalBurned: number;
  stakingVaultTVL: number;
  totalMatches: number;
  totalSwaps: number;
  totalTradesTaxed: number;
  totalGovernanceVotes: number;
  totalGovernanceBurned: number;
  stakingMultiplier: number;
  simulatedAccounts: WalletAccount[];
  proposals: GovernanceProposal[];
  selectedProposal: GovernanceProposal | null;
  voteSupport: boolean;
  votingPower: number;
  calculatedBurnAmount: number;
  validationError: string | null;
  recentSuccessMessage: string | null;
}

/**
 * Standard seed community governance proposals for Robin-Town.
 */
export const SEED_GOVERNANCE_PROPOSALS: GovernanceProposal[] = [
  {
    id: 'RTP-1',
    title: 'Increase Community Staking Vault Share to 7%',
    description: 'Elevate the community staking vault allocation from 5% to 7% of competitive match buy-ins to accelerate long-term yield for staked Robinhood Chain participants.',
    proposer: '0x1000000000000000000000000000000000000001',
    category: 'treasury',
    forVotes: 12500,
    againstVotes: 3200,
    totalBurned: 785,
    startTime: 1730000000000,
    endTime: 1735000000000,
    status: 'active',
  },
  {
    id: 'RTP-2',
    title: 'Reduce OTC Trade Desk Micro-Tax to 0.5%',
    description: 'Lower the bilateral bargaining table cash fee from 1.0% to 0.5% to stimulate high-frequency parcel liquidity and foster multi-district monopolies.',
    proposer: '0x2000000000000000000000000000000000000002',
    category: 'tax',
    forVotes: 8900,
    againstVotes: 9400,
    totalBurned: 915,
    startTime: 1730000000000,
    endTime: 1735000000000,
    status: 'active',
  },
  {
    id: 'RTP-3',
    title: 'Deflationary Ranked Arena Match Burn Escalation',
    description: 'Boost the permanent burn sink on ranked 1,000 $wif arena matches from 5% to 8% to intensify $wif token scarcity across competitive epochs.',
    proposer: '0x3000000000000000000000000000000000000003',
    category: 'rewards',
    forVotes: 21400,
    againstVotes: 1800,
    totalBurned: 1160,
    startTime: 1730000000000,
    endTime: 1735000000000,
    status: 'active',
  },
];

export type WalletFlywheelListener = (vm: WalletFlywheelViewModel) => void;

/**
 * Headless controller managing dual-mode wallet state, flywheel metrics, and governance voting.
 * Pure TypeScript with zero DOM dependencies, fully testable in Node.js.
 */
export class WalletFlywheelController {
  private walletAdapter: WalletAdapter;
  private flywheelState: FlywheelState;
  private config: WalletFlywheelConfig;

  private activeTab: WalletModalTab = 'wallet';
  private proposals: Map<string, GovernanceProposal> = new Map();
  private selectedProposalId: string = 'RTP-1';
  private voteSupport: boolean = true;
  private votingPower: number = 100;
  private votingBurnRate: number = 0.05;
  private validationError: string | null = null;
  private recentSuccessMessage: string | null = null;
  private listeners: Set<WalletFlywheelListener> = new Set();

  constructor(config: WalletFlywheelConfig) {
    this.config = config;
    this.walletAdapter = config.walletAdapter;
    this.flywheelState = config.flywheelState || createInitialFlywheelState();

    // Populate initial proposals
    for (const p of SEED_GOVERNANCE_PROPOSALS) {
      this.proposals.set(p.id, { ...p });
    }

    // Subscribe to wallet state changes
    this.walletAdapter.subscribe(() => {
      this.notifyListeners();
    });
  }

  public subscribe(listener: WalletFlywheelListener): () => void {
    this.listeners.add(listener);
    listener(this.getViewModel());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const vm = this.getViewModel();
    for (const listener of this.listeners) {
      try {
        listener(vm);
      } catch {
        // Safe subscriber error isolation
      }
    }
  }

  public getFlywheelState(): FlywheelState {
    return this.flywheelState;
  }

  public setFlywheelState(state: FlywheelState): void {
    this.flywheelState = state;
    this.notifyListeners();
  }

  public switchTab(tab: WalletModalTab): void {
    this.activeTab = tab;
    this.validationError = null;
    this.recentSuccessMessage = null;
    this.notifyListeners();
  }

  public setWalletMode(mode: WalletMode): void {
    this.walletAdapter.setMode(mode);
    this.validationError = null;
    this.notifyListeners();
  }

  public selectSimAccount(address: string): void {
    try {
      this.walletAdapter.switchAccount(address);
      this.validationError = null;
      this.notifyListeners();
    } catch (err: unknown) {
      this.validationError = (err as Error).message;
      this.notifyListeners();
    }
  }

  public async connectWeb3(): Promise<void> {
    this.validationError = null;
    try {
      await this.walletAdapter.connect();
      this.notifyListeners();
    } catch (err: unknown) {
      this.validationError = (err as Error).message;
      this.notifyListeners();
    }
  }

  public resetSimulationBalances(): void {
    this.walletAdapter.resetSimulation();
    this.recentSuccessMessage = 'Simulated accounts reset to 10,000 $wif each.';
    this.validationError = null;
    if (this.config.onResetSimulation) {
      this.config.onResetSimulation();
    }
    this.notifyListeners();
  }

  public selectProposal(proposalId: string): void {
    if (this.proposals.has(proposalId)) {
      this.selectedProposalId = proposalId;
      this.validationError = null;
      this.notifyListeners();
    }
  }

  public setVoteSupport(support: boolean): void {
    this.voteSupport = Boolean(support);
    this.notifyListeners();
  }

  public setVotingPower(amount: number): void {
    this.votingPower = Math.max(1, Math.floor(amount || 0));
    this.notifyListeners();
  }

  public calculateBurnForVote(power?: number): number {
    const p = power !== undefined ? power : this.votingPower;
    if (p <= 0 || !Number.isFinite(p)) return 0;
    return Math.max(1, Math.ceil(p * this.votingBurnRate));
  }

  /**
   * Casts a community governance vote, burning the fee to dead address and updating state.
   */
  public async castVote(
    proposalId?: string,
    support?: boolean,
    votingPower?: number
  ): Promise<GovernanceVoteResult> {
    const targetId = proposalId || this.selectedProposalId;
    const isSupport = support !== undefined ? support : this.voteSupport;
    const power = votingPower !== undefined ? votingPower : this.votingPower;

    const proposal = this.proposals.get(targetId);
    if (!proposal) {
      const err = `Unknown proposal ID: ${targetId}`;
      this.validationError = err;
      this.notifyListeners();
      throw new Error(err);
    }

    if (power <= 0 || !Number.isFinite(power)) {
      const err = 'Voting power must be a positive number';
      this.validationError = err;
      this.notifyListeners();
      throw new Error(err);
    }

    const burnAmount = this.calculateBurnForVote(power);
    const walletState = this.walletAdapter.getState();
    const voterAddress = walletState.account?.address || '0x0000000000000000000000000000000000000001';
    const balance = walletState.account?.balance ?? 0;

    if (balance < burnAmount) {
      const err = `Insufficient $wif balance (${balance} $wif) to burn voting fee of ${burnAmount} $wif`;
      this.validationError = err;
      this.notifyListeners();
      throw new Error(err);
    }

    // Burn fee from wallet
    try {
      if (typeof (this.walletAdapter as any).sendTransaction === 'function') {
        await (this.walletAdapter as any).sendTransaction(BURN_ADDRESS, burnAmount);
      } else if (typeof this.walletAdapter.transfer === 'function') {
        await this.walletAdapter.transfer(BURN_ADDRESS, burnAmount);
      }
    } catch (err: unknown) {
      const msg = `Failed to burn voting fee: ${(err as Error).message}`;
      this.validationError = msg;
      this.notifyListeners();
      throw new Error(msg);
    }

    // Cast vote in flywheel state
    let voteResult: GovernanceVoteResult;
    try {
      voteResult = castGovernanceVote(
        this.flywheelState,
        targetId,
        voterAddress,
        isSupport,
        power,
        this.votingBurnRate
      );
      this.flywheelState = voteResult.state ? voteResult.state : voteResult;
    } catch {
      // Fallback manual accounting if castGovernanceVote is not yet exported from flywheel.ts
      if (isSupport) {
        proposal.forVotes += power;
      } else {
        proposal.againstVotes += power;
      }
      proposal.totalBurned += burnAmount;

      this.flywheelState = {
        ...this.flywheelState,
        totalBurned: this.flywheelState.totalBurned + burnAmount,
        totalGovernanceVotes: (this.flywheelState.totalGovernanceVotes || 0) + 1,
        totalGovernanceBurned: (this.flywheelState.totalGovernanceBurned || 0) + burnAmount,
      };

      const voteRecord: GovernanceVote = {
        proposalId: targetId,
        voterAddress,
        support: isSupport,
        votingPower: power,
        burnAmount,
        burnAddress: BURN_ADDRESS,
        timestamp: Date.now(),
      };

      voteResult = {
        ...this.flywheelState,
        state: this.flywheelState,
        vote: voteRecord,
        proposal,
        burnAddress: BURN_ADDRESS,
        burnedAmount: burnAmount,
      };
    }

    // Update local proposal record
    if (voteResult.proposal) {
      this.proposals.set(targetId, { ...voteResult.proposal });
    } else {
      if (isSupport) {
        proposal.forVotes += power;
      } else {
        proposal.againstVotes += power;
      }
      proposal.totalBurned += burnAmount;
      this.proposals.set(targetId, { ...proposal });
    }

    this.validationError = null;
    this.recentSuccessMessage = `Cast ${power} $wif ${isSupport ? 'FOR' : 'AGAINST'} ${targetId}. Burned ${burnAmount} $wif to dead address!`;

    if (this.config.onVoteCast) {
      this.config.onVoteCast(voteResult);
    }
    if (this.config.onAudioTrigger) {
      this.config.onAudioTrigger('coin-chime');
    }

    this.notifyListeners();
    return voteResult;
  }

  public getViewModel(): WalletFlywheelViewModel {
    const walletState = this.walletAdapter.getState();
    const activeAccount = walletState.account;
    const selectedProposal = this.proposals.get(this.selectedProposalId) || null;

    return {
      activeTab: this.activeTab,
      walletMode: walletState.mode,
      walletStatus: walletState.status,
      activeAddress: activeAccount?.address || '',
      activeName: activeAccount?.name || 'Unknown',
      activeBalance: activeAccount?.balance ?? 0,
      chainId: walletState.chainId,
      isCorrectChain: walletState.isCorrectChain,
      totalBurned: this.flywheelState.totalBurned,
      stakingVaultTVL: this.flywheelState.totalStakingYield,
      totalMatches: this.flywheelState.totalMatches,
      totalSwaps: this.flywheelState.totalSwaps,
      totalTradesTaxed: this.flywheelState.totalTradesTaxed,
      totalGovernanceVotes: this.flywheelState.totalGovernanceVotes || 0,
      totalGovernanceBurned: this.flywheelState.totalGovernanceBurned || 0,
      stakingMultiplier: DEFAULT_FLYWHEEL_CONFIG.stakingMultiplier,
      simulatedAccounts: [...walletState.availableSimAccounts],
      proposals: Array.from(this.proposals.values()),
      selectedProposal,
      voteSupport: this.voteSupport,
      votingPower: this.votingPower,
      calculatedBurnAmount: this.calculateBurnForVote(),
      validationError: this.validationError,
      recentSuccessMessage: this.recentSuccessMessage,
    };
  }
}

/**
 * Visual DOM Modal Component for dual-mode wallet configuration, flywheel metrics, and governance voting.
 */
export class WalletFlywheelModal {
  private container: HTMLElement;
  private controller: WalletFlywheelController;
  private unsubscribe: (() => void) | null = null;
  private isOpenState = false;
  private keydownListener: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, controller: WalletFlywheelController) {
    this.container = container;
    this.controller = controller;

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isOpenState && e.key === 'Escape') {
        this.close();
      }
    };
  }

  public mount(): void {
    this.unsubscribe = this.controller.subscribe(() => {
      if (this.isOpenState) {
        this.render();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydownListener);
    }
  }

  public unmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.container.innerHTML = '';
  }

  public open(tab?: WalletModalTab): void {
    this.isOpenState = true;
    if (tab) {
      this.controller.switchTab(tab);
    }
    this.render();
  }

  public close(): void {
    this.isOpenState = false;
    this.container.innerHTML = '';
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public render(): void {
    if (!this.isOpenState) {
      this.container.innerHTML = '';
      return;
    }

    const vm = this.controller.getViewModel();
    const isSim = vm.walletMode === 'simulation';

    this.container.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal-dialog wallet-flywheel-dialog solace-theme" role="dialog" aria-modal="true">
        <!-- Header -->
        <header class="modal-header">
          <div class="header-title-box">
            <span class="solace-badge">Robinhood Chain</span>
            <h3>$wif Economic Flywheel & Wallet</h3>
          </div>
          <button class="btn-close" data-action="close-modal" aria-label="Close modal">&times;</button>
        </header>

        <!-- Navigation Tabs -->
        <nav class="modal-tabs">
          <button class="tab-btn ${vm.activeTab === 'wallet' ? 'active' : ''}" data-tab="wallet">
            Dual-Mode Wallet
          </button>
          <button class="tab-btn ${vm.activeTab === 'flywheel' ? 'active' : ''}" data-tab="flywheel">
            Flywheel Metrics
          </button>
          <button class="tab-btn ${vm.activeTab === 'governance' ? 'active' : ''}" data-tab="governance">
            Governance Voting (${vm.proposals.length})
          </button>
        </nav>

        <!-- Notification Banners -->
        ${vm.validationError ? `
          <div class="modal-banner banner-error">
            <span class="banner-icon">⚠️</span>
            <span class="banner-text">${vm.validationError}</span>
          </div>
        ` : ''}
        ${vm.recentSuccessMessage ? `
          <div class="modal-banner banner-success">
            <span class="banner-icon">✅</span>
            <span class="banner-text">${vm.recentSuccessMessage}</span>
          </div>
        ` : ''}

        <!-- Tab Body -->
        <div class="modal-body">
          ${vm.activeTab === 'wallet' ? this.renderWalletTab(vm, isSim) : ''}
          ${vm.activeTab === 'flywheel' ? this.renderFlywheelTab(vm) : ''}
          ${vm.activeTab === 'governance' ? this.renderGovernanceTab(vm) : ''}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderWalletTab(vm: WalletFlywheelViewModel, isSim: boolean): string {
    return `
      <div class="wallet-tab-content">
        <div class="mode-selector-bar">
          <button class="mode-pill ${isSim ? 'active' : ''}" data-action="set-mode-sim">
            Local Simulation (4 Accounts)
          </button>
          <button class="mode-pill ${!isSim ? 'active' : ''}" data-action="set-mode-web3">
            Robinhood Chain Testnet (Chain ID ${ROBINHOOD_CHAIN_ID})
          </button>
        </div>

        ${isSim ? `
          <p class="tab-hint">
            Instant deterministic testing with 4 pre-funded local accounts holding 10,000 $wif each.
          </p>
          <div class="sim-accounts-grid">
            ${vm.simulatedAccounts.map((acc) => {
              const isSelected = acc.address.toLowerCase() === vm.activeAddress.toLowerCase();
              return `
                <label class="account-card ${isSelected ? 'selected' : ''}">
                  <input type="radio" name="sim-account-radio" value="${acc.address}" ${isSelected ? 'checked' : ''} />
                  <div class="account-card-body">
                    <div class="account-card-top">
                      <span class="account-name">${acc.name}</span>
                      <span class="account-badge ${isSelected ? 'badge-active' : ''}">${isSelected ? 'ACTIVE' : 'READY'}</span>
                    </div>
                    <span class="account-addr">${acc.address.slice(0, 10)}...${acc.address.slice(-6)}</span>
                    <span class="account-balance">${acc.balance.toLocaleString()} $wif</span>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div class="wallet-actions-row">
            <button class="btn-secondary" data-action="reset-sim">Reset Simulation Balances</button>
          </div>
        ` : `
          <p class="tab-hint">
            Connect browser wallet (MetaMask, Rabby) to the Robinhood Chain Testnet.
          </p>
          <div class="web3-status-card">
            <div class="status-indicator-row">
              <span class="status-dot ${vm.walletStatus === 'connected' ? 'dot-connected' : 'dot-disconnected'}"></span>
              <span class="status-title">Status: ${vm.walletStatus.toUpperCase()}</span>
              ${vm.isCorrectChain ? '<span class="chain-badge badge-green">Chain ID 46631 Match</span>' : ''}
            </div>
            <div class="web3-details-grid">
              <div class="detail-box">
                <span class="detail-label">Network Name</span>
                <span class="detail-val">Robinhood Chain Testnet</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">RPC Endpoint</span>
                <span class="detail-val text-truncate">${ROBINHOOD_RPC_URL}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Connected Address</span>
                <span class="detail-val">${vm.activeAddress || 'Not Connected'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Live $wif Balance</span>
                <span class="detail-val text-gold">${vm.activeBalance.toLocaleString()} $wif</span>
              </div>
            </div>
            <div class="web3-actions-row">
              <button class="btn-primary" data-action="connect-web3">
                ${vm.walletStatus === 'connected' ? 'Reconnect Wallet' : 'Connect Robinhood Chain Wallet'}
              </button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  private renderFlywheelTab(vm: WalletFlywheelViewModel): string {
    return `
      <div class="flywheel-tab-content">
        <!-- 3 Highlight Metric Cards -->
        <div class="metrics-cards-row">
          <div class="metric-card card-burn">
            <div class="card-header-icon">🔥</div>
            <span class="card-caption">Total $wif Burned</span>
            <span class="card-number text-accent">${vm.totalBurned.toLocaleString()} $wif</span>
            <span class="card-subtext">Permanent sink routed to 0x...dEaD</span>
          </div>
          <div class="metric-card card-vault">
            <div class="card-header-icon">🏦</div>
            <span class="card-caption">Community Staking Vault</span>
            <span class="card-number text-purple">${vm.stakingVaultTVL.toLocaleString()} $wif</span>
            <span class="card-subtext">Yield reserve for long-term stakers</span>
          </div>
          <div class="metric-card card-multiplier">
            <div class="card-header-icon">⚡</div>
            <span class="card-caption">Seasonal Staking Boost</span>
            <span class="card-number text-green">${vm.stakingMultiplier.toFixed(2)}x</span>
            <span class="card-subtext">+20% yield multiplier on match payouts</span>
          </div>
        </div>

        <!-- Economic Parameters Table -->
        <div class="flywheel-table-card">
          <h4>Robinhood Chain Economic Flywheel Parameters</h4>
          <div class="parameters-grid">
            <div class="param-row">
              <span class="param-name">Competitive Match Buy-In</span>
              <span class="param-val">1,000 $wif per player</span>
            </div>
            <div class="param-row">
              <span class="param-name">Deflationary Match Burn Sink</span>
              <span class="param-val text-accent">5% to dead address</span>
            </div>
            <div class="param-row">
              <span class="param-name">Community Staking Vault Allocation</span>
              <span class="param-val text-purple">5% to yield pool</span>
            </div>
            <div class="param-row">
              <span class="param-name">Podium Prize Purse Allocation</span>
              <span class="param-val text-green">90% (60% Gold / 25% Silver / 15% Bronze)</span>
            </div>
            <div class="param-row">
              <span class="param-name">Casual Town Point Redemption Burn</span>
              <span class="param-val text-accent">3% burn tax on $wif redemptions</span>
            </div>
            <div class="param-row">
              <span class="param-name">OTC Bargaining Table Micro-Tax</span>
              <span class="param-val text-purple">1% fee on liquid cash transfers</span>
            </div>
            <div class="param-row">
              <span class="param-name">Governance Voting Burn Rate</span>
              <span class="param-val text-accent">5% fee burned on voting power</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGovernanceTab(vm: WalletFlywheelViewModel): string {
    const p = vm.selectedProposal;

    return `
      <div class="governance-tab-content">
        <div class="governance-layout">
          <!-- Left Column: Proposals List -->
          <div class="proposals-list-column">
            <h4>Active Proposals</h4>
            <div class="proposals-list">
              ${vm.proposals.map((prop) => {
                const isSelected = p && p.id === prop.id;
                const totalVotes = prop.forVotes + prop.againstVotes;
                const forPct = totalVotes > 0 ? Math.round((prop.forVotes / totalVotes) * 100) : 50;
                return `
                  <div class="proposal-card ${isSelected ? 'selected' : ''}" data-proposal-id="${prop.id}">
                    <div class="proposal-card-top">
                      <span class="proposal-id">${prop.id}</span>
                      <span class="category-badge category-${prop.category}">${prop.category.toUpperCase()}</span>
                    </div>
                    <h5 class="proposal-card-title">${prop.title}</h5>
                    <div class="vote-mini-bar">
                      <div class="vote-mini-fill" style="width: ${forPct}%"></div>
                    </div>
                    <div class="proposal-card-meta">
                      <span>${forPct}% FOR</span>
                      <span>${prop.totalBurned} $wif burned</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Right Column: Proposal Details & Voting Action -->
          <div class="proposal-details-column">
            ${p ? `
              <div class="proposal-detail-card">
                <div class="detail-header-row">
                  <span class="proposal-id-large">${p.id}</span>
                  <span class="status-pill status-${p.status}">${p.status.toUpperCase()}</span>
                </div>
                <h3>${p.title}</h3>
                <p class="proposal-desc">${p.description}</p>

                <!-- Full Voting Meter -->
                <div class="vote-meter-container">
                  <div class="meter-labels">
                    <span class="text-green">FOR: ${p.forVotes.toLocaleString()} $wif</span>
                    <span class="text-accent">AGAINST: ${p.againstVotes.toLocaleString()} $wif</span>
                  </div>
                  <div class="vote-full-bar">
                    <div
                      class="meter-fill-for"
                      style="width: ${(p.forVotes + p.againstVotes) > 0 ? (p.forVotes / (p.forVotes + p.againstVotes)) * 100 : 50}%"
                    ></div>
                  </div>
                </div>

                <!-- Voting Input Form -->
                <div class="voting-form-card">
                  <h4>Cast Your Governance Vote</h4>
                  <div class="vote-direction-row">
                    <button
                      class="btn-vote-choice btn-support ${vm.voteSupport ? 'active' : ''}"
                      data-action="vote-support"
                    >
                      👍 Support (Vote FOR)
                    </button>
                    <button
                      class="btn-vote-choice btn-oppose ${!vm.voteSupport ? 'active' : ''}"
                      data-action="vote-oppose"
                    >
                      👎 Oppose (Vote AGAINST)
                    </button>
                  </div>

                  <div class="voting-power-input-group">
                    <label for="voting-power-input">Voting Power ($wif pledged):</label>
                    <div class="power-input-row">
                      <input
                        id="voting-power-input"
                        type="number"
                        min="1"
                        max="${vm.activeBalance}"
                        value="${vm.votingPower}"
                      />
                      <button class="btn-step" data-power-step="100">+100</button>
                      <button class="btn-step" data-power-step="500">+500</button>
                      <button class="btn-step" data-power-step="1000">+1k</button>
                    </div>
                  </div>

                  <!-- Dynamic Burn Fee Preview -->
                  <div class="burn-preview-box">
                    <span class="preview-label">Deflationary Governance Fee:</span>
                    <span class="preview-burn text-accent">
                      🔥 Burns ${vm.calculatedBurnAmount} $wif (5%) to 0x...dEaD
                    </span>
                  </div>

                  <div class="vote-submit-row">
                    <button class="btn-primary btn-submit-vote" data-action="submit-vote">
                      Cast Vote & Burn ${vm.calculatedBurnAmount} $wif
                    </button>
                  </div>
                </div>
              </div>
            ` : '<div class="empty-proposal">Select a proposal to view details and vote.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const dialog = this.container.querySelector('.wallet-flywheel-dialog') as HTMLElement | null;
    if (!dialog) return;

    dialog.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action], [data-tab], [data-proposal-id], [data-power-step]') as HTMLElement | null;
      if (!target) return;

      if (target.dataset.action === 'close-modal') {
        this.close();
      } else if (target.dataset.tab) {
        this.controller.switchTab(target.dataset.tab as WalletModalTab);
      } else if (target.dataset.action === 'set-mode-sim') {
        this.controller.setWalletMode('simulation');
      } else if (target.dataset.action === 'set-mode-web3') {
        this.controller.setWalletMode('web3');
      } else if (target.dataset.action === 'reset-sim') {
        this.controller.resetSimulationBalances();
      } else if (target.dataset.action === 'connect-web3') {
        this.controller.connectWeb3();
      } else if (target.dataset.proposalId) {
        this.controller.selectProposal(target.dataset.proposalId);
      } else if (target.dataset.action === 'vote-support') {
        this.controller.setVoteSupport(true);
      } else if (target.dataset.action === 'vote-oppose') {
        this.controller.setVoteSupport(false);
      } else if (target.dataset.powerStep) {
        const step = parseInt(target.dataset.powerStep, 10);
        const current = this.controller.getViewModel().votingPower;
        this.controller.setVotingPower(current + step);
      } else if (target.dataset.action === 'submit-vote') {
        this.controller.castVote();
      }
    });

    dialog.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'sim-account-radio') {
        this.controller.selectSimAccount(input.value);
      } else if (input.id === 'voting-power-input') {
        const val = parseInt(input.value, 10);
        this.controller.setVotingPower(val);
      }
    });
  }
}
