import { useState, useCallback, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SUI_CONFIG, getExplorerUrl } from '../config/sui';

export interface TransactionRecord {
  digest: string;
  timestamp: number;
  type: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'faucet' | 'transfer' | 'unknown';
  status: 'success' | 'failure';
  gasUsed: string;
  explorerUrl: string;
  summary?: string;
}

export function useTransactionHistory(limit: number = 10) {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = currentAccount?.address;

  const parseTransactionType = (tx: any): TransactionRecord['type'] => {
    try {
      // Check transaction for known patterns
      const txData = tx.transaction?.data?.transaction;
      if (!txData) return 'unknown';

      // Check for Move calls
      if (txData.kind === 'ProgrammableTransaction') {
        const transactions = txData.transactions || [];
        for (const t of transactions) {
          if (t.MoveCall) {
            const target = t.MoveCall.target || '';
            if (target.includes('::pool::swap')) return 'swap';
            if (target.includes('::pool::add_liquidity')) return 'addLiquidity';
            if (target.includes('::pool::remove_liquidity')) return 'removeLiquidity';
            if (target.includes('::ecto::faucet') || target.includes('::usdc::faucet')) return 'faucet';
          }
          if (t.TransferObjects) return 'transfer';
        }
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const getTransactionSummary = (type: TransactionRecord['type']): string => {
    switch (type) {
      case 'swap': return 'Token Swap';
      case 'addLiquidity': return 'Add Liquidity';
      case 'removeLiquidity': return 'Remove Liquidity';
      case 'faucet': return 'Faucet Mint';
      case 'transfer': return 'Token Transfer';
      default: return 'Transaction';
    }
  };

  const fetchTransactions = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch recent transactions for the user
      const result = await suiClient.queryTransactionBlocks({
        filter: {
          FromAddress: address,
        },
        options: {
          showInput: true,
          showEffects: true,
        },
        limit,
        order: 'descending',
      });

      const records: TransactionRecord[] = result.data.map((tx) => {
        const type = parseTransactionType(tx);
        const status = tx.effects?.status?.status === 'success' ? 'success' : 'failure';
        const gasUsed = tx.effects?.gasUsed
          ? ((BigInt(tx.effects.gasUsed.computationCost) + BigInt(tx.effects.gasUsed.storageCost)) / 1_000_000_000n).toString()
          : '0';
        const timestamp = tx.timestampMs ? Number(tx.timestampMs) : Date.now();

        return {
          digest: tx.digest,
          timestamp,
          type,
          status,
          gasUsed,
          explorerUrl: getExplorerUrl('tx', tx.digest),
          summary: getTransactionSummary(type),
        };
      });

      setTransactions(records);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [address, suiClient, limit]);

  // Fetch on mount and when address changes
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    refresh: fetchTransactions,
  };
}

export default useTransactionHistory;
