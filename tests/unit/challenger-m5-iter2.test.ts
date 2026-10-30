import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app.js';
import { createGame, rankings } from '../../src/engine/engine.js';
import type { GameState } from '../../src/engine/types.js';
import { TradeDeskController } from '../../src/ui/trade-desk.js';
import { createInitialFlywheelState } from '../../src/tokenomics/flywheel.js';

describe('Adversarial Challenge 1: Dynamic Podium Settlement Across All Ranking Permutations', () => {
  it('awards 1st place payout of 2,160 $wif to Sherwood (Bot 1) when Sherwood wins', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[1].cash = 99999;
    game.players[0].cash = 100;
    game.players[2].cash = 50;
    game.players[3].cash = 10;

    const ranks = rankings(game);
    assert.equal(ranks[0].id, 1, 'Sherwood must be rank 1');

    const settlement = app.getFinalSettlement();
    assert.equal(settlement.rankings[0].id, 1);
    assert.equal(settlement.matchPool.podium[0].playerId, 1);
    assert.equal(settlement.matchPool.payouts[1], 2160, 'Sherwood must receive 2,160 $wif');
    assert.equal(settlement.matchPool.payouts[0], 900, 'Trader in 2nd place receives 900 $wif');
    assert.equal(settlement.matchPool.payouts[2], 540, 'Apex in 3rd place receives 540 $wif');
    assert.equal(settlement.matchPool.payouts[3], 0, 'Luna in 4th place receives 0 $wif');
  });

  it('awards 1st place payout of 2,160 $wif to Apex (Bot 2) when Apex wins', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[2].cash = 88888;
    game.players[3].cash = 44444;
    game.players[1].cash = 22222;
    game.players[0].cash = 11111;

    const ranks = rankings(game);
    assert.equal(ranks[0].id, 2, 'Apex must be rank 1');

    const settlement = app.getFinalSettlement();
    assert.equal(settlement.rankings[0].id, 2);
    assert.equal(settlement.matchPool.podium[0].playerId, 2);
    assert.equal(settlement.matchPool.payouts[2], 2160, 'Apex must receive 2,160 $wif');
    assert.equal(settlement.matchPool.payouts[3], 900, 'Luna in 2nd place receives 900 $wif');
    assert.equal(settlement.matchPool.payouts[1], 540, 'Sherwood in 3rd place receives 540 $wif');
    assert.equal(settlement.matchPool.payouts[0], 0, 'Trader in 4th place receives 0 $wif');
  });

  it('awards 1st place payout of 2,160 $wif to Luna (Bot 3) when Luna wins', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[3].cash = 77777;
    game.players[0].cash = 55555;
    game.players[2].cash = 33333;
    game.players[1].cash = 11111;

    const ranks = rankings(game);
    assert.equal(ranks[0].id, 3, 'Luna must be rank 1');

    const settlement = app.getFinalSettlement();
    assert.equal(settlement.rankings[0].id, 3);
    assert.equal(settlement.matchPool.podium[0].playerId, 3);
    assert.equal(settlement.matchPool.payouts[3], 2160, 'Luna must receive 2,160 $wif');
    assert.equal(settlement.matchPool.payouts[0], 900, 'Trader in 2nd place receives 900 $wif');
    assert.equal(settlement.matchPool.payouts[2], 540, 'Apex in 3rd place receives 540 $wif');
    assert.equal(settlement.matchPool.payouts[1], 0, 'Sherwood in 4th place receives 0 $wif');
  });

  it('awards 1st place payout of 2,160 $wif to Trader (Player 0) when Player 0 wins', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[0].cash = 99999;
    game.players[1].cash = 30000;
    game.players[2].cash = 20000;
    game.players[3].cash = 10000;

    const ranks = rankings(game);
    assert.equal(ranks[0].id, 0, 'Player 0 must be rank 1');

    const settlement = app.getFinalSettlement();
    assert.equal(settlement.rankings[0].id, 0);
    assert.equal(settlement.matchPool.podium[0].playerId, 0);
    assert.equal(settlement.matchPool.payouts[0], 2160, 'Player 0 must receive 2,160 $wif');
    assert.equal(settlement.matchPool.payouts[1], 900);
    assert.equal(settlement.matchPool.payouts[2], 540);
    assert.equal(settlement.matchPool.payouts[3], 0);
  });

  it('guarantees correct podium payouts across all 24 permutations of player rankings', () => {
    const permutations: number[][] = [];
    const players = [0, 1, 2, 3];

    function permute(arr: number[], m: number[] = []) {
      if (arr.length === 0) {
        permutations.push(m);
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    }
    permute(players);

    assert.equal(permutations.length, 24, 'Must evaluate exactly 24 permutations');

    for (const order of permutations) {
      const app = new RobinTownApp(null);
      const game = app.getGameState() as GameState;

      game.players[order[0]].cash = 4000;
      game.players[order[1]].cash = 3000;
      game.players[order[2]].cash = 2000;
      game.players[order[3]].cash = 1000;

      const settlement = app.getFinalSettlement();

      assert.equal(settlement.matchPool.podium[0].playerId, order[0]);
      assert.equal(settlement.matchPool.podium[1].playerId, order[1]);
      assert.equal(settlement.matchPool.podium[2].playerId, order[2]);

      assert.equal(settlement.matchPool.payouts[order[0]], 2160);
      assert.equal(settlement.matchPool.payouts[order[1]], 900);
      assert.equal(settlement.matchPool.payouts[order[2]], 540);
      assert.equal(settlement.matchPool.payouts[order[3]], 0);

      const totalPayout = settlement.matchPool.payouts[order[0]]
        + settlement.matchPool.payouts[order[1]]
        + settlement.matchPool.payouts[order[2]]
        + settlement.matchPool.payouts[order[3]];
      assert.equal(totalPayout, 3600);
      assert.equal(settlement.matchPool.burnedAmount, 200);
      assert.equal(settlement.matchPool.vaultAmount, 200);
      assert.equal(settlement.matchPool.totalPool, 4000);
    }
  });

  it('handles tie-breaking deterministically by placed shops, parcels, and player ID', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[1].cash = 5000;
    game.players[2].cash = 5000;
    game.players[0].cash = 1000;
    game.players[3].cash = 1000;

    game.lots[0].owner = 2;
    game.lots[0].shop = 0;
    game.lots[1].owner = 2;
    game.lots[1].shop = 0;
    game.lots[2].owner = 1;
    game.lots[2].shop = 0;

    const settlement = app.getFinalSettlement();
    assert.equal(settlement.rankings[0].id, 2, 'Player 2 wins tie-breaker via placed shops');
    assert.equal(settlement.matchPool.podium[0].playerId, 2);
    assert.equal(settlement.matchPool.payouts[2], 2160);
    assert.equal(settlement.matchPool.payouts[1], 900);
  });
});

