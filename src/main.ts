/**
 * src/main.ts
 *
 * Web entry point for Robin Town.
 * Mounts the full Chinatown-inspired tabletop & street-life board game built for
 * Robinhood Chain ($wif flywheel, dual-mode wallet, online rooms, 3D Tabletop Tilt,
 * Three.js 3D City mode, SolaceUI exposure-grid shader, Apple Carousel, and iPod Classic).
 */

import './styles/saigon/index.css';
import { mountRobinTown } from './town/robin-town-ui';

mountRobinTown();
