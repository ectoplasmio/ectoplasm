// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'ectoplasm-theme',
  WALLET_TYPE: 'ectoplasm-wallet-type',
  SLIPPAGE: 'ectoplasm-slippage',
  DEADLINE: 'ectoplasm-deadline',
  DASHBOARD_STATE: 'ectoplasm-dashboard',
} as const;

// Theme values
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type Theme = typeof THEMES[keyof typeof THEMES];

// Wallet types supported (SUI ecosystem wallets via dapp-kit)
export const WALLET_TYPES = {
  SUI_WALLET: 'Sui Wallet',
  SUIET: 'Suiet',
  ETHOS: 'Ethos Wallet',
  MARTIAN: 'Martian Sui Wallet',
} as const;

export type WalletType = typeof WALLET_TYPES[keyof typeof WALLET_TYPES];