describe('Adversarial Challenge 2: 1% Micro-Tax Deduction and Cash Conservation on Trade Desk', () => {
  it('deducts 1% micro-tax when human proposer receives cash from partner', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 50;
    game.players[3].cash = 200;
    game.lots[10].owner = 0;

    const controller = new TradeDeskController(game);
    controller.open(3);

    controller.toggleGiveLot(10);
    controller.setTakeCash(15);

    const prevHumanCash = game.players[0].cash;
    const prevLunaCash = game.players[3].cash;
    const prevVault = controller.getCommunityVault();

    const ok = controller.executeTrade();
    assert.equal(ok, true, 'Trade must be accepted');

    const humanGain = (game.players[0].cash-prevHumanCash);
    const lunaLoss = (prevLunaCash-game.players[3].cash);
    const vaultGain = (controller.getCommunityVault()-prevVault);

    assert.equal(lunaLoss, 15, 'Luna pays 15 gross cash');
    assert.equal(humanGain, 14, 'Human receives 14 net cash');
    assert.equal(vaultGain, 1, 'Vault receives 1 $wif tax');
    assert.equal(humanGain + vaultGain, lunaLoss, 'Strict cash conservation holds');

    const executedTax = controller.getDeskState().lastExecutedTax;
    assert.ok(executedTax);
    assert.equal(executedTax.grossCash, 15);
    assert.equal(executedTax.taxAmount, 1);
    assert.equal(executedTax.netCash, 14);
    assert.equal(executedTax.vaultAmount, 1);
  });

  it('deducts 1% micro-tax when bot partner receives cash from human proposer', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 200;
    game.players[1].cash = 50;
    game.lots[20].owner = 1;

    const controller = new TradeDeskController(game);
    controller.open(1);

    controller.setGiveCash(60);
    controller.toggleTakeLot(20);

    const prevHumanCash = game.players[0].cash;
    const prevSherwoodCash = game.players[1].cash;
    const prevVault = controller.getCommunityVault();

    const ok = controller.executeTrade();
    assert.equal(ok, true, 'Trade must be accepted');

    const humanLoss = (prevHumanCash-game.players[0].cash);
    const sherwoodGain = (game.players[1].cash-prevSherwoodCash);
    const vaultGain = (controller.getCommunityVault()-prevVault);

    assert.equal(humanLoss, 60, 'Human pays 60 gross cash');
    assert.equal(sherwoodGain, 59, 'Sherwood receives 59 net cash');
    assert.equal(vaultGain, 1, 'Vault receives 1 $wif tax');
    assert.equal(sherwoodGain + vaultGain, humanLoss, 'Strict cash conservation holds');

    const executedTax = controller.getDeskState().lastExecutedTax;
    assert.ok(executedTax);
    assert.equal(executedTax.grossCash, 60);
    assert.equal(executedTax.taxAmount, 1);
    assert.equal(executedTax.netCash, 59);
  });

  it('deducts 1% micro-tax on net cash differential when both sides offer cash', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[3].cash = 100;
    game.lots[5].owner = 0;

    const controller = new TradeDeskController(game);
    controller.open(3);

    controller.toggleGiveLot(5);
    controller.setGiveCash(5);
    controller.setTakeCash(20);

    const prevHumanCash = game.players[0].cash;
    const prevLunaCash = game.players[3].cash;
    const prevVault = controller.getCommunityVault();

    const ok = controller.executeTrade();
    assert.equal(ok, true);

    const humanGain = (game.players[0].cash-prevHumanCash);
    const lunaLoss = (prevLunaCash-game.players[3].cash);
    const vaultGain = (controller.getCommunityVault()-prevVault);

    assert.equal(lunaLoss, 15, 'Luna net cash outflow is 15 gross');
    assert.equal(humanGain, 14, 'Human net cash inflow is 14 net');
    assert.equal(vaultGain, 1, 'Vault receives 1 tax');
    assert.equal(humanGain + vaultGain, lunaLoss, 'Strict conservation on net cash differential');
  });

  it('transfers zero tax and zero vault allocation for pure non-cash barter trades', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[2].cash = 100;
    game.lots[30].owner = 0;
    game.lots[31].owner = 2;

    const controller = new TradeDeskController(game);
    controller.open(2);

    controller.toggleGiveLot(30);
    controller.toggleTakeLot(31);

    const prevHumanCash = game.players[0].cash;
    const prevApexCash = game.players[2].cash;
    const prevVault = controller.getCommunityVault();

    const ok = controller.executeTrade();
    assert.equal(ok, true);

    assert.equal(game.players[0].cash, prevHumanCash, 'Human cash unchanged');
    assert.equal(game.players[2].cash, prevApexCash, 'Apex cash unchanged');
    assert.equal(controller.getCommunityVault(), prevVault, 'Vault unchanged');
    assert.equal(controller.getDeskState().lastExecutedTax, null, 'Tax record is null for barter');
  });

  it('accumulates taxes monotonically across multiple consecutive trades', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 500;
    game.players[1].cash = 500;
    game.players[2].cash = 500;
    game.players[3].cash = 500;

    game.lots[1].owner = 0;
    game.lots[2].owner = 0;
    game.lots[3].owner = 0;

    const controller = new TradeDeskController(game);

    controller.open(3);
    controller.toggleGiveLot(1);
    controller.setTakeCash(15);
    assert.equal(controller.executeTrade(), true);
    assert.equal(controller.getCommunityVault(), 1);
    assert.equal(controller.getFlywheelState().totalTradesTaxed, 1);

    controller.open(3);
    controller.toggleGiveLot(2);
    controller.setTakeCash(15);
    assert.equal(controller.executeTrade(), true);
    assert.equal(controller.getCommunityVault(), 2);
    assert.equal(controller.getFlywheelState().totalTradesTaxed, 2);

    controller.open(3);
    controller.toggleGiveLot(3);
    controller.setTakeCash(15);
    assert.equal(controller.executeTrade(), true);
    assert.equal(controller.getCommunityVault(), 3);
    assert.equal(controller.getFlywheelState().totalTradesTaxed, 3);
  });

  it('synchronizes external FlywheelState object passed via config', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 200;
    game.players[3].cash = 200;
    game.lots[40].owner = 0;

    const externalFlywheel = createInitialFlywheelState();
    const controller = new TradeDeskController(game, { flywheelState: externalFlywheel });

    controller.open(3);
    controller.toggleGiveLot(40);
    controller.setTakeCash(15);

    assert.equal(controller.executeTrade(), true);
    assert.equal(externalFlywheel.totalStakingYield, 1);
    assert.equal(externalFlywheel.totalTradesTaxed, 1);
    assert.equal(controller.getCommunityVault(), 1);
  });

  it('triggers onTradeExecuted callback with correct appliedTax record', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 200;
    game.players[3].cash = 200;
    game.lots[50].owner = 0;

    let callbackFired = false;
    let recordedTaxAmount = 0;

    const controller = new TradeDeskController(game, {
      onTradeExecuted: (_offer, _evaluation, tax) => {
        callbackFired = true;
        if (tax) {
          recordedTaxAmount = tax.taxAmount;
        }
      },
    });

    controller.open(3);
    controller.toggleGiveLot(50);
    controller.setTakeCash(15);

    assert.equal(controller.executeTrade(), true);
    assert.equal(callbackFired, true);
    assert.equal(recordedTaxAmount, 1);
  });
});

