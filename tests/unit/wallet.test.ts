/**
 * tests/unit/wallet.test.ts
 *
 * Comprehensive unit test suite for WalletAdapter and tokenomics utilities.
 * Verifies simulation mode, deterministic pre-funded balances, transfer and burn mechanics,
 * Web3 EIP-1193 provider integration, resilient fallback triggers, and event subscriptions.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  WalletAdapter,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_ID_HEX,
  BURN_ADDRESS,
  DEFAULT_SIMULATED_ACCOUNTS,
  hexWeiToTokens,
  tokensToHexWei,
  parseChainId,
  normalizeAddress,
} from '../../src/tokenomics/wallet';
import type { EIP1193Provider, EIP1193RequestArgs, WalletState } from '../../src/tokenomics/wallet';

/**
 * Creates an in-memory mock EIP-1193 provider for testing.
 */
function createMockProvider(initialConfig?: {
  accounts?: string[];
  chainId?: string | number;
  balanceHex?: string;
  rejectAccounts?: boolean;
  switchChainError?: { code: number; message: string };
}) {
  const accounts = initialConfig?.accounts ?? ['0x71C83D4222fD2A35084920CE61F037A332e705bB'];
  let currentChainId = initialConfig?.chainId ?? ROBINHOOD_CHAIN_ID_HEX;
  const balanceHex = initialConfig?.balanceHex ?? '0x21e19e0c9bab2400000'; // 10,000 in wei
  const calls: { method: string; params?: unknown }[] = [];
  const listeners: Map<string, Set<Function>> = new Map();

  const provider: EIP1193Provider = {
    async request(args: EIP1193RequestArgs): Promise<unknown> {
      calls.push({ method: args.method, params: args.params });

      if (args.method === 'eth_requestAccounts') {
        if (initialConfig?.rejectAccounts) {
          const err = new Error('User rejected connection');
          (err as unknown as { code: number }).code = 4001;
          throw err;
        }
        return accounts;
      }

      if (args.method === 'eth_accounts') {
        return accounts;
      }

      if (args.method === 'eth_chainId') {
        return typeof currentChainId === 'number'
          ? '0x' + currentChainId.toString(16)
          : currentChainId;
      }

      if (args.method === 'wallet_switchEthereumChain') {
        if (initialConfig?.switchChainError) {
          const err = new Error(initialConfig.switchChainError.message);
          (err as unknown as { code: number }).code = initialConfig.switchChainError.code;
          throw err;
        }
        const params = args.params as [{ chainId: string }];
        currentChainId = params[0].chainId;
        return null;
      }

      if (args.method === 'wallet_addEthereumChain') {
        const params = args.params as [{ chainId: string }];
        currentChainId = params[0].chainId;
        return null;
      }

      if (args.method === 'eth_getBalance') {
        return balanceHex;
      }

      if (args.method === 'eth_sendTransaction') {
        return '0xmock_tx_hash_1234567890abcdef';
      }

      if (args.method === 'personal_sign') {
        return '0xmock_signature_1234567890abcdef';
      }

      throw new Error(`Unhandled RPC method: ${args.method}`);
    },

    on(event: string, listener: Function) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    },

    removeListener(event: string, listener: Function) {
      listeners.get(event)?.delete(listener);
    },
  };

  return {
    provider,
    calls,
    emit(event: string, data: unknown) {
      const set = listeners.get(event);
      if (set) {
        for (const fn of set) {
          fn(data);
        }
      }
    },
    getChainId() {
      return currentChainId;
    },
  };
}

