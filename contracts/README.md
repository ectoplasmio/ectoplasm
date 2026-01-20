# Ectoplasm Smart Contracts

Move smart contracts for the Ectoplasm DEX on SUI blockchain.

## Packages Overview

The contracts are organized into two packages:

### 1. `ectoplasm` - Core AMM Package

The core automated market maker functionality including:

- **Pool** - Liquidity pool with constant product formula
- **Factory** - Creates and manages pools
- **Router** - Handles swaps and liquidity operations
- **Math** - Mathematical utilities for precise calculations
- **ECTO** - Native platform token
- **USDC** - Stablecoin (testnet version)

[View detailed documentation](./ectoplasm/README.md)

### 2. `ectoplasm-features` - Extended Features Package

Additional DeFi features built on top of the core:

- **Staking** - Stake ECTO with lock periods for bonus rewards
- **Launchpad** - Token launches with bonding curve pricing

[View detailed documentation](./ectoplasm-features/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ PTB (Programmable Transaction Blocks)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUI Blockchain                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  ectoplasm package                     │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │
│  │  │ Router  │─▶│ Factory │─▶│  Pool   │◀─│  Math   │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │  │
│  │       │                         │                     │  │
│  │       │                         ▼                     │  │
│  │       │            ┌─────────┐  ┌─────────┐          │  │
│  │       └───────────▶│  ECTO   │  │  USDC   │          │  │
│  │                    └─────────┘  └─────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             ectoplasm-features package                 │  │
│  │  ┌─────────────┐        ┌─────────────────┐          │  │
│  │  │   Staking   │        │    Launchpad    │          │  │
│  │  │             │        │                 │          │  │
│  │  │ StakingPool │        │ LaunchpadConfig │          │  │
│  │  │ StakePosition│       │  BondingCurve   │          │  │
│  │  └─────────────┘        └─────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## SUI Object Model

Unlike account-based blockchains, SUI uses an object-centric model:

| Object Type | Ownership | Description |
|-------------|-----------|-------------|
| `Pool<A, B>` | Shared | Liquidity pool accessible by anyone |
| `Factory` | Shared | Pool creation and registry |
| `StakingPool` | Shared | Staking pool with rewards |
| `StakePosition` | Owned | User's individual stake (NFT-like) |
| `LaunchpadConfig` | Shared | Protocol configuration |
| `BondingCurve<T>` | Shared | Individual token bonding curve |
| `Coin<T>` | Owned | Fungible token balance |
| `TreasuryCap<T>` | Owned | Token minting authority |

## Building Contracts

### Prerequisites

```bash
# Install SUI CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

### Build

```bash
# Build core package
cd contracts/ectoplasm
sui move build

# Build features package
cd ../ectoplasm-features
sui move build
```

### Test

```bash
# Run tests
sui move test
```

## Deployment

### Testnet Deployment

```bash
# Ensure you have testnet SUI
sui client faucet

# Deploy core package
cd contracts/ectoplasm
sui client publish --gas-budget 500000000

# Note the package ID, then deploy features
cd ../ectoplasm-features
# Update Move.toml with ectoplasm package ID if needed
sui client publish --gas-budget 500000000
```

### Deployed Addresses (Testnet)

**Core Package:** `0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081`

| Module | Description |
|--------|-------------|
| `ectoplasm::pool` | Liquidity pool |
| `ectoplasm::factory` | Pool factory |
| `ectoplasm::router` | Swap router |
| `ectoplasm::math` | Math utilities |
| `ectoplasm::ecto` | ECTO token |
| `ectoplasm::usdc` | USDC token |

**Features Package:** `0x9148054627665ef223218fef249e3b472fc80e7de4389c49cf8760ef815bbbe3`

| Module | Description |
|--------|-------------|
| `ectoplasm_features::staking` | Token staking |
| `ectoplasm_features::launchpad` | Bonding curve launchpad |

## Key Concepts

### Programmable Transaction Blocks (PTB)

SUI allows composing multiple operations in a single transaction:

```typescript
const tx = new Transaction();

// Split coins
const [coin] = tx.splitCoins(tx.object(coinId), [amount]);

// Call contract
tx.moveCall({
  target: `${PACKAGE}::router::swap_a_to_b`,
  typeArguments: [coinTypeA, coinTypeB],
  arguments: [tx.object(poolId), coin, tx.pure.u64(minOut)],
});

// Execute
await signAndExecuteTransaction({ transaction: tx });
```

### Coin Management

In SUI, coins are objects that need to be:
1. **Split** when you need a specific amount
2. **Merged** when consolidating multiple coins

```move
// In Move
public fun swap<A, B>(
    pool: &mut Pool<A, B>,
    coin_in: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B>
```

## Security Considerations

- All math operations use checked arithmetic to prevent overflow
- Slippage protection on all swaps
- Lock periods enforced on-chain for staking
- Admin capabilities required for privileged operations
- No upgradeable proxies - code is immutable after deployment

## Gas Optimization

- Shared objects accessed via mutable reference only when needed
- Batch operations in single transactions
- Minimal storage usage with efficient data structures

## Further Reading

- [SUI Move Documentation](https://docs.sui.io/build/move)
- [Move Language Book](https://move-book.com/)
- [SUI Object Model](https://docs.sui.io/concepts/object-model)
