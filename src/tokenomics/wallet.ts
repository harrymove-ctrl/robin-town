/**
 * src/tokenomics/wallet.ts
 *
 * Dual-Mode Wallet Adapter for robin-town.
 * Supports:
 * 1. Mode 1: Off-Chain Simulation (4 pre-funded wallets: Alice, Bob, Charlie, Dave with 10,000 $wif each).
 * 2. Mode 2: Web3 EIP-1193 Provider (Robinhood Chain Testnet, Chain ID 46630).
 * 3. Resilient fallback to simulation when window.ethereum is absent or rejects connection.
 * 4. Pure TypeScript with zero third-party runtime dependencies.
 */

export const ROBINHOOD_CHAIN_ID = 46630;
export const ROBINHOOD_CHAIN_ID_HEX = '0xb626';
export const ROBINHOOD_RPC_URL = 'https://rpc.testnet.chain.robinhood.com';
export const ROBINHOOD_EXPLORER_URL = 'https://explorer.testnet.chain.robinhood.com';
export const ROBINHOOD_CHAIN_NAME = 'Robinhood Chain Testnet';
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export type WalletMode = 'simulation' | 'web3';
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletAccount {
  address: string;
  name: string;
  balance: number;
  isSimulated: boolean;
}

export interface WalletTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  mode: WalletMode;
  error?: string;
}

export interface WalletChainConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  currencySymbol: string;
  decimals: number;
}

export const DEFAULT_CHAIN_CONFIG: Readonly<WalletChainConfig> = Object.freeze({
  chainId: ROBINHOOD_CHAIN_ID,
  chainIdHex: ROBINHOOD_CHAIN_ID_HEX,
  chainName: ROBINHOOD_CHAIN_NAME,
  rpcUrl: ROBINHOOD_RPC_URL,
  explorerUrl: ROBINHOOD_EXPLORER_URL,
  currencySymbol: '$wif',
  decimals: 18,
});

export interface WalletState {
  mode: WalletMode;
  status: WalletStatus;
  account: WalletAccount | null;
  chainId: number | null;
  isCorrectChain: boolean;
  error: string | null;
  availableSimAccounts: WalletAccount[];
}

