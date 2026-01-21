import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';

interface PendingUnstake {
  id: number;
  amount: string;
  ready: boolean;
  timeRemaining: string;
}

export function UnstakeTab() {
  const currentAccount = useCurrentAccount();
  const { balances, refreshBalances } = useWallet();
  const [ssuiAmount, setSsuiAmount] = useState('');
  const [suiAmount, setSuiAmount] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [pendingUnstakes, setPendingUnstakes] = useState<PendingUnstake[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connected = !!currentAccount;
  // Note: sSUI balance would come from the wallet context once implemented
  const ssuiBalance = balances.sSUI?.formatted || '0';

  // Fetch exchange rate (mock for now)
  useEffect(() => {
    // TODO: Fetch actual exchange rate from staking contract
    setExchangeRate('1.0');
  }, []);

  // Fetch pending unstakes (mock for now)
  useEffect(() => {
    if (connected) {
      // TODO: Fetch actual pending unstakes
      setPendingUnstakes([]);
    }
  }, [connected]);

  // Calculate SUI amount based on sSUI input
  useEffect(() => {
    if (ssuiAmount && !isNaN(parseFloat(ssuiAmount))) {
      const ssui = parseFloat(ssuiAmount);
      const rate = parseFloat(exchangeRate);
      const sui = ssui * rate;
      setSuiAmount(sui.toFixed(6));
    } else {
      setSuiAmount('0');
    }
  }, [ssuiAmount, exchangeRate]);

  const handleMaxClick = () => {
    setSsuiAmount(ssuiBalance);
  };

  const handleUnstake = async () => {
    if (!ssuiAmount || parseFloat(ssuiAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsUnstaking(true);
    setError(null);

    try {
      // TODO: Implement actual unstaking transaction
      console.log('Unstaking', ssuiAmount, 'sSUI for', suiAmount, 'SUI');

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear the input
      setSsuiAmount('');

      // Refresh balances
      await refreshBalances();
    } catch (err: any) {
      console.error('Unstaking failed:', err);
      setError(err.message || 'Unstaking failed');
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleWithdraw = async (requestId: number) => {
    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      // TODO: Implement actual withdrawal transaction
      console.log('Withdrawing unstake request:', requestId);
    } catch (err: any) {
      console.error('Withdrawal failed:', err);
      setError(err.message || 'Withdrawal failed');
    }
  };

  const isDisabled = isUnstaking || !ssuiAmount || parseFloat(ssuiAmount) <= 0;

  return (
    <div className="unstake-tab">
      <div className="input-section">
        <div className="input-header">
          <label>Unstake sSUI</label>
          <div className="balance-row">
            <span className="balance">Balance: {parseFloat(ssuiBalance).toFixed(6)} sSUI</span>
            <button className="refresh-button" onClick={() => refreshBalances()} title="Refresh balance">
              ↻
            </button>
          </div>
        </div>
        <div className="input-wrapper">
          <input
            type="number"
            value={ssuiAmount}
            onChange={(e) => setSsuiAmount(e.target.value)}
            placeholder="0.0"
            min="0"
            step="any"
            disabled={isUnstaking}
          />
          <div className="input-actions">
            <button className="max-button" onClick={handleMaxClick} disabled={isUnstaking}>
              MAX
            </button>
            <span className="token-symbol">sSUI</span>
          </div>
        </div>
      </div>

      <div className="exchange-info">
        <div className="exchange-arrow">↓</div>
        <div className="exchange-rate">
          1 sSUI = {exchangeRate} SUI
        </div>
      </div>

      <div className="output-section">
        <div className="output-header">
          <label>Receive SUI (after unstaking period)</label>
        </div>
        <div className="output-wrapper">
          <div className="output-value">{suiAmount}</div>
          <span className="token-symbol">SUI</span>
        </div>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span>Unstaking Period:</span>
          <span>~24 hours</span>
        </div>
        <div className="info-row">
          <span>Exchange Rate:</span>
          <span>1 sSUI = {exchangeRate} SUI</span>
        </div>
        <div className="info-row">
          <span>You will receive:</span>
          <span>{suiAmount} SUI</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="unstake-button primary-button"
        onClick={handleUnstake}
        disabled={isDisabled}
      >
        {isUnstaking ? 'Unstaking...' : 'Unstake sSUI'}
      </button>

      {pendingUnstakes.length > 0 && (
        <div className="pending-unstakes">
          <h3>Pending Unstakes</h3>
          <div className="unstakes-list">
            {pendingUnstakes.map((unstake) => (
              <div key={unstake.id} className="unstake-item">
                <div className="unstake-info">
                  <span>{unstake.amount} SUI</span>
                  <span className="unstake-status">
                    {unstake.ready ? 'Ready to withdraw' : `Unlocks in ${unstake.timeRemaining}`}
                  </span>
                </div>
                {unstake.ready && (
                  <button
                    className="withdraw-button"
                    onClick={() => handleWithdraw(unstake.id)}
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
