import React from 'react';
import { useTransactionHistory, TransactionRecord } from '../../hooks/useTransactionHistory';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface TransactionHistoryProps {
  limit?: number;
  showTitle?: boolean;
}

const getTypeIcon = (type: TransactionRecord['type']): string => {
  switch (type) {
    case 'swap': return '🔄';
    case 'addLiquidity': return '💧';
    case 'removeLiquidity': return '📤';
    case 'faucet': return '🚰';
    case 'transfer': return '➡️';
    default: return '📝';
  }
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) return 'Just now';
  // Less than 1 hour
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  // Less than 24 hours
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  // More than 24 hours
  return date.toLocaleDateString();
};

export function TransactionHistory({ limit = 5, showTitle = true }: TransactionHistoryProps) {
  const currentAccount = useCurrentAccount();
  const { transactions, loading, error, refresh } = useTransactionHistory(limit);

  const connected = !!currentAccount;

  if (!connected) {
    return (
      <div className="tx-history empty">
        <p className="muted">Connect wallet to view transaction history</p>
      </div>
    );
  }

  return (
    <div className="tx-history">
      {showTitle && (
        <div className="tx-history-header">
          <h4>Recent Transactions</h4>
          <button
            className="btn ghost small"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      )}

      {loading && transactions.length === 0 && (
        <div className="tx-history-loading">
          <p className="muted">Loading transactions...</p>
        </div>
      )}

      {error && (
        <div className="tx-history-error">
          <p className="muted">{error}</p>
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <div className="tx-history-empty">
          <p className="muted">No recent transactions</p>
        </div>
      )}

      {transactions.length > 0 && (
        <ul className="tx-list">
          {transactions.map((tx) => (
            <li key={tx.digest} className={`tx-item ${tx.status}`}>
              <div className="tx-icon">{getTypeIcon(tx.type)}</div>
              <div className="tx-info">
                <div className="tx-summary">
                  <span className="tx-type">{tx.summary}</span>
                  <span className={`tx-status ${tx.status}`}>
                    {tx.status === 'success' ? '✓' : '✗'}
                  </span>
                </div>
                <div className="tx-meta">
                  <span className="tx-time">{formatTime(tx.timestamp)}</span>
                  <span className="tx-gas">{tx.gasUsed} SUI gas</span>
                </div>
              </div>
              <a
                href={tx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
                title="View on explorer"
              >
                ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TransactionHistory;
