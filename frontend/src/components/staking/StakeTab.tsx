import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';

export function StakeTab() {
  const currentAccount = useCurrentAccount();
  const { balances, refreshBalances } = useWallet();
  const [suiAmount, setSuiAmount] = useState('');
  const [ssuiAmount, setSsuiAmount] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  const [isStaking, setIsStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = !!currentAccount;
  const suiBalance = balances.SUI?.formatted || '0';

  // Fetch exchange rate (mock for now)
  useEffect(() => {
    // TODO: Fetch actual exchange rate from staking contract
    setExchangeRate('1.0');
  }, []);

  // Calculate sSUI amount based on SUI input
  useEffect(() => {
    if (suiAmount && !isNaN(parseFloat(suiAmount))) {
      const sui = parseFloat(suiAmount);
      const rate = parseFloat(exchangeRate);
      const ssui = sui / rate;
      setSsuiAmount(ssui.toFixed(6));
    } else {
      setSsuiAmount('0');
    }
  }, [suiAmount, exchangeRate]);

  const handleMaxClick = () => {
    // Reserve some SUI for gas
    const maxAmount = Math.max(0, parseFloat(suiBalance) - 0.1);
    setSuiAmount(maxAmount.toString());
  };

  const handleStake = async () => {
    if (!suiAmount || parseFloat(suiAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(suiAmount) < 1) {
      setError('Minimum stake amount is 1 SUI');
      return;
    }

    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsStaking(true);
    setError(null);

    try {
      // TODO: Implement actual liquid staking transaction
      console.log('Staking', suiAmount, 'SUI for', ssuiAmount, 'sSUI');

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear the input
      setSuiAmount('');

      // Refresh balances
      await refreshBalances();
    } catch (err: any) {
      console.error('Staking failed:', err);
      setError(err.message || 'Staking failed');
    } finally {
      setIsStaking(false);
    }
  };

  const isDisabled = isStaking || !suiAmount || parseFloat(suiAmount) < 1;

  return (
    <div className="stake-tab">
      <div className="input-section">
        <div className="input-header">
          <label>Stake SUI</label>
          <div className="balance-row">
            <span className="balance">Balance: {parseFloat(suiBalance).toFixed(4)} SUI</span>
            <button className="refresh-button" onClick={() => refreshBalances()} title="Refresh balance">
              ↻
            </button>
          </div>
        </div>
        <div className="input-wrapper">
          <input
            type="number"
            value={suiAmount}
            onChange={(e) => setSuiAmount(e.target.value)}
            placeholder="0.0"
            min="0"
            step="any"
            disabled={isStaking}
          />
          <div className="input-actions">
            <button className="max-button" onClick={handleMaxClick} disabled={isStaking}>
              MAX
            </button>
            <span className="token-symbol">SUI</span>
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
          <label>Receive sSUI</label>
        </div>
        <div className="output-wrapper">
          <div className="output-value">{ssuiAmount}</div>
          <span className="token-symbol">sSUI</span>
        </div>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span>Minimum Stake:</span>
          <span>1 SUI</span>
        </div>
        <div className="info-row">
          <span>Exchange Rate:</span>
          <span>1 sSUI = {exchangeRate} SUI</span>
        </div>
        <div className="info-row">
          <span>You will receive:</span>
          <span>{ssuiAmount} sSUI</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="stake-button primary-button"
        onClick={handleStake}
        disabled={isDisabled}
      >
        {isStaking ? 'Staking...' : 'Stake SUI'}
      </button>
    </div>
  );
}
