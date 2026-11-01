/**
 * tests/unit/challenger-m8-2.test.ts
 *
 * Empirical Challenger stress test suite for Milestone M8:
 * 1. iPod Classic Chinatown phase action trees across all 5 phases.
 * 2. Deflationary $wif economic flywheel conservation under multi-year matches.
 * 3. Live burn metrics accumulation in FlywheelState across consecutive matches and point swaps.
 * 4. Edge cases: empty wallet balances, zero score points, extreme trade values, rapid bot auto-turns, and game restarts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app';
import { TOTAL_LOTS, findAllClusters } from '../../src/engine/board-layout';
import { SHOPS } from '../../src/engine/engine';
import {
  BURN_ADDRESS,
  DEFAULT_FLYWHEEL_CONFIG,
  calculateMatchPayouts,
  calculatePointSwap,
  calculateStakingBoost,
  calculateTradeTax,
  createInitialFlywheelState,
  type FlywheelState,
} from '../../src/engine/flywheel';
import { DEFAULT_SIMULATED_ACCOUNTS, WalletAdapter } from '../../src/engine/tokens';
import { projectTopBarViewModel } from '../../src/ui/hud';
import type { GamePhase, Player } from '../../src/engine/types';

describe('Empirical Challenger M8-2: iPod Action Trees, Flywheel Conservation, and Edge Cases', () => {
  describe('1. iPod Classic Chinatown Phase Action Trees & Submenus', () => {
    const phases: GamePhase[] = ['receive', 'trade', 'build', 'income', 'ended'];

    it('verifies that every Chinatown phase generates a valid, non-empty action tree', () => {
      const app = new RobinTownApp(null);

      for (const phase of phases) {
        const actions = app.buildIPodPhaseActions(phase);
        assert.ok(Array.isArray(actions), `Phase ${phase} actions must be an array`);
        assert.ok(actions.length > 0, `Phase ${phase} must have at least one action`);

        for (const action of actions) {
          assert.ok(action.id && typeof action.id === 'string', 'Action id must be a non-empty string');
          assert.ok(action.label && typeof action.label === 'string', 'Action label must be a non-empty string');
          assert.equal(typeof action.handler, 'function', `Action ${action.id} handler must be a function`);

          if (action.submenu) {
            assert.ok(action.submenu.title, `Submenu for ${action.id} must have a title`);
            assert.ok(Array.isArray(action.submenu.actions), `Submenu ${action.id} actions must be an array`);
            for (const subAction of action.submenu.actions) {
              assert.ok(subAction.id, `Sub-action in ${action.id} must have an id`);
              assert.ok(subAction.label, `Sub-action in ${action.id} must have a label`);
              assert.equal(typeof subAction.handler, 'function', `Sub-action ${subAction.id} handler must be a function`);
            }
          }
        }
      }
    });

    it('executes all phase actions and nested submenus under baseline and edge conditions without unhandled exceptions', () => {
      const app = new RobinTownApp(null);

      // Phase 1: receive
      const receiveActions = app.buildIPodPhaseActions('receive');
      const confirmDraft = receiveActions.find((a) => a.id === 'confirm-draft');
      const quickDraft = receiveActions.find((a) => a.id === 'quick-draft');
      const toggleParcel = receiveActions.find((a) => a.id === 'toggle-parcel');
      const browseDeeds = receiveActions.find((a) => a.id === 'browse-available');

      assert.ok(confirmDraft && quickDraft && toggleParcel && browseDeeds);

      // Calling confirm-draft with no lots selected should return false and not throw
      assert.doesNotThrow(() => {
        confirmDraft.handler();
      });

      // Calling toggle-parcel with null selectedLotId should not throw
      assert.doesNotThrow(() => {
        toggleParcel.handler();
      });

      // Select out of bounds lot and toggle
      app.selectLot(999, 'ipod');
      assert.doesNotThrow(() => {
        toggleParcel.handler();
      });

      // Browse available submenu actions execution
      if (browseDeeds.submenu) {
        for (const sub of browseDeeds.submenu.actions) {
          assert.doesNotThrow(() => {
            sub.handler();
          });
        }
      }

      // Quick draft auto-drafts and advances phase to trade
      quickDraft.handler();
      assert.equal(app.getGameState().phase, 'trade');

      // Phase 2: trade
      const tradeActions = app.buildIPodPhaseActions('trade');
      const openDesk = tradeActions.find((a) => a.id === 'open-otc-propose');
      const tradeSherwood = tradeActions.find((a) => a.id === 'trade-sherwood');
      const tradeApex = tradeActions.find((a) => a.id === 'trade-apex');
      const tradeLuna = tradeActions.find((a) => a.id === 'trade-luna');
      const finishTrading = tradeActions.find((a) => a.id === 'finish-trading');

      assert.ok(openDesk && tradeSherwood && tradeApex && tradeLuna && finishTrading);

      assert.doesNotThrow(() => {
        openDesk.handler();
        tradeSherwood.handler();
        assert.equal(app.getTradeDeskController().getDeskState().partnerId, 1);
        tradeApex.handler();
        assert.equal(app.getTradeDeskController().getDeskState().partnerId, 2);
        tradeLuna.handler();
        assert.equal(app.getTradeDeskController().getDeskState().partnerId, 3);
      });

      // Finish trading advances phase to build
      finishTrading.handler();
      assert.equal(app.getGameState().phase, 'build');

      // Phase 3: build
      const buildActions = app.buildIPodPhaseActions('build');
      const pickShop = buildActions.find((a) => a.id === 'pick-shop-category');
      const deployFocused = buildActions.find((a) => a.id === 'deploy-on-focused');
      const clearShop = buildActions.find((a) => a.id === 'clear-shop-choice');
      const finishBuilding = buildActions.find((a) => a.id === 'finish-building');

      assert.ok(pickShop && deployFocused && clearShop && finishBuilding);

      // Trigger all shop selection sub-actions
      assert.ok(pickShop.submenu);
      assert.equal(pickShop.submenu.actions.length, 6);
      for (const shopSub of pickShop.submenu.actions) {
        assert.doesNotThrow(() => {
          shopSub.handler();
        });
      }

      // Clear shop choice
      clearShop.handler();

      // Deploy on focused with null lot
      assert.doesNotThrow(() => {
        deployFocused.handler();
      });

      // Finish building triggers harvest yield and advances phase
      finishBuilding.handler();
      assert.equal(app.getGameState().phase, 'income');

      // Phase 4: income
      const incomeActions = app.buildIPodPhaseActions('income');
      const advanceNext = incomeActions.find((a) => a.id === 'advance-next-year');
      const toggleStaking = incomeActions.find((a) => a.id === 'toggle-staking');

      assert.ok(advanceNext && toggleStaking);

      // Staking toggle executes cleanly
      assert.doesNotThrow(() => {
        toggleStaking.handler();
        toggleStaking.handler();
      });

      // Advance next year advances to Year 2
      advanceNext.handler();
      assert.equal(app.getGameState().year, 2);
      assert.equal(app.getGameState().phase, 'receive');

      // Phase 5: ended (simulate reaching ended state)
      const endedActions = app.buildIPodPhaseActions('ended');
      const openSettlement = endedActions.find((a) => a.id === 'open-settlement');
      const swapPoints = endedActions.find((a) => a.id === 'swap-points-wif');
      const startFresh = endedActions.find((a) => a.id === 'start-fresh-match');

      assert.ok(openSettlement && swapPoints && startFresh);

      assert.doesNotThrow(() => {
        openSettlement.handler();
        app.closeModals();
        swapPoints.handler();
        app.closeModals();
        startFresh.handler();
      });

      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');
    });

    it('verifies universal wallet and flywheel submenu execution across all phases', () => {
      const app = new RobinTownApp(null);

      for (const phase of phases) {
        const actions = app.buildIPodPhaseActions(phase);
        const walletAction = actions.find((a) => a.id === 'wallet-menu');
        assert.ok(walletAction, `Phase ${phase} must contain wallet-menu`);
        assert.ok(walletAction.submenu, `Phase ${phase} wallet-menu must have a submenu`);

        const toggleMode = walletAction.submenu.actions.find((a) => a.id === 'toggle-mode');
        const cycleSim = walletAction.submenu.actions.find((a) => a.id === 'cycle-sim');
        const resetSim = walletAction.submenu.actions.find((a) => a.id === 'reset-sim-balance');
        const openDialog = walletAction.submenu.actions.find((a) => a.id === 'open-wallet-dialog');

        assert.ok(toggleMode && cycleSim && resetSim && openDialog);

        // Execute each subaction
        assert.doesNotThrow(() => {
          toggleMode.handler();
          cycleSim.handler();
          resetSim.handler();
          openDialog.handler();
          app.closeModals();
        });
      }
    });

    it('simulates cyclic account cycling through all 4 default simulated wallets', () => {
      const app = new RobinTownApp(null);
      const wallet = app.getWalletAdapter();
      const actions = app.buildIPodPhaseActions('receive');
      const cycleSim = actions.find((a) => a.id === 'wallet-menu')?.submenu?.actions.find((a) => a.id === 'cycle-sim');
      assert.ok(cycleSim);

      const expectedNames = ['Bob', 'Charlie', 'Dave', 'Alice'];
      for (const expectedName of expectedNames) {
        cycleSim.handler();
        assert.equal(wallet.getState().account?.name, expectedName);
      }
    });
  });

  describe('2. Deflationary $wif Economic Flywheel Conservation Invariants', () => {
    it('proves exact mathematical conservation for match pools across diverse buy-ins and player scales', () => {
      const testCases = [
        { buyIn: 0, playerCount: 4 },
        { buyIn: 1, playerCount: 4 },
        { buyIn: 10, playerCount: 4 },
        { buyIn: 100, playerCount: 4 },
        { buyIn: 1000, playerCount: 4 },
        { buyIn: 5000, playerCount: 4 },
        { buyIn: 100000, playerCount: 4 },
        { buyIn: 1234567, playerCount: 4 },
        { buyIn: 1000, playerCount: 1 },
        { buyIn: 1000, playerCount: 2 },
        { buyIn: 1000, playerCount: 3 },
        { buyIn: 1000, playerCount: 8 },
      ];

      for (const tc of testCases) {
        const rankings = Array.from({ length: tc.playerCount }, (_, i) => i);
        const result = calculateMatchPayouts(tc.buyIn, rankings);

        const expectedTotalPool = Math.round(tc.buyIn * tc.playerCount);
        assert.equal(result.totalPool, expectedTotalPool, 'Total pool must equal buyIn * playerCount');

        // Burn must be floor 5%
        const expectedBurn = Math.floor(expectedTotalPool * DEFAULT_FLYWHEEL_CONFIG.burnRate);
        assert.equal(result.burnedAmount, expectedBurn, 'Burned amount must equal floor(5%)');

        // Vault must be floor 5%
        const expectedVault = Math.floor(expectedTotalPool * DEFAULT_FLYWHEEL_CONFIG.vaultRate);
        assert.equal(result.vaultAmount, expectedVault, 'Vault amount must equal floor(5%)');

        // Purse must be totalPool - burned - vault
        const expectedPurse = expectedTotalPool - expectedBurn - expectedVault;
        assert.equal(result.purseAmount, expectedPurse, 'Purse amount must equal remaining funds');

        // Sinks sum conservation invariant: burned + vault + purse === totalPool
        const sinksSum = result.burnedAmount + result.vaultAmount + result.purseAmount;
        assert.equal(sinksSum, result.totalPool, 'Burn, vault, and purse must strictly conserve total pool');

        // Podium payout dust conservation invariant: sum(podium.payout) === purseAmount
        const podiumSum = result.podium.reduce((acc, p) => acc + p.payout, 0);
        assert.equal(podiumSum, result.purseAmount, 'Podium payouts with dust allocation must conserve purse');

        // Individual player payouts sum conservation: sum(payouts[i]) === purseAmount
        const payoutsSum = Object.values(result.payouts).reduce((acc, val) => acc + val, 0);
        assert.equal(payoutsSum, result.purseAmount, 'All player payouts must strictly conserve purse');

        // Burn address invariant
        assert.equal(result.burnAddress, BURN_ADDRESS, 'Burn address must be canonical 0xdEaD');
      }
    });

    it('proves exact conservation and 3% burn tax for casual point-to-$wif redemptions', () => {
      const pointValues = [0, -10, -9999, 1, 9, 10, 11, 33, 99, 100, 333, 1000, 5000, 999999];

      for (const pts of pointValues) {
        const result = calculatePointSwap(pts);

        if (pts <= 0) {
          assert.equal(result.grossWif, 0);
          assert.equal(result.burnedWif, 0);
          assert.equal(result.netWif, 0);
          continue;
        }

        const expectedGross = Math.floor(pts * DEFAULT_FLYWHEEL_CONFIG.pointToWifRate);
        assert.equal(result.grossWif, expectedGross, 'Gross $wif must equal floor(pts * 0.10)');

        if (expectedGross === 0) {
          assert.equal(result.burnedWif, 0);
          assert.equal(result.netWif, 0);
        } else {
          const expectedBurn = Math.ceil(expectedGross * DEFAULT_FLYWHEEL_CONFIG.swapBurnTax);
          assert.equal(result.burnedWif, expectedBurn, 'Burned $wif must equal ceil(gross * 0.03)');

          const expectedNet = Math.max(0, expectedGross - expectedBurn);
          assert.equal(result.netWif, expectedNet, 'Net $wif must equal gross - burn');

          // Conversion conservation invariant: burnedWif + netWif === grossWif
          assert.equal(
            result.burnedWif + result.netWif,
            result.grossWif,
            'Burned plus net $wif must strictly conserve gross $wif'
          );
        }

        assert.equal(result.burnAddress, BURN_ADDRESS, 'Point swap burn address must be canonical 0xdEaD');
      }
    });

    it('proves exact conservation and 1% micro-tax for OTC cash transfers', () => {
      const cashValues = [0, -50, 1, 2, 5, 50, 99, 100, 101, 1000, 50000];

      for (const cash of cashValues) {
        const result = calculateTradeTax(cash);

        if (cash <= 0) {
          assert.equal(result.grossCash, 0);
          assert.equal(result.taxAmount, 0);
          assert.equal(result.netCash, 0);
          assert.equal(result.vaultAmount, 0);
          assert.equal(result.burnedAmount, 0);
          continue;
        }

        const expectedTax = Math.min(cash, Math.ceil(cash * DEFAULT_FLYWHEEL_CONFIG.tradeMicroTax));
        const expectedNet = cash - expectedTax;

        assert.equal(result.grossCash, cash);
        assert.equal(result.taxAmount, expectedTax);
        assert.equal(result.netCash, expectedNet);
        assert.equal(result.vaultAmount, expectedTax);

        // Trade conservation invariant: netCash + taxAmount === grossCash
        assert.equal(
          result.netCash + result.taxAmount,
          result.grossCash,
          'Net cash plus tax amount must strictly conserve gross cash'
        );
      }
    });

    it('proves exact 1.20x seasonal staking yield boost fidelity', () => {
      assert.equal(calculateStakingBoost(0, true), 0);
      assert.equal(calculateStakingBoost(-100, true), 0);
      assert.equal(calculateStakingBoost(100, false), 100);
      assert.equal(calculateStakingBoost(100, true), 120);
      assert.equal(calculateStakingBoost(250, true), 300);
      assert.equal(calculateStakingBoost(15, true), 18);
    });
  });

  describe('3. Live Burn Metrics Accumulation Across Multi-Year Matches and Swaps', () => {
    it('preserves and monotonically accumulates burn metrics across 3 full consecutive matches', () => {
      const app = new RobinTownApp(null);
      let cumulativeExpectedBurn = 0;
      let cumulativeExpectedPrizes = 0;
      let cumulativeExpectedVault = 0;

      for (let matchIndex = 1; matchIndex <= 3; matchIndex++) {
        // Run match from Year 1 to Year 6
        for (let yr = 1; yr <= 6; yr++) {
          assert.equal(app.getGameState().year, yr);

          // Phase: receive
          app.quickDraft();

          // Phase: trade
          app.finishTrading();

          // Phase: build -> income (or ended on Year 6)
          app.harvestYield();

          if (yr < 6) {
            // Advance to next year
            app.advanceToNextYear();
          }
        }

        // On Year 6, phase ends and match pool settles
        assert.equal(app.getGameState().phase, 'ended');
        cumulativeExpectedBurn += 200;
        cumulativeExpectedVault += 200;
        cumulativeExpectedPrizes += 3600;

        const flywheel = app.getFlywheelState();
        assert.equal(flywheel.totalBurned, cumulativeExpectedBurn, `Match ${matchIndex} burn must accumulate 200 $wif`);
        assert.equal(flywheel.totalPrizesDisbursed, cumulativeExpectedPrizes, `Match ${matchIndex} prize purse must accumulate 3,600 $wif`);
        assert.equal(flywheel.totalMatches, matchIndex, `Match count must equal ${matchIndex}`);

        // Verify HUD view model projects matching live burn ticker
        const topBarVm = projectTopBarViewModel(app.getGameState(), true, flywheel.totalBurned);
        assert.equal(topBarVm.totalBurned, cumulativeExpectedBurn);

        // Prepare for next match if not last
        if (matchIndex < 3) {
          app.startNewGame();
          assert.equal(app.getGameState().year, 1);
          assert.equal(app.getGameState().phase, 'receive');

          // Ensure flywheel state is not wiped on restart
          assert.equal(app.getFlywheelState().totalBurned, cumulativeExpectedBurn);
          assert.equal(app.getFlywheelState().totalMatches, matchIndex);
        }
      }
    });

    it('interleaves multiple casual point swaps and verifies cumulative burn and wallet balances', () => {
      const app = new RobinTownApp(null);
      const initialWalletBalance = app.getWalletAdapter().getState().account?.balance || 0;

      // Initial flywheel state
      const initialFlywheel = app.getFlywheelState();
      assert.equal(initialFlywheel.totalBurned, 0);
      assert.equal(initialFlywheel.totalSwaps, 0);

      const swaps = [
        { points: 1000, expectedGross: 100, expectedBurn: 3, expectedNet: 97 },
        { points: 2500, expectedGross: 250, expectedBurn: 8, expectedNet: 242 },
        { points: 10000, expectedGross: 1000, expectedBurn: 30, expectedNet: 970 },
      ];

      let runningBurn = 0;
      let runningNetCredit = 0;
      let swapCount = 0;

      for (const s of swaps) {
        swapCount++;
        const res = app.swapPointsForWif(s.points);

        assert.equal(res.grossWif, s.expectedGross);
        assert.equal(res.burnedWif, s.expectedBurn);
        assert.equal(res.netWif, s.expectedNet);

        runningBurn += s.expectedBurn;
        runningNetCredit += s.expectedNet;

        const currentFlywheel = app.getFlywheelState();
        assert.equal(currentFlywheel.totalBurned, runningBurn, 'Total burned must strictly accumulate');
        assert.equal(currentFlywheel.totalSwaps, swapCount, 'Total swaps must increment');

        const currentWalletBalance = app.getWalletAdapter().getState().account?.balance || 0;
        assert.equal(
          currentWalletBalance,
          initialWalletBalance + runningNetCredit,
          'Wallet balance must be credited with net $wif'
        );
      }
    });
  });

  describe('4. Edge Cases, Boundaries, and Rapid Bot Simulation', () => {
    it('handles zero, negative, and extreme point values gracefully', () => {
      const app = new RobinTownApp(null);
      const startingBurn = app.getFlywheelState().totalBurned;
      const startingBalance = app.getWalletAdapter().getState().account?.balance || 0;

      // Zero points
      const zeroRes = app.swapPointsForWif(0);
      assert.equal(zeroRes.grossWif, 0);
      assert.equal(zeroRes.burnedWif, 0);
      assert.equal(zeroRes.netWif, 0);
      assert.equal(app.getFlywheelState().totalBurned, startingBurn);
      assert.equal(app.getWalletAdapter().getState().account?.balance, startingBalance);

      // Negative points
      const negRes = app.swapPointsForWif(-500);
      assert.equal(negRes.grossWif, 0);
      assert.equal(negRes.burnedWif, 0);
      assert.equal(negRes.netWif, 0);
      assert.equal(app.getFlywheelState().totalBurned, startingBurn);
      assert.equal(app.getWalletAdapter().getState().account?.balance, startingBalance);

      // Billion points extreme scale
      const largeRes = app.swapPointsForWif(1_000_000_000);
      assert.equal(largeRes.grossWif, 100_000_000);
      assert.equal(largeRes.burnedWif, 3_000_000);
      assert.equal(largeRes.netWif, 97_000_000);
      assert.equal(app.getFlywheelState().totalBurned, startingBurn + 3_000_000);
      assert.equal(app.getWalletAdapter().getState().account?.balance, startingBalance + 97_000_000);
    });

    it('enforces bounds on OTC desk cash staging against liquid player cash', () => {
      const app = new RobinTownApp(null);
      app.quickDraft(); // advance to trade phase
      assert.equal(app.getGameState().phase, 'trade');

      const tradeDesk = app.getTradeDeskController();
      tradeDesk.open(1);

      const playerCash = app.getGameState().players[0].cash;
      assert.ok(playerCash > 0);

      // Attempt to stage cash far in excess of liquid cash
      tradeDesk.setGiveCash(999999);
      assert.equal(
        tradeDesk.getDeskState().give.cash,
        playerCash,
        'Give cash must be clamped strictly to available player cash'
      );

      // Attempt to stage negative cash
      tradeDesk.setGiveCash(-50);
      assert.equal(
        tradeDesk.getDeskState().give.cash,
        0,
        'Negative give cash must be clamped strictly to 0'
      );

      // Attempt to stage cash far in excess of partner liquid cash
      const partnerCash = app.getGameState().players[1].cash;
      tradeDesk.setTakeCash(888888);
      assert.equal(
        tradeDesk.getDeskState().take.cash,
        partnerCash,
        'Take cash must be clamped strictly to available partner cash'
      );

      // Attempt to stage negative take cash
      tradeDesk.setTakeCash(-100);
      assert.equal(
        tradeDesk.getDeskState().take.cash,
        0,
        'Negative take cash must be clamped strictly to 0'
      );

      tradeDesk.close();
    });

    it('executes rapid automated matches without state corruption, memory leaks, or lost parcels', () => {
      const app = new RobinTownApp(null);

      // Run 5 full games (30 match years)
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        for (let yr = 1; yr <= 6; yr++) {
          // Receive
          app.quickDraft();

          // Trade
          app.finishTrading();

          // Build: try to deploy a shop if any vacant owned parcel exists
          const ownedLot = app.getGameState().lots.find((l) => l.owner === 0 && l.shop === null);
          if (ownedLot) {
            app.selectShopType(0);
            app.buildOnLot(ownedLot.id);
          }

          // Income
          app.harvestYield();

          if (yr < 6) {
            app.advanceToNextYear();
          }
        }

        assert.equal(app.getGameState().phase, 'ended');

        // Verify total parcels remains strictly 72
        assert.equal(app.getGameState().lots.length, TOTAL_LOTS);

        // Verify all parcels have valid definitions
        for (let i = 0; i < TOTAL_LOTS; i++) {
          const lot = app.getGameState().lots[i];
          assert.equal(lot.id, i);
        }

        // Reset for next game
        app.startNewGame();
        assert.equal(app.getGameState().year, 1);
        assert.equal(app.getGameState().phase, 'receive');
      }

      // 5 games settled -> 5 * 200 = 1,000 $wif burned
      assert.equal(app.getFlywheelState().totalMatches, 5);
      assert.equal(app.getFlywheelState().totalBurned, 1000);
    });

    it('verifies game restart idempotency from every possible Chinatown phase', () => {
      const app = new RobinTownApp(null);

      // 1. Restart from 'receive' phase
      assert.equal(app.getGameState().phase, 'receive');
      app.startNewGame();
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      // 2. Restart from 'trade' phase
      app.quickDraft();
      assert.equal(app.getGameState().phase, 'trade');
      app.startNewGame();
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      // 3. Restart from 'build' phase
      app.quickDraft();
      app.finishTrading();
      assert.equal(app.getGameState().phase, 'build');
      app.startNewGame();
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      // 4. Restart from 'income' phase
      app.quickDraft();
      app.finishTrading();
      app.harvestYield();
      assert.equal(app.getGameState().phase, 'income');
      app.startNewGame();
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');

      // 5. Restart from 'ended' phase
      for (let yr = 1; yr <= 6; yr++) {
        app.quickDraft();
        app.finishTrading();
        app.harvestYield();
        if (yr < 6) app.advanceToNextYear();
      }
      assert.equal(app.getGameState().phase, 'ended');
      app.startNewGame();
      assert.equal(app.getGameState().year, 1);
      assert.equal(app.getGameState().phase, 'receive');
    });

    it('calculates player score points accurately under empty and populated states', () => {
      const app = new RobinTownApp(null);

      // Baseline year 1 state: 50 cash, 0 shops, 0 clusters
      const baselinePoints = app.calculatePlayerPoints(0);
      assert.equal(baselinePoints, 50);

      // Player with 0 cash, 0 shops, 0 clusters
      app.getGameState().players[0].cash = 0;
      assert.equal(app.calculatePlayerPoints(0), 0);

      // Non-existent player ID returns 0
      assert.equal(app.calculatePlayerPoints(999), 0);
    });

    it('verifies wallet transfer rejection when transfer amount exceeds account balance', async () => {
      const wallet = new WalletAdapter({ mode: 'simulation' });
      const currentAccount = wallet.getState().account;
      assert.ok(currentAccount);

      // Transfer amount exceeding 10,000 $wif balance must reject
      await assert.rejects(
        async () => {
          await wallet.transfer(DEFAULT_SIMULATED_ACCOUNTS[1].address, 999999);
        },
        /Insufficient balance/
      );
    });
  });
});
