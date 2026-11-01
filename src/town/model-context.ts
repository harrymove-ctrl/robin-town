import { holdings, evaluateOffer, trade } from './engine';
import type { GameState, TradeOffer } from './types';
import type { GameAudio, SoundEffect } from './audio';

/** The optional browser tool API; the game also runs in browsers without it. */
interface ModelTool<Input> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: Input) => unknown;
}

declare global {
  interface Document {
    modelContext?: {
      registerTool<Input>(tool: ModelTool<Input>, options: { signal: AbortSignal }): unknown;
    };
  }
}

interface GameToolActions {
  getState: () => GameState;
  claim: (ids: number[]) => void;
  startBuild: () => void;
  buildPiece: (id: number, shop: number) => unknown;
  act: (action: string) => void;
  changed: () => void;
  playSound: (sound: SoundEffect) => void;
  speak: GameAudio['speak'];
  onTradeTax?: (taxAmount: number) => void;
}

export function registerGameTools({
  getState,
  claim,
  startBuild,
  buildPiece,
  act,
  changed,
  playSound,
  speak,
  onTradeTax,
}: GameToolActions): void {
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    const register = <Input>(tool: ModelTool<Input>) => {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_neighborhood_state',
      description:
        'Read the local Robin-Town game: phase, players, plots, shop tiles, and offered addresses.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => structuredClone(getState()),
    });
    register({
      name: 'claim_neighborhood_plots',
      description:
        'Complete the Receive phase by claiming the required number of offered plots. Plot IDs are zero-based.',
      inputSchema: {
        type: 'object',
        properties: { plotIds: { type: 'array', items: { type: 'integer' }, uniqueItems: true } },
        required: ['plotIds'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: { plotIds: number[] }) => {
        claim(input.plotIds);
        return { phase: getState().phase, ownedPlots: holdings(getState(), 0).map((l) => l.id) };
      },
    });
    register({
      name: 'start_neighborhood_build',
      description: 'Close trading for this year and start the Build phase.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        startBuild();
        return { phase: getState().phase };
      },
    });
    register({
      name: 'place_neighborhood_shop',
      description:
        'Permanently place one shop tile on your empty plot during Build. Plot IDs and shop indices are zero-based.',
      inputSchema: {
        type: 'object',
        properties: { plotId: { type: 'integer' }, shopIndex: { type: 'integer' } },
        required: ['plotId', 'shopIndex'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: { plotId: number; shopIndex: number }) => {
        return buildPiece(input.plotId, input.shopIndex);
      },
    });
    register({
      name: 'collect_neighborhood_income',
      description:
        'Finish building, let computer neighbors build, and collect this year business income in $wif.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        act('confirm-collect');
        return {
          year: getState().year,
          phase: getState().phase,
          income: getState().lastIncome,
          balances: getState().players.map((p) => p.cash),
        };
      },
    });
    register({
      name: 'advance_neighborhood_year',
      description:
        'After payday, turn the calendar page and receive the next year offered addresses and shop pieces.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        act('next');
        return {
          year: getState().year,
          phase: getState().phase,
          offeredPlots: getState().pending,
          keep: getState().draftCount,
        };
      },
    });
    const sideSchema = {
      type: 'object',
      properties: {
        cash: { type: 'integer', minimum: 0 },
        tiles: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 6, maxItems: 6 },
        lots: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 71 },
          uniqueItems: true,
        },
      },
      required: ['cash', 'tiles', 'lots'],
      additionalProperties: false,
    };
    const offerSchema = {
      type: 'object',
      properties: {
        partner: { type: 'integer', minimum: 1, maximum: 3 },
        give: sideSchema,
        take: sideSchema,
      },
      required: ['partner', 'give', 'take'],
      additionalProperties: false,
    };
    register({
      name: 'quote_neighborhood_trade',
      description:
        'Ask a computer neighbor whether a proposed package of $wif, shop tiles, and plots would be accepted.',
      inputSchema: offerSchema,
      annotations: { readOnlyHint: true },
      execute: (input: TradeOffer) => evaluateOffer(getState(), input),
    });
    register({
      name: 'propose_neighborhood_trade',
      description:
        'Propose a package of $wif, shop tiles, and plots to a computer neighbor.',
      inputSchema: offerSchema,
      annotations: { readOnlyHint: false },
      execute: (input: TradeOffer) => {
        const result = trade(getState(), input);
        if (result.accepted) {
          if (result.taxAmount) onTradeTax?.(result.taxAmount);
          changed();
          playSound('deal');
          speak('positive', input.partner);
        } else {
          playSound('reject');
          speak('negative', input.partner);
        }
        return result;
      },
    });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
}
