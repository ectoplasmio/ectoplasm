/// AMM Math utilities for constant product market maker
/// Uses the formula: (x + dx) * (y - dy) = x * y (k invariant)
module ectoplasm::math {
    // ===== Error Codes =====
    const EInsufficientInputAmount: u64 = 0;
    const EInsufficientLiquidity: u64 = 1;
    const EInsufficientOutputAmount: u64 = 2;
    const EZeroAmount: u64 = 3;

    // ===== Constants =====
    /// Fee denominator (10000 = 100%)
    const FEE_DENOMINATOR: u64 = 10000;

    // ===== Core AMM Functions =====

    /// Calculate output amount for a given input amount
    /// Formula: dy = (y * dx * (10000 - fee)) / (x * 10000 + dx * (10000 - fee))
    public fun get_amount_out(
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
        fee_bps: u64
    ): u64 {
        assert!(amount_in > 0, EInsufficientInputAmount);
        assert!(reserve_in > 0 && reserve_out > 0, EInsufficientLiquidity);

        let amount_in_with_fee = (amount_in as u128) * ((FEE_DENOMINATOR - fee_bps) as u128);
        let numerator = amount_in_with_fee * (reserve_out as u128);
        let denominator = (reserve_in as u128) * (FEE_DENOMINATOR as u128) + amount_in_with_fee;

        ((numerator / denominator) as u64)
    }

    /// Calculate required input amount for a desired output amount
    public fun get_amount_in(
        amount_out: u64,
        reserve_in: u64,
        reserve_out: u64,
        fee_bps: u64
    ): u64 {
        assert!(amount_out > 0, EInsufficientOutputAmount);
        assert!(reserve_in > 0 && reserve_out > 0, EInsufficientLiquidity);
        assert!(amount_out < reserve_out, EInsufficientLiquidity);

        let numerator = (reserve_in as u128) * (amount_out as u128) * (FEE_DENOMINATOR as u128);
        let denominator = ((reserve_out - amount_out) as u128) * ((FEE_DENOMINATOR - fee_bps) as u128);

        (((numerator / denominator) + 1) as u64)
    }

    /// Calculate the amount of LP tokens to mint for initial liquidity
    /// Formula: sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY
    public fun calculate_initial_lp_amount(
        amount_a: u64,
        amount_b: u64,
        minimum_liquidity: u64
    ): u64 {
        let product = (amount_a as u128) * (amount_b as u128);
        let lp_amount = sqrt_u128(product);

        assert!(lp_amount > (minimum_liquidity as u128), EInsufficientLiquidity);

        ((lp_amount - (minimum_liquidity as u128)) as u64)
    }

    /// Calculate LP tokens to mint for subsequent liquidity additions
    public fun calculate_lp_amount(
        amount_a: u64,
        amount_b: u64,
        reserve_a: u64,
        reserve_b: u64,
        total_lp: u64
    ): u64 {
        let lp_from_a = mul_div(amount_a, total_lp, reserve_a);
        let lp_from_b = mul_div(amount_b, total_lp, reserve_b);

        min(lp_from_a, lp_from_b)
    }

    /// Calculate token amounts to return when removing liquidity
    public fun calculate_withdraw_amounts(
        lp_amount: u64,
        reserve_a: u64,
        reserve_b: u64,
        total_lp: u64
    ): (u64, u64) {
        let amount_a = mul_div(lp_amount, reserve_a, total_lp);
        let amount_b = mul_div(lp_amount, reserve_b, total_lp);

        (amount_a, amount_b)
    }

    /// Calculate optimal amount of token B given amount of token A
    public fun quote(
        amount_a: u64,
        reserve_a: u64,
        reserve_b: u64
    ): u64 {
        assert!(amount_a > 0, EZeroAmount);
        assert!(reserve_a > 0 && reserve_b > 0, EInsufficientLiquidity);

        mul_div(amount_a, reserve_b, reserve_a)
    }

    /// Calculate price impact of a swap (returns basis points)
    public fun calculate_price_impact(
        amount_in: u64,
        amount_out: u64,
        reserve_in: u64,
        reserve_out: u64
    ): u64 {
        let spot_price_num = (reserve_out as u128) * (amount_in as u128);
        let exec_price_num = (amount_out as u128) * (reserve_in as u128);

        if (exec_price_num >= spot_price_num) {
            return 0
        };

        let impact = ((spot_price_num - exec_price_num) * 10000) / spot_price_num;
        (impact as u64)
    }

    // ===== Math Utilities =====

    /// Integer square root using Babylonian method
    public fun sqrt_u128(x: u128): u128 {
        if (x == 0) return 0;

        let mut z = x;
        let mut y = (x + 1) / 2;

        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        };

        z
    }

    /// Safe multiply then divide: (a * b) / c
    public fun mul_div(a: u64, b: u64, c: u64): u64 {
        assert!(c > 0, EZeroAmount);
        let result = ((a as u128) * (b as u128)) / (c as u128);
        (result as u64)
    }

    /// Safe multiply then divide with rounding up
    public fun mul_div_up(a: u64, b: u64, c: u64): u64 {
        assert!(c > 0, EZeroAmount);
        let numerator = (a as u128) * (b as u128);
        let result = (numerator + (c as u128) - 1) / (c as u128);
        (result as u64)
    }

    /// Return the minimum of two u64 values
    public fun min(a: u64, b: u64): u64 {
        if (a < b) { a } else { b }
    }

    /// Return the maximum of two u64 values
    public fun max(a: u64, b: u64): u64 {
        if (a > b) { a } else { b }
    }

    /// Calculate absolute difference between two values
    public fun abs_diff(a: u64, b: u64): u64 {
        if (a > b) { a - b } else { b - a }
    }

    // ===== Tests =====

    #[test]
    fun test_get_amount_out() {
        let out = get_amount_out(1000, 10000, 10000, 30);
        assert!(out == 906, 0);
    }

    #[test]
    fun test_sqrt() {
        assert!(sqrt_u128(0) == 0, 0);
        assert!(sqrt_u128(1) == 1, 1);
        assert!(sqrt_u128(4) == 2, 2);
        assert!(sqrt_u128(100) == 10, 5);
    }
}
