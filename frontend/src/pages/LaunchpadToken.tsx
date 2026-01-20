import React from 'react';
import { useParams, Link } from 'react-router-dom';

export function LaunchpadToken() {
  const { curveHash } = useParams<{ curveHash: string }>();

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="hero-copy" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Token Not Found</h1>
            <p className="lead">
              The launchpad feature is not yet implemented on SUI.
              Token trading on bonding curves will be available soon.
            </p>

            {curveHash && (
              <p className="muted" style={{ marginTop: '16px', wordBreak: 'break-all' }}>
                Requested: {curveHash}
              </p>
            )}

            <div style={{ marginTop: '32px' }}>
              <Link to="/launchpad" className="btn primary">
                Back to Launchpad
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LaunchpadToken;
