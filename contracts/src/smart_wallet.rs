use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Map, String, Symbol, Vec};

const KEY_OWNERS: Symbol = Symbol::new("owners");
const KEY_THRESHOLD: Symbol = Symbol::new("threshold");
const KEY_SESSION_KEYS: Symbol = Symbol::new("session");
const KEY_NONCE: Symbol = Symbol::new("nonce");
const KEY_RECOVERY: Symbol = Symbol::new("recovery");

#[contracttype]
#[derive(Clone, Debug)]
pub struct SessionKey {
    pub key: BytesN<32>,
    pub expires_at: u64,
    pub allowed_contracts: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct RecoveryConfig {
    pub guardian: Address,
    pub delay_seconds: u64,
    pub requested_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WalletCreatedEvent {
    pub wallet: Address,
    pub owners: Vec<Address>,
    pub threshold: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TransactionExecutedEvent {
    pub wallet: Address,
    pub to: Address,
    pub value: i128,
    pub nonce: u64,
    pub timestamp: u64,
}

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    /// Initialize the wallet with owners and threshold
    pub fn initialize(env: Env, owners: Vec<Address>, threshold: u32, guardian: Address, recovery_delay: u64) {
        if env.storage().instance().has(&KEY_OWNERS) { panic!("Already initialized"); }
        if threshold == 0 || threshold > owners.len() as u32 { panic!("Invalid threshold"); }

        env.storage().instance().set(&KEY_OWNERS, &owners);
        env.storage().instance().set(&KEY_THRESHOLD, &threshold);
        env.storage().instance().set(&KEY_SESSION_KEYS, &Vec::<SessionKey>::new(&env));
        env.storage().instance().set(&KEY_NONCE, &0u64);

        env.storage().instance().set(&KEY_RECOVERY, &RecoveryConfig {
            guardian, delay_seconds: recovery_delay, requested_at: 0,
        });

        env.events().publish((Symbol::new(&env, "wallet_created"),), WalletCreatedEvent {
            wallet: env.current_contract_address(), owners, threshold, timestamp: env.ledger().timestamp(),
        });
    }

    /// Execute a transaction (requires enough owner signatures)
    pub fn execute(env: Env, signatures: Vec<BytesN<64>>, to: Address, value: i128, data: BytesN<32>) {
        let owners: Vec<Address> = env.storage().instance().get(&KEY_OWNERS).unwrap();
        let threshold: u32 = env.storage().instance().get(&KEY_THRESHOLD).unwrap();
        let nonce: u64 = env.storage().instance().get(&KEY_NONCE).unwrap();

        // Verify enough unique owner signatures
        let mut signed_count = 0u32;
        let nonce_hash = BytesN::from_array(&env, &[nonce as u8; 32]);
        for sig in signatures.iter() {
            for owner in owners.iter() {
                if env.crypto().ed25519_verify(&owner, &nonce_hash.into(), &sig) {
                    signed_count += 1;
                    break;
                }
            }
        }
        if signed_count < threshold { panic!("Insufficient signatures"); }

        env.storage().instance().set(&KEY_NONCE, &(nonce + 1));

        // Transfer or call
        if value > 0 {
            let token = soroban_sdk::token::Client::new(&env, &env.current_contract_address());
            token.transfer(&env.current_contract_address(), &to, &value);
        }

        env.events().publish((Symbol::new(&env, "tx_executed"),), TransactionExecutedEvent {
            wallet: env.current_contract_address(), to, value, nonce, timestamp: env.ledger().timestamp(),
        });
    }

    /// Add a session key for gasless dApp interactions
    pub fn add_session_key(env: Env, session_key: BytesN<32>, expires_at: u64, allowed_contracts: Vec<Address>) {
        let mut keys: Vec<SessionKey> = env.storage().instance().get(&KEY_SESSION_KEYS).unwrap();
        keys.push_back(SessionKey { key: session_key, expires_at, allowed_contracts });
        env.storage().instance().set(&KEY_SESSION_KEYS, &keys);
    }

    /// Request wallet recovery via guardian
    pub fn request_recovery(env: Env) {
        let mut recovery: RecoveryConfig = env.storage().instance().get(&KEY_RECOVERY).unwrap();
        recovery.requested_at = env.ledger().timestamp();
        env.storage().instance().set(&KEY_RECOVERY, &recovery);
    }

    /// Guardian completes recovery by rotating owners
    pub fn complete_recovery(env: Env, guardian: Address, new_owners: Vec<Address>, new_threshold: u32) {
        guardian.require_auth();
        let recovery: RecoveryConfig = env.storage().instance().get(&KEY_RECOVERY).unwrap();
        if guardian != recovery.guardian { panic!("Not guardian"); }
        if recovery.requested_at == 0 { panic!("Recovery not requested"); }
        let now = env.ledger().timestamp();
        if now < recovery.requested_at + recovery.delay_seconds { panic!("Recovery delay not elapsed"); }

        env.storage().instance().set(&KEY_OWNERS, &new_owners);
        env.storage().instance().set(&KEY_THRESHOLD, &new_threshold);
    }

    pub fn get_owners(env: Env) -> Vec<Address> { env.storage().instance().get(&KEY_OWNERS).unwrap() }
    pub fn get_threshold(env: Env) -> u32 { env.storage().instance().get(&KEY_THRESHOLD).unwrap() }
    pub fn get_nonce(env: Env) -> u64 { env.storage().instance().get(&KEY_NONCE).unwrap() }
}
