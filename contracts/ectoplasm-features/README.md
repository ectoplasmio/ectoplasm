# Ectoplasm Features Contracts

Extended DeFi features for Ectoplasm DEX: Staking and Launchpad.

## Modules

### staking.move

Token staking with lock periods and reward multipliers.

#### Structures

```move
/// Global staking pool
public struct StakingPool has key {
    id: UID,
    total_staked: u64,              // Total ECTO staked
    reward_balance: Balance<ECTO>,   // Available rewards
    reward_rate: u64,               // Rewards per second
    last_update_time: u64,          // Last reward calculation
    accumulated_reward_per_share: u128,
    total_rewards_distributed: u64,
    paused: bool,
}

/// Individual stake position (owned by user)
public struct StakePosition has key, store {
    id: UID,
    owner: address,
    amount: u64,                    // Staked amount
    lock_period: u64,               // Lock duration in seconds
    start_time: u64,                // When stake started
    unlock_time: u64,               // When stake unlocks
    bonus_multiplier: u64,          // Reward multiplier (basis points)
    reward_debt: u128,              // For reward calculation
    pending_rewards: u64,           // Accumulated rewards
}
```

#### Lock Periods & Multipliers

| Lock Period | Multiplier | Bonus |
|-------------|------------|-------|
| No lock | 1.0x (10000 bps) | 0% |
| 7 days | 1.1x (11000 bps) | +10% |
| 30 days | 1.25x (12500 bps) | +25% |
| 90 days | 1.5x (15000 bps) | +50% |

#### Key Functions

| Function | Description |
|----------|-------------|
| `stake_entry` | Stake ECTO tokens with a lock period |
| `unstake_entry` | Withdraw staked tokens (after unlock) |
| `claim_rewards_entry` | Claim accumulated rewards |
| `add_rewards` | Admin: add rewards to pool |
| `set_reward_rate` | Admin: update reward rate |

#### Example Usage

```typescript
// Stake 100 ECTO with 30-day lock
const tx = new Transaction();

const [stakeCoin] = tx.splitCoins(tx.object(ectoCoinId), [100_000_000_000n]);

tx.moveCall({
  target: `${FEATURES_PKG}::staking::stake_entry`,
  arguments: [
    tx.object(STAKING_POOL_ID),
    stakeCoin,
    tx.pure.u64(2), // Lock option index (30 days)
    tx.object('0x6'), // Clock
  ],
});

await signAndExecute({ transaction: tx });
```

---

### launchpad.move

Token launchpad with bonding curve pricing.

#### Structures

```move
/// Global launchpad configuration
public struct LaunchpadConfig has key {
    id: UID,
    fee_recipient: address,
    protocol_fee_bps: u64,          // Protocol fee (1%)
    default_graduation_threshold: u64,
    launches_paused: bool,
    total_launches: u64,
    total_volume: u64,
    collected_fees: Balance<USDC>,
}

/// Bonding curve for a token
public struct BondingCurve<phantom T> has key {
    id: UID,
    name: String,
    symbol: String,
    description: String,
    image_url: Option<Url>,
    creator: address,
    treasury_cap: TreasuryCap<T>,    // For minting tokens
    usdc_reserve: Balance<USDC>,     // USDC collected
    tokens_sold: u64,
    initial_price: u64,
    price_increment: u64,
    graduation_threshold: u64,
    graduated: bool,
    creator_fee_bps: u64,
    creator_fees: Balance<USDC>,
    paused: bool,
    volume: u64,
}
```

#### Bonding Curve Formula

Linear bonding curve where price increases as tokens are sold:

```
current_price = initial_price + (tokens_sold / PRECISION) * price_increment

tokens_out = usdc_amount * 1e9 / current_price
usdc_out = tokens_in * current_price / 1e9
```

#### Fee Structure

| Fee Type | Default | Description |
|----------|---------|-------------|
| Protocol Fee | 1% (100 bps) | Goes to protocol |
| Creator Fee | 2% (200 bps) | Goes to token creator |
| Max Fee | 10% (1000 bps) | Maximum allowed |

#### Key Functions

