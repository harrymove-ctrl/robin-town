# Thematic Mapping: Chinatown and Saigon-Town to Robin-Town

## 1. Overview and Design Philosophy
Robin-Town adapts the tactical negotiation dynamics of Chinatown and the digital architecture of saigon-town into a retro-cyberpunk Web3 metropolis. Set within the Robinhood Chain ecosystem, robin-town transforms traditional food stalls and urban properties into decentralized finance protocol modules and digital parcels.

The design philosophy emphasizes four pillars:
1. Complete Mathematical Parity: The underlying 72-parcel geometry, six-district topology, six shop categories, 120-tile pool, and non-linear payout curves remain mathematically identical to the proven balance of Chinatown and saigon-town.
2. English Web3 Immersion: All terminology, dialogue, and UI elements are translated into English fintech and crypto concepts with zero remaining non-English strings.
3. Deflationary $wif Economy: In-game transactions, buy-in match pools, and point redemptions are denominated in $wif, Robinhood Chain's memecoin mascot, incorporating burn sinks that align with hackathon requirements.
4. Expressive AI Archetypes: Tabletop negotiation partners are re-imagined as distinct market participants ranging from retail yield farmers to institutional prop trading sharks.

---

## 2. Comparative Thematic Matrix

| Dimension | Chinatown Tabletop Game | Saigon-Town Digital Game | Robin-Town Web3 Adaptation |
|---|---|---|---|
| Setting & World | 1960s New York Chinatown | Vibrant Contemporary Ho Chi Minh City | Retro-Cyberpunk Web3 Metropolis |
| Primary Currency | Fictional Paper Dollars ($) | Vietnamese Dong (đ) | $wif Token (Robinhood Chain Mascot) |
| Secondary Unit | Victory Cash Rankings | Score Points & Leaderboard | USDG Treasury Points & On-Chain Rewards |
| City Divisions | 6 Urban Blocks (85 Spaces) | 6 Urban Districts (72 Lots) | 6 Financial Districts (72 Parcels) |
| Land Deed Cards | Paper Building Cards | Thẻ Đất (Deed Cards) | Parcel Allocation Deeds |
| Storefront Assets | Cardboard Building Tiles | Mảnh Tiệm (Shop Tiles) | Protocol Modules (DApp Tiles) |
| Ownership Markers | Colored Wooden Discs | Ghế Đẩu (Plastic Stools) | Validator Beacons (Neon Laser Discs) |
| Phase 1 | Deal Building Cards | Nhận Mặt Bằng (Draft Land) | Parcel Allocation Phase |
| Phase 2 | Draw Shop Tiles | Bốc Mảnh (Tile Draw) | Protocol Liquidity Draw |
| Phase 3 | Open Negotiation & Trades | Thương Lượng (Bargaining) | OTC Liquidity Desk (Peer-to-Peer Trades)|
| Phase 4 | Place Building Tiles | Mở Tiệm (Shop Placement) | Protocol Deployment Phase |
| Phase 5 | Collect Income (Payday) | Thu Tiền (Yield Harvest) | Yield Harvest Phase |
| Game Length | 6 Discrete Years | 6 Vòng Chơi (6 Years) | 6 Sequential Epochs |
| Negotiation Desk | Physical Table Chatter | Bàn Thương Lượng Modal Desk | Bilateral OTC Liquidity Desk |
| AI Opponents | None (Tabletop Human Only) | Linh, Minh, An (Vietnamese Personas)| Sherwood, Apex, Luna (Crypto Archetypes)|
| Acceptance Stamp | Verbal Agreement / Handshake| CHỐT! Red Rubber Stamp | FILLED! Neon Holographic Execution Stamp|

---

## 3. The 6 Property Districts

### 3.1 District Overview Table

