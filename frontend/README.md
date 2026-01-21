# Ectoplasm Frontend

React-based frontend application for Ectoplasm DEX on SUI blockchain.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **@mysten/dapp-kit** - SUI wallet integration
- **@mysten/sui** - SUI SDK for blockchain interaction
- **React Router** - Client-side routing

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- A SUI wallet extension (Sui Wallet, Suiet, etc.)

### Installation

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server runs at `http://localhost:5173`

## Project Structure

```
frontend/
├── public/                 # Static assets
│   └── assets/            # Images, logos
│
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── common/        # Shared components (Header, Footer)
│   │   ├── staking/       # Staking-specific components
│   │   └── launchpad/     # Launchpad-specific components
│   │
│   ├── pages/             # Page components
│   │   ├── Home.tsx       # Landing page
│   │   ├── Swap.tsx       # Token swap page
│   │   ├── Liquidity.tsx  # Liquidity management
│   │   ├── Staking.tsx    # Staking page
│   │   ├── Launchpad.tsx  # Token launchpad
│   │   ├── LaunchpadToken.tsx  # Individual token trading
│   │   ├── Wallet.tsx     # Wallet & balances
│   │   ├── Dashboard.tsx  # User dashboard
│   │   └── Faucet.tsx     # Testnet faucet
│   │
│   ├── hooks/             # Custom React hooks
│   │   ├── useSwap.ts     # Swap functionality
│   │   ├── useLiquidity.ts # Liquidity operations
│   │   ├── useStaking.ts  # Staking operations
│   │   ├── useLaunchpad.ts # Launchpad trading
│   │   └── useTokenBalance.ts # Token balance queries
│   │
│   ├── contexts/          # React contexts
│   │   ├── WalletContext.tsx  # Wallet state
│   │   ├── DexContext.tsx     # DEX service
│   │   └── ToastContext.tsx   # Notifications
│   │
│   ├── services/          # Blockchain services
│   │   └── dexService.ts  # DEX interaction logic
│   │
│   ├── config/            # Configuration
│   │   └── sui.ts         # SUI network config, addresses
│   │
│   ├── utils/             # Utility functions
│   │   ├── format.ts      # Number formatting
│   │   └── errors.ts      # Error handling
│   │
│   ├── types/             # TypeScript types
│   │
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Configuration

### Network Configuration (`src/config/sui.ts`)

```typescript
export const SUI_CONFIG = {
  // Network settings
  networks: {
    testnet: {
      name: 'SUI Testnet',
      url: 'https://fullnode.testnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/testnet',
    },
    mainnet: { /* ... */ },
  },

  // Deployed contract addresses
  packageId: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081',
  featuresPackageId: '0x9148054627665ef223218fef249e3b472fc80e7de4389c49cf8760ef815bbbe3',

  // Object IDs
  factoryId: '0x67a6ad1736426b5b637514d690829679d6753ff02f3161ec0466e40b1a2a9f73',

  // Pool configurations
  pools: {
    'ECTO-USDC': {
      poolId: '0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0',
      coinTypeA: '...::ecto::ECTO',
      coinTypeB: '...::usdc::USDC',
      decimalsA: 9,
      decimalsB: 6,
    },
  },

  // Token configurations
  tokens: {
    ECTO: { symbol: 'ECTO', decimals: 9, coinType: '...' },
    USDC: { symbol: 'USDC', decimals: 6, coinType: '...' },
  },
};
```

### Environment Variables

Create a `.env` file (optional):

```env
VITE_SUI_NETWORK=testnet
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with features overview |
| Swap | `/swap` | Token swap interface |
| Liquidity | `/liquidity` | Add/remove liquidity |
| Staking | `/staking` | Stake ECTO tokens |
| Launchpad | `/launchpad` | Browse launched tokens |
| LaunchpadToken | `/launchpad/:id` | Trade on bonding curve |
| Wallet | `/wallet` | View balances and history |
| Dashboard | `/dashboard` | User stats and activity |
| Faucet | `/faucet` | Get testnet tokens |

## Hooks

### `useSwap`
Handles token swapping with quotes and slippage.

```typescript
const {
  tokenIn, tokenOut,
  amountIn, amountOut,
  quote,
  loading,
  setAmountIn,
  switchTokens,
  executeSwap,
} = useSwap();
```

### `useLiquidity`
Manages liquidity pool operations.

```typescript
const {
  poolInfo,
  addLiquidity,
  removeLiquidity,
  loading,
} = useLiquidity();
```

### `useStaking`
Handles ECTO staking operations.

