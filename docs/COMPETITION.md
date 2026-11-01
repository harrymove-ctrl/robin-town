# World is Flat Hackathon: Build with `$wif` on Robinhood Chain

## Competition Overview
Build a product on Robinhood Chain that people keep coming back to. It can be a tool, a hook, an agent, a game, or a market, as long as it puts `$wif` to work inside it and builds a real retention flywheel so using it keeps bringing players back. Build solo or with a team of up to 4, and put `$wif` to work in what you ship, while keeping entry open even for players who do not hold crypto upfront.

## Prize Pool
* **Winner Takes All**: `10,000 USDG` goes to a single winning team, with no second place, paid to the team lead's wallet.
* **Core Evaluation**: Judges and organizers evaluate three pillars: a genuine reason to use `$wif`, a self-reinforcing retention flywheel that holds up under real play, and a polished product that works reliably end to end.

## Timeline
* **Building Starts**: `21 Oct 2026`
* **Submissions Close**: `14 Nov 2026`
* **Final Voting Window**: `14 Nov to 16 Nov 2026`
* **Results Announced**: Right after the final voting window closes

## Chain, Official `$wif` Token, and Smart Contracts
* **Primary Network**: **Robinhood Chain Mainnet (`Chain ID 4663`)** (`https://rpc.mainnet.chain.robinhood.com`, Blockscout explorer at [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com))
* **Testnet Network**: **Robinhood Chain Testnet (`Chain ID 46630`)** (`https://rpc.testnet.chain.robinhood.com`)
* **Official World is Flat (`$wif`) ERC-20 Contract**: [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773) (`World is Flat / WIF`, `18` decimals)
* **Permanent Burn Sink**: [`0x000000000000000000000000000000000000dEaD`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773?tab=holders) (`113,917.82+ $wif` verified burned on-chain via `/api/onchain-wif`)
* **Harbor Vault Contract**: [`contracts/RobinTownHarborVault.sol`](../contracts/RobinTownHarborVault.sol) (`stakeWif`, `unstakeWif`, `patronizeDistrict`, `enterRankedHarbor`)
* **Ecosystem References**: [worldisflat.fun](https://worldisflat.fun), [worldisflat.fun/build](https://worldisflat.fun/build), [worldisflat.fun/fair/](https://worldisflat.fun/fair/), and [Pons Launchpad](https://www.ponsfamily.com/launchpad/0x5173b8eA6923c2d40267890D45C46a3480954773)

## Categories and Robin Town Alignment
* **Games**: Full 6-year (`Snake`, `Horse`, `Goat`, `Monkey`, `Rooster`, `Dog`) street negotiation and neighborhood business board game across 72 numbered plots in **6 harbor districts** (`Sherwood`, `Clocktower`, `Harborview`, `Lantern Hall`, `Grand Market`, `Maple Lane`) and **6 neighborhood storefront types** (`Coffee House`, `Corner Bakery`, `Noodle Kitchen`, `Flower Studio`, `Silk Tailor`, `Corner Grocer`). Supports instant switching between the WebGL Three.js **3D Harbor Diorama** (`Day`, `Sunset`, `Night`), illustrated `2D`, and `3D Tilt` views, cross-device RFC 6455 WebSocket rooms (`?room=CODE6X`), and deterministic UTC **Daily Harbor Seeds** (`📅 Daily Seed`) with multi-day streak multipliers (`1.1x` to `1.5x`).
* **Hooks, Vaults, and DeFi**: Deterministic `$wif` retention flywheel combining a **3% Point-to-`$wif` conversion burn** (`10 pts = 1 $wif`), **Ranked `1,000 $wif` Arena** tables (`4,000 $wif` pool: `90%` top-3 podium `50% / 25% / 15%`, `5%` permanent burn to `0x000000000000000000000000000000000000dEaD`, `5%` to the Staking Vault), a **1.20x `$wif` Staking Payday Multiplier** (`500 $wif` locked), a **1% OTC Bargaining Table cash micro-fee** routed to stakers, and on-chain vault mechanics in [`contracts/RobinTownHarborVault.sol`](../contracts/RobinTownHarborVault.sol).
* **Agents and AI**: 4-seat harbor tables where `You` haggle against autonomous neighborhood AI traders (`Cole`, `Maya`, and `Clara`) that price connected shophouse cluster synergies, draft street plots, and negotiate multi-asset bundles of `$wif` cash, land deeds, and storefront tiles at the two-way OTC Bargaining Table.
* **Zero-Friction Onboarding and Dual-Mode Wallet**: Anyone can play Casual Town immediately for free or test full tokenomics with **4 pre-funded `10,000 $wif` simulation seats**, then connect **MetaMask or Rabby (EIP-1193)** on **Robinhood Chain Mainnet (`Chain ID 4663`)** (with **Testnet `Chain ID 46630`** support) featuring gasless **EIP-191 `personal_sign`** wallet ownership verification (`POST /api/wallets/verify`) and live on-chain `eth_getTransactionReceipt` `$wif` burn and transfer receipt verification (`POST /api/wallets/tx`) with Blockscout proof links.

## How Judging Works
1. Every submission is reviewed by the organizers, and approved submissions advance to voting.
2. Judges vote for their top projects while the community votes using `$wif` (counting as one additional judge). The 10 projects with the highest combined support advance as finalists.
3. Judges and the community vote again across the 10 finalists during the **14 Nov to 16 Nov 2026** final voting window, and the finalist with the most votes wins the `10,000 USDG` prize.
4. Every `$wif` token used in community governance and hackathon voting is permanently burned.
