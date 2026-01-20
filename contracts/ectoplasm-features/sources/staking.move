// SPDX-License-Identifier: MIT
/// Staking module for Ectoplasm DEX
///
/// Allows users to stake ECTO tokens and earn rewards over time.
/// Features:
/// - Flexible staking with no lock period (or optional lock for bonus)
/// - Reward distribution based on stake duration and amount
/// - Multiple reward tiers based on lock duration
/// - Admin controls for reward rate management
module ectoplasm_features::staking {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use ectoplasm::ecto::ECTO;

    // ============ Error Codes ============
    const EZeroAmount: u64 = 0;
    const EInsufficientStake: u64 = 1;
    const EStakeLocked: u64 = 2;
    const ENoRewardsToClaim: u64 = 3;
    const EInsufficientRewardPool: u64 = 4;
    const EInvalidLockPeriod: u64 = 5;

    // ============ Constants ============
    /// Reward rate per second per staked token (scaled by 1e18)
    /// Default: ~10% APY = 0.10 / (365 * 24 * 3600) * 1e18 ≈ 3170979198
    const DEFAULT_REWARD_RATE: u64 = 3170979198;

    /// Precision for reward calculations
    const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18

    /// Lock period options (in seconds)
    const NO_LOCK: u64 = 0;
    const LOCK_7_DAYS: u64 = 604800;      // 7 * 24 * 3600
    const LOCK_30_DAYS: u64 = 2592000;    // 30 * 24 * 3600
    const LOCK_90_DAYS: u64 = 7776000;    // 90 * 24 * 3600

    /// Bonus multipliers for lock periods (in basis points, 10000 = 1x)
    const BONUS_NO_LOCK: u64 = 10000;     // 1.0x
    const BONUS_7_DAYS: u64 = 11000;      // 1.1x
    const BONUS_30_DAYS: u64 = 12500;     // 1.25x
    const BONUS_90_DAYS: u64 = 15000;     // 1.5x

    // ============ Structs ============

    /// Admin capability for managing staking pool
    public struct StakingAdminCap has key, store {
        id: UID,
    }

    /// Global staking pool configuration
    public struct StakingPool has key {
        id: UID,
        /// Total staked tokens across all users
        total_staked: u64,
        /// Reward tokens available for distribution
        reward_balance: Balance<ECTO>,
        /// Reward rate per second per token (scaled by 1e18)
        reward_rate: u64,
        /// Last time rewards were updated
        last_update_time: u64,
        /// Accumulated rewards per token (scaled by 1e18)
        reward_per_token_stored: u128,
        /// Whether staking is paused
        paused: bool,
        /// Total rewards distributed
        total_rewards_distributed: u64,
    }

    /// Individual stake position
    public struct StakePosition has key, store {
        id: UID,
        /// Owner address
        owner: address,
        /// Amount of tokens staked
        amount: u64,
        /// Lock period in seconds (0 = no lock)
        lock_period: u64,
        /// Timestamp when stake was created
        stake_time: u64,
        /// Timestamp when stake can be withdrawn (stake_time + lock_period)
        unlock_time: u64,
        /// Reward per token at time of last update
        reward_per_token_paid: u128,
        /// Accumulated unclaimed rewards
        rewards_earned: u64,
        /// Bonus multiplier for this stake (in basis points)
        bonus_multiplier: u64,
    }

    // ============ Events ============

    public struct StakingPoolCreated has copy, drop {
        pool_id: address,
        reward_rate: u64,
    }

    public struct Staked has copy, drop {
        user: address,
        amount: u64,
        lock_period: u64,
        bonus_multiplier: u64,
        stake_id: address,
    }

    public struct Unstaked has copy, drop {
        user: address,
        amount: u64,
        stake_id: address,
    }

    public struct RewardsClaimed has copy, drop {
        user: address,
        amount: u64,
        stake_id: address,
    }

    public struct RewardsAdded has copy, drop {
        amount: u64,
        new_total: u64,
    }

    public struct RewardRateUpdated has copy, drop {
        old_rate: u64,
        new_rate: u64,
    }

