/// Ectoplasm AMM Liquidity Pool
/// Implements a constant product market maker (x * y = k)
///
/// Each pool is a shared object that holds two token types and issues
/// LP tokens representing liquidity provider shares.
module ectoplasm::pool {
    use sui::object::{Self, UID, ID};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::balance::{Self, Supply, Balance};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    use ectoplasm::math;

    // ===== Error Codes =====
    const EZeroAmount: u64 = 0;
    const EInsufficientLiquidity: u64 = 1;
    const ESlippageExceeded: u64 = 2;
    const EInvalidFee: u64 = 3;
    const EPoolAlreadyExists: u64 = 4;
    const EInsufficientBalance: u64 = 5;
    const EDeadlineExpired: u64 = 6;
    const ENotAdmin: u64 = 7;

    // ===== Constants =====
    /// Minimum liquidity locked forever to prevent division by zero
    const MINIMUM_LIQUIDITY: u64 = 1000;

    /// Default swap fee: 0.3% (30 basis points)
    const DEFAULT_FEE_BPS: u64 = 30;

    /// Maximum fee: 5% (500 basis points)
    const MAX_FEE_BPS: u64 = 500;

    /// Fee denominator
    const FEE_DENOMINATOR: u64 = 10000;

    // ===== LP Token =====

    /// LP Token type for a specific pool pair
    /// The phantom types ensure type safety - LP<SUI, USDC> != LP<USDC, SUI>
    public struct LP<phantom CoinA, phantom CoinB> has drop {}

    // ===== Pool Structure =====

    /// The liquidity pool - a shared object
    public struct Pool<phantom CoinA, phantom CoinB> has key {
        id: UID,
        /// Reserve of token A
        reserve_a: Balance<CoinA>,
        /// Reserve of token B
        reserve_b: Balance<CoinB>,
        /// LP token supply tracker
        lp_supply: Supply<LP<CoinA, CoinB>>,
        /// Swap fee in basis points (e.g., 30 = 0.3%)
        fee_bps: u64,
        /// Locked minimum liquidity (burned on creation)
        locked_lp: Balance<LP<CoinA, CoinB>>,
    }

    /// Admin capability for managing pools
    public struct AdminCap has key, store {
        id: UID,
    }

    // ===== Events =====

    public struct PoolCreated has copy, drop {
        pool_id: ID,
        creator: address,
        initial_a: u64,
        initial_b: u64,
        lp_minted: u64,
    }

    public struct LiquidityAdded has copy, drop {
        pool_id: ID,
        provider: address,
        amount_a: u64,
        amount_b: u64,
        lp_minted: u64,
    }

    public struct LiquidityRemoved has copy, drop {
        pool_id: ID,
        provider: address,
        amount_a: u64,
        amount_b: u64,
        lp_burned: u64,
    }

    public struct Swap has copy, drop {
        pool_id: ID,
        sender: address,
        amount_in: u64,
        amount_out: u64,
        a_to_b: bool,
    }

    public struct FeeUpdated has copy, drop {
        pool_id: ID,
        old_fee: u64,
        new_fee: u64,
    }

    // ===== Initialization =====

