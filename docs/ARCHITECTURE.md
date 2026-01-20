# Ectoplasm Architecture

This document describes the architecture and design decisions of Ectoplasm DEX on SUI.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Users                                        │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Pages: Swap | Liquidity | Staking | Launchpad | Wallet | Dashboard │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────────┐ │
│  │  Hooks: useSwap | useLiquidity | useStaking | useLaunchpad          │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────────┐ │
│  │  Services: DexService | @mysten/dapp-kit | @mysten/sui              │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │ PTB (Programmable Transaction Blocks)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           SUI Blockchain                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    ectoplasm package (Core AMM)                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │  Router  │──│ Factory  │──│   Pool   │──│   Math   │           │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │  │
│  │                      │              │                              │  │
│  │                      ▼              ▼                              │  │
│  │              ┌──────────┐    ┌──────────┐                         │  │
│  │              │   ECTO   │    │   USDC   │                         │  │
│  │              └──────────┘    └──────────┘                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              ectoplasm_features package (Extended)                  │  │
│  │  ┌───────────────────┐        ┌───────────────────┐               │  │
│  │  │      Staking      │        │     Launchpad     │               │  │
│  │  │                   │        │                   │               │  │
│  │  │  - StakingPool    │        │  - LaunchpadConfig│               │  │
│  │  │  - StakePosition  │        │  - BondingCurve<T>│               │  │
│  │  │  - Rewards        │        │  - Trading        │               │  │
│  │  └───────────────────┘        └───────────────────┘               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

## SUI Object Model

SUI uses an object-centric model rather than an account-based model. This fundamentally changes how we design smart contracts.

### Object Types

| Type | Ownership | Mutability | Use Case |
|------|-----------|------------|----------|
| **Owned** | Single address | Mutable by owner | User assets, capabilities |
| **Shared** | Everyone | Mutable by anyone | Pools, registries |
| **Immutable** | Nobody | Read-only | Configuration, metadata |

### Ectoplasm Objects

```
Owned Objects:
├── Coin<ECTO>           # User's ECTO balance
├── Coin<USDC>           # User's USDC balance
├── Coin<LP<A,B>>        # User's LP tokens
├── StakePosition        # User's stake (NFT-like)
├── TreasuryCap<ECTO>    # ECTO minting authority
├── TreasuryCap<USDC>    # USDC minting authority
├── FactoryAdminCap      # Factory admin rights
├── StakingAdminCap      # Staking admin rights
└── LaunchpadAdminCap    # Launchpad admin rights

Shared Objects:
├── Factory              # Pool registry
├── Pool<A, B>           # Liquidity pools
├── StakingPool          # Staking pool
├── LaunchpadConfig      # Protocol configuration
└── BondingCurve<T>      # Token bonding curves
```

## AMM Design

### Constant Product Formula

The AMM uses the classic x*y=k formula:

```
k = reserve_a * reserve_b (constant)

For a swap of Δx tokens A for tokens B:
Δy = (reserve_b * Δx) / (reserve_a + Δx)

With fee (0.3%):
Δy = (reserve_b * Δx * 997) / (reserve_a * 1000 + Δx * 997)
```

### Pool Structure

```move
public struct Pool<phantom A, phantom B> has key {
    id: UID,
    reserve_a: Balance<A>,      // Token A reserves
    reserve_b: Balance<B>,      // Token B reserves
    lp_supply: Supply<LP<A, B>>, // LP token supply
    fee_bps: u64,               // Fee in basis points (30 = 0.3%)
}
```

### LP Token Calculation

When adding liquidity:
```
// First deposit (no existing liquidity)
lp_tokens = sqrt(amount_a * amount_b)

// Subsequent deposits
lp_tokens = min(
    (amount_a * total_lp_supply) / reserve_a,
    (amount_b * total_lp_supply) / reserve_b
)
```

When removing liquidity:
```
amount_a = (lp_tokens * reserve_a) / total_lp_supply
amount_b = (lp_tokens * reserve_b) / total_lp_supply
```

## Staking Design

### Reward Mechanics

The staking system uses a per-share accumulator pattern for efficient reward distribution:

```
accumulated_reward_per_share += (rewards * PRECISION) / total_staked

user_pending = (stake_amount * accumulated_reward_per_share / PRECISION) - reward_debt
```

### Lock Period Multipliers

| Lock Duration | Multiplier | Effective APR Boost |
|--------------|------------|---------------------|
| No lock | 1.0x | Base rate |
| 7 days | 1.1x | +10% |
| 30 days | 1.25x | +25% |
| 90 days | 1.5x | +50% |

### StakePosition as NFT

Each stake is represented as an owned object, enabling:
- Transfer/sell positions
- Multiple positions per user
- Unique position attributes (lock time, multiplier)

## Launchpad Design

### Bonding Curve Mechanics

Linear bonding curve where price increases with supply:

