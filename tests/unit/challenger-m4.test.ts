/**
 * tests/unit/challenger-m4.test.ts
 *
 * Empirical Adversarial Stress Harness for Milestone 4 (Tokenomics & Dual-Mode Wallet):
 * 1. Non-standard buy-in amounts (1, 7, 333, 999, 1M $wif) and Monte Carlo invariants
 * 2. Fractional dust distribution and strict conservation to 1st place
 * 3. Casual point swaps with micro, zero, and extreme values under ceiling burn tax
 * 4. In-game OTC trade micro-taxes with edge boundaries and non-negative net cash
 * 5. Wallet balance bounds, overdrafts, zero transfers, self-transfers, and dead address burns
 * 6. Web3 provider error injection (code 4001 rejection, missing provider, chain switch failures)
 * 7. Hex wei token precision and chain ID parsing boundary conditions
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  BURN_ADDRESS,
  DEFAULT_FLYWHEEL_CONFIG,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateTradeTax,
  calculateStakingBoost,
  createInitialFlywheelState,
  applyMatchPayouts,
  applyPointSwap,
  applyTradeTax,
  type FlywheelConfig,
} from '../../src/tokenomics/flywheel';
import {
  WalletAdapter,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_ID_HEX,
  DEFAULT_SIMULATED_ACCOUNTS,
  hexWeiToTokens,
  tokensToHexWei,
  parseChainId,
  normalizeAddress,
  type EIP1193Provider,
  type EIP1193RequestArgs,
} from '../../src/tokenomics/wallet';

function createMockEIP1193(options?: {
  accounts?: string[];
  chainId?: string | number;
  balanceHex?: string;
  rejectAccounts?: boolean;
  rejectAccountsWithNonError?: boolean;
  emptyAccounts?: boolean;
  switchChainError?: { code: number; message: string };
  addChainError?: { code: number; message: string };
  sendTxError?: { message: string };
}) {
  const accounts = options?.emptyAccounts
    ? []
    : (options?.accounts ?? ['0x71C83D4222fD2A35084920CE61F037A332e705bB']);
  let currentChainId = options?.chainId ?? ROBINHOOD_CHAIN_ID_HEX;
  const balanceHex = options?.balanceHex ?? '0x21e19e0c9bab2400000'; // 10,000 $wif
  const calls: { method: string; params?: unknown }[] = [];
  const listeners: Map<string, Set<Function>> = new Map();

  const provider: EIP1193Provider = {
    async request(args: EIP1193RequestArgs): Promise<unknown> {
      calls.push({ method: args.method, params: args.params });

      if (args.method === 'eth_requestAccounts') {
        if (options?.rejectAccounts) {
          const err = new Error('User rejected connection');
          (err as unknown as { code: number }).code = 4001;
          throw err;
        }
        if (options?.rejectAccountsWithNonError) {
          throw { code: 4001, message: 'User rejected connection payload' };
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
        if (options?.switchChainError) {
          const err = new Error(options.switchChainError.message);
          (err as unknown as { code: number }).code = options.switchChainError.code;
          throw err;
        }
        const params = args.params as [{ chainId: string }];
        currentChainId = params[0].chainId;
        return null;
      }

      if (args.method === 'wallet_addEthereumChain') {
        if (options?.addChainError) {
          const err = new Error(options.addChainError.message);
          (err as unknown as { code: number }).code = options.addChainError.code;
          throw err;
        }
        const params = args.params as [{ chainId: string }];
        currentChainId = params[0].chainId;
        return null;
      }

      if (args.method === 'eth_getBalance') {
        return balanceHex;
      }

      if (args.method === 'eth_sendTransaction') {
        if (options?.sendTxError) {
          throw new Error(options.sendTxError.message);
        }
        return '0xmock_tx_hash_challenger_m4';
      }

      if (args.method === 'personal_sign') {
        return '0xmock_signature_challenger_m4';
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

describe('Challenger M4.1: Non-Standard Match Pools and Mathematical Invariants', () => {
  const standardRankings = [101, 102, 103, 104];

  it('guarantees zero token leakage on odd buy-in of 1 $wif across 4 players', () => {
    const res = calculateMatchPayouts(1, standardRankings);
    assert.strictEqual(res.totalPool, 4);
    assert.strictEqual(res.burnedAmount, 0);
    assert.strictEqual(res.vaultAmount, 0);
    assert.strictEqual(res.purseAmount, 4);

    const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDisbursed, res.purseAmount);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, res.totalPool);

    // 1st place receives base 2 + 1 dust = 3
    assert.strictEqual(res.payouts[101], 3);
    assert.strictEqual(res.payouts[102], 1);
    assert.strictEqual(res.payouts[103], 0);
    assert.strictEqual(res.payouts[104], 0);
  });

  it('guarantees zero token leakage on prime buy-in of 7 $wif across 4 players', () => {
    const res = calculateMatchPayouts(7, standardRankings);
    assert.strictEqual(res.totalPool, 28);
    assert.strictEqual(res.burnedAmount, 1);
    assert.strictEqual(res.vaultAmount, 1);
    assert.strictEqual(res.purseAmount, 26);

    const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDisbursed, 26);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, 28);

    // Base: 15, 6, 3 (sum 24), dust: 2 assigned to 1st place (17)
    assert.strictEqual(res.payouts[101], 17);
    assert.strictEqual(res.payouts[102], 6);
    assert.strictEqual(res.payouts[103], 3);
    assert.strictEqual(res.payouts[104], 0);
  });

  it('guarantees zero token leakage on repeating buy-in of 333 $wif across 4 players', () => {
    const res = calculateMatchPayouts(333, standardRankings);
    assert.strictEqual(res.totalPool, 1332);
    assert.strictEqual(res.burnedAmount, 66);
    assert.strictEqual(res.vaultAmount, 66);
    assert.strictEqual(res.purseAmount, 1200);

    const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDisbursed, 1200);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, 1332);
    assert.strictEqual(res.payouts[101], 720);
    assert.strictEqual(res.payouts[102], 300);
    assert.strictEqual(res.payouts[103], 180);
    assert.strictEqual(res.payouts[104], 0);
  });

  it('guarantees zero token leakage on boundary buy-in of 999 $wif across 4 players', () => {
    const res = calculateMatchPayouts(999, standardRankings);
    assert.strictEqual(res.totalPool, 3996);
    assert.strictEqual(res.burnedAmount, 199);
    assert.strictEqual(res.vaultAmount, 199);
    assert.strictEqual(res.purseAmount, 3598);

    const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDisbursed, 3598);
    assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, 3996);

    // Base: 2158, 899, 539 (sum 3596), dust: 2 assigned to 1st place (2160)
    assert.strictEqual(res.payouts[101], 2160);
    assert.strictEqual(res.payouts[102], 899);
    assert.strictEqual(res.payouts[103], 539);
    assert.strictEqual(res.payouts[104], 0);
  });

  it('guarantees exact mathematical scaling on high-roller 1,000,000 $wif buy-in', () => {
    const res = calculateMatchPayouts(1_000_000, standardRankings);
    assert.strictEqual(res.totalPool, 4_000_000);
    assert.strictEqual(res.burnedAmount, 200_000);
    assert.strictEqual(res.vaultAmount, 200_000);
    assert.strictEqual(res.purseAmount, 3_600_000);
    assert.strictEqual(res.payouts[101], 2_160_000);
    assert.strictEqual(res.payouts[102], 900_000);
    assert.strictEqual(res.payouts[103], 540_000);
    assert.strictEqual(res.payouts[104], 0);
  });

  it('conserves tokens under variable participant counts from 1 to 8 players', () => {
    for (let count = 1; count <= 8; count++) {
      const players = Array.from({ length: count }, (_, idx) => 500 + idx);
      const buyIn = 250;
      const res = calculateMatchPayouts(buyIn, players);

      assert.strictEqual(res.totalPool, count * buyIn);
      assert.strictEqual(
        res.burnedAmount + res.vaultAmount + res.purseAmount,
        res.totalPool,
        `Sinks do not match totalPool for ${count} players`
      );

      const sumPayouts = Object.values(res.payouts).reduce((a, b) => a + b, 0);
      assert.strictEqual(
        sumPayouts,
        res.purseAmount,
        `Purse disbursements do not match purseAmount for ${count} players`
      );
    }
  });

  it('executes 1000 random Monte Carlo match pools and confirms zero token leakage invariant', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const playerCount = (seed % 6) + 1; // 1 to 6 players
      const buyIn = (seed * 17) % 5000 + 1; // 1 to 5000 $wif
      const players = Array.from({ length: playerCount }, (_, i) => i + 1);

      const res = calculateMatchPayouts(buyIn, players);

      assert.strictEqual(
        res.totalPool,
        Math.round(buyIn * playerCount),
        `Total pool mismatch on seed ${seed}`
      );
      assert.strictEqual(
        res.burnedAmount + res.vaultAmount + res.purseAmount,
        res.totalPool,
        `Sink conservation broken on seed ${seed}`
      );

      const sumDisbursed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
      assert.strictEqual(
        sumDisbursed,
        res.purseAmount,
        `Purse conservation broken on seed ${seed}`
      );

      for (const pid of players) {
        assert.ok(res.payouts[pid] >= 0, `Negative payout detected for player ${pid}`);
      }
    }
  });
});

describe('Challenger M4.2: Fractional Dust Preservation and Routing', () => {
  it('correctly credits 1st place with single-unit fractional dust without loss', () => {
    // 3 players with buyIn of 37 -> totalPool = 111
    // burn = floor(111 * 0.05) = 5
    // vault = floor(111 * 0.05) = 5
    // purse = 111 - 10 = 101
    // 1st: floor(101 * 0.60) = 60
    // 2nd: floor(101 * 0.25) = 25
    // 3rd: floor(101 * 0.15) = 15
    // sum distributed = 100
    // dust = 101 - 100 = 1 -> added to 1st place
    const res = calculateMatchPayouts(37, [1, 2, 3]);
    assert.strictEqual(res.totalPool, 111);
    assert.strictEqual(res.purseAmount, 101);
    assert.strictEqual(res.payouts[1], 61);
    assert.strictEqual(res.podium[0].payout, 61);
    assert.strictEqual(res.payouts[2], 25);
    assert.strictEqual(res.payouts[3], 15);
  });

  it('guarantees solo participant absorbs 100% of remaining purse as residual dust', () => {
    const res = calculateMatchPayouts(1000, [42]);
    assert.strictEqual(res.totalPool, 1000);
    assert.strictEqual(res.burnedAmount, 50);
    assert.strictEqual(res.vaultAmount, 50);
    assert.strictEqual(res.purseAmount, 900);
    assert.strictEqual(res.payouts[42], 900);
    assert.strictEqual(res.podium[0].payout, 900);
  });
});

describe('Challenger M4.3: Casual Point Swaps and Anti-Micro-Minting Burns', () => {
  it('strictly blocks micro-minting by burning 100% of gross $wif for points between 10 and 19', () => {
    for (let pt = 10; pt <= 19; pt++) {
      const res = calculatePointSwap(pt);
      assert.strictEqual(res.points, pt);
      assert.strictEqual(res.grossWif, 1);
      assert.strictEqual(res.burnedWif, 1);
      assert.strictEqual(res.netWif, 0);
    }
  });

  it('returns zero for sub-threshold point values 0 through 9', () => {
    for (let pt = 0; pt <= 9; pt++) {
      const res = calculatePointSwap(pt);
      assert.strictEqual(res.grossWif, 0);
      assert.strictEqual(res.burnedWif, 0);
      assert.strictEqual(res.netWif, 0);
    }
  });

  it('verifies first positive net redemption occurs at exactly 20 points', () => {
    const res19 = calculatePointSwap(19);
    assert.strictEqual(res19.netWif, 0);

    const res20 = calculatePointSwap(20);
    assert.strictEqual(res20.grossWif, 2);
    assert.strictEqual(res20.burnedWif, 1);
    assert.strictEqual(res20.netWif, 1);
  });

  it('accurately computes extreme point swap of 10,000,000 points', () => {
    const res = calculatePointSwap(10_000_000);
    assert.strictEqual(res.points, 10_000_000);
    assert.strictEqual(res.grossWif, 1_000_000);
    assert.strictEqual(res.burnedWif, 30_000);
    assert.strictEqual(res.netWif, 970_000);
    assert.strictEqual(res.grossWif, res.burnedWif + res.netWif);
  });

  it('handles non-finite, negative, and invalid point quantities safely without crashing', () => {
    assert.strictEqual(calculatePointSwap(-1).grossWif, 0);
    assert.strictEqual(calculatePointSwap(-99999).netWif, 0);
    assert.strictEqual(calculatePointSwap(NaN).grossWif, 0);
    assert.strictEqual(calculatePointSwap(Infinity).netWif, 0);
    assert.strictEqual(calculatePointSwap(-Infinity).grossWif, 0);
  });
});

describe('Challenger M4.4: OTC Trade Micro-Tax Boundaries and Vault Routing', () => {
  it('enforces non-negative net cash on minimum trade of 1 $wif', () => {
    const res = calculateTradeTax(1);
    assert.strictEqual(res.grossCash, 1);
    assert.strictEqual(res.taxAmount, 1);
    assert.strictEqual(res.netCash, 0);
    assert.strictEqual(res.vaultAmount, 1);
    assert.strictEqual(res.burnedAmount, 0);
    assert.strictEqual(res.grossCash, res.netCash + res.taxAmount);
  });

  it('verifies micro-tax threshold transitions at 99, 100, and 101 $wif', () => {
    const t99 = calculateTradeTax(99);
    assert.strictEqual(t99.grossCash, 99);
    assert.strictEqual(t99.taxAmount, 1);
    assert.strictEqual(t99.netCash, 98);

    const t100 = calculateTradeTax(100);
    assert.strictEqual(t100.grossCash, 100);
    assert.strictEqual(t100.taxAmount, 1);
    assert.strictEqual(t100.netCash, 99);

    const t101 = calculateTradeTax(101);
    assert.strictEqual(t101.grossCash, 101);
    assert.strictEqual(t101.taxAmount, 2);
    assert.strictEqual(t101.netCash, 99);
  });

  it('handles zero cash trade cleanly with zero tax', () => {
    const res = calculateTradeTax(0);
    assert.strictEqual(res.grossCash, 0);
    assert.strictEqual(res.taxAmount, 0);
    assert.strictEqual(res.netCash, 0);
    assert.strictEqual(res.vaultAmount, 0);
  });

  it('handles negative, NaN, and infinite cash amounts gracefully', () => {
    assert.strictEqual(calculateTradeTax(-50).taxAmount, 0);
    assert.strictEqual(calculateTradeTax(NaN).taxAmount, 0);
    assert.strictEqual(calculateTradeTax(Infinity).taxAmount, 0);
  });

  it('evaluates large OTC institutional trade of 10,000,000 $wif', () => {
    const res = calculateTradeTax(10_000_000);
    assert.strictEqual(res.grossCash, 10_000_000);
    assert.strictEqual(res.taxAmount, 100_000);
    assert.strictEqual(res.netCash, 9_900_000);
    assert.strictEqual(res.vaultAmount, 100_000);
  });
});

describe('Challenger M4.5: Wallet Balance Bounds, Overdrafts, and Permanent Burns', () => {
  it('strictly rejects transfer exceeding available balance with descriptive error', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    const currentBal = await adapter.getBalance(aliceAddr);
    assert.strictEqual(currentBal, 10000);

    await assert.rejects(
      async () => {
        await adapter.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, 10001);
      },
      /Insufficient balance: available 10000 \$wif, required 10001 \$wif/
    );

    // Balance must remain intact
    assert.strictEqual(await adapter.getBalance(aliceAddr), 10000);
  });

  it('permits full balance depletion transfer leaving exactly 0 $wif', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    const bobAddr = DEFAULT_SIMULATED_ACCOUNTS[1].address;

    await adapter.transfer(bobAddr, 10000);
    assert.strictEqual(await adapter.getBalance(aliceAddr), 0);
    assert.strictEqual(await adapter.getBalance(bobAddr), 20000);

    // Subsequent 1 $wif transfer must be rejected
    await assert.rejects(
      async () => {
        await adapter.transfer(bobAddr, 1);
      },
      /Insufficient balance: available 0 \$wif, required 1 \$wif/
    );
  });

  it('handles self-transfer safely without inflating or leaking tokens', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;
    const tx = await adapter.transfer(aliceAddr, 3500);

    assert.strictEqual(tx.status, 'confirmed');
    assert.strictEqual(tx.amount, 3500);

    const balanceAfter = await adapter.getBalance(aliceAddr);
    assert.strictEqual(balanceAfter, 10000);
  });

  it('permanently sinks tokens transferred to dead burn address with case insensitivity', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const aliceAddr = DEFAULT_SIMULATED_ACCOUNTS[0].address;

    // Burn 1000 with exact address
    await adapter.transfer(BURN_ADDRESS, 1000);
    assert.strictEqual(await adapter.getBalance(aliceAddr), 9000);

    // Burn 500 with uppercase dead address
    await adapter.transfer('0x000000000000000000000000000000000000DEAD', 500);
    assert.strictEqual(await adapter.getBalance(aliceAddr), 8500);

    // Burn 500 with untrimmed lowercase dead address
    await adapter.transfer('  0x000000000000000000000000000000000000dead  ', 500);
    assert.strictEqual(await adapter.getBalance(aliceAddr), 8000);

    // Verify all other accounts did not receive burned tokens
    const accounts = adapter.getSimulatedAccounts();
    for (const acc of accounts) {
      if (acc.name !== 'Alice') {
        assert.strictEqual(acc.balance, 10000);
      }
    }
  });

  it('preserves aggregate conservation across multi-hop chained transfers', async () => {
    const adapter = new WalletAdapter();
    await adapter.connect();

    const [alice, bob, charlie, dave] = DEFAULT_SIMULATED_ACCOUNTS;

    // Alice -> Bob: 2000
    await adapter.transfer(bob.address, 2000);

    // Switch to Bob -> Charlie: 1000
    await adapter.switchAccount(bob.address);
    await adapter.transfer(charlie.address, 1000);

    // Switch to Charlie -> Dave: 500
    await adapter.switchAccount(charlie.address);
    await adapter.transfer(dave.address, 500);

    // Switch to Dave -> Burn: 250
    await adapter.switchAccount(dave.address);
    await adapter.transfer(BURN_ADDRESS, 250);

    const balAlice = await adapter.getBalance(alice.address);
    const balBob = await adapter.getBalance(bob.address);
    const balCharlie = await adapter.getBalance(charlie.address);
    const balDave = await adapter.getBalance(dave.address);

    assert.strictEqual(balAlice, 8000);
    assert.strictEqual(balBob, 11000);
    assert.strictEqual(balCharlie, 10500);
    assert.strictEqual(balDave, 10250);

    const activeSum = balAlice + balBob + balCharlie + balDave;
    assert.strictEqual(activeSum, 39750);
    assert.strictEqual(activeSum + 250, 40000);
  });
});

describe('Challenger M4.6: Web3 Provider Error Injection and Resilient Fallbacks', () => {
  it('reverts gracefully to simulation mode when provider rejects with code 4001', async () => {
    const mock = createMockEIP1193({ rejectAccounts: true });
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    const account = await adapter.connect();
    const state = adapter.getState();

    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(account.isSimulated, true);
    assert.strictEqual(account.name, 'Alice');
    assert.ok(state.error?.includes('User rejected'));
  });

  it('reverts gracefully to simulation mode when provider throws non-Error object', async () => {
    const mock = createMockEIP1193({ rejectAccountsWithNonError: true });
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    const account = await adapter.connect();
    const state = adapter.getState();

    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(account.isSimulated, true);
    assert.ok(state.error?.includes('User rejected connection payload'));
  });

  it('reverts to simulation mode when provider returns empty authorized accounts array', async () => {
    const mock = createMockEIP1193({ emptyAccounts: true });
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    const account = await adapter.connect();
    const state = adapter.getState();

    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(account.isSimulated, true);
    assert.ok(state.error?.includes('No accounts authorized'));
  });

  it('records failed transaction when Web3 eth_sendTransaction is rejected by provider', async () => {
    const mock = createMockEIP1193({
      sendTxError: { message: 'Gas price exceeds network cap' },
    });
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    assert.strictEqual(adapter.getState().mode, 'web3');

    await assert.rejects(
      async () => {
        await adapter.transfer('0x9999999999999999999999999999999999999999', 100);
      },
      /Gas price exceeds network cap/
    );

    const txs = adapter.getTransactions();
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].status, 'failed');
    assert.strictEqual(txs[0].error, 'Gas price exceeds network cap');
  });

  it('handles network switch rejection gracefully when user cancels network switch', async () => {
    const mock = createMockEIP1193({
      chainId: '0x1',
      switchChainError: { code: 4001, message: 'User rejected switch' },
    });
    const adapter = new WalletAdapter({
      mode: 'web3',
      provider: mock.provider,
    });

    await adapter.connect();
    const state = adapter.getState();

    assert.strictEqual(state.mode, 'web3');
    assert.strictEqual(state.isCorrectChain, false);
    assert.strictEqual(state.chainId, 1);
  });
});

describe('Challenger M4.7: Precision, BigInt Conversions, and Edge Inputs', () => {
  it('converts micro-amounts to hex wei and back without loss of precision', () => {
    const microAmount = 0.000000000000000001; // 1 wei
    const hex = tokensToHexWei(microAmount);
    assert.strictEqual(hex, '0x1');

    const recovered = hexWeiToTokens(hex);
    assert.strictEqual(recovered, microAmount);
  });

  it('converts large token quantities to hex wei without overflow', () => {
    const largeAmount = 1_000_000.5;
    const hex = tokensToHexWei(largeAmount);
    const recovered = hexWeiToTokens(hex);
    assert.strictEqual(recovered, largeAmount);
  });

  it('handles invalid hex strings in hexWeiToTokens cleanly', () => {
    assert.strictEqual(hexWeiToTokens(''), 0);
    assert.strictEqual(hexWeiToTokens('0x'), 0);
    assert.strictEqual(hexWeiToTokens('invalid_hex'), 0);
    assert.strictEqual(hexWeiToTokens('0xGHIJK'), 0);
  });

  it('parses diverse valid and invalid chain ID inputs', () => {
    assert.strictEqual(parseChainId('0xb626'), ROBINHOOD_CHAIN_ID);
    assert.strictEqual(parseChainId('0xB626'), ROBINHOOD_CHAIN_ID);
    assert.strictEqual(parseChainId('46630'), ROBINHOOD_CHAIN_ID);
    assert.strictEqual(parseChainId(46630), ROBINHOOD_CHAIN_ID);
    assert.strictEqual(parseChainId(null), null);
    assert.strictEqual(parseChainId(undefined), null);
    assert.strictEqual(parseChainId('unknown'), null);
    assert.strictEqual(parseChainId({}), null);
  });
});
