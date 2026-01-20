import React from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export function Launchpad() {
  const currentAccount = useCurrentAccount();
  const connected = !!currentAccount;

  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-copy" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div className="brand-badge">
              <img src="/assets/electoplasmlogo.png" width="26" height="26" alt="" />
              <span>Launchpad</span>
            </div>
            <h1>Token Launchpad Coming Soon</h1>
            <p className="lead">
              Create and launch tokens with bonding curves on SUI.
              This feature is currently under development.
            </p>

            <div className="coming-soon-box" style={{
              background: 'var(--bg-highlight)',
              borderRadius: '12px',
              padding: '32px',
              marginTop: '32px'
            }}>
              <h3>What's Coming</h3>
              <ul style={{ textAlign: 'left', marginTop: '16px' }}>
                <li>Deploy tokens with customizable bonding curves</li>
                <li>Auto-liquidity routing when curve graduates</li>
                <li>Transparent on-chain token creation</li>
                <li>Token discovery and trading</li>
              </ul>
            </div>

            <div style={{ marginTop: '32px' }}>
              {!connected ? (
                <ConnectButton connectText="Connect Wallet" />
              ) : (
                <p className="muted">Connected and ready for launch!</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2>Why Ectoplasm Launchpad?</h2>
            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginTop: '32px' }}>
              <div className="feature-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <h3>Fair Launch</h3>
                <p className="muted">No presales, no insider advantages. Everyone starts at the same price.</p>
              </div>
              <div className="feature-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <h3>Bonding Curves</h3>
                <p className="muted">Automatic price discovery through mathematical bonding curves.</p>
              </div>
              <div className="feature-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <h3>Auto-Liquidity</h3>
                <p className="muted">When curve graduates, liquidity is automatically added to DEX.</p>
              </div>
              <div className="feature-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <h3>On-Chain</h3>
                <p className="muted">All token data and rules are stored on SUI blockchain.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Launchpad;
