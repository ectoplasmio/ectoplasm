/// ECTO Token - The native token of Ectoplasm DEX
/// Used for governance, fee sharing, and launchpad features
module ectoplasm::ecto {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::url;
    use sui::object::{Self, UID};
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};

    // ===== One-Time Witness =====
    /// OTW for creating the ECTO coin type
    public struct ECTO has drop {}

    // ===== Shared Faucet =====
    /// Shared faucet object that anyone can use to get testnet tokens
    public struct Faucet has key {
        id: UID,
        /// Treasury cap for minting
        treasury_cap: TreasuryCap<ECTO>,
        /// Amount to dispense per request (default: 1000 ECTO)
        amount_per_request: u64,
        /// Cooldown in milliseconds (default: 5 minutes)
        cooldown_ms: u64,
        /// Last request time per address
        last_request: Table<address, u64>,
        /// Whether faucet is enabled
        enabled: bool,
    }

    // ===== Constants =====
    /// Total supply: 1 billion ECTO (with 9 decimals)
    const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;

    /// Decimals
    const DECIMALS: u8 = 9;

    /// Default faucet amount: 1000 ECTO
    const DEFAULT_FAUCET_AMOUNT: u64 = 1_000_000_000_000; // 1000 * 10^9

    /// Default cooldown: 5 minutes in milliseconds
    const DEFAULT_COOLDOWN_MS: u64 = 300_000;

    // ===== Errors =====
    const E_FAUCET_DISABLED: u64 = 1;
    const E_COOLDOWN_NOT_ELAPSED: u64 = 2;

    // ===== Initialization =====

    /// Initialize the ECTO token
    /// Creates the coin type and a shared faucet
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

        // Create shared faucet with treasury cap
        let faucet = Faucet {
            id: object::new(ctx),
            treasury_cap,
            amount_per_request: DEFAULT_FAUCET_AMOUNT,
            cooldown_ms: DEFAULT_COOLDOWN_MS,
            last_request: table::new(ctx),
            enabled: true,
        };

        // Share the faucet so anyone can use it
        transfer::share_object(faucet);
    }

    // ===== Public Faucet Functions =====

    /// Request tokens from the faucet (anyone can call this)
    /// Rate limited by cooldown per address
    public entry fun request_tokens(
        faucet: &mut Faucet,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(faucet.enabled, E_FAUCET_DISABLED);

        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // Check cooldown
        if (table::contains(&faucet.last_request, sender)) {
            let last_time = *table::borrow(&faucet.last_request, sender);
            assert!(current_time >= last_time + faucet.cooldown_ms, E_COOLDOWN_NOT_ELAPSED);
            // Update last request time
            *table::borrow_mut(&mut faucet.last_request, sender) = current_time;
        } else {
            // First request from this address
            table::add(&mut faucet.last_request, sender, current_time);
        };

        // Mint and transfer tokens
        let coin = coin::mint(&mut faucet.treasury_cap, faucet.amount_per_request, ctx);
        transfer::public_transfer(coin, sender);
    }

    /// Check if an address can request tokens (cooldown elapsed)
    public fun can_request(faucet: &Faucet, addr: address, clock: &Clock): bool {
        if (!faucet.enabled) {
            return false
        };

        if (!table::contains(&faucet.last_request, addr)) {
            return true
        };

        let last_time = *table::borrow(&faucet.last_request, addr);
        let current_time = clock::timestamp_ms(clock);
        current_time >= last_time + faucet.cooldown_ms
    }

    /// Get time remaining until next request is allowed (in ms)
    public fun cooldown_remaining(faucet: &Faucet, addr: address, clock: &Clock): u64 {
        if (!table::contains(&faucet.last_request, addr)) {
            return 0
        };

        let last_time = *table::borrow(&faucet.last_request, addr);
        let current_time = clock::timestamp_ms(clock);
        let next_allowed = last_time + faucet.cooldown_ms;

        if (current_time >= next_allowed) {
            0
        } else {
            next_allowed - current_time
        }
    }

    // ===== Admin Functions =====
    // Note: These require package upgrade capability in production

    /// Mint new ECTO tokens (only faucet can mint now)
    public entry fun mint_from_faucet(
        faucet: &mut Faucet,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut faucet.treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Burn ECTO tokens
    public entry fun burn(
        faucet: &mut Faucet,
        coin: Coin<ECTO>
    ) {
        coin::burn(&mut faucet.treasury_cap, coin);
    }

    // ===== View Functions =====

    /// Get total supply minted so far
    public fun total_supply(faucet: &Faucet): u64 {
        coin::total_supply(&faucet.treasury_cap)
    }

    /// Get max supply constant
    public fun max_supply(): u64 {
        TOTAL_SUPPLY
    }

    /// Get decimals
    public fun decimals(): u8 {
        DECIMALS
    }

    /// Get faucet amount per request
    public fun faucet_amount(faucet: &Faucet): u64 {
        faucet.amount_per_request
    }

    /// Get faucet cooldown in ms
    public fun faucet_cooldown(faucet: &Faucet): u64 {
        faucet.cooldown_ms
    }

    /// Check if faucet is enabled
    public fun faucet_enabled(faucet: &Faucet): bool {
        faucet.enabled
    }

    // ===== Test Helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ECTO {}, ctx);
    }

    use std::option;
}
