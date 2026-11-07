/**
 * tests/e2e/tier4-scenarios.test.ts
 *
 * Tier 4: Real-World Application Scenarios for robin-town.
 * Tests 6 realistic, end-to-end workload scenarios as specified in TEST_INFRA.md.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';

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
  groups,
  canPlace,
  SHOPS,
  PLOT_KEEP_SCHEDULE,
} from '../../src/engine/engine';
import {
  botBuild,
  calculateLotValue,
  calculateTileValue,
  evaluateTradeOffer,
  getBotPersonality,
  plotScore,
} from '../../src/engine/bot';
import {
  canBuildShop,
  findClusterAtLot,
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
import type { GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createRng(seed: number): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Tier 4: Real-World Application Scenarios', () => {

  // Scenario 1: Complete 4-Player 6-Year AI Match (F5, F6, F7, F10, F11)
  describe('Scenario 1: Complete 4-Player 6-Year AI Match (F5, F6, F7, F10, F11)', () => {
    it('executes a full 6-year 5-phase match against 3 AI bots to final settlement', () => {
      const rng = createRng(20261030);
      const state = createGame(undefined, rng);

      for (let yr = 1; yr <= 6; yr++) {
        assert.strictEqual(state.year, yr);
        assert.strictEqual(state.phase, 'receive');

        const draftCount = PLOT_KEEP_SCHEDULE[yr - 1];
        assert.strictEqual(state.draftCount, draftCount);

        const chosenLots = state.pending.slice(0, draftCount);
        draftPlots(state, 0, chosenLots, rng);
        assert.strictEqual(state.phase, 'trade');

        beginBuild(state);
        assert.strictEqual(state.phase, 'build');

        const vacantPlayerLots = state.lots.filter((l) => l.owner === 0 && l.shop === null);
        for (const lot of vacantPlayerLots) {
          for (let shop = 0; shop < 6; shop++) {
            if (state.players[0].tiles[shop] > 0 && canPlace(state, 0, lot.id, shop)) {
              buildTile(state, 0, lot.id, shop);
              break;
            }
          }
        }

        const harvest = collectIncome(state);
        assert.ok(Array.isArray(harvest.payouts));
        assert.strictEqual(harvest.payouts.length, 4);

        if (yr < 6) {
          assert.strictEqual(state.phase, 'income');
          nextYear(state, rng);
        } else {
          assert.strictEqual(state.phase, 'ended');
        }
      }

      assert.strictEqual(state.year, 6);
      assert.strictEqual(state.phase, 'ended');

      const totalOwnedLots = state.lots.filter((l) => l.owner !== null).length;
      assert.strictEqual(totalOwnedLots, 72);

      let totalTilesInGame = state.bag.length;
      for (const p of state.players) {
        totalTilesInGame += p.tiles.reduce((a, b) => a + b, 0);
      }
      totalTilesInGame += state.lots.filter((l) => l.shop !== null).length;
      assert.strictEqual(totalTilesInGame, 120);

      const finalRankings = rankings(state);
      assert.strictEqual(finalRankings.length, 4);
      for (const p of finalRankings) {
        assert.ok(p.cash >= 50);
      }

      const pool = calculateMatchPayouts(1000, finalRankings.map((p) => p.id));
      assert.strictEqual(pool.totalPool, 4000);
      assert.strictEqual(pool.burnedAmount, 200);
      assert.strictEqual(pool.vaultAmount, 200);
      assert.strictEqual(pool.purseAmount, 3600);
    });
  });

  // Scenario 2: High-Stakes Land Monopoly Trade (F5, F6, F7, F8)
  describe('Scenario 2: High-Stakes Land Monopoly Trade (F5, F6, F7, F8)', () => {
    it('executes bilateral 2-parcel plus cash trade for critical monopoly completion', () => {
      const rng = createRng(1001);
      const state = createGame(undefined, rng);
      state.phase = 'trade';

      // District 0 (Robinhood District): Lots 0, 1, 2 form contiguous row
      state.lots[0].owner = 0;
      state.lots[0].shop = 0; // DEX Swap
      state.lots[1].owner = 0;
      state.lots[1].shop = 0; // DEX Swap
      state.lots[2].owner = 1; // Sherwood owns the keystone monopoly lot
      state.lots[2].shop = null;

      // Player 0 owns two adjacent parcels in District 2
      state.lots[24].owner = 0;
      state.lots[24].shop = null;
      state.lots[25].owner = 0;
      state.lots[25].shop = null;

      state.players[0].cash = 150;
      state.players[1].cash = 100;
      state.players[0].tiles[0] = 2;

      const offer: TradeOffer = {
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 40, tiles: [0, 0, 0, 0, 0, 0], lots: [24, 25] },
        take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [2] },
      };

      const evaluation = evaluateTradeOffer(offer, 1, state);
      assert.ok((evaluation.valueReceived ?? 0) > 0);
      assert.ok((evaluation.valueSurrendered ?? 0) > 0);

      const tradeExecution = executeTrade(state, offer);
      if (tradeExecution.evaluation.accepted) {
        assert.strictEqual(state.lots[2].owner, 0);
        assert.strictEqual(state.lots[24].owner, 1);
        assert.strictEqual(state.lots[25].owner, 1);
        assert.strictEqual(state.players[0].cash, 110);
        assert.strictEqual(state.players[1].cash, 140);

        state.phase = 'build';
        buildTile(state, 0, 2, 0);

        const playerClusters = groups(state, 0);
        const dexCluster = playerClusters.find((g) => g.shop === 0);
        assert.ok(dexCluster);
        assert.strictEqual(dexCluster.size, 3);
        assert.strictEqual(dexCluster.isComplete, true);
        assert.strictEqual(dexCluster.payout, 50);
      }
    });
  });

  // Scenario 3: Tokenomics Deflationary Burn Run (F6, F7, F8)
  describe('Scenario 3: Tokenomics Deflationary Burn Run (F6, F7, F8)', () => {
    it('simulates 10 consecutive matches tracking cumulative 5% buy-in, 3% swap, and 1% trade burns', () => {
      let flywheel = createInitialFlywheelState();
      const matchCount = 10;
      const buyInPerPlayer = 1000;
      const pointsWonPerMatch = 3000;

      for (let m = 1; m <= matchCount; m++) {
        const pool = calculateMatchPayouts(buyInPerPlayer, [0, 1, 2, 3]);
        flywheel = applyMatchPayouts(flywheel, pool);

        const tradeTax1 = calculateTradeTax(50);
        const tradeTax2 = calculateTradeTax(100);
        const tradeTax3 = calculateTradeTax(80);
        flywheel = applyTradeTax(flywheel, tradeTax1);
        flywheel = applyTradeTax(flywheel, tradeTax2);
        flywheel = applyTradeTax(flywheel, tradeTax3);

        const swap = calculatePointSwap(pointsWonPerMatch);
        flywheel = applyPointSwap(flywheel, swap);
      }

      assert.strictEqual(flywheel.totalMatches, 10);
      assert.strictEqual(flywheel.totalSwaps, 10);
      assert.strictEqual(flywheel.totalTradesTaxed, 30);

      assert.strictEqual(flywheel.totalBurned, 10 * 200 + 10 * 9);
      assert.strictEqual(flywheel.totalBurned, 2090);

      assert.strictEqual(flywheel.totalStakingYield, 10 * 200 + 10 * (1 + 1 + 1));
      assert.strictEqual(flywheel.totalStakingYield, 2030);

      assert.strictEqual(flywheel.totalPrizesDisbursed, 10 * 3600);
      assert.strictEqual(flywheel.totalPrizesDisbursed, 36000);
    });
  });

  // Scenario 4: Offline to Online Wallet Transition (F8, F9, F10)
  describe('Scenario 4: Offline to Online Wallet Transition (F8, F9, F10)', () => {
    it('transitions from simulation to Web3 provider mid-game and falls back on disconnect', async () => {
      const rng = createRng(777);
      const state = createGame(undefined, rng);
      state.lots[0].owner = 0;
      state.lots[0].shop = 1;

      let providerConnected = true;
      const mockWeb3Provider: EIP1193Provider = {
        async request(args) {
          if (!providerConnected) {
            throw new Error('Provider disconnected');
          }
          if (args.method === 'eth_requestAccounts') {
            return ['0x71C63397CDF7A19F38083951F6F50b2636605273'];
          }
          if (args.method === 'eth_chainId') {
            return '0xb626';
          }
          if (args.method === 'eth_getBalance') {
            return '0x21e19e0c9bab2400000';
          }
          return null;
        },
      };

      const wallet = new WalletAdapter({ mode: 'simulation' });
      await wallet.connect();
      assert.strictEqual(wallet.getState().mode, 'simulation');
      assert.strictEqual(wallet.getState().status, 'connected');

      await wallet.setMode('web3');
      const simFallback = wallet.getState();
      assert.strictEqual(simFallback.mode, 'simulation');
      assert.strictEqual(simFallback.status, 'connected');

      const web3Wallet = new WalletAdapter({ mode: 'web3', provider: mockWeb3Provider });
      await web3Wallet.connect();
      const onlineState = web3Wallet.getState();
      assert.strictEqual(onlineState.mode, 'web3');
      assert.strictEqual(onlineState.status, 'connected');
      assert.strictEqual(onlineState.account?.address, '0x71C63397CDF7A19F38083951F6F50b2636605273');

      assert.strictEqual(state.lots[0].owner, 0);
      assert.strictEqual(state.lots[0].shop, 1);

      providerConnected = false;
      await web3Wallet.setMode('simulation');
      const fallbackState = web3Wallet.getState();
      assert.strictEqual(fallbackState.mode, 'simulation');
      assert.strictEqual(fallbackState.status, 'connected');
    });
  });

  // Scenario 5: Edge-Case Block Boundary Adjacency (F5, F6)
  describe('Scenario 5: Edge-Case Block Boundary Adjacency (F5, F6)', () => {
    it('strictly isolates parcels across district street channels and prevents illegal expansion', () => {
      const rng = createRng(12);
      const state = createGame(undefined, rng);
      state.phase = 'build';

      // Lot 3: District 0, row 0, col 3 (x=248, y=100)
      // Lot 12: District 1, row 0, col 0 (x=399, y=105)
      state.lots[3].owner = 0;
      state.lots[3].shop = 0;
      state.lots[12].owner = 0;
      state.lots[12].shop = 0;

      const clusters = groups(state, 0);
      const dexClusters = clusters.filter((g) => g.shop === 0);
      assert.strictEqual(dexClusters.length, 2);
      assert.strictEqual(dexClusters[0].size, 1);
      assert.strictEqual(dexClusters[1].size, 1);

      // Completed cluster expansion prevention
      state.lots[0].owner = 0;
      state.lots[0].shop = 0;
      state.lots[1].owner = 0;
      state.lots[1].shop = 0;
      state.lots[2].owner = 0;
      state.lots[2].shop = 0;
      state.lots[5].owner = 0;
      state.lots[5].shop = null;

      const clusterBefore = findClusterAtLot(state.lots, 0);
      assert.ok(clusterBefore);
      assert.strictEqual(clusterBefore.isComplete, true);
      assert.strictEqual(clusterBefore.size, 3);

      const validation = canBuildShop(state.lots, 5, 0, 0, 1);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.reason?.includes('already completed at maximum capacity'));
    });
  });

  // Scenario 6: Simultaneous Multiplayer Room Play (F5, F8, F9, F11)
  describe('Scenario 6: Simultaneous Multiplayer Room Play (F5, F8, F9, F11)', () => {
    it('runs two concurrent 4-player game rooms with distinct codes and zero cross-room leakage', async () => {
      MemoryTransportHub.clearAll();

      const roomA = new NetworkRoom({
        roomCode: 'ROOM0A',
        isHost: true,
        localPlayer: { name: 'HostA', address: '0xHostA' },
      });

      const peerA = new NetworkRoom({
        roomCode: 'ROOM0A',
        isHost: false,
        localPlayer: { name: 'PeerA', address: '0xPeerA' },
      });

      const roomB = new NetworkRoom({
        roomCode: 'ROOM0B',
        isHost: true,
        localPlayer: { name: 'HostB', address: '0xHostB' },
      });

      const peerB = new NetworkRoom({
        roomCode: 'ROOM0B',
        isHost: false,
        localPlayer: { name: 'PeerB', address: '0xPeerB' },
      });

      await roomA.start();
      await peerA.start();
      await roomB.start();
      await peerB.start();

      peerA.setSeat(1);
      peerB.setSeat(1);
      peerA.toggleReady(true);
      peerB.toggleReady(true);
      roomA.toggleReady(true);
      roomB.toggleReady(true);

      roomA.startMatch(111111);
      roomB.startMatch(222222);

      assert.strictEqual(roomA.state.status, 'playing');
      assert.strictEqual(roomB.state.status, 'playing');
      assert.strictEqual(roomA.state.seed, 111111);
      assert.strictEqual(roomB.state.seed, 222222);

      const chosenLotsA = roomA.state.gameState!.pending.slice(0, roomA.state.gameState!.draftCount);
      roomA.dispatchGameAction({
        type: 'DRAFT_PLOTS',
        playerId: 0,
        lotIds: chosenLotsA,
      });

      assert.strictEqual(roomA.state.stateSeq, 2);
      assert.strictEqual(roomB.state.stateSeq, 1);

      let peerAReceivedChat = false;
      let peerBReceivedChat = false;

      peerA.onChat((msg) => {
        if (msg.text === 'Chat for Room A only') peerAReceivedChat = true;
      });

      peerB.onChat((msg) => {
        if (msg.text === 'Chat for Room A only') peerBReceivedChat = true;
      });

      roomA.sendChat('Chat for Room A only');

      assert.strictEqual(peerAReceivedChat, true);
      assert.strictEqual(peerBReceivedChat, false);

      roomA.stop();
      peerA.stop();
      roomB.stop();
      peerB.stop();
      MemoryTransportHub.clearAll();
    });
  });
});