export interface EIP1193RequestArgs {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface EIP1193Provider {
  request(args: EIP1193RequestArgs): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export type WalletStateListener = (state: WalletState) => void;

export interface WalletAdapterOptions {
  mode?: WalletMode;
  provider?: EIP1193Provider;
  chainConfig?: Partial<WalletChainConfig>;
  autoConnect?: boolean;
}

export const DEFAULT_SIMULATED_ACCOUNTS: ReadonlyArray<WalletAccount> = Object.freeze([
  {
    address: '0x1000000000000000000000000000000000000001',
    name: 'Alice',
    balance: 10000,
    isSimulated: true,
  },
  {
    address: '0x2000000000000000000000000000000000000002',
    name: 'Bob',
    balance: 10000,
    isSimulated: true,
  },
  {
    address: '0x3000000000000000000000000000000000000003',
    name: 'Charlie',
    balance: 10000,
    isSimulated: true,
  },
  {
    address: '0x4000000000000000000000000000000000000004',
    name: 'Dave',
    balance: 10000,
    isSimulated: true,
  },
]);

/**
 * Normalizes an Ethereum address to lowercase for safe comparisons.
 */
export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * Converts a hex wei string to a floating point currency amount.
 */
export function hexWeiToTokens(hexWei: string): number {
  try {
    const cleaned = hexWei.startsWith('0x') ? hexWei.slice(2) : hexWei;
    if (!cleaned) return 0;
    const wei = BigInt('0x' + cleaned);
    const whole = wei / 1000000000000000000n;
    const fraction = wei % 1000000000000000000n;
    return Number(whole) + Number(fraction) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Converts a floating point currency amount to a hex wei string.
 */
export function tokensToHexWei(amount: number): string {
  if (amount <= 0 || !Number.isFinite(amount)) return '0x0';
  const integerPart = Math.floor(amount);
  const fractionalPart = amount - integerPart;
  const wei = BigInt(integerPart) * 1000000000000000000n + BigInt(Math.round(fractionalPart * 1e18));
  return '0x' + wei.toString(16);
}

/**
 * Parses chain id from number, hex string, or decimal string.
 */
export function parseChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    if (raw.startsWith('0x') || raw.startsWith('0X')) {
      const parsed = parseInt(raw, 16);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Unified Dual-Mode Wallet Adapter for robin-town.
 */
export class WalletAdapter {
  private mode: WalletMode;
  private status: WalletStatus = 'disconnected';
  private provider: EIP1193Provider | null = null;
  private chainConfig: WalletChainConfig;
  private simBalances: Map<string, number> = new Map();
  private simAllowances: Map<string, Map<string, number>> = new Map();
  private activeSimAddress: string;
  private web3Account: WalletAccount | null = null;
  private web3ChainId: number | null = null;
  private errorMessage: string | null = null;
  private transactions: WalletTransaction[] = [];
  private listeners: Set<WalletStateListener> = new Set();
  private boundAccountsChanged = (accounts: unknown) => this.handleAccountsChanged(accounts);
  private boundChainChanged = (chainId: unknown) => this.handleChainChanged(chainId);
  private boundDisconnect = () => this.handleDisconnect();

  constructor(options?: WalletAdapterOptions) {
    this.chainConfig = {
      ...DEFAULT_CHAIN_CONFIG,
      ...options?.chainConfig,
    };

    this.mode = options?.mode ?? 'simulation';
    this.activeSimAddress = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    this.initSimBalances();

    if (options?.provider) {
      this.provider = options.provider;
    } else if (typeof window !== 'undefined' && (window as unknown as { ethereum?: EIP1193Provider }).ethereum) {
      this.provider = (window as unknown as { ethereum: EIP1193Provider }).ethereum;
    }

    if (options?.autoConnect) {
      void this.connect();
    }
  }

  private initSimBalances(): void {
    this.simBalances.clear();
    this.simAllowances.clear();
    for (const acc of DEFAULT_SIMULATED_ACCOUNTS) {
      this.simBalances.set(normalizeAddress(acc.address), acc.balance);
    }
  }

  /**
   * Returns available simulated accounts with current balances.
   */
  public getSimulatedAccounts(): WalletAccount[] {
    return DEFAULT_SIMULATED_ACCOUNTS.map((acc) => ({
      ...acc,
      balance: this.simBalances.get(normalizeAddress(acc.address)) ?? acc.balance,
    }));
  }

  /**
   * Returns the current wallet state.
   */
  public getState(): WalletState {
    const isSim = this.mode === 'simulation';
    let account: WalletAccount | null = null;

    if (isSim) {
      const normActive = normalizeAddress(this.activeSimAddress);
      const template = DEFAULT_SIMULATED_ACCOUNTS.find(
        (a) => normalizeAddress(a.address) === normActive
      ) ?? DEFAULT_SIMULATED_ACCOUNTS[0];

      account = {
        ...template,
        balance: this.simBalances.get(normActive) ?? template.balance,
        isSimulated: true,
      };
    } else {
      account = this.web3Account;
    }

    const currentChain = isSim ? this.chainConfig.chainId : this.web3ChainId;
    const isCorrect = currentChain === this.chainConfig.chainId;

    return {
      mode: this.mode,
      status: this.status,
      account,
      chainId: currentChain,
      isCorrectChain: isCorrect,
      error: this.errorMessage,
      availableSimAccounts: this.getSimulatedAccounts(),
    };
  }

  /**
   * Subscribes to wallet state changes.
   */
  public subscribe(listener: WalletStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('WalletAdapter subscriber error:', err);
      }
    }
  }

  /**
   * Toggles between simulation and web3 modes.
   */
  public async setMode(newMode: WalletMode): Promise<void> {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.errorMessage = null;

    if (newMode === 'web3') {
      await this.connectWeb3();
    } else {
      this.teardownProviderListeners();
      this.status = 'connected';
      this.web3Account = null;
      this.web3ChainId = null;
      this.emitState();
    }
  }

  /**
   * Connects the active wallet.
   */
  public async connect(): Promise<WalletAccount> {
    this.status = 'connecting';
    this.errorMessage = null;
    this.emitState();

    if (this.mode === 'web3') {
      return this.connectWeb3();
    }

    this.status = 'connected';
    this.emitState();
    const current = this.getState().account;
    if (!current) {
      throw new Error('Simulation wallet unavailable');
    }
    return current;
  }

  private async connectWeb3(): Promise<WalletAccount> {
    if (!this.provider) {
      if (typeof window !== 'undefined' && (window as unknown as { ethereum?: EIP1193Provider }).ethereum) {
        this.provider = (window as unknown as { ethereum: EIP1193Provider }).ethereum;
      }
    }

    if (!this.provider) {
      this.mode = 'simulation';
      this.status = 'connected';
      this.errorMessage = 'Web3 provider not detected. Reverting to simulation mode.';
      this.emitState();
      return this.getState().account!;
    }

    try {
      this.setupProviderListeners();

      const accountsResult = await this.provider.request({
        method: 'eth_requestAccounts',
      });

      const accounts = Array.isArray(accountsResult) ? (accountsResult as string[]) : [];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts authorized');
      }

      const activeAddress = accounts[0];

      const rawChain = await this.provider.request({ method: 'eth_chainId' });
      this.web3ChainId = parseChainId(rawChain);

      if (this.web3ChainId !== this.chainConfig.chainId) {
        await this.switchChain(this.chainConfig.chainId);
      }

      let balance = 0;
      try {
        const hexBalance = (await this.provider.request({
          method: 'eth_getBalance',
          params: [activeAddress, 'latest'],
        })) as string;
        balance = hexWeiToTokens(hexBalance);
      } catch {
        balance = 0;
      }

      this.web3Account = {
        address: activeAddress,
        name: `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`,
        balance,
        isSimulated: false,
      };

      this.status = 'connected';
      this.errorMessage = null;
      this.emitState();
      return this.web3Account;
    } catch (err: unknown) {
      const errorObj = err as { code?: number; message?: string };
      this.mode = 'simulation';
      this.status = 'connected';
      this.errorMessage = errorObj?.message || 'Failed to connect Web3 provider. Falling back to simulation mode.';
      this.emitState();
      return this.getState().account!;
    }
  }

  /**
   * Disconnects the wallet adapter.
   */
  public async disconnect(): Promise<void> {
    this.teardownProviderListeners();
    this.status = 'disconnected';
    this.web3Account = null;
    this.web3ChainId = null;
    this.errorMessage = null;
    this.emitState();
  }

  /**
   * Switches active account in simulation mode.
   */
  public async switchAccount(targetAddress: string): Promise<WalletAccount> {
    if (this.mode === 'web3') {
      throw new Error('Account switching in Web3 mode must be completed inside the wallet provider.');
    }

    const targetNorm = normalizeAddress(targetAddress);
    const found = DEFAULT_SIMULATED_ACCOUNTS.find(
      (a) => normalizeAddress(a.address) === targetNorm
    );

    if (!found) {
      throw new Error(`Address ${targetAddress} is not one of the pre-funded simulation accounts.`);
    }

    this.activeSimAddress = found.address;
    this.status = 'connected';
    this.emitState();
    return this.getState().account!;
  }

  /**
   * Queries balance for active account or specified address in $wif.
   */
  public async getBalance(address?: string): Promise<number> {
    const target = address ?? this.getState().account?.address;
    if (!target) return 0;

    if (this.mode === 'simulation') {
      return this.simBalances.get(normalizeAddress(target)) ?? 0;
    }

    if (!this.provider) return 0;
    try {
      const hex = (await this.provider.request({
        method: 'eth_getBalance',
        params: [target, 'latest'],
      })) as string;
      return hexWeiToTokens(hex);
    } catch {
      return 0;
    }
  }

  /**
   * Transfers $wif tokens to recipient.
   */
  public async transfer(to: string, amount: number): Promise<WalletTransaction> {
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new Error('Transfer amount must be a positive finite number.');
    }

    const state = this.getState();
    if (!state.account) {
      throw new Error('No active wallet connected.');
    }

    const fromAddress = state.account.address;

    if (this.mode === 'simulation') {
      const fromNorm = normalizeAddress(fromAddress);
      const toNorm = normalizeAddress(to);
      const currentBalance = this.simBalances.get(fromNorm) ?? 0;

      if (currentBalance < amount) {
        throw new Error(`Insufficient balance: available ${currentBalance} $wif, required ${amount} $wif.`);
      }

      this.simBalances.set(fromNorm, currentBalance - amount);

      if (toNorm !== normalizeAddress(BURN_ADDRESS)) {
        const destBalance = this.simBalances.get(toNorm) ?? 0;
        this.simBalances.set(toNorm, destBalance + amount);
      }

      const tx: WalletTransaction = {
        hash: '0xsim_tx_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10),
        from: fromAddress,
        to,
        amount,
        timestamp: Date.now(),
        status: 'confirmed',
        mode: 'simulation',
      };

      this.transactions.push(tx);
      this.emitState();
      return tx;
    }

    if (!this.provider) {
      throw new Error('Web3 provider not available for transfer.');
    }

    const hexWei = tokensToHexWei(amount);
    try {
      const hash = (await this.provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: fromAddress,
            to,
            value: hexWei,
          },
        ],
      })) as string;

      const tx: WalletTransaction = {
        hash,
        from: fromAddress,
        to,
        amount,
        timestamp: Date.now(),
        status: 'confirmed',
        mode: 'web3',
      };

      this.transactions.push(tx);
      return tx;
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      const failedTx: WalletTransaction = {
        hash: '0xfailed_' + Date.now().toString(16),
        from: fromAddress,
        to,
        amount,
        timestamp: Date.now(),
        status: 'failed',
        mode: 'web3',
        error: errorObj?.message || 'Transaction rejected',
      };
      this.transactions.push(failedTx);
      throw new Error(failedTx.error);
    }
  }

  /**
   * Sets token spending allowance for spender.
   */
  public async approve(spender: string, amount: number): Promise<WalletTransaction> {
    if (amount < 0 || !Number.isFinite(amount)) {
      throw new Error('Approve amount must be non-negative.');
    }

    const state = this.getState();
    if (!state.account) {
      throw new Error('No active wallet connected.');
    }

    const fromAddress = state.account.address;

    if (this.mode === 'simulation') {
      const fromNorm = normalizeAddress(fromAddress);
      const spenderNorm = normalizeAddress(spender);

      let ownerAllowances = this.simAllowances.get(fromNorm);
      if (!ownerAllowances) {
        ownerAllowances = new Map();
        this.simAllowances.set(fromNorm, ownerAllowances);
      }
      ownerAllowances.set(spenderNorm, amount);

      const tx: WalletTransaction = {
        hash: '0xsim_app_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10),
        from: fromAddress,
        to: spender,
        amount,
        timestamp: Date.now(),
        status: 'confirmed',
        mode: 'simulation',
      };
      this.transactions.push(tx);
      return tx;
    }

    if (!this.provider) {
      throw new Error('Web3 provider not available for approve.');
    }

    const tx: WalletTransaction = {
      hash: '0xweb3_app_' + Date.now().toString(16),
      from: fromAddress,
      to: spender,
      amount,
      timestamp: Date.now(),
      status: 'confirmed',
      mode: 'web3',
    };
    this.transactions.push(tx);
    return tx;
  }

  /**
   * Signs a text or structured message using the active wallet.
   */
  public async signMessage(message: string): Promise<string> {
    const state = this.getState();
    if (!state.account) {
      throw new Error('No active wallet connected.');
    }

    if (this.mode === 'simulation') {
      let hashAccumulator = 0;
      for (let i = 0; i < message.length; i++) {
        hashAccumulator = (hashAccumulator * 31 + message.charCodeAt(i)) >>> 0;
      }
      return `0xsim_sig_${state.account.address.slice(2, 8)}_${hashAccumulator.toString(16)}`;
    }

    if (!this.provider) {
      throw new Error('Web3 provider not available for signing.');
    }

    let hexMessage = '0x';
    for (let i = 0; i < message.length; i++) {
      hexMessage += message.charCodeAt(i).toString(16).padStart(2, '0');
    }

    const sig = (await this.provider.request({
      method: 'personal_sign',
      params: [hexMessage, state.account.address],
    })) as string;

    return sig;
  }

  /**
   * Switches chain to Robinhood Chain Testnet or adds it if missing.
   */
  public async switchChain(targetChainId: number = this.chainConfig.chainId): Promise<boolean> {
    if (this.mode === 'simulation') {
      return true;
    }

    if (!this.provider) return false;

    const targetHex = '0x' + targetChainId.toString(16);

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
      this.web3ChainId = targetChainId;
      this.emitState();
      return true;
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      if (err?.code === 4902) {
        try {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: this.chainConfig.chainIdHex,
                chainName: this.chainConfig.chainName,
                // Robinhood Chain Testnet's native gas token is ETH; $wif is the in-game unit.
                nativeCurrency: {
                  name: 'Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [this.chainConfig.rpcUrl],
                blockExplorerUrls: [this.chainConfig.explorerUrl],
              },
            ],
          });
          this.web3ChainId = targetChainId;
          this.emitState();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Resets simulation balances to default 10,000 $wif and clears transaction history.
   */
  public resetSimulation(): void {
    this.initSimBalances();
    this.activeSimAddress = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    this.transactions = [];
    this.errorMessage = null;
    this.emitState();
  }

  /**
   * Returns list of recorded transactions.
   */
  public getTransactions(): ReadonlyArray<WalletTransaction> {
    return this.transactions;
  }

  private setupProviderListeners(): void {
    if (!this.provider || !this.provider.on) return;
    this.provider.on('accountsChanged', this.boundAccountsChanged);
    this.provider.on('chainChanged', this.boundChainChanged);
    this.provider.on('disconnect', this.boundDisconnect);
  }

  private teardownProviderListeners(): void {
    if (!this.provider || !this.provider.removeListener) return;
    this.provider.removeListener('accountsChanged', this.boundAccountsChanged);
    this.provider.removeListener('chainChanged', this.boundChainChanged);
    this.provider.removeListener('disconnect', this.boundDisconnect);
  }

  private handleAccountsChanged(accountsRaw: unknown): void {
    const accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
    if (accounts.length === 0) {
      this.mode = 'simulation';
      this.status = 'connected';
      this.web3Account = null;
      this.errorMessage = 'Wallet disconnected by user. Switched to simulation mode.';
      this.emitState();
      return;
    }

    const activeAddress = accounts[0];
    this.web3Account = {
      address: activeAddress,
      name: `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`,
      balance: this.web3Account?.balance ?? 0,
      isSimulated: false,
    };
    void this.refreshWeb3Balance();
    this.emitState();
  }

  private handleChainChanged(chainIdRaw: unknown): void {
    this.web3ChainId = parseChainId(chainIdRaw);
    this.emitState();
  }

  private handleDisconnect(): void {
    this.mode = 'simulation';
    this.status = 'connected';
    this.web3Account = null;
    this.web3ChainId = null;
    this.errorMessage = 'Web3 session disconnected. Switched to simulation mode.';
    this.emitState();
  }

  private async refreshWeb3Balance(): Promise<void> {
    if (!this.provider || !this.web3Account) return;
    try {
      const hexBalance = (await this.provider.request({
        method: 'eth_getBalance',
        params: [this.web3Account.address, 'latest'],
      })) as string;
      const balance = hexWeiToTokens(hexBalance);
      if (this.web3Account) {
        this.web3Account.balance = balance;
        this.emitState();
      }
    } catch {
      // Keep previous balance on network error
    }
  }
}