describe('Wallet Utility Functions', () => {
  it('normalizes addresses to lowercase and trimmed strings', () => {
    assert.strictEqual(
      normalizeAddress('  0x1000000000000000000000000000000000000001  '),
      '0x1000000000000000000000000000000000000001'
    );
    assert.strictEqual(
      normalizeAddress('0xDEADBEEF'),
      '0xdeadbeef'
    );
  });

  it('converts hex wei to decimal token numbers accurately', () => {
    assert.strictEqual(hexWeiToTokens('0x0'), 0);
    assert.strictEqual(hexWeiToTokens(''), 0);
    assert.strictEqual(hexWeiToTokens('invalid'), 0);
    assert.strictEqual(hexWeiToTokens('0xde0b6b3a7640000'), 1);
    assert.strictEqual(hexWeiToTokens('0x21e19e0c9bab2400000'), 10000);
  });

  it('converts decimal token numbers to hex wei strings', () => {
    assert.strictEqual(tokensToHexWei(0), '0x0');
    assert.strictEqual(tokensToHexWei(-10), '0x0');
    assert.strictEqual(tokensToHexWei(1), '0xde0b6b3a7640000');
    assert.strictEqual(tokensToHexWei(10000), '0x21e19e0c9bab2400000');
  });

  it('parses diverse chain ID representations safely', () => {
    assert.strictEqual(parseChainId(46631), 46631);
    assert.strictEqual(parseChainId('0xb627'), 46631);
    assert.strictEqual(parseChainId('0xB627'), 46631);
    assert.strictEqual(parseChainId('46631'), 46631);
    assert.strictEqual(parseChainId(null), null);
    assert.strictEqual(parseChainId(undefined), null);
    assert.strictEqual(parseChainId('not_a_number'), null);
  });
});

describe('Mode 1: Off-Chain Simulation Initialization', () => {
  it('initializes in simulation mode with connected status and zero errors', () => {
    const adapter = new WalletAdapter();
    const state = adapter.getState();

    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'disconnected');
    assert.strictEqual(state.isCorrectChain, true);
    assert.strictEqual(state.chainId, ROBINHOOD_CHAIN_ID);
    assert.strictEqual(state.error, null);
    assert.ok(state.account !== null);
    assert.strictEqual(state.account?.name, 'Alice');
    assert.strictEqual(state.account?.address, DEFAULT_SIMULATED_ACCOUNTS[0].address);
    assert.strictEqual(state.account?.isSimulated, true);
    assert.strictEqual(state.account?.balance, 10000);
  });

  it('provides exactly 4 pre-funded simulation accounts with 10,000 $wif each', () => {
    const adapter = new WalletAdapter();
    const accounts = adapter.getSimulatedAccounts();

    assert.strictEqual(accounts.length, 4);

    const names = accounts.map((a) => a.name);
    assert.deepStrictEqual(names, ['Alice', 'Bob', 'Charlie', 'Dave']);

    for (const acc of accounts) {
      assert.strictEqual(acc.balance, 10000);
      assert.strictEqual(acc.isSimulated, true);
      assert.ok(acc.address.startsWith('0x'));
    }
  });

  it('connects simulation wallet and updates status', async () => {
    const adapter = new WalletAdapter();
    const account = await adapter.connect();

    assert.strictEqual(account.name, 'Alice');
    assert.strictEqual(adapter.getState().status, 'connected');
  });
});