describe('Adversarial Challenge 3: Live End-to-End Match Loop and Winner Dynamics', () => {
  it('rewards the highest scoring participant across 10 distinct simulated match completions', () => {
    for (let sim = 0; sim < 10; sim++) {
      const app = new RobinTownApp(null);
      const game = app.getGameState() as GameState;

      const winnerId = sim % 4;
      for (let p = 0; p < 4; p++) {
        game.players[p].cash = p === winnerId ? 50000 + sim * 1000 : 1000 + p * 500;
      }

      game.lots[sim].owner = winnerId;
      game.lots[sim].shop = 0;

      const settlement = app.getFinalSettlement();

      assert.equal(
        settlement.rankings[0].id,
        winnerId,
        `Simulation ${sim}: player ${winnerId} must be rank 1`
      );
      assert.equal(
        settlement.matchPool.podium[0].playerId,
        winnerId,
        `Simulation ${sim}: podium rank 1 must match winner ${winnerId}`
      );
      assert.equal(
        settlement.matchPool.payouts[winnerId],
        2160,
        `Simulation ${sim}: winner ${winnerId} must receive 2,160 $wif`
      );
    }
  });

  it('preserves exact 4,000 $wif pool accounting invariants on settlement', () => {
    const app = new RobinTownApp(null);
    const game = app.getGameState() as GameState;

    game.players[3].cash = 99999;
    const settlement = app.getFinalSettlement();

    assert.equal(settlement.matchPool.totalPool, 4000);
    assert.equal(settlement.matchPool.burnedAmount, 200);
    assert.equal(settlement.matchPool.vaultAmount, 200);
    assert.equal(settlement.matchPool.purseAmount, 3600);
    assert.equal(
      settlement.matchPool.podium[0].payout
        + settlement.matchPool.podium[1].payout
        + settlement.matchPool.podium[2].payout,
      3600
    );
  });
});