```typescript
const {
  poolInfo,
  positions,       // User's stake positions
  stakeAmount,
  lockOption,
  stake,
  unstake,
  claimRewards,
  loading,
} = useStaking();
```

### `useLaunchpad`
Manages launchpad token trading.

```typescript
const {
  tokens,          // All launched tokens
  selectedToken,   // Currently selected token
  configInfo,      // Protocol configuration
  buy,
  sell,
  getBuyQuote,
  getSellQuote,
  isLoading,
} = useLaunchpad();
```

## Contexts

### `WalletContext`
Provides wallet connection state and token balances.

```typescript
const { connected, address, balances, refreshBalances } = useWallet();
```

### `DexContext`
Provides DEX service for blockchain interactions.

```typescript
const { service, config } = useDex();
```

### `ToastContext`
Shows notifications for transactions.

```typescript
const { showToast, removeToast } = useToast();

// Usage
showToast('success', 'Transaction confirmed!');
showToast('error', 'Transaction failed');
showToast('pending', 'Waiting for confirmation...');
```

## Wallet Integration

The app uses `@mysten/dapp-kit` for wallet integration:

```typescript
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  ConnectButton
} from '@mysten/dapp-kit';

// Get current account
const account = useCurrentAccount();

// Sign and execute transactions
const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

// Access SUI client
const client = useSuiClient();

// Connect button component
<ConnectButton connectText="Connect Wallet" />
```

## Transaction Building

Transactions are built using Programmable Transaction Blocks (PTB):

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// Split coins for exact amount
const [coinIn] = tx.splitCoins(tx.object(coinId), [amount]);

// Call contract function
tx.moveCall({
  target: `${PACKAGE_ID}::router::swap_a_to_b`,
  typeArguments: [COIN_TYPE_A, COIN_TYPE_B],
  arguments: [
    tx.object(poolId),
    coinIn,
    tx.pure.u64(minAmountOut),
  ],
});

// Execute
const result = await signAndExecuteTransaction({
  transaction: tx,
});

console.log('Transaction digest:', result.digest);
```

## Styling

The app uses a custom CSS design system with CSS custom properties:

### Theme Variables

```css
:root {
  --bg-primary: #0a0a0f;
  --bg-card: #12121a;
  --bg-highlight: #1a1a2e;
  --text-primary: #ffffff;
  --text-muted: #8b8b9e;
  --accent-color: #00ff88;
  --accent-color-dark: #00cc6a;
  --border-color: #2a2a3e;
  --success-color: #22c55e;
  --error-color: #ef4444;
  --warning-color: #eab308;
}
```

### Component Styles

- Global styles in `src/index.css`
- Page-specific styles in `src/pages/*.css`
- Component styles co-located with components

## Building for Production

```bash
# Type check and build
npm run build

# Output is in dist/ folder
```

### Deployment

The `dist/` folder can be deployed to any static hosting:

- **Vercel** - `vercel deploy`
- **Netlify** - drag and drop or CLI
- **GitHub Pages** - with GitHub Actions
- **AWS S3 + CloudFront** - static hosting

## Development Tips

### Adding a New Page

1. Create component in `src/pages/NewPage.tsx`
2. Add route in `App.tsx`:
   ```typescript
   <Route path="/new-page" element={<NewPage />} />
   ```
3. Add link in navigation (Header component)

### Adding a New Hook

1. Create hook in `src/hooks/useNewFeature.ts`
2. Export from `src/hooks/index.ts`:
   ```typescript
   export { useNewFeature } from './useNewFeature';
   ```
3. Use in components

### Updating Contract Addresses

After deploying new contracts, update:

1. `src/config/sui.ts` - Package IDs and object IDs
2. Restart dev server to pick up changes

## Troubleshooting

### Transaction Type Mismatch

If you see Transaction type errors between `@mysten/sui` versions:

```typescript
// Cast to any to handle version mismatch
await signAndExecute({ transaction: tx as any });
```

### Wallet Not Connecting

1. Ensure you have a SUI wallet extension installed
2. Switch wallet to testnet network
3. Clear browser cache and reconnect
4. Try a different wallet if issues persist

### Balance Not Updating

Call `refreshBalances()` after transactions:

```typescript
const { refreshBalances } = useWallet();

// After transaction
await refreshBalances();
```

### RPC Rate Limiting

If you hit rate limits on the public RPC:

1. Add delays between requests
2. Use a dedicated RPC endpoint
3. Cache responses where appropriate

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript check |

## License

MIT
