# Ectoplasm Contract Deployment

This directory contains scripts for deploying and managing Ectoplasm contracts on SUI.

## Prerequisites

1. **SUI CLI** - Install from https://docs.sui.io/build/install
   ```bash
   # Verify installation
   sui --version
   ```

2. **Wallet Setup** - Create or import a wallet
   ```bash
   # Create new wallet
   sui client new-address ed25519

   # Or import existing
   sui keytool import <MNEMONIC> ed25519

   # List addresses
   sui client addresses
   ```

3. **Testnet SUI** - Get from https://faucet.sui.io/
   ```bash
   # Check balance
   sui client gas
   ```

## Deployment

### Quick Start

```bash
# Deploy with active wallet
./deploy.sh

# Deploy with specific wallet
SUI_WALLET_ALIAS=mydeployer ./deploy.sh
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SUI_WALLET_ALIAS` | active wallet | Wallet alias to use for deployment |
| `SUI_NETWORK` | testnet | Network to deploy to |
| `SUI_GAS_BUDGET` | 500000000 | Gas budget for transactions |

### Using a Specific Wallet

1. First, list your available addresses:
   ```bash
   sui client addresses
   ```

2. Switch to your desired address:
   ```bash
   sui client switch --address <YOUR_ADDRESS>
   ```

3. Or use environment variable:
   ```bash
   SUI_WALLET_ALIAS=0x1234...abcd ./deploy.sh
   ```

## After Deployment

1. The script outputs object IDs to `deployment-summary.json`

2. Update the frontend config:
   ```bash
   node update-frontend-config.js
   ```

3. Or manually update `frontend/src/config/sui.ts` with:
   - `packageId` - The new package ID
   - `faucets.ECTO` - ECTO Faucet object ID
   - `faucets.USDC` - USDC Faucet object ID
   - `factoryId` - Factory object ID

## Contract Changes

### Shared Faucet

The updated contracts now use **shared faucet objects** that anyone can call:

```move
// Old (only owner could call)
public entry fun faucet(treasury_cap: &mut TreasuryCap<ECTO>, ctx: &mut TxContext)

// New (anyone can call)
public entry fun request_tokens(faucet: &mut Faucet, clock: &Clock, ctx: &mut TxContext)
```

Features:
- **Rate limiting**: 5-minute cooldown per address
- **Shared object**: Anyone can request tokens
- **1000 tokens**: Per request (1000 ECTO or 1000 USDC)

## Troubleshooting

### "No SUI balance found"
Get testnet SUI from https://faucet.sui.io/

### "Could not switch to wallet"
Check available addresses with `sui client addresses`

### Build fails
Ensure you're in the contracts directory and have the correct SUI version:
```bash
cd contracts/ectoplasm
sui move build
```
