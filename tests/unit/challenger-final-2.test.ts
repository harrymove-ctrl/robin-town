/**
 * tests/unit/challenger-final-2.test.ts
 *
 * Final Empirical Adversarial Stress Test Suite for Robin-Town:
 * 1. Chinatown gameplay invariants: 72 parcels across 6 districts, 6 shop types,
 *    non-linear cluster income curves, drafting schedules, and OTC trade desk.
 * 2. AI bot opponents: Sherwood, Apex, and Luna profiles, plot heuristics,
 *    bilateral evaluation, shortfall counteroffers, and autonomous 6-year tournaments.
 * 3. Robinhood Chain and $wif economic flywheel: exact token conservation of 5% burn
 *    to dead address 0x...dEaD, 5% vault, 90% purse, 3% point swap tax, 1% trade tax,
 *    1.20x staking multiplier, multi-match campaign accumulation, and dual-mode wallet.
 * 4. Boundary edge cases: rapid back-to-back tournaments, extreme point values,
 *    empty balances, illegal shop expansion, and state persistence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADJACENCY_GRAPH,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COMPLETE_PAYOUTS,
  DISTRICT_BLOCKS,
  INCOMPLETE_PAYOUTS,
  LOT_DEFINITIONS,
  LOTS_PER_DISTRICT,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
  TOTAL_DISTRICTS,
  TOTAL_LOTS,
  areOrthogonallyAdjacent,
  calculateClusterIncome,
  calculatePlayerTotalIncome,
  canBuildShop,
  findAllClusters,
  findAllPlayerClusters,
  findClusterAtLot,
  getLotDefinition,
  getLotsInDistrict,
  getNeighbors,
} from '../../src/engine/board-layout';

import {
  DISTRICT_NAMES,
  PLOT_KEEP_SCHEDULE,
  SHOPS,
  TILE_DEAL_SCHEDULE,
  TILE_KEEP_SCHEDULE,
  advancePhase,
  beginBuild,
  buildTile,
  canPlace,
  claimPlots,
  collectIncome,
  createGame,
  draftPlots,
  emptyOffer,
  evaluateOffer,
  executeTrade,
  finishYear,
  groupIncome,
  groups,
  income,
  nextYear,
  rankings,
  startYear,
  validSave,
  validateOffer,
} from '../../src/engine/engine';

import {
  BOT_PERSONALITIES,
  botBuild,
  botDraft,
  calculateLotValue,
  calculateTileValue,
  evaluateOfferSide,
  evaluateTradeOffer,
  generateBotTradeOffer,
  getBotPersonality,
  plotScore,
} from '../../src/engine/bot';

import {
  BURN_ADDRESS,
  DEFAULT_FLYWHEEL_CONFIG,
  applyMatchPayouts,
  applyPointSwap,
  applyTradeTax,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  calculateTradeTax,
  createInitialFlywheelState,
  type FlywheelState,
} from '../../src/tokenomics/flywheel';

import {
  DEFAULT_SIMULATED_ACCOUNTS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_NAME,
  WalletAdapter,
  hexWeiToTokens,
  normalizeAddress,
  parseChainId,
  tokensToHexWei,
  type EIP1193Provider,
} from '../../src/tokenomics/wallet';

import { TradeDeskController } from '../../src/ui/trade-desk';
import type { GamePhase, GameState, RandomSource, TradeOffer } from '../../src/engine/types';

function createDeterministicRng(seed: number): RandomSource {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Challenger Final 2: Adversarial Stress Test Suite', () => {
  // =========================================================================
  // SECTION 1: Chinatown Gameplay Invariants
  // =========================================================================
  describe('1. Chinatown Gameplay Invariants', () => {
    it('verifies exact 72 parcels partitioned cleanly across 6 districts (12 per district)', () => {
      assert.equal(TOTAL_LOTS, 72, 'Must have exactly 72 total parcels');
      assert.equal(TOTAL_DISTRICTS, 6, 'Must have exactly 6 districts');
      assert.equal(LOTS_PER_DISTRICT, 12, 'Must have exactly 12 parcels per district');
      assert.equal(DISTRICT_BLOCKS.length, 6, 'Must declare 6 district block configs');
      assert.equal(LOT_DEFINITIONS.length, 72, 'Must define exactly 72 lot definitions');

      const districtLotCounts = new Array(6).fill(0);
      const seenLotNumbers = new Set<number>();

      for (let id = 0; id < TOTAL_LOTS; id++) {
        const lot = LOT_DEFINITIONS[id];
        assert.equal(lot.id, id, `Lot definition id must match index ${id}`);
        assert.ok(lot.block >= 0 && lot.block < 6, `Lot ${id} block must be in range 0..5`);
        districtLotCounts[lot.block]++;

        assert.ok(!seenLotNumbers.has(lot.lotNumber), `Duplicate lot number detected: ${lot.lotNumber}`);
        seenLotNumbers.add(lot.lotNumber);

        const districtLots = getLotsInDistrict(lot.block as 0 | 1 | 2 | 3 | 4 | 5);
        assert.equal(districtLots.length, 12, `District ${lot.block} must contain 12 lots`);
      }

      for (let d = 0; d < 6; d++) {
        assert.equal(districtLotCounts[d], 12, `District ${d} must count exactly 12 lots`);
      }
    });

    it('verifies adjacency graph symmetry, absence of self-loops, and street channel boundary isolation', () => {
      assert.equal(ADJACENCY_GRAPH.length, 72, 'Adjacency graph must have 72 nodes');

      for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
        const neighbors = getNeighbors(lotId);
        const lotBlock = LOT_DEFINITIONS[lotId].block;

        assert.ok(neighbors.length >= 1 && neighbors.length <= 4, `Lot ${lotId} degree must be between 1 and 4`);
        assert.ok(!neighbors.includes(lotId), `Lot ${lotId} must not contain self-loop`);

        for (const neighborId of neighbors) {
          assert.ok(neighborId >= 0 && neighborId < 72, `Neighbor ${neighborId} out of bounds`);
          const neighborBlock = LOT_DEFINITIONS[neighborId].block;

          // Crucial street channel invariant: parcels can never be adjacent across different districts
          assert.equal(
            neighborBlock,
            lotBlock,
            `Lot ${lotId} (district ${lotBlock}) and neighbor ${neighborId} (district ${neighborBlock}) cross district boundary`
          );

          // Symmetry check: if A is neighbor of B, then B must be neighbor of A
          const reverseNeighbors = getNeighbors(neighborId);
          assert.ok(
            reverseNeighbors.includes(lotId),
            `Adjacency asymmetry between lot ${lotId} and lot ${neighborId}`
          );

          assert.ok(
            areOrthogonallyAdjacent(lotId, neighborId),
            `areOrthogonallyAdjacent must return true for lot ${lotId} and neighbor ${neighborId}`
          );
        }
      }
    });

    it('verifies 6 shop categories, target capacities, and non-linear cluster income curves', () => {
      assert.equal(SHOPS.length, 6, 'Must define exactly 6 shop categories');
      assert.equal(SHOP_CATEGORIES.length, 6, 'Must define 6 shop category metadata entries');
      assert.deepEqual(
        SHOP_TARGET_SIZES,
        [3, 3, 4, 4, 5, 6],
        'Shop target sizes must be exactly [3, 3, 4, 4, 5, 6]'
      );

      // Verify incomplete payouts: [0, 10, 20, 40, 60, 80]
      // Verify complete payouts: [0, 0, 0, 50, 80, 110, 140]
      assert.deepEqual(INCOMPLETE_PAYOUTS, [0, 10, 20, 40, 60, 80]);
      assert.deepEqual(COMPLETE_PAYOUTS, [0, 0, 0, 50, 80, 110, 140]);

      // Test size 0 yields 0 income
      for (let s = 0; s < 6; s++) {
        assert.equal(calculateClusterIncome(s, 0), 0);
        assert.equal(groupIncome(s, 0), 0);
      }

      // Test Photo Shop (target 3): size 1 yields 10, size 2 yields 20, size 3 complete yields 50 (+30 jump)
      assert.equal(calculateClusterIncome(0, 1), 10);
      assert.equal(calculateClusterIncome(0, 2), 20);
      assert.equal(calculateClusterIncome(0, 3), 50);

      // Test Seafood (target 4): size 3 incomplete yields 40, size 4 complete yields 80 (+40 jump)
      assert.equal(calculateClusterIncome(2, 3), 40);
      assert.equal(calculateClusterIncome(2, 4), 80);

      // Test Jade Market (target 5): size 4 incomplete yields 60, size 5 complete yields 110 (+50 jump)
      assert.equal(calculateClusterIncome(4, 4), 60);
      assert.equal(calculateClusterIncome(4, 5), 110);

      // Test Silk & Antiques (target 6): size 5 incomplete yields 80, size 6 complete yields 140 (+60 jump)
      assert.equal(calculateClusterIncome(5, 5), 80);
      assert.equal(calculateClusterIncome(5, 6), 140);
    });

    it('verifies 6-year parcel drafting schedules sum to exactly 72 parcels (18 per player)', () => {
      assert.deepEqual(PLOT_KEEP_SCHEDULE, [5, 4, 3, 2, 2, 2]);
      const totalPlotsPerPlayer = PLOT_KEEP_SCHEDULE.reduce((sum, n) => sum + n, 0);
      assert.equal(totalPlotsPerPlayer, 18, 'Each player keeps 18 plots across 6 years');
      assert.equal(totalPlotsPerPlayer * 4, 72, '4 players times 18 plots equals 72 total parcels');

      assert.deepEqual(TILE_DEAL_SCHEDULE, [6, 5, 5, 5, 5, 5]);
      assert.deepEqual(TILE_KEEP_SCHEDULE, [5, 4, 3, 2, 2, 2]);
    });

    it('verifies OTC Trade Desk validation and atomic asset transfers without asset loss or creation', () => {
      const state = createGame({ startingCash: 200 });
      state.phase = 'trade';

      // Assign lots: lot 0 to player 0, lot 1 to player 1
      state.lots[0].owner = 0;
      state.lots[1].owner = 1;
      state.players[0].tiles = [3, 0, 0, 0, 0, 0];
      state.players[1].tiles = [0, 2, 0, 0, 0, 0];
      state.players[0].cash = 100;
      state.players[1].cash = 150;

      const initialTotalCash = state.players.reduce((sum, p) => sum + p.cash, 0);
      const initialTotalTiles = state.players.reduce((sum, p) => sum + p.tiles.reduce((s, t) => s + t, 0), 0);

      const offer: TradeOffer = {
        partner: 1,
        fromPlayer: 0,
        toPlayer: 1,
        give: {
          cash: 80,
          lots: [0],
          tiles: [1, 0, 0, 0, 0, 0],
        },
        take: {
          cash: 10,
          lots: [1],
          tiles: [0, 1, 0, 0, 0, 0],
        },
      };

      // Validation passes for legal offer
      assert.equal(validateOffer(state, offer), true);

      // Validation throws when offering lots not owned
      const illegalLotOffer: TradeOffer = {
        ...offer,
        give: { ...offer.give, lots: [9] }, // lot 9 is unowned
      };
      assert.throws(() => validateOffer(state, illegalLotOffer));

      // Validation throws when offering excessive cash
      const excessiveCashOffer: TradeOffer = {
        ...offer,
        give: { ...offer.give, cash: 9999 },
      };
      assert.throws(() => validateOffer(state, excessiveCashOffer));

      // Validation throws when offering excessive tiles
      const excessiveTileOffer: TradeOffer = {
        ...offer,
        give: { ...offer.give, tiles: [10, 0, 0, 0, 0, 0] },
      };
      assert.throws(() => validateOffer(state, excessiveTileOffer));

      // Check if Sherwood requires additional cash to bridge shortfall
      const initialEval = evaluateOffer(state, offer);
      if (!initialEval.accepted && initialEval.shortfall > 0) {
        offer.give.cash += Math.ceil(initialEval.shortfall) + 10;
      }

      // Execute trade and verify atomic asset conservation
      const result = executeTrade(state, offer);
      assert.ok(result.evaluation.accepted);

      // Verify lot ownership flipped
      assert.equal(state.lots[0].owner, 1, 'Lot 0 must now belong to player 1');
      assert.equal(state.lots[1].owner, 0, 'Lot 1 must now belong to player 0');

      // Verify cash balance adjustments
      assert.equal(state.players[0].cash, 100 - offer.give.cash + offer.take.cash);
      assert.equal(state.players[1].cash, 150 + offer.give.cash - offer.take.cash);

      // Verify tile transfers
      assert.equal(state.players[0].tiles[0], 2);
      assert.equal(state.players[0].tiles[1], 1);
      assert.equal(state.players[1].tiles[0], 1);
      assert.equal(state.players[1].tiles[1], 1);

      // Invariant: total cash across players is conserved
      const finalTotalCash = state.players.reduce((sum, p) => sum + p.cash, 0);
      assert.equal(finalTotalCash, initialTotalCash, 'Total cash must be strictly conserved in trade');

      // Invariant: total tiles across players is conserved
      const finalTotalTiles = state.players.reduce((sum, p) => sum + p.tiles.reduce((s, t) => s + t, 0), 0);
      assert.equal(finalTotalTiles, initialTotalTiles, 'Total tiles must be strictly conserved in trade');
    });

    it('verifies TradeDeskController headless state machine, staging, and 1% micro-tax calculation', () => {
      const state = createGame({ startingCash: 250 });
      state.phase = 'trade';

      let executedOffer: TradeOffer | null = null;
      const desk = new TradeDeskController(state, {
        defaultPartnerId: 2,
        tradeTaxRate: 0.01,
        onTradeExecuted: (offer) => {
          executedOffer = offer;
        },
      });

      desk.open(2);
      const snapshot = desk.getDeskState();
      assert.equal(snapshot.isOpen, true);
      assert.equal(snapshot.partnerId, 2);

      // Stage cash
      desk.setGiveCash(50);
      desk.setTakeCash(100);

      const updated = desk.getDeskState();
      assert.equal(updated.give.cash, 50);
      assert.equal(updated.take.cash, 100);

      // Check 1% tax calculation
      assert.equal(updated.taxBreakdown.giveTax.taxAmount, 1, '1% of 50 is 1 with ceiling');
      assert.equal(updated.taxBreakdown.takeTax.taxAmount, 1, '1% of 100 is 1 with ceiling');

      desk.close();
      assert.equal(desk.getDeskState().isOpen, false);
    });
  });

  // =========================================================================
  // SECTION 2: AI Bot Opponents (Sherwood, Apex, Luna)
  // =========================================================================
  describe('2. AI Bot Opponents (Sherwood, Apex, Luna)', () => {
    it('verifies distinct bot personality profiles, risk tolerances, and profit margins', () => {
      const sherwood = getBotPersonality(1);
      const apex = getBotPersonality(2);
      const luna = getBotPersonality(3);

      assert.equal(sherwood.name, 'Sherwood');
      assert.equal(apex.name, 'Apex');
      assert.equal(luna.name, 'Luna');

      assert.equal(sherwood.profitMargin, 1.04, 'Sherwood requires 1.04 profit margin');
      assert.equal(apex.profitMargin, 1.09, 'Apex requires 1.09 profit margin');
      assert.equal(luna.profitMargin, 1.01, 'Luna requires 1.01 profit margin');

      assert.equal(sherwood.riskTolerance, 0.5);
      assert.equal(apex.riskTolerance, 0.2);
      assert.equal(luna.riskTolerance, 0.85);

      assert.ok(sherwood.dialogue.greeting.length > 0);
      assert.ok(apex.dialogue.thinking.length > 0);
      assert.ok(luna.dialogue.accepted.length > 0);

      // Fallback for unknown bot ID
      const fallback = getBotPersonality(99);
      assert.equal(fallback.name, 'Bot 99');
    });

    it('verifies plotScore awards bonuses for district concentration and friendly adjacency', () => {
      const state = createGame();

      // Lot 0 is in District 0.
      const initialScore = plotScore(0, 1, state);
      assert.ok(Number.isFinite(initialScore));

      // If Bot 1 owns another lot in District 0, plotScore for lot 0 must increase
      state.lots[1].owner = 1;
      const scoreWithFriendlyDistrict = plotScore(0, 1, state);
      assert.ok(
        scoreWithFriendlyDistrict > initialScore,
        'plotScore must increase when bot owns adjacent or district-neighboring lots'
      );
    });

    it('verifies bilateral trade evaluation respects personality profit margins and computes shortfall counteroffers', () => {
      const state = createGame({ startingCash: 500 });
      state.phase = 'trade';

      // Setup state: bot 1 (Sherwood) owns lot 0, player 0 owns lot 1
      state.lots[0].owner = 1;
      state.lots[1].owner = 0;
      state.players[0].cash = 100;
      state.players[1].cash = 100;

      // Offer where proposer gives 10 cash and asks for lot 0 (heavily favoring proposer)
      const unfavorableOffer: TradeOffer = {
        partner: 1,
        fromPlayer: 0,
        toPlayer: 1,
        give: { cash: 10, lots: [], tiles: [] },
        take: { cash: 0, lots: [0], tiles: [] },
      };

      const evalSherwood = evaluateTradeOffer(unfavorableOffer, 1, state);
      assert.equal(evalSherwood.accepted, false, 'Sherwood must reject heavily unfavorable offer');
      assert.ok(evalSherwood.shortfall > 0, 'Shortfall must be positive when offer is deficient');

      // Luna (bot 3) has profitMargin 1.01, so an offer with 1.04 margin will be accepted by Luna but rejected by Apex (1.09)
      const fairOfferValue = 50;
      const sideGive = { cash: 52, lots: [], tiles: [] };
      const sideTake = { cash: 50, lots: [], tiles: [] };
      const marginalOffer: TradeOffer = {
        partner: 3,
        fromPlayer: 0,
        toPlayer: 3,
        give: sideGive,
        take: sideTake,
      };

      state.players[3].cash = 100;
      const evalLuna = evaluateTradeOffer(marginalOffer, 3, state);
      assert.equal(evalLuna.accepted, true, 'Luna must accept 1.04x valuation offer with 1.01 margin');

      const marginalApexOffer: TradeOffer = {
        partner: 2,
        fromPlayer: 0,
        toPlayer: 2,
        give: sideGive,
        take: sideTake,
      };
      state.players[2].cash = 100;
      const evalApex = evaluateTradeOffer(marginalApexOffer, 2, state);
      assert.equal(evalApex.accepted, false, 'Apex must reject 1.04x valuation offer needing 1.09 margin');
    });

    it('verifies autonomous 6-year tournaments complete without deadlock across 10 distinct seeds', () => {
      const testSeeds = [42, 101, 777, 1337, 2026, 8888, 12345, 54321, 99999, 123456];

      for (const seed of testSeeds) {
        const rng = createDeterministicRng(seed);
        const state = createGame({ startingCash: 50 }, rng);

        // Run full 6-year loop
        for (let year = 1; year <= 6; year++) {
          assert.equal(state.year, year, `State year must equal ${year}`);
          assert.equal(state.phase, 'receive');

          // Receive phase: plot drafting for human player drafts selected lots,
          // then automatically executes bot drafting for bots 1..3 and advances phase to trade
          const chosenLots = state.pending.slice(0, state.draftCount);
          draftPlots(state, 0, chosenLots, rng);
          assert.equal(state.phase, 'trade');

          // Advance to build phase
          advancePhase(state);
          assert.equal(state.phase, 'build');

          // Build phase: collectIncome triggers botBuild for bots 1..3,
          // computes annual yields, and transitions to ended (if year 6) or income
          collectIncome(state);

          if (year < 6) {
            assert.equal(state.phase, 'income');
            nextYear(state, rng);
          }
        }

        assert.equal(state.phase, 'ended', `Tournament with seed ${seed} must reach ended phase`);
        assert.equal(state.year, 6, `Tournament with seed ${seed} must finish at year 6`);

        // Invariant checks on tournament completion
        const playerRankings = rankings(state);
        assert.equal(playerRankings.length, 4, 'Rankings must contain 4 players');

        for (let p = 0; p < 4; p++) {
          const player = state.players[p];
          assert.ok(Number.isFinite(player.cash), `Player ${p} cash must be finite`);
          assert.ok(player.cash >= 0, `Player ${p} cash must be non-negative`);
          assert.ok(!Number.isNaN(player.cash), `Player ${p} cash must not be NaN`);
          assert.ok(Array.isArray(player.tiles), `Player ${p} tiles must be an array`);
        }

        // Parcel conservation check: every lot is either unowned or owned by a valid player 0..3
        let ownedCount = 0;
        for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
          const lot = state.lots[lotId];
          if (lot.owner !== null) {
            assert.ok(lot.owner >= 0 && lot.owner <= 3, `Lot ${lotId} has invalid owner ${lot.owner}`);
            ownedCount++;
          }
        }
        assert.ok(ownedCount <= 72, `Total owned lots (${ownedCount}) must not exceed 72`);
      }
    });
  });

  // =========================================================================
  // SECTION 3: Robinhood Chain & $wif Economic Flywheel Token Conservation
  // =========================================================================
  describe('3. Robinhood Chain & $wif Economic Flywheel Token Conservation', () => {
    it('verifies exact mathematical token conservation in match buy-in pools (5% burn, 5% vault, 90% purse)', () => {
      // Test across multiple buy-in amounts including odd and prime numbers
      const buyIns = [1, 3, 7, 11, 23, 49, 99, 137, 333, 777, 999, 1000, 1337, 2026, 4001, 7777, 9999, 100000];
      const playerCounts = [1, 2, 3, 4, 5];

      for (const buyIn of buyIns) {
        for (const count of playerCounts) {
          const rankList = Array.from({ length: count }, (_, i) => i);
          const result = calculateMatchPayouts(buyIn, rankList);

          const expectedTotal = buyIn * count;
          assert.equal(result.totalPool, expectedTotal, 'Total pool must equal buyIn times count');

          const expectedBurn = Math.floor(expectedTotal * 0.05);
          const expectedVault = Math.floor(expectedTotal * 0.05);
          const expectedPurse = expectedTotal - expectedBurn - expectedVault;

          assert.equal(result.burnedAmount, expectedBurn, 'Burned amount must equal floor(totalPool * 0.05)');
          assert.equal(result.vaultAmount, expectedVault, 'Vault amount must equal floor(totalPool * 0.05)');
          assert.equal(result.purseAmount, expectedPurse, 'Purse amount must equal totalPool minus burn minus vault');
          assert.equal(result.burnAddress, BURN_ADDRESS, 'Burn address must equal official dead address');

          // Exact conservation invariant 1: burned + vault + purse === totalPool
          assert.equal(
            result.burnedAmount + result.vaultAmount + result.purseAmount,
            result.totalPool,
            'Token conservation invariant failed: burned + vault + purse !== totalPool'
          );

          // Exact conservation invariant 2: sum of individual player payouts === purseAmount (dust allocated to 1st place)
          const sumPayouts = Object.values(result.payouts).reduce((sum, p) => sum + p, 0);
          assert.equal(
            sumPayouts,
            result.purseAmount,
            `Purse conservation invariant failed for buyIn ${buyIn}, count ${count}: sum payouts (${sumPayouts}) !== purse (${result.purseAmount})`
          );

          // Podium checks
          const sumPodiumPayouts = result.podium.reduce((sum, p) => sum + p.payout, 0);
          assert.equal(sumPodiumPayouts, result.purseAmount, 'Sum of podium payouts must equal total purse');
        }
      }
    });

    it('verifies casual point-to-$wif swap conversion, 3% burn tax, and exact token conservation', () => {
      const pointValues = [0, 1, 9, 10, 11, 33, 34, 99, 100, 101, 333, 1000, 99999];

      for (const pts of pointValues) {
        const swap = calculatePointSwap(pts);
        assert.equal(swap.points, pts);
        assert.equal(swap.burnAddress, BURN_ADDRESS);

        if (pts <= 0) {
          assert.equal(swap.grossWif, 0);
          assert.equal(swap.burnedWif, 0);
          assert.equal(swap.netWif, 0);
          continue;
        }

        const expectedGross = Math.floor(pts * 0.10);
        assert.equal(swap.grossWif, expectedGross);

        if (expectedGross === 0) {
          assert.equal(swap.burnedWif, 0);
          assert.equal(swap.netWif, 0);
        } else {
          const expectedBurn = Math.ceil(expectedGross * 0.03);
          const expectedNet = Math.max(0, expectedGross - expectedBurn);
          assert.equal(swap.burnedWif, expectedBurn);
          assert.equal(swap.netWif, expectedNet);

          // Exact conservation: grossWif === burnedWif + netWif
          assert.equal(
            swap.grossWif,
            swap.burnedWif + swap.netWif,
            `Point swap conservation failed for ${pts} points: ${swap.grossWif} !== ${swap.burnedWif} + ${swap.netWif}`
          );
        }
      }
    });

    it('verifies 1% OTC trade micro-tax math and community vault routing', () => {
      const cashAmounts = [0, 1, 5, 10, 50, 99, 100, 101, 500, 1000, 50000];

      for (const cash of cashAmounts) {
        const tax = calculateTradeTax(cash);
        assert.equal(tax.grossCash, cash);

        if (cash <= 0) {
          assert.equal(tax.taxAmount, 0);
          assert.equal(tax.netCash, 0);
          assert.equal(tax.vaultAmount, 0);
          continue;
        }

        const expectedTax = Math.min(cash, Math.ceil(cash * 0.01));
        const expectedNet = cash - expectedTax;

        assert.equal(tax.taxAmount, expectedTax);
        assert.equal(tax.netCash, expectedNet);
        assert.equal(tax.vaultAmount, expectedTax);
        assert.equal(tax.burnedAmount, 0);

        // Exact conservation: grossCash === netCash + taxAmount
        assert.equal(tax.grossCash, tax.netCash + tax.taxAmount);
      }
    });

    it('verifies seasonal 1.20x staking yield multiplier bonus', () => {
      const rewards = [0, 1, 4, 5, 10, 33, 100, 250, 1000, 10000];

      for (const base of rewards) {
        const unstaked = calculateStakingBoost(base, false);
        const staked = calculateStakingBoost(base, true);

        if (base <= 0) {
          assert.equal(unstaked, 0);
          assert.equal(staked, 0);
        } else {
          assert.equal(unstaked, Math.floor(base));
          assert.equal(staked, Math.floor(base * 1.20));
          assert.ok(staked >= unstaked, `Staked payout (${staked}) must be >= unstaked (${unstaked})`);
        }
      }
    });

    it('verifies cumulative FlywheelState multi-match campaign accumulation without token drift', () => {
      let flywheel = createInitialFlywheelState();
      assert.equal(flywheel.totalMatches, 0);
      assert.equal(flywheel.totalBurned, 0);
      assert.equal(flywheel.totalStakingYield, 0);
      assert.equal(flywheel.totalPrizesDisbursed, 0);

      let accumulatedExpectedBurn = 0;
      let accumulatedExpectedVault = 0;
      let accumulatedExpectedPurse = 0;

      // Simulate a 30-match tournament campaign
      for (let m = 1; m <= 30; m++) {
        const buyIn = 1000 + m * 50;
        const matchResult = calculateMatchPayouts(buyIn, [0, 1, 2, 3]);
        flywheel = applyMatchPayouts(flywheel, matchResult);

        accumulatedExpectedBurn += matchResult.burnedAmount;
        accumulatedExpectedVault += matchResult.vaultAmount;
        accumulatedExpectedPurse += matchResult.purseAmount;

        // Simulate 2 point redemptions per match
        const swap1 = calculatePointSwap(500);
        const swap2 = calculatePointSwap(1200);
        flywheel = applyPointSwap(flywheel, swap1);
        flywheel = applyPointSwap(flywheel, swap2);

        accumulatedExpectedBurn += swap1.burnedWif + swap2.burnedWif;

        // Simulate 3 taxed trades per match
        const tradeTax1 = calculateTradeTax(100);
        const tradeTax2 = calculateTradeTax(250);
        const tradeTax3 = calculateTradeTax(500);
        flywheel = applyTradeTax(flywheel, tradeTax1);
        flywheel = applyTradeTax(flywheel, tradeTax2);
        flywheel = applyTradeTax(flywheel, tradeTax3);

        accumulatedExpectedVault += tradeTax1.vaultAmount + tradeTax2.vaultAmount + tradeTax3.vaultAmount;
      }

      assert.equal(flywheel.totalMatches, 30);
      assert.equal(flywheel.totalSwaps, 60);
      assert.equal(flywheel.totalTradesTaxed, 90);
      assert.equal(flywheel.totalBurned, accumulatedExpectedBurn);
      assert.equal(flywheel.totalStakingYield, accumulatedExpectedVault);
      assert.equal(flywheel.totalPrizesDisbursed, accumulatedExpectedPurse);
    });

    it('verifies dual-mode WalletAdapter simulation accounts, transfers, and burn mechanics', async () => {
      const adapter = new WalletAdapter({ autoConnect: true });
      const state = adapter.getState();

      assert.equal(state.mode, 'simulation');
      assert.equal(state.status, 'connected');
      assert.equal(DEFAULT_SIMULATED_ACCOUNTS.length, 4, 'Must have 4 simulated accounts');

      const acc0 = DEFAULT_SIMULATED_ACCOUNTS[0].address;
      const acc1 = DEFAULT_SIMULATED_ACCOUNTS[1].address;

      const balance0Before = await adapter.getBalance(acc0);
      const balance1Before = await adapter.getBalance(acc1);
      assert.equal(balance0Before, 10000);
      assert.equal(balance1Before, 10000);

      // Execute simulation transfer of 500 $wif
      await adapter.transfer(acc1, 500);
      assert.equal(await adapter.getBalance(acc0), 9500);
      assert.equal(await adapter.getBalance(acc1), 10500);

      // Execute burn transfer of 200 $wif to dead address
      await adapter.transfer(BURN_ADDRESS, 200);
      assert.equal(await adapter.getBalance(acc0), 9300);
      assert.equal(await adapter.getBalance(BURN_ADDRESS), 0, 'Dead burn address must not hold spendable balance');

      // Attempting to transfer more than balance throws error
      await assert.rejects(async () => {
        await adapter.transfer(acc1, 999999);
      });

      // Reset restores baseline balances
      adapter.resetSimulation();
      assert.equal(await adapter.getBalance(acc0), 10000);
      assert.equal(await adapter.getBalance(acc1), 10000);
    });
  });

  // =========================================================================
  // SECTION 4: Boundary Edge Cases and Stress Tests
  // =========================================================================
  describe('4. Boundary Edge Cases and Stress Tests', () => {
    it('verifies rapid instantiation of 25 game instances with zero state leakage', () => {
      const games: GameState[] = [];
      for (let i = 0; i < 25; i++) {
        const game = createGame({ startingCash: 100 + i });
        assert.equal(game.players[0].cash, 100 + i);
        assert.equal(game.lots.length, 72);
        assert.equal(game.year, 1);
        assert.equal(game.phase, 'receive');
        games.push(game);
      }

      // Modifying game 0 must not alter game 24
      games[0].lots[0].owner = 0;
      assert.equal(games[24].lots[0].owner, null, 'Game state must be completely decoupled between instances');
    });

    it('verifies canBuildShop boundary validations: illegal sizes, occupied parcels, and completed shops', () => {
      const state = createGame();

      // Lot out of bounds
      const outOfBounds = canBuildShop(state.lots, 99, 0, 0);
      assert.equal(outOfBounds.valid, false);

      // Invalid shop type
      const invalidShop = canBuildShop(state.lots, 0, 0, 99);
      assert.equal(invalidShop.valid, false);

      // Player does not own parcel
      const notOwned = canBuildShop(state.lots, 0, 0, 0);
      assert.equal(notOwned.valid, false);

      // Assign lot 0 to player 0
      state.lots[0].owner = 0;

      // Zero unplaced tiles
      const zeroTiles = canBuildShop(state.lots, 0, 0, 0, 0);
      assert.equal(zeroTiles.valid, false);

      // Legal build: 1 tile available
      const legalBuild = canBuildShop(state.lots, 0, 0, 0, 1);
      assert.equal(legalBuild.valid, true);

      // Parcel already occupied
      state.lots[0].shop = 0;
      const occupied = canBuildShop(state.lots, 0, 0, 0, 1);
      assert.equal(occupied.valid, false);

      // Build out full 3-tile completed cluster for Photo Shop (target 3)
      // Lots 0, 1, 2 in District 0
      state.lots[1].owner = 0;
      state.lots[1].shop = 0;
      state.lots[2].owner = 0;
      state.lots[2].shop = 0;

      const cluster = findClusterAtLot(state.lots, 0);
      assert.ok(cluster);
      assert.equal(cluster.isComplete, true);
      assert.equal(cluster.size, 3);

      // Neighbor of cluster attempting to expand beyond target size 3 must fail
      const neighbor = getNeighbors(2)[0];
      state.lots[neighbor].owner = 0;
      const expansion = canBuildShop(state.lots, neighbor, 0, 0, 1);
      assert.equal(expansion.valid, false, 'Completed shop clusters cannot be expanded');
    });

    it('verifies game state serialization round-trip and validSave schema validator', () => {
      const original = createGame({ startingCash: 75 });
      original.year = 3;
      original.phase = 'build';
      original.lots[5].owner = 1;
      original.lots[5].shop = 2;

      assert.equal(validSave(original), true);

      const serialized = JSON.stringify(original);
      const parsed = JSON.parse(serialized);

      assert.equal(validSave(parsed), true);
      assert.equal(parsed.year, 3);
      assert.equal(parsed.phase, 'build');
      assert.equal(parsed.lots[5].owner, 1);
      assert.equal(parsed.lots[5].shop, 2);

      // Rejects invalid objects
      assert.equal(validSave(null), false);
      assert.equal(validSave(undefined), false);
      assert.equal(validSave('invalid string'), false);
      assert.equal(validSave({}), false);
      assert.equal(validSave({ year: 3 }), false);
    });

    it('verifies extreme input handling in flywheel formulas', () => {
      // Negative buy-in throws Error
      assert.throws(() => calculateMatchPayouts(-100, [0, 1, 2, 3]));
      assert.throws(() => calculateMatchPayouts(NaN, [0, 1, 2, 3]));

      // Zero players returns zero result
      const zeroResult = calculateMatchPayouts(1000, []);
      assert.equal(zeroResult.totalPool, 0);
      assert.equal(zeroResult.burnedAmount, 0);
      assert.equal(zeroResult.vaultAmount, 0);
      assert.equal(zeroResult.purseAmount, 0);

      // Negative points swap returns 0
      const negSwap = calculatePointSwap(-500);
      assert.equal(negSwap.grossWif, 0);
      assert.equal(negSwap.burnedWif, 0);
      assert.equal(negSwap.netWif, 0);

      // Negative cash trade tax returns 0
      const negTax = calculateTradeTax(-100);
      assert.equal(negTax.taxAmount, 0);
      assert.equal(negTax.netCash, 0);

      // Large point values handle gracefully without overflow
      const largeSwap = calculatePointSwap(10_000_000);
      assert.equal(largeSwap.grossWif, 1_000_000);
      assert.equal(largeSwap.burnedWif, 30_000);
      assert.equal(largeSwap.netWif, 970_000);
      assert.equal(largeSwap.grossWif, largeSwap.burnedWif + largeSwap.netWif);
    });
  });
});
