import { useEffect } from 'react';
import { StakingCard } from '../components/staking';

export function Staking() {
  // Add staking-page class to body for page-specific styling
  useEffect(() => {
    document.body.classList.add('staking-page');
    return () => {
      document.body.classList.remove('staking-page');
    };
  }, []);

  return (
    <main>
      <section className="hero staking-hero" id="staking">
        <div className="container staking-layout">
          <div className="staking-heading">
            <h1>Liquid Staking</h1>
            <p>Stake SUI to receive sSUI tokens that earn staking rewards while remaining liquid</p>
          </div>

          <StakingCard />

          <div className="hero-copy staking-copy active">
            <div className="info-box">
              <h3>About Liquid Staking</h3>
              <ul>
                <li><strong>Stake SUI</strong> - Receive sSUI tokens at the current exchange rate</li>
                <li><strong>Earn Rewards</strong> - sSUI value increases as staking rewards accumulate</li>
                <li><strong>Stay Liquid</strong> - Use sSUI in DeFi while earning staking rewards</li>
                <li><strong>Unstake Anytime</strong> - Burn sSUI to withdraw SUI (with unstaking period)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Staking;
