import { useState, useCallback, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useWallet } from '../contexts/WalletContext';
import { useDex } from '../contexts/DexContext';
import { useToast } from '../contexts/ToastContext';
import { SUI_CONFIG, formatAmount, parseAmount } from '../config/sui';
import { getErrorMessage, parseError } from '../utils/errors';

interface LiquidityPosition {
  pairName: string;
  poolId: string;
  tokenA: string;
  tokenB: string;
  lpBalance: string;
  lpBalanceRaw: bigint;
  sharePercent: number;
  tokenAAmount: string;
  tokenBAmount: string;
}

interface UseLiquidityResult {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  poolShare: string;
  lpTokensReceived: string;
  setTokenA: (symbol: string) => void;
  setTokenB: (symbol: string) => void;
  setAmountA: (amount: string) => void;
  setAmountB: (amount: string) => void;
  lpAmount: string;
  setLpAmount: (amount: string) => void;
  removeTokenA: string;
  setRemoveTokenA: (symbol: string) => void;
  removeTokenB: string;
  setRemoveTokenB: (symbol: string) => void;
  reserveA: string;
  reserveB: string;
  totalSupply: string;
  pairExists: boolean;
  positions: LiquidityPosition[];
  addLiquidity: () => Promise<string | null>;
  removeLiquidity: () => Promise<string | null>;
  refreshPositions: () => Promise<void>;
  refreshReserves: () => Promise<void>;
  loading: boolean;
  txStep: string;
  error: string | null;
}

