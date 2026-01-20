/// Mock USDC Token for Testing
/// This is a testnet-only token that mimics USDC behavior
/// In production, use the official USDC on SUI
module ectoplasm::usdc {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::url;

    // ===== One-Time Witness =====
    public struct USDC has drop {}

    // ===== Constants =====
    /// USDC uses 6 decimals (standard)
    const DECIMALS: u8 = 6;

    // ===== Initialization =====

    fun init(witness: USDC, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            DECIMALS,
            b"USDC",
            b"USD Coin (Test)",
            b"Mock USDC for Ectoplasm testnet - NOT REAL VALUE",
            option::some(url::new_unsafe_from_bytes(b"https://ectoplasm.xyz/usdc-logo.png")),
            ctx
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // ===== Public Functions =====

    /// Mint USDC (requires TreasuryCap)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<USDC>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Burn USDC
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<USDC>,
        coin: Coin<USDC>
    ) {
        coin::burn(treasury_cap, coin);
    }

    /// Faucet for testing - mints 10,000 USDC to caller
    public entry fun faucet(
        treasury_cap: &mut TreasuryCap<USDC>,
        ctx: &mut TxContext
    ) {
        let amount = 10_000_000_000; // 10,000 USDC (6 decimals)
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    /// Get decimals
    public fun decimals(): u8 {
        DECIMALS
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(USDC {}, ctx);
    }

    use std::option;
}
