// SUI Configuration for Ectoplasm DEX
// Contract addresses can be overridden via environment variables

// Helper to get env var with fallback
const env = (key: string, fallback: string): string => {
  return (import.meta.env[key] as string) || fallback;
};

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
  defaultNetwork: env('VITE_SUI_NETWORK', 'testnet') as 'testnet' | 'mainnet',

  // Deployed package ID (main AMM/DEX)
  packageId: env('VITE_PACKAGE_ID', '0xbb6dc8ce73ba919a406d403091cc8aca57f61f86d62348fe9bd483cba8e4b685'),

  // Features package ID (staking, launchpad)
  featuresPackageId: env('VITE_FEATURES_PACKAGE_ID', '0xbb6dc8ce73ba919a406d403091cc8aca57f61f86d62348fe9bd483cba8e4b685'),

  // Factory object (shared)
  factoryId: env('VITE_FACTORY_ID', '0x3a61e22b50404844a1a050ddca117a18d83228f94a9caeb4895803b8cf956c2d'),

  // Staking configuration
  staking: {
    poolId: env('VITE_STAKING_POOL_ID', '0x59a191508103795bc8a1f2951c56b8b431dd9cb5b5bbf4d23ef44347fec95b36'),
    adminCapId: env('VITE_STAKING_ADMIN_CAP_ID', '0x437a66c3853ea707671db2dff9e808ff03fcc0fd20400010ec44f7cf0340cbc5'),
  },

  // Launchpad configuration
  launchpad: {
    configId: env('VITE_LAUNCHPAD_CONFIG_ID', '0xad4b336d5109e3d08ec6b58a26637ab8a86f54fe449da7566a18b7bf3f2d716a'),
    adminCapId: env('VITE_LAUNCHPAD_ADMIN_CAP_ID', '0x75364575849d028a7b835ccc31d63322433b7861d685cfb9dca97c2158593903'),
  },

  // Shared faucet objects for requesting test tokens
  faucets: {
    ECTO: env('VITE_ECTO_FAUCET_ID', '0x5a5ddd80bff0e3e79b66af4823f6c0346fb0cf5b7f736d6bda7a9e2accdeb9b4'),
    USDC: env('VITE_USDC_FAUCET_ID', '0x2841ce82162331d1bb8a1247c4fb58291bb387f24516c663b3b2cf3de6632444'),
  },

  // Pool configurations
  pools: {
    'ECTO-USDC': {
      poolId: env('VITE_ECTO_USDC_POOL_ID', '0x4a9dbaa23c118cb6abd8063f073ede7df3dc3d2e28e422af4865a527dd3329d0'),
      get coinTypeA() { return `${SUI_CONFIG.packageId}::ecto::ECTO`; },
      get coinTypeB() { return `${SUI_CONFIG.packageId}::usdc::USDC`; },
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
      get coinType() { return `${SUI_CONFIG.packageId}::ecto::ECTO`; },
      decimals: 9,
      logoUrl: '/ecto-logo.svg',
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      get coinType() { return `${SUI_CONFIG.packageId}::usdc::USDC`; },
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
};

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
