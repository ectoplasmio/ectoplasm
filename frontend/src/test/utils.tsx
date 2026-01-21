import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

/**
 * Create a new QueryClient for testing
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock wallet context value
 */
export const mockWalletContext = {
  connected: true,
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  balances: {
    SUI: {
      raw: BigInt('1000000000000'),
      formatted: '1000',
    },
    ECTO: {
      raw: BigInt('500000000000'),
      formatted: '500',
    },
    USDC: {
      raw: BigInt('1000000000'),
      formatted: '1000',
    },
  },
  refreshBalances: vi.fn(),
};

/**
 * Mock DexContext value
 */
export const mockDexContext = {
  service: {
    getPoolReserves: vi.fn().mockResolvedValue({
      reserveA: BigInt('1000000000000'),
      reserveB: BigInt('1000000000'),
    }),
    getSwapQuote: vi.fn().mockResolvedValue({
      amountOut: BigInt('990000000'),
      priceImpact: 0.1,
    }),
    buildSwapTransaction: vi.fn(),
  },
  config: {
    packageId: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081',
    factoryId: '0x67a6ad1736426b5b637514d690829679d6753ff02f3161ec0466e40b1a2a9f73',
    pools: {
      'ECTO-USDC': {
        poolId: '0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0',
        coinTypeA: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::ecto::ECTO',
        coinTypeB: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::usdc::USDC',
        decimalsA: 9,
        decimalsB: 6,
      },
    },
    tokens: {
      ECTO: {
        symbol: 'ECTO',
        name: 'Ectoplasm',
        decimals: 9,
        coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::ecto::ECTO',
      },
      USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::usdc::USDC',
      },
    },
  },
};

/**
 * Test wrapper with all providers
 */
interface TestWrapperProps {
  children: ReactNode;
}

function createTestWrapper() {
  const queryClient = createTestQueryClient();

  return function TestWrapper({ children }: TestWrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render function that wraps components with providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: createTestWrapper(),
    ...options,
  });
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock function that rejects
 */
export function createRejectingMock(error: string | Error) {
  return vi.fn().mockRejectedValue(
    typeof error === 'string' ? new Error(error) : error
  );
}

/**
 * Format amount for display comparison
 */
export function formatTestAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${integerPart}.${fractionalStr}`;
}

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
