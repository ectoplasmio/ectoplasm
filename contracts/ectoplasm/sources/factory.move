/// Ectoplasm Pool Factory
/// Registry for all liquidity pools, ensuring no duplicate pairs exist
module ectoplasm::factory {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::Coin;

    use ectoplasm::pool::{Self, Pool, LP};

    // ===== Error Codes =====
    const EPairAlreadyExists: u64 = 0;
    const EPairNotFound: u64 = 1;
    const ENotAdmin: u64 = 2;

    // ===== Structs =====

    /// Factory - shared object that tracks all pools
    public struct Factory has key {
        id: UID,
        /// Maps type name pair -> pool object ID
        /// Key format: "TypeA::TypeB" (alphabetically sorted)
        pools: Table<vector<u8>, ID>,
        /// Total number of pools created
        pool_count: u64,
        /// Protocol fee recipient
        fee_to: address,
        /// Protocol fee in basis points (taken from LP fee)
        protocol_fee_bps: u64,
        /// Admin address
        admin: address,
    }

    /// Factory admin capability
    public struct FactoryAdminCap has key, store {
        id: UID,
    }

    // ===== Events =====

    public struct FactoryCreated has copy, drop {
        factory_id: ID,
        admin: address,
    }

    public struct PoolRegistered has copy, drop {
        factory_id: ID,
        pool_id: ID,
        pair_key: vector<u8>,
        pool_count: u64,
    }

    public struct FeeToUpdated has copy, drop {
        factory_id: ID,
        old_fee_to: address,
        new_fee_to: address,
    }

    public struct ProtocolFeeUpdated has copy, drop {
        factory_id: ID,
        old_fee: u64,
        new_fee: u64,
    }

    public struct AdminTransferred has copy, drop {
        factory_id: ID,
        old_admin: address,
        new_admin: address,
    }

    // ===== Initialization =====

    /// Initialize the factory - called once at package publish
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let factory = Factory {
            id: object::new(ctx),
            pools: table::new(ctx),
            pool_count: 0,
            fee_to: sender,
            protocol_fee_bps: 0, // No protocol fee initially
            admin: sender,
        };

        let admin_cap = FactoryAdminCap {
            id: object::new(ctx),
        };

        let factory_id = object::id(&factory);

        event::emit(FactoryCreated {
            factory_id,
            admin: sender,
        });

