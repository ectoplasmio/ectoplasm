import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';
import { useStaking, LOCK_OPTIONS } from '../../hooks/useStaking';

export function StakeTab() {
  const currentAccount = useCurrentAccount();
  const { balances } = useWallet();
  const {
    poolInfo,
    stakeAmount,
    setStakeAmount,
    lockOption,
    setLockOption,
    stake,
    loading,
    error,
  } = useStaking();

  const connected = !!currentAccount;
  const ectoBalance = balances.ECTO?.formatted || '0';

  const handleMaxClick = () => {
    setStakeAmount(ectoBalance);
  };

  const handleStake = async () => {
    await stake();
  };

  const selectedLock = LOCK_OPTIONS[lockOption];
  const isDisabled = loading || !stakeAmount || parseFloat(stakeAmount) <= 0;

  return (
    <div className="stake-tab">
      {poolInfo?.paused && (
        <div className="warning-banner">
          <p>Staking is currently paused.</p>
        </div>
      )}

      <div className="stake-form">
        <div className="input-group">
          <label>Amount to Stake</label>
          <div className="input-with-max">
            <input
              type="number"
              placeholder="0.00"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              disabled={loading}
            />
            <button className="max-btn" onClick={handleMaxClick} disabled={loading}>
              MAX
            </button>
          </div>
          <span className="balance-hint">Balance: {ectoBalance} ECTO</span>
        </div>

        <div className="input-group">
          <label>Lock Period (Higher bonus for longer locks)</label>
          <div className="lock-options">
            {LOCK_OPTIONS.map((option, index) => (
              <button
                key={option.value}
                className={`lock-option ${lockOption === index ? 'active' : ''}`}
                onClick={() => setLockOption(index)}
                disabled={loading}
              >
                <span className="lock-label">{option.label}</span>
                <span className="lock-bonus">{option.bonus}</span>
              </button>
            ))}
          </div>
        </div>

        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <div className="stake-preview">
            <div className="preview-row">
              <span>Lock Period:</span>
              <span>{selectedLock.days} days</span>
            </div>
            <div className="preview-row">
              <span>Reward Multiplier:</span>
              <span>{selectedLock.bonus}</span>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button
          className="stake-button primary-button"
          onClick={handleStake}
          disabled={isDisabled || poolInfo?.paused}
        >
          {loading ? 'Staking...' : 'Stake ECTO'}
        </button>
      </div>

      {poolInfo && (
        <div className="pool-stats">
          <h4>Pool Statistics</h4>
          <div className="stat-row">
            <span>Total Staked:</span>
            <span>{poolInfo.totalStaked} ECTO</span>
          </div>
          <div className="stat-row">
            <span>Reward Pool:</span>
            <span>{poolInfo.rewardBalance} ECTO</span>
          </div>
          <div className="stat-row">
            <span>Total Rewards Distributed:</span>
            <span>{poolInfo.totalRewardsDistributed} ECTO</span>
          </div>
        </div>
      )}
    </div>
  );
}
