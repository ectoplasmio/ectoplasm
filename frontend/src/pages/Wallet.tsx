import React, { useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../contexts/WalletContext';
import { SUI_CONFIG } from '../config/sui';

export function Wallet() {
  const currentAccount = useCurrentAccount();
  const { balances, refreshBalances } = useWallet();
  const [refreshing, setRefreshing] = useState(false);

  const connected = !!currentAccount;
  const address = currentAccount?.address;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalances();
    setRefreshing(false);
  };

  // Get all token symbols
  const tokenSymbols = Object.keys(SUI_CONFIG.tokens) as (keyof typeof SUI_CONFIG.tokens)[];

  if (!connected) {
    return (
      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-copy" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <p className="eyebrow">Wallet</p>
              <h1>Connect your wallet</h1>
              <p className="lead">
                Connect your SUI wallet to view your token balances and manage your assets.
              </p>
              <ConnectButton connectText="Connect Wallet" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="wallet-header">
            <div>
              <p className="eyebrow">Wallet</p>
              <h1>Your Assets</h1>
              <p className="muted">
                Connected: {address?.slice(0, 8)}...{address?.slice(-6)}
              </p>
            </div>
            <button
              className="btn ghost"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Balances'}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {/* Token List */}
          <div className="wallet-tokens">
            <div className="wallet-tokens-header">
              <h2>Token Balances</h2>
            </div>

            <div className="token-list">
              {tokenSymbols.map((symbol) => {
                const token = SUI_CONFIG.tokens[symbol];
                const balance = balances[symbol];

                return (
                  <div key={symbol} className="token-list-item">
                    <div className="token-info">
                      <div className="token-icon">
                        {symbol.charAt(0)}
                      </div>
                      <div className="token-details">
                        <strong>{symbol}</strong>
                        <span className="muted tiny">{token?.name}</span>
                      </div>
                    </div>
                    <div className="token-balance">
                      <span className="balance-amount">
                        {balance?.formatted || '0'}
                      </span>
                      <span className="muted tiny">{symbol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note about token balances */}
          <div className="wallet-note" style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-highlight)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
              Token balances are fetched directly from SUI blockchain.
              Use the Faucet page to get test tokens.
            </p>
          </div>

          {/* Token Contract Info */}
          <div className="wallet-info" style={{ marginTop: '24px' }}>
            <h3>Token Contracts (Testnet)</h3>
            <div className="contract-list">
              {tokenSymbols.map((symbol) => {
                const token = SUI_CONFIG.tokens[symbol];
                return (
                  <div key={symbol} className="contract-item">
                    <span className="contract-symbol">{symbol}</span>
                    <code className="contract-hash" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                      {token?.coinType}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Wallet;
