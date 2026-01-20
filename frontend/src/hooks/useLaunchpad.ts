import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, formatAmount, parseAmount } from '../config/sui';

// Token creation form state
export interface TokenFormData {
  projectName: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  initialPrice?: number;
  priceIncrement?: number;
  graduationThreshold?: number;
  creatorFeeBps?: number;
}

// Bonding curve token in the library
export interface LaunchpadToken {
  id: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  creator: string;
  tokensSold: string;
  usdcReserve: string;
  currentPrice: string;
  marketCap: string;
  graduationThreshold: string;
  graduated: boolean;
  paused: boolean;
  volume: string;
  creatorFeeBps: number;
  createdAt: number;
  progress: number; // Percentage toward graduation
  coinType: string;
}

// Protocol config info
export interface LaunchpadConfigInfo {
  protocolFeeBps: number;
  totalLaunches: number;
  totalVolume: string;
  collectedFees: string;
  launchesPaused: boolean;
}

// Quote for buy/sell
export interface TradeQuote {
  tokensOut?: string;
  usdcOut?: string;
  protocolFee: string;
  creatorFee: string;
  priceImpact: number;
}

interface UseLaunchpadResult {
  // Data
  tokens: LaunchpadToken[];
  configInfo: LaunchpadConfigInfo | null;
  selectedToken: LaunchpadToken | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  selectToken: (curveId: string) => Promise<void>;
  buy: (curveId: string, usdcAmount: string, minTokensOut: string) => Promise<string | null>;
  sell: (curveId: string, tokenAmount: string, minUsdcOut: string) => Promise<string | null>;
  claimCreatorFees: (curveId: string) => Promise<string | null>;

  // Quotes
  getBuyQuote: (curveId: string, usdcAmount: string) => TradeQuote | null;
  getSellQuote: (curveId: string, tokenAmount: string) => TradeQuote | null;

  // Status
  isLaunchpadDeployed: boolean;
}

const FEATURES_PACKAGE = SUI_CONFIG.featuresPackageId;
const LAUNCHPAD_CONFIG = SUI_CONFIG.launchpad.configId;
const USDC_TYPE = SUI_CONFIG.tokens.USDC.coinType;

/**
 * Launchpad Hook - Full Implementation
 *
 * Connects to the SUI launchpad contracts for bonding curve token trading.
 */
