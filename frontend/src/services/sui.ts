// SUI Service Layer for Ectoplasm DEX
// Handles all blockchain interactions

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
// Export Transaction for hooks to use the same type
export { Transaction };
import { SUI_CONFIG, formatAmount, parseAmount } from '../config/sui';

export interface PoolReserves {
  reserveA: bigint;
  reserveB: bigint;
  lpSupply: bigint;
  feeBps: number;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  minimumReceived: bigint;
  fee: bigint;
}

export interface TokenBalance {
  coinType: string;
  symbol: string;
  balance: bigint;
  formatted: string;
}

export class SuiService {
  private client: SuiClient;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.client = new SuiClient({ url: getFullnodeUrl(network) });
  }

  // ===== Balance Queries =====

  async getNativeBalance(address: string): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI',
    });
    return BigInt(balance.totalBalance);
  }

  async getTokenBalance(address: string, coinType: string): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner: address,
      coinType,
    });
    return BigInt(balance.totalBalance);
  }

  async getAllBalances(address: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const [symbol, token] of Object.entries(SUI_CONFIG.tokens)) {
      try {
        const balance = await this.getTokenBalance(address, token.coinType);
        balances.push({
          coinType: token.coinType,
          symbol,
          balance,
          formatted: formatAmount(balance, token.decimals),
        });
      } catch {
        balances.push({
          coinType: token.coinType,
          symbol,
          balance: 0n,
          formatted: '0',
        });
      }
    }

    return balances;
  }

  // ===== Pool Queries =====

  async getPoolReserves(poolId: string): Promise<PoolReserves> {
    const pool = await this.client.getObject({
      id: poolId,
      options: { showContent: true },
    });

    if (pool.data?.content?.dataType !== 'moveObject') {
      throw new Error('Pool not found');
    }

    const fields = pool.data.content.fields as Record<string, unknown>;

    // Parse nested Balance objects
    const reserveA = this.parseBalanceField(fields.reserve_a);
    const reserveB = this.parseBalanceField(fields.reserve_b);
    const lpSupply = this.parseSupplyField(fields.lp_supply);
    const feeBps = Number(fields.fee_bps);

    return { reserveA, reserveB, lpSupply, feeBps };
  }

  private parseBalanceField(field: unknown): bigint {
    if (typeof field === 'object' && field !== null) {
      const obj = field as Record<string, unknown>;
      if ('value' in obj) {
        return BigInt(obj.value as string);
      }
      if ('fields' in obj) {
        const inner = obj.fields as Record<string, unknown>;
        if ('value' in inner) {
          return BigInt(inner.value as string);
        }
      }
    }
    return 0n;
  }

  private parseSupplyField(field: unknown): bigint {
    if (typeof field === 'object' && field !== null) {
      const obj = field as Record<string, unknown>;
      if ('value' in obj) {
        return BigInt(obj.value as string);
      }
      if ('fields' in obj) {
        const inner = obj.fields as Record<string, unknown>;
        if ('value' in inner) {
          return BigInt(inner.value as string);
        }
      }
    }
    return 0n;
  }

  // ===== AMM Math (off-chain calculations) =====

  getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number = 30): bigint {
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
      return 0n;
    }

    const amountInWithFee = amountIn * BigInt(10000 - feeBps);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 10000n + amountInWithFee;

    return numerator / denominator;
  }

  getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number = 30): bigint {
    if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
      return 0n;
    }

    const numerator = reserveIn * amountOut * 10000n;
    const denominator = (reserveOut - amountOut) * BigInt(10000 - feeBps);

    return numerator / denominator + 1n;
  }

  calculatePriceImpact(amountIn: bigint, amountOut: bigint, reserveIn: bigint, reserveOut: bigint): number {
    if (amountIn <= 0n || reserveIn <= 0n) return 0;

    const spotPrice = Number(reserveOut) / Number(reserveIn);
    const execPrice = Number(amountOut) / Number(amountIn);
    const impact = Math.abs((spotPrice - execPrice) / spotPrice) * 100;

    return Math.round(impact * 100) / 100; // Round to 2 decimal places
  }

  async getSwapQuote(
    poolId: string,
    amountIn: bigint,
    isAToB: boolean,
    slippageBps: number = SUI_CONFIG.defaults.slippageBps
  ): Promise<SwapQuote> {
    const reserves = await this.getPoolReserves(poolId);

    const [reserveIn, reserveOut] = isAToB
      ? [reserves.reserveA, reserves.reserveB]
      : [reserves.reserveB, reserves.reserveA];

    const amountOut = this.getAmountOut(amountIn, reserveIn, reserveOut, reserves.feeBps);
    const priceImpact = this.calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);

    // Calculate minimum received with slippage
    const minimumReceived = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

    // Calculate fee
    const fee = (amountIn * BigInt(reserves.feeBps)) / 10000n;

    return {
      amountIn,
      amountOut,
      priceImpact,
      minimumReceived,
      fee,
    };
  }

  // ===== LP Calculations =====

  calculateLpTokens(
    amountA: bigint,
    amountB: bigint,
    reserveA: bigint,
    reserveB: bigint,
    totalLp: bigint
  ): bigint {
    if (totalLp === 0n) {
      // Initial liquidity
      const product = amountA * amountB;
      return this.sqrt(product) - 1000n; // Minus minimum liquidity
    }

    const lpFromA = (amountA * totalLp) / reserveA;
    const lpFromB = (amountB * totalLp) / reserveB;

    return lpFromA < lpFromB ? lpFromA : lpFromB;
  }

  calculateWithdrawAmounts(
    lpAmount: bigint,
    reserveA: bigint,
    reserveB: bigint,
    totalLp: bigint
  ): { amountA: bigint; amountB: bigint } {
    const amountA = (lpAmount * reserveA) / totalLp;
    const amountB = (lpAmount * reserveB) / totalLp;
    return { amountA, amountB };
  }

  private sqrt(value: bigint): bigint {
    if (value === 0n) return 0n;
    let z = value;
    let y = (value + 1n) / 2n;
    while (y < z) {
      z = y;
      y = (value / y + y) / 2n;
    }
    return z;
  }

  // ===== Transaction Building =====

  buildSwapTransaction(
    poolId: string,
    coinObjectId: string,
    minAmountOut: bigint,
    isAToB: boolean,
    coinTypeA: string,
    coinTypeB: string
  ): Transaction {
    const tx = new Transaction();

    const functionName = isAToB ? 'swap_a_for_b_entry' : 'swap_b_for_a_entry';

    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::pool::${functionName}`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        tx.object(poolId),
        tx.object(coinObjectId),
        tx.pure.u64(minAmountOut),
      ],
    });

    return tx;
  }

  buildAddLiquidityTransaction(
    poolId: string,
    coinAObjectId: string,
    coinBObjectId: string,
    minLpOut: bigint,
    coinTypeA: string,
    coinTypeB: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::pool::add_liquidity_entry`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        tx.object(poolId),
        tx.object(coinAObjectId),
        tx.object(coinBObjectId),
        tx.pure.u64(minLpOut),
      ],
    });

    return tx;
  }

  buildRemoveLiquidityTransaction(
    poolId: string,
    lpCoinObjectId: string,
    minAOut: bigint,
    minBOut: bigint,
    coinTypeA: string,
    coinTypeB: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::pool::remove_liquidity_entry`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        tx.object(poolId),
        tx.object(lpCoinObjectId),
        tx.pure.u64(minAOut),
        tx.pure.u64(minBOut),
      ],
    });

    return tx;
  }

  // ===== Coin Utilities =====

  async getCoinsOfType(address: string, coinType: string): Promise<{ objectId: string; balance: bigint }[]> {
    const coins = await this.client.getCoins({
      owner: address,
      coinType,
    });

    return coins.data.map(coin => ({
      objectId: coin.coinObjectId,
      balance: BigInt(coin.balance),
    }));
  }

  async getCoinWithMinBalance(address: string, coinType: string, minBalance: bigint): Promise<string | null> {
    const coins = await this.getCoinsOfType(address, coinType);

    for (const coin of coins) {
      if (coin.balance >= minBalance) {
        return coin.objectId;
      }
    }

    return null;
  }

  // Build transaction to split/merge coins for exact amount
  buildSplitCoinTransaction(
    coinObjectId: string,
    amount: bigint,
    recipient: string
  ): Transaction {
    const tx = new Transaction();
    const [splitCoin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure.u64(amount)]);
    tx.transferObjects([splitCoin], tx.pure.address(recipient));
    return tx;
  }

  // ===== Faucet Functions =====

  /**
   * Build a transaction to request tokens from the shared faucet
   * The new faucet uses a shared object that anyone can call
   */
  buildFaucetTransaction(tokenSymbol: 'ECTO' | 'USDC'): Transaction {
    const tx = new Transaction();

    const faucetId = SUI_CONFIG.faucets[tokenSymbol];
    const moduleName = tokenSymbol.toLowerCase();

    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${moduleName}::request_tokens`,
      arguments: [
        tx.object(faucetId),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  // ===== Client Access =====

  getClient(): SuiClient {
    return this.client;
  }
}

// Export singleton instance
export const suiService = new SuiService('testnet');