| District ID | Block Index | District Name | Plot Indices (0-based) | UI Numbers (1-based) | Accent Color | Primary Landmark & Aesthetic |
|---|---|---|---|---|---|---|
| 0 | Block 0 | Robinhood District | Lots 0 to 11 | Lots 1 to 12 | `#00C805` | Robinhood Tower, Sherwood Retail Archway |
| 1 | Block 1 | Wall Street Quarter | Lots 12 to 23 | Lots 13 to 24 | `#EEC353` | Bullion Exchange, Golden Bull Statue |
| 2 | Block 2 | Crypto Wharf | Lots 24 to 35 | Lots 25 to 36 | `#29B6F6` | Subsea Cable Terminal, ASIC Shipping Docks |
| 3 | Block 3 | Silicon Strip | Lots 36 to 47 | Lots 37 to 48 | `#AB47BC` | Open-Source Foundry, VC Incubator Spire |
| 4 | Block 4 | Memecoin Boulevard | Lots 48 to 59 | Lots 49 to 60 | `#FF7043` | Dogwifhat Monument, Prediction Arcade |
| 5 | Block 5 | DeFi Citadel | Lots 60 to 71 | Lots 61 to 72 | `#455A64` | Consensus Monolith, Cold Storage Spire |

### 3.2 District Coordinate Layout and Adjacency Graph
The board uses an irregular grid system with orthogonal adjacency isolated within each district block:
* Total Canvas Dimensions: 1100 pixels wide by 730 pixels high.
* Parcel Dimensions: Cell width 50px, cell height 50px, cell pitch 52px (including a 2px inner gutter).
* Orthogonal Connectivity Invariant: Parcels connect if and only if they share a block index and satisfy `Math.abs(colA-colB) + Math.abs(rowA-rowB) === 1`. Street channels separate districts, preventing any cross-district connections.

Block Offsets and Parcel Coordinates:
1. Block 0 (Robinhood District): Offset x: 92, y: 100.
   * Row 0: cols 1, 2, 3 (Lots 0, 1, 2)
   * Row 1: cols 0, 1, 2, 3 (Lots 3, 4, 5, 6)
   * Row 2: cols 0, 1, 2 (Lots 7, 8, 9)
   * Row 3: cols 0, 1 (Lots 10, 11)
2. Block 1 (Wall Street Quarter): Offset x: 399, y: 105.
   * Row 0: cols 0, 1 (Lots 12, 13)
   * Row 1: cols 0, 1, 2 (Lots 14, 15, 16)
   * Row 2: cols 0, 1, 2, 3 (Lots 17, 18, 19, 20)
   * Row 3: cols 1, 2, 3 (Lots 21, 22, 23)
3. Block 2 (Crypto Wharf): Offset x: 747, y: 120.
   * Row 0: cols 0, 1, 2 (Lots 24, 25, 26)
   * Row 1: cols 0, 1, 2 (Lots 27, 28, 29)
   * Row 2: cols 0, 1, 2, 3 (Lots 30, 31, 32, 33)
   * Row 3: cols 2, 3 (Lots 34, 35)
4. Block 3 (Silicon Strip): Offset x: 156, y: 439.
   * Row 0: cols 1, 2 (Lots 36, 37)
   * Row 1: cols 1, 2, 3 (Lots 38, 39, 40)
   * Row 2: cols 0, 1, 2 (Lots 41, 42, 43)
   * Row 3: cols 0, 1, 2, 3 (Lots 44, 45, 46, 47)
5. Block 4 (Memecoin Boulevard): Offset x: 464, y: 404.
   * Row 0: cols 0, 1, 2, 3 (Lots 48, 49, 50, 51)
   * Row 1: cols 0, 1, 2 (Lots 52, 53, 54)
   * Row 2: cols 0, 1 (Lots 55, 56)
   * Row 3: cols 0, 1, 2 (Lots 57, 58, 59)
6. Block 5 (DeFi Citadel): Offset x: 796, y: 451.
   * Row 0: cols 1, 2, 3 (Lots 60, 61, 62)
   * Row 1: cols 0, 1, 2, 3 (Lots 63, 64, 65, 66)
   * Row 2: cols 0, 1 (Lots 67, 68)
   * Row 3: cols 0, 1, 2 (Lots 69, 70, 71)

### 3.3 District Architectural Lore and Descriptions

#### District 0: Robinhood District
The retail heartbeat of robin-town, illuminated by vibrant green tickertapes and glowing neon banners. Situated in the northwest sector, the district features the towering Robinhood Headquarters, the Sherwood Archway, and open brokerage cafes. Community retail investors gather here to claim their first allocations, trade commission-free equities, and bootstrap grassroots liquidity pools.

