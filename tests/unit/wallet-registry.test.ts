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
});
