import { useCurrentAccount } from '@mysten/dapp-kit';
import { useStaking, LOCK_OPTIONS } from '../../hooks/useStaking';

export function UnstakeTab() {
  const currentAccount = useCurrentAccount();
  const {
    positions,
    unstake,
    claimRewards,
    loading,
    error,
  } = useStaking();

  const connected = !!currentAccount;

  const formatTimeRemaining = (unlockTime: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = unlockTime - now;

    if (remaining <= 0) return 'Unlocked';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Less than 1h';
  };

  const getLockLabel = (lockPeriod: number): string => {
    const option = LOCK_OPTIONS.find(o => o.days * 86400 === lockPeriod);
    return option?.label || `${Math.floor(lockPeriod / 86400)} days`;
  };

  const getBonusLabel = (multiplier: number): string => {
    return `${(multiplier / 10000).toFixed(2)}x`;
  };

  if (positions.length === 0) {
    return (
      <div className="unstake-tab">
        <div className="empty-state">
          <p>You don't have any staked positions.</p>
          <p className="hint">Stake ECTO tokens in the Stake tab to start earning rewards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unstake-tab">
      <h4>Your Positions</h4>

      {error && <div className="error-message">{error}</div>}

      <div className="positions-list">
        {positions.map((position) => (
          <div key={position.id} className={`position-card ${position.isUnlocked ? 'unlocked' : 'locked'}`}>
            <div className="position-header">
              <span className="position-amount">{position.amount} ECTO</span>
              <span className={`position-status ${position.isUnlocked ? 'unlocked' : 'locked'}`}>
                {position.isUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>

            <div className="position-details">
              <div className="detail-row">
                <span>Lock Period:</span>
                <span>{getLockLabel(position.lockPeriod)}</span>
              </div>
              <div className="detail-row">
                <span>Bonus Multiplier:</span>
                <span>{getBonusLabel(position.bonusMultiplier)}</span>
              </div>
              <div className="detail-row">
                <span>Status:</span>
                <span>{formatTimeRemaining(position.unlockTime)}</span>
              </div>
              <div className="detail-row highlight">
                <span>Pending Rewards:</span>
                <span>{position.pendingRewards} ECTO</span>
              </div>
            </div>

            <div className="position-actions">
              <button
                className="action-btn secondary"
                onClick={() => claimRewards(position.id)}
                disabled={loading || parseFloat(position.pendingRewards) <= 0}
              >
                {loading ? '...' : 'Claim Rewards'}
              </button>
              <button
                className="action-btn primary"
                onClick={() => unstake(position.id)}
                disabled={loading || !position.isUnlocked}
                title={position.isUnlocked ? 'Unstake' : 'Position is still locked'}
              >
                {loading ? '...' : 'Unstake'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