#### District 1: Wall Street Quarter
The institutional bastion of high-frequency capital. Imposing neoclassical colonnades of polished marble are interwoven with fiber-optic ticker feeds, algorithmic market-making servers, and gold bullion vaults. The Golden Bull Statue stands proudly in the central plaza, where prop trading desks and hedge fund managers execute split-second liquidity squeezes.

#### District 2: Crypto Wharf
An industrial deep-water port transformed into a high-density cryptographic shipping dock. Massive containerized ASIC mining rigs hum along the piers, cooled by coastal ocean breezes. Fiber-optic subsea cables make landfall here, establishing high-bandwidth connections to global exchanges while offshore barges handle bulk token settlements.

#### District 3: Silicon Strip
The innovation corridor for smart contract engineers, protocol founders, and venture capitalists. Sleek glass towers house decentralized autonomous organizations, compiler labs, and open-source incubators under electric violet spotlights. Hackers sit at outdoor espresso bars drafting decentralized governance proposals and deploying novel token models.

#### District 4: Memecoin Boulevard
A nonstop carnival of viral retail speculation and internet community culture. Adorned with holographic doges, oversized pink beanies, and 24/7 prediction kiosks, the boulevard is where small balances turn into exponential windfalls. Music, memes, and community energy pulse through every parcel.

#### District 5: DeFi Citadel
A fortified, monolithic district dedicated to foundational blockchain infrastructure. Massive brutalist server fortresses operate proof-of-stake validator clusters, multi-sig cold storage facilities, and autonomous lending pools. The central Consensus Monolith coordinates the cryptographic state of the entire robin-town economy.

---

## 4. The 6 Protocol Shop Categories

### 4.1 Protocol Specifications Table

| Category Index | Protocol Name | Code | Size Target | Color Hex | Bag Quota | Incomplete Tier Payouts | Complete Tier Payout | Lifetime Yield (Built Epoch 1) |
|---|---|---|---|---|---|---|---|---|
| 0 | DEX Swap | DX | 3 | `#39A883` | 20 tiles | 1: 10, 2: 20 $wif | 3: 50 $wif | 300 $wif (6 x 50) |
| 1 | Memecoin Lounge | ML | 3 | `#EEC353` | 20 tiles | 1: 10, 2: 20 $wif | 3: 50 $wif | 300 $wif (6 x 50) |
| 2 | Staking Vault | SV | 4 | `#B85539` | 20 tiles | 1: 10, 2: 20, 3: 40 $wif | 4: 80 $wif | 480 $wif (6 x 80) |
| 3 | Lending Protocol | LP | 4 | `#A16586` | 20 tiles | 1: 10, 2: 20, 3: 40 $wif | 4: 80 $wif | 480 $wif (6 x 80) |
| 4 | Derivatives Exchange | DE | 5 | `#587C9A` | 20 tiles | 1: 10, 2: 20, 3: 40, 4: 60 $wif | 5: 110 $wif | 660 $wif (6 x 110) |
| 5 | Validator Citadel | VC | 6 | `#648454` | 20 tiles | 1: 10, 2: 20, 3: 40, 4: 60, 5: 80 $wif | 6: 140 $wif | 840 $wif (6 x 140) |

### 4.2 Complete Non-Linear Payout Matrix
Payouts are calculated per connected orthogonal cluster:
`groupIncome(shop, count) = Math.floor(count / target) * COMPLETE[target] + INCOMPLETE[count % target]`

