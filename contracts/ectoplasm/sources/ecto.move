/// ECTO Token - The native token of Ectoplasm DEX
/// Used for governance, fee sharing, and launchpad features
module ectoplasm::ecto {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::url;

    // ===== One-Time Witness =====
    /// OTW for creating the ECTO coin type
    public struct ECTO has drop {}

    // ===== Constants =====
    /// Total supply: 1 billion ECTO (with 9 decimals)
    const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;

    /// Decimals
    const DECIMALS: u8 = 9;

    // ===== Initialization =====

    /// Initialize the ECTO token
    /// Creates the coin type and mints initial supply to deployer
    fun init(witness: ECTO, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            DECIMALS,
            b"ECTO",
            b"Ectoplasm",
            b"The native token of Ectoplasm DEX - powering decentralized trading on SUI",
            option::some(url::new_unsafe_from_bytes(b"https://ectoplasm.xyz/ecto-logo.png")),
            ctx
        );

        // Freeze metadata so it can't be changed
        transfer::public_freeze_object(metadata);

        // Transfer treasury cap to deployer for initial distribution
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // ===== Public Functions =====

    /// Mint new ECTO tokens (requires TreasuryCap)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<ECTO>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Burn ECTO tokens
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<ECTO>,
        coin: Coin<ECTO>
    ) {
        coin::burn(treasury_cap, coin);
    }

    /// Mint all tokens to treasury (one-time initial distribution)
    public entry fun mint_initial_supply(
        treasury_cap: &mut TreasuryCap<ECTO>,
        treasury: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, TOTAL_SUPPLY, ctx);
        transfer::public_transfer(coin, treasury);
    }

    // ===== Faucet (Testnet Only) =====

    /// Faucet for testing - mints 10,000 ECTO to caller
    /// In production, this should be removed or access-controlled
    public entry fun faucet(
        treasury_cap: &mut TreasuryCap<ECTO>,
        ctx: &mut TxContext
    ) {
        let amount = 10_000_000_000_000; // 10,000 ECTO
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    // ===== View Functions =====

    /// Get total supply minted so far
    public fun total_supply(treasury_cap: &TreasuryCap<ECTO>): u64 {
        coin::total_supply(treasury_cap)
    }

    /// Get max supply constant
    public fun max_supply(): u64 {
        TOTAL_SUPPLY
    }

    /// Get decimals
    public fun decimals(): u8 {
        DECIMALS
    }

    // ===== Test Helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ECTO {}, ctx);
    }

    use std::option;
}
