import React from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '../../contexts/WalletContext';
import { truncateAddress } from '../../utils/format';

interface ConnectWalletProps {
  className?: string;
}

export function ConnectWallet({ className = '' }: ConnectWalletProps) {
  const currentAccount = useCurrentAccount();
  const { balances } = useWallet();

  // Show SUI balance if connected
  const suiBalance = balances.SUI?.formatted || '0';

  return (
    <div className={`wallet-container ${className}`}>
      {currentAccount && (
        <span className="wallet-balance">{suiBalance} SUI</span>
      )}
      <ConnectButton
        connectText="Connect Wallet"
        className="btn primary"
      />
    </div>
  );
}

export default ConnectWallet;
