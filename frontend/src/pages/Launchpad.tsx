import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useLaunchpad } from '../hooks/useLaunchpad';
import './Launchpad.css';

export function Launchpad() {
  const currentAccount = useCurrentAccount();
  const connected = !!currentAccount;
  const {
    tokens,
    configInfo,
    isLoading,
    error,
    refresh,
  } = useLaunchpad();

  // Add launchpad-page class to body
  useEffect(() => {
    document.body.classList.add('launchpad-page');
    return () => {
      document.body.classList.remove('launchpad-page');
    };
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusBadge = (token: typeof tokens[0]) => {
    if (token.graduated) return <span className="status-badge graduated">Graduated</span>;
    if (token.paused) return <span className="status-badge paused">Paused</span>;
    return <span className="status-badge live">Live</span>;
  };

  return (
    <main className="launchpad-main">
      {/* Hero Section */}
      <section className="hero launchpad-hero">
        <div className="container">
          <div className="launchpad-header">
            <div className="header-content">
              <div className="brand-badge">
                <img src="/assets/electoplasmlogo.png" width="26" height="26" alt="" />
                <span>Launchpad</span>
              </div>
              <h1>Token Launchpad</h1>
              <p className="lead">
                Discover and trade tokens with bonding curves.
                Buy early at lower prices, sell as demand grows.
              </p>
            </div>

            {/* Protocol Stats */}
            {configInfo && (
              <div className="protocol-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Launches</span>
                  <span className="stat-value">{configInfo.totalLaunches}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Volume</span>
                  <span className="stat-value">${configInfo.totalVolume}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Protocol Fee</span>
                  <span className="stat-value">{configInfo.protocolFeeBps / 100}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Token List Section */}
      <section className="section token-list-section">
        <div className="container">
          <div className="section-header">
            <h2>Active Tokens</h2>
            <button
              className="btn secondary refresh-btn"
              onClick={refresh}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="error-banner">
              <p>{error}</p>
            </div>
          )}

          {!connected && (
            <div className="connect-prompt">
              <p>Connect your wallet to trade on the launchpad</p>
              <ConnectButton connectText="Connect Wallet" />
            </div>
          )}

          {isLoading && tokens.length === 0 ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading tokens...</p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="empty-state">
              <h3>No Tokens Yet</h3>
              <p>Be the first to launch a token on Ectoplasm!</p>
              <div className="coming-soon-note">
                <p className="muted">
                  Token creation requires deploying a custom Move module with your token type.
                  This will be simplified with a token factory in a future update.
                </p>
              </div>
            </div>
          ) : (
            <div className="token-grid">
              {tokens.map((token) => (
                <Link
                  key={token.id}
                  to={`/launchpad/${token.id}`}
                  className="token-card"
                >
                  <div className="token-card-header">
                    <div className="token-identity">
                      {token.imageUrl ? (
                        <img
                          src={token.imageUrl}
                          alt={token.symbol}
                          className="token-image"
                        />
                      ) : (
                        <div className="token-image-placeholder">
                          {token.symbol.charAt(0)}
                        </div>
                      )}
                      <div className="token-names">
                        <h3>{token.name}</h3>
                        <span className="token-symbol">${token.symbol}</span>
                      </div>
                    </div>
                    {getStatusBadge(token)}
                  </div>

                  <p className="token-description">
                    {token.description || 'No description provided'}
                  </p>

                  <div className="token-stats">
                    <div className="token-stat">
                      <span className="stat-label">Price</span>
                      <span className="stat-value">${token.currentPrice}</span>
                    </div>
                    <div className="token-stat">
                      <span className="stat-label">Market Cap</span>
                      <span className="stat-value">${token.marketCap}</span>
                    </div>
                    <div className="token-stat">
                      <span className="stat-label">Volume</span>
                      <span className="stat-value">${token.volume}</span>
                    </div>
                  </div>

                  <div className="graduation-progress">
                    <div className="progress-header">
                      <span>Progress to Graduation</span>
                      <span>{token.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${token.progress}%` }}
                      />
                    </div>
                    <div className="progress-target">
                      Target: ${token.graduationThreshold}
                    </div>
                  </div>

                  <div className="token-footer">
                    <span className="creator">
                      By {formatAddress(token.creator)}
                    </span>
                    <span className="view-link">
                      Trade &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="section info-section">
        <div className="container">
          <h2>How It Works</h2>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">1</div>
              <h3>Buy Early</h3>
              <p>
                Purchase tokens at low prices on the bonding curve.
                The earlier you buy, the lower the price.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">2</div>
              <h3>Price Increases</h3>
              <p>
                As more people buy, the price increases along the curve.
                Your tokens become more valuable.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">3</div>
              <h3>Sell Anytime</h3>
              <p>
                Sell back to the curve at any time.
                You'll receive USDC based on the current price.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">4</div>
              <h3>Graduation</h3>
              <p>
                When market cap reaches the threshold, liquidity is
                automatically added to the DEX.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Launchpad;