| Connected Cluster Size | DEX Swap (Target 3) | Memecoin Lounge (Target 3) | Staking Vault (Target 4) | Lending Protocol (Target 4) | Derivatives Exchange (Target 5) | Validator Citadel (Target 6) |
|---|---|---|---|---|---|---|
| 1 tile | 10 $wif | 10 $wif | 10 $wif | 10 $wif | 10 $wif | 10 $wif |
| 2 tiles | 20 $wif | 20 $wif | 20 $wif | 20 $wif | 20 $wif | 20 $wif |
| 3 tiles | 50 $wif (Complete) | 50 $wif (Complete) | 40 $wif | 40 $wif | 40 $wif | 40 $wif |
| 4 tiles | 60 $wif (1x + 1) | 60 $wif (1x + 1) | 80 $wif (Complete) | 80 $wif (Complete) | 60 $wif | 60 $wif |
| 5 tiles | 70 $wif (1x + 2) | 70 $wif (1x + 2) | 90 $wif (1x + 1) | 90 $wif (1x + 1) | 110 $wif (Complete) | 80 $wif |
| 6 tiles | 100 $wif (2x Complete)| 100 $wif (2x Complete)| 100 $wif (1x + 2) | 100 $wif (1x + 2) | 120 $wif (1x + 1) | 140 $wif (Complete) |
| 7 tiles | 110 $wif (2x + 1) | 110 $wif (2x + 1) | 120 $wif (1x + 3) | 120 $wif (1x + 3) | 130 $wif (1x + 2) | 150 $wif (1x + 1) |
| 8 tiles | 120 $wif (2x + 2) | 120 $wif (2x + 2) | 160 $wif (2x Complete)| 160 $wif (2x Complete)| 150 $wif (1x + 3) | 160 $wif (1x + 2) |
| 9 tiles | 150 $wif (3x Complete)| 150 $wif (3x Complete)| 170 $wif (2x + 1) | 170 $wif (2x + 1) | 170 $wif (1x + 4) | 180 $wif (1x + 3) |
| 10 tiles | 160 $wif (3x + 1) | 160 $wif (3x + 1) | 180 $wif (2x + 2) | 180 $wif (2x + 2) | 220 $wif (2x Complete)| 200 $wif (1x + 4) |
| 11 tiles | 170 $wif (3x + 2) | 170 $wif (3x + 2) | 200 $wif (2x + 3) | 200 $wif (2x + 3) | 230 $wif (2x + 1) | 220 $wif (1x + 5) |
| 12 tiles | 200 $wif (4x Complete)| 200 $wif (4x Complete)| 240 $wif (3x Complete)| 240 $wif (3x Complete)| 240 $wif (2x + 2) | 280 $wif (2x Complete)|

### 4.3 Protocol Category Profiles and Economic Function

#### DEX Swap (DX, Size 3)
* Theme: Automated Market Maker Liquidity Pool.
* Role: Fast assembly, high early-game yield. Because it requires only 3 tiles to complete, players can unlock the 50 $wif complete payout as early as Epoch 1 or 2, providing immediate working capital to fund future parcel purchases.
* Visual Cue: Mint green storefront with luminous circulating arrow holograms.

#### Memecoin Lounge (ML, Size 3)
* Theme: Community Speculation and Meme Trading Club.
* Role: Symmetrical alternative to the DEX Swap. Excellent entry point for retail trading strategies. Highly liquid, actively traded between players seeking rapid set completions.
* Visual Cue: Warm golden storefront with neon pink accents and shiba inu silhouettes.

#### Staking Vault (SV, Size 4)
* Theme: Proof-of-Stake Validator Escrow.
* Role: Medium footprint protocol requiring 4 connected tiles to hit 80 $wif yield. Staking vaults form the backbone of mid-game earnings, offering an attractive return on capital when assembled by Epoch 3.
* Visual Cue: Heavy bronze reinforced vault door with glowing cryptographic lock indicators.

#### Lending Protocol (LP, Size 4)
* Theme: Collateralized Liquidity Market.
* Role: Strategic counterpart to the Staking Vault. Requires 4 parcels, rewarding disciplined urban planners who secure contiguous rectangular lots in early drafting phases.
* Visual Cue: Rich amethyst purple glass facade with digital balance scale motifs.

#### Derivatives Exchange (DE, Size 5)
* Theme: Perpetual Futures and Synthetic Asset Exchange.
* Role: High-risk, high-reward protocol. Demanding 5 contiguous parcels, it is difficult to build without active multi-party trades. Once complete, its 110 $wif annual yield generates commanding cash flow.
* Visual Cue: Deep ocean-blue high-tech terminal adorned with multi-tiered candlestick charts.

