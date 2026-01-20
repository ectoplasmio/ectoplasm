// SUI Configuration for Ectoplasm DEX

export const SUI_CONFIG = {
  // Network configuration
  networks: {
    testnet: {
      name: 'SUI Testnet',
      url: 'https://fullnode.testnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/testnet',
    },
    mainnet: {
      name: 'SUI Mainnet',
      url: 'https://fullnode.mainnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/mainnet',
    },
  },

  // Default network
  defaultNetwork: 'testnet' as const,

  // Deployed package ID
  packageId: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081',

  // Factory object (shared)
  factoryId: '0x67a6ad1736426b5b637514d690829679d6753ff02f3161ec0466e40b1a2a9f73',

  // Treasury caps for minting test tokens
  treasuryCaps: {
    ECTO: '0x42f69e1c98e3b14bf8f7e1b7c5099a60a5c94abdfe01d7f5057b4a5e07739aaa',
    USDC: '0xdabce8645319f64819128cb5cd92adde0b7044d503806574aec2ff368b5fbf3f',
  },

  // Pool configurations
  pools: {
    'ECTO-USDC': {
      poolId: '0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0',
      coinTypeA: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::ecto::ECTO',
      coinTypeB: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::usdc::USDC',
      decimalsA: 9,
      decimalsB: 6,
    },
  },

  // Token configurations
  tokens: {
    SUI: {
      symbol: 'SUI',
      name: 'Sui',
      coinType: '0x2::sui::SUI',
      decimals: 9,
      logoUrl: '/sui-logo.svg',
    },
    ECTO: {
      symbol: 'ECTO',
      name: 'Ectoplasm',
      coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::ecto::ECTO',
      decimals: 9,
      logoUrl: '/ecto-logo.svg',
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      coinType: '0xefc27145b92094d1675dbdf1b6d5f4d26277fb1e4da73779fe302064b91ba081::usdc::USDC',
      decimals: 6,
      logoUrl: '/usdc-logo.svg',
    },
  },

  // Default settings
  defaults: {
    slippageBps: 50, // 0.5%
    deadlineMinutes: 20,
    swapFeeBps: 30, // 0.3%
  },
} as const;

// Type exports
export type NetworkType = keyof typeof SUI_CONFIG.networks;
export type TokenSymbol = keyof typeof SUI_CONFIG.tokens;
export type PoolPair = keyof typeof SUI_CONFIG.pools;

// Helper functions
export function getTokenBySymbol(symbol: string) {
  return SUI_CONFIG.tokens[symbol as TokenSymbol];
}

export function getTokenByCoinType(coinType: string) {
  return Object.values(SUI_CONFIG.tokens).find(t => t.coinType === coinType);
}

export function getPoolByPair(pair: string) {
  return SUI_CONFIG.pools[pair as PoolPair];
}

export function getExplorerUrl(type: 'tx' | 'object' | 'address', id: string, network: NetworkType = 'testnet') {
  const baseUrl = SUI_CONFIG.networks[network].explorerUrl;
  const paths = {
    tx: 'tx',
    object: 'object',
    address: 'account',
  };
  return `${baseUrl}/${paths[type]}/${id}`;
}

export function formatAmount(amount: bigint | string | number, decimals: number): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${integerPart}.${fractionalStr}`;
}

export function parseAmount(amount: string, decimals: number): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integerPart + paddedFractional);
}