export function useLaunchpad(): UseLaunchpadResult {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [tokens, setTokens] = useState<LaunchpadToken[]>([]);
  const [configInfo, setConfigInfo] = useState<LaunchpadConfigInfo | null>(null);
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch launchpad config
  const fetchConfig = useCallback(async () => {
    try {
      const configObj = await client.getObject({
        id: LAUNCHPAD_CONFIG,
        options: { showContent: true },
      });

      if (configObj.data?.content?.dataType === 'moveObject') {
        const fields = configObj.data.content.fields as Record<string, unknown>;
        setConfigInfo({
          protocolFeeBps: Number(fields.protocol_fee_bps || 0),
          totalLaunches: Number(fields.total_launches || 0),
          totalVolume: formatAmount(BigInt(fields.total_volume as string || '0'), 6),
          collectedFees: formatAmount(
            BigInt((fields.collected_fees as Record<string, string>)?.value || '0'),
            6
          ),
          launchesPaused: Boolean(fields.launches_paused),
        });
      }
    } catch (err) {
      console.error('Failed to fetch launchpad config:', err);
    }
  }, [client]);

  // Fetch all bonding curves by querying events
  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true);

      // Query TokenLaunched events to find all curves
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${FEATURES_PACKAGE}::launchpad::TokenLaunched`,
        },
        limit: 100,
        order: 'descending',
      });

      const curveIds = events.data.map((event) => {
        const parsedJson = event.parsedJson as Record<string, unknown>;
        return parsedJson.curve_id as string;
      });

      if (curveIds.length === 0) {
        setTokens([]);
        return;
      }

      // Fetch each curve object
      const curveObjects = await client.multiGetObjects({
        ids: curveIds,
        options: { showContent: true, showType: true },
      });

      const tokenList: LaunchpadToken[] = [];

      for (const obj of curveObjects) {
        if (obj.data?.content?.dataType === 'moveObject') {
          const fields = obj.data.content.fields as Record<string, unknown>;
          const objType = obj.data.type || '';

          // Extract coin type from BondingCurve<CoinType>
          const typeMatch = objType.match(/BondingCurve<(.+)>/);
          const coinType = typeMatch ? typeMatch[1] : '';

          const tokensSold = BigInt(fields.tokens_sold as string || '0');
          const marketCap = BigInt(
            (tokensSold * BigInt(fields.initial_price as string || '0')) / BigInt(1e9)
          );
          const graduationThreshold = BigInt(fields.graduation_threshold as string || '0');
          const progress = graduationThreshold > 0n
            ? Number((marketCap * 100n) / graduationThreshold)
            : 0;

          const imageUrlField = fields.image_url as Record<string, string> | null;

          tokenList.push({
            id: obj.data.objectId,
            name: fields.name as string || '',
            symbol: fields.symbol as string || '',
            description: fields.description as string || '',
            imageUrl: imageUrlField?.url || undefined,
            creator: fields.creator as string || '',
            tokensSold: formatAmount(tokensSold, 9),
            usdcReserve: formatAmount(
              BigInt((fields.usdc_reserve as Record<string, string>)?.value || '0'),
              6
            ),
            currentPrice: formatAmount(BigInt(fields.initial_price as string || '0'), 6),
            marketCap: formatAmount(marketCap, 6),
            graduationThreshold: formatAmount(graduationThreshold, 6),
            graduated: Boolean(fields.graduated),
            paused: Boolean(fields.paused),
            volume: formatAmount(BigInt(fields.volume as string || '0'), 6),
            creatorFeeBps: Number(fields.creator_fee_bps || 0),
            createdAt: Number(fields.created_at || 0),
            progress: Math.min(progress, 100),
            coinType,
          });
        }
      }

      // Sort by creation time (newest first)
      tokenList.sort((a, b) => b.createdAt - a.createdAt);
      setTokens(tokenList);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch launchpad tokens:', err);
      setError('Failed to load launchpad tokens');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Select a specific token
  const selectToken = useCallback(async (curveId: string) => {
    const existing = tokens.find(t => t.id === curveId);
    if (existing) {
      setSelectedToken(existing);
      return;
    }

    try {
      const obj = await client.getObject({
        id: curveId,
        options: { showContent: true, showType: true },
      });

      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields as Record<string, unknown>;
        const objType = obj.data.type || '';

        const typeMatch = objType.match(/BondingCurve<(.+)>/);
        const coinType = typeMatch ? typeMatch[1] : '';

        const tokensSold = BigInt(fields.tokens_sold as string || '0');
        const marketCap = BigInt(
          (tokensSold * BigInt(fields.initial_price as string || '0')) / BigInt(1e9)
        );
        const graduationThreshold = BigInt(fields.graduation_threshold as string || '0');
        const progress = graduationThreshold > 0n
          ? Number((marketCap * 100n) / graduationThreshold)
          : 0;

        const imageUrlField = fields.image_url as Record<string, string> | null;

        setSelectedToken({
          id: obj.data.objectId,
          name: fields.name as string || '',
          symbol: fields.symbol as string || '',
          description: fields.description as string || '',
          imageUrl: imageUrlField?.url || undefined,
          creator: fields.creator as string || '',
          tokensSold: formatAmount(tokensSold, 9),
          usdcReserve: formatAmount(
            BigInt((fields.usdc_reserve as Record<string, string>)?.value || '0'),
            6
          ),
          currentPrice: formatAmount(BigInt(fields.initial_price as string || '0'), 6),
          marketCap: formatAmount(marketCap, 6),
          graduationThreshold: formatAmount(graduationThreshold, 6),
          graduated: Boolean(fields.graduated),
          paused: Boolean(fields.paused),
          volume: formatAmount(BigInt(fields.volume as string || '0'), 6),
          creatorFeeBps: Number(fields.creator_fee_bps || 0),
          createdAt: Number(fields.created_at || 0),
          progress: Math.min(progress, 100),
          coinType,
        });
      }
    } catch (err) {
      console.error('Failed to fetch token:', err);
      setError('Failed to load token details');
    }
  }, [client, tokens]);

  // Buy tokens from a bonding curve
  const buy = useCallback(async (
    curveId: string,
    usdcAmount: string,
    minTokensOut: string
  ): Promise<string | null> => {
    if (!currentAccount) {
      setError('Please connect your wallet');
      return null;
    }

    const token = tokens.find(t => t.id === curveId) || selectedToken;
    if (!token) {
      setError('Token not found');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const amountIn = parseAmount(usdcAmount, 6);
      const minOut = parseAmount(minTokensOut, 9);

      // Get USDC coins for the user
      const coins = await client.getCoins({
        owner: currentAccount.address,
        coinType: USDC_TYPE,
      });

      if (coins.data.length === 0) {
        setError('No USDC balance');
        return null;
      }

      const tx = new Transaction();

      // Merge coins if needed
      let paymentCoin;
      if (coins.data.length === 1) {
        const [splitCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [amountIn]);
        paymentCoin = splitCoin;
      } else {
        // Merge all coins first
        const [primary, ...rest] = coins.data.map(c => c.coinObjectId);
        if (rest.length > 0) {
          tx.mergeCoins(tx.object(primary), rest.map(id => tx.object(id)));
        }
        const [splitCoin] = tx.splitCoins(tx.object(primary), [amountIn]);
        paymentCoin = splitCoin;
      }

      tx.moveCall({
        target: `${FEATURES_PACKAGE}::launchpad::buy_entry`,
        typeArguments: [token.coinType],
        arguments: [
          tx.object(LAUNCHPAD_CONFIG),
          tx.object(curveId),
          paymentCoin,
          tx.pure.u64(minOut),
        ],
      });

      // Cast to any to handle version mismatch between @mysten/sui packages
      const result = await signAndExecute({
        transaction: tx as any,
      });

      await fetchTokens();
      if (selectedToken?.id === curveId) {
        await selectToken(curveId);
      }

      return result.digest;
    } catch (err) {
      console.error('Buy failed:', err);
      setError(err instanceof Error ? err.message : 'Buy failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount, client, signAndExecute, tokens, selectedToken, fetchTokens, selectToken]);

  // Sell tokens back to the bonding curve
  const sell = useCallback(async (
    curveId: string,
    tokenAmount: string,
    minUsdcOut: string
  ): Promise<string | null> => {
    if (!currentAccount) {
      setError('Please connect your wallet');
      return null;
    }

    const token = tokens.find(t => t.id === curveId) || selectedToken;
    if (!token) {
      setError('Token not found');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const amountIn = parseAmount(tokenAmount, 9);
      const minOut = parseAmount(minUsdcOut, 6);

      // Get token coins for the user
      const coins = await client.getCoins({
        owner: currentAccount.address,
        coinType: token.coinType,
      });

      if (coins.data.length === 0) {
        setError(`No ${token.symbol} balance`);
        return null;
      }

      const tx = new Transaction();

      // Merge coins if needed
      let sellCoin;
      if (coins.data.length === 1) {
        const [splitCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [amountIn]);
        sellCoin = splitCoin;
      } else {
        const [primary, ...rest] = coins.data.map(c => c.coinObjectId);
        if (rest.length > 0) {
          tx.mergeCoins(tx.object(primary), rest.map(id => tx.object(id)));
        }
        const [splitCoin] = tx.splitCoins(tx.object(primary), [amountIn]);
        sellCoin = splitCoin;
      }

      tx.moveCall({
        target: `${FEATURES_PACKAGE}::launchpad::sell_entry`,
        typeArguments: [token.coinType],
        arguments: [
          tx.object(LAUNCHPAD_CONFIG),
          tx.object(curveId),
          sellCoin,
          tx.pure.u64(minOut),
        ],
      });

      // Cast to any to handle version mismatch between @mysten/sui packages
      const result = await signAndExecute({
        transaction: tx as any,
      });

      await fetchTokens();
      if (selectedToken?.id === curveId) {
        await selectToken(curveId);
      }

      return result.digest;
    } catch (err) {
      console.error('Sell failed:', err);
      setError(err instanceof Error ? err.message : 'Sell failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount, client, signAndExecute, tokens, selectedToken, fetchTokens, selectToken]);

  // Claim creator fees
  const claimCreatorFees = useCallback(async (curveId: string): Promise<string | null> => {
    if (!currentAccount) {
      setError('Please connect your wallet');
      return null;
    }

    const token = tokens.find(t => t.id === curveId) || selectedToken;
    if (!token) {
      setError('Token not found');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const tx = new Transaction();

      tx.moveCall({
        target: `${FEATURES_PACKAGE}::launchpad::claim_creator_fees_entry`,
        typeArguments: [token.coinType],
        arguments: [tx.object(curveId)],
      });

      // Cast to any to handle version mismatch between @mysten/sui packages
      const result = await signAndExecute({
        transaction: tx as any,
      });

      return result.digest;
    } catch (err) {
      console.error('Claim fees failed:', err);
      setError(err instanceof Error ? err.message : 'Claim fees failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount, signAndExecute, tokens, selectedToken]);

  // Get buy quote (client-side calculation)
  const getBuyQuote = useCallback((curveId: string, usdcAmount: string): TradeQuote | null => {
    const token = tokens.find(t => t.id === curveId) || selectedToken;
    if (!token || !usdcAmount || parseFloat(usdcAmount) <= 0) return null;

    try {
      const usdcIn = parseAmount(usdcAmount, 6);
      const protocolFeeBps = configInfo?.protocolFeeBps || 100;
      const creatorFeeBps = token.creatorFeeBps;

      const protocolFee = (usdcIn * BigInt(protocolFeeBps)) / 10000n;
      const creatorFee = (usdcIn * BigInt(creatorFeeBps)) / 10000n;
      const netUsdc = usdcIn - protocolFee - creatorFee;

      // Simple approximation: tokens = usdc * 1e9 / price
      const currentPrice = parseAmount(token.currentPrice, 6);
      const tokensOut = currentPrice > 0n
        ? (netUsdc * BigInt(1e9)) / currentPrice
        : 0n;

      return {
        tokensOut: formatAmount(tokensOut, 9),
        protocolFee: formatAmount(protocolFee, 6),
        creatorFee: formatAmount(creatorFee, 6),
        priceImpact: 0, // Would need more complex calculation for accurate impact
      };
    } catch {
      return null;
    }
  }, [tokens, selectedToken, configInfo]);

  // Get sell quote (client-side calculation)
  const getSellQuote = useCallback((curveId: string, tokenAmount: string): TradeQuote | null => {
    const token = tokens.find(t => t.id === curveId) || selectedToken;
    if (!token || !tokenAmount || parseFloat(tokenAmount) <= 0) return null;

    try {
      const tokensIn = parseAmount(tokenAmount, 9);
      const currentPrice = parseAmount(token.currentPrice, 6);

      // Simple approximation: usdc = tokens * price / 1e9
      const grossUsdc = (tokensIn * currentPrice) / BigInt(1e9);

      const protocolFeeBps = configInfo?.protocolFeeBps || 100;
      const creatorFeeBps = token.creatorFeeBps;

      const protocolFee = (grossUsdc * BigInt(protocolFeeBps)) / 10000n;
      const creatorFee = (grossUsdc * BigInt(creatorFeeBps)) / 10000n;
      const netUsdc = grossUsdc - protocolFee - creatorFee;

      return {
        usdcOut: formatAmount(netUsdc, 6),
        protocolFee: formatAmount(protocolFee, 6),
        creatorFee: formatAmount(creatorFee, 6),
        priceImpact: 0,
      };
    } catch {
      return null;
    }
  }, [tokens, selectedToken, configInfo]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([fetchConfig(), fetchTokens()]);
  }, [fetchConfig, fetchTokens]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    tokens,
    configInfo,
    selectedToken,
    isLoading,
    error,
    refresh,
    selectToken,
    buy,
    sell,
    claimCreatorFees,
    getBuyQuote,
    getSellQuote,
    isLaunchpadDeployed: true,
  };
}

export default useLaunchpad;
