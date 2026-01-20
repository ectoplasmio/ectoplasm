# Deployment Guide

Step-by-step guide to deploy Ectoplasm DEX on SUI blockchain.

## Prerequisites

### 1. Install SUI CLI

```bash
# Install from source
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# Verify installation
sui --version
```

### 2. Configure SUI Client

```bash
# Set up client for testnet
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Switch to testnet
sui client switch --env testnet

# Create a new address (or import existing)
sui client new-address ed25519

# Check active address
sui client active-address
```

### 3. Get Testnet SUI

```bash
# Request testnet SUI from faucet
sui client faucet

# Verify balance
sui client gas
```

## Contract Deployment

### Step 1: Deploy Core Package (ectoplasm)

```bash
cd contracts/ectoplasm

# Build first to verify no errors
sui move build

# Deploy to testnet
sui client publish --gas-budget 500000000

# Output will include:
# - Package ID (save this!)
# - Created objects (Factory, TreasuryCaps, etc.)
```

**Save the following from output:**
- `Package ID` → Core package address
- `Factory` object ID
- `ECTO TreasuryCap` object ID
- `USDC TreasuryCap` object ID

### Step 2: Initialize Tokens and Pool

After deployment, mint initial tokens and create the first pool:

```bash
# Mint ECTO tokens (adjust amounts as needed)
sui client call \
  --package <PACKAGE_ID> \
  --module ecto \
  --function mint \
  --args <TREASURY_CAP_ID> <AMOUNT> <RECIPIENT_ADDRESS> \
  --gas-budget 10000000

# Mint USDC tokens
sui client call \
  --package <PACKAGE_ID> \
  --module usdc \
  --function mint \
  --args <TREASURY_CAP_ID> <AMOUNT> <RECIPIENT_ADDRESS> \
  --gas-budget 10000000
```

### Step 3: Create ECTO-USDC Pool

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module factory \
  --function create_pool \
  --type-args "<PACKAGE_ID>::ecto::ECTO" "<PACKAGE_ID>::usdc::USDC" \
  --args <FACTORY_ID> <ECTO_COIN_ID> <USDC_COIN_ID> \
  --gas-budget 50000000
```

**Save the Pool object ID from output.**

### Step 4: Deploy Features Package

```bash
cd ../ectoplasm-features

# Update Move.toml with core package address if needed
# The local dependency should resolve automatically

# Build
sui move build

# Deploy
sui client publish --gas-budget 500000000
```

**Save from output:**
- `Package ID` → Features package address
- `StakingPool` object ID
- `StakingAdminCap` object ID
- `LaunchpadConfig` object ID
- `LaunchpadAdminCap` object ID

### Step 5: Initialize Staking Pool

Add initial rewards to the staking pool:

```bash
sui client call \
  --package <FEATURES_PACKAGE_ID> \
  --module staking \
  --function add_rewards \
  --args <STAKING_ADMIN_CAP_ID> <STAKING_POOL_ID> <ECTO_COIN_ID> \
  --gas-budget 10000000
```

## Frontend Configuration

### Step 1: Update Configuration

Edit `frontend/src/config/sui.ts` with deployed addresses:

```typescript
export const SUI_CONFIG = {
  // Core package
  packageId: '<CORE_PACKAGE_ID>',

  // Features package
  featuresPackageId: '<FEATURES_PACKAGE_ID>',

  // Factory
  factoryId: '<FACTORY_ID>',

  // Staking
  staking: {
    poolId: '<STAKING_POOL_ID>',
    adminCapId: '<STAKING_ADMIN_CAP_ID>',
  },

  // Launchpad
  launchpad: {
    configId: '<LAUNCHPAD_CONFIG_ID>',
    adminCapId: '<LAUNCHPAD_ADMIN_CAP_ID>',
  },

  // Treasury caps (for faucet)
  treasuryCaps: {
    ECTO: '<ECTO_TREASURY_CAP_ID>',
    USDC: '<USDC_TREASURY_CAP_ID>',
  },

  // Pools
  pools: {
    'ECTO-USDC': {
      poolId: '<ECTO_USDC_POOL_ID>',
      coinTypeA: '<CORE_PACKAGE_ID>::ecto::ECTO',
      coinTypeB: '<CORE_PACKAGE_ID>::usdc::USDC',
      decimalsA: 9,
      decimalsB: 6,
    },
  },

  // Tokens
  tokens: {
    ECTO: {
      symbol: 'ECTO',
      name: 'Ectoplasm',
      coinType: '<CORE_PACKAGE_ID>::ecto::ECTO',
      decimals: 9,
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      coinType: '<CORE_PACKAGE_ID>::usdc::USDC',
      decimals: 6,
    },
  },
};
```

### Step 2: Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Test locally
npm run preview
```

