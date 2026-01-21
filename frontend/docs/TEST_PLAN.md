# Ectoplasm SUI - Test Plan

This document outlines the comprehensive testing strategy for the Ectoplasm SUI frontend application.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [E2E Tests](#e2e-tests)
5. [Test Data & Mocks](#test-data--mocks)
6. [Running Tests](#running-tests)

---

## Testing Overview

### Testing Stack

- **Unit Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright
- **Coverage**: V8 provider via Vitest

### Test Categories

| Category | Tool | Directory | Purpose |
|----------|------|-----------|---------|
| Unit | Vitest | `src/**/*.test.tsx` | Component logic, hooks, utilities |
| Integration | Vitest | `src/**/*.test.tsx` | Component interactions, context |
| E2E | Playwright | `e2e/**/*.spec.ts` | Full user workflows |

---

## Unit Tests

### 1. Utility Functions

#### `src/lib/utils.test.ts`

| Test Case | Description |
|-----------|-------------|
| `formatAmount` | Correctly formats bigint amounts with decimals |
| `formatAmount` edge cases | Handles zero, very large numbers, maximum decimals |
| `parseAmount` | Converts string input to bigint with decimals |
| `parseAmount` edge cases | Handles invalid input, empty strings, negative numbers |
| `shortenAddress` | Truncates SUI addresses correctly |
| `calculatePriceImpact` | Computes price impact percentage |
| `calculateSlippage` | Computes slippage-adjusted amounts |

#### `src/lib/math.test.ts`

| Test Case | Description |
|-----------|-------------|
| `getAmountOut` | Calculates swap output using constant product formula |
| `getAmountIn` | Calculates required input for desired output |
| `calculateLpTokens` | Computes LP tokens for liquidity addition |
| `calculateWithdrawalAmounts` | Computes amounts for LP token burn |
| Fee calculation | Verifies fee deduction (0.3%) |

### 2. Custom Hooks

#### `src/hooks/useSwap.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Initial state | Returns correct default values |
| Quote calculation | Fetches and returns swap quote |
| Insufficient balance | Shows error for insufficient funds |
| Price impact warning | Warns when price impact > 1% |
| Swap execution | Calls transaction correctly |
| Error handling | Handles transaction failures gracefully |

#### `src/hooks/useLiquidity.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Pool reserves | Fetches and returns pool state |
| Add liquidity quote | Calculates LP tokens to receive |
| Remove liquidity quote | Calculates tokens to receive |
| Imbalanced add | Handles single-sided liquidity |
| Transaction building | Creates correct transaction payload |

#### `src/hooks/useStaking.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Staking info | Fetches user staking position |
| APR calculation | Returns correct APR |
| Stake execution | Stakes tokens correctly |
| Unstake execution | Unstakes with rewards |
| Claim rewards | Claims pending rewards |

#### `src/hooks/useLaunchpad.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Token list | Fetches launched tokens |
| Token creation | Creates new token correctly |
| Buy tokens | Purchases tokens on bonding curve |
| Sell tokens | Sells tokens back to curve |
| Graduation check | Detects graduation threshold |

### 3. Components

#### `src/components/SwapCard.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Renders correctly | Shows input fields and swap button |
| Token selection | Opens token selector modal |
| Amount input | Updates state on input change |
| Reverse tokens | Swaps input/output tokens |
| Max button | Sets input to max balance |
| Quote display | Shows output amount and rate |
| Disabled state | Button disabled when invalid |
| Loading state | Shows spinner during transaction |
| Success feedback | Shows success message after swap |
| Error feedback | Shows error message on failure |

#### `src/components/LiquidityPanel.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Add liquidity tab | Shows add liquidity form |
| Remove liquidity tab | Shows remove liquidity form |
| Pool share display | Shows user's pool share |
| Amount validation | Validates input amounts |
| Approval flow | Shows approval if needed |
| Transaction execution | Executes add/remove liquidity |

#### `src/components/StakingCard.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Staking stats | Shows TVL, APR, rewards |
| Stake input | Validates stake amount |
| Unstake input | Validates unstake amount |
| Pending rewards | Shows claimable rewards |
| Claim button | Claims rewards correctly |

#### `src/components/LaunchpadCard.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Token info | Displays token details |
| Bonding curve | Shows progress to graduation |
| Buy form | Validates buy amount |
| Sell form | Validates sell amount |
| Price display | Shows current token price |

#### `src/components/TokenCreator.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Form validation | Validates name, symbol, description |
| Image upload | Handles image selection |
| Submit flow | Creates token correctly |
| Error handling | Shows validation errors |

#### `src/components/Header.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Navigation links | Shows correct nav items |
| Wallet button | Shows connect/disconnect |
| Active route | Highlights current page |

### 4. Context Providers

#### `src/contexts/WalletContext.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Connected state | Provides wallet address and balances |
| Disconnected state | Returns null values |
| Balance refresh | Updates balances on refresh |

#### `src/contexts/DexContext.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Service initialization | Creates DexService instance |
| Config loading | Loads pool and token config |
| Error handling | Handles initialization errors |

---

## Integration Tests

### 1. Swap Flow Integration

#### `src/features/swap/Swap.integration.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Full swap flow | Select tokens → Enter amount → Execute swap |
| Quote updates | Quote refreshes on input change |
| Insufficient balance | Shows error, disables button |
| Wallet disconnected | Prompts wallet connection |

### 2. Liquidity Flow Integration

#### `src/features/liquidity/Liquidity.integration.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Add liquidity flow | Enter amounts → See share → Execute |
| Remove liquidity flow | Select percentage → See amounts → Execute |
| Pool selection | Switch between pools |

### 3. Staking Flow Integration

#### `src/features/staking/Staking.integration.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Stake flow | Enter amount → Execute stake |
| Unstake flow | Enter amount → Execute unstake |
| Claim rewards | View rewards → Claim |

### 4. Launchpad Flow Integration

#### `src/features/launchpad/Launchpad.integration.test.tsx`

| Test Case | Description |
|-----------|-------------|
| Token creation | Fill form → Create token |
| Token purchase | Select token → Buy |
| Token sale | Select token → Sell |

---

## E2E Tests

### Test Environment

- Base URL: `http://localhost:5173`
- Browser: Chromium
- Wallet: Mocked via browser extension injection

### 1. Navigation Tests

#### `e2e/navigation.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Home page loads | App loads without errors |
| Navigate to Swap | Click swap link, page loads |
| Navigate to Liquidity | Click liquidity link, page loads |
| Navigate to Staking | Click staking link, page loads |
| Navigate to Launchpad | Click launchpad link, page loads |
| 404 handling | Unknown routes show 404 page |

### 2. Swap Tests

#### `e2e/swap.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Swap page renders | All elements visible |
| Select input token | Token selector works |
| Select output token | Token selector works |
| Enter swap amount | Input accepts numbers |
| View swap quote | Quote displayed correctly |
| Reverse tokens | Click reverse button |
| Connect wallet prompt | Shows when disconnected |
| Execute swap (mocked) | Transaction flow completes |

### 3. Liquidity Tests

#### `e2e/liquidity.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Liquidity page renders | All elements visible |
| Select pool | Pool selector works |
| Enter amounts | Both inputs work |
| View pool share | Share percentage shown |
| Add liquidity (mocked) | Transaction flow completes |
| Remove liquidity (mocked) | Transaction flow completes |

### 4. Staking Tests

#### `e2e/staking.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Staking page renders | All elements visible |
| View staking stats | TVL, APR shown |
| Enter stake amount | Input works |
| Stake tokens (mocked) | Transaction flow completes |
| View rewards | Pending rewards shown |
| Claim rewards (mocked) | Transaction flow completes |

### 5. Launchpad Tests

#### `e2e/launchpad.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Launchpad page renders | All elements visible |
| View token list | Tokens displayed |
| Token detail page | Click token shows details |
| Create token form | Form renders correctly |
| Create token (mocked) | Creation flow completes |
| Buy token (mocked) | Purchase flow completes |
| Sell token (mocked) | Sale flow completes |

### 6. Responsive Design Tests

#### `e2e/responsive.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Mobile viewport | Layout adapts correctly |
| Tablet viewport | Layout adapts correctly |
| Desktop viewport | Layout adapts correctly |
| Mobile navigation | Hamburger menu works |

---

## Test Data & Mocks

### Mock Accounts

```typescript
// Test wallet address
const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Test balances
const TEST_BALANCES = {
  SUI: '1000000000000',   // 1000 SUI
  ECTO: '500000000000',   // 500 ECTO
  USDC: '1000000000',     // 1000 USDC
};
```

### Mock Pool State

```typescript
const TEST_POOL = {
  reserveA: BigInt('1000000000000'),  // 1000 ECTO
  reserveB: BigInt('1000000000'),     // 1000 USDC
  lpSupply: BigInt('31622776601'),    // sqrt(1000 * 1000) * 1e9
  feeBps: 30,                          // 0.3%
};
```

### Mock Transactions

```typescript
const MOCK_TX_RESULT = {
  digest: '0xabcdef...',
  effects: {
    status: { status: 'success' },
  },
};
```

---

## Running Tests

### Unit & Integration Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/components/SwapCard.test.tsx

# Run tests matching pattern
npm test -- --grep "swap"
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Run specific E2E test
npx playwright test e2e/swap.spec.ts

# Debug E2E test
npx playwright test --debug
```

### Coverage Targets

| Category | Target |
|----------|--------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

---

## Test File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── SwapCard.tsx
│   │   └── SwapCard.test.tsx
│   ├── hooks/
│   │   ├── useSwap.ts
│   │   └── useSwap.test.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   └── utils.test.ts
│   └── test/
│       ├── setup.ts
│       ├── utils.tsx
│       └── mocks/
│           └── sui.ts
├── e2e/
│   ├── navigation.spec.ts
│   ├── swap.spec.ts
│   ├── liquidity.spec.ts
│   ├── staking.spec.ts
│   └── launchpad.spec.ts
└── docs/
    └── TEST_PLAN.md
```

---

## CI/CD Integration

Tests should run in the CI pipeline:

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run test:coverage
    - run: npx playwright install --with-deps chromium
    - run: npm run test:e2e
```

---

## Priority Order

1. **High Priority** - Core functionality
   - Swap flow tests
   - Wallet connection tests
   - Balance display tests

2. **Medium Priority** - Feature completeness
   - Liquidity tests
   - Staking tests
   - Launchpad tests

3. **Lower Priority** - Polish
   - Responsive design tests
   - Edge case coverage
   - Performance tests
