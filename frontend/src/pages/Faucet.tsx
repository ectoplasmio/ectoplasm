import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { useWallet } from '../contexts/WalletContext';
import { useDex } from '../contexts/DexContext';
import { useToast } from '../contexts/ToastContext';
import { SUI_CONFIG } from '../config/sui';
import { parseError } from '../utils/errors';

export function Faucet() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { balances, refreshBalances } = useWallet();
  const { service } = useDex();
  const { showToast, removeToast } = useToast();

  const [requesting, setRequesting] = useState<'ECTO' | 'USDC' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastRequest, setLastRequest] = useState<Record<string, number>>({});

  const connected = !!currentAccount;

  // Add faucet-page class to body
  useEffect(() => {
    document.body.classList.add('faucet-page');
    return () => {
      document.body.classList.remove('faucet-page');
    };
  }, []);

  // Check cooldown from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sui_faucet_last_request');
    if (stored) {
      try {
        setLastRequest(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown per token

  const canRequest = (token: string) => {
    const last = lastRequest[token];
    return !last || (Date.now() - last) > COOLDOWN_MS;
  };

  const cooldownRemaining = (token: string) => {
    const last = lastRequest[token];
    return last ? Math.max(0, COOLDOWN_MS - (Date.now() - last)) : 0;
  };

  const formatCooldown = (ms: number) => {
    const minutes = Math.ceil(ms / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const requestTokens = async (tokenSymbol: 'ECTO' | 'USDC') => {
    if (!connected || !currentAccount) {
      return;
    }

    if (!canRequest(tokenSymbol)) {
      setMessage({
        type: 'info',
        text: `Please wait ${formatCooldown(cooldownRemaining(tokenSymbol))} before requesting ${tokenSymbol} again.`
      });
      return;
    }

    setRequesting(tokenSymbol);
    setMessage(null);
    let pendingId: string | null = null;

    try {
      pendingId = Date.now().toString();
      showToast('pending', `Requesting ${tokenSymbol} tokens...`);

      // Build faucet transaction
      const tx = service.buildFaucetTransaction(tokenSymbol);

      // Sign and execute
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      // Update cooldown
      const now = Date.now();
      const newLastRequest = { ...lastRequest, [tokenSymbol]: now };
      setLastRequest(newLastRequest);
      localStorage.setItem('sui_faucet_last_request', JSON.stringify(newLastRequest));

      setMessage({
        type: 'success',
        text: `Received 1000 ${tokenSymbol} tokens! Tx: ${result.digest.slice(0, 16)}...`
      });
      showToast('success', `${tokenSymbol} tokens received!`, result.digest);

      // Refresh balances after a short delay
      setTimeout(() => {
        refreshBalances();
      }, 2000);

    } catch (error: unknown) {
      console.error('Faucet error:', error);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(error);
      showToast('error', parsed.message);

      setMessage({
        type: 'error',
        text: parsed.suggestion ? `${parsed.message}. ${parsed.suggestion}` : parsed.message
      });
    } finally {
      setRequesting(null);
    }
  };

  return (
    <main>
      <section className="hero faucet-hero">
        <div className="container">
          <div className="faucet-card hero-card">
            <h1>Testnet Faucet</h1>
            <p className="muted">Get free ECTO and USDC tokens for testing on SUI Testnet</p>

            <div className="faucet-balances">
              <div className="balance-item">
                <span className="token-name">SUI</span>
                <span className="token-balance">{balances.SUI?.formatted || '0'}</span>
              </div>
              <div className="balance-item">
                <span className="token-name">ECTO</span>
                <span className="token-balance">{balances.ECTO?.formatted || '0'}</span>
              </div>
              <div className="balance-item">
                <span className="token-name">USDC</span>
                <span className="token-balance">{balances.USDC?.formatted || '0'}</span>
              </div>
            </div>

            {message && (
              <div className={`faucet-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="faucet-actions">
              {!connected ? (
                <ConnectButton connectText="Connect Wallet" />
              ) : (
                <div className="faucet-buttons">
                  <button
                    className="btn primary"
                    onClick={() => requestTokens('ECTO')}
                    disabled={requesting !== null || !canRequest('ECTO')}
                  >
                    {requesting === 'ECTO'
                      ? 'Requesting...'
                      : canRequest('ECTO')
                        ? 'Request 1000 ECTO'
                        : `Wait ${formatCooldown(cooldownRemaining('ECTO'))}`
                    }
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => requestTokens('USDC')}
                    disabled={requesting !== null || !canRequest('USDC')}
                  >
                    {requesting === 'USDC'
                      ? 'Requesting...'
                      : canRequest('USDC')
                        ? 'Request 1000 USDC'
                        : `Wait ${formatCooldown(cooldownRemaining('USDC'))}`
                    }
                  </button>
                </div>
              )}
            </div>

            <div className="faucet-info">
              <h3>How it works</h3>
              <ul>
                <li>Connect your SUI Wallet</li>
                <li>Click to request ECTO or USDC testnet tokens</li>
                <li>Sign the transaction in your wallet</li>
                <li>You can request each token once every 5 minutes</li>
              </ul>

              <h3>Need SUI?</h3>
              <p>
                Get testnet SUI from the official{' '}
                <a href="https://faucet.sui.io/" target="_blank" rel="noopener noreferrer">
                  SUI Testnet Faucet
                </a>
                {' '}or request in Discord.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Faucet;
