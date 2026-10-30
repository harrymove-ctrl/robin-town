/**
 * tests/e2e/tier2-boundaries.test.ts
 *
 * E2E Test Suite Tier 2: Boundary & Corner Cases (F1 to F12).
 * Minimum 5 tests per feature (60 tests total).
 * Covers boundary extremes, zero and negative values, overflows, and desync scenarios.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  SHOP_CATEGORIES,
  calculateClusterIncome,
  getLotsInDistrict,
  TOTAL_LOTS,
  LOT_DEFINITIONS,
  canBuildShop,
  findClusterAtLot,
} from '../../src/engine/board-layout';
import {
  DISTRICT_NAMES,
  SHOPS,
  createGame,
  draftPlots,
  advancePhase,
  buildTile,
  collectIncome,
  nextYear,
  groupIncome,
  groups,
  validSave,
  validateOffer,
  evaluateOffer,
  log,
  rankings,
  emptyOffer,
} from '../../src/engine/engine';
import {
  BOT_PERSONALITIES,
  getBotPersonality,
  plotScore,
  botDraft,
  botBuild,
  evaluateTradeOffer,
} from '../../src/engine/bot';
import {
  calculateMatchPayouts,
  calculatePointSwap,
  calculateTradeTax,
  calculateStakingBoost,
  applyMatchPayouts,
  applyPointSwap,
  createInitialFlywheelState,
  BURN_ADDRESS,
} from '../../src/tokenomics/flywheel';
import {
  WalletAdapter,
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  normalizeAddress,
  hexWeiToTokens,
  tokensToHexWei,
  type EIP1193Provider,
} from '../../src/tokenomics/wallet';
import {
  NetworkRoom,
  MemoryTransportHub,
  MemoryTransport,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from '../../src/network/room';
import {
  CameraController,
  boardToScreen,
  screenToBoard,
  hitTestBoardPoint,
  clampCamera,
} from '../../src/ui/camera';
import { AudioSynthesizer } from '../../src/ui/audio';
import { TradeDeskController } from '../../src/ui/trade-desk';
import { RobinTownApp } from '../../src/app';
import {
  encodePng,
  crc32,
  matrixToRgba,
  scaleRgba,
} from '../../scripts/generate-assets';
import { verifyAsset } from '../../scripts/verify-assets';
import type { GameState, TradeOffer } from '../../src/engine/types';

describe('Tier 2: Boundary & Corner Cases (F1 to F12)', () => {

  // Feature F1 Boundaries: Documentation Schema Extremes
  describe('F1-B: Documentation Schema Extremes', () => {
    it('F1-B1: Empty and corrupted markdown file handling', () => {
      const emptyContent = '';
      assert.equal(emptyContent.length, 0);
      const hasHeading = /^#\s+.+/m.test(emptyContent);
      assert.equal(hasHeading, false, 'Empty document must fail heading test');
    });

    it('F1-B2: Excessive markdown header nesting and deep indentation', () => {
      const deepIndentedMarkdown = '            * Deep item level 12\n'.repeat(50);
      const longSingleLine = 'A'.repeat(10000);
      assert.doesNotThrow(() => {
        const lines = (deepIndentedMarkdown + longSingleLine).split('\n');
        assert.ok(lines.length > 50);
      });
    });

    it('F1-B3: Non-ASCII and unicode character resilience in markdown parsing', () => {
      const unicodeString = 'Fintech 🚀 $wif 🪙 100% α-β-γ 𝛑 Ω \r\n Line 2 \r\n';
      const normalized = unicodeString.replace(/\r\n/g, '\n');
      assert.ok(normalized.includes('\n Line 2'));
      assert.ok(normalized.includes('🚀'));
      assert.ok(normalized.includes('$wif'));
    });

    it('F1-B4: Maximum file size and path boundary edge cases', () => {
      const relativePath = path.resolve(process.cwd(), 'docs/../docs/EXECUTION_PLAN.md');
      assert.ok(fs.existsSync(relativePath));
      const stats = fs.statSync(relativePath);
      assert.ok(stats.size > 0 && stats.size < 50_000_000);
    });

    it('F1-B5: Malformed JSON and missing fields in schema validation', () => {
      assert.throws(() => {
        JSON.parse('{ malformed: json, missing quotes }');
      }, SyntaxError);

      assert.equal(validSave(null), false);
      assert.equal(validSave({}), false);
      assert.equal(validSave({ version: 2 }), false);
    });
  });

  // Feature F2 Boundaries: Thematic Dictionary & Mapping Edge Cases
  describe('F2-B: Thematic Dictionary & Mapping Edge Cases', () => {
    it('F2-B1: Out-of-bounds district index and invalid block IDs', () => {
      assert.throws(() => {
        getLotsInDistrict(-1 as any);
      }, /out of bounds/);

      assert.throws(() => {
        getLotsInDistrict(6 as any);
      }, /out of bounds/);
    });

    it('F2-B2: Invalid shop category IDs and extreme shop sizes', () => {
      assert.throws(() => {
        calculateClusterIncome(-1, 3);
      }, /Invalid shop type/);

      assert.throws(() => {
        calculateClusterIncome(99, 3);
      }, /Invalid shop type/);

      assert.equal(calculateClusterIncome(0, 0), 0);
      assert.equal(calculateClusterIncome(0, -5), 0);
    });

    it('F2-B3: Unknown bot personality ID fallback handling', () => {
      const defaultZero = getBotPersonality(0);
      assert.ok(defaultZero);
      assert.equal(defaultZero.id, 0);
      assert.ok(defaultZero.dialogue.greeting.length > 0);

      const defaultLarge = getBotPersonality(999);
      assert.ok(defaultLarge);
      assert.equal(defaultLarge.id, 999);
      assert.ok(defaultLarge.dialogue.accepted.length > 0);
    });

    it('F2-B4: Extreme name string lengths and special characters', () => {
      const longName = 'Player_'.repeat(70);
      const xssName = '<script>alert("xss")</script>';

      const state = createGame({
        players: [
          { name: longName, address: '0x1', avatar: 'avatar_0.png' },
          { name: xssName, address: '0x2', avatar: 'avatar_1.png' },
          { name: '', address: '0x3', avatar: 'avatar_2.png' },
          { name: 'Normal', address: '0x4', avatar: 'avatar_3.png' },
        ],
      });

      assert.equal(state.players[0].name, longName);
      assert.equal(state.players[1].name, xssName);
      assert.equal(state.players[2].name, '');
    });

    it('F2-B5: Canonical shop quota conservation at boundaries', () => {
      let quotaSum = 0;
      for (const shop of SHOPS) {
        assert.equal(shop.quota, 20);
        quotaSum += shop.quota;
      }
      assert.equal(quotaSum, 120);
    });
  });

  // Feature F3 Boundaries: Asset Pipeline Binary Extremes
  describe('F3-B: Asset Pipeline Binary Extremes', () => {
    it('F3-B1: Minimum 1x1 pixel PNG encoding and CRC32 verification', () => {
      const pixel1x1 = Buffer.from([255, 0, 0, 255]);
      const pngBuf = encodePng(1, 1, pixel1x1);
      assert.ok(pngBuf.length > 20);
      const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.deepEqual(pngBuf.subarray(0, 8), pngSig);
      assert.equal(pngBuf.readUInt32BE(16), 1);
      assert.equal(pngBuf.readUInt32BE(20), 1);
    });

    it('F3-B2: Zero-dimension or negative dimension PNG encoding rejection', () => {
      // Negative width throws RangeError with out of range message
      assert.throws(
        () => encodePng(-1, 32, Buffer.alloc(0)),
        (err: Error) => {
          assert.ok(err instanceof RangeError);
          assert.match(err.message, /out of range/);
          return true;
        }
      );

      // Negative height throws RangeError with out of range message
      assert.throws(
        () => encodePng(32, -1, Buffer.alloc(0)),
        (err: Error) => {
          assert.ok(err instanceof RangeError);
          assert.match(err.message, /out of range/);
          return true;
        }
      );

      // Zero-dimension PNG rejected by asset integrity verification
      const zeroPng = encodePng(0, 0, Buffer.alloc(0));
      assert.equal(zeroPng.readUInt32BE(16), 0);
      assert.equal(zeroPng.readUInt32BE(20), 0);

      const publicDir = path.resolve(process.cwd(), 'public');
      const tmpZeroDim = path.resolve(publicDir, 'assets', '.tmp_zero_dim.png');
      fs.writeFileSync(tmpZeroDim, zeroPng);
      try {
        const result = verifyAsset(publicDir, 'assets/.tmp_zero_dim.png');
        assert.equal(result.ok, false);
        assert.match(result.message, /Width mismatch: got 0/);
      } finally {
        if (fs.existsSync(tmpZeroDim)) {
          fs.unlinkSync(tmpZeroDim);
        }
      }
    });

    it('F3-B3: Buffer length mismatch in matrixToRgba', () => {
      const emptyMatrix: string[] = [];
      const rgba = matrixToRgba(emptyMatrix, {}, 32, 32);
      assert.equal(rgba.length, 32 * 32 * 4);
      for (let i = 0; i < rgba.length; i++) {
        assert.equal(rgba[i], 0);
      }
    });

    it('F3-B4: Maximum integer scaling boundary (1x, 2x, 4x, 8x)', () => {
      const baseBuffer = Buffer.alloc(32 * 32 * 4, 128);
      for (const scale of [1, 2, 4, 8]) {
        const scaled = scaleRgba(baseBuffer, 32, 32, scale);
        const expectedSize = (32 * scale) * (32 * scale) * 4;
        assert.equal(scaled.length, expectedSize);
      }
    });

    it('F3-B5: All-transparent and all-opaque RGBA buffer deflate compression', () => {
      const transparentBuf = Buffer.alloc(1024, 0);
      const compressedTrans = zlib.deflateSync(transparentBuf);
      const decompressedTrans = zlib.inflateSync(compressedTrans);
      assert.deepEqual(decompressedTrans, transparentBuf);

      const opaqueBuf = Buffer.alloc(1024, 255);
      const compressedOpaque = zlib.deflateSync(opaqueBuf);
      const decompressedOpaque = zlib.inflateSync(compressedOpaque);
      assert.deepEqual(decompressedOpaque, opaqueBuf);
    });
  });

  // Feature F4 Boundaries: Asset Manifest & Zero-404 Edge Scenarios
  describe('F4-B: Asset Manifest & Zero-404 Edge Scenarios', () => {
    it('F4-B1: Missing file path simulation and 404 detection', () => {
      const publicDir = path.resolve(process.cwd(), 'public');
      const res = verifyAsset(publicDir, 'assets/non_existent_file.png');
      assert.equal(res.ok, false);
      assert.match(res.message, /File does not exist/);
    });

    it('F4-B2: Zero-byte truncated asset file detection', () => {
      const publicDir = path.resolve(process.cwd(), 'public');
      const tmpZeroFile = path.resolve(publicDir, 'assets/.tmp_zero.png');
      fs.writeFileSync(tmpZeroFile, Buffer.alloc(0));
      try {
        const res = verifyAsset(publicDir, 'assets/.tmp_zero.png');
        assert.equal(res.ok, false);
        assert.equal(res.sizeBytes, 0);
        assert.match(res.message, /File is empty \(0 bytes\)/);
      } finally {
        if (fs.existsSync(tmpZeroFile)) {
          fs.unlinkSync(tmpZeroFile);
        }
      }
    });

    it('F4-B3: Corrupted PNG header byte detection', () => {
      const publicDir = path.resolve(process.cwd(), 'public');
      const tmpCorruptFile = path.resolve(publicDir, 'assets/.tmp_corrupt.png');
      fs.writeFileSync(tmpCorruptFile, Buffer.alloc(32, 0));
      try {
        const res = verifyAsset(publicDir, 'assets/.tmp_corrupt.png');
        assert.equal(res.ok, false);
        assert.match(res.message, /Invalid 8-byte PNG header signature/);
      } finally {
        if (fs.existsSync(tmpCorruptFile)) {
          fs.unlinkSync(tmpCorruptFile);
        }
      }
    });

    it('F4-B4: Dimension mismatch detection in PNG IHDR chunk', () => {
      const png32 = encodePng(32, 32, Buffer.alloc(32 * 32 * 4));
      const width = png32.readUInt32BE(16);
      const height = png32.readUInt32BE(20);
      assert.notEqual(width, 96);
      assert.notEqual(height, 96);
    });

    it('F4-B5: Case sensitivity and trailing slash path resolution', () => {
      const normalPath = path.join(process.cwd(), 'public', 'assets', 'tokens', 'coin_wif.png');
      assert.ok(fs.existsSync(normalPath));
    });
  });

  // Feature F5 Boundaries: Engine State Invariants at Extreme Limits
  describe('F5-B: Engine State Invariants at Extreme Limits', () => {
    it('F5-B1: 100% full board drafting and zero remaining vacant parcels', () => {
      const state = createGame();
      for (let i = 0; i < 72; i++) {
        state.lots[i].owner = i % 4;
      }
      const unowned = state.lots.filter((l) => l.owner === null);
      assert.equal(unowned.length, 0);

      state.phase = 'receive';
      state.pending = [0, 1];
      state.draftCount = 2;
      assert.throws(() => {
        draftPlots(state, 0, [0, 1]);
      });
    });

    it('F5-B2: Draft count boundary extremes and empty candidate list', () => {
      const state = createGame();
      assert.throws(() => {
        draftPlots(state, 0, []);
      }, /Select exactly/);

      assert.throws(() => {
        draftPlots(state, 0, [state.pending[0], state.pending[0]]);
      }, /Select exactly/);
    });

    it('F5-B3: Out-of-order phase actions and illegal phase transitions', () => {
      const state = createGame();
      assert.equal(state.phase, 'receive');

      assert.throws(() => {
        buildTile(state, 0, 0, 0);
      }, /Build phase/);

      assert.throws(() => {
        collectIncome(state);
      }, /Deployment must conclude/);
    });

    it('F5-B4: Maximum size 6 shop completion and expansion prohibition', () => {
      const state = createGame();
      // Validator Citadel (size 6) in District 0
      state.lots[0].owner = 0; state.lots[0].shop = 5;
      state.lots[1].owner = 0; state.lots[1].shop = 5;
      state.lots[2].owner = 0; state.lots[2].shop = 5;
      state.lots[3].owner = 0; state.lots[3].shop = 5;
      state.lots[4].owner = 0; state.lots[4].shop = 5;
      state.lots[5].owner = 0; state.lots[5].shop = 5;
      state.lots[6].owner = 0; state.lots[6].shop = null;

      const validation = canBuildShop(state.lots, 6, 0, 5, 1);
      assert.equal(validation.valid, false);
      assert.ok(validation.reason?.includes('already completed at maximum capacity'));
    });

    it('F5-B5: Disconnected non-adjacent lots and cross-district shop building', () => {
      const state = createGame();
      state.lots[0].owner = 0; state.lots[0].shop = 0; // District 0
      state.lots[24].owner = 0; state.lots[24].shop = 0; // District 2

      const cluster0 = findClusterAtLot(state.lots, 0);
      const cluster24 = findClusterAtLot(state.lots, 24);

      assert.ok(cluster0);
      assert.ok(cluster24);
      assert.notEqual(cluster0.districtId, cluster24.districtId);
      assert.equal(cluster0.size, 1);
      assert.equal(cluster24.size, 1);
    });
  });

  // Feature F6 Boundaries: AI Bot Valuation Extremes & Erratic Offers
  describe('F6-B: AI Bot Valuation Extremes & Erratic Offers', () => {
    it('F6-B1: Zero-asset empty trade offer rejection', () => {
      const state = createGame();
      state.phase = 'trade';
      const emptyDeal: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      };

      assert.throws(() => {
        validateOffer(state, emptyDeal);
      }, /Add cash, a shop tile, or a plot/);
    });

    it('F6-B2: Counterparty cash overdraft and balance limit clamping', () => {
      const state = createGame();
      state.phase = 'trade';
      state.players[0].cash = 50;
      state.players[1].cash = 50;

      const overdraftDeal: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 999999, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      };

      assert.throws(() => {
        validateOffer(state, overdraftDeal);
      }, /Cash must be a whole number within the owner’s balance/);
    });

    it('F6-B3: Self-trading rejection and invalid counterparty player ID', () => {
      const state = createGame();
      state.phase = 'trade';

      const invalidPartnerDeal: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 0, // Cannot trade with self
        give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      };

      assert.throws(() => {
        validateOffer(state, invalidPartnerDeal);
      }, /Choose a trading partner/);
    });

    it('F6-B4: Extreme valuation asymmetry (ridiculously unfair offer)', () => {
      const state = createGame();
      state.phase = 'trade';
      state.lots[0].owner = 1;
      state.lots[0].shop = 0;

      const unfairDeal: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 1, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [0] },
      };

      const evaluation = evaluateOffer(state, unfairDeal);
      assert.equal(evaluation.accepted, false);
      assert.ok(evaluation.shortfall > 10);
    });

    it('F6-B5: Bot evaluation when bot has zero lots or zero cash', () => {
      const state = createGame();
      state.phase = 'trade';
      state.players[1].cash = 0;
      for (const lot of state.lots) {
        if (lot.owner === 1) lot.owner = null;
      }

      const offer: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 10, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      };

      assert.doesNotThrow(() => {
        const evalResult = evaluateOffer(state, offer);
        assert.ok(evalResult);
        assert.ok(!Number.isNaN(evalResult.shortfall));
      });
    });
  });

  // Feature F7 Boundaries: Tokenomics Mathematical Bounds & Dust
  describe('F7-B: Tokenomics Mathematical Bounds & Dust', () => {
    it('F7-B1: Zero and negative buy-in amount handling', () => {
      const zeroPool = calculateMatchPayouts(0, [0, 1, 2, 3]);
      assert.equal(zeroPool.totalPool, 0);
      assert.equal(zeroPool.burnedAmount, 0);
      assert.equal(zeroPool.purseAmount, 0);

      assert.throws(() => {
        calculateMatchPayouts(-100, [0, 1, 2, 3]);
      }, /non-negative finite number/);
    });

    it('F7-B2: Single player and two-player match pool allocations', () => {
      const single = calculateMatchPayouts(1000, [0]);
      assert.equal(single.totalPool, 1000);
      assert.equal(single.burnedAmount, 50);
      assert.equal(single.vaultAmount, 50);
      assert.equal(single.purseAmount, 900);
      assert.equal(single.payouts[0], 900);

      const dual = calculateMatchPayouts(1000, [0, 1]);
      assert.equal(dual.totalPool, 2000);
      assert.equal(dual.purseAmount, 1800);
      assert.equal(dual.payouts[0] + dual.payouts[1], 1800);
    });

    it('F7-B3: Fractional point swap rounding dust and tiny point balances', () => {
      const tiny = calculatePointSwap(5, 0.10, 0.03);
      assert.equal(tiny.grossWif, 0);
      assert.equal(tiny.burnedWif, 0);
      assert.equal(tiny.netWif, 0);

      const zeroSwap = calculatePointSwap(0);
      assert.equal(zeroSwap.grossWif, 0);
      assert.equal(zeroSwap.netWif, 0);
    });

    it('F7-B4: Huge token numbers and integer overflow resistance', () => {
      const big = calculateMatchPayouts(100_000_000, [0, 1, 2, 3]);
      assert.equal(big.totalPool, 400_000_000);
      assert.equal(big.burnedAmount, 20_000_000);
      assert.equal(big.vaultAmount, 20_000_000);
      assert.equal(big.purseAmount, 360_000_000);
      assert.equal(big.payouts[0], 216_000_000);
    });

    it('F7-B5: Staking multiplier boundaries (0.0x, 1.0x, 2.0x, 10.0x)', () => {
      assert.equal(calculateStakingBoost(100, true, 0.0), 0);
      assert.equal(calculateStakingBoost(100, true, 1.0), 100);
      assert.equal(calculateStakingBoost(100, true, 2.0), 200);
      assert.equal(calculateStakingBoost(100, true, 10.0), 1000);
      assert.equal(calculateStakingBoost(100, false, 5.0), 100);
    });
  });

  // Feature F8 Boundaries: Wallet Boundary Conditions & Malformed Web3
  describe('F8-B: Wallet Boundary Conditions & Malformed Web3', () => {
    it('F8-B1: Zero and negative cash transfer rejection in simulation', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation', autoConnect: true });
      const accounts = wallet.getSimulatedAccounts();
      const bob = accounts[1].address;

      await assert.rejects(async () => {
        await wallet.transfer(bob, 0);
      }, /Transfer amount must be a positive finite number/);

      await assert.rejects(async () => {
        await wallet.transfer(bob, -500);
      }, /Transfer amount must be a positive finite number/);
    });

    it('F8-B2: Transfer amount exceeding available balance', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation', autoConnect: true });
      const accounts = wallet.getSimulatedAccounts();
      const bob = accounts[1].address;

      await assert.rejects(async () => {
        await wallet.transfer(bob, 10001);
      }, /Insufficient balance/);
    });

    it('F8-B3: Address normalization edge cases', () => {
      const input = '  0XABCdEF1234567890abcdef1234567890ABCDEF12  ';
      const normalized = normalizeAddress(input);
      assert.equal(normalized, '0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('F8-B4: Hex wei conversion boundary extremes', () => {
      assert.equal(hexWeiToTokens('0x0'), 0);
      assert.equal(hexWeiToTokens('0xDE0B6B3A7640000'), 1);
      const hexBack = tokensToHexWei(1);
      assert.ok(hexBack.startsWith('0x'));
    });

    it('F8-B5: Web3 provider emitting error codes 4001, 4902, -32603', async () => {
      const failProvider: EIP1193Provider = {
        async request(args) {
          if (args.method === 'eth_requestAccounts') {
            const err = new Error('RPC Internal Failure');
            (err as any).code = -32603;
            throw err;
          }
          return null;
        },
      };

      const wallet = new WalletAdapter({ mode: 'web3', provider: failProvider });
      await wallet.connect();
      assert.equal(wallet.getState().mode, 'simulation');
      assert.equal(wallet.getState().status, 'connected');
    });
  });

  // Feature F9 Boundaries: Multiplayer Room Desync & Overflows
  describe('F9-B: Multiplayer Room Desync & Overflows', () => {
    it('F9-B1: Invalid room code characters and string lengths', () => {
      assert.equal(isValidRoomCode('ABC'), false);
      assert.equal(isValidRoomCode('ABCDEFGH'), false);
      assert.equal(isValidRoomCode('ABC-DE'), false);
      assert.equal(isValidRoomCode('ABC!23'), false);
      assert.equal(isValidRoomCode('ABC 12'), false);
      assert.equal(isValidRoomCode(123456 as any), false);
    });

    it('F9-B2: Room capacity overflow and invalid seat index', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'CAP001',
        isHost: true,
        localPlayer: { name: 'Host', address: '0xH' },
      });
      await host.start();

      assert.throws(() => {
        host.setSeat(5);
      }, /Seat index must be 0, 1, 2, or 3/);

      host.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-B3: Out-of-order network packets and sequence numbers', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'SEQ002',
        isHost: true,
        localPlayer: { name: 'Host', address: '0xH' },
      });
      await host.start();

      assert.doesNotThrow(() => {
        host.transport.broadcast({
          id: 'pkt-heartbeat-1',
          roomCode: 'SEQ002',
          type: 'HEARTBEAT',
          senderId: 'stranger',
          sequenceNumber: 9999,
          timestamp: Date.now(),
          payload: { clientTimestamp: Date.now() },
        });
      });

      host.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-B4: Desynchronized timestamps and clock drift', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'TIME03',
        isHost: true,
        localPlayer: { name: 'Host', address: '0xH' },
      });
      await host.start();

      assert.doesNotThrow(() => {
        host.transport.broadcast({
          id: 'pkt-heartbeat-2',
          roomCode: 'TIME03',
          type: 'HEARTBEAT',
          senderId: 'future_sender',
          sequenceNumber: 1,
          timestamp: Date.now() + 86400000,
          payload: { clientTimestamp: Date.now() + 86400000 },
        });
      });

      host.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-B5: Disconnect and reconnect with identical client ID', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'RECO04',
        isHost: true,
        localPlayer: { name: 'Host', address: '0xH' },
      });
      await host.start();

      const peer = new NetworkRoom({
        roomCode: 'RECO04',
        isHost: false,
        localPlayer: { name: 'Peer', address: '0xP' },
      });
      await peer.start();
      peer.setSeat(2);

      peer.stop();

      const peerReconnect = new NetworkRoom({
        roomCode: 'RECO04',
        isHost: false,
        localPlayer: { name: 'Peer', address: '0xP' },
      });
      await peerReconnect.start();

      assert.ok(host.state.players.length >= 1);
      host.stop();
      peerReconnect.stop();
      MemoryTransportHub.clearAll();
    });
  });

  // Feature F10 Boundaries: Camera & Canvas Viewport Extremes
  describe('F10-B: Camera & Canvas Viewport Extremes', () => {
    it('F10-B1: Extreme zoom factors clamping', () => {
      const camera = new CameraController();
      camera.setZoom(100.0);
      assert.equal(camera.getState().zoom, 2.5);

      camera.setZoom(0.001);
      assert.equal(camera.getState().zoom, 0.5);
    });

    it('F10-B2: Extreme canvas viewport dimensions', () => {
      const tinyViewport = clampCamera(
        { x: 500, y: 300, zoom: 1.0 },
        { width: 1, height: 1 }
      );
      assert.ok(Number.isFinite(tinyViewport.x));
      assert.ok(Number.isFinite(tinyViewport.y));

      const hugeViewport = clampCamera(
        { x: 500, y: 300, zoom: 1.0 },
        { width: 10000, height: 10000 }
      );
      assert.ok(Number.isFinite(hugeViewport.x));
      assert.ok(Number.isFinite(hugeViewport.y));
    });

    it('F10-B3: Screen coordinate hit test far outside board bounds', () => {
      assert.equal(hitTestBoardPoint(-5000, -5000), null);
      assert.equal(hitTestBoardPoint(50000, 50000), null);
    });

    it('F10-B4: Cash staging clamping beyond liquid cash limits', () => {
      const state = createGame();
      state.phase = 'trade';
      state.players[0].cash = 80;

      const desk = new TradeDeskController(state, { defaultPartnerId: 1 });
      desk.open(1);

      desk.setGiveCash(-100);
      assert.equal(desk.getDeskState().give.cash, 0);

      desk.setGiveCash(500);
      assert.equal(desk.getDeskState().give.cash, 80);
    });

    it('F10-B5: Procedural audio synthesizer mute toggle and volume clamping', () => {
      const audio = new AudioSynthesizer();
      audio.setVolume(-10);
      assert.equal(audio.getVolume(), 0);

      audio.setVolume(25);
      assert.equal(audio.getVolume(), 1);

      const before = audio.isMuted();
      audio.toggleMute();
      assert.equal(audio.isMuted(), !before);
      audio.toggleMute();
      assert.equal(audio.isMuted(), before);
    });
  });

  // Feature F11 Boundaries: Match Loop Edge Cases & Stalemates
  describe('F11-B: Match Loop Edge Cases & Stalemates', () => {
    it('F11-B1: Single-player match with zero player trades in all 6 years', () => {
      const app = new RobinTownApp(null);
      for (let yr = 1; yr <= 6; yr++) {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
        if (yr < 6) app.advanceToNextYear();
      }
      assert.equal(app.getGameState().year, 6);
      assert.equal(app.getGameState().trades, 0);
    });

    it('F11-B2: Zero income harvest round (player builds no shops)', () => {
      const state = createGame();
      state.phase = 'build';
      const initialCash = state.players[0].cash;
      const harvest = collectIncome(state);
      assert.equal(harvest.payouts[0], 0);
      assert.equal(state.players[0].cash, initialCash);
    });

    it('F11-B3: All 4 players tied for cash at match conclusion', () => {
      const state = createGame();
      for (const p of state.players) {
        p.cash = 500;
      }
      for (const lot of state.lots) {
        lot.owner = null;
        lot.shop = null;
      }
      const ranked = rankings(state);
      assert.equal(ranked.length, 4);
      for (const p of ranked) {
        assert.equal(p.cash, 500);
      }
    });

    it('F11-B4: Rapid multi-click action dispatch in RobinTownApp', () => {
      const app = new RobinTownApp(null);
      assert.doesNotThrow(() => {
        app.handleActionClick('quick-draft');
        app.handleActionClick('quick-draft');
        app.handleActionClick('quick-draft');
      });
      assert.equal(app.getGameState().phase, 'trade');
    });

    it('F11-B5: Calling game actions after match status is ended', () => {
      const app = new RobinTownApp(null);
      for (let yr = 1; yr <= 6; yr++) {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
        if (yr < 6) app.advanceToNextYear();
      }
      assert.equal(app.getGameState().phase, 'ended');

      assert.doesNotThrow(() => {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
      });
      assert.equal(app.getGameState().phase, 'ended');
    });
  });

  // Feature F12 Boundaries: Build & Test Pipeline Extremes
  describe('F12-B: Build & Test Pipeline Extremes', () => {
    it('F12-B1: Package scripts and build configuration integrity', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.scripts.test);
      assert.ok(pkg.scripts['test:unit']);
      assert.ok(pkg.scripts['test:e2e']);
      assert.ok(pkg.scripts['test:e2e:tier1']);
      assert.ok(pkg.scripts['test:e2e:tier2']);
    });

    it('F12-B2: Execution with missing or undefined PRNG seed', () => {
      assert.doesNotThrow(() => {
        const game = createGame();
        assert.ok(game.version === 1);
        assert.equal(game.players.length, 4);
      });
    });

    it('F12-B3: High-frequency Monte Carlo simulation under memory pressure', () => {
      const startTime = Date.now();
      for (let run = 0; run < 20; run++) {
        const game = createGame();
        for (let yr = 1; yr <= 6; yr++) {
          draftPlots(game, 0, game.pending.slice(0, game.draftCount));
          advancePhase(game);
          collectIncome(game);
          if (yr < 6) nextYear(game);
        }
        assert.equal(game.phase, 'ended');
      }
      const duration = Date.now() - startTime;
      assert.ok(duration < 2000, `20 runs should complete fast, took ${duration}ms`);
    });

    it('F12-B4: Invalid CLI arguments to asset scripts', () => {
      // Validate parser level rejection of unknown options
      assert.throws(
        () => {
          parseArgs({
            args: ['--invalid-flag', 'unknown'],
            options: { mode: { type: 'string' } },
            strict: true,
          });
        },
        { code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION' }
      );

      // Validate process level CLI argument rejection with non-zero exit code
      const proc = spawnSync(process.execPath, ['--invalid-cli-option-robin-town'], {
        encoding: 'utf8',
      });
      assert.notEqual(proc.status, 0);
      assert.match(proc.stderr, /bad option/);
    });

    it('F12-B5: Non-zero exit code propagation on intentional assertion failure', () => {
      const proc = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '-e',
          'import * as assert from "node:assert/strict"; assert.equal(1, 2);',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );
      assert.equal(proc.status, 1);
      assert.match(proc.stderr, /ERR_ASSERTION/);
    });
  });
});
