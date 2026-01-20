# Ectoplasm DEX on SUI

A decentralized exchange (DEX) built on the SUI blockchain featuring an automated market maker (AMM), token staking, and a token launchpad with bonding curves.

## Overview

Ectoplasm DEX is a full-featured DeFi platform that includes:

- **AMM (Automated Market Maker)** - Swap tokens with constant product formula (x*y=k)
- **Liquidity Pools** - Provide liquidity and earn trading fees
- **Token Staking** - Stake ECTO tokens with lock periods for bonus multipliers
- **Launchpad** - Launch new tokens with bonding curve pricing

## Project Structure

```
ectoplasm-sui/
├── contracts/                    # Move smart contracts
│   ├── ectoplasm/               # Core AMM contracts
│   │   └── sources/
│   │       ├── pool.move        # Liquidity pool implementation
│   │       ├── factory.move     # Pool factory
│   │       ├── router.move      # Swap router
│   │       ├── math.move        # Math utilities
│   │       ├── ecto.move        # ECTO token
│   │       └── usdc.move        # USDC token (testnet)
│   │
│   └── ectoplasm-features/      # Extended features
│       └── sources/
│           ├── staking.move     # Token staking
│           └── launchpad.move   # Bonding curve launchpad
│
├── frontend/                     # React frontend application
│   └── src/
│       ├── components/          # Reusable UI components
│       ├── pages/               # Page components
│       ├── hooks/               # Custom React hooks
│       ├── contexts/            # React contexts
│       ├── services/            # Blockchain services
│       └── config/              # Configuration
│
└── docs/                        # Additional documentation
    ├── ARCHITECTURE.md          # System architecture
    └── DEPLOYMENT.md            # Deployment guide
```

## Documentation

| Document | Description |
|----------|-------------|
| [Contracts Overview](./contracts/README.md) | Smart contract architecture and modules |
| [Core AMM Contracts](./contracts/ectoplasm/README.md) | Pool, factory, router documentation |
| [Features Contracts](./contracts/ectoplasm-features/README.md) | Staking and launchpad documentation |
| [Frontend](./frontend/README.md) | React application setup and structure |
| [Architecture](./docs/ARCHITECTURE.md) | System design and data flow |
| [Deployment Guide](./docs/DEPLOYMENT.md) | How to deploy contracts and frontend |

## Quick Start

### Prerequisites

- [SUI CLI](https://docs.sui.io/build/install) (v1.0.0+)
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) or npm

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/ectoplasm-sui.git
cd ectoplasm-sui
```

### 2. Deploy Contracts (Testnet)

```bash
# Navigate to contracts
cd contracts/ectoplasm

# Build contracts
sui move build

# Deploy to testnet
sui client publish --gas-budget 500000000
```

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

### 3. Run Frontend Locally

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Deployed Contracts (Testnet)

| Contract | Package ID |
|----------|-----------|
| Core (AMM) | `0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081` |
| Features (Staking/Launchpad) | `0x9148054627665ef223218fef249e3b472fc80e7de4389c49cf8760ef815bbbe3` |

### Key Object IDs

| Object | ID |
|--------|-----|
| Factory | `0x67a6ad1736426b5b637514d690829679d6753ff02f3161ec0466e40b1a2a9f73` |
| ECTO-USDC Pool | `0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0` |
| Staking Pool | `0x59a191508103795bc8a1f2951c56b8b431dd9cb5b5bbf4d23ef44347fec95b36` |
| Launchpad Config | `0xad4b336d5109e3d08ec6b58a26637ab8a86f54fe449da7566a18b7bf3f2d716a` |

## Features

### Token Swapping
- Swap between ECTO and USDC tokens
- Configurable slippage tolerance
- Real-time price quotes

### Liquidity Provision
- Add/remove liquidity to pools
- Earn 0.3% trading fees
- LP token representation

### Staking
- Stake ECTO tokens to earn rewards
- Lock period bonuses:
  - No lock: 1.0x multiplier
  - 7 days: 1.1x multiplier
  - 30 days: 1.25x multiplier
  - 90 days: 1.5x multiplier
- Claim rewards anytime

### Launchpad
- Launch tokens with bonding curve pricing
- Linear price curve (price increases with supply)
- Automatic graduation to AMM when threshold reached
- Creator fees on trades

## Technology Stack

**Smart Contracts:**
- Move language on SUI blockchain
- Object-centric design pattern
- Programmable Transaction Blocks (PTB)

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- @mysten/dapp-kit for wallet integration
- @mysten/sui for blockchain interaction

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [SUI Documentation](https://docs.sui.io/)
- [Move Language Book](https://move-book.com/)
- [SUI Explorer (Testnet)](https://suiscan.xyz/testnet)
