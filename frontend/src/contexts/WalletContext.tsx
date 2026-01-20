import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { SUI_CONFIG, formatAmount } from '../config/sui';

export interface BalanceResult {
  raw: bigint;
  formatted: string;
  decimals: number;
}

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  balances: Record<string, BalanceResult>;
  error: string | null;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [balances, setBalances] = useState<Record<string, BalanceResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connected = !!currentAccount;
  const address = currentAccount?.address ?? null;

  // Fetch all token balances for the connected account
  const refreshBalances = useCallback(async () => {
    if (!address) {
      setBalances({});
      return;
    }

    try {
      setError(null);
      const newBalances: Record<string, BalanceResult> = {};

      // Fetch balances for all configured tokens
      for (const [symbol, token] of Object.entries(SUI_CONFIG.tokens)) {
        try {
          const balance = await suiClient.getBalance({
            owner: address,
            coinType: token.coinType,
          });

          newBalances[symbol] = {
            raw: BigInt(balance.totalBalance),
            formatted: formatAmount(BigInt(balance.totalBalance), token.decimals),
            decimals: token.decimals,
          };
        } catch (err) {
          console.error(`Failed to fetch ${symbol} balance:`, err);
          newBalances[symbol] = {
            raw: 0n,
            formatted: '0',
            decimals: token.decimals,
          };
        }
      }

      setBalances(newBalances);
    } catch (err: any) {
      console.error('Failed to fetch balances:', err);
      setError(err.message || 'Failed to fetch balances');
    }
  }, [address, suiClient]);

  // Refresh balances when account changes
  useEffect(() => {
    if (address) {
      refreshBalances();
    } else {
      setBalances({});
    }
  }, [address, refreshBalances]);

  // Refresh balances periodically when connected
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(refreshBalances, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [connected, refreshBalances]);

  const value: WalletContextType = {
    connected,
    connecting,
    address,
    balances,
    error,
    refreshBalances,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletContext;