#### Validator Citadel (VC, Size 6)
* Theme: Layer 1 Sovereign Consensus Spire.
* Role: The grand monopoly of robin-town. Requires 6 parcels to unlock the 140 $wif maximum annual payout. Assembling a Validator Citadel represents a dominant spatial achievement that frequently seals match victory.
* Visual Cue: Monumental slate fortress with glowing emerald power conductors and server arrays.

---

## 5. Comprehensive Translation Glossary

### 5.1 Core System and Economic Concepts

| Vietnamese Term | Chinatown Tabletop Concept | Robin-Town Web3 Term | In-Game Definition and Purpose |
|---|---|---|---|
| Năm (Năm 1 đến 6) | Round / Year (Years 1 to 6) | Epoch (Epochs 1 to 6) | Six sequential game cycles governing match progression |
| Sài Gòn | New York Chinatown | Robin-Town | The retro-cyberpunk Web3 metropolis |
| đ (Đồng) | Fictional Dollars ($) | $wif | Primary in-game currency unit for buy-ins, trading, and scoring |
| Điểm tích luỹ | Victory Points | USDG Treasury Points | Off-chain loyalty score redeemable for tokens |
| Ghế đẩu | Wooden Ownership Disc | Validator Beacon | Neon player marker placed on claimed parcels |
| Mặt bằng / Lô | Board Lot / Street Space | District Parcel | Numbered physical grid spaces (1 to 72) |
| Mảnh tiệm | Building Shop Tile | Protocol Module / DApp Tile | Square building tiles placed onto parcels |
| Thẻ đất | Building Card | Allocation Deed | Deed card dealt in Phase 1 determining draftable parcels |
| Túi vải | Linen Tile Bag | Deployment Pool | Draw bag containing the 120 protocol tiles |
| Kho / Mảnh trong kho | Hand / Tile Rack | Asset Inventory | Player hardware wallet holding unplaced tiles |
| Sổ tiệm / Sổ thu | Business Ledger | Yield Ledger | Financial dashboard displaying business earnings |
| Lịch năm Sài Gòn | Year Calendar | Epoch Almanac | Retro calendar tracking epochs and match progress |
| Con giáp | Zodiac Animal Token | Market Regime Token | Graphic celebrating the start of each new epoch |

### 5.2 5-Phase Round Lifecycle Progression

| Phase Index | Vietnamese Phase Name | Chinatown Phase Name | Robin-Town Official Name | Player Action and Objective |
|---|---|---|---|---|
| Phase 1 | Nhận mặt bằng | Deal Building Cards | Allocation Phase | Draft parcels using dealt Allocation Deeds |
| Phase 2 | Bốc mảnh | Draw Shop Tiles | Liquidity Draw | Blindly draw protocol modules from deployment pool |
| Phase 3 | Thương lượng | Free Trading & Negotiation | OTC Trading Phase | Negotiate asset swaps with bots and players on OTC desk |
| Phase 4 | Mở tiệm | Place Shop Tiles | Deployment Phase | Permanently deploy matching modules onto empty parcels |
| Phase 5 | Thu tiền / Payday | Collect Income | Yield Harvest | Collect annual $wif yield from active protocols |
| Final | Tổng kết | End-Game Scoring | Final Settlement | Total cash balance and crown sovereign champion |

### 5.3 OTC Negotiation Desk and Bargaining Dialogue

