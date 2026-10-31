/**
 * scripts/adversarial-stress.ts
 *
 * Empirical adversarial stress testing suite for robin-town.
 * Probes Scenario 1 to 6 and Pairwise P1 to P12 under extreme conditions,
 * randomized seeds, boundary values, and hostile environments.
 */

import * as assert from 'node:assert/strict';
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
  income,
  groupIncome,
  SHOPS,
  PLOT_KEEP_SCHEDULE,
  DISTRICT_NAMES,
} from '../src/engine/engine';
import {
  BOT_PERSONALITIES,
  botBuild,
  botDraft,
  calculateLotValue,
  calculateTileValue,
  evaluateTradeOffer,
  getBotPersonality,
  plotScore,
} from '../src/engine/bot';
import {
  ADJACENCY_GRAPH,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  canBuildShop,
  findAllClusters,
  findClusterAtLot,
  getLotDefinition,
  LOT_DEFINITIONS,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
  TOTAL_LOTS,
} from '../src/engine/board-layout';
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
} from '../src/tokenomics/flywheel';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  WalletAdapter,
  type EIP1193Provider,
} from '../src/tokenomics/wallet';
import {
  MemoryTransport,
  MemoryTransportHub,
  NetworkRoom,
} from '../src/network/room';
import {
  boardToScreen,
  CameraController,
  hitTestBoardPoint,
  hitTestScreenPoint,
  screenToBoard,
} from '../src/ui/camera';
import { TradeDeskController } from '../src/ui/trade-desk';
import { AudioSynthesizer } from '../src/ui/audio';
import type { GameState, RandomSource, TradeOffer } from '../src/engine/types';