    // ============ Init ============

    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = StakingAdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());

        // Create staking pool
        let pool = StakingPool {
            id: object::new(ctx),
            total_staked: 0,
            reward_balance: balance::zero(),
            reward_rate: DEFAULT_REWARD_RATE,
            last_update_time: 0,
            reward_per_token_stored: 0,
            paused: false,
            total_rewards_distributed: 0,
        };

        event::emit(StakingPoolCreated {
            pool_id: object::uid_to_address(&pool.id),
            reward_rate: DEFAULT_REWARD_RATE,
        });

        transfer::share_object(pool);
    }

    // ============ Core Functions ============

    /// Stake ECTO tokens with optional lock period
    /// lock_period: 0 = no lock, 1 = 7 days, 2 = 30 days, 3 = 90 days
    public fun stake(
        pool: &mut StakingPool,
        stake_coin: Coin<ECTO>,
        lock_option: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ): StakePosition {
        let amount = coin::value(&stake_coin);
        assert!(amount > 0, EZeroAmount);
        assert!(!pool.paused, EInsufficientStake);

        // Determine lock period and bonus
        let (lock_period, bonus_multiplier) = get_lock_params(lock_option);

        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds

        // Update pool rewards before modifying state
        update_reward_per_token(pool, current_time);

        // Add staked tokens to pool (we track total, not hold coins)
        // User keeps their stake in a StakePosition object
        pool.total_staked = pool.total_staked + amount;

        // Create stake position
        let stake_position = StakePosition {
            id: object::new(ctx),
            owner: ctx.sender(),
            amount,
            lock_period,
            stake_time: current_time,
            unlock_time: current_time + lock_period,
            reward_per_token_paid: pool.reward_per_token_stored,
            rewards_earned: 0,
            bonus_multiplier,
        };

        event::emit(Staked {
            user: ctx.sender(),
            amount,
            lock_period,
            bonus_multiplier,
            stake_id: object::uid_to_address(&stake_position.id),
        });

        // Burn the staked coins (they're now tracked in total_staked)
        // In a real implementation, we'd hold them in pool, but for simplicity
        // we transfer to a "vault" which is this pool's balance
        let stake_balance = coin::into_balance(stake_coin);
        balance::join(&mut pool.reward_balance, stake_balance);

        stake_position
    }

    /// Stake entry function - creates position and transfers to user
    public entry fun stake_entry(
        pool: &mut StakingPool,
        stake_coin: Coin<ECTO>,
        lock_option: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let position = stake(pool, stake_coin, lock_option, clock, ctx);
        transfer::transfer(position, ctx.sender());
    }

    /// Unstake tokens from a position
    public fun unstake(
        pool: &mut StakingPool,
        position: StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (Coin<ECTO>, Coin<ECTO>) {
        let current_time = clock::timestamp_ms(clock) / 1000;

        // Check if unlocked
        assert!(current_time >= position.unlock_time, EStakeLocked);

        // Update rewards first
        update_reward_per_token(pool, current_time);

        // Calculate pending rewards
        let pending_rewards = calculate_pending_rewards(pool, &position);
        let total_rewards = position.rewards_earned + pending_rewards;

        // Update pool state
        pool.total_staked = pool.total_staked - position.amount;

        let stake_amount = position.amount;
        let stake_id = object::uid_to_address(&position.id);
        let user = position.owner;

        // Destroy position
        let StakePosition {
            id,
            owner: _,
            amount: _,
            lock_period: _,
            stake_time: _,
            unlock_time: _,
            reward_per_token_paid: _,
            rewards_earned: _,
            bonus_multiplier: _,
        } = position;
        object::delete(id);

        // Withdraw staked tokens + rewards from pool balance
        let total_withdraw = stake_amount + total_rewards;
        assert!(balance::value(&pool.reward_balance) >= total_withdraw, EInsufficientRewardPool);

        let withdraw_balance = balance::split(&mut pool.reward_balance, stake_amount);
        let staked_coin = coin::from_balance(withdraw_balance, ctx);

        let rewards_coin = if (total_rewards > 0 && balance::value(&pool.reward_balance) >= total_rewards) {
            pool.total_rewards_distributed = pool.total_rewards_distributed + total_rewards;
            let reward_balance = balance::split(&mut pool.reward_balance, total_rewards);
            coin::from_balance(reward_balance, ctx)
        } else {
            coin::zero(ctx)
        };

        event::emit(Unstaked {
            user,
            amount: stake_amount,
            stake_id,
        });

        if (coin::value(&rewards_coin) > 0) {
            event::emit(RewardsClaimed {
                user,
                amount: coin::value(&rewards_coin),
                stake_id,
            });
        };

        (staked_coin, rewards_coin)
    }

    /// Unstake entry function
    public entry fun unstake_entry(
        pool: &mut StakingPool,
        position: StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let (staked, rewards) = unstake(pool, position, clock, ctx);
        let sender = ctx.sender();
        transfer::public_transfer(staked, sender);
        if (coin::value(&rewards) > 0) {
            transfer::public_transfer(rewards, sender);
        } else {
            coin::destroy_zero(rewards);
        }
    }

    /// Claim rewards without unstaking
    public fun claim_rewards(
        pool: &mut StakingPool,
        position: &mut StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<ECTO> {
        let current_time = clock::timestamp_ms(clock) / 1000;

        // Update rewards
        update_reward_per_token(pool, current_time);

        // Calculate pending rewards
        let pending_rewards = calculate_pending_rewards(pool, position);
        let total_rewards = position.rewards_earned + pending_rewards;

        assert!(total_rewards > 0, ENoRewardsToClaim);
        assert!(balance::value(&pool.reward_balance) >= total_rewards, EInsufficientRewardPool);

        // Reset position rewards
        position.rewards_earned = 0;
        position.reward_per_token_paid = pool.reward_per_token_stored;

        // Transfer rewards
        pool.total_rewards_distributed = pool.total_rewards_distributed + total_rewards;
        let reward_balance = balance::split(&mut pool.reward_balance, total_rewards);
        let rewards_coin = coin::from_balance(reward_balance, ctx);

        event::emit(RewardsClaimed {
            user: position.owner,
            amount: total_rewards,
            stake_id: object::uid_to_address(&position.id),
        });

        rewards_coin
    }

    /// Claim rewards entry function
    public entry fun claim_rewards_entry(
        pool: &mut StakingPool,
        position: &mut StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let rewards = claim_rewards(pool, position, clock, ctx);
        transfer::public_transfer(rewards, ctx.sender());
    }

    // ============ Admin Functions ============

    /// Add rewards to the pool
    public entry fun add_rewards(
        _admin: &StakingAdminCap,
        pool: &mut StakingPool,
        rewards: Coin<ECTO>,
    ) {
        let amount = coin::value(&rewards);
        balance::join(&mut pool.reward_balance, coin::into_balance(rewards));

        event::emit(RewardsAdded {
            amount,
            new_total: balance::value(&pool.reward_balance),
        });
    }

    /// Update reward rate
    public entry fun set_reward_rate(
        _admin: &StakingAdminCap,
        pool: &mut StakingPool,
        new_rate: u64,
        clock: &Clock,
    ) {
        let current_time = clock::timestamp_ms(clock) / 1000;

        // Update rewards with old rate first
        update_reward_per_token(pool, current_time);

        let old_rate = pool.reward_rate;
        pool.reward_rate = new_rate;

        event::emit(RewardRateUpdated {
            old_rate,
            new_rate,
        });
    }

    /// Pause/unpause staking
    public entry fun set_paused(
        _admin: &StakingAdminCap,
        pool: &mut StakingPool,
        paused: bool,
    ) {
        pool.paused = paused;
    }

    // ============ View Functions ============

    /// Get pool info
    public fun get_pool_info(pool: &StakingPool): (u64, u64, u64, bool, u64) {
        (
            pool.total_staked,
            balance::value(&pool.reward_balance),
            pool.reward_rate,
            pool.paused,
            pool.total_rewards_distributed,
        )
    }

    /// Get stake position info
    public fun get_position_info(position: &StakePosition): (address, u64, u64, u64, u64, u64) {
        (
            position.owner,
            position.amount,
            position.lock_period,
            position.stake_time,
            position.unlock_time,
            position.bonus_multiplier,
        )
    }

    /// Calculate pending rewards for a position
    public fun get_pending_rewards(
        pool: &StakingPool,
        position: &StakePosition,
        clock: &Clock,
    ): u64 {
        let current_time = clock::timestamp_ms(clock) / 1000;
        let current_reward_per_token = calculate_reward_per_token(pool, current_time);

        let reward_diff = current_reward_per_token - position.reward_per_token_paid;
        let base_reward = ((position.amount as u128) * reward_diff / PRECISION) as u64;
        let bonus_reward = base_reward * position.bonus_multiplier / 10000;

        position.rewards_earned + bonus_reward
    }

    /// Check if position is unlocked
    public fun is_unlocked(position: &StakePosition, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock) / 1000;
        current_time >= position.unlock_time
    }

    /// Get time until unlock
    public fun time_until_unlock(position: &StakePosition, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock) / 1000;
        if (current_time >= position.unlock_time) {
            0
        } else {
            position.unlock_time - current_time
        }
    }

    // ============ Internal Functions ============

    fun get_lock_params(lock_option: u8): (u64, u64) {
        if (lock_option == 0) {
            (NO_LOCK, BONUS_NO_LOCK)
        } else if (lock_option == 1) {
            (LOCK_7_DAYS, BONUS_7_DAYS)
        } else if (lock_option == 2) {
            (LOCK_30_DAYS, BONUS_30_DAYS)
        } else if (lock_option == 3) {
            (LOCK_90_DAYS, BONUS_90_DAYS)
        } else {
            abort EInvalidLockPeriod
        }
    }

    fun update_reward_per_token(pool: &mut StakingPool, current_time: u64) {
        pool.reward_per_token_stored = calculate_reward_per_token(pool, current_time);
        pool.last_update_time = current_time;
    }

    fun calculate_reward_per_token(pool: &StakingPool, current_time: u64): u128 {
        if (pool.total_staked == 0) {
            return pool.reward_per_token_stored
        };

        let time_elapsed = if (current_time > pool.last_update_time) {
            current_time - pool.last_update_time
        } else {
            0
        };

        let new_rewards = (time_elapsed as u128) * (pool.reward_rate as u128);
        pool.reward_per_token_stored + (new_rewards * PRECISION / (pool.total_staked as u128))
    }

    fun calculate_pending_rewards(pool: &StakingPool, position: &StakePosition): u64 {
        let reward_diff = pool.reward_per_token_stored - position.reward_per_token_paid;
        let base_reward = ((position.amount as u128) * reward_diff / PRECISION) as u64;
        // Apply bonus multiplier
        base_reward * position.bonus_multiplier / 10000
    }

    // ============ Test Functions ============
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
