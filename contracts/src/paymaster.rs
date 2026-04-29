use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, Symbol};

const KEY_SPONSORSHIP_LIMITS: Symbol = Symbol::new("limits");
const KEY_TOTAL_SPONSORED: Symbol = Symbol::new("total");

#[contracttype]
#[derive(Clone, Debug)]
pub struct SponsorshipLimit {
    pub wallet: Address,
    pub max_per_tx: i128,
    pub max_total: i128,
    pub sponsored_so_far: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct GasSponsoredEvent {
    pub wallet: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contract]
pub struct Paymaster;

#[contractimpl]
impl Paymaster {
    pub fn initialize(env: Env) {
        env.storage().instance().set(&KEY_SPONSORSHIP_LIMITS, &Map::<Address, SponsorshipLimit>::new(&env));
        env.storage().instance().set(&KEY_TOTAL_SPONSORED, &0i128);
    }

    /// Set sponsorship limits for a wallet
    pub fn set_sponsorship_limit(env: Env, wallet: Address, max_per_tx: i128, max_total: i128) {
        let mut limits: Map<Address, SponsorshipLimit> = env.storage().instance().get(&KEY_SPONSORSHIP_LIMITS).unwrap();
        limits.set(wallet.clone(), SponsorshipLimit { wallet: wallet.clone(), max_per_tx, max_total, sponsored_so_far: 0 });
        env.storage().instance().set(&KEY_SPONSORSHIP_LIMITS, &limits);
    }

    /// Sponsor gas for a transaction
    pub fn sponsor_gas(env: Env, wallet: Address, amount: i128) -> bool {
        let mut limits: Map<Address, SponsorshipLimit> = env.storage().instance().get(&KEY_SPONSORSHIP_LIMITS).unwrap();
        let mut limit = limits.get(wallet.clone()).unwrap_or(SponsorshipLimit { wallet: wallet.clone(), max_per_tx: 0, max_total: 0, sponsored_so_far: 0 });

        if amount > limit.max_per_tx || limit.sponsored_so_far + amount > limit.max_total {
            return false;
        }

        limit.sponsored_so_far += amount;
        limits.set(wallet.clone(), limit);

        let total: i128 = env.storage().instance().get(&KEY_TOTAL_SPONSORED).unwrap_or(0);
        env.storage().instance().set(&KEY_TOTAL_SPONSORED, &(total + amount));
        env.storage().instance().set(&KEY_SPONSORSHIP_LIMITS, &limits);

        env.events().publish((Symbol::new(&env, "gas_sponsored"),), GasSponsoredEvent {
            wallet, amount, timestamp: env.ledger().timestamp(),
        });

        true
    }

    /// Calculate gas cost for a transaction
    pub fn calculate_gas_cost(env: Env, complexity: u32) -> i128 {
        (complexity as i128) * 100 // 100 stroops per complexity unit
    }

    pub fn get_sponsorship_limit(env: Env, wallet: Address) -> SponsorshipLimit {
        let limits: Map<Address, SponsorshipLimit> = env.storage().instance().get(&KEY_SPONSORSHIP_LIMITS).unwrap();
        limits.get(wallet).unwrap_or(SponsorshipLimit { wallet, max_per_tx: 0, max_total: 0, sponsored_so_far: 0 })
    }

    pub fn get_total_sponsored(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL_SPONSORED).unwrap_or(0)
    }
}
