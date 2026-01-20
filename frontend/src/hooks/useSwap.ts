import { useState, useCallback, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useWallet } from '../contexts/WalletContext';
import { useDex } from '../contexts/DexContext';
import { useToast } from '../contexts/ToastContext';
import { SUI_CONFIG, formatAmount, parseAmount, getExplorerUrl } from '../config/sui';
import { getErrorMessage, parseError } from '../utils/errors';

export interface SwapQuote {
  valid: boolean;
  amountIn: string;
  amountInRaw: bigint;
  amountOut: string;
  amountOutRaw: bigint;
  rate: string;
  priceImpact: number;
  minReceived: string;
  minimumReceivedRaw: bigint;
  fee: bigint;
  path: string[];
  error?: string;
}

interface UseSwapResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  slippage: string;
  quote: SwapQuote | null;
  loading: boolean;
  quoting: boolean;
  error: string | null;
  setTokenIn: (symbol: string) => void;
  setTokenOut: (symbol: string) => void;
  setAmountIn: (amount: string) => void;
  setSlippage: (slippage: string) => void;
  switchTokens: () => void;
  executeSwap: () => Promise<string | null>;
  refreshQuote: () => Promise<void>;
}

export function useSwap(): UseSwapResult {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { connected, refreshBalances } = useWallet();
  const { service, config } = useDex();
  const { showToast, removeToast } = useToast();

  const [tokenIn, setTokenIn] = useState('ECTO');
  const [tokenOut, setTokenOut] = useState('USDC');
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [slippage, setSlippage] = useState('0.5'); // Default 0.5%
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuote = useCallback(async () => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      setAmountOut('');
      return;
    }

    setQuoting(true);
    setError(null);

    try {
      const tIn = config.tokens[tokenIn as keyof typeof config.tokens];
      const tOut = config.tokens[tokenOut as keyof typeof config.tokens];

      if (!tIn || !tOut) throw new Error("Invalid token configuration");

      // Get pool for this pair (currently only ECTO-USDC)
      const pool = config.pools['ECTO-USDC'];
      if (!pool) throw new Error('Liquidity pool not found');

      // Determine direction
      const isAToB = tokenIn === 'ECTO';

      // Parse input amount
      const amountInRaw = parseAmount(amountIn, tIn.decimals);

      // Get quote from service
      const slippageBps = Math.round(parseFloat(slippage) * 100); // Convert % to bps
      const swapQuote = await service.getSwapQuote(pool.poolId, amountInRaw, isAToB, slippageBps);

      const amountOutFormatted = formatAmount(swapQuote.amountOut, tOut.decimals);
      const minReceivedFormatted = formatAmount(swapQuote.minimumReceived, tOut.decimals);

      // Calculate rate
      const inputVal = parseFloat(amountIn);
      const outputVal = parseFloat(amountOutFormatted);
      const rate = inputVal > 0 ? (outputVal / inputVal).toFixed(6) : '0';

      setQuote({
        valid: true,
        amountIn,
        amountInRaw,
        amountOut: amountOutFormatted,
        amountOutRaw: swapQuote.amountOut,
        rate,
        priceImpact: swapQuote.priceImpact,
        minReceived: minReceivedFormatted,
        minimumReceivedRaw: swapQuote.minimumReceived,
        fee: swapQuote.fee,
        path: [tokenIn, tokenOut],
      });
      setAmountOut(amountOutFormatted);

    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err));
      setQuote(null);
      setAmountOut('');
    } finally {
      setQuoting(false);
    }
  }, [tokenIn, tokenOut, amountIn, slippage, service, config]);

  // Debounce quote
  useEffect(() => {
    const timeout = setTimeout(refreshQuote, 300);
    return () => clearTimeout(timeout);
  }, [refreshQuote]);

  const switchTokens = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    // Quote will refresh automatically due to effect
  }, [tokenOut, tokenIn, amountOut]);

  const executeSwap = useCallback(async (): Promise<string | null> => {
    if (!connected || !currentAccount) {
      showToast('error', 'Please connect your wallet');
      return null;
    }
    if (!quote || !quote.valid) {
      showToast('error', 'Invalid quote');
      return null;
    }

    setLoading(true);
    let pendingId: string | null = null;

    try {
      const pool = config.pools['ECTO-USDC'];
      const tIn = config.tokens[tokenIn as keyof typeof config.tokens];
      const tOut = config.tokens[tokenOut as keyof typeof config.tokens];
      const isAToB = tokenIn === 'ECTO';

      pendingId = Date.now().toString();
      showToast('pending', 'Preparing swap...');

      // Get coins of the input type
      const coins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: tIn.coinType,
      });

      if (coins.data.length === 0) {
        throw new Error(`No ${tokenIn} coins found`);
      }

      // Find a coin with enough balance or use the first one
      let coinToUse = coins.data[0];
      for (const coin of coins.data) {
        if (BigInt(coin.balance) >= quote.amountInRaw) {
          coinToUse = coin;
          break;
        }
      }

      if (BigInt(coinToUse.balance) < quote.amountInRaw) {
        throw new Error(`Insufficient ${tokenIn} balance`);
      }

      if (pendingId) removeToast(pendingId);
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      // Build the swap transaction
      const tx = service.buildSwapTransaction(
        pool.poolId,
        coinToUse.coinObjectId,
        quote.minimumReceivedRaw,
        isAToB,
        pool.coinTypeA,
        pool.coinTypeB
      );

      // Sign and execute (cast to any to handle version mismatch between @mysten/sui packages)
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Swap successful!', txDigest);

      // Refresh balances
      await refreshBalances();

      // Reset form
      setAmountIn('');
      setAmountOut('');
      setQuote(null);

      return txDigest;

    } catch (err: unknown) {
      console.error(err);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(err);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connected, currentAccount, quote, config, tokenIn, tokenOut, service, suiClient, signAndExecuteTransaction, showToast, removeToast, refreshBalances]);

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    slippage,
    quote,
    loading,
    quoting,
    error,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    setSlippage,
    switchTokens,
    executeSwap,
    refreshQuote
  };
}
