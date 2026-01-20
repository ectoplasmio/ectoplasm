// SPDX-License-Identifier: MIT
/// Launchpad module for Ectoplasm DEX
///
/// Enables fair token launches using bonding curves.
/// Features:
/// - Linear bonding curve pricing (price increases as supply increases)
/// - Buy/sell tokens along the curve
/// - Graduate to AMM pool when market cap threshold is reached
/// - Creator fee on trades
/// - Protocol fee support
module ectoplasm_features::launchpad {
    use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::url::{Self, Url};
    use std::string::{Self, String};
    use std::ascii;
    use ectoplasm::usdc::USDC;

    // ============ Error Codes ============
    const EZeroAmount: u64 = 0;
    const EInsufficientPayment: u64 = 1;
    const EInsufficientTokens: u64 = 2;
    const ECurveGraduated: u64 = 3;
    const ECurveNotGraduated: u64 = 4;
    const ENotCreator: u64 = 5;
    const EInvalidParams: u64 = 6;
    const ESlippageExceeded: u64 = 7;
    const ECurvePaused: u64 = 8;

    // ============ Constants ============
    /// Precision for price calculations (1e9)
    const PRICE_PRECISION: u64 = 1_000_000_000;

    /// Default graduation threshold (in USDC, 6 decimals)
    /// $50,000 = 50_000_000_000
    const DEFAULT_GRADUATION_THRESHOLD: u64 = 50_000_000_000;

    /// Default initial price (0.0001 USDC per token)
    const DEFAULT_INITIAL_PRICE: u64 = 100; // 0.0001 * 1e6

    /// Default price increment per token sold (linear curve slope)
    const DEFAULT_PRICE_INCREMENT: u64 = 1; // Very small increment

    /// Maximum total supply for launched tokens (1 billion with 9 decimals)
    const MAX_TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;

    /// Creator fee in basis points (2% default)
    const DEFAULT_CREATOR_FEE_BPS: u64 = 200;

    /// Protocol fee in basis points (1% default)
    const DEFAULT_PROTOCOL_FEE_BPS: u64 = 100;

    /// Max fee in basis points (10%)
    const MAX_FEE_BPS: u64 = 1000;

    // ============ Structs ============

    // Note: Each launched token needs its own module with a one-time witness.
    // This launchpad manages bonding curves for any token type T.

    /// Admin capability for protocol settings
    public struct LaunchpadAdminCap has key, store {
        id: UID,
    }

    /// Global launchpad configuration
    public struct LaunchpadConfig has key {
        id: UID,
        /// Protocol fee recipient
        fee_recipient: address,
        /// Protocol fee in basis points
        protocol_fee_bps: u64,
        /// Default graduation threshold
        default_graduation_threshold: u64,
        /// Whether new launches are paused
        launches_paused: bool,
        /// Total launches created
        total_launches: u64,
        /// Total volume traded (in USDC)
        total_volume: u64,
        /// Collected protocol fees
        collected_fees: Balance<USDC>,
    }

    /// Bonding curve for a launched token
    /// Uses a linear curve: price = initial_price + (tokens_sold * price_increment)
    public struct BondingCurve<phantom T> has key {
        id: UID,
        /// Token name
        name: String,
        /// Token symbol
        symbol: String,
        /// Token description
        description: String,
        /// Token image URL
        image_url: Option<Url>,
        /// Creator address
        creator: address,
        /// Treasury cap for minting tokens
        treasury_cap: TreasuryCap<T>,
        /// USDC reserves collected from buys
        usdc_reserve: Balance<USDC>,
        /// Total tokens sold (circulating supply)
        tokens_sold: u64,
        /// Initial price per token (in USDC base units)
        initial_price: u64,
        /// Price increment per token sold
        price_increment: u64,
        /// Market cap threshold to graduate to AMM (in USDC)
        graduation_threshold: u64,
        /// Whether curve has graduated to AMM
        graduated: bool,
        /// Creator fee in basis points
        creator_fee_bps: u64,
        /// Accumulated creator fees
        creator_fees: Balance<USDC>,
        /// Creation timestamp
        created_at: u64,
        /// Whether trading is paused
        paused: bool,
        /// Total volume traded
        volume: u64,
    }

