import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';

export function StakeTab() {
  const currentAccount = useCurrentAccount();
  const { balances } = useWallet();
  const connected = !!currentAccount;

  const suiBalance = balances.SUI?.formatted || '0';

  return (
    <div className="stake-tab">
      <div className="coming-soon-banner">
        <h3>Staking Coming Soon</h3>
        <p>Liquid staking on SUI is currently under development.</p>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span>Your SUI Balance:</span>
          <span>{suiBalance} SUI</span>
        </div>
        <div className="info-row">
          <span>Status:</span>
          <span>{connected ? 'Wallet Connected' : 'Not Connected'}</span>
        </div>
      </div>

      <button
        className="stake-button primary-button"
        disabled
      >
        Coming Soon
      </button>
    </div>
  );
}