```
price = initial_price + (tokens_sold / PRECISION) * price_increment

For buying with USDC amount:
tokens = (usdc_amount * PRECISION) / current_price

For selling tokens:
usdc = (tokens * current_price) / PRECISION
```

### Fee Structure

```
Total Fee = Protocol Fee (1%) + Creator Fee (2% default)

On Buy:
├── User pays: 100 USDC
├── Protocol receives: 1 USDC
├── Creator receives: 2 USDC
└── Reserve receives: 97 USDC (backs tokens)

On Sell:
├── User receives: net USDC after fees
├── Protocol receives: fee from reserve
└── Creator receives: fee from reserve
```

### Graduation

When market cap reaches threshold ($50,000 default):
1. Trading on curve is disabled
2. Event emitted for off-chain monitoring
3. Liquidity can be migrated to AMM pool

## Transaction Flow

### Swap Transaction

```typescript
// 1. Build transaction
const tx = new Transaction();

// 2. Get user's coins
const coins = await client.getCoins({ owner, coinType });

// 3. Split exact amount needed
const [paymentCoin] = tx.splitCoins(
  tx.object(coins.data[0].coinObjectId),
  [amountIn]
);

// 4. Execute swap
tx.moveCall({
  target: `${PACKAGE}::router::swap_exact_a_for_b`,
  typeArguments: [COIN_A_TYPE, COIN_B_TYPE],
  arguments: [
    tx.object(POOL_ID),
    paymentCoin,
    tx.pure.u64(minAmountOut),
  ],
});

// 5. Sign and submit
const result = await signAndExecute({ transaction: tx });
```

### Multi-Operation Transaction (PTB)

SUI's PTB allows composing multiple operations atomically:

```typescript
const tx = new Transaction();

// Operation 1: Swap ECTO for USDC
const [usdcOut] = tx.moveCall({
  target: `${PACKAGE}::router::swap_a_to_b`,
  arguments: [pool, ectoCoin, minUsdc],
});

// Operation 2: Buy launchpad tokens with USDC
tx.moveCall({
  target: `${FEATURES}::launchpad::buy_entry`,
  typeArguments: [TOKEN_TYPE],
  arguments: [config, curve, usdcOut, minTokens],
});

// All operations succeed or fail together
await signAndExecute({ transaction: tx });
```

## Frontend Architecture

### State Management

```
┌─────────────────────────────────────────────────────────┐
│                    React App                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Context Providers                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐  │   │
│  │  │   Wallet    │  │     DEX     │  │  Toast  │  │   │
│  │  │   Context   │  │   Context   │  │ Context │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └────┬────┘  │   │
│  └─────────┼────────────────┼──────────────┼───────┘   │
│            │                │              │            │
│  ┌─────────▼────────────────▼──────────────▼───────┐   │
│  │                    Hooks                         │   │
│  │  useSwap | useLiquidity | useStaking | ...      │   │
│  └─────────────────────────┬───────────────────────┘   │
│                            │                            │
│  ┌─────────────────────────▼───────────────────────┐   │
│  │                  Components                      │   │
│  │  Pages | Common | Staking | Launchpad           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Component event handler
2. **Hook Function** → Builds transaction, manages state
3. **Context** → Provides wallet, service instances
4. **SUI SDK** → Signs and executes transaction
5. **Blockchain** → Processes transaction
6. **Event/Response** → Updates UI state

## Security Considerations

### Smart Contract Security

- **No Reentrancy**: SUI's object model prevents reentrancy by design
- **Overflow Protection**: All math uses checked arithmetic
- **Access Control**: Admin functions require capability objects
- **Slippage Protection**: All trades have minimum output checks
- **Lock Enforcement**: Staking unlock times enforced on-chain

### Frontend Security

- **No Private Keys**: Uses wallet extension for signing
- **Input Validation**: All user inputs sanitized
- **Error Handling**: Graceful error messages, no sensitive data exposure
- **HTTPS Only**: Secure transport for API calls

## Gas Optimization

### Move Optimizations

1. **Minimize Storage Writes**: Use local variables when possible
2. **Batch Operations**: Combine reads/writes in single function
3. **Efficient Data Structures**: Use appropriate collections

### Frontend Optimizations

1. **Parallel Queries**: Fetch independent data concurrently
2. **Caching**: Cache static data (token info, config)
3. **Debouncing**: Debounce quote calculations
4. **Lazy Loading**: Load pages on demand

## Future Considerations

### Scalability

- Multiple pools per token pair (different fee tiers)
- Cross-pool routing for better prices
- Off-chain indexing for faster queries

### Features

- Limit orders via keeper network
- Yield farming rewards
- Governance token and voting
- Cross-chain bridges

### Upgradability

SUI packages can be upgraded using the upgrade capability:
- New modules can be added
- Existing functions can be modified
- State migration may be required
