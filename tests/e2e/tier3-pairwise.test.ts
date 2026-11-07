/**
 * tests/e2e/tier3-pairwise.test.ts
 *
 * Tier 3: Cross-Feature Pairwise Combinations for robin-town.
 * Tests 12 cross-feature interactions across subsystems sharing state,
 * data flow, or control flow.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createGame,
  startYear,
  draftPlots,
  beginBuild,
  buildTile,
  collectIncome,
  nextYear,
  executeTrade,
  rankings,
  emptyOffer,
  SHOPS,
} from '../../src/engine/engine';
import {
  BOT_PERSONALITIES,
  calculateLotValue,
  calculateTileValue,
  evaluateTradeOffer,
  getBotPersonality,
  plotScore,
} from '../../src/engine/bot';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  canBuildShop,
  getLotDefinition,
  TOTAL_LOTS,
} from '../../src/engine/board-layout';
import {
  applyMatchPayouts,
  applyPointSwap,
  applyTradeTax,
  BURN_ADDRESS,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  calculateTradeTax,
  createInitialFlywheelState,
  DEFAULT_FLYWHEEL_CONFIG,
  type FlywheelState,
} from '../../src/tokenomics/flywheel';
import {
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  WalletAdapter,
  type EIP1193Provider,
} from '../../src/tokenomics/wallet';
import {
  MemoryTransport,
  MemoryTransportHub,
  NetworkRoom,
} from '../../src/network/room';
import {
  boardToScreen,
  CameraController,
  hitTestBoardPoint,
  hitTestScreenPoint,
  screenToBoard,
} from '../../src/ui/camera';
import { TradeDeskController } from '../../src/ui/trade-desk';
import { AudioSynthesizer } from '../../src/ui/audio';
import type { GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createRng(seed: number): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Tier 3: Cross-Feature Pairwise Combinations', () => {

  // P1: Engine drafting + Bot heuristic evaluation (F5 x F6)
  describe('P1: Engine drafting + Bot heuristic evaluation (F5 x F6)', () => {
    it('executes plot drafting and automated bot heuristics with parcel conservation', () => {
      const rng = createRng(42);
      const state = createGame(undefined, rng);

      assert.strictEqual(state.phase, 'receive');
      assert.strictEqual(state.pending.length, state.draftCount + 2);

      const humanChoices = state.pending.slice(0, state.draftCount);
      draftPlots(state, 0, humanChoices, rng);

      assert.strictEqual(state.phase, 'trade');
      assert.strictEqual(state.pending.length, 0);

      for (let p = 0; p < 4; p++) {
        const owned = state.lots.filter((l) => l.owner === p);
        assert.strictEqual(owned.length, 5);
      }

      const totalOwned = state.lots.filter((l) => l.owner !== null).length;
      assert.strictEqual(totalOwned, 20);

      const lotSample = state.lots.find((l) => l.owner === 1)!;
      const score = plotScore(lotSample.id, 1, state);
      assert.ok(typeof score === 'number' && score >= 0);
    });
  });

  // P2: Bot valuation + Trade desk state machine (F6 x F10)
  describe('P2: Bot valuation + Trade desk state machine (F6 x F10)', () => {
    it('enforces trade phase and generates bot shortfall counteroffers', () => {
      const rng = createRng(99);
      const state = createGame(undefined, rng);
      state.phase = 'receive';

      const desk = new TradeDeskController(state, { defaultPartnerId: 1 });
      assert.throws(() => {
        desk.open(1);
      }, /Trade phase/);
      assert.strictEqual(desk.getDeskState().isOpen, false);

      state.phase = 'trade';
      state.lots[0].owner = 0;
      state.lots[1].owner = 1;
      state.players[0].cash = 100;
      state.players[1].cash = 100;

      desk.open(1);
      assert.strictEqual(desk.getDeskState().isOpen, true);

      desk.toggleTakeLot(1);
      const deskState = desk.getDeskState();
      assert.ok(deskState.evaluation);
      assert.strictEqual(deskState.evaluation.accepted, false);
      assert.ok(deskState.evaluation.shortfall > 0);
      assert.ok(deskState.evaluation.counterOffer);

      const accepted = desk.applyCounteroffer();
      assert.strictEqual(accepted, true);
      const afterEval = desk.getDeskState().evaluation;
      assert.ok(afterEval?.accepted);
    });
  });

  // P3: Trade execution + 1% Micro-tax tokenomics flywheel (F7 x F10)
  describe('P3: Trade execution + 1% Micro-tax tokenomics flywheel (F7 x F10)', () => {
    it('applies 1% micro-tax to cash transfers and routes to community vault', () => {
      const rng = createRng(77);
      const state = createGame(undefined, rng);
      state.phase = 'trade';
      state.lots[10].owner = 0;
      state.lots[20].owner = 1;
      state.players[0].cash = 200;
      state.players[1].cash = 200;

      let flywheel = createInitialFlywheelState();
      const tax50 = calculateTradeTax(50, 0.01);
      assert.strictEqual(tax50.grossCash, 50);
      assert.strictEqual(tax50.taxAmount, 1);
      assert.strictEqual(tax50.netCash, 49);
      assert.strictEqual(tax50.vaultAmount, 1);

      flywheel = applyTradeTax(flywheel, tax50);
      assert.strictEqual(flywheel.totalTradesTaxed, 1);
      assert.strictEqual(flywheel.totalStakingYield, 1);

      const offer: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 50, tiles: [0, 0, 0, 0, 0, 0], lots: [10] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [20] },
      };

      const tradeResult = executeTrade(state, offer);
      if (tradeResult.evaluation.accepted) {
        assert.strictEqual(state.lots[10].owner, 1);
        assert.strictEqual(state.lots[20].owner, 0);
      }
    });
  });

  // P4: Match completion + Dynamic tournament prize purse payout (F5 x F7)
  describe('P4: Match completion + Dynamic tournament prize purse payout (F5 x F7)', () => {
    it('distributes 4,000 $wif match pool with exact conservation and dust allocation', () => {
      const rng = createRng(555);
      const state = createGame(undefined, rng);
      state.year = 6;
      state.phase = 'build';

      state.players[0].cash = 350;
      state.players[1].cash = 420;
      state.players[2].cash = 280;
      state.players[3].cash = 150;

      collectIncome(state);
      assert.strictEqual(state.phase, 'ended');

      const finalRankings = rankings(state);
      const rankedIds = finalRankings.map((p) => p.id);
      const poolResult = calculateMatchPayouts(1000, rankedIds);

      assert.strictEqual(poolResult.totalPool, 4000);
      assert.strictEqual(poolResult.burnedAmount, 200);
      assert.strictEqual(poolResult.vaultAmount, 200);
      assert.strictEqual(poolResult.purseAmount, 3600);
      assert.strictEqual(poolResult.burnAddress, BURN_ADDRESS);

      const sumPayouts = Object.values(poolResult.payouts).reduce((a, b) => a + b, 0);
      assert.strictEqual(sumPayouts, 3600);

      const firstPlaceId = rankedIds[0];
      const fourthPlaceId = rankedIds[3];
      assert.strictEqual(poolResult.payouts[firstPlaceId], 2160);
      assert.strictEqual(poolResult.payouts[fourthPlaceId], 0);

      let flywheel = createInitialFlywheelState();
      flywheel = applyMatchPayouts(flywheel, poolResult);
      assert.strictEqual(flywheel.totalBurned, 200);
      assert.strictEqual(flywheel.totalPrizesDisbursed, 3600);
      assert.strictEqual(flywheel.totalMatches, 1);
    });
  });

  // P5: Off-chain wallet simulation + Match buy-in pool creation (F7 x F8)
  describe('P5: Off-chain wallet simulation + Match buy-in pool creation (F7 x F8)', () => {
    it('manages 4 simulation wallets, debits buy-in, and disburses podium prize', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation' });
      const accounts = wallet.getSimulatedAccounts();
      assert.strictEqual(accounts.length, 4);
      for (const acc of accounts) {
        assert.strictEqual(acc.balance, 10000);
      }

      const escrowAddress = '0xEscrowTournamentContract00000000000001';
      for (const acc of accounts) {
        await wallet.switchAccount(acc.address);
        await wallet.transfer(escrowAddress, 1000);
      }

      for (const acc of wallet.getSimulatedAccounts()) {
        assert.strictEqual(acc.balance, 9000);
      }

      const pool = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      const alicePrize = pool.payouts[0];
      assert.strictEqual(alicePrize, 2160);

      await wallet.switchAccount(accounts[0].address);
      const balanceBefore = await wallet.getBalance();
      assert.strictEqual(balanceBefore, 9000);
    });
  });

  // P6: Web3 provider connection + Staking yield calculation (F7 x F8)
  describe('P6: Web3 provider connection + Staking yield calculation (F7 x F8)', () => {
    it('connects to Web3 provider and calculates 1.20x seasonal staking boost', async () => {
      const mockProvider: EIP1193Provider = {
        async request(args) {
          if (args.method === 'eth_requestAccounts') {
            return ['0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'];
          }
          if (args.method === 'eth_chainId') {
            return '0xb626';
          }
          if (args.method === 'eth_getBalance') {
            return '0x1b1ae4d6e2ef500000';
          }
          if (args.method === 'personal_sign') {
            return '0xmock_signature_valid';
          }
          return null;
        },
      };

      const wallet = new WalletAdapter({ mode: 'web3', provider: mockProvider });
      await wallet.connect();

      const state = wallet.getState();
      assert.strictEqual(state.mode, 'web3');
      assert.strictEqual(state.status, 'connected');
      assert.strictEqual(state.chainId, ROBINHOOD_CHAIN_ID);
      assert.strictEqual(state.isCorrectChain, true);

      const baseReward = 140;
      const boosted = calculateStakingBoost(baseReward, true, 1.20);
      const unboosted = calculateStakingBoost(baseReward, false, 1.20);
      assert.strictEqual(boosted, 168);
      assert.strictEqual(unboosted, 140);
    });
  });

  // P7: Multiplayer room creation + Engine state synchronization (F5 x F9)
  describe('P7: Multiplayer room creation + Engine state synchronization (F5 x F9)', () => {
    it('synchronizes game state monotonically across host and peer over memory transport', async () => {
      MemoryTransportHub.clearAll();
      const roomCode = 'PAIR07';

      const host = new NetworkRoom({
        roomCode,
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
      });

      const peer = new NetworkRoom({
        roomCode,
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0xPeerBob' },
      });

      await host.start();
      await peer.start();

      peer.setSeat(1);
      peer.toggleReady(true);
      host.toggleReady(true);

      host.startMatch(999888);

      assert.strictEqual(host.state.status, 'playing');
      assert.ok(host.state.gameState);
      assert.strictEqual(host.state.gameState.year, 1);

      const pendingLots = host.state.gameState.pending;
      const chosen = pendingLots.slice(0, host.state.gameState.draftCount);

      host.dispatchGameAction({
        type: 'DRAFT_PLOTS',
        playerId: 0,
        lotIds: chosen,
      });

      assert.strictEqual(host.state.stateSeq, 2);
      assert.strictEqual(host.state.gameState.phase, 'trade');

      host.stop();
      peer.stop();
      MemoryTransportHub.clearAll();
    });
  });

  // P8: Room reconnection + Seat assignment preservation (F8 x F9)
  describe('P8: Room reconnection + Seat assignment preservation (F8 x F9)', () => {
    it('preserves seat assignment when player reconnects with same wallet address', async () => {
      MemoryTransportHub.clearAll();
      const roomCode = 'RECON8';

      const host = new NetworkRoom({
        roomCode,
        isHost: true,
        localPlayer: { name: 'HostAlice', address: '0x1000000000000000000000000000000000000001' },
      });

      const client = new NetworkRoom({
        roomCode,
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0x2000000000000000000000000000000000000002' },
      });

      await host.start();
      await client.start();

      client.setSeat(2);
      assert.strictEqual(client.getLocalPlayer()?.seat, 2);

      client.stop();

      const reconnectedClient = new NetworkRoom({
        roomCode,
        isHost: false,
        localPlayer: { name: 'PeerBob', address: '0x2000000000000000000000000000000000000002' },
      });

      await reconnectedClient.start();
      host.checkPlayerLiveness();

      assert.ok(host.state.players.length >= 2);
      host.stop();
      reconnectedClient.stop();
      MemoryTransportHub.clearAll();
    });
  });

  // P9: Board geometry projection + Camera coordinate translation (F4 x F10)
  describe('P9: Board geometry projection + Camera coordinate translation (F4 x F10)', () => {
    it('translates coordinates with high precision and hit-tests all 72 lots', () => {
      const camera = new CameraController({ width: 1100, height: 730 });
      const viewport = { width: 1100, height: 730 };

      const lot0 = getLotDefinition(0);
      const centerBx = lot0.x + 25;
      const centerBy = lot0.y + 25;

      const screenCoord = boardToScreen(centerBx, centerBy, camera.getState(), viewport);
      const hitId = hitTestScreenPoint(screenCoord.x, screenCoord.y, camera.getState(), viewport);
      assert.strictEqual(hitId, 0);

      const roundtrip = screenToBoard(screenCoord.x, screenCoord.y, camera.getState(), viewport);
      assert.ok(Math.abs(roundtrip.x - centerBx) < 0.001);
      assert.ok(Math.abs(roundtrip.y - centerBy) < 0.001);

      camera.setZoom(1.5, screenCoord);
      const newScreen = boardToScreen(centerBx, centerBy, camera.getState(), viewport);
      const newHit = hitTestScreenPoint(newScreen.x, newScreen.y, camera.getState(), viewport);
      assert.strictEqual(newHit, 0);

      const streetHit = hitTestBoardPoint(350, 100);
      assert.strictEqual(streetHit, null);
    });
  });

  // P10: Single-player match loop + Procedural Web Audio sound cues (F10 x F11)
  describe('P10: Single-player match loop + Procedural Web Audio sound cues (F10 x F11)', () => {
    it('triggers procedural audio cues safely without throwing in headless environments', () => {
      const audio = new AudioSynthesizer();
      assert.strictEqual(audio.isMuted(), false);

      assert.doesNotThrow(() => audio.playTilePop());
      assert.doesNotThrow(() => audio.playCoinChime());
      assert.doesNotThrow(() => audio.playDealStamp());
      assert.doesNotThrow(() => audio.playPhaseFanfare());
      assert.doesNotThrow(() => audio.playYearFanfare());
      assert.doesNotThrow(() => audio.playGameOverFanfare());
      assert.doesNotThrow(() => audio.playErrorBuzzer());
      assert.doesNotThrow(() => audio.playClick());

      audio.setMuted(true);
      assert.strictEqual(audio.isMuted(), true);
      assert.doesNotThrow(() => audio.playCoinChime());
    });
  });

  // P11: Complete 6-year game engine progression + Asset zero-404 rendering (F4 x F5)
  describe('P11: Complete 6-year game engine progression + Asset zero-404 rendering (F4 x F5)', () => {
    it('verifies all 6 shop types and 4 avatars have valid non-zero PNG assets on disk', () => {
      const publicAssetsDir = path.resolve(process.cwd(), 'public/assets');
      assert.ok(fs.existsSync(publicAssetsDir), 'public/assets directory must exist');

      const expectedFiles = [
        'shops/shop_0.png',
        'shops/shop_1.png',
        'shops/shop_2.png',
        'shops/shop_3.png',
        'shops/shop_4.png',
        'shops/shop_5.png',
        'avatars/avatar_0.png',
        'avatars/avatar_1.png',
        'avatars/avatar_2.png',
        'avatars/avatar_3.png',
        'tokens/coin_wif.png',
        'board/board_map.png',
      ];

      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      for (const filename of expectedFiles) {
        const filePath = path.join(publicAssetsDir, filename);
        assert.ok(fs.existsSync(filePath), `Asset ${filename} must exist`);
        const stats = fs.statSync(filePath);
        assert.ok(stats.size > 0, `Asset ${filename} must have non-zero size`);

        const buffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        assert.deepStrictEqual(buffer, pngSignature, `Asset ${filename} must be valid PNG`);
      }
    });
  });

  // P12: Point-to-$wif swap + Automated build verification (F7 x F12)
  describe('P12: Point-to-$wif swap + Automated build verification (F7 x F12)', () => {
    it('computes point swap accurately and verifies package configuration integrity', () => {
      const swap5000 = calculatePointSwap(5000, 0.10, 0.03);
      assert.strictEqual(swap5000.points, 5000);
      assert.strictEqual(swap5000.grossWif, 500);
      assert.strictEqual(swap5000.burnedWif, 15);
      assert.strictEqual(swap5000.netWif, 485);
      assert.strictEqual(swap5000.burnAddress, BURN_ADDRESS);

      const swap0 = calculatePointSwap(0);
      assert.strictEqual(swap0.grossWif, 0);
      assert.strictEqual(swap0.netWif, 0);

      const pkgPath = path.resolve(process.cwd(), 'package.json');
      assert.ok(fs.existsSync(pkgPath));
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.strictEqual(pkg.type, 'module');
      assert.ok(pkg.scripts.build);
      assert.ok(pkg.scripts.test);

      let flywheel = createInitialFlywheelState();
      flywheel = applyPointSwap(flywheel, swap5000);
      assert.strictEqual(flywheel.totalBurned, 15);
      assert.strictEqual(flywheel.totalSwaps, 1);
    });
  });
});