| Vietnamese String | Saigon-Town English String | Robin-Town Official English Translation | Context and Location |
|---|---|---|---|
| Bàn thương lượng | The Bargaining Table | OTC Liquidity Desk | Negotiation modal header |
| Có qua có lại | Let's make a deal | Bilateral Liquidity Desk | Modal subtitle |
| Bạn đưa | You give | Outgoing Offer | Left escrow column |
| [Tên] đưa | [Partner] gives | Incoming Request | Right escrow column |
| Đồ đã chọn | Selected offer | Staged Assets | Escrow staging tray |
| Chạm đồ bên dưới để đặt lên bàn | Tap items below to offer them | Tap items below to stage in escrow | Empty tray placeholder text |
| Tiền / Bớt tiền / Thêm tiền | Cash / Less cash / More cash | $wif Capital / Less $wif / More $wif | Currency stepper controls (-10 / +10) |
| MẢNH TIỆM · CHẠM ĐỂ THÊM | SHOP PIECES · TAP TO ADD | PROTOCOL MODULES · TAP TO STAGE | Inventory grid section header |
| MẶT BẰNG · KÈM TIỆM ĐÃ XÂY | ADDRESSES · BUILT SHOPS INCLUDED | DISTRICT PARCELS · ACTIVE PROTOCOLS INCLUDED | Property list section header |
| Lô X | Plot X | Parcel X | Property identifier tag |
| Chưa có mặt bằng | No addresses yet | No parcels owned | Empty parcel notice |
| Chọn hàng xóm | Choose a neighbor | Select Counterparty | Counterparty tab bar |
| Dễ thương | Neighborly | Cooperative | Sherwood partner tag |
| Sành giá | Sharp | High-Frequency | Apex partner tag |
| Thoải mái | Easygoing | Liquid | Luna partner tag |
| CHỐT! | DEAL! | FILLED! | Accepted trade execution stamp |
| Chốt đơn! Tiền và tài sản đã đổi chủ | Deal sealed. Your items have changed hands | Order filled. Assets and capital transferred | Trade confirmation banner |
| Buôn có bạn, bán có phường | A good neighbor is good for business | Liquidity thrives on deep markets | Trade confirmation flavor text |
| Bàn tiếp nào | Another deal | New Order | Button to initiate follow-up trade |
| Về phố | Back to town | Return to Board | Button to close trade desk |
| Để nghĩ chút nha… | Thinking it over… | Evaluating order routing… | Bot thinking indicator |
| Vậy nha, chốt không? | How about this? | Broadcast Offer | Primary trade submission button |
| Hừm… để tính chút coi nào | Hmm… let me count that up | Calculating expected value and spread… | Bot speech bubble when calculating |
| Suýt được rồi! Thêm X đ đi | Close! Add X đ, or show me a different package | Valuation shortfall. Add X $wif spread to bridge gap | Bot counteroffer speech bubble |
| Nghe hợp lý hơn rồi đó. Chốt luôn không? | That looks better. Ready to shake on it? | Spread covered. Ready to broadcast transaction | Bot revised acceptance dialogue |
| Thêm X đ | Add X đ | Top Up X $wif | Instant counteroffer button |

### 5.4 Deployment and Building HUD

| Vietnamese String | Saigon-Town English String | Robin-Town Official English Translation | Context and Location |
|---|---|---|---|
| Khai trương thôi! | Open for business | Deploy Protocols | Build phase banner title |
| Mảnh tiệm trong kho | Your shop pieces | Unplaced Protocol Modules | Inventory drawer header |
| Mở tiệm tại đây | Open here | Deploy Module Here | Plot context menu action |
| Mở rộng tiệm này | Continue this business | Expand Protocol Cluster | Adjacency build action |
| Kho chưa có mảnh phù hợp | No matching pieces in your rack | No matching modules in inventory | Build warning tooltip |
| Liền kề / Chung cạnh | Connected / Shared edge | Orthogonally Adjacent | Rule explanation note |
| Đủ bộ khi có X tiệm liền kề | Complete with X connected shops | Full synergy tier achieved at X parcels | Shop target badge |
| Sắp thu X đ | Next payday X đ | Projected Harvest X $wif | Real-time yield estimate badge |
| Xong rồi, thu tiền | Finish & collect | Confirm Deployments & Harvest Yield | Phase completion button |

### 5.5 Yield Harvest, Almanac, and Final Settlement

| Vietnamese String | Saigon-Town English String | Robin-Town Official English Translation | Context and Location |
|---|---|---|---|
| Một năm buôn may bán đắt | A good year in the neighborhood | Epoch Consensus Reached | Harvest banner headline |
| Các tiệm mang về X đ | Your shops brought in X đ | Protocol network generated X $wif yield | Harvest earnings line |
| Sổ thu | Earnings | Yield Ledger | Earnings detail modal button |
| Sang năm X | Welcome year X | Advance to Epoch X | Next epoch advance button |
| Tổng kết | Finale | Final Settlement | End of match transition screen |
| Bảng xếp hạng | Rankings | Trader Leaderboard | Final match standings table |
| Người chiến thắng | Winner | Sovereign Trader | Podium first place title |

