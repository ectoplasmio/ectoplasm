import { vi } from 'vitest';

/**
 * Mock SUI account for testing
 */
export const mockAccount = {
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  publicKey: new Uint8Array(32),
  chains: ['sui:testnet'],
};

/**
 * Mock coin balances
 */
export const mockBalances = {
  SUI: {
    coinType: '0x2::sui::SUI',
    totalBalance: '1000000000000', // 1000 SUI
  },
  ECTO: {
    coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::ecto::ECTO',
    totalBalance: '500000000000', // 500 ECTO
  },
  USDC: {
    coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::usdc::USDC',
    totalBalance: '1000000000', // 1000 USDC
  },
};

/**
 * Mock pool reserves
 */
export const mockPoolReserves = {
  reserveA: BigInt('1000000000000'), // 1000 ECTO
  reserveB: BigInt('1000000000'),    // 1000 USDC
  lpSupply: BigInt('31622776601'),   // sqrt(1000 * 1000) * 1e9
};

/**
 * Mock transaction result
 */
export const mockTransactionResult = {
  digest: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  effects: {
    status: { status: 'success' },
    gasUsed: {
      computationCost: '1000000',
      storageCost: '500000',
      storageRebate: '100000',
    },
  },
  events: [],
};

/**
 * Create mock SuiClient
 */
export function createMockSuiClient() {
  return {
    getBalance: vi.fn().mockResolvedValue(mockBalances.SUI),
    getAllBalances: vi.fn().mockResolvedValue(Object.values(mockBalances)),
    getCoins: vi.fn().mockResolvedValue({
      data: [
        {
          coinObjectId: '0xabc123',
          balance: '1000000000000',
          coinType: '0x2::sui::SUI',
        },
      ],
      hasNextPage: false,
    }),
    getObject: vi.fn().mockResolvedValue({
      data: {
        objectId: '0xpool123',
        content: {
          dataType: 'moveObject',
          fields: {
            reserve_a: { value: mockPoolReserves.reserveA.toString() },
            reserve_b: { value: mockPoolReserves.reserveB.toString() },
            lp_supply: { value: mockPoolReserves.lpSupply.toString() },
            fee_bps: '30',
          },
        },
      },
    }),
    multiGetObjects: vi.fn().mockResolvedValue([]),
    queryEvents: vi.fn().mockResolvedValue({ data: [], hasNextPage: false }),
    signAndExecuteTransaction: vi.fn().mockResolvedValue(mockTransactionResult),
  };
}

/**
 * Create mock wallet hooks
 */
export function createMockWalletHooks(connected = true) {
  return {
    useCurrentAccount: vi.fn().mockReturnValue(connected ? mockAccount : null),
    useSuiClient: vi.fn().mockReturnValue(createMockSuiClient()),
    useSignAndExecuteTransaction: vi.fn().mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockTransactionResult),
      isPending: false,
    }),
    useDisconnectWallet: vi.fn().mockReturnValue({
      mutate: vi.fn(),
    }),
    useAccounts: vi.fn().mockReturnValue(connected ? [mockAccount] : []),
  };
}

/**
 * Mock @mysten/dapp-kit module
 */
export const mockDappKit = {
  useCurrentAccount: vi.fn().mockReturnValue(mockAccount),
  useSuiClient: vi.fn().mockReturnValue(createMockSuiClient()),
  useSignAndExecuteTransaction: vi.fn().mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(mockTransactionResult),
    isPending: false,
  }),
  useDisconnectWallet: vi.fn().mockReturnValue({
    mutate: vi.fn(),
  }),
  useAccounts: vi.fn().mockReturnValue([mockAccount]),
  ConnectButton: vi.fn(({ connectText }: { connectText: string }) =>
    `<button>${connectText}</button>`
  ),
};
