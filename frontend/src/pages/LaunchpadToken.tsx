import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useLaunchpad } from '../hooks/useLaunchpad';
import { useWallet } from '../contexts/WalletContext';
import { getExplorerUrl } from '../config/sui';
import './Launchpad.css';

type TradeTab = 'buy' | 'sell';

export function LaunchpadToken() {
  const { curveHash } = useParams<{ curveHash: string }>();
  const currentAccount = useCurrentAccount();
  const connected = !!currentAccount;
  const { balances } = useWallet();

  const {
    selectedToken,
    selectToken,
    buy,
    sell,
    getBuyQuote,
    getSellQuote,
    isLoading,
    error,
  } = useLaunchpad();

  const [activeTab, setActiveTab] = useState<TradeTab>('buy');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Load token on mount
  useEffect(() => {
    if (curveHash) {
      selectToken(curveHash);
    }
  }, [curveHash, selectToken]);

  // Get quote based on active tab and amount
  const quote = useMemo(() => {
    if (!curveHash || !amount || parseFloat(amount) <= 0) return null;

    if (activeTab === 'buy') {
      return getBuyQuote(curveHash, amount);
    } else {
      return getSellQuote(curveHash, amount);
    }
  }, [curveHash, activeTab, amount, getBuyQuote, getSellQuote]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const usdcBalance = balances.USDC?.formatted || '0';

  // For sell tab, we'd need to get the token balance
  // This would require querying user's coins of the token type

  const handleTrade = async () => {
    if (!curveHash || !amount || parseFloat(amount) <= 0) return;

    setTxHash(null);

    let result: string | null = null;

    if (activeTab === 'buy') {
      // For buy, amount is USDC input, minTokensOut is from quote with some slippage
      const minOut = quote?.tokensOut
        ? (parseFloat(quote.tokensOut) * 0.95).toString() // 5% slippage
        : '0';
      result = await buy(curveHash, amount, minOut);
    } else {
      // For sell, amount is token input, minUsdcOut is from quote with slippage
      const minOut = quote?.usdcOut
        ? (parseFloat(quote.usdcOut) * 0.95).toString()
        : '0';
      result = await sell(curveHash, amount, minOut);
    }

    if (result) {
      setTxHash(result);
      setAmount('');
    }
  };

  const handleMaxClick = () => {
    if (activeTab === 'buy') {
      setAmount(usdcBalance);
    }
    // For sell, would need to get token balance
  };

  // Loading state
  if (!selectedToken && !error) {
    return (
      <main className="launchpad-main">
        <section className="hero">
          <div className="container">
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading token...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Not found state
  if (!selectedToken) {
    return (
      <main className="launchpad-main">
        <section className="hero">
          <div className="container">
            <div className="not-found-state">
              <h1>Token Not Found</h1>
              <p className="lead">
                The requested bonding curve could not be found.
              </p>
              {curveHash && (
                <p className="muted" style={{ wordBreak: 'break-all' }}>
                  ID: {curveHash}
                </p>
              )}
              <Link to="/launchpad" className="btn primary" style={{ marginTop: '24px' }}>
                Back to Launchpad
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="launchpad-main token-detail-page">
      {/* Back link */}
      <div className="container">
        <Link to="/launchpad" className="back-link">
          &larr; Back to Launchpad
        </Link>
      </div>

      {/* Token Header */}
      <section className="token-header-section">
        <div className="container">
          <div className="token-header-content">
            <div className="token-identity-large">
              {selectedToken.imageUrl ? (
                <img
                  src={selectedToken.imageUrl}
                  alt={selectedToken.symbol}
                  className="token-image-large"
                />
              ) : (
                <div className="token-image-placeholder-large">
                  {selectedToken.symbol.charAt(0)}
                </div>
              )}
              <div className="token-info">
                <h1>{selectedToken.name}</h1>
                <span className="token-symbol-large">${selectedToken.symbol}</span>
                {selectedToken.graduated && (
                  <span className="status-badge graduated">Graduated</span>
                )}
                {selectedToken.paused && (
                  <span className="status-badge paused">Paused</span>
                )}
              </div>
            </div>

            <div className="token-price-display">
              <span className="price-label">Current Price</span>
              <span className="price-value">${selectedToken.currentPrice}</span>
            </div>
          </div>

          {selectedToken.description && (
            <p className="token-description-full">{selectedToken.description}</p>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="token-main-section">
        <div className="container">
          <div className="token-detail-grid">
            {/* Trading Card */}
            <div className="trading-card card">
              <div className="card-header">
                <div className="tab-buttons">
                  <button
                    className={`tab-button ${activeTab === 'buy' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('buy'); setAmount(''); }}
                  >
                    Buy
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'sell' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('sell'); setAmount(''); }}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div className="card-body">
                {!connected ? (
                  <div className="connect-wallet-prompt">
                    <p>Connect your wallet to trade</p>
                    <ConnectButton connectText="Connect Wallet" />
                  </div>
                ) : selectedToken.graduated ? (
                  <div className="graduated-notice">
                    <p>This token has graduated!</p>
                    <p className="muted">
                      Trading is now available on the main DEX.
                    </p>
                    <Link to="/swap" className="btn primary">
                      Trade on DEX
                    </Link>
                  </div>
                ) : selectedToken.paused ? (
                  <div className="paused-notice">
                    <p>Trading is currently paused for this token.</p>
                  </div>
                ) : (
                  <div className="trade-form">
                    <div className="input-group">
                      <label>
                        {activeTab === 'buy' ? 'You Pay (USDC)' : `You Sell (${selectedToken.symbol})`}
                      </label>
                      <div className="input-with-max">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={isLoading}
                        />
                        <button
                          className="max-btn"
                          onClick={handleMaxClick}
                          disabled={isLoading}
                        >
                          MAX
                        </button>
                      </div>
                      {activeTab === 'buy' && (
                        <span className="balance-hint">Balance: {usdcBalance} USDC</span>
                      )}
                    </div>

                    {quote && (
                      <div className="trade-preview">
                        <div className="preview-row">
                          <span>You Receive:</span>
                          <span className="highlight">
                            {activeTab === 'buy'
                              ? `${quote.tokensOut} ${selectedToken.symbol}`
                              : `${quote.usdcOut} USDC`}
                          </span>
                        </div>
                        <div className="preview-row small">
                          <span>Protocol Fee:</span>
                          <span>${quote.protocolFee}</span>
                        </div>
                        <div className="preview-row small">
                          <span>Creator Fee:</span>
                          <span>${quote.creatorFee}</span>
                        </div>
                      </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    {txHash && (
                      <div className="success-message">
                        Trade successful!{' '}
                        <a
                          href={getExplorerUrl('tx', txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View transaction
                        </a>
                      </div>
                    )}

                    <button
                      className="trade-button primary-button"
                      onClick={handleTrade}
                      disabled={isLoading || !amount || parseFloat(amount) <= 0}
                    >
                      {isLoading
                        ? 'Processing...'
                        : activeTab === 'buy'
                          ? `Buy ${selectedToken.symbol}`
                          : `Sell ${selectedToken.symbol}`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Token Info Card */}
            <div className="token-info-card card">
              <div className="card-header">
                <h3>Token Information</h3>
              </div>
              <div className="card-body">
                <div className="info-rows">
                  <div className="info-row">
                    <span className="info-label">Market Cap</span>
                    <span className="info-value">${selectedToken.marketCap}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Total Volume</span>
                    <span className="info-value">${selectedToken.volume}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Tokens Sold</span>
                    <span className="info-value">{selectedToken.tokensSold}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">USDC Reserve</span>
                    <span className="info-value">${selectedToken.usdcReserve}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Creator Fee</span>
                    <span className="info-value">{selectedToken.creatorFeeBps / 100}%</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Creator</span>
                    <span className="info-value">
                      <a
                        href={getExplorerUrl('address', selectedToken.creator)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {formatAddress(selectedToken.creator)}
                      </a>
                    </span>
                  </div>
                </div>

                {/* Graduation Progress */}
                <div className="graduation-section">
                  <h4>Graduation Progress</h4>
                  <div className="graduation-progress">
                    <div className="progress-header">
                      <span>Market Cap</span>
                      <span>${selectedToken.marketCap} / ${selectedToken.graduationThreshold}</span>
                    </div>
                    <div className="progress-bar large">
                      <div
                        className="progress-fill"
                        style={{ width: `${selectedToken.progress}%` }}
                      />
                    </div>
                    <div className="progress-percentage">
                      {selectedToken.progress}% complete
                    </div>
                  </div>
                </div>

                {/* Curve ID */}
                <div className="curve-id-section">
                  <span className="info-label">Curve ID</span>
                  <code className="curve-id">{selectedToken.id}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LaunchpadToken;
