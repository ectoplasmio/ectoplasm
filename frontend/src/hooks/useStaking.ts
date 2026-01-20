import { useState, useCallback, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../contexts/ToastContext';
import { SUI_CONFIG, formatAmount, parseAmount } from '../config/sui';
import { parseError } from '../utils/errors';

export interface StakePosition {
  id: string;
  owner: string;
  amount: string;
  amountRaw: bigint;
  lockPeriod: number;
  stakeTime: number;
  unlockTime: number;
  bonusMultiplier: number;
  pendingRewards: string;
  isUnlocked: boolean;
}

export interface StakingPoolInfo {
  totalStaked: string;
  totalStakedRaw: bigint;
  rewardBalance: string;
  rewardRate: bigint;
  paused: boolean;
  totalRewardsDistributed: string;
}

export interface UseStakingResult {
  // Pool info
  poolInfo: StakingPoolInfo | null;
  positions: StakePosition[];

  // User input state
  stakeAmount: string;
  setStakeAmount: (amount: string) => void;
  lockOption: number;
  setLockOption: (option: number) => void;

  // Actions
  stake: () => Promise<string | null>;
  unstake: (positionId: string) => Promise<string | null>;
  claimRewards: (positionId: string) => Promise<string | null>;

  // Status
  loading: boolean;
  error: string | null;

  // Refresh
  refreshPoolInfo: () => Promise<void>;
  refreshPositions: () => Promise<void>;
}

// Lock period options
export const LOCK_OPTIONS = [
  { label: 'No Lock', value: 0, days: 0, bonus: '1.0x' },
  { label: '7 Days', value: 1, days: 7, bonus: '1.1x' },
  { label: '30 Days', value: 2, days: 30, bonus: '1.25x' },
  { label: '90 Days', value: 3, days: 90, bonus: '1.5x' },
];

export function useStaking(): UseStakingResult {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { connected, refreshBalances } = useWallet();
  const { showToast, removeToast } = useToast();

  const [poolInfo, setPoolInfo] = useState<StakingPoolInfo | null>(null);
  const [positions, setPositions] = useState<StakePosition[]>([]);
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockOption, setLockOption] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = currentAccount?.address;

  const refreshPoolInfo = useCallback(async () => {
    try {
      const pool = await suiClient.getObject({
        id: SUI_CONFIG.staking.poolId,
        options: { showContent: true },
      });

      if (pool.data?.content?.dataType !== 'moveObject') {
        return;
      }

      const fields = pool.data.content.fields as Record<string, unknown>;

      const totalStaked = BigInt((fields.total_staked as string) || '0');
      const rewardBalanceField = fields.reward_balance as Record<string, unknown>;
      const rewardBalance = BigInt((rewardBalanceField?.value as string) || '0');
      const rewardRate = BigInt((fields.reward_rate as string) || '0');
      const paused = fields.paused as boolean;
      const totalRewardsDistributed = BigInt((fields.total_rewards_distributed as string) || '0');

      setPoolInfo({
        totalStaked: formatAmount(totalStaked, 9),
        totalStakedRaw: totalStaked,
        rewardBalance: formatAmount(rewardBalance, 9),
        rewardRate,
        paused,
        totalRewardsDistributed: formatAmount(totalRewardsDistributed, 9),
      });
    } catch (err) {
      console.error('Failed to fetch staking pool info:', err);
    }
  }, [suiClient]);

  const refreshPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      return;
    }

    try {
      // Query user's StakePosition objects
      const positionType = `${SUI_CONFIG.featuresPackageId}::staking::StakePosition`;

      const ownedObjects = await suiClient.getOwnedObjects({
        owner: address,
        filter: {
          StructType: positionType,
        },
        options: { showContent: true },
      });

      const currentTime = Math.floor(Date.now() / 1000);

      const positions: StakePosition[] = ownedObjects.data
        .filter(obj => obj.data?.content?.dataType === 'moveObject')
        .map(obj => {
          const fields = (obj.data!.content as any).fields as Record<string, unknown>;
          const amount = BigInt((fields.amount as string) || '0');
          const unlockTime = Number(fields.unlock_time || 0);
          const rewardsEarned = BigInt((fields.rewards_earned as string) || '0');

          return {
            id: obj.data!.objectId,
            owner: fields.owner as string,
            amount: formatAmount(amount, 9),
            amountRaw: amount,
            lockPeriod: Number(fields.lock_period || 0),
            stakeTime: Number(fields.stake_time || 0),
            unlockTime,
            bonusMultiplier: Number(fields.bonus_multiplier || 10000),
            pendingRewards: formatAmount(rewardsEarned, 9),
            isUnlocked: currentTime >= unlockTime,
          };
        });

      setPositions(positions);
    } catch (err) {
      console.error('Failed to fetch stake positions:', err);
    }
  }, [address, suiClient]);

  // Refresh on mount and when address changes
  useEffect(() => {
    refreshPoolInfo();
    refreshPositions();
  }, [refreshPoolInfo, refreshPositions]);

  const stake = useCallback(async (): Promise<string | null> => {
    if (!connected || !currentAccount) {
      showToast('error', 'Please connect your wallet');
      return null;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      showToast('error', 'Enter an amount to stake');
      return null;
    }

    setLoading(true);
    setError(null);
    let pendingId: string | null = null;

    try {
      const amountRaw = parseAmount(stakeAmount, 9);

      // Get ECTO coins
      pendingId = Date.now().toString();
      showToast('pending', 'Finding ECTO tokens...');

      const ectoType = SUI_CONFIG.tokens.ECTO.coinType;
      const coins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: ectoType,
      });

      if (coins.data.length === 0) {
        throw new Error('No ECTO tokens found. Get some from the Faucet.');
      }

      // Find a coin with enough balance
      let coinToUse = coins.data[0];
      for (const coin of coins.data) {
        if (BigInt(coin.balance) >= amountRaw) {
          coinToUse = coin;
          break;
        }
      }

      if (BigInt(coinToUse.balance) < amountRaw) {
        throw new Error('Insufficient ECTO balance');
      }

      if (pendingId) removeToast(pendingId);
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      // Build stake transaction
      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.featuresPackageId}::staking::stake_entry`,
        arguments: [
          tx.object(SUI_CONFIG.staking.poolId),
          tx.object(coinToUse.coinObjectId),
          tx.pure.u8(lockOption),
          tx.object('0x6'), // Clock object
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Successfully staked ECTO!', txDigest);

      // Refresh data
      await refreshBalances();
      await refreshPoolInfo();
      await refreshPositions();

      // Reset form
      setStakeAmount('');

      return txDigest;
    } catch (err: unknown) {
      console.error(err);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(err);
      setError(parsed.message);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connected, currentAccount, stakeAmount, lockOption, suiClient, signAndExecuteTransaction, showToast, removeToast, refreshBalances, refreshPoolInfo, refreshPositions]);

  const unstake = useCallback(async (positionId: string): Promise<string | null> => {
    if (!connected || !currentAccount) {
      showToast('error', 'Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);
    let pendingId: string | null = null;

    try {
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.featuresPackageId}::staking::unstake_entry`,
        arguments: [
          tx.object(SUI_CONFIG.staking.poolId),
          tx.object(positionId),
          tx.object('0x6'), // Clock object
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Successfully unstaked ECTO!', txDigest);

      // Refresh data
      await refreshBalances();
      await refreshPoolInfo();
      await refreshPositions();

      return txDigest;
    } catch (err: unknown) {
      console.error(err);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(err);
      setError(parsed.message);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connected, currentAccount, signAndExecuteTransaction, showToast, removeToast, refreshBalances, refreshPoolInfo, refreshPositions]);

  const claimRewards = useCallback(async (positionId: string): Promise<string | null> => {
    if (!connected || !currentAccount) {
      showToast('error', 'Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);
    let pendingId: string | null = null;

    try {
      pendingId = Date.now().toString();
      showToast('pending', 'Please sign the transaction...');

      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.featuresPackageId}::staking::claim_rewards_entry`,
        arguments: [
          tx.object(SUI_CONFIG.staking.poolId),
          tx.object(positionId),
          tx.object('0x6'), // Clock object
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      });

      if (pendingId) removeToast(pendingId);

      const txDigest = result.digest;
      showToast('success', 'Successfully claimed rewards!', txDigest);

      // Refresh data
      await refreshBalances();
      await refreshPoolInfo();
      await refreshPositions();

      return txDigest;
    } catch (err: unknown) {
      console.error(err);
      if (pendingId) removeToast(pendingId);
      const parsed = parseError(err);
      setError(parsed.message);
      showToast('error', parsed.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connected, currentAccount, signAndExecuteTransaction, showToast, removeToast, refreshBalances, refreshPoolInfo, refreshPositions]);

  return {
    poolInfo,
    positions,
    stakeAmount,
    setStakeAmount,
    lockOption,
    setLockOption,
    stake,
    unstake,
    claimRewards,
    loading,
    error,
    refreshPoolInfo,
    refreshPositions,
  };
}

export default useStaking;
