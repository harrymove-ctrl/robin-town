import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
// @ts-expect-error ESM module shared with production server
import { keccak256, recoverPersonalSignAddress, verifyPersonalSign, signPersonalMessage, isValidRealWalletAddress, createWalletRegistry } from '../../scripts/wallet-registry.mjs';
// @ts-expect-error ESM relay module shared with production server
import { createMultiplayerRelay } from '../../scripts/ws-relay.mjs';
import {
  claimPlots,
  executeAcceptedPlayerTrade,
  newDailyGame,
  perspectiveSwapState,
} from '../../src/town/engine.js';

describe('Harbor Wallet Registry & EIP-191 personal_sign Verification', () => {
  it('computes official Keccak-256 vectors and verifies secp256k1 personal_sign signatures', () => {
    assert.equal(
      keccak256(Buffer.alloc(0)).toString('hex'),
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
    assert.equal(
      keccak256(Buffer.from('abc', 'utf8')).toString('hex'),
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    );

    const privKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
    const message = 'Robin Town Harbor Trader Verification\nWallet: 0x14791697260e4c9a71f18484c9f997b308e59325\nChain ID: 4663\nNonce: cafe1234';
    const signed = signPersonalMessage(message, privKey);
    assert.equal(signed.address, '0x14791697260e4c9a71f18484c9f997b308e59325');
    assert.equal(recoverPersonalSignAddress(message, signed.signature), signed.address);
    assert.equal(
      verifyPersonalSign(message, signed.signature, '0x14791697260E4c9A71f18484C9f997B308e59325'),
      true,
    );

    // Support raw v = 0/1 suffix as well
    const rawV = parseInt(signed.signature.slice(-2), 16) - 27;
    const rawVSig = signed.signature.slice(0, -2) + rawV.toString(16).padStart(2, '0');
    assert.equal(recoverPersonalSignAddress(message, rawVSig), signed.address);

    // Support EIP-2098 compact 64-byte signature
    const rHex = signed.signature.slice(2, 66);
    const sBig = BigInt('0x' + signed.signature.slice(66, 130));
    const vsBig = (BigInt(rawV) << 255n) | sBig;
    const compactSig = '0x' + rHex + vsBig.toString(16).padStart(64, '0');
    assert.equal(recoverPersonalSignAddress(message, compactSig), signed.address);

    // Reject tampered message or wrong signer
    assert.equal(verifyPersonalSign(message + '!', signed.signature, signed.address), false);
    assert.equal(
      verifyPersonalSign(message, signed.signature, '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'),
      false,
    );
  });

  it('rejects simulated/dead wallets, deduplicates checksum casing, persists to disk, and prevents nonce replay', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'robin-wallets-'));
    const storePath = path.join(tmpDir, 'wallets.json');

    try {
      assert.equal(isValidRealWalletAddress('0x1000000000000000000000000000000000000001'), false);
      assert.equal(isValidRealWalletAddress('0x000000000000000000000000000000000000dEaD'), false);
      assert.equal(isValidRealWalletAddress('0x14791697260E4c9A71f18484C9f997B308e59325'), true);

      const registry = createWalletRegistry({
        storePath,
        fetchBalanceFn: async (addr: string) =>
          addr.endsWith('9325') ? 1250.5 : 420.25,
      });

      await assert.rejects(() =>
        registry.recordConnect({ address: '0x1000000000000000000000000000000000000001' }),
      );

      const priv1 = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const addr1Mixed = '0x14791697260E4c9A71f18484C9f997B308e59325';
      const first = await registry.recordConnect({
        address: addr1Mixed,
        chainId: 4663,
        source: 'metamask',
      });
      assert.equal(first.isFirstConnect, true);
      assert.equal(first.totalUniqueWallets, 1);
      assert.equal(first.me.onChainWifBalance, 1250.5);

      // Reconnecting with lowercase must NOT double-count totalUniqueWallets
      const second = await registry.recordConnect({
        address: addr1Mixed.toLowerCase(),
        chainId: 4663,
        source: 'metamask',
      });
      assert.equal(second.isFirstConnect, false);
      assert.equal(second.totalUniqueWallets, 1);

      // Sign challenge for Verified badge (+100 Town Points)
      const challenge = second.me.challengeMessage;
      const { signature } = signPersonalMessage(challenge, priv1);
      const verified = registry.verifyWalletSignature({
        address: addr1Mixed,
        signature,
      });
      assert.equal(verified.verified, true);
      assert.equal(verified.verifiedWallets, 1);
      assert.equal(verified.bonusTownPoints, 100);

      // Replaying exact same signature must fail because nonce rotated
      assert.throws(() =>
        registry.verifyWalletSignature({ address: addr1Mixed, signature }),
      );

      // Record wallet match + guest match
      registry.recordMatch({
        address: addr1Mixed,
        finalNetWorthWif: 84_500,
        won: true,
        burnedWif: 0.1,
      });
      registry.recordMatch({
        address: null,
        finalNetWorthWif: 62_000,
        won: false,
        burnedWif: 0,
      });

      // Reload a brand-new registry instance from disk to verify persistence across restarts
      const reloaded = createWalletRegistry({
        storePath,
        fetchBalanceFn: null,
      });
      const summary = reloaded.publicSummary(addr1Mixed);
      assert.equal(summary.totalUniqueWallets, 1);
      assert.equal(summary.verifiedWallets, 1);
      assert.equal(summary.totalMatchesPlayed, 2);
      assert.equal(summary.walletMatchesPlayed, 1);
      assert.equal(summary.guestMatchesPlayed, 1);
      assert.equal(summary.leaderboard.length, 1);
      assert.equal(summary.leaderboard[0].bestNetWorthWif, 84_500);
      assert.equal(summary.leaderboard[0].wins, 1);
      assert.equal(summary.leaderboard[0].verified, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves /api/wallets HTTP endpoints end-to-end through createMultiplayerRelay', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'robin-http-wallets-'));
    const storePath = path.join(tmpDir, 'wallets.json');
    const relay = createMultiplayerRelay({
      walletRegistryOptions: {
        storePath,
        fetchBalanceFn: async () => 777.77,
      },
    });

    const server = http.createServer((req, res) => {
      if (!relay.handleApiRequest(req, res)) {
        res.writeHead(404).end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const priv = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const addr = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';

      const connectRes = await fetch(`${base}/api/wallets/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, chainId: 4663, source: 'rabby' }),
      });
      assert.equal(connectRes.status, 200);
      const connectJson = (await connectRes.json()) as {
        totalUniqueWallets: number;
        me: { challengeMessage: string; onChainWifBalance: number };
      };
      assert.equal(connectJson.totalUniqueWallets, 1);
      assert.equal(connectJson.me.onChainWifBalance, 777.77);

      const { signature } = signPersonalMessage(connectJson.me.challengeMessage, priv);
      const verifyRes = await fetch(`${base}/api/wallets/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      });
      assert.equal(verifyRes.status, 200);
      const verifyJson = (await verifyRes.json()) as { verifiedWallets: number; bonusTownPoints: number };
      assert.equal(verifyJson.verifiedWallets, 1);
      assert.equal(verifyJson.bonusTownPoints, 100);

      const matchRes = await fetch(`${base}/api/wallets/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, finalNetWorthWif: 91200, won: true, burnedWif: 0.2 }),
      });
      assert.equal(matchRes.status, 200);

      const getRes = await fetch(`${base}/api/wallets?address=${addr}`);
      const getJson = (await getRes.json()) as {
        totalUniqueWallets: number;
        totalMatchesPlayed: number;
        leaderboard: Array<{ bestNetWorthWif: number; shortAddress: string }>;
      };
      assert.equal(getJson.totalUniqueWallets, 1);
      assert.equal(getJson.totalMatchesPlayed, 1);
      assert.equal(getJson.leaderboard[0].bestNetWorthWif, 91200);
      assert.equal(getJson.leaderboard[0].shortAddress, '0x7e5f…5bdf');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('verifies Chain 4663 ERC-20 $wif Transfer receipts, unlocks Patron Boost, prevents tx replay, and tracks multi-day streaks + Daily Seed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'robin-tx-streaks-'));
    const storePath = path.join(tmpDir, 'wallets.json');
    let fakeNowMs = Date.parse('2026-11-01T10:00:00Z');

    const sender = '0x14791697260e4c9a71f18484c9f997b308e59325';
    const burnDead = '0x000000000000000000000000000000000000dead';
    const validTxHash = '0x' + 'ab'.repeat(32);
    const nonWifTxHash = '0x' + 'cd'.repeat(32);

    // 12.5 $wif = 12_500_000_000_000_000_000 wei
    const weiHex = '0x' + (125n * 10n ** 17n).toString(16).padStart(64, '0');
    const transferTopic0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const padTopicAddr = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');

    const relay = createMultiplayerRelay({
      walletRegistryOptions: {
        storePath,
        nowFn: () => new Date(fakeNowMs),
        fetchBalanceFn: async () => 500,
        fetchReceiptFn: async (hash: string) => {
          if (hash === validTxHash) {
            return {
              status: '0x1',
              from: sender,
              to: '0x5173b8ea6923c2d40267890d45c46a3480954773',
              logs: [
                {
                  address: '0x5173b8eA6923c2d40267890D45C46a3480954773',
                  topics: [transferTopic0, padTopicAddr(sender), padTopicAddr(burnDead)],
                  data: weiHex,
                },
              ],
            };
          }
          if (hash === nonWifTxHash) {
            return {
              status: '0x1',
              from: sender,
              to: sender,
              logs: [],
            };
          }
          return null;
        },
      },
    });

    const server = http.createServer((req, res) => {
      if (!relay.handleApiRequest(req, res)) {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const txRes = await fetch(`${base}/api/wallets/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: sender, txHash: validTxHash }),
      });
      assert.equal(txRes.status, 200);
      const txJson = (await txRes.json()) as {
        wifMoved: number;
        wifBurned: number;
        bonusTownPoints: number;
        onChainPatronBoost: boolean;
        me: { verifiedTxCount: number; onChainPatronBoost: boolean };
      };
      assert.equal(txJson.wifMoved, 12.5);
      assert.equal(txJson.wifBurned, 12.5);
      assert.equal(txJson.bonusTownPoints, 150);
      assert.equal(txJson.onChainPatronBoost, true);
      assert.equal(txJson.me.verifiedTxCount, 1);

      // Replay of identical txHash must be rejected with 400
      const replayRes = await fetch(`${base}/api/wallets/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: sender, txHash: validTxHash }),
      });
      assert.equal(replayRes.status, 400);

      // Receipt with zero $wif Transfer events must be rejected with 400
      const noWifRes = await fetch(`${base}/api/wallets/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: sender, txHash: nonWifTxHash }),
      });
      assert.equal(noWifRes.status, 400);

      // Day 1 Daily Seed match
      const m1 = await fetch(`${base}/api/wallets/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: sender,
          finalNetWorthWif: 720,
          won: true,
          burnedWif: 0,
          entryMode: 'daily',
          dailySeed: '2026-11-01',
        }),
      });
      assert.equal(m1.status, 200);
      const m1Json = (await m1.json()) as { streakDays: number; streakBonusPoints: number };
      assert.equal(m1Json.streakDays, 1);
      assert.equal(m1Json.streakBonusPoints, 0);

      // Advance clock +24h to 2026-11-02 -> consecutive streakDays becomes 2 (+30 bonus pts)
      fakeNowMs = Date.parse('2026-11-02T10:00:00Z');
      const m2 = await fetch(`${base}/api/wallets/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: sender,
          finalNetWorthWif: 890,
          won: true,
          burnedWif: 0,
          entryMode: 'daily',
          dailySeed: '2026-11-02',
        }),
      });
      const m2Json = (await m2.json()) as {
        streakDays: number;
        streakBonusPoints: number;
        dailyLeaderboard: Array<{ bestNetWorthWif: number }>;
      };
      assert.equal(m2Json.streakDays, 2);
      assert.equal(m2Json.streakBonusPoints, 89);
      assert.equal(m2Json.dailyLeaderboard[0].bestNetWorthWif, 890);

      const dailyRes = await fetch(`${base}/api/wallets/daily?seed=2026-11-01`);
      const dailyJson = (await dailyRes.json()) as {
        seed: string;
        leaderboard: Array<{ bestNetWorthWif: number }>;
      };
      assert.equal(dailyJson.seed, '2026-11-01');
      assert.equal(dailyJson.leaderboard[0].bestNetWorthWif, 720);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('guarantees deterministic Daily Harbor Seed draws and symmetric PvP perspectiveSwapState + executeAcceptedPlayerTrade', () => {
    const runA = newDailyGame('2026-11-01');
    const runB = newDailyGame('2026-11-01');
    const runOtherDay = newDailyGame('2026-11-02');

    assert.deepEqual(runA.pending, runB.pending);
    assert.deepEqual(runA.players.map((p) => p.tiles), runB.players.map((p) => p.tiles));
    assert.notDeepEqual(runA.pending, runOtherDay.pending);

    // Even when claiming the exact same 5 plots, bots draft identically on the same seed
    claimPlots(runA, runA.pending.slice(0, runA.draftCount));
    claimPlots(runB, runB.pending.slice(0, runB.draftCount));
    assert.deepEqual(
      runA.lots.map((l) => l.owner),
      runB.lots.map((l) => l.owner),
    );

    // Perspective swap for Seat 2 is an exact involution
    const seat2View = perspectiveSwapState(runA, 2);
    assert.equal(seat2View.players[0].cash, runA.players[2].cash);
    const restored = perspectiveSwapState(seat2View, 2);
    assert.deepEqual(restored.lots, runA.lots);
    assert.deepEqual(
      restored.players.map((p) => ({ cash: p.cash, tiles: p.tiles })),
      runA.players.map((p) => ({ cash: p.cash, tiles: p.tiles })),
    );

    // Settle a live human-to-human trade between Seat 0 and Seat 2 (100 $wif -> 1% = 1 $wif vault tax)
    runA.players[0].cash = 200;
    const seat0Lot = runA.lots.find((l) => l.owner === 0)!.id;
    const seat2Lot = runA.lots.find((l) => l.owner === 2)!.id;
    const cash0Before = runA.players[0].cash;
    const cash2Before = runA.players[2].cash;
    const res = executeAcceptedPlayerTrade(
      runA,
      0,
      2,
      { cash: 100, lots: [seat0Lot], tiles: [0, 0, 0, 0, 0, 0] },
      { cash: 0, lots: [seat2Lot], tiles: [0, 0, 0, 0, 0, 0] },
    );
    assert.equal(res.accepted, true);
    assert.equal(res.taxAmount, 1);
    assert.equal(runA.lots[seat0Lot].owner, 2);
    assert.equal(runA.lots[seat2Lot].owner, 0);
    assert.equal(runA.players[0].cash, cash0Before - 100);
    assert.equal(runA.players[2].cash, cash2Before + 99);
  });
});
