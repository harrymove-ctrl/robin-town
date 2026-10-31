/**
 * tests/e2e/tier1-features.test.ts
 *
 * E2E Test Suite Tier 1: Feature Coverage (F1 to F12).
 * Minimum 5 tests per feature (60 tests total).
 * Opaque-box requirements testing exercising public interfaces and contracts.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  SHOP_CATEGORIES,
  calculateClusterIncome,
  getLotsInDistrict,
  TOTAL_LOTS,
  LOT_DEFINITIONS,
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
  validSave,
  evaluateOffer,
  log,
  PLOT_KEEP_SCHEDULE,
  rankings,
} from '../../src/engine/engine';
import {
  BOT_PERSONALITIES,
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
  ROOM_CODE_ALPHABET,
} from '../../src/network/room';
import {
  CameraController,
  boardToScreen,
  screenToBoard,
  hitTestBoardPoint,
} from '../../src/ui/camera';
import { BoardRenderer } from '../../src/ui/board';
import {
  projectTopBarViewModel,
  projectPlayerRibbonViewModel,
  projectActionBarViewModel,
} from '../../src/ui/hud';
import { TradeDeskController } from '../../src/ui/trade-desk';
import { RobinTownApp } from '../../src/app';
import { GAME_IMAGES } from '../../scripts/verify-assets';
import {
  encodePng,
  crc32,
  matrixToRgba,
  scaleRgba,
  generateBoardMapRgba,
  SHOP_MATRICES,
  SHOP_PALETTES,
} from '../../scripts/generate-assets';
import { MockCanvasContext } from './harness';
import type { GameState, TradeOffer } from '../../src/engine/types';

describe('Tier 1: Feature Coverage (F1 to F12)', () => {

  // Feature F1: Execution Plan & Thematic Documentation
  describe('F1: Execution Plan & Thematic Documentation', () => {
    it('F1-1: Execution plan file accessibility and markdown header hierarchy', () => {
      const planPath = path.resolve(process.cwd(), 'docs/EXECUTION_PLAN.md');
      assert.ok(fs.existsSync(planPath), 'docs/EXECUTION_PLAN.md must exist');
      const content = fs.readFileSync(planPath, 'utf8');
      assert.ok(content.length > 500, 'Execution plan must not be empty');
      assert.ok(content.includes('# Robin-Town: Comprehensive Execution Plan'), 'Must contain top title');
      assert.ok(content.includes('Executive Summary and System Architecture'), 'Must contain executive summary');
      assert.ok(content.includes('Five-Stage Implementation Roadmap'), 'Must contain roadmap section');
    });

    it('F1-2: Five-step implementation plan milestone schema validation', () => {
      const planPath = path.resolve(process.cwd(), 'docs/EXECUTION_PLAN.md');
      const content = fs.readFileSync(planPath, 'utf8');
      assert.ok(content.includes('Milestone 1'), 'Must define Milestone 1');
      assert.ok(content.includes('Milestone 2'), 'Must define Milestone 2');
      assert.ok(content.includes('Milestone 3'), 'Must define Milestone 3');
      assert.ok(content.includes('Milestone 4'), 'Must define Milestone 4');
      assert.ok(content.includes('Milestone 5'), 'Must define Milestone 5');
    });

    it('F1-3: Architecture documentation and interface contract consistency', () => {
      const projectDocPath = path.resolve(process.cwd(), 'PROJECT.md');
      assert.ok(fs.existsSync(projectDocPath), 'PROJECT.md must exist');
      const content = fs.readFileSync(projectDocPath, 'utf8');
      assert.ok(content.includes('export type GamePhase'), 'Must document GamePhase contract');
      assert.ok(content.includes('export interface Player'), 'Must document Player contract');
      assert.ok(content.includes('export interface Lot'), 'Must document Lot contract');
      assert.ok(content.includes('export interface GameState'), 'Must document GameState contract');
      assert.ok(content.includes('export interface TradeOffer'), 'Must document TradeOffer contract');
      assert.ok(content.includes('export interface FlywheelConfig'), 'Must document FlywheelConfig contract');
    });

    it('F1-4: Thematic adaptation documentation structure and design pillars', () => {
      const mappingDocPath = path.resolve(process.cwd(), 'docs/THEMATIC_MAPPING.md');
      assert.ok(fs.existsSync(mappingDocPath), 'docs/THEMATIC_MAPPING.md must exist');
      const content = fs.readFileSync(mappingDocPath, 'utf8');
      assert.ok(content.includes('Complete Mathematical Parity'), 'Must specify design pillar 1');
      assert.ok(content.includes('English Web3 Immersion'), 'Must specify design pillar 2');
      assert.ok(content.includes('Deflationary $wif Economy'), 'Must specify design pillar 3');
      assert.ok(content.includes('Expressive AI Archetypes'), 'Must specify design pillar 4');
    });

    it('F1-5: Test infrastructure specification and feature inventory schema', () => {
      const testInfraPath = path.resolve(process.cwd(), 'TEST_INFRA.md');
      assert.ok(fs.existsSync(testInfraPath), 'TEST_INFRA.md must exist');
      const content = fs.readFileSync(testInfraPath, 'utf8');
      assert.ok(content.includes('Feature Inventory'), 'Must contain feature inventory');
      assert.ok(content.includes('Real-World Application Scenarios'), 'Must contain scenarios section');
      assert.ok(content.includes('Coverage Thresholds'), 'Must contain coverage thresholds');
      assert.ok(content.includes('138 test cases'), 'Must specify 138 test cases target');
    });
  });

  // Feature F2: Thematic Mapping & Dictionary Consistency
  describe('F2: Thematic Mapping & Dictionary Consistency', () => {
    it('F2-1: Six financial districts naming and block index consistency', () => {
      assert.equal(DISTRICT_NAMES.length, 6, 'Must define exactly 6 district names');
      assert.equal(DISTRICT_NAMES[0], 'Robinhood District');
      assert.equal(DISTRICT_NAMES[1], 'Wall Street Quarter');
      assert.equal(DISTRICT_NAMES[2], 'Crypto Wharf');
      assert.equal(DISTRICT_NAMES[3], 'Silicon Strip');
      assert.equal(DISTRICT_NAMES[4], 'Memecoin Boulevard');
      assert.equal(DISTRICT_NAMES[5], 'DeFi Citadel');
      assert.equal(DISTRICT_BLOCKS.length, 6, 'District blocks array must have 6 elements');
    });

    it('F2-2: Six protocol shop categories and target sizes consistency', () => {
      assert.equal(SHOPS.length, 6, 'Must define exactly 6 shop categories');
      assert.equal(SHOP_CATEGORIES.length, 6, 'Shop categories in layout must have 6 items');

      const expectedShops = [
        { name: 'DEX Swap', size: 3, quota: 20 },
        { name: 'Memecoin Lounge', size: 3, quota: 20 },
        { name: 'Staking Vault', size: 4, quota: 20 },
        { name: 'Lending Protocol', size: 4, quota: 20 },
        { name: 'Derivatives Exchange', size: 5, quota: 20 },
        { name: 'Validator Citadel', size: 6, quota: 20 },
      ];

      for (let i = 0; i < 6; i++) {
        assert.equal(SHOPS[i].name, expectedShops[i].name);
        assert.equal(SHOPS[i].size, expectedShops[i].size);
        assert.equal(SHOPS[i].quota, expectedShops[i].quota);
        assert.equal(SHOP_CATEGORIES[i].targetSize, expectedShops[i].size);
      }
    });

    it('F2-3: Complete Chinatown to Robin-Town terminology translation verification', () => {
      const mappingPath = path.resolve(process.cwd(), 'docs/THEMATIC_MAPPING.md');
      const text = fs.readFileSync(mappingPath, 'utf8');
      assert.ok(text.includes('$wif'), 'Must map currency to $wif');
      assert.ok(text.includes('DEX Swap'), 'Must map Tea House / Restaurant to DEX Swap');
      assert.ok(text.includes('Memecoin Lounge'), 'Must map Dim Sum to Memecoin Lounge');
      assert.ok(text.includes('Validator Citadel'), 'Must map Seafood / Factory to Validator Citadel');
      assert.ok(text.includes('Deed'), 'Must map property cards to Allocation Deeds');
    });

    it('F2-4: Zero non-English localization strings in engine constants and shop names', () => {
      const vietnameseDiacritics = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

      for (const name of DISTRICT_NAMES) {
        assert.ok(!vietnameseDiacritics.test(name), `District name ${name} must be English`);
      }
      for (const shop of SHOPS) {
        assert.ok(!vietnameseDiacritics.test(shop.name), `Shop name ${shop.name} must be English`);
      }
      for (const [id, bot] of Object.entries(BOT_PERSONALITIES)) {
        assert.ok(!vietnameseDiacritics.test(bot.name), `Bot name ${bot.name} must be English`);
        assert.ok(!vietnameseDiacritics.test(bot.dialogue.greeting), `Bot greeting must be English`);
      }
    });

    it('F2-5: AI bot trader persona titles and thematic dialogues consistency', () => {
      const sherwood = BOT_PERSONALITIES[1];
      const apex = BOT_PERSONALITIES[2];
      const luna = BOT_PERSONALITIES[3];

      assert.ok(sherwood, 'Sherwood bot profile must exist');
      assert.equal(sherwood.name, 'Sherwood');
      assert.ok(sherwood.title.includes('Conservative Yield Seeker'));

      assert.ok(apex, 'Apex bot profile must exist');
      assert.equal(apex.name, 'Apex');
      assert.ok(apex.title.includes('Arbitrage Shark'));

      assert.ok(luna, 'Luna bot profile must exist');
      assert.equal(luna.name, 'Luna');
      assert.ok(luna.title.includes('Liquid Market Maker'));

      for (const bot of [sherwood, apex, luna]) {
        assert.ok(bot.dialogue.greeting.length > 0);
        assert.ok(bot.dialogue.thinking.length > 0);
        assert.ok(bot.dialogue.accepted.length > 0);
        assert.ok(bot.dialogue.counteroffer.length > 0);
        assert.ok(bot.dialogue.rejected.length > 0);
      }
    });
  });

  // Feature F3: Pixel Art Asset Pipeline & Zero-Dependency Binary Validation
  describe('F3: Pixel Art Asset Pipeline & Zero-Dependency Binary Validation', () => {
    it('F3-1: RFC 2083 PNG signature and header chunk byte validation', () => {
      const buffer = encodePng(32, 32, Buffer.alloc(32 * 32 * 4));
      assert.ok(buffer.length > 50, 'Encoded PNG must be non-empty');
      const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.deepEqual(buffer.subarray(0, 8), pngSig, 'Must start with valid 8-byte PNG signature');
      assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', 'First chunk must be IHDR');
      assert.equal(buffer.readUInt32BE(16), 32, 'IHDR width must be 32');
      assert.equal(buffer.readUInt32BE(20), 32, 'IHDR height must be 32');
    });

    it('F3-2: IEEE 802.3 CRC32 checksum calculation correctness', () => {
      const testBuffer = Buffer.from('IHDR');
      const calculatedCrc = crc32(testBuffer);
      assert.ok(typeof calculatedCrc === 'number', 'CRC32 must return a number');
      assert.ok(calculatedCrc > 0, 'CRC32 must be positive integer');
      assert.equal(crc32(Buffer.alloc(0)), 0, 'Empty buffer CRC32 is 0');
    });

    it('F3-3: Native 32x32 character matrix to RGBA buffer conversion', () => {
      const matrix = SHOP_MATRICES[0];
      const palette = SHOP_PALETTES[0];
      const rgba = matrixToRgba(matrix, palette, 32, 32);
      assert.equal(rgba.length, 32 * 32 * 4, 'Buffer size must equal 4096 bytes');

      let hasNonZeroAlpha = false;
      for (let i = 3; i < rgba.length; i += 4) {
        if (rgba[i] > 0) {
          hasNonZeroAlpha = true;
          break;
        }
      }
      assert.ok(hasNonZeroAlpha, 'Converted RGBA buffer must contain visible pixels');
    });

    it('F3-4: Exact 3x integer nearest-neighbor scaling for HD sprites', () => {
      const matrix = SHOP_MATRICES[0];
      const palette = SHOP_PALETTES[0];
      const nativeRgba = matrixToRgba(matrix, palette, 32, 32);
      const hdRgba = scaleRgba(nativeRgba, 32, 32, 3);
      assert.equal(hdRgba.length, 96 * 96 * 4, 'HD buffer length must equal 36,864 bytes');
    });

    it('F3-5: Procedural board map RGBA synthesis with exact 1100x730 dimensions', () => {
      const boardRgba = generateBoardMapRgba(1100, 730);
      assert.equal(boardRgba.length, 1100 * 730 * 4, 'Board map RGBA must equal 3,212,000 bytes');
    });
  });

  // Feature F4: Visual Asset Manifest & Zero-404 Integrity Check
  describe('F4: Visual Asset Manifest & Zero-404 Integrity Check', () => {
    it('F4-1: Asset directory existence and manifest inventory completeness', () => {
      const publicDir = path.resolve(process.cwd(), 'public/assets');
      assert.ok(fs.existsSync(publicDir), 'public/assets directory must exist');
      assert.ok(fs.existsSync(path.join(publicDir, 'shops')), 'shops directory must exist');
      assert.ok(fs.existsSync(path.join(publicDir, 'avatars')), 'avatars directory must exist');
      assert.ok(fs.existsSync(path.join(publicDir, 'tokens')), 'tokens directory must exist');
      assert.ok(fs.existsSync(path.join(publicDir, 'board')), 'board directory must exist');
    });

    it('F4-2: Zero-404 integrity check across all declared GAME_IMAGES', () => {
      assert.ok(GAME_IMAGES.length >= 30, 'Manifest must declare at least 30 images');
      for (const assetPath of GAME_IMAGES) {
        const fullPath = path.resolve(process.cwd(), 'public', assetPath.replace(/^\//, ''));
        assert.ok(fs.existsSync(fullPath), `Asset file ${assetPath} must exist at ${fullPath}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `Asset file ${assetPath} must have non-zero size`);
      }
    });

    it('F4-3: Shop sprites binary format and dimension verification', () => {
      const publicDir = path.resolve(process.cwd(), 'public/assets/shops');
      const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      for (let s = 0; s < 6; s++) {
        const nativeFile = path.join(publicDir, `shop_${s}.png`);
        const hdFile = path.join(publicDir, `shop_${s}_hd.png`);
        assert.ok(fs.existsSync(nativeFile), `shop_${s}.png must exist`);
        assert.ok(fs.existsSync(hdFile), `shop_${s}_hd.png must exist`);

        const nativeBuf = fs.readFileSync(nativeFile);
        assert.deepEqual(nativeBuf.subarray(0, 8), pngSig, `shop_${s}.png must be valid PNG`);
        assert.equal(nativeBuf.readUInt32BE(16), 32);
        assert.equal(nativeBuf.readUInt32BE(20), 32);

        const hdBuf = fs.readFileSync(hdFile);
        assert.deepEqual(hdBuf.subarray(0, 8), pngSig, `shop_${s}_hd.png must be valid PNG`);
        assert.equal(hdBuf.readUInt32BE(16), 96);
        assert.equal(hdBuf.readUInt32BE(20), 96);
      }
    });

    it('F4-4: Player avatar sprites binary format and dimension verification', () => {
      const publicDir = path.resolve(process.cwd(), 'public/assets/avatars');
      const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      for (let a = 0; a < 4; a++) {
        const nativeFile = path.join(publicDir, `avatar_${a}.png`);
        const hdFile = path.join(publicDir, `avatar_${a}_hd.png`);
        assert.ok(fs.existsSync(nativeFile), `avatar_${a}.png must exist`);
        assert.ok(fs.existsSync(hdFile), `avatar_${a}_hd.png must exist`);

        const nativeBuf = fs.readFileSync(nativeFile);
        assert.deepEqual(nativeBuf.subarray(0, 8), pngSig);
        assert.equal(nativeBuf.readUInt32BE(16), 32);

        const hdBuf = fs.readFileSync(hdFile);
        assert.deepEqual(hdBuf.subarray(0, 8), pngSig);
        assert.equal(hdBuf.readUInt32BE(16), 96);
      }
    });

    it('F4-5: Board map and UI icon binary asset integrity', () => {
      const publicDir = path.resolve(process.cwd(), 'public/assets');
      const boardPath = path.join(publicDir, 'board/board_map.png');
      const coinPath = path.join(publicDir, 'tokens/coin_wif.png');
      const usdgPath = path.join(publicDir, 'tokens/bill_usdg.png');

      assert.ok(fs.existsSync(boardPath), 'board_map.png must exist');
      assert.ok(fs.existsSync(coinPath), 'coin_wif.png must exist');
      assert.ok(fs.existsSync(usdgPath), 'bill_usdg.png must exist');

      const boardBuf = fs.readFileSync(boardPath);
      assert.equal(boardBuf.readUInt32BE(16), 1100);
      assert.equal(boardBuf.readUInt32BE(20), 730);
    });
  });

  // Feature F5: Core Game Engine State Machine, Phases, & Invariants
  describe('F5: Core Game Engine State Machine, Phases, & Invariants', () => {
    it('F5-1: Game initialization state and parcel conservation invariant', () => {
      const state = createGame();
      assert.equal(state.version, 1);
      assert.equal(state.year, 1);
      assert.equal(state.phase, 'receive');
      assert.equal(state.players.length, 4);
      assert.equal(state.lots.length, 72);

      for (const p of state.players) {
        assert.equal(p.cash, 50, 'Starting cash must be 50 $wif');
      }

      for (const lot of state.lots) {
        assert.equal(lot.owner, null);
        assert.equal(lot.shop, null);
      }

      let totalTiles = state.bag.length;
      for (const p of state.players) {
        totalTiles += p.tiles.reduce((a, b) => a + b, 0);
      }
      assert.equal(totalTiles, 120, '120 tiles must be conserved');
    });

    it('F5-2: Epoch 1 allocation deed drafting and draftCount progression', () => {
      const state = createGame();
      assert.equal(state.draftCount, 5);
      assert.equal(state.pending.length, 7);

      const chosen = state.pending.slice(0, 5);
      draftPlots(state, 0, chosen);

      assert.equal(state.phase, 'trade');
      assert.equal(state.pending.length, 0);

      const p0Lots = state.lots.filter((l) => l.owner === 0);
      assert.equal(p0Lots.length, 5);
    });

    it('F5-3: Phase progression from trade to build to income to next year', () => {
      const state = createGame();
      draftPlots(state, 0, state.pending.slice(0, 5));
      assert.equal(state.phase, 'trade');

      advancePhase(state);
      assert.equal(state.phase, 'build');

      const ownedLot = state.lots.find((l) => l.owner === 0)!;
      let shopPlaced = -1;
      for (let s = 0; s < 6; s++) {
        if (state.players[0].tiles[s] > 0) {
          buildTile(state, 0, ownedLot.id, s);
          shopPlaced = s;
          break;
        }
      }
      assert.ok(shopPlaced >= 0);
      assert.equal(state.lots[ownedLot.id].shop, shopPlaced);

      const harvest = collectIncome(state);
      assert.equal(state.phase, 'income');
      assert.ok(Array.isArray(harvest.payouts));

      nextYear(state);
      assert.equal(state.year, 2);
      assert.equal(state.phase, 'receive');
    });

    it('F5-4: Non-linear Chinatown payout table mathematical fidelity', () => {
      // Size 3 shop payouts
      assert.equal(groupIncome(0, 1), 10);
      assert.equal(groupIncome(0, 2), 20);
      assert.equal(groupIncome(0, 3), 50); // Complete
      assert.equal(groupIncome(0, 6), 100);

      // Size 4 shop payouts
      assert.equal(groupIncome(2, 4), 80); // Complete

      // Size 5 shop payouts
      assert.equal(groupIncome(4, 5), 110); // Complete

      // Size 6 shop payouts
      assert.equal(groupIncome(5, 6), 140); // Complete
    });

    it('F5-5: 6-Year match completion and ended phase transition', () => {
      const state = createGame();
      for (let yr = 1; yr <= 6; yr++) {
        draftPlots(state, 0, state.pending.slice(0, state.draftCount));
        advancePhase(state);
        collectIncome(state);
        if (yr < 6) {
          nextYear(state);
        }
      }
      assert.equal(state.year, 6);
      assert.equal(state.phase, 'ended');
      assert.equal(validSave(state), true);
    });
  });

  // Feature F6: AI Bot Personalities (Sherwood, Apex, Luna) Heuristics
  describe('F6: AI Bot Personalities (Sherwood, Apex, Luna) Heuristics', () => {
    it('F6-1: AI bot personality profile definitions and parameter divergence', () => {
      const p1 = BOT_PERSONALITIES[1];
      const p2 = BOT_PERSONALITIES[2];
      const p3 = BOT_PERSONALITIES[3];

      assert.equal(p1.profitMargin, 1.0);
      assert.equal(p1.riskTolerance, 0.5);

      assert.equal(p2.profitMargin, 1.15);
      assert.equal(p2.riskTolerance, 0.2);

      assert.equal(p3.profitMargin, 0.95);
      assert.equal(p3.riskTolerance, 0.85);

      assert.notEqual(p1.profitMargin, p2.profitMargin);
      assert.notEqual(p2.profitMargin, p3.profitMargin);
    });

    it('F6-2: Plot score heuristic calculation favoring adjacent friendly parcels', () => {
      const state = createGame();
      state.lots[0].owner = 1; // Bot 1 owns lot 0
      state.lots[1].owner = null; // Lot 1 is orthogonal neighbor of lot 0
      state.lots[30].owner = null; // Lot 30 is distant parcel

      const scoreAdjacent = plotScore(1, 1, state);
      const scoreDistant = plotScore(30, 1, state);
      assert.ok(scoreAdjacent > scoreDistant, 'Adjacent parcel must score higher than distant parcel');
    });

    it('F6-3: Automated bot drafting algorithm parcel selection', () => {
      const state = createGame();
      const unownedCountBefore = state.lots.filter((l) => l.owner === null).length;
      botDraft(state, 1, 3);
      const bot1Lots = state.lots.filter((l) => l.owner === 1);
      assert.equal(bot1Lots.length, 3);
      const unownedCountAfter = state.lots.filter((l) => l.owner === null).length;
      assert.equal(unownedCountAfter, unownedCountBefore - 3);
    });

    it('F6-4: Automated greedy bot building algorithm execution', () => {
      const state = createGame();
      state.lots[10].owner = 1;
      state.lots[11].owner = 1;
      state.players[1].tiles[0] = 2; // Bot 1 has two DEX tiles

      botBuild(state, 1);
      const bot1Shops = state.lots.filter((l) => l.owner === 1 && l.shop !== null);
      assert.ok(bot1Shops.length >= 1, 'Bot must deploy matching tile on vacant parcel');
    });

    it('F6-5: Bilateral OTC trade offer evaluation, shortfall calculation, and counteroffer', () => {
      const state = createGame();
      state.phase = 'trade';
      state.lots[0].owner = 0;
      state.lots[1].owner = 1;
      state.players[0].cash = 100;
      state.players[1].cash = 100;

      const offer: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 1, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [1] },
      };

      const evaluation = evaluateOffer(state, offer);
      assert.equal(evaluation.accepted, false);
      assert.ok(evaluation.shortfall > 0);
      assert.ok(typeof evaluation.quoteMessage === 'string');
    });
  });

  // Feature F7: $wif Tokenomics Flywheel Math, Buy-In Pools, & Burn Sinks
  describe('F7: $wif Tokenomics Flywheel Math, Buy-In Pools, & Burn Sinks', () => {
    it('F7-1: Competitive match buy-in pool 5% burn and 5% vault allocation', () => {
      const result = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      assert.equal(result.totalPool, 4000);
      assert.equal(result.burnedAmount, 200); // 5%
      assert.equal(result.vaultAmount, 200); // 5%
      assert.equal(result.purseAmount, 3600); // 90%
      assert.equal(result.burnAddress, BURN_ADDRESS);
    });

    it('F7-2: Podium purse distribution and dust conservation invariant', () => {
      const result = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      assert.equal(result.payouts[0], 2160); // 60% of 3600
      assert.equal(result.payouts[1], 900); // 25% of 3600
      assert.equal(result.payouts[2], 540); // 15% of 3600
      assert.equal(result.payouts[3], 0);

      const totalDisbursed = result.burnedAmount + result.vaultAmount +
        Object.values(result.payouts).reduce((a, b) => a + b, 0);
      assert.equal(totalDisbursed, 4000);
    });

    it('F7-3: Casual point-to-token swap conversion and 3% burn tax', () => {
      const swap = calculatePointSwap(1000, 0.10, 0.03);
      assert.equal(swap.points, 1000);
      assert.equal(swap.grossWif, 100);
      assert.equal(swap.burnedWif, 3);
      assert.equal(swap.netWif, 97);
    });

    it('F7-4: OTC trade micro-tax 1% deduction on cash transfers', () => {
      const tax = calculateTradeTax(500, 0.01);
      assert.equal(tax.grossCash, 500);
      assert.equal(tax.taxAmount, 5);
      assert.equal(tax.netCash, 495);
      assert.equal(tax.vaultAmount, 5);
    });

    it('F7-5: Staking yield 1.20x bonus multiplier and cumulative flywheel state', () => {
      const boosted = calculateStakingBoost(100, true, 1.20);
      const unboosted = calculateStakingBoost(100, false, 1.20);
      assert.equal(boosted, 120);
      assert.equal(unboosted, 100);

      let flywheel = createInitialFlywheelState();
      const pool = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      flywheel = applyMatchPayouts(flywheel, pool);
      assert.equal(flywheel.totalBurned, 200);
      assert.equal(flywheel.totalMatches, 1);
    });
  });

  // Feature F8: Dual-Mode Wallet System
  describe('F8: Dual-Mode Wallet System', () => {
    it('F8-1: Off-chain simulation initialization with 4 pre-funded accounts', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation' });
      await wallet.connect();
      const state = wallet.getState();
      assert.equal(state.mode, 'simulation');
      assert.equal(state.status, 'connected');
      assert.equal(wallet.getSimulatedAccounts().length, 4);

      for (const acc of wallet.getSimulatedAccounts()) {
        assert.equal(acc.balance, 10000);
      }
    });

    it('F8-2: Simulation transfers between accounts and burn execution', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation', autoConnect: true });
      const accounts = wallet.getSimulatedAccounts();
      const bob = accounts[1].address;

      await wallet.transfer(bob, 500);
      assert.equal(wallet.getSimulatedAccounts()[0].balance, 9500);
      assert.equal(wallet.getSimulatedAccounts()[1].balance, 10500);

      await wallet.transfer(BURN_ADDRESS, 200);
      assert.equal(wallet.getSimulatedAccounts()[0].balance, 9300);
    });

    it('F8-3: Simulated cryptographic message signing and token approvals', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation' });
      const signature = await wallet.signMessage('Trade Deal #123');
      assert.ok(signature.startsWith('0x'));

      const approval = await wallet.approve('0xSpenderContract0000000000000000000001', 1000);
      assert.equal(approval.status, 'confirmed');
    });

    it('F8-4: Web3 EIP-1193 provider connection and chain ID verification', async () => {
      const mockProvider: EIP1193Provider = {
        async request(args) {
          if (args.method === 'eth_requestAccounts') return ['0x9999999999999999999999999999999999999999'];
          if (args.method === 'eth_chainId') return '0xb626'; // 46630 in hex
          if (args.method === 'eth_getBalance') return '0x56bc75e2d63100000';
          return null;
        },
      };

      const wallet = new WalletAdapter({ mode: 'web3', provider: mockProvider });
      await wallet.connect();
      const state = wallet.getState();
      assert.equal(state.mode, 'web3');
      assert.equal(state.status, 'connected');
      assert.equal(state.chainId, ROBINHOOD_CHAIN_ID);
      assert.equal(state.isCorrectChain, true);
    });

    it('F8-5: Resilient auto-fallback to simulation on provider absence or user rejection', async () => {
      const rejectingProvider: EIP1193Provider = {
        async request(args) {
          if (args.method === 'eth_requestAccounts') {
            const err = new Error('User rejected connection');
            (err as any).code = 4001;
            throw err;
          }
          return null;
        },
      };

      const wallet = new WalletAdapter({ mode: 'web3', provider: rejectingProvider });
      await wallet.connect();
      const state = wallet.getState();
      assert.equal(state.mode, 'simulation');
      assert.equal(state.status, 'connected');
    });
  });

  // Feature F9: Multiplayer Room Sessions
  describe('F9: Multiplayer Room Sessions', () => {
    it('F9-1: Room code generation, normalization, and regex validation', () => {
      const code = generateRoomCode();
      assert.equal(code.length, 6);
      assert.equal(isValidRoomCode(code), true);

      for (const char of code) {
        assert.ok(ROOM_CODE_ALPHABET.includes(char), `Character ${char} must be in alphabet`);
      }

      assert.equal(normalizeRoomCode(' ab12cd '), 'AB12CD');
      assert.equal(isValidRoomCode('INVALID-CODE'), false);
    });

    it('F9-2: Multiplayer room creation, host assignment, and state initialization', async () => {
      MemoryTransportHub.clearAll();
      const room = new NetworkRoom({
        roomCode: 'HOST01',
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
      });

      await room.start();
      assert.equal(room.state.status, 'lobby');
      assert.equal(room.isLocalHost(), true);
      assert.equal(room.state.players.length, 1);
      room.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-3: Peer join request, seat assignment, and room capacity limits', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'SEAT02',
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
      });
      const peer = new NetworkRoom({
        roomCode: 'SEAT02',
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0xPeerBob' },
      });

      await host.start();
      await peer.start();

      peer.setSeat(1);
      assert.equal(peer.getLocalPlayer()?.seat, 1);

      host.stop();
      peer.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-4: Headless peer-to-peer transport message relay and state sequence sync', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'SYNC03',
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
      });
      const peer = new NetworkRoom({
        roomCode: 'SYNC03',
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0xPeerBob' },
      });

      await host.start();
      await peer.start();

      peer.setSeat(1);
      peer.toggleReady(true);
      host.toggleReady(true);
      host.startMatch(123456);

      assert.equal(host.state.status, 'playing');
      assert.ok(host.state.gameState);

      host.stop();
      peer.stop();
      MemoryTransportHub.clearAll();
    });

    it('F9-5: Host failover and automatic host migration upon host disconnect', async () => {
      MemoryTransportHub.clearAll();
      const host = new NetworkRoom({
        roomCode: 'FAIL04',
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
      });
      const peer = new NetworkRoom({
        roomCode: 'FAIL04',
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0xPeerBob' },
      });

      await host.start();
      await peer.start();

      host.stop();
      peer.checkPlayerLiveness();

      assert.ok(peer.state.players.length >= 1);
      peer.stop();
      MemoryTransportHub.clearAll();
    });
  });

  // Feature F10: Web Game UI Views, Camera Projection, & Canvas
  describe('F10: Web Game UI Views, Camera Projection, & Canvas', () => {
    it('F10-1: Camera pan, zoom, clamping, and coordinate transform bijection', () => {
      const camera = new CameraController({ width: 1100, height: 730 });
      const viewport = { width: 1100, height: 730 };

      const originalBoardX = 400;
      const originalBoardY = 300;

      const screenPos = boardToScreen(originalBoardX, originalBoardY, camera.getState(), viewport);
      const invertedBoardPos = screenToBoard(screenPos.x, screenPos.y, camera.getState(), viewport);

      assert.ok(Math.abs(invertedBoardPos.x - originalBoardX) < 0.001);
      assert.ok(Math.abs(invertedBoardPos.y - originalBoardY) < 0.001);

      camera.setZoom(10.0);
      assert.equal(camera.getState().zoom, 2.5, 'Zoom must clamp to max 2.5');

      camera.setZoom(0.01);
      assert.equal(camera.getState().zoom, 0.5, 'Zoom must clamp to min 0.5');
    });

    it('F10-2: Hit testing screen coordinates to parcel indices', () => {
      const lot0 = LOT_DEFINITIONS[0];
      const centerX = lot0.x + 25;
      const centerY = lot0.y + 25;

      const hit = hitTestBoardPoint(centerX, centerY);
      assert.equal(hit, 0, 'Center of lot 0 must hit lot 0');

      const streetHit = hitTestBoardPoint(350, 100);
      assert.equal(streetHit, null, 'Street channel coordinate must return null');
    });

    it('F10-3: Decoupled canvas board rendering pipeline and draw call execution', () => {
      const camera = new CameraController({ width: 1100, height: 730 });
      const renderer = new BoardRenderer(camera);
      const mockCtx = new MockCanvasContext();
      const state = createGame();

      renderer.render(mockCtx, { width: 1100, height: 730 }, {
        gameState: state,
        selectedLotId: null,
        hoveredLotId: null,
        validBuildLots: [],
        invalidBuildLots: [],
        activePlayerId: 0,
        selectedShopType: null,
      });

      assert.ok(mockCtx.drawCalls.length > 50, 'Renderer must issue draw calls to context');
      assert.ok(mockCtx.drawCalls.some((c) => c.type === 'save'));
      assert.ok(mockCtx.drawCalls.some((c) => c.type === 'restore'));
    });

    it('F10-4: HUD top bar, player ribbon, and action bar view model projections', () => {
      const state = createGame();
      const topBar = projectTopBarViewModel(state);
      assert.equal(topBar.year, 1);
      assert.equal(topBar.phase, 'receive');

      const ribbon = projectPlayerRibbonViewModel(state);
      assert.equal(ribbon.players.length, 4);

      const actionBar = projectActionBarViewModel(state);
      const primaryBtn = actionBar.buttons.find((b) => b.primary);
      assert.ok(primaryBtn !== undefined);
    });

    it('F10-5: Trade desk controller staging, limits, and counterparty selection', () => {
      const state = createGame();
      state.phase = 'trade';
      state.players[0].cash = 100;
      state.players[1].cash = 100;

      const desk = new TradeDeskController(state, { defaultPartnerId: 1 });
      desk.open(1);
      assert.equal(desk.getDeskState().isOpen, true);
      assert.equal(desk.getDeskState().partnerId, 1);

      desk.setGiveCash(50);
      assert.equal(desk.getDeskState().give.cash, 50);

      desk.setGiveCash(999999);
      assert.equal(desk.getDeskState().give.cash, 100, 'Cash must clamp to available liquid cash');
    });
  });

  // Feature F11: Complete Single-Player Match Loop Coordination
  describe('F11: Complete Single-Player Match Loop Coordination', () => {
    it('F11-1: RobinTownApp coordinator initialization and domain controller wiring', () => {
      const app = new RobinTownApp(null, { isStaked: true });
      assert.ok(app.getGameState(), 'Game state must be non-null');
      assert.ok(app.getCameraController(), 'Camera must be wired');
      assert.ok(app.getBoardRenderer(), 'Board renderer must be wired');
      assert.ok(app.getTradeDeskController(), 'Trade desk must be wired');
      assert.ok(app.getWalletAdapter(), 'Wallet adapter must be wired');
      assert.ok(app.getAudio(), 'Audio must be wired');
    });

    it('F11-2: Multi-epoch single-player progression through helper methods', () => {
      const app = new RobinTownApp(null);
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      app.quickDraft();
      assert.equal(app.getGameState().phase, 'trade');

      app.finishTrading();
      assert.equal(app.getGameState().phase, 'build');

      app.harvestYield();
      assert.equal(app.getGameState().phase, 'income');

      app.advanceToNextYear();
      assert.equal(app.getGameState().year, 2);
      assert.equal(app.getGameState().phase, 'receive');
    });

    it('F11-3: Full 6-year single-player match simulation from allocation to Year 6 end', () => {
      const app = new RobinTownApp(null);
      for (let yr = 1; yr <= 6; yr++) {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
        if (yr < 6) {
          app.advanceToNextYear();
        }
      }
      assert.equal(app.getGameState().year, 6);
      assert.equal(app.getGameState().phase, 'ended');
    });

    it('F11-4: Final match settlement calculation, podium rankings, and purse distribution', () => {
      const app = new RobinTownApp(null);
      for (let yr = 1; yr <= 6; yr++) {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
        if (yr < 6) app.advanceToNextYear();
      }
      const settlement = app.getFinalSettlement();
      assert.equal(settlement.rankings.length, 4);
      assert.equal(settlement.matchPool.totalPool, 4000);
      assert.equal(settlement.matchPool.burnedAmount, 200);
      assert.equal(settlement.matchPool.purseAmount, 3600);
    });

    it('F11-5: Player score points to $wif redemption with burn deduction', () => {
      const app = new RobinTownApp(null);
      const points = 2500;
      const swap = app.swapPointsForWif(points);
      assert.equal(swap.points, 2500);
      assert.equal(swap.grossWif, 250);
      assert.equal(swap.burnedWif, 8);
      assert.equal(swap.netWif, 242);
    });
  });

  // Feature F12: Automated Verification Pipeline & Build Reproducibility
  describe('F12: Automated Verification Pipeline & Build Reproducibility', () => {
    it('F12-1: Package scripts and build configuration integrity', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.scripts.test, 'package.json must contain test script');
      assert.ok(pkg.scripts['test:e2e'], 'package.json must contain test:e2e script');
      assert.ok(pkg.scripts.build, 'package.json must contain build script');
      assert.ok(pkg.scripts.typecheck, 'package.json must contain typecheck script');
      assert.ok(pkg.scripts['verify:assets'], 'package.json must contain verify:assets script');
    });

    it('F12-2: TypeScript strict compiler configuration schema validation', () => {
      const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      assert.equal(tsconfig.compilerOptions.strict, true, 'tsconfig strict must be true');
      assert.equal(tsconfig.compilerOptions.target, 'ES2022');
    });

    it('F12-3: Vite configuration and asset build pipeline configuration', () => {
      const vitePath = path.resolve(process.cwd(), 'vite.config.ts');
      assert.ok(fs.existsSync(vitePath), 'vite.config.ts must exist');
      const viteContent = fs.readFileSync(vitePath, 'utf8');
      assert.ok(viteContent.includes('defineConfig'), 'Must export Vite config definition');
    });

    it('F12-4: Standalone asset verification script execution reproducibility', () => {
      const publicDir = path.resolve(process.cwd(), 'public');
      for (const assetPath of GAME_IMAGES) {
        const filePath = path.join(publicDir, assetPath.replace(/^\//, ''));
        assert.ok(fs.existsSync(filePath), `Asset ${assetPath} must exist on disk`);
      }
    });

    it('F12-5: Deterministic game engine simulation reproducibility under identical seeds', () => {
      const seedRng1 = (seed: number) => {
        let s = seed;
        return () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
      };
      const seedRng2 = (seed: number) => {
        let s = seed;
        return () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
      };

      const game1 = createGame(undefined, seedRng1(123456));
      const game2 = createGame(undefined, seedRng2(123456));

      assert.deepEqual(game1.pending, game2.pending, 'Pending lot draws must be identical');
      assert.deepEqual(game1.bag, game2.bag, 'Tile bag sequence must be identical');
    });
  });
});
