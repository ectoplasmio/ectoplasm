import { Link } from 'react-router-dom';
import { LandingSwapCard } from '../components/swap';

export function Home() {
  return (
    <main>
      {/* Hero Section with Swap */}
      <section className="hero swap-hero" id="swap">
        {/* Liquid blob animations */}
        <div className="liquid-container">
          <div className="liquid-blob"></div>
          <div className="liquid-blob"></div>
          <div className="liquid-blob"></div>
          <div className="liquid-blob"></div>
          <div className="liquid-blob"></div>
        </div>

        <div className="container swap-layout">
          <div className="swap-heading">
            <h1>Swapping when & wherever you want to.</h1>
          </div>

          <LandingSwapCard />

          <div className="hero-copy swap-copy">
            <p className="lead">
              A focused swap card sits front and center. Connect your wallet, set slippage,
              and move between SUI tokens with clear routing and instant feedback.
            </p>
            <div className="hero-cta">
              <a href="#swap" className="btn primary large">Get started</a>
            </div>
            <ul className="trust-list">
              <li><strong>SUI Testnet</strong> live now</li>
              <li>Sub-second finality</li>
              <li>Wallet status shown inline</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <div className="container">
          <div className="section-heading">
            <div className="brand-mark" aria-hidden="true">
              <img src="/assets/electoplasmlogo.png" width="28" height="28" alt="" />
            </div>
            <div>
              <p className="muted small">Everything below the swap</p>
              <h2>Explore the pages that live beneath the swapper</h2>
            </div>
          </div>
          <div className="features-grid refined">
            <article className="feature-card">
              <div className="feature-meta">
                <span className="pill subtle">Core</span>
              </div>
              <h3>Swap</h3>
              <p>Lightning-fast SUI-native swapping with slippage control and a clean terminal anchored on the home page.</p>
              <a className="chip" href="#swap">Open swap terminal</a>
            </article>
            <article className="feature-card">
              <div className="feature-meta">
                <span className="pill subtle">Liquidity</span>
              </div>
              <h3>Liquidity & Farming</h3>
              <p>Depth-focused pools and rewards live on a dedicated liquidity page for LPs.</p>
              <Link className="chip" to="/liquidity">View liquidity tools</Link>
            </article>
            <article className="feature-card">
              <div className="feature-meta">
                <span className="pill subtle">Creation</span>
              </div>
              <h3>Launchpad</h3>
              <p>Pump.fun style token creation with bonding curves - coming soon to SUI.</p>
              <Link className="chip" to="/launchpad">See launchpad</Link>
            </article>
            <article className="feature-card">
              <div className="feature-meta">
                <span className="pill subtle">Retention</span>
              </div>
              <h3>Gamified Dashboard</h3>
              <p>Daily quests, streaks, and XP designed to pull users back every day.</p>
              <Link className="chip" to="/dashboard">Open dashboard</Link>
            </article>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section alt">
        <div className="container stats-grid" aria-label="Protocol performance highlights">
          <div className="stat-card">
            <p className="muted">Network</p>
            <strong>SUI</strong>
            <small>High-throughput L1 blockchain</small>
          </div>
          <div className="stat-card">
            <p className="muted">Transaction Speed</p>
            <strong>&lt;500ms</strong>
            <small>Near-instant finality</small>
          </div>
          <div className="stat-card">
            <p className="muted">Gas Fees</p>
            <strong>~$0.001</strong>
            <small>Extremely low transaction costs</small>
          </div>
          <div className="stat-card">
            <p className="muted">Object Model</p>
            <strong>Parallel</strong>
            <small>Scalable transaction processing</small>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section alt">
        <div className="container">
          <h2>How it works</h2>
          <ol className="steps">
            <li><strong>Land on the swapper</strong> — connect your SUI wallet and trade immediately.</li>
            <li><strong>Scroll for depth</strong> — see dashboards, liquidity tools, and launchpad access.</li>
            <li><strong>Return daily</strong> — quests, streaks, and on-chain tasks keep users engaged.</li>
          </ol>
        </div>
      </section>

      {/* Roadmap Section */}
      <section id="roadmap" className="section">
        <div className="container">
          <h2>Roadmap</h2>
          <ul className="roadmap">
            <li><strong>Phase 1:</strong> Testnet launch, basic swaps, liquidity pools</li>
            <li><strong>Phase 2:</strong> Launchpad with bonding curves, token creation</li>
            <li><strong>Phase 3:</strong> Mainnet deployment, governance, advanced features</li>
          </ul>
        </div>
      </section>

      {/* Security & Audits Section */}
      <section id="audit" className="section alt">
        <div className="container">
          <div className="section-heading">
            <div className="brand-mark" aria-hidden="true">
              <img src="/assets/electoplasmlogo.png" width="28" height="28" alt="" />
            </div>
            <h2>Security & Audits</h2>
          </div>
          <p>
            We prioritize safety. Smart contracts are written in Move, SUI's secure programming language,
            and will be audited by top firms before mainnet launch.
          </p>
          <div className="audit-logo" aria-label="Halborn audit partner">
            <img src="/assets/halborn-logo-black.svg" alt="Halborn logo" className="halborn-logo-light" />
            <img src="/assets/halborn-logo-green.svg" alt="Halborn logo" className="halborn-logo-dark" />
          </div>
          <ul className="safety-list">
            <li>Move language with built-in safety guarantees</li>
            <li>Object-centric model prevents common vulnerabilities</li>
            <li>Transparent on-chain verification</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default Home;
