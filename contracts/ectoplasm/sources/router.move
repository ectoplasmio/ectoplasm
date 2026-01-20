/// Ectoplasm Router
/// Provides convenient swap functions with deadline checks, slippage protection,
/// and multi-hop routing capabilities
module ectoplasm::router {
    use sui::object::{Self, UID};
    use sui::coin::{Self, Coin};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;

    use ectoplasm::pool::{Self, Pool, LP};
    use ectoplasm::math;

    // ===== Error Codes =====
    const EDeadlineExpired: u64 = 0;
    const EInsufficientOutputAmount: u64 = 1;
    const EExcessiveInputAmount: u64 = 2;
    const EZeroAmount: u64 = 3;
    const EInvalidPath: u64 = 4;

    // ===== Events =====

    public struct SwapExecuted has copy, drop {
        sender: address,
        amount_in: u64,
        amount_out: u64,
        path_length: u64,
    }

    public struct LiquidityAdded has copy, drop {
        sender: address,
        amount_a: u64,
        amount_b: u64,
        lp_received: u64,
    }

    public struct LiquidityRemoved has copy, drop {
        sender: address,
        lp_burned: u64,
        amount_a: u64,
        amount_b: u64,
    }

    // ===== Swap Functions =====

    /// Swap exact input amount for minimum output amount (A -> B)
    /// Most common swap type - user specifies exact input
    public fun swap_exact_a_for_b<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinA>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): Coin<CoinB> {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        // Execute swap
        let coin_out = pool::swap_a_for_b(pool, coin_in, min_amount_out, ctx);

        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out: coin::value(&coin_out),
            path_length: 1,
        });

        coin_out
    }

    /// Swap exact input amount for minimum output amount (B -> A)
    public fun swap_exact_b_for_a<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinB>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): Coin<CoinA> {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        // Execute swap
        let coin_out = pool::swap_b_for_a(pool, coin_in, min_amount_out, ctx);

        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out: coin::value(&coin_out),
            path_length: 1,
        });

        coin_out
    }

    /// Entry function: Swap exact A for B
    public entry fun swap_exact_a_for_b_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinA>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ) {
        let coin_out = swap_exact_a_for_b(pool, coin_in, min_amount_out, clock, deadline, ctx);
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    /// Entry function: Swap exact B for A
    public entry fun swap_exact_b_for_a_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_in: Coin<CoinB>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ) {
        let coin_out = swap_exact_b_for_a(pool, coin_in, min_amount_out, clock, deadline, ctx);
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    // ===== Multi-Hop Swap Functions =====

    /// Two-hop swap: A -> B -> C
    /// Useful for pairs that don't have direct liquidity
    public fun swap_exact_a_for_c_via_b<CoinA, CoinB, CoinC>(
        pool_ab: &mut Pool<CoinA, CoinB>,
        pool_bc: &mut Pool<CoinB, CoinC>,
        coin_in: Coin<CoinA>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): Coin<CoinC> {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        // First hop: A -> B
        let coin_b = pool::swap_a_for_b(pool_ab, coin_in, 0, ctx);

        // Second hop: B -> C
        let coin_c = pool::swap_a_for_b(pool_bc, coin_b, min_amount_out, ctx);

        let amount_out = coin::value(&coin_c);

        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
            path_length: 2,
        });

        coin_c
    }

    /// Entry function: Two-hop swap A -> B -> C
    public entry fun swap_exact_a_for_c_via_b_entry<CoinA, CoinB, CoinC>(
        pool_ab: &mut Pool<CoinA, CoinB>,
        pool_bc: &mut Pool<CoinB, CoinC>,
        coin_in: Coin<CoinA>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ) {
        let coin_out = swap_exact_a_for_c_via_b(
            pool_ab, pool_bc, coin_in, min_amount_out, clock, deadline, ctx
        );
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    /// Two-hop swap in reverse direction: C -> B -> A
    public fun swap_exact_c_for_a_via_b<CoinA, CoinB, CoinC>(
        pool_ab: &mut Pool<CoinA, CoinB>,
        pool_bc: &mut Pool<CoinB, CoinC>,
        coin_in: Coin<CoinC>,
        min_amount_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): Coin<CoinA> {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        // First hop: C -> B
        let coin_b = pool::swap_b_for_a(pool_bc, coin_in, 0, ctx);

        // Second hop: B -> A
        let coin_a = pool::swap_b_for_a(pool_ab, coin_b, min_amount_out, ctx);

        let amount_out = coin::value(&coin_a);

        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
            path_length: 2,
        });

        coin_a
    }

    // ===== Liquidity Functions =====

    /// Add liquidity with deadline protection
    public fun add_liquidity<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        min_lp_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): Coin<LP<CoinA, CoinB>> {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let amount_a = coin::value(&coin_a);
        let amount_b = coin::value(&coin_b);

        let lp_coin = pool::add_liquidity(pool, coin_a, coin_b, min_lp_out, ctx);

        event::emit(LiquidityAdded {
            sender: tx_context::sender(ctx),
            amount_a,
            amount_b,
            lp_received: coin::value(&lp_coin),
        });

        lp_coin
    }

    /// Entry function: Add liquidity
    public entry fun add_liquidity_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        min_lp_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ) {
        let lp_coin = add_liquidity(pool, coin_a, coin_b, min_lp_out, clock, deadline, ctx);
        transfer::public_transfer(lp_coin, tx_context::sender(ctx));
    }

    /// Remove liquidity with deadline and minimum output protection
    public fun remove_liquidity<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        lp_coin: Coin<LP<CoinA, CoinB>>,
        min_a_out: u64,
        min_b_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ): (Coin<CoinA>, Coin<CoinB>) {
        // Check deadline
        assert!(clock::timestamp_ms(clock) <= deadline, EDeadlineExpired);

        let lp_amount = coin::value(&lp_coin);

        let (coin_a, coin_b) = pool::remove_liquidity(pool, lp_coin, min_a_out, min_b_out, ctx);

        event::emit(LiquidityRemoved {
            sender: tx_context::sender(ctx),
            lp_burned: lp_amount,
            amount_a: coin::value(&coin_a),
            amount_b: coin::value(&coin_b),
        });

        (coin_a, coin_b)
    }

    /// Entry function: Remove liquidity
    public entry fun remove_liquidity_entry<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        lp_coin: Coin<LP<CoinA, CoinB>>,
        min_a_out: u64,
        min_b_out: u64,
        clock: &Clock,
        deadline: u64,
        ctx: &mut TxContext
    ) {
        let (coin_a, coin_b) = remove_liquidity(
            pool, lp_coin, min_a_out, min_b_out, clock, deadline, ctx
        );
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(coin_a, sender);
        transfer::public_transfer(coin_b, sender);
    }

    // ===== Quote Functions =====

    /// Get quote for swapping A to B
    public fun get_amount_out_a_to_b<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        pool::get_amount_out_a_to_b(pool, amount_in)
    }

    /// Get quote for swapping B to A
    public fun get_amount_out_b_to_a<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        pool::get_amount_out_b_to_a(pool, amount_in)
    }

    /// Get quote for two-hop swap A -> B -> C
    public fun get_amount_out_a_to_c_via_b<CoinA, CoinB, CoinC>(
        pool_ab: &Pool<CoinA, CoinB>,
        pool_bc: &Pool<CoinB, CoinC>,
        amount_in: u64
    ): u64 {
        let amount_b = pool::get_amount_out_a_to_b(pool_ab, amount_in);
        pool::get_amount_out_a_to_b(pool_bc, amount_b)
    }

    /// Calculate optimal amounts for adding liquidity
    /// Given desired amounts, returns actual amounts that maintain pool ratio
    public fun get_optimal_liquidity_amounts<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_a_desired: u64,
        amount_b_desired: u64,
        amount_a_min: u64,
        amount_b_min: u64
    ): (u64, u64) {
        let (reserve_a, reserve_b) = pool::get_reserves(pool);

        // If pool is empty, use desired amounts
        if (reserve_a == 0 && reserve_b == 0) {
            return (amount_a_desired, amount_b_desired)
        };

        // Calculate optimal B for given A
        let amount_b_optimal = math::quote(amount_a_desired, reserve_a, reserve_b);

        if (amount_b_optimal <= amount_b_desired) {
            assert!(amount_b_optimal >= amount_b_min, EInsufficientOutputAmount);
            (amount_a_desired, amount_b_optimal)
        } else {
            // Calculate optimal A for given B
            let amount_a_optimal = math::quote(amount_b_desired, reserve_b, reserve_a);
            assert!(amount_a_optimal <= amount_a_desired, EExcessiveInputAmount);
            assert!(amount_a_optimal >= amount_a_min, EInsufficientOutputAmount);
            (amount_a_optimal, amount_b_desired)
        }
    }

    /// Calculate price impact for a potential swap
    public fun get_price_impact_a_to_b<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        let (reserve_a, reserve_b) = pool::get_reserves(pool);
        let amount_out = pool::get_amount_out_a_to_b(pool, amount_in);
        math::calculate_price_impact(amount_in, amount_out, reserve_a, reserve_b)
    }

    /// Calculate price impact for B to A swap
    public fun get_price_impact_b_to_a<CoinA, CoinB>(
        pool: &Pool<CoinA, CoinB>,
        amount_in: u64
    ): u64 {
        let (reserve_a, reserve_b) = pool::get_reserves(pool);
        let amount_out = pool::get_amount_out_b_to_a(pool, amount_in);
        math::calculate_price_impact(amount_in, amount_out, reserve_b, reserve_a)
    }
}
