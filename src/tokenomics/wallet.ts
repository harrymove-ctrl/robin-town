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

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_MAINNET_CHAIN_ID_HEX = '0x1237';
export const ROBINHOOD_MAINNET_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
export const ROBINHOOD_MAINNET_EXPLORER_URL = 'https://robinhoodchain.blockscout.com';
export const ROBINHOOD_TESTNET_L2_CHAIN_ID = 46630;
export const ROBINHOOD_TESTNET_L2_CHAIN_ID_HEX = '0xb626';

export const WIF_TOKEN_CONTRACT_ADDRESS = '0x5173b8eA6923c2d40267890D45C46a3480954773';
export const WIF_TOKEN_DECIMALS = 18;
export const WIF_TOKEN_SYMBOL = 'WIF';
export const WIF_BLOCKSCOUT_TOKEN_URL = `${ROBINHOOD_MAINNET_EXPLORER_URL}/token/${WIF_TOKEN_CONTRACT_ADDRESS}`;
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const BURN_EXPLORER_URL = `${ROBINHOOD_MAINNET_EXPLORER_URL}/address/${BURN_ADDRESS}`;
export const WORLD_IS_FLAT_URL = 'https://worldisflat.fun';
export const WORLD_IS_FLAT_BUILD_URL = 'https://worldisflat.fun/build';
export const WORLD_IS_FLAT_FAIR_URL = 'https://worldisflat.fun/fair/';
export const WIF_PONS_LAUNCHPAD_URL =
  'https://www.ponsfamily.com/launchpad/0x5173b8eA6923c2d40267890D45C46a3480954773';

export interface OnChainWifProof {
  ok: boolean;
  mainnetChainId: number;
  testnetChainId: number;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  mainnetBlockNumber: number;
  testnetBlockNumber: number;
  totalSupplyWif: number;
  burnedDeadBalanceWif: number;
  explorerUrl: string;
  burnAddressUrl: string;
  fetchedAt: string;
}

export interface HarborLeaderboardRow {
  rank: number;
  shortAddress: string;
  verified: boolean;
  chainId: number;
  onChainWifBalance: number;
  matchesPlayed: number;
  wins: number;
  bestNetWorthWif: number;
  totalBurnedWif: number;
  lastSeenAt: string;
}

