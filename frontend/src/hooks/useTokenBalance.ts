import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SUI_CONFIG, formatAmount } from '../config/sui';

export interface BalanceResult {
  raw: bigint;
  formatted: string;
  decimals: number;
}

type TokenSymbol = keyof typeof SUI_CONFIG.tokens;

export function useTokenBalance(symbol: string) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { balances } = useWallet();

  const [balance, setBalance] = useState<BalanceResult>({
    raw: 0n,
    formatted: '0',
    decimals: 9
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = !!currentAccount;
  const address = currentAccount?.address;

  // Sync with context balances immediately
  useEffect(() => {
    const upperSymbol = symbol.toUpperCase();
    if (balances[upperSymbol]) {
      setBalance(balances[upperSymbol]);
    }
  }, [balances, symbol]);

  const refresh = useCallback(async () => {
    if (!address || !connected) {
      setBalance({ raw: 0n, formatted: '0', decimals: 9 });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const upperSymbol = symbol.toUpperCase() as TokenSymbol;
      const token = SUI_CONFIG.tokens[upperSymbol];

      if (!token) {
        throw new Error(`Unknown token ${symbol}`);
      }

      const result = await suiClient.getBalance({
        owner: address,
        coinType: token.coinType,
      });

      const raw = BigInt(result.totalBalance);
      setBalance({
        raw,
        formatted: formatAmount(raw, token.decimals),
        decimals: token.decimals
      });
    } catch (err: any) {
      setError(err.message);
      console.error(`Error fetching ${symbol} balance:`, err);
    } finally {
      setLoading(false);
    }
  }, [address, connected, symbol, suiClient]);

  return {
    balance: balance.formatted,
    balanceRaw: balance.raw,
    decimals: balance.decimals,
    loading,
    error,
    refresh
  };
}

export default useTokenBalance;
