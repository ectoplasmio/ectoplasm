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
            <h1>ECTO Staking</h1>
            <p>Stake ECTO tokens to earn rewards. Lock for longer periods to receive bonus multipliers.</p>
          </div>

          <StakingCard />

          <div className="hero-copy staking-copy active">
            <div className="info-box">
              <h3>How Staking Works</h3>
              <ul>
                <li><strong>Stake ECTO</strong> - Deposit your ECTO tokens into the staking pool</li>
                <li><strong>Choose Lock Period</strong> - Optional lock periods offer higher reward multipliers</li>
                <li><strong>Earn Rewards</strong> - Accumulate ECTO rewards over time based on your stake</li>
                <li><strong>Claim Anytime</strong> - Claim rewards without unstaking your position</li>
                <li><strong>Unstake</strong> - Withdraw your ECTO once the lock period ends</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Staking;