describe('Mode 1: Simulation Operations (Transfer, Burn, Sign, Approve)', () => {
  it('transfers $wif between simulated accounts and updates balances', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    const bobAddr = DEFAULT_SIMULATED_ACCOUNTS[1].address;

    const tx = await adapter.transfer(bobAddr, 1500);

    assert.strictEqual(tx.status, 'confirmed');
    assert.strictEqual(tx.amount, 1500);
    assert.strictEqual(tx.mode, 'simulation');
    assert.ok(tx.hash.startsWith('0xsim_tx_'));

    const aliceBalance = await adapter.getBalance(aliceAddr);
    const bobBalance = await adapter.getBalance(bobAddr);

    assert.strictEqual(aliceBalance, 8500);
    assert.strictEqual(bobBalance, 11500);
  });

  it('burns $wif when transferred to dead burn address without crediting any account', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    await adapter.transfer(BURN_ADDRESS, 2000);

    const aliceBalance = await adapter.getBalance(aliceAddr);
    assert.strictEqual(aliceBalance, 8000);

    const accounts = adapter.getSimulatedAccounts();
    for (const acc of accounts) {
      if (acc.name !== 'Alice') {
        assert.strictEqual(acc.balance, 10000);
      }
    }
  });

  it('rejects transfer when amount exceeds account balance', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    await assert.rejects(
      async () => {
        await adapter.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, 99999);
      },
      /Insufficient balance/
    );
  });

  it('rejects transfer when amount is zero or negative', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    await assert.rejects(
      async () => {
        await adapter.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, 0);
      },
      /Transfer amount must be a positive finite number/
    );

    await assert.rejects(
      async () => {
        await adapter.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, -50);
      },
      /Transfer amount must be a positive finite number/
    );
  });

  it('switches active simulated account and executes transfers from new account', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const bob = await adapter.switchAccount(DEFAULT_SIMULATED_ACCOUNTS[1].address);
    assert.strictEqual(bob.name, 'Bob');
    assert.strictEqual(adapter.getState().account?.name, 'Bob');

    const charlieAddr = DEFAULT_SIMULATED_ACCOUNTS[2].address;
    await adapter.transfer(charlieAddr, 500);

    const bobBalance = await adapter.getBalance();
    const charlieBalance = await adapter.getBalance(charlieAddr);

    assert.strictEqual(bobBalance, 9500);
    assert.strictEqual(charlieBalance, 10500);
  });

  it('rejects switching to an un-simulated address', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    await assert.rejects(
      async () => {
        await adapter.switchAccount('0x9999999999999999999999999999999999999999');
      },
      /not one of the pre-funded simulation accounts/
    );
  });

  it('approves token allowance and returns confirmed transaction', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const tx = await adapter.approve('0x5555555555555555555555555555555555555555', 5000);
    assert.strictEqual(tx.status, 'confirmed');
    assert.strictEqual(tx.amount, 5000);
    assert.strictEqual(tx.mode, 'simulation');
  });

  it('signs messages with simulated cryptographic hash', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const sig1 = await adapter.signMessage('Trade offer: 100 $wif for Parcel 12');
    const sig2 = await adapter.signMessage('Trade offer: 100 $wif for Parcel 12');
    const sig3 = await adapter.signMessage('Different message');

    assert.ok(sig1.startsWith('0xsim_sig_'));
    assert.strictEqual(sig1, sig2);
    assert.notStrictEqual(sig1, sig3);
  });

  it('resets simulation state back to original 10,000 $wif balances', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    await adapter.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, 4000);
    assert.strictEqual(await adapter.getBalance(DEFAULT_SIMULATED_ACCOUNTS[0].address), 6000);

    adapter.resetSimulation();

    assert.strictEqual(await adapter.getBalance(DEFAULT_SIMULATED_ACCOUNTS[0].address), 10000);
    assert.strictEqual(await adapter.getBalance(DEFAULT_SIMULATED_ACCOUNTS[1].address), 10000);
    assert.strictEqual(adapter.getTransactions().length, 0);
  });
});