export interface RecentHarborWalletRow {
  shortAddress: string;
  verified: boolean;
  chainId: number;
  source: string;
  onChainWifBalance: number;
  matchesPlayed: number;
  bestNetWorthWif: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MyHarborWalletStanding {
  address: string;
  shortAddress: string;
  verified: boolean;
  verifiedAt: string | null;
  rank: number | null;
  onChainWifBalance: number;
  matchesPlayed: number;
  wins: number;
  bestNetWorthWif: number;
  totalBurnedWif: number;
  challengeMessage: string;
}

export interface HarborWalletRegistrySummary {
  ok: boolean;
  storePersistent: boolean;
  totalUniqueWallets: number;
  verifiedWallets: number;
  totalMatchesPlayed: number;
  walletMatchesPlayed: number;
  guestMatchesPlayed: number;
  totalWifBurnedInGame: number;
  leaderboard: HarborLeaderboardRow[];
  recentWallets: RecentHarborWalletRow[];
  me: MyHarborWalletStanding | null;
}

export function detectEip1193WalletSource(): string {
  if (typeof window === 'undefined') return 'eip1193';
  const eth = (window as unknown as {
    ethereum?: { isRabby?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean };
  }).ethereum;
  if (!eth) return 'eip1193';
  if (eth.isRabby) return 'rabby';
  if (eth.isCoinbaseWallet) return 'coinbase';
  if (eth.isMetaMask) return 'metamask';
  return 'eip1193';
}

function canCallLocalWalletApi(): boolean {
  return (
    typeof fetch !== 'undefined' &&
    typeof window !== 'undefined' &&
    (window.location?.protocol === 'http:' || window.location?.protocol === 'https:')
  );
}

export async function fetchWalletRegistrySummary(
  viewerAddress?: string | null,
): Promise<HarborWalletRegistrySummary | null> {
  if (!canCallLocalWalletApi()) return null;
  try {
    const query = viewerAddress ? `?address=${encodeURIComponent(viewerAddress)}` : '';
    const res = await fetch(`/api/wallets${query}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<HarborWalletRegistrySummary>;
    if (!data.ok || typeof data.totalUniqueWallets !== 'number') return null;
    return data as HarborWalletRegistrySummary;
  } catch {
    return null;
  }
}

export async function reportWalletConnected(params: {
  address: string;
  chainId: number;
  source?: string;
}): Promise<(HarborWalletRegistrySummary & { isFirstConnect?: boolean }) | null> {
  if (!canCallLocalWalletApi()) return null;
  try {
    const res = await fetch('/api/wallets/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: params.address,
        chainId: params.chainId,
        source: params.source ?? detectEip1193WalletSource(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HarborWalletRegistrySummary & { isFirstConnect?: boolean };
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function submitWalletSignatureVerification(params: {
  address: string;
  signature: string;
}): Promise<
  HarborWalletRegistrySummary & {
    verified?: boolean;
    firstTimeVerified?: boolean;
    bonusTownPoints?: number;
  }
> {
  const res = await fetch('/api/wallets/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as HarborWalletRegistrySummary & {
    error?: string;
    verified?: boolean;
    firstTimeVerified?: boolean;
    bonusTownPoints?: number;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Wallet signature verification failed.');
  }
  return data;
}

export async function reportCompletedMatch(params: {
  address?: string | null;
  finalNetWorthWif: number;
  won: boolean;
  burnedWif?: number;
}): Promise<HarborWalletRegistrySummary | null> {
  if (!canCallLocalWalletApi()) return null;
  try {
    const res = await fetch('/api/wallets/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: params.address ?? null,
        finalNetWorthWif: params.finalNetWorthWif,
        won: params.won,
        burnedWif: params.burnedWif ?? 0,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HarborWalletRegistrySummary;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

function pad32HexAddress(addr: string): string {
  const cleaned = addr.trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(cleaned)) {
    throw new Error(`Invalid 20-byte EVM address: ${addr}`);
  }
  return cleaned.padStart(64, '0');
}

function pad32HexUint256(amount: number, decimals: number = WIF_TOKEN_DECIMALS): string {
  if (amount < 0 || !Number.isFinite(amount)) {
    throw new Error('ERC-20 uint256 amount must be finite and non-negative.');
  }
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(Math.floor(amount));
  const frac = BigInt(Math.round((amount - Math.floor(amount)) * 1e9)) * (scale / 1_000_000_000n);
  const raw = whole * scale + frac;
  return raw.toString(16).padStart(64, '0');
}

/**
 * Encodes ERC-20 `balanceOf(address)` selector `0x70a08231`.
 */
export function encodeErc20BalanceOf(owner: string): string {
  return `0x70a08231${pad32HexAddress(owner)}`;
}

/**
 * Encodes ERC-20 `transfer(address,uint256)` selector `0xa9059cbb`.
 */
export function encodeErc20Transfer(
  to: string,
  amountTokens: number,
  decimals: number = WIF_TOKEN_DECIMALS,
): string {
  return `0xa9059cbb${pad32HexAddress(to)}${pad32HexUint256(amountTokens, decimals)}`;
}

/**
 * Encodes ERC-20 `approve(address,uint256)` selector `0x095ea7b3`.
 */
export function encodeErc20Approve(
  spender: string,
  amountTokens: number,
  decimals: number = WIF_TOKEN_DECIMALS,
): string {
  return `0x095ea7b3${pad32HexAddress(spender)}${pad32HexUint256(amountTokens, decimals)}`;
}

/**
 * Encodes burnable ERC-20 `burn(uint256)` selector `0x42966c68`.
 */
export function encodeErc20Burn(
  amountTokens: number,
  decimals: number = WIF_TOKEN_DECIMALS,
): string {
  return `0x42966c68${pad32HexUint256(amountTokens, decimals)}`;
}

/**
 * Fetches live on-chain `$wif` contract state & `0x...dEaD` burn telemetry from Robinhood Chain.
 * Uses local `/api/onchain-wif` relay first (for zero CORS friction), falling back to direct JSON-RPC.
 */
export async function fetchLiveOnChainWifProof(): Promise<OnChainWifProof | null> {
  if (typeof fetch === 'undefined') return null;

  if (
    typeof window !== 'undefined' &&
    (window.location?.protocol === 'http:' || window.location?.protocol === 'https:')
  ) {
    try {
      const apiRes = await fetch('/api/onchain-wif', { cache: 'no-store' });
      if (apiRes.ok) {
        const data = (await apiRes.json()) as Partial<OnChainWifProof>;
        if (data.ok && typeof data.mainnetBlockNumber === 'number') {
          return data as OnChainWifProof;
        }
      }
    } catch {}
  }

  try {
    const rpcCall = async (method: string, params: unknown[]) => {
      const res = await fetch(ROBINHOOD_MAINNET_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = (await res.json()) as { result?: string };
      return json.result ?? '0x0';
    };

    const [blockHex, deadBalHex, supplyHex] = await Promise.all([
      rpcCall('eth_blockNumber', []),
      rpcCall('eth_call', [
        { to: WIF_TOKEN_CONTRACT_ADDRESS, data: encodeErc20BalanceOf(BURN_ADDRESS) },
        'latest',
      ]),
      rpcCall('eth_call', [{ to: WIF_TOKEN_CONTRACT_ADDRESS, data: '0x18160ddd' }, 'latest']),
    ]);

    const supplyFloat = hexWeiToTokens(supplyHex);
    const deadFloat = hexWeiToTokens(deadBalHex);
    const supplyBurned = Math.max(0, 1_000_000_000 - supplyFloat);

    return {
      ok: true,
      mainnetChainId: ROBINHOOD_MAINNET_CHAIN_ID,
      testnetChainId: ROBINHOOD_TESTNET_L2_CHAIN_ID,
      contractAddress: WIF_TOKEN_CONTRACT_ADDRESS,
      tokenName: 'World is Flat',
      tokenSymbol: WIF_TOKEN_SYMBOL,
      decimals: WIF_TOKEN_DECIMALS,
      mainnetBlockNumber: parseInt(blockHex, 16) || 0,
      testnetBlockNumber: 0,
      totalSupplyWif: Math.round(supplyFloat),
      burnedDeadBalanceWif: Number((deadFloat + supplyBurned).toFixed(2)),
      explorerUrl: WIF_BLOCKSCOUT_TOKEN_URL,
      burnAddressUrl: BURN_EXPLORER_URL,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

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
  currencySymbol: 'ETH',
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
   * Alias for transfer to send tokens or burn fees.
   */
  public async sendTransaction(to: string, amount: number): Promise<WalletTransaction> {
    return this.transfer(to, amount);
  }

  /**
   * Queries live ERC-20 `$wif` token balance via `eth_call` (`balanceOf`) on Robinhood Chain.
   */
  public async getErc20Balance(
    ownerAddress?: string,
    contractAddress: string = WIF_TOKEN_CONTRACT_ADDRESS,
  ): Promise<number> {
    const target = ownerAddress ?? this.getState().account?.address;
    if (!target) return 0;
    if (this.mode === 'simulation' || !this.provider) {
      return this.simBalances.get(normalizeAddress(target)) ?? 0;
    }
    try {
      const hex = (await this.provider.request({
        method: 'eth_call',
        params: [{ to: contractAddress, data: encodeErc20BalanceOf(target) }, 'latest'],
      })) as string;
      return hexWeiToTokens(hex);
    } catch {
      return 0;
    }
  }

  /**
   * Sends an ERC-20 `$wif` token `transfer(address,uint256)` (`0xa9059cbb`) transaction
   * against the verified World is Flat `$wif` contract (`0x5173b8eA6923c2d40267890D45C46a3480954773`).
   */
  public async transferErc20(
    to: string,
    amount: number,
    contractAddress: string = WIF_TOKEN_CONTRACT_ADDRESS,
  ): Promise<WalletTransaction> {
    if (this.mode === 'simulation') {
      return this.transfer(to, amount);
    }
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new Error('Transfer amount must be a positive finite number.');
    }
    const state = this.getState();
    if (!state.account) {
      throw new Error('No active wallet connected.');
    }
    if (!this.provider) {
      throw new Error('Web3 provider not available for ERC-20 transfer.');
    }
    const fromAddress = state.account.address;
    const data = encodeErc20Transfer(to, amount, this.chainConfig.decimals);
    const hash = (await this.provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: fromAddress, to: contractAddress, value: '0x0', data }],
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
  }

  /**
   * Sends an ERC-20 `$wif` `approve(address,uint256)` (`0x095ea7b3`) transaction.
   */
  public async approveErc20(
    spender: string,
    amount: number,
    contractAddress: string = WIF_TOKEN_CONTRACT_ADDRESS,
  ): Promise<WalletTransaction> {
    if (this.mode === 'simulation') {
      return this.approve(spender, amount);
    }
    if (amount < 0 || !Number.isFinite(amount)) {
      throw new Error('Approve amount must be non-negative.');
    }
    const state = this.getState();
    if (!state.account || !this.provider) {
      throw new Error('Web3 provider not available for ERC-20 approve.');
    }
    const fromAddress = state.account.address;
    const data = encodeErc20Approve(spender, amount, this.chainConfig.decimals);
    const hash = (await this.provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: fromAddress, to: contractAddress, value: '0x0', data }],
    })) as string;

    const tx: WalletTransaction = {
      hash,
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

    const bytes = new TextEncoder().encode(message);
    let hexMessage = '0x';
    for (let i = 0; i < bytes.length; i++) {
      hexMessage += bytes[i].toString(16).padStart(2, '0');
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
                nativeCurrency: {
                  name: 'Ether',
                  symbol: this.chainConfig.currencySymbol,
                  decimals: this.chainConfig.decimals,
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
   * Connects an EIP-1193 wallet directly to Robinhood Chain Mainnet (`Chain ID 4663`),
   * adding the network if missing, and loads the live ERC-20 `World is Flat` (`$wif`) balance.
   */
  public async connectMainnetWif(): Promise<WalletAccount> {
    if (!this.provider && typeof window !== 'undefined') {
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (eth) this.provider = eth;
    }
    if (!this.provider) {
      throw new Error('No browser Web3 wallet (MetaMask or Rabby) detected.');
    }
    const previousMode = this.mode;
    const previousAccount = this.web3Account;
    const previousChainId = this.web3ChainId;
    this.mode = 'web3';
    this.status = 'connecting';
    this.errorMessage = null;
    this.setupProviderListeners();
    this.emitState();

    try {
      const accountsResult = await this.provider.request({ method: 'eth_requestAccounts' });
      const accounts = Array.isArray(accountsResult) ? (accountsResult as string[]) : [];
      if (!accounts.length) {
        throw new Error('No wallet account authorized.');
      }
      const activeAddress = accounts[0];

      try {
        await this.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ROBINHOOD_MAINNET_CHAIN_ID_HEX }],
        });
      } catch (switchErr: unknown) {
        const err = switchErr as { code?: number };
        if (err?.code === 4902) {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: ROBINHOOD_MAINNET_CHAIN_ID_HEX,
                chainName: 'Robinhood Chain',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [ROBINHOOD_MAINNET_RPC_URL],
                blockExplorerUrls: [ROBINHOOD_MAINNET_EXPLORER_URL],
              },
            ],
          });
        } else {
          throw switchErr;
        }
      }

      this.web3ChainId = ROBINHOOD_MAINNET_CHAIN_ID;
      const wifBal = await this.getErc20Balance(activeAddress, WIF_TOKEN_CONTRACT_ADDRESS);
      this.web3Account = {
        address: activeAddress,
        name: `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`,
        balance: Number(wifBal.toFixed(4)),
        isSimulated: false,
      };
      this.status = 'connected';
      this.emitState();
      return this.web3Account;
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      this.mode = previousAccount ? previousMode : 'simulation';
      this.web3Account = previousAccount;
      this.web3ChainId = previousChainId;
      this.status = 'connected';
      this.errorMessage = errorObj?.message || 'Wallet connection cancelled.';
      this.emitState();
      throw err;
    }
  }

  /**
   * Broadcasts a real on-chain `$wif` burn (`transfer` to `0x...dEaD`) on Robinhood Chain Mainnet (`4663`).
   */
  public async burnMainnetWif(amountTokens: number = 0.1): Promise<WalletTransaction> {
    if (this.mode !== 'web3' || this.web3ChainId !== ROBINHOOD_MAINNET_CHAIN_ID) {
      await this.connectMainnetWif();
    }
    const tx = await this.transferErc20(BURN_ADDRESS, amountTokens, WIF_TOKEN_CONTRACT_ADDRESS);
    if (this.web3Account) {
      const nextBal = await this.getErc20Balance(this.web3Account.address, WIF_TOKEN_CONTRACT_ADDRESS);
      this.web3Account.balance = Number(nextBal.toFixed(4));
      this.emitState();
    }
    return tx;
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
      const balance =
        this.web3ChainId === ROBINHOOD_MAINNET_CHAIN_ID
          ? Number(
              (
                await this.getErc20Balance(this.web3Account.address, WIF_TOKEN_CONTRACT_ADDRESS)
              ).toFixed(4),
            )
          : hexWeiToTokens(
              (await this.provider.request({
                method: 'eth_getBalance',
                params: [this.web3Account.address, 'latest'],
              })) as string,
            );
      if (this.web3Account) {
        this.web3Account.balance = balance;
        this.emitState();
      }
    } catch {
      // Keep previous balance on network error
    }
  }
}
