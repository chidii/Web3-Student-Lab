use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, Symbol, Vec};

const KEY_RATE: Symbol = Symbol::new("rate");
const KEY_LIMITS: Symbol = Symbol::new("limits");
const KEY_HISTORY: Symbol = Symbol::new("conv_hist");

#[contracttype]
#[derive(Clone, Debug)]
pub struct ConversionRate {
    pub points_per_token: i128,
    pub min_conversion: i128,
    pub max_per_user: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ConversionRecord {
    pub user: Address,
    pub points: i128,
    pub tokens: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsConvertedEvent {
    pub user: Address,
    pub points_burned: i128,
    pub tokens_minted: i128,
    pub timestamp: u64,
}

#[contract]
pub struct PointsConversion;

#[contractimpl]
impl PointsConversion {
    pub fn initialize(env: Env, points_per_token: i128, min_conversion: i128, max_per_user: i128) {
        env.storage().instance().set(&KEY_RATE, &ConversionRate { points_per_token, min_conversion, max_per_user });
        env.storage().instance().set(&KEY_LIMITS, &Map::<Address, i128>::new(&env));
        env.storage().instance().set(&KEY_HISTORY, &Vec::<ConversionRecord>::new(&env));
    }

    /// Convert points to tokens
    pub fn convert_points(env: Env, user: Address, points: i128, token: Address) -> i128 {
        user.require_auth();
        let rate: ConversionRate = env.storage().instance().get(&KEY_RATE).unwrap();
        if points < rate.min_conversion { panic!("Below minimum conversion"); }

        let mut limits: Map<Address, i128> = env.storage().instance().get(&KEY_LIMITS).unwrap();
        let converted = limits.get(user.clone()).unwrap_or(0);
        if converted + points > rate.max_per_user { panic!("Exceeds max conversion limit"); }

        let tokens = points / rate.points_per_token;
        if tokens == 0 { panic!("Points too low for conversion"); }

        limits.set(user.clone(), converted + points);
        env.storage().instance().set(&KEY_LIMITS, &limits);

        let mut history: Vec<ConversionRecord> = env.storage().instance().get(&KEY_HISTORY).unwrap();
        history.push_back(ConversionRecord { user: user.clone(), points, tokens, timestamp: env.ledger().timestamp() });
        env.storage().instance().set(&KEY_HISTORY, &history);

        // Mint tokens to user
        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &user, &tokens);

        env.events().publish((Symbol::new(&env, "points_converted"),), PointsConvertedEvent { user, points_burned: points, tokens_minted: tokens, timestamp: env.ledger().timestamp() });
        tokens
    }

    /// Update conversion rate
    pub fn update_rate(env: Env, points_per_token: i128, min_conversion: i128, max_per_user: i128) {
        let old: ConversionRate = env.storage().instance().get(&KEY_RATE).unwrap();
        env.storage().instance().set(&KEY_RATE, &ConversionRate { points_per_token, min_conversion, max_per_user });
    }

    pub fn get_rate(env: Env) -> ConversionRate { env.storage().instance().get(&KEY_RATE).unwrap() }
    pub fn get_user_converted(env: Env, user: Address) -> i128 {
        let limits: Map<Address, i128> = env.storage().instance().get(&KEY_LIMITS).unwrap();
        limits.get(user).unwrap_or(0)
    }
}