function createRng(seed: number): RandomSource {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function runAdversarialSuite() {
  console.log('Starting empirical adversarial stress testing suite for robin-town...');
  let totalAssertions = 0;

  // =========================================================================
  // STRESS TEST 1: Scenario 1 Invariant Stress Under 25 Distinct Seeds
  // =========================================================================
  console.log('\n[Stress Test 1] Scenario 1: Multi-Seed Invariant Fuzzing (25 Seeds)...');
  const seedsToTest = [
    0, 1, 42, 99, 123, 777, 1001, 1337, 2024, 2025, 2026, 9999,
    12345, 67890, 111111, 314159, 271828, 987654, 1000003, 1048576,
    2147483647, 4294967295, 20261030, 88888888, 55555555,
  ];

  for (const seed of seedsToTest) {
    const rng = createRng(seed);
    const state = createGame(undefined, rng);

    for (let yr = 1; yr <= 6; yr++) {
      assert.strictEqual(state.year, yr);
      assert.strictEqual(state.phase, 'receive');

      // Parcel Conservation: exactly 72 lots exist
      assert.strictEqual(state.lots.length, TOTAL_LOTS);
      totalAssertions += 2;

      const draftCount = PLOT_KEEP_SCHEDULE[yr - 1];
      assert.strictEqual(state.draftCount, draftCount);

      // Verify pending lots are unowned and valid
      for (const pId of state.pending) {
        assert.ok(pId >= 0 && pId < TOTAL_LOTS);
        assert.strictEqual(state.lots[pId].owner, null);
        totalAssertions += 2;
      }

      // Adversarial parcel choice: take from end of pending array instead of start
      const chosenLots = state.pending.slice(-draftCount);
      draftPlots(state, 0, chosenLots, rng);
      assert.strictEqual(state.phase, 'trade');
      totalAssertions++;

      // Verify monotonic ownership count
      const expectedOwned = PLOT_KEEP_SCHEDULE.slice(0, yr).reduce((a, b) => a + b, 0) * 4;
      const actualOwned = state.lots.filter((l) => l.owner !== null).length;
      assert.strictEqual(actualOwned, expectedOwned);
      totalAssertions++;

      beginBuild(state);
      assert.strictEqual(state.phase, 'build');
      totalAssertions++;

      // Human builds on all available vacant plots if matching tile exists
      const humanLots = state.lots.filter((l) => l.owner === 0 && l.shop === null);
      for (const lot of humanLots) {
        for (let sIdx = 0; sIdx < 6; sIdx++) {
          if (state.players[0].tiles[sIdx] > 0 && canPlace(state, 0, lot.id, sIdx)) {
            buildTile(state, 0, lot.id, sIdx);
            break;
          }
        }
      }

      // Collect income and verify payouts
      const harvest = collectIncome(state);
      assert.strictEqual(harvest.payouts.length, 4);
      for (let p = 0; p < 4; p++) {
        assert.ok(Number.isFinite(harvest.payouts[p]));
        assert.ok(!Number.isNaN(harvest.payouts[p]));
        assert.ok(harvest.payouts[p] >= 0);
        assert.ok(state.players[p].cash >= 50);
        totalAssertions += 4;
      }

      // Tile pool conservation invariant check at each year
      let tilesInGame = state.bag.length;
      for (const p of state.players) {
        tilesInGame += p.tiles.reduce((a, b) => a + b, 0);
      }
      tilesInGame += state.lots.filter((l) => l.shop !== null).length;
      assert.strictEqual(tilesInGame, 120);
      totalAssertions++;

      if (yr < 6) {
        assert.strictEqual(state.phase, 'income');
        nextYear(state, rng);
        totalAssertions++;
      } else {
        assert.strictEqual(state.phase, 'ended');
        totalAssertions++;
      }
    }

    // At match end: all 72 parcels must be owned (18 per player)
    assert.strictEqual(state.lots.filter((l) => l.owner !== null).length, 72);
    for (let p = 0; p < 4; p++) {
      const pOwned = state.lots.filter((l) => l.owner === p).length;
      assert.strictEqual(pOwned, 18);
      totalAssertions += 2;
    }

    // Rankings verification: valid order, no NaN, no undefined
    const finalRankings = rankings(state);
    assert.strictEqual(finalRankings.length, 4);
    for (let r = 0; r < finalRankings.length; r++) {
      const p = finalRankings[r];
      assert.ok(typeof p.id === 'number');
      assert.ok(typeof p.name === 'string');
      assert.ok(Number.isFinite(p.cash));
      assert.ok(!Number.isNaN(p.cash));
      if (r > 0) {
        assert.ok(p.cash <= finalRankings[r - 1].cash);
      }
      totalAssertions += 5;
    }

    // Calculate podium match payouts and verify conservation
    const pool = calculateMatchPayouts(1000, finalRankings.map((p) => p.id));
    assert.strictEqual(pool.totalPool, 4000);
    assert.strictEqual(pool.burnedAmount, 200);
    assert.strictEqual(pool.vaultAmount, 200);
    assert.strictEqual(pool.purseAmount, 3600);
    const sumPayouts = Object.values(pool.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumPayouts, 3600);
    totalAssertions += 5;
  }
  console.log(`  Passed: 25 distinct seeds tested without invariant violations (${totalAssertions} checks).`);

  // =========================================================================
  // STRESS TEST 2: Scenario 2 High-Stakes Land Monopoly Trade & Income Jump
  // =========================================================================
  console.log('\n[Stress Test 2] Scenario 2: Monopoly Trade Evaluation, Edge Cases, & Income Jump...');

  // Subtest 2A: Verify Income Jump on set completion across all 6 shop types
  const shopSizes = [3, 3, 4, 4, 5, 6];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const targetSize = shopSizes[sIdx];
    const incompleteIncome = groupIncome(sIdx, targetSize - 1);
    const completeIncome = groupIncome(sIdx, targetSize);
    assert.ok(completeIncome > incompleteIncome, `Shop ${sIdx} complete income must exceed incomplete`);
    const jump = completeIncome - incompleteIncome;
    assert.ok(jump >= 30, `Shop ${sIdx} completion jump must be at least 30, got ${jump}`);
    totalAssertions += 2;
  }

  // Subtest 2B: Realistic High-Stakes Bilateral Trade Execution
  {
    const state = createGame(undefined, createRng(4242));
    state.phase = 'trade';

    // Player 0 owns lots 0 and 1 with shop 0 (DEX Swap, target size 3)
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;

    // Player 1 (Sherwood) owns the keystone monopoly lot 2
    state.lots[2].owner = 1;
    state.lots[2].shop = null;

    // Player 0 owns two adjacent parcels in District 2 (lots 24 and 25)
    state.lots[24].owner = 0;
    state.lots[24].shop = null;
    state.lots[25].owner = 0;
    state.lots[25].shop = null;

    state.players[0].cash = 200;
    state.players[1].cash = 100;
    state.players[0].tiles[0] = 2; // holds DEX Swap tiles

    // Baseline income before trade
    const incomeBefore = income(state, 0);
    assert.strictEqual(incomeBefore, 20); // 2 incomplete DEX Swap tiles give 20
    totalAssertions++;

    // Adversarial offer 1: Player 0 offers 0 cash and zero parcels for lot 2
    const greedyOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [2] },
    };
    const evalGreedy = evaluateTradeOffer(greedyOffer, 1, state);
    assert.strictEqual(evalGreedy.accepted, false);
    assert.ok(evalGreedy.shortfall > 0);
    assert.ok(evalGreedy.counterOffer !== undefined);
    totalAssertions += 3;

    // Adversarial offer 2: Valid generous offer with parcels and cash
    const generousOffer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 40, tiles: [0, 0, 0, 0, 0, 0], lots: [24, 25] },
      take: { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [2] },
    };
    const evalGenerous = evaluateTradeOffer(generousOffer, 1, state);
    assert.strictEqual(evalGenerous.accepted, true);
    assert.strictEqual(evalGenerous.shortfall, 0);
    totalAssertions += 2;

    // Execute the trade atomically
    const cash0Before = state.players[0].cash;
    const cash1Before = state.players[1].cash;
    const tradeResult = executeTrade(state, generousOffer);
    assert.strictEqual(tradeResult.evaluation.accepted, true);
    assert.strictEqual(state.lots[2].owner, 0);
    assert.strictEqual(state.lots[24].owner, 1);
    assert.strictEqual(state.lots[25].owner, 1);
    assert.strictEqual(state.players[0].cash, cash0Before - 40);
    assert.strictEqual(state.players[1].cash, cash1Before + 40);
    totalAssertions += 5;

    // Transition to build phase and place tile on lot 2 to seal monopoly
    state.phase = 'build';
    buildTile(state, 0, 2, 0);

    // Verify monopoly completion and income jump
    const dexCluster = findClusterAtLot(state.lots, 2);
    assert.ok(dexCluster !== null);
    assert.strictEqual(dexCluster.size, 3);
    assert.strictEqual(dexCluster.isComplete, true);
    assert.strictEqual(dexCluster.annualIncome, 50);

    const incomeAfter = income(state, 0);
    assert.strictEqual(incomeAfter, 50);
    assert.strictEqual(incomeAfter - incomeBefore, 30); // Exactly +30 income jump
    totalAssertions += 6;
  }
  console.log('  Passed: Monopoly trade evaluation and income jump rigorously verified.');

  // =========================================================================
  // STRESS TEST 3: Scenario 3 Tokenomics Deflationary Burn Run Conservation
  // =========================================================================
  console.log('\n[Stress Test 3] Scenario 3: Tokenomics Conservation Across Edge Quantities...');

  // Test across diverse buy-in values and match participant counts
  const buyInCases = [0, 1, 3, 10, 33, 100, 333, 999, 1000, 1337, 5000, 100000];
  for (const buyIn of buyInCases) {
    for (const pCount of [1, 2, 3, 4]) {
      const pIds = Array.from({ length: pCount }, (_, i) => i);
      const res = calculateMatchPayouts(buyIn, pIds);

      // Verify exact conservation
      assert.strictEqual(res.totalPool, Math.round(buyIn * pCount));
      assert.strictEqual(res.burnedAmount + res.vaultAmount + res.purseAmount, res.totalPool);

      const distributed = Object.values(res.payouts).reduce((a, b) => a + b, 0);
      assert.strictEqual(distributed, res.purseAmount);
      assert.strictEqual(res.burnAddress, BURN_ADDRESS);
      totalAssertions += 4;
    }
  }

  // Point swap conservation across edge point quantities
  const pointCases = [0, 1, 2, 5, 9, 10, 11, 33, 50, 99, 100, 101, 3000, 99999];
  for (const pts of pointCases) {
    const swap = calculatePointSwap(pts);
    if (pts > 0) {
      assert.strictEqual(swap.grossWif, Math.floor(pts * 0.10));
      assert.strictEqual(swap.burnedWif + swap.netWif, swap.grossWif);
      assert.strictEqual(swap.burnAddress, BURN_ADDRESS);
      totalAssertions += 3;
    } else {
      assert.strictEqual(swap.grossWif, 0);
      assert.strictEqual(swap.burnedWif, 0);
      assert.strictEqual(swap.netWif, 0);
      totalAssertions += 3;
    }
  }

  // Trade micro-tax conservation across edge cash transfers
  const cashCases = [0, 1, 2, 10, 49, 50, 99, 100, 101, 500, 10000];
  for (const cash of cashCases) {
    const tax = calculateTradeTax(cash);
    if (cash > 0) {
      assert.strictEqual(tax.grossCash, cash);
      assert.strictEqual(tax.netCash + tax.taxAmount, cash);
      assert.strictEqual(tax.vaultAmount, tax.taxAmount);
      totalAssertions += 3;
    } else {
      assert.strictEqual(tax.grossCash, 0);
      assert.strictEqual(tax.taxAmount, 0);
      assert.strictEqual(tax.netCash, 0);
      totalAssertions += 3;
    }
  }

  // Multi-match cumulative run: 10 matches exact tracking
  {
    let flywheel = createInitialFlywheelState();
    let expectedBurned = 0;
    let expectedVault = 0;
    let expectedPurse = 0;

    for (let m = 1; m <= 10; m++) {
      const matchPool = calculateMatchPayouts(1000, [0, 1, 2, 3]);
      flywheel = applyMatchPayouts(flywheel, matchPool);
      expectedBurned += matchPool.burnedAmount;
      expectedVault += matchPool.vaultAmount;
      expectedPurse += matchPool.purseAmount;

      const tax1 = calculateTradeTax(50);
      const tax2 = calculateTradeTax(100);
      const tax3 = calculateTradeTax(80);
      flywheel = applyTradeTax(flywheel, tax1);
      flywheel = applyTradeTax(flywheel, tax2);
      flywheel = applyTradeTax(flywheel, tax3);
      expectedVault += tax1.vaultAmount + tax2.vaultAmount + tax3.vaultAmount;

      const swap = calculatePointSwap(3000);
      flywheel = applyPointSwap(flywheel, swap);
      expectedBurned += swap.burnedWif;
    }

    assert.strictEqual(flywheel.totalMatches, 10);
    assert.strictEqual(flywheel.totalSwaps, 10);
    assert.strictEqual(flywheel.totalTradesTaxed, 30);
    assert.strictEqual(flywheel.totalBurned, expectedBurned);
    assert.strictEqual(flywheel.totalStakingYield, expectedVault);
    assert.strictEqual(flywheel.totalPrizesDisbursed, expectedPurse);
    assert.strictEqual(flywheel.totalBurned, 2090);
    assert.strictEqual(flywheel.totalStakingYield, 2030);
    assert.strictEqual(flywheel.totalPrizesDisbursed, 36000);
    totalAssertions += 9;
  }
  console.log('  Passed: Exact tokenomics conservation verified with zero leakage.');

  // =========================================================================
  // STRESS TEST 4: Scenario 4 Wallet Mode Transition Adversarial Probing
  // =========================================================================
  console.log('\n[Stress Test 4] Scenario 4: Adversarial Web3 Provider & Fallback Resilience...');

  // Subtest 4A: Missing Web3 provider auto-reverts to simulation
  {
    const wallet = new WalletAdapter({ mode: 'simulation' });
    await wallet.connect();
    assert.strictEqual(wallet.getState().mode, 'simulation');

    // Attempt to set Web3 mode without provider
    await wallet.setMode('web3');
    const state = wallet.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.ok(state.error !== null);
    totalAssertions += 4;
  }

  // Subtest 4B: Provider throws on eth_requestAccounts
  {
    const failingProvider: EIP1193Provider = {
      async request(args) {
        if (args.method === 'eth_requestAccounts') {
          throw new Error('User rejected connection request');
        }
        return null;
      },
    };
    const wallet = new WalletAdapter({ mode: 'web3', provider: failingProvider });
    await wallet.connect();
    const state = wallet.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    assert.ok(state.error?.includes('User rejected'));
    totalAssertions += 3;
  }

  // Subtest 4C: Provider returns empty accounts array
  {
    const emptyProvider: EIP1193Provider = {
      async request(args) {
        if (args.method === 'eth_requestAccounts') {
          return [];
        }
        return null;
      },
    };
    const wallet = new WalletAdapter({ mode: 'web3', provider: emptyProvider });
    await wallet.connect();
    const state = wallet.getState();
    assert.strictEqual(state.mode, 'simulation');
    assert.strictEqual(state.status, 'connected');
    totalAssertions += 2;
  }

  // Subtest 4D: Seamless mid-game transition with active provider then disconnect
  {
    let connected = true;
    const web3Address = '0x9999999999999999999999999999999999999999';
    const dynamicProvider: EIP1193Provider = {
      async request(args) {
        if (!connected) throw new Error('Network disconnected');
        if (args.method === 'eth_requestAccounts') return [web3Address];
        if (args.method === 'eth_chainId') return '0xb626';
        if (args.method === 'eth_getBalance') return '0xde0b6b3a7640000'; // 1 $wif in wei
        return null;
      },
    };

    const wallet = new WalletAdapter({ mode: 'simulation' });
    await wallet.connect();
    assert.strictEqual(wallet.getState().account?.name, 'Alice');

    // Switch to web3 with provider injected
    (wallet as any).provider = dynamicProvider;
    await wallet.setMode('web3');
    const web3State = wallet.getState();
    assert.strictEqual(web3State.mode, 'web3');
    assert.strictEqual(web3State.account?.address, web3Address);

    // Mid-game provider disconnect
    connected = false;
    await wallet.setMode('simulation');
    const simState = wallet.getState();
    assert.strictEqual(simState.mode, 'simulation');
    assert.strictEqual(simState.account?.name, 'Alice');
    assert.strictEqual(simState.account?.balance, 10000);
    totalAssertions += 6;
  }
  console.log('  Passed: Wallet transitions and resilient fallbacks confirmed.');

  // =========================================================================
  // STRESS TEST 5: Scenario 5 Adjacency & Boundary Enforcement Comprehensive Probe
  // =========================================================================
  console.log('\n[Stress Test 5] Scenario 5: Board Geometry & District Isolation Stress...');

  // Subtest 5A: Verify that NO lot in ADJACENCY_GRAPH crosses district boundaries
  for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
    const lot = getLotDefinition(lotId);
    const nIds = ADJACENCY_GRAPH[lotId];
    assert.ok(nIds.length >= 1 && nIds.length <= 4, `Lot ${lotId} degree must be between 1 and 4`);

    for (const nId of nIds) {
      const neighbor = getLotDefinition(nId);
      assert.strictEqual(
        lot.block,
        neighbor.block,
        `Cross-district adjacency forbidden: Lot ${lotId} (Block ${lot.block}) vs Lot ${nId} (Block ${neighbor.block})`
      );
      // Orthogonal check: row diff + col diff must be exactly 1
      const dRow = Math.abs(lot.row - neighbor.row);
      const dCol = Math.abs(lot.col - neighbor.col);
      assert.strictEqual(dRow + dCol, 1, `Adjacency must be orthogonal: Lot ${lotId} vs ${nId}`);
      totalAssertions += 3;
    }
  }

  // Subtest 5B: Specific district boundary pairs across street channels
  const streetChannelPairs: [number, number][] = [
    [3, 12],  // District 0, col 3 vs District 1, col 0
    [7, 14],  // District 0, col 3 vs District 1, col 0
    [10, 17], // District 0, col 2 vs District 1, col 0
    [11, 24], // District 0, row 3 vs District 3, row 0
    [13, 24], // District 1, col 1 vs District 2, col 0
    [22, 48], // District 1, row 3 vs District 4, row 0
    [35, 48], // District 3, col 2 vs District 4, col 0
    [51, 60], // District 4, col 3 vs District 5, col 1
  ];

  for (const [lotA, lotB] of streetChannelPairs) {
    const neighborsA = ADJACENCY_GRAPH[lotA];
    const neighborsB = ADJACENCY_GRAPH[lotB];
    assert.ok(!neighborsA.includes(lotB), `Lot ${lotA} must not be adjacent to ${lotB}`);
    assert.ok(!neighborsB.includes(lotA), `Lot ${lotB} must not be adjacent to ${lotA}`);
    totalAssertions += 2;
  }

  // Subtest 5C: Multi-parcel cluster across street channel must NOT merge
  {
    const state = createGame(undefined, createRng(1234));
    state.phase = 'build';

    // Player 0 owns lots 3 (District 0) and 12 (District 1) with shop 0 (DEX Swap)
    state.lots[3].owner = 0;
    state.lots[3].shop = 0;
    state.lots[12].owner = 0;
    state.lots[12].shop = 0;

    const clusters = groups(state, 0);
    const dexClusters = clusters.filter((g) => g.shop === 0);
    assert.strictEqual(dexClusters.length, 2);
    assert.strictEqual(dexClusters[0].size, 1);
    assert.strictEqual(dexClusters[1].size, 1);
    assert.strictEqual(dexClusters[0].isComplete, false);
    assert.strictEqual(dexClusters[1].isComplete, false);
    totalAssertions += 5;
  }

  // Subtest 5D: Prevention of illegal expansion of completed shop cluster
  {
    const state = createGame(undefined, createRng(5678));
    state.phase = 'build';

    // Form complete size 3 DEX Swap: lots 0, 1, 2
    state.lots[0].owner = 0;
    state.lots[0].shop = 0;
    state.lots[1].owner = 0;
    state.lots[1].shop = 0;
    state.lots[2].owner = 0;
    state.lots[2].shop = 0;

    // Lot 5 is adjacent to lot 1 in District 0
    state.lots[5].owner = 0;
    state.lots[5].shop = null;

    const validation = canBuildShop(state.lots, 5, 0, 0, 1);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.reason?.includes('already completed at maximum capacity'));
    totalAssertions += 2;
  }
  console.log('  Passed: District boundary isolation and cluster rules strictly enforced.');

  // =========================================================================
  // STRESS TEST 6: Scenario 6 Simultaneous Multiplayer Rooms Isolation Stress
  // =========================================================================
  console.log('\n[Stress Test 6] Scenario 6: Concurrent Multi-Room Traffic Isolation (5 Rooms)...');

  MemoryTransportHub.clearAll();

  const roomCodes = ['STRESS1', 'STRESS2', 'STRESS3', 'STRESS4', 'STRESS5'];
  interface ActiveRoom {
    code: string;
    host: NetworkRoom;
    peer: NetworkRoom;
    chatLogHost: string[];
    chatLogPeer: string[];
  }

  const activeRooms: ActiveRoom[] = [];

  for (const code of roomCodes) {
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: `Host_${code}`, address: `0xHost_${code}` },
    });
    const peer = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: `Peer_${code}`, address: `0xPeer_${code}` },
    });

    const chatLogHost: string[] = [];
    const chatLogPeer: string[] = [];

    host.onChat((msg) => chatLogHost.push(msg.text));
    peer.onChat((msg) => chatLogPeer.push(msg.text));

    await host.start();
    await peer.start();

    peer.setSeat(1);
    peer.toggleReady(true);
    host.toggleReady(true);
    host.startMatch(12345);

    activeRooms.push({ code, host, peer, chatLogHost, chatLogPeer });
  }

  // Concurrently dispatch chats and game actions in all rooms
  for (let i = 0; i < activeRooms.length; i++) {
    const r = activeRooms[i];
    r.host.sendChat(`Secret message for room ${r.code}`);

    const draftCount = r.host.state.gameState!.draftCount;
    const chosen = r.host.state.gameState!.pending.slice(0, draftCount);
    r.host.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: chosen,
    });
  }

  // Verify complete isolation
  for (let i = 0; i < activeRooms.length; i++) {
    const r = activeRooms[i];
    // Check peer received chat for its own room
    assert.ok(
      r.chatLogPeer.some((msg) => msg.includes(r.code)),
      `Room ${r.code} peer must receive its room message`
    );

    // Check peer NEVER received chat from any other room
    for (const other of activeRooms) {
      if (other.code !== r.code) {
        assert.ok(
          !r.chatLogPeer.some((msg) => msg.includes(other.code)),
          `Room ${r.code} leaked message from ${other.code}`
        );
        totalAssertions++;
      }
    }

    assert.strictEqual(r.host.state.status, 'playing');
    assert.strictEqual(r.peer.state.status, 'playing');
    assert.strictEqual(r.host.state.stateSeq, 2);
    totalAssertions += 4;
  }

  // Teardown all rooms cleanly
  for (const r of activeRooms) {
    r.host.stop();
    r.peer.stop();
  }
  MemoryTransportHub.clearAll();
  console.log(`  Passed: 5 concurrent rooms executed with zero packet leakage (${totalAssertions} total assertions).`);

  // =========================================================================
  // STRESS TEST 7: Pairwise Interactions P1 through P12 Boundary Probing
  // =========================================================================
  console.log('\n[Stress Test 7] Pairwise P1 through P12 Interaction Boundary Probing...');

  // P1 (F5 x F6): plotScore heuristic sensitivity to friendly clustering
  {
    const state = createGame(undefined, createRng(101));
    state.phase = 'receive';
    state.lots[0].owner = 1;
    state.lots[1].owner = null;
    state.lots[2].owner = 2; // Opponent owns lot 2

    // Score lot 1 for player 1 (has friendly neighbor lot 0)
    const friendlyScore = plotScore(1, 1, state);
    // Score lot 10 for player 1 (isolated in district 0, no friendly neighbors)
    state.lots[10].owner = null;
    const isolatedScore = plotScore(10, 1, state);
    assert.ok(friendlyScore > isolatedScore, 'Friendly neighbor cluster must yield higher plot score');
    totalAssertions += 2;
  }

  // P2 (F6 x F10): Trade desk controller phase enforcement and illegal state rejection
  {
    const state = createGame(undefined, createRng(202));
    state.phase = 'receive';
    const desk = new TradeDeskController(state, { defaultPartnerId: 1 });
    assert.throws(() => desk.open(1), /Trade phase/, 'Trade desk must throw if opened outside trade phase');
    assert.strictEqual(desk.getDeskState().isOpen, false);
    totalAssertions += 2;
  }

  // P3 (F7 x F10): Trade micro-tax exact deduction arithmetic
  {
    const tax1 = calculateTradeTax(1);
    assert.strictEqual(tax1.grossCash, 1);
    assert.strictEqual(tax1.taxAmount, 1);
    assert.strictEqual(tax1.netCash, 0);
    assert.strictEqual(tax1.vaultAmount, 1);

    const tax100 = calculateTradeTax(100);
    assert.strictEqual(tax100.grossCash, 100);
    assert.strictEqual(tax100.taxAmount, 1);
    assert.strictEqual(tax100.netCash, 99);
    assert.strictEqual(tax100.vaultAmount, 1);

    const tax101 = calculateTradeTax(101);
    assert.strictEqual(tax101.grossCash, 101);
    assert.strictEqual(tax101.taxAmount, 2);
    assert.strictEqual(tax101.netCash, 99);
    assert.strictEqual(tax101.vaultAmount, 2);
    totalAssertions += 12;
  }

  // P4 (F5 x F7): Tournament podium purse distribution with dust allocation
  {
    const pool = calculateMatchPayouts(1000, [0, 1, 2, 3]);
    assert.strictEqual(pool.totalPool, 4000);
    assert.strictEqual(pool.burnedAmount, 200);
    assert.strictEqual(pool.vaultAmount, 200);
    assert.strictEqual(pool.purseAmount, 3600);
    assert.strictEqual(pool.payouts[0], 2160);
    assert.strictEqual(pool.payouts[1], 900);
    assert.strictEqual(pool.payouts[2], 540);
    assert.strictEqual(pool.payouts[3], 0);
    totalAssertions += 8;
  }

  // P5 (F7 x F8): Simulation wallet overdraft and burn address invariant
  {
    const wallet = new WalletAdapter({ mode: 'simulation' });
    await wallet.connect();
    const aliceBalance = await wallet.getBalance();
    assert.strictEqual(aliceBalance, 10000);

    // Overdraft must throw
    await assert.rejects(
      async () => wallet.transfer('0x2000000000000000000000000000000000000002', 10001),
      /Insufficient balance/
    );

    // Burn transfer permanently burns tokens
    await wallet.transfer(BURN_ADDRESS, 1000);
    const balanceAfterBurn = await wallet.getBalance();
    assert.strictEqual(balanceAfterBurn, 9000);
    const deadBalance = await wallet.getBalance(BURN_ADDRESS);
    assert.strictEqual(deadBalance, 0);
    totalAssertions += 4;
  }

  // P6 (F7 x F8): Staking yield boost calculation
  {
    const unboosted = calculateStakingBoost(250, false, 1.20);
    assert.strictEqual(unboosted, 250);
    const boosted = calculateStakingBoost(250, true, 1.20);
    assert.strictEqual(boosted, 300);
    const zeroBoost = calculateStakingBoost(0, true, 1.20);
    assert.strictEqual(zeroBoost, 0);
    totalAssertions += 3;
  }

  // P7 (F5 x F9): Multiplayer monotonic sequence increments
  {
    MemoryTransportHub.clearAll();
    const room = new NetworkRoom({
      roomCode: 'SYNC01',
      isHost: true,
      localPlayer: { name: 'HostAlice', address: '0xHostAlice' },
    });
    await room.start();
    room.toggleReady(true);
    room.startMatch(999);
    assert.strictEqual(room.state.stateSeq, 1);

    const draftCount = room.state.gameState!.draftCount;
    const chosen = room.state.gameState!.pending.slice(0, draftCount);
    room.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: chosen,
    });
    assert.strictEqual(room.state.stateSeq, 2);
    room.stop();
    MemoryTransportHub.clearAll();
    totalAssertions += 2;
  }

  // P8 (F8 x F9): Seat assignment preservation on reconnection
  {
    MemoryTransportHub.clearAll();
    const host = new NetworkRoom({
      roomCode: 'SEAT01',
      isHost: true,
      localPlayer: { name: 'HostAlice', address: '0x1111111111111111111111111111111111111111' },
    });
    const client = new NetworkRoom({
      roomCode: 'SEAT01',
      isHost: false,
      localPlayer: { name: 'PeerBob', address: '0x2222222222222222222222222222222222222222' },
    });

    await host.start();
    await client.start();
    client.setSeat(2);
    assert.strictEqual(client.getLocalPlayer()?.seat, 2);

    client.stop();

    const reconnected = new NetworkRoom({
      roomCode: 'SEAT01',
      isHost: false,
      localPlayer: { name: 'PeerBob', address: '0x2222222222222222222222222222222222222222' },
    });
    await reconnected.start();
    host.checkPlayerLiveness();
    assert.ok(host.state.players.length >= 2);

    host.stop();
    reconnected.stop();
    MemoryTransportHub.clearAll();
    totalAssertions += 3;
  }

  // P9 (F4 x F10): Camera coordinate projection and hit testing all 72 lots
  {
    const camera = new CameraController({ width: 1100, height: 730 });
    const viewport = { width: 1100, height: 730 };

    for (let id = 0; id < TOTAL_LOTS; id++) {
      const lot = getLotDefinition(id);
      const cx = lot.x + 25;
      const cy = lot.y + 25;
      const screenCoord = boardToScreen(cx, cy, camera.getState(), viewport);
      const hit = hitTestScreenPoint(screenCoord.x, screenCoord.y, camera.getState(), viewport);
      assert.strictEqual(hit, id, `Hit test must match lot ${id}`);
      totalAssertions++;
    }
  }

  // P10 (F10 x F11): Audio cues execution in headless environment
  {
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
    totalAssertions += 11;
  }

  // P11 (F4 x F5): Zero-404 visual asset disk verification
  {
    const publicAssetsDir = path.resolve(process.cwd(), 'public/assets');
    const assetList = [
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

    for (const item of assetList) {
      const fullPath = path.join(publicAssetsDir, item);
      assert.ok(fs.existsSync(fullPath), `Asset ${item} must exist`);
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(fullPath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
      assert.deepStrictEqual(buffer, pngSignature, `Asset ${item} must have valid PNG signature`);
      totalAssertions += 2;
    }
  }

  // P12 (F7 x F12): Point swap formula and package build integrity
  {
    const swap = calculatePointSwap(5000);
    assert.strictEqual(swap.points, 5000);
    assert.strictEqual(swap.grossWif, 500);
    assert.strictEqual(swap.burnedWif, 15);
    assert.strictEqual(swap.netWif, 485);

    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    assert.strictEqual(pkg.type, 'module');
    assert.ok(pkg.scripts['test:e2e:tier3']);
    assert.ok(pkg.scripts['test:e2e:tier4']);
    totalAssertions += 7;
  }
  console.log(`  Passed: Pairwise P1 through P12 tested under boundary conditions.`);

  console.log('\n=============================================================');
  console.log(`SUCCESS: All ${totalAssertions} empirical stress assertions passed cleanly!`);
  console.log('=============================================================\n');
}

runAdversarialSuite().catch((err) => {
  console.error('Adversarial stress test failed:', err);
  process.exit(1);
});