export function useLiquidity(): UseLiquidityResult {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { connected, refreshBalances } = useWallet();
  const { service, config } = useDex();
  const { showToast, removeToast } = useToast();

  const [tokenA, setTokenA] = useState('ECTO');
  const [tokenB, setTokenB] = useState('USDC');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [poolShare, setPoolShare] = useState('0.00');
  const [lpTokensReceived, setLpTokensReceived] = useState('0.00');

  const [lpAmount, setLpAmount] = useState('');
  const [removeTokenA, setRemoveTokenA] = useState('');
  const [removeTokenB, setRemoveTokenB] = useState('');

  const [reserveA, setReserveA] = useState('0');
  const [reserveB, setReserveB] = useState('0');
  const [totalSupply, setTotalSupply] = useState('0');
  const [pairExists, setPairExists] = useState(false);

  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStep, setTxStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshReserves = useCallback(async () => {
    const tA = config.tokens[tokenA as keyof typeof config.tokens];
    const tB = config.tokens[tokenB as keyof typeof config.tokens];
    if (!tA || !tB) return;

    try {
      // Currently only support ECTO-USDC pool
      const pool = config.pools['ECTO-USDC'];
      if (!pool) {
        setPairExists(false);
        setReserveA('0');
        setReserveB('0');
        setTotalSupply('0');
        return;
      }

      const reserves = await service.getPoolReserves(pool.poolId);

      setPairExists(true);
      setReserveA(formatAmount(reserves.reserveA, pool.decimalsA));
      setReserveB(formatAmount(reserves.reserveB, pool.decimalsB));
      setTotalSupply(formatAmount(reserves.lpSupply, 9)); // LP tokens have 9 decimals
    } catch (e) {
      console.error(e);
      setPairExists(false);
    }
  }, [tokenA, tokenB, service, config]);

  useEffect(() => {
    refreshReserves();
  }, [refreshReserves]);

  // Calculate LP tokens and pool share when amounts change
  useEffect(() => {
    if (!amountA || parseFloat(amountA) <= 0) {
      setPoolShare('0.00');
      setLpTokensReceived('0.00');
      return;
    }

    const calc = async () => {
      const tA = config.tokens[tokenA as keyof typeof config.tokens];
      const tB = config.tokens[tokenB as keyof typeof config.tokens];
      if (!tA || !tB) return;

      try {
        const pool = config.pools['ECTO-USDC'];
        if (!pool) return;

        const reserves = await service.getPoolReserves(pool.poolId);

        const aRaw = parseAmount(amountA, tA.decimals);
        const bRaw = amountB ? parseAmount(amountB, tB.decimals) : 0n;

        const lpTokens = service.calculateLpTokens(
          aRaw,
          bRaw,
          reserves.reserveA,
          reserves.reserveB,
          reserves.lpSupply
        );

        setLpTokensReceived(formatAmount(lpTokens, 9));

        const newSupply = reserves.lpSupply + lpTokens;
        const share = newSupply > 0n ? Number(lpTokens * 10000n / newSupply) / 100 : 0;
        setPoolShare(share.toFixed(2));
      } catch (e) {
        console.error(e);
      }
    };
    calc();
  }, [amountA, amountB, tokenA, tokenB, service, config]);

  const handleAmountAChange = useCallback(async (val: string) => {
    setAmountA(val);
    if (!val || parseFloat(val) <= 0) {
      setAmountB('');
      return;
    }

    const tA = config.tokens[tokenA as keyof typeof config.tokens];
    const tB = config.tokens[tokenB as keyof typeof config.tokens];
    if (!tA || !tB) return;

    try {
      const pool = config.pools['ECTO-USDC'];
      if (!pool) return;

      const reserves = await service.getPoolReserves(pool.poolId);

      if (reserves.reserveA > 0n && reserves.reserveB > 0n) {
        const aRaw = parseAmount(val, tA.decimals);
        const bRaw = aRaw * reserves.reserveB / reserves.reserveA;
        setAmountB(formatAmount(bRaw, tB.decimals));
      }
    } catch (e) {
      console.error(e);
    }
  }, [tokenA, tokenB, service, config]);

  const refreshPositions = useCallback(async () => {
    if (!connected || !currentAccount) {
      setPositions([]);
      return;
    }

    try {
      // For now, we only support the ECTO-USDC pool
      // Check if user has LP tokens by looking at owned objects
      const pool = config.pools['ECTO-USDC'];
      if (!pool) {
        setPositions([]);
        return;
      }

      // LP tokens are Coin<LP<A, B>> type objects
      // We'd need to query owned objects of the LP coin type
      // For simplicity, showing empty for now until we implement LP token queries
      setPositions([]);
    } catch (e) {
      console.error(e);
    }
  }, [connected, currentAccount, config]);

  useEffect(() => {
    refreshPositions();
  }, [refreshPositions]);

  const addLiquidity = useCallback(async (): Promise<string | null> => {
    if (!connected || !currentAccount) {
      setError("Connect wallet");
      return null;
    }
    if (!amountA || !amountB) {
      setError("Enter amounts");
      return null;
    }

    const tA = config.tokens[tokenA as keyof typeof config.tokens];
    const tB = config.tokens[tokenB as keyof typeof config.tokens];
    if (!tA || !tB) return null;

    setLoading(true);
    setError(null);
    setTxStep('Preparing...');

    let pendingId: string | null = null;

    try {
      const pool = config.pools['ECTO-USDC'];
      const aRaw = parseAmount(amountA, tA.decimals);
      const bRaw = parseAmount(amountB, tB.decimals);

      // Get coins for both tokens
      pendingId = Date.now().toString();
      showToast('pending', 'Finding coins...');

      const coinsA = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: tA.coinType,
      });

      const coinsB = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: tB.coinType,
      });

      if (coinsA.data.length === 0) throw new Error(`No ${tokenA} coins found`);
      if (coinsB.data.length === 0) throw new Error(`No ${tokenB} coins found`);

      // Find suitable coins
      let coinA = coinsA.data[0];
      let coinB = coinsB.data[0];

      for (const coin of coinsA.data) {
        if (BigInt(coin.balance) >= aRaw) {
          coinA = coin;
          break;
        }
      }

      for (const coin of coinsB.data) {
        if (BigInt(coin.balance) >= bRaw) {
          coinB = coin;
          break;
        }
      }

      if (BigInt(coinA.balance) < aRaw) throw new Error(`Insufficient ${tokenA} balance`);
      if (BigInt(coinB.balance) < bRaw) throw new Error(`Insufficient ${tokenB} balance`);

      if (pendingId) removeToast(pendingId);
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      // Calculate minimum LP tokens (with 1% slippage)
      const reserves = await service.getPoolReserves(pool.poolId);
      const expectedLp = service.calculateLpTokens(aRaw, bRaw, reserves.reserveA, reserves.reserveB, reserves.lpSupply);
      const minLpOut = expectedLp * 99n / 100n;

      // Build add liquidity transaction
      const tx = service.buildAddLiquidityTransaction(
        pool.poolId,
        coinA.coinObjectId,
        coinB.coinObjectId,
        minLpOut,
        pool.coinTypeA,
        pool.coinTypeB
      );

      // Sign and execute
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Liquidity added!', txDigest);

      setTxStep('Success!');
      await refreshBalances();
      await refreshReserves();
      await refreshPositions();

      // Reset form
      setAmountA('');
      setAmountB('');

      return txDigest;

    } catch (e: unknown) {
      console.error(e);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(e);
      setError(parsed.message);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
      setTxStep('');
    }
  }, [connected, currentAccount, amountA, amountB, tokenA, tokenB, service, config, suiClient, signAndExecuteTransaction, showToast, removeToast, refreshBalances, refreshReserves, refreshPositions]);

  const removeLiquidity = useCallback(async (): Promise<string | null> => {
    if (!connected || !currentAccount) {
      setError("Connect wallet");
      return null;
    }
    if (!lpAmount || parseFloat(lpAmount) <= 0) {
      setError("Enter LP amount");
      return null;
    }

    setLoading(true);
    setError(null);
    setTxStep('Preparing...');

    let pendingId: string | null = null;

    try {
      const pool = config.pools['ECTO-USDC'];
      const lpRaw = parseAmount(lpAmount, 9); // LP tokens have 9 decimals

      // Get LP token coins
      pendingId = Date.now().toString();
      showToast('pending', 'Finding LP tokens...');

      // LP token type would be something like Package::pool::LP<CoinTypeA, CoinTypeB>
      const lpCoinType = `${config.packageId}::pool::LP<${pool.coinTypeA}, ${pool.coinTypeB}>`;

      const lpCoins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: lpCoinType,
      });

      if (lpCoins.data.length === 0) throw new Error('No LP tokens found');

      let lpCoin = lpCoins.data[0];
      for (const coin of lpCoins.data) {
        if (BigInt(coin.balance) >= lpRaw) {
          lpCoin = coin;
          break;
        }
      }

      if (BigInt(lpCoin.balance) < lpRaw) throw new Error('Insufficient LP token balance');

      if (pendingId) removeToast(pendingId);
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      // Calculate expected outputs
      const reserves = await service.getPoolReserves(pool.poolId);
      const { amountA: expectedA, amountB: expectedB } = service.calculateWithdrawAmounts(
        lpRaw,
        reserves.reserveA,
        reserves.reserveB,
        reserves.lpSupply
      );

      // Minimum outputs with 1% slippage
      const minAOut = expectedA * 99n / 100n;
      const minBOut = expectedB * 99n / 100n;

      // Build remove liquidity transaction
      const tx = service.buildRemoveLiquidityTransaction(
        pool.poolId,
        lpCoin.coinObjectId,
        minAOut,
        minBOut,
        pool.coinTypeA,
        pool.coinTypeB
      );

      // Sign and execute
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Liquidity removed!', txDigest);

      setTxStep('Success!');
      await refreshBalances();
      await refreshReserves();
      await refreshPositions();

      // Reset form
      setLpAmount('');

      return txDigest;

    } catch (e: unknown) {
      console.error(e);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(e);
      setError(parsed.message);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
      setTxStep('');
    }
  }, [connected, currentAccount, lpAmount, service, config, suiClient, signAndExecuteTransaction, showToast, removeToast, refreshBalances, refreshReserves, refreshPositions]);

  return {
    tokenA,
    tokenB,
    amountA,
    amountB,
    poolShare,
    lpTokensReceived,
    setTokenA,
    setTokenB,
    setAmountA: handleAmountAChange,
    setAmountB,
    lpAmount,
    setLpAmount,
    removeTokenA,
    setRemoveTokenA,
    removeTokenB,
    setRemoveTokenB,
    reserveA,
    reserveB,
    totalSupply,
    pairExists,
    positions,
    addLiquidity,
    removeLiquidity,
    refreshPositions,
    refreshReserves,
    loading,
    txStep,
    error
  };
}

export default useLiquidity;
