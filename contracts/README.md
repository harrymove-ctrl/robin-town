# Robin Town Harbor Vault Smart Contract (Robinhood Chain Mainnet 4663)

`RobinTownHarborVault.sol` is the companion Solidity `^0.8.24` contract for **Robin Town** on **Robinhood Chain Mainnet (`Chain ID 4663`)**, built around the official **World is Flat (`$wif`)** ERC-20 token (`0x5173b8eA6923c2d40267890D45C46a3480954773`, `18` decimals).

## Core Mechanics

1. **Instant Withdrawal `$wif` Staking (`stakeWif` / `unstakeWif`)**:
   * Traders lock `$wif` (`>= 10 $wif` accessible Mainnet threshold) to activate the **1.20x annual storefront payday multiplier** inside Robin Town.
   * Principal staked balances are strictly segregated from prize pool funds (`totalStaked` vs `totalHarborPool`) so traders can withdraw `100%` of their staked `$wif` at any time.
2. **District Patronage & Ranked Harbor Arena (`patronizeDistrict` / `enterRankedHarbor`)**:
   * Splits every `$wif` deposit atomically on-chain: **50%** is transferred directly to the permanent burn sink (`0x000000000000000000000000000000000000dEaD`) and **50%** enters `totalHarborPool` for leaderboard rewards.
   * Emits indexed `HarborBurn`, `DistrictPatronized`, and `RankedHarborEntered` events alongside standard ERC-20 `Transfer` logs.
3. **Zero-Config RPC Receipt Verification (`/api/wallets/tx`)**:
   * Both direct `$wif` ERC-20 transfers/burns (`transfer` to `0x...dEaD`) and `RobinTownHarborVault` calls emit standard ERC-20 `Transfer` logs on `0x5173b8eA6923c2d40267890D45C46a3480954773`.
   * The Robin Town server (`scripts/wallet-registry.mjs`) queries `eth_getTransactionReceipt` on `https://rpc.mainnet.chain.robinhood.com`, verifies `status === "0x1"`, decodes `Transfer(from, to, value)`, blocks replay across tx hashes, awards `+150 Town Points`, and unlocks the `1.20x` On-Chain Patron Boost on the Harbor Leaderboard.

## Deploy & Verify on Robinhood Chain Blockscout

Using Foundry (`forge`):

```bash
forge create contracts/RobinTownHarborVault.sol:RobinTownHarborVault \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --chain-id 4663 \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args 0x5173b8eA6923c2d40267890D45C46a3480954773 \
  --verify \
  --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api/
```

Once deployed, set `VITE_HARBOR_VAULT_ADDRESS=0xYourDeployedVaultAddress` in Railway variables if you want the `$wif` Hub Patron button to route into the custom vault address in addition to direct `0x...dEaD` `$wif` burns.