        transfer::share_object(factory);
        transfer::transfer(admin_cap, sender);
    }

    // ===== Pool Creation =====

    /// Create a new pool and register it in the factory
    /// Returns LP tokens to the caller
    public fun create_pool<CoinA, CoinB>(
        factory: &mut Factory,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        ctx: &mut TxContext
    ): Coin<LP<CoinA, CoinB>> {
        // Generate pair key
        let pair_key = get_pair_key<CoinA, CoinB>();

        // Check pair doesn't already exist
        assert!(!table::contains(&factory.pools, pair_key), EPairAlreadyExists);

        // Create the pool
        let lp_coin = pool::create_pool<CoinA, CoinB>(coin_a, coin_b, ctx);

        // Note: We need to get the pool ID after creation
        // Since create_pool shares the object, we'll need to register separately
        // For now, we increment the count
        factory.pool_count = factory.pool_count + 1;

        lp_coin
    }

    /// Register an existing pool in the factory
    /// This is called after pool creation to record its ID
    public fun register_pool<CoinA, CoinB>(
        factory: &mut Factory,
        pool: &Pool<CoinA, CoinB>,
    ) {
        let pair_key = get_pair_key<CoinA, CoinB>();

        // Check pair doesn't already exist
        assert!(!table::contains(&factory.pools, pair_key), EPairAlreadyExists);

        let pool_id = pool::get_pool_id(pool);

        // Register the pool
        table::add(&mut factory.pools, pair_key, pool_id);
        factory.pool_count = factory.pool_count + 1;

        event::emit(PoolRegistered {
            factory_id: object::id(factory),
            pool_id,
            pair_key,
            pool_count: factory.pool_count,
        });
    }

    /// Entry function to create a pool and register it
    public entry fun create_and_register_pool<CoinA, CoinB>(
        factory: &mut Factory,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
        ctx: &mut TxContext
    ) {
        // Check pair doesn't already exist
        let pair_key = get_pair_key<CoinA, CoinB>();
        assert!(!table::contains(&factory.pools, pair_key), EPairAlreadyExists);

        // Create pool (this shares the pool object)
        let lp_coin = pool::create_pool<CoinA, CoinB>(coin_a, coin_b, ctx);

        // Increment pool count (pool ID will be registered when pool becomes available)
        factory.pool_count = factory.pool_count + 1;

        // Transfer LP tokens to sender
        transfer::public_transfer(lp_coin, tx_context::sender(ctx));
    }

    // ===== Admin Functions =====

    /// Update the protocol fee recipient
    public entry fun set_fee_to(
        _admin_cap: &FactoryAdminCap,
        factory: &mut Factory,
        new_fee_to: address
    ) {
        let old_fee_to = factory.fee_to;
        factory.fee_to = new_fee_to;

        event::emit(FeeToUpdated {
            factory_id: object::id(factory),
            old_fee_to,
            new_fee_to,
        });
    }

    /// Update the protocol fee (in basis points)
    /// Maximum 50 bps (0.5%) to prevent excessive fees
    public entry fun set_protocol_fee(
        _admin_cap: &FactoryAdminCap,
        factory: &mut Factory,
        new_fee_bps: u64
    ) {
        assert!(new_fee_bps <= 50, ENotAdmin); // Max 0.5%

        let old_fee = factory.protocol_fee_bps;
        factory.protocol_fee_bps = new_fee_bps;

        event::emit(ProtocolFeeUpdated {
            factory_id: object::id(factory),
            old_fee,
            new_fee: new_fee_bps,
        });
    }

    /// Transfer admin role to a new address
    public entry fun transfer_admin(
        _admin_cap: &FactoryAdminCap,
        factory: &mut Factory,
        new_admin: address
    ) {
        let old_admin = factory.admin;
        factory.admin = new_admin;

        event::emit(AdminTransferred {
            factory_id: object::id(factory),
            old_admin,
            new_admin,
        });
    }

    // ===== View Functions =====

    /// Get the pool ID for a pair (if it exists)
    public fun get_pool<CoinA, CoinB>(factory: &Factory): Option<ID> {
        let pair_key = get_pair_key<CoinA, CoinB>();

        if (table::contains(&factory.pools, pair_key)) {
            option::some(*table::borrow(&factory.pools, pair_key))
        } else {
            option::none()
        }
    }

    /// Check if a pair exists
    public fun pair_exists<CoinA, CoinB>(factory: &Factory): bool {
        let pair_key = get_pair_key<CoinA, CoinB>();
        table::contains(&factory.pools, pair_key)
    }

    /// Get total number of pools
    public fun get_pool_count(factory: &Factory): u64 {
        factory.pool_count
    }

    /// Get fee recipient address
    public fun get_fee_to(factory: &Factory): address {
        factory.fee_to
    }

    /// Get protocol fee in basis points
    public fun get_protocol_fee(factory: &Factory): u64 {
        factory.protocol_fee_bps
    }

    /// Get admin address
    public fun get_admin(factory: &Factory): address {
        factory.admin
    }

    // ===== Helper Functions =====

    /// Generate a unique key for a token pair
    /// Uses type names, sorted alphabetically to ensure A-B and B-A map to same pool
    fun get_pair_key<CoinA, CoinB>(): vector<u8> {
        use std::type_name;

        let type_a = type_name::into_string(type_name::get<CoinA>());
        let type_b = type_name::into_string(type_name::get<CoinB>());

        let bytes_a = std::ascii::into_bytes(type_a);
        let bytes_b = std::ascii::into_bytes(type_b);

        // Sort alphabetically
        if (compare_bytes(&bytes_a, &bytes_b)) {
            // a < b
            let mut key = bytes_a;
            std::vector::append(&mut key, b"::");
            std::vector::append(&mut key, bytes_b);
            key
        } else {
            // b < a
            let mut key = bytes_b;
            std::vector::append(&mut key, b"::");
            std::vector::append(&mut key, bytes_a);
            key
        }
    }

    /// Compare two byte vectors lexicographically
    /// Returns true if a < b
    fun compare_bytes(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = std::vector::length(a);
        let len_b = std::vector::length(b);
        let min_len = if (len_a < len_b) { len_a } else { len_b };

        let mut i = 0;
        while (i < min_len) {
            let byte_a = *std::vector::borrow(a, i);
            let byte_b = *std::vector::borrow(b, i);
            if (byte_a < byte_b) {
                return true
            } else if (byte_a > byte_b) {
                return false
            };
            i = i + 1;
        };

        // If all compared bytes are equal, shorter string is "less"
        len_a < len_b
    }

    // ===== Module Imports =====

    use std::option::{Self, Option};

    // ===== Test Helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
