/**
 * src/main.ts
 *
 * Web entry point for robin-town.
 * Initializes the RobinTownApp coordinator and mounts the game shell.
 */

import './styles/index.css';
import { RobinTownApp } from './app';
import { parseSeedParam } from './engine/rng';

console.log('[robin-town] Initializing game application...');

const appContainer = document.getElementById('app');
if (appContainer) {
  // ?seed=<n> makes deals, bot drafts and tile draws reproducible (QA screenshots).
  const seed = parseSeedParam(window.location.search);
  const game = new RobinTownApp(appContainer, seed !== null ? { seed } : {});
  if (seed !== null) console.log(`[robin-town] Deterministic match: seed ${seed}`);
  console.log('[robin-town] Game application mounted successfully.');

  // Attach game instance to window for interactive debugging if in browser
  if (typeof window !== 'undefined') {
    (window as unknown as { robinTownGame: RobinTownApp }).robinTownGame = game;
  }
} else {
  console.error('[robin-town] Root #app container not found in document.');
}
