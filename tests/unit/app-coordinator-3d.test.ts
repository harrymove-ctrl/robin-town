/**
 * tests/unit/app-coordinator-3d.test.ts
 *
 * Unit tests for Milestone M8: App Shell & Flywheel Binding.
 * Verifies 3D board scene coordination, 2D fallback, Apple Carousel deed synchronization,
 * iPod Classic controller Chinatown phase action trees, ExposureGrid theme updates,
 * engine re-export aliases, and persistent $wif deflationary economic flywheel.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app';
import { TOTAL_LOTS } from '../../src/engine/board-layout';
import * as tokensAlias from '../../src/engine/tokens';
import * as flywheelAlias from '../../src/engine/flywheel';

describe('Milestone M8: App Shell Coordinator and 3D Binding', () => {
  it('re-exports tokenomics wallet and flywheel modules via engine aliases', () => {
    assert.ok(tokensAlias.WalletAdapter, 'tokens alias must export WalletAdapter');
    assert.equal(tokensAlias.ROBINHOOD_CHAIN_ID, 46630, 'tokens alias must export ROBINHOOD_CHAIN_ID');
    assert.ok(tokensAlias.DEFAULT_SIMULATED_ACCOUNTS.length >= 4, 'tokens alias must export simulated accounts');

    assert.ok(flywheelAlias.createInitialFlywheelState, 'flywheel alias must export createInitialFlywheelState');
    assert.ok(flywheelAlias.calculateMatchPayouts, 'flywheel alias must export calculateMatchPayouts');
    assert.ok(flywheelAlias.calculatePointSwap, 'flywheel alias must export calculatePointSwap');
    assert.equal(flywheelAlias.BURN_ADDRESS, '0x000000000000000000000000000000000000dEaD');
  });

  it('initializes cleanly in headless Node.js environments with 2D fallback', () => {
    const app = new RobinTownApp(null);
    assert.ok(app.getGameState(), 'GameState must be initialized');
    assert.ok(app.getCameraController(), 'CameraController must be initialized');
    assert.ok(app.getBoardRenderer(), '2D BoardRenderer must be initialized');
    assert.ok(app.getWalletAdapter(), 'WalletAdapter must be initialized');
    assert.ok(app.getTradeDeskController(), 'TradeDeskController must be initialized');

    // In headless environments without WebGL or container, 3D renderer remains null
    assert.equal(app.getBoard3DRenderer(), null, 'Board3DRenderer is null in headless null container');
    assert.equal(app.getCarousel(), null, 'Carousel is null in headless null container');
    assert.equal(app.getIPodController(), null, 'IPodController is null in headless null container');
    assert.equal(app.getExposureGrid(), null, 'ExposureGrid is null in headless null container');

    // Default render mode starts at 3d but toggles safely
    assert.equal(app.getRenderMode(), '3d');
    const toggled = app.toggleRenderMode();
    assert.equal(toggled, '2d');
    assert.equal(app.getRenderMode(), '2d');
    const toggledBack = app.toggleRenderMode();
    assert.equal(toggledBack, '3d');
  });

  it('builds 72 carousel deed items reflecting parcel owners and shop statuses', () => {
    const app = new RobinTownApp(null);
    const items = app.buildCarouselItems();

    assert.equal(items.length, TOTAL_LOTS, 'Must return exactly 72 carousel deed items');
    assert.equal(items.length, 72);

    // Inspect first item structure
    const firstItem = items[0];
    assert.equal(firstItem.id, 0);
    assert.equal(firstItem.title, 'Parcel #1');
    assert.ok(firstItem.district.length > 0, 'District name must be populated');
    assert.ok(firstItem.color.startsWith('#'), 'District color hex must be valid');
    assert.equal(firstItem.owner, 'Vacant', 'Initial lots are vacant');
    assert.equal(firstItem.shop, 'Vacant', 'Initial shops are vacant');
    assert.equal(firstItem.income, 0, 'Initial income is 0');

    // After drafting parcel 0, deed reflects Trader ownership
    const state = app.getGameState();
    state.lots[0].owner = 0;
    const updatedItems = app.buildCarouselItems();
    assert.equal(updatedItems[0].owner, 'You (Trader)');
  });

  it('synchronizes lot selection with re-entrancy protection', () => {
    const app = new RobinTownApp(null);

    // Select lot 10 from board source
    app.selectLot(10, 'board');
    // Calling with out of bounds lot is ignored
    app.selectLot(-1, 'board');
    app.selectLot(999, 'board');

    // Select lot from carousel source
    app.selectLot(25, 'carousel');

    // Select lot from ipod source
    app.selectLot(42, 'ipod');

    // Verify engine state remains intact
    assert.equal(app.getGameState().year, 1);
  });

  it('constructs iPod phase action trees for all 5 Chinatown phases', () => {
    const app = new RobinTownApp(null);

    // 1. Phase: receive
    const receiveActions = app.buildIPodPhaseActions('receive');
    assert.ok(receiveActions.some((a) => a.id === 'confirm-draft'), 'Receive must have confirm draft');
    assert.ok(receiveActions.some((a) => a.id === 'quick-draft'), 'Receive must have quick draft');
    assert.ok(receiveActions.some((a) => a.id === 'toggle-parcel'), 'Receive must have toggle parcel');
    assert.ok(receiveActions.some((a) => a.id === 'browse-available'), 'Receive must have browse deeds');
    assert.ok(receiveActions.some((a) => a.id === 'wallet-menu'), 'Must include wallet submenu');

    // 2. Phase: trade
    const tradeActions = app.buildIPodPhaseActions('trade');
    assert.ok(tradeActions.some((a) => a.id === 'open-otc-propose'), 'Trade must have open desk');
    assert.ok(tradeActions.some((a) => a.id === 'trade-sherwood'), 'Trade must have trade Sherwood');
    assert.ok(tradeActions.some((a) => a.id === 'trade-apex'), 'Trade must have trade Apex');
    assert.ok(tradeActions.some((a) => a.id === 'trade-luna'), 'Trade must have trade Luna');
    assert.ok(tradeActions.some((a) => a.id === 'finish-trading'), 'Trade must have finish trading');

    // 3. Phase: build
    const buildActions = app.buildIPodPhaseActions('build');
    assert.ok(buildActions.some((a) => a.id === 'pick-shop-category'), 'Build must have shop category picker');
    assert.ok(buildActions.some((a) => a.id === 'deploy-on-focused'), 'Build must have deploy option');
    assert.ok(buildActions.some((a) => a.id === 'finish-building'), 'Build must have finish construction');

    const shopSubmenu = buildActions.find((a) => a.id === 'pick-shop-category')?.submenu;
    assert.ok(shopSubmenu, 'Shop category must have submenu');
    assert.equal(shopSubmenu?.actions.length, 6, 'Must have 6 protocol shop options');

    // 4. Phase: income
    const incomeActions = app.buildIPodPhaseActions('income');
    assert.ok(incomeActions.some((a) => a.id === 'advance-next-year'), 'Income must have advance next year');
    assert.ok(incomeActions.some((a) => a.id === 'toggle-staking'), 'Income must have toggle staking');

    // 5. Phase: ended
    const endedActions = app.buildIPodPhaseActions('ended');
    assert.ok(endedActions.some((a) => a.id === 'open-settlement'), 'Ended must have view settlement');
    assert.ok(endedActions.some((a) => a.id === 'swap-points-wif'), 'Ended must have swap points');
    assert.ok(endedActions.some((a) => a.id === 'start-fresh-match'), 'Ended must have start fresh match');
  });

  it('executes iPod actions and navigates submenus correctly', () => {
    const app = new RobinTownApp(null);
    const receiveActions = app.buildIPodPhaseActions('receive');

    // Execute quick draft action through iPod action handler
    const quickDraftAction = receiveActions.find((a) => a.id === 'quick-draft');
    assert.ok(quickDraftAction, 'Quick draft action must exist');
    quickDraftAction?.handler();

    // Game advances from receive to trade phase
    assert.equal(app.getGameState().phase, 'trade');

    // Execute finish trading through trade phase actions
    const tradeActions = app.buildIPodPhaseActions('trade');
    const finishAction = tradeActions.find((a) => a.id === 'finish-trading');
    assert.ok(finishAction, 'Finish trading action must exist');
    finishAction?.handler();

    // Game advances from trade to build phase
    assert.equal(app.getGameState().phase, 'build');

    // Execute shop selection via submenu
    const buildActions = app.buildIPodPhaseActions('build');
    const pickModule = buildActions.find((a) => a.id === 'pick-shop-category');
    assert.ok(pickModule?.submenu, 'Submenu must exist');
    pickModule?.submenu?.actions[0].handler();

    // Verify wallet submenu actions
    const walletAction = buildActions.find((a) => a.id === 'wallet-menu');
    assert.ok(walletAction?.submenu, 'Wallet submenu must exist');
    const toggleMode = walletAction?.submenu?.actions.find((a) => a.id === 'toggle-mode');
    assert.ok(toggleMode, 'Toggle mode action must exist');
    toggleMode?.handler();
    // In headless Node.js without window.ethereum, mode safely remains simulation
    assert.equal(app.getWalletAdapter().getState().mode, 'simulation');

    // Cycle sim account
    const cycleSim = walletAction?.submenu?.actions.find((a) => a.id === 'cycle-sim');
    assert.ok(cycleSim, 'Cycle sim action must exist');
    cycleSim?.handler();
    assert.equal(
      app.getWalletAdapter().getState().account?.name,
      'Bob',
      'Account switches to Bob'
    );
  });

  it('accumulates flywheel burns, staking vault allocations, and prize distributions', () => {
    const app = new RobinTownApp(null);
    const initialFlywheel = app.getFlywheelState();
    assert.equal(initialFlywheel.totalBurned, 0);
    assert.equal(initialFlywheel.totalStakingYield, 0);
    assert.equal(initialFlywheel.totalPrizesDisbursed, 0);

    // Execute Year 6 settlement to trigger 4,000 $wif match pool sinks
    const settlement = app.getFinalSettlement();
    assert.equal(settlement.matchPool.totalPool, 4000);
    assert.equal(settlement.matchPool.burnedAmount, 200, '5% of 4,000 pool equals 200 $wif burn');
    assert.equal(settlement.matchPool.vaultAmount, 200, '5% of 4,000 pool equals 200 $wif vault');
    assert.equal(settlement.matchPool.purseAmount, 3600, '90% of 4,000 pool equals 3,600 $wif purse');

    const updatedFlywheel = app.getFlywheelState();
    assert.equal(updatedFlywheel.totalBurned, 200, 'FlywheelState totalBurned must record 200 $wif');
    assert.equal(updatedFlywheel.totalStakingYield, 200, 'FlywheelState totalStakingYield must record 200 $wif');
    assert.equal(updatedFlywheel.totalPrizesDisbursed, 3600, 'FlywheelState totalPrizesDisbursed must record 3,600 $wif');
    assert.equal(updatedFlywheel.totalMatches, 1);
  });

  it('swaps score points for $wif with 3 percent burn tax and balance credit', () => {
    const app = new RobinTownApp(null);
    const initialBalance = app.getWalletAdapter().getState().account?.balance || 0;
    assert.equal(initialBalance, 10000, 'Initial Alice balance is 10,000 $wif');

    // Swap 1,000 performance score points
    // Gross: 100 $wif, Burn Tax (3%): 3 $wif, Net: 97 $wif
    const result = app.swapPointsForWif(1000);
    assert.equal(result.grossWif, 100);
    assert.equal(result.burnedWif, 3);
    assert.equal(result.netWif, 97);

    // Flywheel burn state is updated
    const flywheel = app.getFlywheelState();
    assert.equal(flywheel.totalBurned, 3);
    assert.equal(flywheel.totalSwaps, 1);

    // Simulated wallet account receives net 97 $wif
    const newBalance = app.getWalletAdapter().getState().account?.balance || 0;
    assert.equal(newBalance, 10097, 'Wallet balance should increase by net 97 $wif');
  });

  it('manages interactive point redemption modal states', () => {
    const app = new RobinTownApp(null);
    app.openPointSwapModal();
    app.closeModals();
    app.openSettlementModal();
    app.closeModals();
    app.openWalletModal();
    app.closeModals();
    app.openRoomModal();
    app.closeModals();
  });

  it('executes a multi-year match through RobinTownApp without state desynchronization', () => {
    const app = new RobinTownApp(null);

    // Year 1: Receive
    const drafted = app.quickDraft();
    assert.equal(drafted.length, 5, 'Year 1 draft count is 5 parcels');
    assert.equal(app.getGameState().phase, 'trade');

    // Year 1: Trade
    app.finishTrading();
    assert.equal(app.getGameState().phase, 'build');

    // Year 1: Build
    const ownedLot = app.getGameState().lots.find((l) => l.owner === 0);
    if (ownedLot) {
      app.selectShopType(0);
      app.buildOnLot(ownedLot.id);
    }

    // Year 1: Harvest
    const harvestRes = app.harvestYield();
    assert.ok(harvestRes.payouts.length === 4);
    assert.equal(app.getGameState().phase, 'income');

    // Advance to Year 2
    app.advanceToNextYear();
    assert.equal(app.getGameState().year, 2);
    assert.equal(app.getGameState().phase, 'receive');

    // Reset to new game
    app.startNewGame();
    assert.equal(app.getGameState().year, 1);
    assert.equal(app.getGameState().phase, 'receive');
  });
});
