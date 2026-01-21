#!/bin/bash

# Ectoplasm Contract Deployment Script
# =====================================
# This script deploys the Ectoplasm contracts to SUI testnet
#
# Prerequisites:
# - SUI CLI installed (sui --version)
# - Wallet configured with testnet SUI
#
# Environment Variables:
# - SUI_WALLET_ALIAS: The wallet alias to use (default: active wallet)
# - SUI_NETWORK: Network to deploy to (default: testnet)
# - SUI_GAS_BUDGET: Gas budget for transactions (default: 500000000)
#
# Usage:
#   ./deploy.sh                    # Deploy with active wallet
#   SUI_WALLET_ALIAS=mywalletdeploy ./deploy.sh  # Deploy with specific wallet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="${SUI_NETWORK:-testnet}"
GAS_BUDGET="${SUI_GAS_BUDGET:-500000000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$SCRIPT_DIR/../ectoplasm"
OUTPUT_FILE="$SCRIPT_DIR/deployment-output.json"

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   Ectoplasm Contract Deployment${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Check SUI CLI
if ! command -v sui &> /dev/null; then
    echo -e "${RED}Error: SUI CLI not found. Please install it first.${NC}"
    echo "Visit: https://docs.sui.io/build/install"
    exit 1
fi

# Show SUI version
echo -e "${YELLOW}SUI CLI Version:${NC}"
sui --version
echo ""

# Check network
echo -e "${YELLOW}Network:${NC} $NETWORK"

# Get or set wallet
if [ -n "$SUI_WALLET_ALIAS" ]; then
    echo -e "${YELLOW}Switching to wallet:${NC} $SUI_WALLET_ALIAS"
    sui client switch --address "$SUI_WALLET_ALIAS" || {
        echo -e "${RED}Error: Could not switch to wallet '$SUI_WALLET_ALIAS'${NC}"
        echo ""
        echo "Available addresses:"
        sui client addresses
        exit 1
    }
fi

# Show active address
ACTIVE_ADDRESS=$(sui client active-address)
echo -e "${YELLOW}Active Address:${NC} $ACTIVE_ADDRESS"
echo ""

# Check balance
echo -e "${YELLOW}Checking balance...${NC}"
BALANCE=$(sui client gas --json 2>/dev/null | jq -r '.[0].mistBalance // "0"')
if [ "$BALANCE" == "0" ] || [ "$BALANCE" == "null" ]; then
    echo -e "${RED}Error: No SUI balance found.${NC}"
    echo "Please get testnet SUI from: https://faucet.sui.io/"
    exit 1
fi
echo -e "${GREEN}Balance: $BALANCE MIST${NC}"
echo ""

# Switch to testnet if needed
echo -e "${YELLOW}Ensuring testnet environment...${NC}"
sui client switch --env testnet 2>/dev/null || sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
echo ""

# Build contracts
echo -e "${YELLOW}Building contracts...${NC}"
cd "$CONTRACT_DIR"
sui move build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Build successful!${NC}"
echo ""

# Deploy
echo -e "${YELLOW}Deploying contracts...${NC}"
echo -e "${YELLOW}Gas budget: $GAS_BUDGET${NC}"
echo ""

DEPLOY_OUTPUT=$(sui client publish --gas-budget "$GAS_BUDGET" --json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed!${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# Parse output
echo "$DEPLOY_OUTPUT" > "$OUTPUT_FILE"

# Extract package ID
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" == "null" ]; then
    echo -e "${RED}Error: Could not extract package ID${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}   Deployment Successful!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "${YELLOW}Package ID:${NC} $PACKAGE_ID"

# Extract created objects
echo ""
echo -e "${YELLOW}Created Objects:${NC}"

# Find Factory
FACTORY_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::factory::Factory")) | .objectId')
if [ -n "$FACTORY_ID" ] && [ "$FACTORY_ID" != "null" ]; then
    echo -e "  Factory: $FACTORY_ID"
fi

# Find ECTO Faucet
ECTO_FAUCET_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::ecto::Faucet")) | .objectId')
if [ -n "$ECTO_FAUCET_ID" ] && [ "$ECTO_FAUCET_ID" != "null" ]; then
    echo -e "  ECTO Faucet: $ECTO_FAUCET_ID"
fi

# Find USDC Faucet
USDC_FAUCET_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::usdc::Faucet")) | .objectId')
if [ -n "$USDC_FAUCET_ID" ] && [ "$USDC_FAUCET_ID" != "null" ]; then
    echo -e "  USDC Faucet: $USDC_FAUCET_ID"
fi

# Transaction digest
TX_DIGEST=$(echo "$DEPLOY_OUTPUT" | jq -r '.digest')
echo ""
echo -e "${YELLOW}Transaction:${NC} $TX_DIGEST"
echo -e "${YELLOW}Explorer:${NC} https://suiscan.xyz/testnet/tx/$TX_DIGEST"

# Save summary
SUMMARY_FILE="$SCRIPT_DIR/deployment-summary.json"
cat > "$SUMMARY_FILE" << EOF
{
  "network": "$NETWORK",
  "packageId": "$PACKAGE_ID",
  "deployer": "$ACTIVE_ADDRESS",
  "transactionDigest": "$TX_DIGEST",
  "objects": {
    "factory": "$FACTORY_ID",
    "ectoFaucet": "$ECTO_FAUCET_ID",
    "usdcFaucet": "$USDC_FAUCET_ID"
  },
  "coinTypes": {
    "ECTO": "${PACKAGE_ID}::ecto::ECTO",
    "USDC": "${PACKAGE_ID}::usdc::USDC"
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo ""
echo -e "${GREEN}Summary saved to:${NC} $SUMMARY_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update frontend/src/config/sui.ts with the new package ID and object IDs"
echo "2. Run: node scripts/update-config.js (if available)"
echo ""