| Function | Description |
|----------|-------------|
| `create_curve_entry<T>` | Create a new bonding curve |
| `buy_entry<T>` | Buy tokens with USDC |
| `sell_entry<T>` | Sell tokens back for USDC |
| `claim_creator_fees_entry<T>` | Creator withdraws fees |
| `set_curve_paused<T>` | Creator pauses trading |

#### Graduation

When a token's market cap reaches the graduation threshold ($50,000 default), the curve "graduates":

1. `graduated` flag is set to true
2. Trading is disabled on the bonding curve
3. Liquidity can be migrated to the main AMM pool

#### Example: Buy Tokens

```typescript
const tx = new Transaction();

// Prepare USDC payment
const [payment] = tx.splitCoins(tx.object(usdcCoinId), [usdcAmount]);

tx.moveCall({
  target: `${FEATURES_PKG}::launchpad::buy_entry`,
  typeArguments: [TOKEN_TYPE],
  arguments: [
    tx.object(LAUNCHPAD_CONFIG_ID),
    tx.object(BONDING_CURVE_ID),
    payment,
    tx.pure.u64(minTokensOut), // Slippage protection
  ],
});

await signAndExecute({ transaction: tx });
```

#### Example: Create a Token Launch

To create a new token on the launchpad:

1. Deploy a Move module with your token type
2. Transfer the TreasuryCap to the launchpad
3. Call `create_curve_entry`

```move
// Your token module
module your_package::your_token {
    public struct YOUR_TOKEN has drop {}

    fun init(witness: YOUR_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"YOUR",
            b"Your Token",
            b"Description",
            option::none(),
            ctx
        );

        // Transfer treasury cap to launchpad
        // ... create curve with it
    }
}
```

---

## Events

### Staking Events

```move
public struct Staked has copy, drop {
    pool_id: address,
    user: address,
    amount: u64,
    lock_period: u64,
    position_id: address,
}

public struct Unstaked has copy, drop {
    pool_id: address,
    user: address,
    amount: u64,
    position_id: address,
}

public struct RewardsClaimed has copy, drop {
    pool_id: address,
    user: address,
    amount: u64,
    position_id: address,
}
```

### Launchpad Events

```move
public struct TokenLaunched has copy, drop {
    curve_id: address,
    name: vector<u8>,
    symbol: vector<u8>,
    creator: address,
    initial_price: u64,
    graduation_threshold: u64,
}

public struct TokenBought has copy, drop {
    curve_id: address,
    buyer: address,
    usdc_amount: u64,
    tokens_received: u64,
    new_price: u64,
    new_market_cap: u64,
}

public struct TokenSold has copy, drop {
    curve_id: address,
    seller: address,
    tokens_amount: u64,
    usdc_received: u64,
    new_price: u64,
    new_market_cap: u64,
}

public struct CurveGraduated has copy, drop {
    curve_id: address,
    final_market_cap: u64,
    total_usdc_reserve: u64,
    total_tokens_sold: u64,
}
```

---

## Building

```bash
cd contracts/ectoplasm-features

# Build
sui move build

# Test
sui move test

# Publish
sui client publish --gas-budget 500000000
```

## Configuration

`Move.toml`:
```toml
[package]
name = "ectoplasm_features"
version = "1.0.0"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
ectoplasm = { local = "../ectoplasm" }

[addresses]
ectoplasm_features = "0x0"
```

## Deployed Objects

| Object | Type | Description |
|--------|------|-------------|
| Package | - | Deployed Move package |
| StakingPool | `StakingPool` | Shared staking pool |
| StakingAdminCap | `StakingAdminCap` | Admin capability |
| LaunchpadConfig | `LaunchpadConfig` | Shared launchpad config |
| LaunchpadAdminCap | `LaunchpadAdminCap` | Admin capability |

## Security Considerations

### Staking
- Lock periods are enforced on-chain
- Cannot unstake before unlock time
- Rewards calculated based on time and stake amount
- Admin cannot withdraw user stakes

### Launchpad
- Slippage protection on all trades
- Creator cannot rug-pull (tokens minted on buy, burned on sell)
- USDC reserve backs all circulating tokens
- Graduation is irreversible
