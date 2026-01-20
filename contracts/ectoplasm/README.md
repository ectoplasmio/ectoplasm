# Ectoplasm Core AMM Contracts

The core automated market maker (AMM) contracts for Ectoplasm DEX.

## Modules

### pool.move

The liquidity pool implementation using the constant product formula (x * y = k).

#### Structures

```move
/// Liquidity pool for trading between two token types
public struct Pool<phantom A, phantom B> has key {
    id: UID,
    reserve_a: Balance<A>,      // Token A reserves
    reserve_b: Balance<B>,      // Token B reserves
    lp_supply: Supply<LP<A, B>>, // LP token supply
    fee_bps: u64,               // Trading fee (basis points)
}

/// LP token representing pool share
public struct LP<phantom A, phantom B> has drop {}
```

#### Key Functions

| Function | Description |
|----------|-------------|
| `create_pool<A, B>` | Create a new liquidity pool |
| `add_liquidity<A, B>` | Add tokens to pool, receive LP tokens |
| `remove_liquidity<A, B>` | Burn LP tokens, receive underlying tokens |
| `swap_a_to_b<A, B>` | Swap token A for token B |
| `swap_b_to_a<A, B>` | Swap token B for token A |
| `get_reserves<A, B>` | Get current pool reserves |
| `get_amount_out` | Calculate output amount for a given input |

#### Example: Swap

```move
public fun swap_a_to_b<A, B>(
    pool: &mut Pool<A, B>,
    coin_in: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B>
```

---

### factory.move

Factory contract for creating and managing liquidity pools.

#### Structures

```move
/// Factory for creating pools
public struct Factory has key {
    id: UID,
    pools: Table<PoolKey, ID>,  // Registry of pools
    default_fee_bps: u64,       // Default trading fee
    pool_count: u64,            // Total pools created
}

/// Admin capability for factory operations
public struct FactoryAdminCap has key, store {
    id: UID,
}
```

#### Key Functions

| Function | Description |
|----------|-------------|
| `create_pool<A, B>` | Create a new pool through factory |
| `get_pool<A, B>` | Look up pool by token types |
| `set_default_fee` | Update default fee (admin only) |

---

### router.move

High-level router for user-facing swap and liquidity operations.

#### Entry Functions

```move
/// Swap exact amount of token A for token B
public entry fun swap_exact_a_for_b<A, B>(
    pool: &mut Pool<A, B>,
    coin_in: Coin<A>,
    min_amount_out: u64,
    ctx: &mut TxContext
)

/// Add liquidity to a pool
public entry fun add_liquidity<A, B>(
    pool: &mut Pool<A, B>,
    coin_a: Coin<A>,
    coin_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
)

/// Remove liquidity from a pool
public entry fun remove_liquidity<A, B>(
    pool: &mut Pool<A, B>,
    lp_coin: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
)
```

---

### math.move

Mathematical utilities for AMM calculations.

#### Functions

| Function | Description |
|----------|-------------|
| `mul_div` | Multiply then divide with overflow protection |
| `sqrt` | Integer square root using Newton's method |
| `min` | Return minimum of two values |

#### AMM Formula

```
// Constant product formula
k = reserve_a * reserve_b

// Output amount (with fee)
amount_out = (reserve_out * amount_in * (10000 - fee_bps)) /
             (reserve_in * 10000 + amount_in * (10000 - fee_bps))
```

---

### ecto.move

The native ECTO platform token.

```move
/// ECTO token type (one-time witness)
public struct ECTO has drop {}
```

#### Initialization

The token is initialized with:
- Name: "Ectoplasm"
- Symbol: "ECTO"
- Decimals: 9
- Initial supply minted to deployer

---

### usdc.move

Test USDC stablecoin for testnet use.

```move
/// USDC token type
public struct USDC has drop {}
```

#### Note
This is a test token for development. On mainnet, you would integrate with a real USDC bridge.

---

## Building

```bash
cd contracts/ectoplasm

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
name = "ectoplasm"
version = "1.0.0"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
ectoplasm = "0x0"
```

## Deployed Objects

After deployment, the following objects are created:

| Object | Type | Description |
|--------|------|-------------|
| Package | - | The deployed Move package |
| Factory | `Factory` | Shared object for pool creation |
| ECTO TreasuryCap | `TreasuryCap<ECTO>` | Owned by deployer, for minting |
| USDC TreasuryCap | `TreasuryCap<USDC>` | Owned by deployer, for minting |

## Usage Examples

### Creating a Pool (TypeScript)

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// Add initial liquidity
tx.moveCall({
  target: `${PACKAGE_ID}::factory::create_pool`,
  typeArguments: [ECTO_TYPE, USDC_TYPE],
  arguments: [
    tx.object(FACTORY_ID),
    ectoCoins,
    usdcCoins,
  ],
});

await signAndExecute({ transaction: tx });
```

### Swapping Tokens

```typescript
const tx = new Transaction();

// Split exact amount from user's coin
const [coinIn] = tx.splitCoins(tx.object(userCoinId), [amountIn]);

// Swap
tx.moveCall({
  target: `${PACKAGE_ID}::router::swap_exact_a_for_b`,
  typeArguments: [ECTO_TYPE, USDC_TYPE],
  arguments: [
    tx.object(POOL_ID),
    coinIn,
    tx.pure.u64(minAmountOut),
  ],
});

await signAndExecute({ transaction: tx });
```

## Fee Structure

- Trading fee: 0.3% (30 basis points)
- Fees go to liquidity providers
- No protocol fee currently

## Security

- Slippage protection via `min_amount_out` parameters
- Overflow-safe math operations
- No admin functions that can drain pools
- Immutable code after deployment