---

## 6. AI Bot Trader Profiles and Heuristics

### 6.1 Bot Trader Overview Table

| Bot Name | Replaces Bot | Archetype & Title | Visual Avatar | Acceptance Margin | Preferred Strategy | Dialogue Style |
|---|---|---|---|---|---|---|
| Sherwood | Linh | Conservative Yield Seeker | Cyber Hooded Archer with green visor | 1.04 (4% surplus) | Size 3 & 4: DEX Swap, Staking Vault | Collaborative, polite, community-focused |
| Apex | Minh | High-Frequency Arbitrage Shark | Wall Street Bull in navy pinstripe suit | 1.09 (9% to 12% surplus) | Size 5 & 6: Derivatives, Validator Citadel | Aggressive, sharp, quantitative |
| Luna | An | Liquid Market Maker | Shiba Inu in pink dogwifhat beanie | 1.01 (1% surplus) | Rapid asset turnover, flexible builds | Playful, fast-moving, liquidity-focused |

### 6.2 Trader Profiles and Dialogue Scripts

#### Sherwood (The Conservative Yield Seeker)
* Background: Sherwood represents grassroots retail investors and decentralized community builders. He focuses on steady, predictable compounding yield and avoids prolonged standoffs.
* Negotiation Strategy: Actively pursues complete sets of smaller protocols (DEX Swaps and Staking Vaults) in District 0 and District 2. Readily parts with single large tiles (Size 5 or 6) if offered matching pieces that complete an active business this epoch.
* Acceptance Margin: 1.04. Sherwood requires an offer value equal to at least 104% of the value he gives away.
* Dialogue Lines:
  * Greeting: "Welcome to Sherwood. Let us construct sustainable liquidity together."
  * Thinking: "Evaluating yield projections on this swap..."
  * Accepted: "Transaction confirmed! A fair deal for both our portfolios."
  * Counteroffer: "Almost balanced, anon. Add a few more $wif to bridge the valuation spread."
  * Rejection: "The yield metrics do not align. Let us revisit when the market shifts."

#### Apex (The High-Frequency Arbitrage Shark)
* Background: Apex is an institutional quantitative prop trader backed by Wall Street capital. He treats negotiation as a zero-sum liquidity squeeze, aggressively buying up key corner parcels to extort opponents seeking monopolies.
* Negotiation Strategy: Corners high-capacity districts (Wall Street Quarter and DeFi Citadel) and hoards bottleneck tiles for Derivatives Exchanges and Validator Citadels. Never concedes an essential plot without demanding a steep cash premium.
* Acceptance Margin: 1.09. Demands between 9% and 12% profit surplus on every transaction.
* Dialogue Lines:
  * Greeting: "Time is gas. Bring me genuine alpha or do not trade."
  * Thinking: "Calculating risk-adjusted return and order book depth..."
  * Accepted: "Arbitrage confirmed. Transaction executed at maximum efficiency."
  * Counteroffer: "Negative expected value on my end. Cover my shortfall or stay sidelined."
  * Rejection: "Unacceptable spread. I do not subsidize retail mistakes."

#### Luna (The Liquid Market Maker)
* Background: Luna is a playful yet razor-sharp algorithmic market maker who believes idle inventory is dead capital. Her goal is rapid capital velocity and maximum portfolio turnover.
* Negotiation Strategy: Flexible and opportunistic. Luna trades across all six protocol categories, rarely holding onto unplaced tiles for more than one epoch. She is the easiest partner to initiate deals with, often willing to accept 1-for-1 tile trades with minimal cash top-ups.
* Acceptance Margin: 1.01. Operates near absolute parity, requiring only a 1% valuation surplus.
* Dialogue Lines:
  * Greeting: "Pull up a terminal! Deep liquidity makes everyone wealthy."
  * Thinking: "Balancing liquidity pools and inventory turnover..."
  * Accepted: "Order filled! Capital velocity is all that matters."
  * Counteroffer: "Just a tiny sliver short on valuation. Match the baseline and it is yours."
  * Rejection: "Too illiquid for my books right now. Give me something that flows."

### 6.3 Mathematical Valuation and Counteroffer Heuristics
When a player proposes a trade, the bot evaluates both sides of the offer:

1. Asset Valuation Formulas:
   * Cash Value: Face value in $wif (`amount * 1.0`).
   * Tile Value:
     ```
     tileVal = 10 + (ownedMatchingTiles * 8) + (canCompleteNow ? 25 : 0) + (7-epoch) * 3
     ```
   * Parcel Value:
     ```
     lotVal = 18 + (adjacentOwnedParcels * 14) + (matchingAdjacentShop ? 20 : 0) + (isOccupied ? 15 : 0)
     ```

2. Decision Rule:
   * `receivedVal = evaluateSide(offer.give, botId)` (assets bot receives from proposer)
   * `surrenderedVal = evaluateSide(offer.take, botId)` (assets bot surrenders to proposer)
   * `targetVal = surrenderedVal * botMargin` (minimum return bot demands)
   * If `receivedVal >= targetVal`, the trade is accepted (`accepted = true`).
   * Otherwise, the trade is rejected, and `shortfall = Math.max(0, Math.ceil(targetVal-receivedVal))`.

3. Counteroffer Button Logic:
   If `shortfall > 0` and the human player possesses sufficient cash (`offer.give.cash + shortfall <= playerCash`), the trade desk renders a quick-action counteroffer button:
   `Top Up ${shortfall} $wif`
   Clicking the button updates the human offer cash to cover the spread, instantly turning the trade into an accepted transaction.

---

## 7. Visual Palette, Typography, and Audio Identity

### 7.1 Visual Color Palette Table

| Role | Color Name | Hex Code | Usage in Game |
|---|---|---|---|
| Background Canvas | Midnight Navy | `#0B0F19` | Main application background, board border |
| Card / Panel Surface | Dark Slate Blue | `#111827` | HUD panels, drawers, trade desk container |
| Primary Accent | Robinhood Emerald | `#00C805` | Active borders, confirmations, wallet badges |
| District 0 Accent | Mint Green | `#39A883` | District 0 parcels, DEX Swap shop tiles |
| District 1 Accent | Bullion Gold | `#EEC353` | District 1 parcels, Memecoin Lounge shop tiles |
| District 2 Accent | Ocean Cyan | `#29B6F6` | District 2 parcels, trade desk highlights |
| District 3 Accent | Amethyst Purple | `#AB47BC` | District 3 parcels, Lending Protocol tiles |
| District 4 Accent | Sunset Coral | `#FF7043` | District 4 parcels, Staking Vault tiles |
| District 5 Accent | Slate Cobalt | `#455A64` | District 5 parcels, Validator Citadel tiles |
| High Contrast Text | Pure Off-White | `#F3F4F6` | Primary headers, cash numbers, player names |
| Muted Text | Steel Gray | `#9CA3AF` | Subtitles, disabled states, empty slot labels |

### 7.2 Pixel Art Aesthetic and Nearest-Neighbor Rendering
To evoke retro 16-bit arcade aesthetics while maintaining visual crispness on modern displays, the user interface enforces nearest-neighbor scaling across all canvas elements and sprite images:

```css
image-rendering: -webkit-optimize-contrast;
image-rendering: crisp-edges;
image-rendering: pixelated;
```

Resolution Guidelines:
* Native Sprites: 32x32 pixels, using clean 1px dark outlines (`#0B0F19`) and vibrant 4-color shading.
* HD Sprites: 96x96 pixels (exact 3x integer scale with micro-pixel detailing) for full-screen modals.

### 7.3 Procedural Audio and Sound Effects
The audio engine synthesizes chiptune audio procedurally via the Web Audio API without requiring external MP3 or WAV files:
1. Coin Chime: Dual sine-wave ping (987Hz and 1318Hz) triggering on cash transfers and yield harvests.
2. Tile Snap: Low-pass noise burst simulating placing a ceramic tile onto a wooden board.
3. Deal Stamp: Deep retro bass boom (80Hz punch) accompanied by a rapid frequency sweep when a trade is filled.
4. Epoch Advance: Ascending arpeggio (C4, E4, G4, C5) signaling a new market regime.
5. Error / Rejection: Dissonant square-wave buzzer (150Hz to 120Hz downward pitch) on invalid moves.
