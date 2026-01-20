import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';

export function UnstakeTab() {
  const currentAccount = useCurrentAccount();
  const { balances } = useWallet();
  const connected = !!currentAccount;

  return (
    <div className="unstake-tab">
      <div className="coming-soon-banner">
        <h3>Unstaking Coming Soon</h3>
        <p>Liquid staking unstake functionality is under development.</p>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span>Status:</span>
          <span>{connected ? 'Wallet Connected' : 'Not Connected'}</span>
        </div>
      </div>

      <button
        className="unstake-button primary-button"
        disabled
      >
        Coming Soon
      </button>
    </div>
  );
}
