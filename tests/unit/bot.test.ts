/**
 * tests/unit/bot.test.ts
 *
 * Comprehensive unit test suite verifying AI bot personas, valuation models,
 * drafting heuristics (plotScore and botDraft), greedy building heuristics (botBuild),
 * and all 10 verified Milestone 1 trade scenarios.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  BOT_PERSONALITIES,
  getBotPersonality,
  plotScore,
  botDraft,
  botBuild,
  calculateTileValue,
  calculateLotValue,
  evaluateOfferSide,
  evaluateTradeOffer,
} from '../../src/engine/bot';
import type { BotState } from '../../src/engine/bot';
import { createGame } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';

describe('AI Bot Profiles and Archetype Contracts', () => {
  it('instantiates Sherwood (retail / balanced) with a fair 1.0 margin and Size 3-4 shop focus', () => {
    const sherwood = getBotPersonality(1);
    assert.strictEqual(sherwood.id, 1);
    assert.strictEqual(sherwood.name, 'Sherwood');
    assert.strictEqual(sherwood.profitMargin, 1.0);
    assert.strictEqual(sherwood.riskTolerance, 0.5);
    // DEX Swap, Memecoin Lounge, Staking Vault
    assert.deepStrictEqual(sherwood.preferredShops, [0, 1, 2]);
    assert.deepStrictEqual(sherwood.preferredDistricts, [0, 2]);
    assert.ok(sherwood.dialogue.greeting.length > 0);
    assert.ok(sherwood.dialogue.counteroffer.length > 0);
  });

  it('instantiates Apex (monopoly hunter) with an aggressive 1.15 margin', () => {
    const apex = getBotPersonality(2);
    assert.strictEqual(apex.id, 2);
    assert.strictEqual(apex.name, 'Apex');
    assert.strictEqual(apex.profitMargin, 1.15);
    assert.strictEqual(apex.riskTolerance, 0.2);
    assert.deepStrictEqual(apex.preferredShops, [4, 5]);
    assert.deepStrictEqual(apex.preferredDistricts, [1, 5]);
    assert.ok(apex.dialogue.greeting.length > 0);
    assert.ok(apex.dialogue.rejected.length > 0);
  });

  it('instantiates Luna (high-tempo speculator) with a fluid 0.95 margin and loose-tile bias', () => {
    const luna = getBotPersonality(3);
    assert.strictEqual(luna.id, 3);
    assert.strictEqual(luna.name, 'Luna');
    assert.strictEqual(luna.profitMargin, 0.95);
    assert.ok((luna.looseTileBias ?? 1) > 1, 'Luna is eager to swap loose tiles');
    assert.strictEqual(luna.riskTolerance, 0.85);
    assert.deepStrictEqual(luna.preferredShops, [1, 0, 3]);
    assert.deepStrictEqual(luna.preferredDistricts, [4, 3]);
    assert.ok(luna.dialogue.greeting.length > 0);
    assert.ok(luna.dialogue.accepted.length > 0);
  });

  it('provides complete English dialogue phrases across all three personas', () => {
    for (const id of [1, 2, 3]) {
      const personality = BOT_PERSONALITIES[id];
      assert.ok(personality);
      assert.ok(personality.dialogue.greeting);
      assert.ok(personality.dialogue.thinking);
      assert.ok(personality.dialogue.accepted);
      assert.ok(personality.dialogue.counteroffer);
      assert.ok(personality.dialogue.rejected);
    }
  });
});

describe('The 10 Verified Trade Valuation Scenarios', () => {
  const personas = {
    sherwood: { name: 'Sherwood', margin: 1.0 },
    apex: { name: 'Apex', margin: 1.15 },
    luna: { name: 'Luna', margin: 0.95 },
  };

  it('Scenario 1: Free Cash Donation to Sherwood is accepted without counteroffer', () => {
    const botState: BotState = { tiles: {}, lots: {} };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 50, tiles: [], lots: [] },
      take: { cash: 0, tiles: [], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 200, 1);
    assert.strictEqual(evaluation.accepted, true);
    assert.strictEqual(evaluation.shortfall, 0);
    assert.strictEqual(evaluation.counterOffer, undefined);
  });

  it('Scenario 2: Free Gift Exploitation Attempt against Sherwood is rejected with counteroffer', () => {
    const botState: BotState = {
      tiles: { 0: { ownedMatchingTiles: 0, canCompleteThisTurn: false } },
      lots: {},
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 0, tiles: [], lots: [] },
      take: { cash: 0, tiles: [{ type: 0, id: 101 }], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 100, 1);
    assert.strictEqual(evaluation.accepted, false);
    // tile value 28 (10 + 6 epochs x 3) at Sherwood's fair 1.0x
    assert.strictEqual(evaluation.shortfall, 28);
    assert.ok(evaluation.counterOffer);
    assert.strictEqual(evaluation.counterOffer.cash, 28);
  });

  it('Scenario 3: Severe Underbid with Feasible Cash Counteroffer', () => {
    const botState: BotState = {
      tiles: {},
      lots: { 12: { adjacentFriendlyPlots: 1, hasMatchingShopAdjacent: false, isOccupied: false } },
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 10, tiles: [], lots: [] },
      take: { cash: 0, tiles: [], lots: [12] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 50, 2);
    assert.strictEqual(evaluation.accepted, false);
    // lot value 32 (18 + 14 friendly) x 1.0 - 10 offered
    assert.strictEqual(evaluation.shortfall, 22);
    assert.ok(evaluation.counterOffer);
    assert.strictEqual(evaluation.counterOffer.cash, 32);
  });

  it('Scenario 4: Severe Underbid with Insolvent Proposer suppresses counteroffer', () => {
    const botState: BotState = {
      tiles: {},
      lots: { 12: { adjacentFriendlyPlots: 1, hasMatchingShopAdjacent: false, isOccupied: false } },
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 10, tiles: [], lots: [] },
      take: { cash: 0, tiles: [], lots: [12] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 25, 2);
    assert.strictEqual(evaluation.accepted, false);
    assert.strictEqual(evaluation.shortfall, 22);
    assert.strictEqual(evaluation.counterOffer, undefined);
  });

  it('Scenario 5: Tile Parity Swap Accepted by Cooperative Luna', () => {
    const botState: BotState = {
      tiles: {
        1: { ownedMatchingTiles: 1, canCompleteThisTurn: false },
        2: { ownedMatchingTiles: 0, canCompleteThisTurn: false },
      },
      lots: {},
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 3,
      give: { cash: 0, tiles: [{ type: 1, id: 201 }], lots: [] },
      take: { cash: 0, tiles: [{ type: 2, id: 202 }], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.luna, botState, 100, 3);
    assert.strictEqual(evaluation.accepted, true);
    assert.strictEqual(evaluation.shortfall, 0);
    assert.strictEqual(evaluation.counterOffer, undefined);
  });

  it('Scenario 6: Tile Parity Swap Rejected by Aggressive Apex', () => {
    const botState: BotState = {
      tiles: {
        3: { ownedMatchingTiles: 0, canCompleteThisTurn: false },
        4: { ownedMatchingTiles: 0, canCompleteThisTurn: false },
      },
      lots: {},
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 2,
      give: { cash: 3, tiles: [{ type: 3, id: 301 }], lots: [] },
      take: { cash: 2, tiles: [{ type: 4, id: 302 }], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.apex, botState, 50, 3);
    assert.strictEqual(evaluation.accepted, false);
    // received 25 vs required 24 x 1.15 = 27.6
    assert.strictEqual(evaluation.shortfall, 3);
    assert.ok(evaluation.counterOffer);
    assert.strictEqual(evaluation.counterOffer.cash, 6);
  });

  it('Scenario 7: Generous Premium Cash Offer to Sherwood is accepted cleanly', () => {
    const botState: BotState = {
      tiles: { 0: { ownedMatchingTiles: 0, canCompleteThisTurn: false } },
      lots: {},
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 100, tiles: [], lots: [] },
      take: { cash: 0, tiles: [{ type: 0, id: 401 }], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 150, 1);
    assert.strictEqual(evaluation.accepted, true);
    assert.strictEqual(evaluation.shortfall, 0);
    assert.strictEqual(evaluation.counterOffer, undefined);
  });

  it('Scenario 8: Multi-Asset Complex Package Trade Accepted by Luna', () => {
    const botState: BotState = {
      tiles: {
        1: { ownedMatchingTiles: 1, canCompleteThisTurn: false },
        2: { ownedMatchingTiles: 0, canCompleteThisTurn: false },
      },
      lots: {
        5: { adjacentFriendlyPlots: 0, hasMatchingShopAdjacent: false, isOccupied: false },
        6: { adjacentFriendlyPlots: 1, hasMatchingShopAdjacent: false, isOccupied: false },
      },
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 3,
      give: { cash: 15, tiles: [{ type: 1, id: 501 }], lots: [5] },
      take: { cash: 0, tiles: [{ type: 2, id: 502 }], lots: [6] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.luna, botState, 80, 4);
    assert.strictEqual(evaluation.accepted, true);
    assert.strictEqual(evaluation.shortfall, 0);
    assert.strictEqual(evaluation.counterOffer, undefined);
  });

  it('Scenario 9: Monopoly Set-Completion Tile to Aggressive Apex requires premium counteroffer', () => {
    const botState: BotState = {
      tiles: {
        0: { ownedMatchingTiles: 2, canCompleteThisTurn: true },
      },
      lots: {},
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 2,
      give: { cash: 35, tiles: [], lots: [] },
      take: { cash: 0, tiles: [{ type: 0, id: 601 }], lots: [] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.apex, botState, 100, 5);
    assert.strictEqual(evaluation.accepted, false);
    // set-completion tile worth 57 x 1.15 = 65.55 against 35 offered
    assert.strictEqual(evaluation.shortfall, 31);
    assert.ok(evaluation.counterOffer);
    assert.strictEqual(evaluation.counterOffer.cash, 66);
  });

  it('Scenario 10: Non-Cash Asset Underbid with Cash Top-Up preserves original assets', () => {
    const botState: BotState = {
      tiles: {
        5: { ownedMatchingTiles: 0, canCompleteThisTurn: false },
      },
      lots: {
        20: { adjacentFriendlyPlots: 1, hasMatchingShopAdjacent: false, isOccupied: false },
      },
    };
    const offer = {
      fromPlayer: 0,
      toPlayer: 1,
      give: { cash: 1, tiles: [{ type: 5, id: 701 }], lots: [] },
      take: { cash: 0, tiles: [], lots: [20] },
    };

    const evaluation = evaluateTradeOffer(offer, personas.sherwood, botState, 50, 4);
    assert.strictEqual(evaluation.accepted, false);
    // received 20 (1 cash + tile 19) vs lot 32 x 1.0
    assert.strictEqual(evaluation.shortfall, 12);
    assert.ok(evaluation.counterOffer);
    assert.strictEqual(evaluation.counterOffer.cash, 13);
    assert.strictEqual(evaluation.counterOffer.tiles.length, 1);
  });
});

describe('Drafting Heuristics (plotScore and botDraft)', () => {
  function makeMockState(): GameState {
    return {
      version: 1,
      year: 1,
      phase: 'receive',
      players: [
        { id: 0, name: 'You', address: '0x1', cash: 50, tiles: [0, 0, 0, 0, 0, 0] },
        { id: 1, name: 'Sherwood', address: '0x2', cash: 50, tiles: [0, 0, 0, 0, 0, 0] },
        { id: 2, name: 'Apex', address: '0x3', cash: 50, tiles: [0, 0, 0, 0, 0, 0] },
        { id: 3, name: 'Luna', address: '0x4', cash: 50, tiles: [0, 0, 0, 0, 0, 0] },
      ],
      lots: Array.from({ length: 72 }, (_, id) => ({
        id,
        displayId: id + 1,
        block: Math.floor(id / 12),
        col: id % 4,
        row: Math.floor((id % 12) / 4),
        owner: null,
        shop: null,
      })),
      bag: [],
      pending: [],
      draftCount: 5,
      logs: [],
      lastIncome: [],
      trades: 0,
    };
  }

  it('awards +14 points for adjacency to friendly owned plots (+3 district density bonus)', () => {
    const state = makeMockState();
    // In District 0, lot 1 has neighbor lot 0
    state.lots[0].owner = 1; // Sherwood owns lot 0
    const scoreWithFriendly = plotScore(1, 1, state);

    state.lots[0].owner = null;
    const scoreWithoutFriendly = plotScore(1, 1, state);

    // 14 friendly adjacency + 3 district density bonus = 17
    assert.strictEqual(scoreWithFriendly - scoreWithoutFriendly, 17);
  });

  it('awards +16 additional points when friendly neighbor has an incomplete shop', () => {
    const state = makeMockState();
    state.lots[0].owner = 1;
    state.lots[0].shop = 0; // DEX Swap (size 3) incomplete
    const scoreWithShop = plotScore(1, 1, state);

    state.lots[0].shop = null;
    const scoreWithoutShop = plotScore(1, 1, state);

    assert.strictEqual(scoreWithShop - scoreWithoutShop, 16);
  });

  it('Apex awards +12 points for defensive blocking of opponent expansion', () => {
    const state = makeMockState();
    state.lots[0].owner = 0; // Player 0 owns lot 0
    state.lots[0].shop = 0; // Incomplete shop
    const apexScore = plotScore(1, 2, state);

    state.lots[0].shop = null;
    const apexScoreNoShop = plotScore(1, 2, state);

    assert.strictEqual(apexScore - apexScoreNoShop, 12);
  });

  it('botDraft selects top scoring lots from candidate pool', () => {
    const state = makeMockState();
    // Sherwood owns lot 0
    state.lots[0].owner = 1;
    // Candidate lots: 1 (adjacent to 0), 2 (adjacent to 1), 10, 11
    const candidates = [10, 11, 2, 1];
    const picked = botDraft(1, candidates, 2, state) as number[];

    assert.strictEqual(picked.length, 2);
    // Lot 1 is directly adjacent to lot 0, so it must score highest and be picked
    assert.strictEqual(picked[0], 1);
  });
});

describe('Building Heuristics (botBuild)', () => {
  function makeMockState(): GameState {
    return {
      version: 1,
      year: 1,
      phase: 'build',
      players: [
        { id: 0, name: 'You', address: '0x1', cash: 50, tiles: [0, 0, 0, 0, 0, 0] },
        { id: 1, name: 'Sherwood', address: '0x2', cash: 50, tiles: [2, 0, 0, 0, 0, 0] }, // 2 DEX Swap tiles
        { id: 2, name: 'Apex', address: '0x3', cash: 50, tiles: [0, 0, 0, 0, 2, 0] },
        { id: 3, name: 'Luna', address: '0x4', cash: 50, tiles: [0, 2, 0, 0, 0, 0] },
      ],
      lots: Array.from({ length: 72 }, (_, id) => ({
        id,
        displayId: id + 1,
        block: Math.floor(id / 12),
        col: id % 4,
        row: Math.floor((id % 12) / 4),
        owner: null,
        shop: null,
      })),
      bag: [],
      pending: [],
      draftCount: 5,
      logs: [],
      lastIncome: [],
      trades: 0,
    };
  }

  it('prioritizes completing an active shop over starting an isolated one', () => {
    const state = makeMockState();
    // Sherwood owns lots 0, 1, 2, 10
    state.lots[0].owner = 1;
    state.lots[0].shop = 0; // Size 2 DEX Swap on 0 and 1
    state.lots[1].owner = 1;
    state.lots[1].shop = 0;
    state.lots[2].owner = 1; // Adjacent to 1, empty
    state.lots[10].owner = 1; // Isolated empty lot

    const moves = botBuild(1, state) as { lotId: number; shopType: number }[];
    assert.ok(moves.length >= 1);
    // Must place on lot 2 to complete the DEX Swap
    assert.strictEqual(moves[0].lotId, 2);
    assert.strictEqual(moves[0].shopType, 0);
  });

  it('only places tiles in inventory and decrements player inventory', () => {
    const state = makeMockState();
    state.lots[0].owner = 1;
    const initialTiles = state.players[1].tiles[0];

    const moves = botBuild(1, state) as { lotId: number; shopType: number }[];
    assert.strictEqual(moves.length, 1);
    assert.strictEqual(state.players[1].tiles[0], initialTiles - 1);
  });

  it('never places on parcels already containing a shop', () => {
    const state = makeMockState();
    state.lots[0].owner = 1;
    state.lots[0].shop = 0; // Occupied

    const moves = botBuild(1, state) as { lotId: number; shopType: number }[];
    assert.strictEqual(moves.length, 0);
  });
});

describe('Luna loose-tile swap bias', () => {
  function tileSwapState(): GameState {
    const state = createGame();
    for (const p of state.players) p.tiles = [0, 0, 0, 0, 0, 0];
    state.players[0].tiles[1] = 1; // human holds a Memecoin tile
    for (const id of [1, 2, 3]) state.players[id].tiles[2] = 1; // each bot holds a loose Vault tile
    state.phase = 'trade';
    return state;
  }
  const offerTo = (botId: number) => ({
    fromPlayer: 0,
    toPlayer: botId,
    give: { cash: 0, tiles: [0, 1, 0, 0, 0, 0], lots: [] },
    take: { cash: 0, tiles: [0, 0, 1, 0, 0, 0], lots: [] },
  });

  it('values incoming tiles up and loose outgoing tiles down for Luna only', () => {
    const state = tileSwapState();
    const luna = evaluateTradeOffer(offerTo(3), 3, state);
    const rawIn = evaluateOfferSide(offerTo(3).give, state, 3);
    const rawOut = evaluateOfferSide(offerTo(3).take, state, 3);
    assert.ok((luna.valueReceived ?? 0) > rawIn);
    assert.ok((luna.valueSurrendered ?? Infinity) < rawOut);

    const sherwood = evaluateTradeOffer(offerTo(1), 1, state);
    assert.strictEqual(sherwood.valueReceived, evaluateOfferSide(offerTo(1).give, state, 1));
    assert.strictEqual(sherwood.valueSurrendered, evaluateOfferSide(offerTo(1).take, state, 1));
  });

  it('does not discount a tile Luna can still grow a cluster with', () => {
    const state = tileSwapState();
    const lot = state.lots.find((l) => l.owner === null)!;
    lot.owner = 3;
    lot.shop = 2; // open Vault cluster: Luna's Vault tile is no longer loose
    const luna = evaluateTradeOffer(offerTo(3), 3, state);
    assert.strictEqual(luna.valueSurrendered, evaluateOfferSide(offerTo(3).take, state, 3));
  });

  it('makes Luna the easiest bot to close a one-for-one loose tile swap with', () => {
    const state = tileSwapState();
    const required = [1, 2, 3].map((id) => evaluateTradeOffer(offerTo(id), id, state).shortfall);
    assert.strictEqual(required[2], 0, 'Luna accepts the swap');
    assert.ok(required[1] > 0, 'Apex wants a premium');
  });
});