describe('Adversarial Challenge 4: Micro-Tax Boundary Stress and Custom Tax Rates', () => {
  it('supports custom tradeTaxRate configured on TradeDeskController', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[3].cash = 200;
    game.lots[15].owner = 0;

    const controller = new TradeDeskController(game, { tradeTaxRate: 0.02 });
    controller.open(3);

    controller.toggleGiveLot(15);
    controller.setTakeCash(15);

    const prevHumanCash = game.players[0].cash;
    const prevLunaCash = game.players[3].cash;
    const prevVault = controller.getCommunityVault();

    assert.equal(controller.executeTrade(), true);

    const humanGain = (game.players[0].cash-prevHumanCash);
    const lunaLoss = (prevLunaCash-game.players[3].cash);
    const vaultGain = (controller.getCommunityVault()-prevVault);

    assert.equal(lunaLoss, 15);
    assert.equal(humanGain, 14);
    assert.equal(vaultGain, 1);
  });

  it('rejects execution cleanly and leaves cash and vault unchanged when offer is rejected', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[1].cash = 100;
    game.lots[5].owner = 0;

    const controller = new TradeDeskController(game);
    controller.open(1);

    controller.toggleGiveLot(5);
    controller.setTakeCash(100);

    const prevProposerCash = game.players[0].cash;
    const prevPartnerCash = game.players[1].cash;
    const prevVault = controller.getCommunityVault();

    const ok = controller.executeTrade();
    assert.equal(ok, false, 'Unreasonable trade must be rejected');
    assert.equal(game.players[0].cash, prevProposerCash, 'Proposer cash intact');
    assert.equal(game.players[1].cash, prevPartnerCash, 'Partner cash intact');
    assert.equal(controller.getCommunityVault(), prevVault, 'Vault intact');
    assert.equal(controller.getDeskState().lastExecutedOffer, null);
    assert.equal(controller.getDeskState().lastExecutedTax, null);
  });

  it('handles minimum cash boundary (1 $wif) with 100% tax and zero net cash', () => {
    const game = createGame();
    game.phase = 'trade';
    game.players[0].cash = 100;
    game.players[3].cash = 100;
    game.lots[8].owner = 0;

    const controller = new TradeDeskController(game);
    controller.open(3);

    controller.toggleGiveLot(8);
    controller.setTakeCash(1);

    const prevHumanCash = game.players[0].cash;
    const prevLunaCash = game.players[3].cash;
    const prevVault = controller.getCommunityVault();

    assert.equal(controller.executeTrade(), true);

    assert.equal((prevLunaCash-game.players[3].cash), 1, 'Luna pays 1 cash');
    assert.equal((game.players[0].cash-prevHumanCash), 0, 'Human receives 0 net cash');
    assert.equal((controller.getCommunityVault()-prevVault), 1, 'Vault receives 1 tax');
    assert.equal(controller.getDeskState().lastExecutedTax?.netCash, 0);
  });
});