    /// Create admin capability - called once at package publish
    fun init(ctx: &mut TxContext) {
        let admin = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    // ===== Pool Creation =====

    /// Create a new liquidity pool with initial liquidity
    ///
    /// The first liquidity provider sets the initial price ratio.
    /// A small amount of LP tokens (MINIMUM_LIQUIDITY) is permanently locked
    /// to prevent the pool from ever being completely drained.
    public fun create_pool<CoinA, CoinB>(
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        ctx: &mut TxContext
    ): Coin<LP<CoinA, CoinB>> {
        let amount_a = coin::value(&coin_a);
        let amount_b = coin::value(&coin_b);

        assert!(amount_a > 0 && amount_b > 0, EZeroAmount);

        // Calculate initial LP tokens: sqrt(a * b) - MINIMUM_LIQUIDITY
        let lp_amount = math::calculate_initial_lp_amount(
            amount_a,
            amount_b,
            MINIMUM_LIQUIDITY
        );

        // Create LP token supply
        let mut lp_supply = balance::create_supply(LP<CoinA, CoinB> {});

        // Mint LP tokens
        let total_lp = lp_amount + MINIMUM_LIQUIDITY;
        let lp_balance = balance::increase_supply(&mut lp_supply, total_lp);

        // Split off minimum liquidity to lock forever
        let mut lp_balance_mut = lp_balance;
        let locked = balance::split(&mut lp_balance_mut, MINIMUM_LIQUIDITY);

        // Create the pool
        let pool = Pool<CoinA, CoinB> {
            id: object::new(ctx),
            reserve_a: coin::into_balance(coin_a),
            reserve_b: coin::into_balance(coin_b),
            lp_supply,
            fee_bps: DEFAULT_FEE_BPS,
            locked_lp: locked,
        };

        let pool_id = object::id(&pool);
        let creator = tx_context::sender(ctx);

        // Emit event
        event::emit(PoolCreated {
            pool_id,
            creator,
            initial_a: amount_a,
            initial_b: amount_b,
            lp_minted: lp_amount,
        });

        // Share the pool so anyone can interact with it
        transfer::share_object(pool);

        // Return LP tokens to creator
        coin::from_balance(lp_balance_mut, ctx)
    }

    /// Entry function wrapper for create_pool
    public entry fun create_pool_entry<CoinA, CoinB>(
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        ctx: &mut TxContext
    ) {
        let lp_coin = create_pool(coin_a, coin_b, ctx);
        transfer::public_transfer(lp_coin, tx_context::sender(ctx));
    }

    // ===== Add Liquidity =====

    /// Add liquidity to an existing pool
    ///
    /// The amounts should be provided in the same ratio as the current reserves.
    /// If the ratio doesn't match, LP tokens are calculated based on the smaller ratio.
    public fun add_liquidity<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        min_lp_out: u64,
        ctx: &mut TxContext
    ): Coin<LP<CoinA, CoinB>> {
        let amount_a = coin::value(&coin_a);
        let amount_b = coin::value(&coin_b);

        assert!(amount_a > 0 && amount_b > 0, EZeroAmount);

        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);
        let total_lp = balance::supply_value(&pool.lp_supply);

        // Calculate LP tokens to mint
        let lp_amount = math::calculate_lp_amount(
            amount_a,
            amount_b,
            reserve_a,
            reserve_b,
            total_lp
        );

        assert!(lp_amount >= min_lp_out, ESlippageExceeded);

        // Add tokens to reserves
        balance::join(&mut pool.reserve_a, coin::into_balance(coin_a));
        balance::join(&mut pool.reserve_b, coin::into_balance(coin_b));

        // Mint LP tokens
        let lp_balance = balance::increase_supply(&mut pool.lp_supply, lp_amount);

        // Emit event
        event::emit(LiquidityAdded {
            pool_id: object::id(pool),
            provider: tx_context::sender(ctx),
            amount_a,
            amount_b,
            lp_minted: lp_amount,
        });