    // ============ Events ============

    public struct TokenLaunched has copy, drop {
        curve_id: address,
        name: vector<u8>,
        symbol: vector<u8>,
        creator: address,
        initial_price: u64,
        graduation_threshold: u64,
    }

    public struct TokenBought has copy, drop {
        curve_id: address,
        buyer: address,
        usdc_amount: u64,
        tokens_received: u64,
        new_price: u64,
        new_market_cap: u64,
    }

    public struct TokenSold has copy, drop {
        curve_id: address,
        seller: address,
        tokens_amount: u64,
        usdc_received: u64,
        new_price: u64,
        new_market_cap: u64,
    }

    public struct CurveGraduated has copy, drop {
        curve_id: address,
        final_market_cap: u64,
        total_usdc_reserve: u64,
        total_tokens_sold: u64,
    }

    public struct CreatorFeeClaimed has copy, drop {
        curve_id: address,
        creator: address,
        amount: u64,
    }

    // ============ Init ============

    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = LaunchpadAdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());

        // Create global config
        let config = LaunchpadConfig {
            id: object::new(ctx),
            fee_recipient: ctx.sender(),
            protocol_fee_bps: DEFAULT_PROTOCOL_FEE_BPS,
            default_graduation_threshold: DEFAULT_GRADUATION_THRESHOLD,
            launches_paused: false,
            total_launches: 0,
            total_volume: 0,
            collected_fees: balance::zero(),
        };
        transfer::share_object(config);
    }

    // ============ Token Launch Functions ============

    /// Create a new bonding curve for a token
    /// The creator provides the treasury cap from their token module
    public fun create_curve<T>(
        config: &mut LaunchpadConfig,
        treasury_cap: TreasuryCap<T>,
        name: vector<u8>,
        symbol: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        initial_price: u64,
        price_increment: u64,
        graduation_threshold: u64,
        creator_fee_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): BondingCurve<T> {
        assert!(!config.launches_paused, ECurvePaused);
        assert!(initial_price > 0, EInvalidParams);
        assert!(creator_fee_bps <= MAX_FEE_BPS, EInvalidParams);

        let graduation = if (graduation_threshold == 0) {
            config.default_graduation_threshold
        } else {
            graduation_threshold
        };

        let url_opt = if (vector::length(&image_url) > 0) {
            option::some(url::new_unsafe_from_bytes(image_url))
        } else {
            option::none()
        };

        config.total_launches = config.total_launches + 1;

        let curve = BondingCurve {
            id: object::new(ctx),
            name: string::utf8(name),
            symbol: string::utf8(symbol),
            description: string::utf8(description),
            image_url: url_opt,
            creator: ctx.sender(),
            treasury_cap,
            usdc_reserve: balance::zero(),
            tokens_sold: 0,
            initial_price,
            price_increment,
            graduation_threshold: graduation,
            graduated: false,
            creator_fee_bps,
            creator_fees: balance::zero(),
            created_at: clock::timestamp_ms(clock) / 1000,
            paused: false,
            volume: 0,
        };

        event::emit(TokenLaunched {
            curve_id: object::uid_to_address(&curve.id),
            name,
            symbol,
            creator: ctx.sender(),
            initial_price,
            graduation_threshold: graduation,
        });

        curve
    }

    /// Create curve entry function
    public entry fun create_curve_entry<T>(
        config: &mut LaunchpadConfig,
        treasury_cap: TreasuryCap<T>,
        name: vector<u8>,
        symbol: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        initial_price: u64,
        price_increment: u64,
        graduation_threshold: u64,
        creator_fee_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let curve = create_curve(
            config,
            treasury_cap,
            name,
            symbol,
            description,
            image_url,
            initial_price,
            price_increment,
            graduation_threshold,
            creator_fee_bps,
            clock,
            ctx,
        );
        transfer::share_object(curve);
    }

    // ============ Trading Functions ============

    /// Buy tokens from the bonding curve
    public fun buy<T>(
        config: &mut LaunchpadConfig,
        curve: &mut BondingCurve<T>,
        payment: Coin<USDC>,
        min_tokens_out: u64,
        ctx: &mut TxContext,
    ): Coin<T> {
        assert!(!curve.graduated, ECurveGraduated);
        assert!(!curve.paused, ECurvePaused);

        let payment_amount = coin::value(&payment);
        assert!(payment_amount > 0, EZeroAmount);

        // Calculate fees
        let protocol_fee = payment_amount * config.protocol_fee_bps / 10000;
        let creator_fee = payment_amount * curve.creator_fee_bps / 10000;
        let net_payment = payment_amount - protocol_fee - creator_fee;

        // Calculate tokens to mint based on bonding curve
        let tokens_to_mint = calculate_tokens_for_usdc(curve, net_payment);
        assert!(tokens_to_mint >= min_tokens_out, ESlippageExceeded);

        // Update state
        curve.tokens_sold = curve.tokens_sold + tokens_to_mint;
        curve.volume = curve.volume + payment_amount;
        config.total_volume = config.total_volume + payment_amount;

        // Split payment into reserves and fees
        let mut payment_balance = coin::into_balance(payment);

        // Protocol fee
        if (protocol_fee > 0) {
            let fee_balance = balance::split(&mut payment_balance, protocol_fee);
            balance::join(&mut config.collected_fees, fee_balance);
        };

        // Creator fee
        if (creator_fee > 0) {
            let creator_fee_balance = balance::split(&mut payment_balance, creator_fee);
            balance::join(&mut curve.creator_fees, creator_fee_balance);
        };

        // Rest goes to reserve
        balance::join(&mut curve.usdc_reserve, payment_balance);

        // Mint tokens
        let tokens = coin::mint(&mut curve.treasury_cap, tokens_to_mint, ctx);

        let new_price = get_current_price(curve);
        let new_market_cap = get_market_cap(curve);

        event::emit(TokenBought {
            curve_id: object::uid_to_address(&curve.id),
            buyer: ctx.sender(),
            usdc_amount: payment_amount,
            tokens_received: tokens_to_mint,
            new_price,
            new_market_cap,
        });

        // Check graduation
        if (new_market_cap >= curve.graduation_threshold) {
            curve.graduated = true;
            event::emit(CurveGraduated {
                curve_id: object::uid_to_address(&curve.id),
                final_market_cap: new_market_cap,
                total_usdc_reserve: balance::value(&curve.usdc_reserve),
                total_tokens_sold: curve.tokens_sold,
            });
        };

        tokens
    }

    /// Buy entry function
    public entry fun buy_entry<T>(
        config: &mut LaunchpadConfig,
        curve: &mut BondingCurve<T>,
        payment: Coin<USDC>,
        min_tokens_out: u64,
        ctx: &mut TxContext,
    ) {
        let tokens = buy(config, curve, payment, min_tokens_out, ctx);
        transfer::public_transfer(tokens, ctx.sender());
    }

    /// Sell tokens back to the bonding curve
    public fun sell<T>(
        config: &mut LaunchpadConfig,
        curve: &mut BondingCurve<T>,
        tokens: Coin<T>,
        min_usdc_out: u64,
        ctx: &mut TxContext,
    ): Coin<USDC> {
        assert!(!curve.graduated, ECurveGraduated);
        assert!(!curve.paused, ECurvePaused);

        let token_amount = coin::value(&tokens);
        assert!(token_amount > 0, EZeroAmount);
        assert!(token_amount <= curve.tokens_sold, EInsufficientTokens);

        // Calculate USDC to return based on bonding curve
        let gross_usdc = calculate_usdc_for_tokens(curve, token_amount);

        // Calculate fees
        let protocol_fee = gross_usdc * config.protocol_fee_bps / 10000;
        let creator_fee = gross_usdc * curve.creator_fee_bps / 10000;
        let net_usdc = gross_usdc - protocol_fee - creator_fee;

        assert!(net_usdc >= min_usdc_out, ESlippageExceeded);
        assert!(balance::value(&curve.usdc_reserve) >= gross_usdc, EInsufficientTokens);

        // Update state
        curve.tokens_sold = curve.tokens_sold - token_amount;
        curve.volume = curve.volume + gross_usdc;
        config.total_volume = config.total_volume + gross_usdc;

        // Burn tokens
        coin::burn(&mut curve.treasury_cap, tokens);

        // Split USDC from reserve
        let mut usdc_balance = balance::split(&mut curve.usdc_reserve, gross_usdc);

        // Protocol fee
        if (protocol_fee > 0) {
            let fee_balance = balance::split(&mut usdc_balance, protocol_fee);
            balance::join(&mut config.collected_fees, fee_balance);
        };

        // Creator fee
        if (creator_fee > 0) {
            let creator_fee_balance = balance::split(&mut usdc_balance, creator_fee);
            balance::join(&mut curve.creator_fees, creator_fee_balance);
        };

        let usdc_out = coin::from_balance(usdc_balance, ctx);

        let new_price = get_current_price(curve);
        let new_market_cap = get_market_cap(curve);

        event::emit(TokenSold {
            curve_id: object::uid_to_address(&curve.id),
            seller: ctx.sender(),
            tokens_amount: token_amount,
            usdc_received: net_usdc,
            new_price,
            new_market_cap,
        });

        usdc_out
    }

    /// Sell entry function
    public entry fun sell_entry<T>(
        config: &mut LaunchpadConfig,
        curve: &mut BondingCurve<T>,
        tokens: Coin<T>,
        min_usdc_out: u64,
        ctx: &mut TxContext,
    ) {
        let usdc = sell(config, curve, tokens, min_usdc_out, ctx);
        transfer::public_transfer(usdc, ctx.sender());
    }

    // ============ Creator Functions ============

    /// Claim accumulated creator fees
    public fun claim_creator_fees<T>(
        curve: &mut BondingCurve<T>,
        ctx: &mut TxContext,
    ): Coin<USDC> {
        assert!(ctx.sender() == curve.creator, ENotCreator);

        let amount = balance::value(&curve.creator_fees);
        assert!(amount > 0, EZeroAmount);

        let fees = coin::from_balance(
            balance::withdraw_all(&mut curve.creator_fees),
            ctx
        );

        event::emit(CreatorFeeClaimed {
            curve_id: object::uid_to_address(&curve.id),
            creator: curve.creator,
            amount,
        });

        fees
    }

    /// Claim creator fees entry
    public entry fun claim_creator_fees_entry<T>(
        curve: &mut BondingCurve<T>,
        ctx: &mut TxContext,
    ) {
        let fees = claim_creator_fees(curve, ctx);
        transfer::public_transfer(fees, ctx.sender());
    }

    /// Pause/unpause trading on a curve (creator only)
    public entry fun set_curve_paused<T>(
        curve: &mut BondingCurve<T>,
        paused: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == curve.creator, ENotCreator);
        curve.paused = paused;
    }

    // ============ Admin Functions ============

    /// Withdraw collected protocol fees
    public entry fun withdraw_protocol_fees(
        _admin: &LaunchpadAdminCap,
        config: &mut LaunchpadConfig,
        ctx: &mut TxContext,
    ) {
        let amount = balance::value(&config.collected_fees);
        if (amount > 0) {
            let fees = coin::from_balance(
                balance::withdraw_all(&mut config.collected_fees),
                ctx
            );
            transfer::public_transfer(fees, config.fee_recipient);
        }
    }

    /// Update protocol fee
    public entry fun set_protocol_fee(
        _admin: &LaunchpadAdminCap,
        config: &mut LaunchpadConfig,
        new_fee_bps: u64,
    ) {
        assert!(new_fee_bps <= MAX_FEE_BPS, EInvalidParams);
        config.protocol_fee_bps = new_fee_bps;
    }

    /// Update fee recipient
    public entry fun set_fee_recipient(
        _admin: &LaunchpadAdminCap,
        config: &mut LaunchpadConfig,
        new_recipient: address,
    ) {
        config.fee_recipient = new_recipient;
    }

    /// Pause/unpause new launches
    public entry fun set_launches_paused(
        _admin: &LaunchpadAdminCap,
        config: &mut LaunchpadConfig,
        paused: bool,
    ) {
        config.launches_paused = paused;
    }

    // ============ View Functions ============

    /// Get current token price
    public fun get_current_price<T>(curve: &BondingCurve<T>): u64 {
        curve.initial_price + (curve.tokens_sold / PRICE_PRECISION) * curve.price_increment
    }

    /// Get market cap (total value of tokens sold)
    public fun get_market_cap<T>(curve: &BondingCurve<T>): u64 {
        // Market cap = tokens_sold * current_price
        let price = get_current_price(curve);
        // Scale properly: tokens have 9 decimals, price has 6 decimals
        (((curve.tokens_sold as u128) * (price as u128)) / 1_000_000_000) as u64
    }

    /// Get curve info
    public fun get_curve_info<T>(curve: &BondingCurve<T>): (
        String,    // name
        String,    // symbol
        address,   // creator
        u64,       // tokens_sold
        u64,       // usdc_reserve
        u64,       // current_price
        u64,       // market_cap
        u64,       // graduation_threshold
        bool,      // graduated
        u64,       // volume
    ) {
        (
            curve.name,
            curve.symbol,
            curve.creator,
            curve.tokens_sold,
            balance::value(&curve.usdc_reserve),
            get_current_price(curve),
            get_market_cap(curve),
            curve.graduation_threshold,
            curve.graduated,
            curve.volume,
        )
    }

    /// Get config info
    public fun get_config_info(config: &LaunchpadConfig): (
        u64,   // protocol_fee_bps
        u64,   // total_launches
        u64,   // total_volume
        u64,   // collected_fees
        bool,  // launches_paused
    ) {
        (
            config.protocol_fee_bps,
            config.total_launches,
            config.total_volume,
            balance::value(&config.collected_fees),
            config.launches_paused,
        )
    }

    /// Calculate how many tokens you get for a given USDC amount
    public fun calculate_tokens_for_usdc<T>(curve: &BondingCurve<T>, usdc_amount: u64): u64 {
        // For a linear bonding curve: price = initial_price + tokens_sold * price_increment
        // Integral gives us: USDC = initial_price * tokens + (price_increment * tokens^2) / 2
        // Solving for tokens is complex, so we use approximation for simplicity

        // Simple approximation: tokens = usdc_amount / current_price
        let current_price = get_current_price(curve);
        if (current_price == 0) {
            return 0
        };

        // tokens = usdc_amount * 1e9 / price (accounting for decimals)
        // USDC has 6 decimals, tokens have 9 decimals
        (((usdc_amount as u128) * 1_000_000_000) / (current_price as u128)) as u64
    }

    /// Calculate how much USDC you get for selling tokens
    public fun calculate_usdc_for_tokens<T>(curve: &BondingCurve<T>, token_amount: u64): u64 {
        // Similar approximation: usdc = token_amount * current_price
        let current_price = get_current_price(curve);

        // usdc = token_amount * price / 1e9 (accounting for decimals)
        (((token_amount as u128) * (current_price as u128)) / 1_000_000_000) as u64
    }

    /// Get buy quote (tokens out for USDC in)
    public fun get_buy_quote<T>(
        config: &LaunchpadConfig,
        curve: &BondingCurve<T>,
        usdc_in: u64,
    ): (u64, u64, u64) {
        let protocol_fee = usdc_in * config.protocol_fee_bps / 10000;
        let creator_fee = usdc_in * curve.creator_fee_bps / 10000;
        let net_usdc = usdc_in - protocol_fee - creator_fee;
        let tokens_out = calculate_tokens_for_usdc(curve, net_usdc);

        (tokens_out, protocol_fee, creator_fee)
    }

    /// Get sell quote (USDC out for tokens in)
    public fun get_sell_quote<T>(
        config: &LaunchpadConfig,
        curve: &BondingCurve<T>,
        tokens_in: u64,
    ): (u64, u64, u64) {
        let gross_usdc = calculate_usdc_for_tokens(curve, tokens_in);
        let protocol_fee = gross_usdc * config.protocol_fee_bps / 10000;
        let creator_fee = gross_usdc * curve.creator_fee_bps / 10000;
        let net_usdc = gross_usdc - protocol_fee - creator_fee;

        (net_usdc, protocol_fee, creator_fee)
    }

    // ============ Test Functions ============
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
