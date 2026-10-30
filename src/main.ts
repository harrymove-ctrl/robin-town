/**
 * src/main.ts
 *
 * Web entry point for robin-town.
 * Initializes the RobinTownApp coordinator and mounts the game shell.
 */

import './styles/index.css';
import { RobinTownApp } from './app';

console.log('[robin-town] Initializing game application...');

const appContainer = document.getElementById('app');
if (appContainer) {
  const game = new RobinTownApp(appContainer);
  console.log('[robin-town] Game application mounted successfully.');

  // Attach game instance to window for interactive debugging if in browser
  if (typeof window !== 'undefined') {
    (window as unknown as { robinTownGame: RobinTownApp }).robinTownGame = game;
  }
} else {
  console.error('[robin-town] Root #app container not found in document.');
}