        coin::from_balance(lp_balance, ctx)
    }

    /// Entry function wrapper for add_liquidity
    public entry fun add_liquidity_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        min_lp_out: u64,
        ctx: &mut TxContext
    ) {
        let lp_coin = add_liquidity(pool, coin_a, coin_b, min_lp_out, ctx);
        transfer::public_transfer(lp_coin, tx_context::sender(ctx));
    }

    // ===== Remove Liquidity =====

    /// Remove liquidity from a pool by burning LP tokens
    ///
    /// Returns proportional amounts of both tokens based on LP share.
    public fun remove_liquidity<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        lp_coin: Coin<LP<CoinA, CoinB>>,
        min_a_out: u64,
        min_b_out: u64,
        ctx: &mut TxContext
    ): (Coin<CoinA>, Coin<CoinB>) {
        let lp_amount = coin::value(&lp_coin);
        assert!(lp_amount > 0, EZeroAmount);

        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);
        let total_lp = balance::supply_value(&pool.lp_supply);

        // Calculate tokens to return
        let (amount_a, amount_b) = math::calculate_withdraw_amounts(
            lp_amount,
            reserve_a,
            reserve_b,
            total_lp
        );

        assert!(amount_a >= min_a_out, ESlippageExceeded);
        assert!(amount_b >= min_b_out, ESlippageExceeded);

        // Burn LP tokens
        balance::decrease_supply(&mut pool.lp_supply, coin::into_balance(lp_coin));

        // Withdraw tokens from reserves
        let coin_a = coin::from_balance(
            balance::split(&mut pool.reserve_a, amount_a),
            ctx
        );
        let coin_b = coin::from_balance(
            balance::split(&mut pool.reserve_b, amount_b),
            ctx
        );

        // Emit event
        event::emit(LiquidityRemoved {
            pool_id: object::id(pool),
            provider: tx_context::sender(ctx),
            amount_a,
            amount_b,
            lp_burned: lp_amount,
        });

        (coin_a, coin_b)
    }

    /// Entry function wrapper for remove_liquidity
    public entry fun remove_liquidity_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        lp_coin: Coin<LP<CoinA, CoinB>>,
        min_a_out: u64,
        min_b_out: u64,
        ctx: &mut TxContext
    ) {
        let (coin_a, coin_b) = remove_liquidity(pool, lp_coin, min_a_out, min_b_out, ctx);
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(coin_a, sender);
        transfer::public_transfer(coin_b, sender);
    }

    // ===== Swap Functions =====

    /// Swap token A for token B
    public fun swap_a_for_b<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinA>,
        min_out: u64,
        ctx: &mut TxContext
    ): Coin<CoinB> {
        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);

        // Calculate output amount
        let amount_out = math::get_amount_out(
            amount_in,
            reserve_a,
            reserve_b,
            pool.fee_bps
        );

        assert!(amount_out >= min_out, ESlippageExceeded);
        assert!(amount_out < reserve_b, EInsufficientLiquidity);

        // Update reserves
        balance::join(&mut pool.reserve_a, coin::into_balance(coin_in));
        let coin_out = coin::from_balance(
            balance::split(&mut pool.reserve_b, amount_out),
            ctx
        );

        // Emit event
        event::emit(Swap {
            pool_id: object::id(pool),
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
            a_to_b: true,
        });

        coin_out
    }

    /// Swap token B for token A
    public fun swap_b_for_a<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinB>,
        min_out: u64,
        ctx: &mut TxContext
    ): Coin<CoinA> {
        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);

        // Calculate output amount
        let amount_out = math::get_amount_out(
            amount_in,
            reserve_b,
            reserve_a,
            pool.fee_bps
        );

        assert!(amount_out >= min_out, ESlippageExceeded);
        assert!(amount_out < reserve_a, EInsufficientLiquidity);

        // Update reserves
        balance::join(&mut pool.reserve_b, coin::into_balance(coin_in));
        let coin_out = coin::from_balance(
            balance::split(&mut pool.reserve_a, amount_out),
            ctx
        );

        // Emit event
        event::emit(Swap {
            pool_id: object::id(pool),
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
            a_to_b: false,
        });

        coin_out
    }

    /// Entry function: Swap A for B
    public entry fun swap_a_for_b_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinA>,
        min_out: u64,
        ctx: &mut TxContext
    ) {
        let coin_out = swap_a_for_b(pool, coin_in, min_out, ctx);
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    /// Entry function: Swap B for A
    public entry fun swap_b_for_a_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinB>,
        min_out: u64,
        ctx: &mut TxContext
    ) {
        let coin_out = swap_b_for_a(pool, coin_in, min_out, ctx);
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    // ===== Admin Functions =====

    /// Update the swap fee (admin only)
    public entry fun set_fee<CoinA, CoinB>(
        _admin: &AdminCap,
        pool: &mut Pool<CoinA, CoinB>,
        new_fee_bps: u64
    ) {
        assert!(new_fee_bps <= MAX_FEE_BPS, EInvalidFee);

        let old_fee = pool.fee_bps;
        pool.fee_bps = new_fee_bps;

        event::emit(FeeUpdated {
            pool_id: object::id(pool),
            old_fee,
            new_fee: new_fee_bps,
        });
    }

    // ===== View Functions =====

    /// Get current reserves
    public fun get_reserves<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): (u64, u64) {
        (
            balance::value(&pool.reserve_a),
            balance::value(&pool.reserve_b)
        )
    }

    /// Get total LP supply
    public fun get_lp_supply<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        balance::supply_value(&pool.lp_supply)
    }

    /// Get current fee
    public fun get_fee<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        pool.fee_bps
    }

    /// Get pool ID
    public fun get_pool_id<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): ID {
        object::id(pool)
    }

    /// Calculate output amount for a potential swap (A to B)
    public fun get_amount_out_a_to_b<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        let (reserve_a, reserve_b) = get_reserves(pool);
        math::get_amount_out(amount_in, reserve_a, reserve_b, pool.fee_bps)
    }

    /// Calculate output amount for a potential swap (B to A)
    public fun get_amount_out_b_to_a<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        let (reserve_a, reserve_b) = get_reserves(pool);
        math::get_amount_out(amount_in, reserve_b, reserve_a, pool.fee_bps)
    }

    /// Get the spot price of A in terms of B (reserve_b / reserve_a)
    /// Returns price * 1e9 for precision
    public fun get_spot_price_a_in_b<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        let (reserve_a, reserve_b) = get_reserves(pool);
        math::mul_div(reserve_b, 1_000_000_000, reserve_a)
    }

    /// Get the spot price of B in terms of A (reserve_a / reserve_b)
    /// Returns price * 1e9 for precision
    public fun get_spot_price_b_in_a<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        let (reserve_a, reserve_b) = get_reserves(pool);
        math::mul_div(reserve_a, 1_000_000_000, reserve_b)
    }

    // ===== Test Helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