describe('Mode 2: Web3 EIP-1193 Provider Integration', () => {
  it('connects to Web3 provider and retrieves active account and balance', async () => {
    const mock = createMockProvider({
      accounts: ['0x1111111111111111111111111111111111111111'],
      chainId: ROBINHOOD_CHAIN_ID_HEX,
      balanceHex: '0x10f0cf064dd59200000',
    });

    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    const account = await adapter.connect();

    assert.strictEqual(account.isSimulated, false);
    assert.strictEqual(account.address, '0x1111111111111111111111111111111111111111');
    assert.strictEqual(account.balance, 5000);

    const state = adapter.getState();
    assert.strictEqual(state.mode, 'web3');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(state.isCorrectChain, true);
    assert.strictEqual(state.chainId, ROBINHOOD_CHAIN_ID);
  });

  it('automatically requests chain switch when connected to mismatched chain', async () => {
    const mock = createMockProvider({
      chainId: '0x1',
    });

    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();

    const switchCalls = mock.calls.filter((c) => c.method === 'wallet_switchEthereumChain');
    assert.strictEqual(switchCalls.length, 1);
    assert.deepStrictEqual(switchCalls[0].params, [{ chainId: ROBINHOOD_CHAIN_ID_HEX }]);
  });

  it('automatically adds chain if switch returns error code 4902', async () => {
    const mock = createMockProvider({
      chainId: '0x1',
      switchChainError: { code: 4902, message: 'Unrecognized chain' },
    });

    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();

    const addCalls = mock.calls.filter((c) => c.method === 'wallet_addEthereumChain');
    assert.strictEqual(addCalls.length, 1);
  });

  it('sends Web3 transaction via eth_sendTransaction with converted wei value', async () => {
    const mock = createMockProvider();
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    const tx = await adapter.transfer('0x2222222222222222222222222222222222222222', 100);

    assert.strictEqual(tx.status, 'confirmed');
    assert.strictEqual(tx.mode, 'web3');
    assert.strictEqual(tx.hash, '0xmock_tx_hash_1234567890abcdef');

    const sendCalls = mock.calls.filter((c) => c.method === 'eth_sendTransaction');
    assert.strictEqual(sendCalls.length, 1);
  });

  it('signs Web3 messages via personal_sign with hex encoded payload', async () => {
    const mock = createMockProvider();
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    const sig = await adapter.signMessage('Robinhood Hackathon 2026');

    assert.strictEqual(sig, '0xmock_signature_1234567890abcdef');
    const signCalls = mock.calls.filter((c) => c.method === 'personal_sign');
    assert.strictEqual(signCalls.length, 1);
  });
});

describe('Mode 3: Resilient Fallback Mechanics', () => {
  it('falls back to simulation mode when no Web3 provider is present in environment', async () => {
    const adapter = new WalletAdapter({
      mode: 'web3',
    });

    const account = await adapter.connect();

    const state = adapter.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(account.isSimulated, true);
    assert.ok(state.error?.includes('Web3 provider not detected'));
  });

  it('falls back to simulation mode when user rejects wallet connection request', async () => {
    const mock = createMockProvider({
      rejectAccounts: true,
    });

    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    const account = await adapter.connect();

    const state = adapter.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(account.name, 'Alice');
    assert.ok(state.error?.includes('User rejected'));
  });

  it('falls back to simulation when accountsChanged emits empty array', async () => {
    const mock = createMockProvider();
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    assert.strictEqual(adapter.getState().mode, 'web3');

    mock.emit('accountsChanged', []);

    const state = adapter.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.ok(state.error?.includes('disconnected by user'));
  });

  it('falls back to simulation when provider emits disconnect event', async () => {
    const mock = createMockProvider();
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    assert.strictEqual(adapter.getState().mode, 'web3');

    mock.emit('disconnect', {});

    const state = adapter.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.ok(state.error?.includes('disconnected'));
  });

  it('allows manual toggling between simulation and web3 modes', async () => {
    const mock = createMockProvider();
    const adapter = new WalletAdapter({
      provider: mock.provider,
    });

    assert.strictEqual(adapter.getState().mode, 'simulation');

    await adapter.setMode('web3');
    assert.strictEqual(adapter.getState().mode, 'web3');
    assert.strictEqual(adapter.getState().status, 'connected');

    await adapter.setMode('simulation');
    assert.strictEqual(adapter.getState().mode, 'simulation');
    assert.strictEqual(adapter.getState().status, 'connected');
  });
});

describe('WalletAdapter State Subscriptions', () => {
  it('notifies subscribers upon state transitions', async () => {
    const adapter = new WalletAdapter();
    const stateLog: WalletState[] = [];

    const unsubscribe = adapter.subscribe((st) => {
      stateLog.push(st);
    });

    await adapter.connect();
    await adapter.switchAccount(DEFAULT_SIMULATED_ACCOUNTS[1].address);

    unsubscribe();

    await adapter.switchAccount(DEFAULT_SIMULATED_ACCOUNTS[2].address);

    assert.ok(stateLog.length >= 3);
    assert.strictEqual(stateLog[stateLog.length - 1].account?.name, 'Bob');
  });
});