### Step 3: Deploy Frontend

The `dist/` folder contains static files that can be deployed to any hosting:

**Vercel:**
```bash
npm i -g vercel
vercel deploy dist/
```

**Netlify:**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

**GitHub Pages:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm install && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

## Verification

### 1. Verify Contracts on Explorer

Visit [SUI Scan](https://suiscan.xyz/testnet) and search for your package IDs:
- Core package: Check modules are visible
- Features package: Check modules are visible
- Objects: Verify Factory, Pools, etc. exist

### 2. Test Frontend

1. Open the deployed frontend
2. Connect a SUI wallet
3. Test faucet (get test tokens)
4. Test swap functionality
5. Test liquidity operations
6. Test staking
7. Test launchpad (if tokens available)

### 3. Verify Transactions

After each operation, check the transaction on SUI Scan:
- Transaction succeeded
- Expected events emitted
- Object states updated correctly

## Mainnet Deployment

### Additional Considerations

1. **Audit**: Get contracts audited before mainnet
2. **Multisig**: Use multisig for admin capabilities
3. **Gradual Rollout**: Start with limited liquidity
4. **Monitoring**: Set up transaction monitoring
5. **Real USDC**: Integrate with actual USDC bridge

### Mainnet Configuration

```bash
# Switch to mainnet
sui client switch --env mainnet

# Ensure sufficient SUI for deployment gas
sui client gas

# Deploy with same commands but higher gas budget
sui client publish --gas-budget 1000000000
```

### Update Frontend for Mainnet

```typescript
// In sui.ts
defaultNetwork: 'mainnet' as const,

networks: {
  mainnet: {
    name: 'SUI Mainnet',
    url: 'https://fullnode.mainnet.sui.io:443',
    explorerUrl: 'https://suiscan.xyz/mainnet',
  },
},
```

## Troubleshooting

### "InsufficientGas" Error

Increase gas budget:
```bash
sui client publish --gas-budget 1000000000
```

### "ObjectNotFound" Error

- Verify object ID is correct
- Check object hasn't been deleted
- Ensure using correct network (testnet vs mainnet)

### "TypeMismatch" Error

- Check type arguments match exactly
- Verify package ID in type is correct
- Ensure coin types include full path

### "MoveAbort" Error

Check the abort code against module error constants:
```move
const EInsufficientBalance: u64 = 1;
const ESlippageExceeded: u64 = 2;
// etc.
```

### Frontend Not Connecting

1. Check wallet is on correct network
2. Clear browser cache
3. Check RPC endpoint is accessible
4. Verify package IDs in config

## Upgrade Process

To upgrade deployed packages:

```bash
# Build upgrade
sui move build

# Upgrade package (requires UpgradeCap)
sui client upgrade \
  --package <EXISTING_PACKAGE_ID> \
  --upgrade-capability <UPGRADE_CAP_ID> \
  --gas-budget 500000000
```

**Note**: SUI package upgrades have restrictions:
- Cannot add modules with `init` functions
- Cannot remove existing public functions
- Storage layout must be compatible

## Deployed Addresses Reference

### Testnet (Current Deployment)

| Item | Address |
|------|---------|
| Core Package | `0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081` |
| Features Package | `0x9148054627665ef223218fef249e3b472fc80e7de4389c49cf8760ef815bbbe3` |
| Factory | `0x67a6ad1736426b5b637514d690829679d6753ff02f3161ec0466e40b1a2a9f73` |
| ECTO-USDC Pool | `0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0` |
| Staking Pool | `0x59a191508103795bc8a1f2951c56b8b431dd9cb5b5bbf4d23ef44347fec95b36` |
| Launchpad Config | `0xad4b336d5109e3d08ec6b58a26637ab8a86f54fe449da7566a18b7bf3f2d716a` |
| ECTO TreasuryCap | `0x42f69e1c98e3b14bf8f7e1b7c5099a60a5c94abdfe01d7f5057b4a5e07739aaa` |
| USDC TreasuryCap | `0xdabce8645319f64819128cb5cd92adde0b7044d503806574aec2ff368b5fbf3f` |
