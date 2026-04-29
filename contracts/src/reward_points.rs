use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Symbol, Vec};

const KEY_BALANCES: Symbol = Symbol::new("balances");
const KEY_EXPIRY: Symbol = Symbol::new("expiry");
const KEY_HISTORY: Symbol = Symbol::new("history");
const DEFAULT_EXPIRY_DAYS: u64 = 365;

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsBalance {
    pub user: Address,
    pub balance: i128,
    pub lifetime_earned: i128,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsExpiry {
    pub amount: i128,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsRecord {
    pub action: Symbol,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsEarnedEvent {
    pub user: Address,
    pub amount: i128,
    pub reason: Symbol,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PointsExpiredEvent {
    pub user: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contract]
pub struct RewardPoints;

#[contractimpl]
impl RewardPoints {
    pub fn initialize(env: Env) {
        env.storage().instance().set(&KEY_BALANCES, &Map::<Address, PointsBalance>::new(&env));
        env.storage().instance().set(&KEY_EXPIRY, &Map::<Address, Vec<PointsExpiry>>::new(&env));
        env.storage().instance().set(&KEY_HISTORY, &Map::<Address, Vec<PointsRecord>>::new(&env));
    }

    /// Earn points for a user
    pub fn earn_points(env: Env, user: Address, amount: i128, reason: Symbol, expiry_days: Option<u64>) {
        let mut balances: Map<Address, PointsBalance> = env.storage().instance().get(&KEY_BALANCES).unwrap();
        let mut b = balances.get(user.clone()).unwrap_or(PointsBalance { user: user.clone(), balance: 0, lifetime_earned: 0, last_updated: 0 });
        b.balance += amount;
        b.lifetime_earned += amount;
        b.last_updated = env.ledger().timestamp();
        balances.set(user.clone(), b);
        env.storage().instance().set(&KEY_BALANCES, &balances);

        let days = expiry_days.unwrap_or(DEFAULT_EXPIRY_DAYS);
        let mut expiry: Map<Address, Vec<PointsExpiry>> = env.storage().instance().get(&KEY_EXPIRY).unwrap();
        let mut exp = expiry.get(user.clone()).unwrap_or(Vec::new(&env));
        exp.push_back(PointsExpiry { amount, expires_at: env.ledger().timestamp() + days * 86400 });
        expiry.set(user.clone(), exp);
        env.storage().instance().set(&KEY_EXPIRY, &expiry);

        let mut history: Map<Address, Vec<PointsRecord>> = env.storage().instance().get(&KEY_HISTORY).unwrap();
        let mut h = history.get(user.clone()).unwrap_or(Vec::new(&env));
        h.push_back(PointsRecord { action: Symbol::new(&env, "earn"), amount, timestamp: env.ledger().timestamp() });
        history.set(user.clone(), h);
        env.storage().instance().set(&KEY_HISTORY, &history);

        env.events().publish((Symbol::new(&env, "points_earned"),), PointsEarnedEvent { user, amount, reason, timestamp: env.ledger().timestamp() });
    }

    /// Process expired points for a user
    pub fn process_expiry(env: Env, user: Address) -> i128 {
        let now = env.ledger().timestamp();
        let mut balances: Map<Address, PointsBalance> = env.storage().instance().get(&KEY_BALANCES).unwrap();
        let mut b = balances.get(user.clone()).unwrap_or(PointsBalance { user: user.clone(), balance: 0, lifetime_earned: 0, last_updated: 0 });

        let mut expiry: Map<Address, Vec<PointsExpiry>> = env.storage().instance().get(&KEY_EXPIRY).unwrap();
        let exp = expiry.get(user.clone()).unwrap_or(Vec::new(&env));
        let mut remaining = Vec::new(&env);
        let mut expired_total = 0i128;

        for e in exp.iter() {
            if e.expires_at <= now { expired_total += e.amount; }
            else { remaining.push_back(e); }
        }

        if expired_total > 0 {
            b.balance -= expired_total;
            if b.balance < 0 { b.balance = 0; }
            balances.set(user.clone(), b);
            env.storage().instance().set(&KEY_BALANCES, &balances);
            expiry.set(user.clone(), remaining);
            env.storage().instance().set(&KEY_EXPIRY, &expiry);

            env.events().publish((Symbol::new(&env, "points_expired"),), PointsExpiredEvent { user, amount: expired_total, timestamp: now });
        }
        expired_total
    }

    /// Spend points (deduct from balance)
    pub fn spend_points(env: Env, user: Address, amount: i128) -> bool {
        let mut balances: Map<Address, PointsBalance> = env.storage().instance().get(&KEY_BALANCES).unwrap();
        let mut b = balances.get(user.clone()).unwrap_or(PointsBalance { user: user.clone(), balance: 0, lifetime_earned: 0, last_updated: 0 });
        if b.balance < amount { return false; }
        b.balance -= amount;
        balances.set(user.clone(), b);
        env.storage().instance().set(&KEY_BALANCES, &balances);
        true
    }

    pub fn get_balance(env: Env, user: Address) -> PointsBalance {
        let balances: Map<Address, PointsBalance> = env.storage().instance().get(&KEY_BALANCES).unwrap();
        balances.get(user).unwrap_or(PointsBalance { user, balance: 0, lifetime_earned: 0, last_updated: 0 })
    }

    pub fn get_expiring_soon(env: Env, user: Address, within_days: u64) -> i128 {
        let now = env.ledger().timestamp();
        let expiry: Map<Address, Vec<PointsExpiry>> = env.storage().instance().get(&KEY_EXPIRY).unwrap();
        let exp = expiry.get(user).unwrap_or(Vec::new(&env));
        let threshold = now + within_days * 86400;
        let mut total = 0i128;
        for e in exp.iter() { if e.expires_at <= threshold && e.expires_at > now { total += e.amount; } }
        total
    }
}
