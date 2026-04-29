use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Symbol, Vec};

const KEY_EVENTS: Symbol = Symbol::new("events");
const KEY_METRICS: Symbol = Symbol::new("metrics");
const KEY_LAST_BLOCK: Symbol = Symbol::new("last_block");

#[contracttype]
#[derive(Clone, Debug)]
pub struct IndexedEvent {
    pub event_type: String,
    pub data: String,
    pub block: u64,
    pub timestamp: u64,
    pub source: Address,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DataPoint {
    pub key: String,
    pub value: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EventIndexedNotification {
    pub event_type: String,
    pub block: u64,
    pub timestamp: u64,
}

#[contract]
pub struct DataIndexer;

#[contractimpl]
impl DataIndexer {
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&KEY_EVENTS) { panic!("Already initialized"); }
        env.storage().instance().set(&KEY_EVENTS, &Vec::<IndexedEvent>(&env));
        env.storage().instance().set(&KEY_METRICS, &Map::<String, Vec<DataPoint>>::new(&env));
        env.storage().instance().set(&KEY_LAST_BLOCK, &0u64);
    }

    /// Index an on-chain event
    pub fn index_event(env: Env, event_type: String, data: String, block: u64, source: Address) {
        let mut events: Vec<IndexedEvent> = env.storage().instance().get(&KEY_EVENTS).unwrap_or(Vec::new(&env));
        events.push_back(IndexedEvent { event_type: event_type.clone(), data, block, timestamp: env.ledger().timestamp(), source });
        env.storage().instance().set(&KEY_EVENTS, &events);
        env.storage().instance().set(&KEY_LAST_BLOCK, &block);

        env.events().publish((Symbol::new(&env, "event_indexed"),), EventIndexedNotification {
            event_type, block, timestamp: env.ledger().timestamp(),
        });
    }

    /// Store a metric data point
    pub fn store_data_point(env: Env, key: String, value: i128) {
        let mut metrics: Map<String, Vec<DataPoint>> = env.storage().instance().get(&KEY_METRICS).unwrap_or(Map::new(&env));
        let mut points = metrics.get(key.clone()).unwrap_or(Vec::new(&env));
        points.push_back(DataPoint { key: key.clone(), value, timestamp: env.ledger().timestamp() });
        metrics.set(key, points);
        env.storage().instance().set(&KEY_METRICS, &metrics);
    }

    /// Query events by type
    pub fn query_events(env: Env, event_type: String, limit: u32) -> Vec<IndexedEvent> {
        let events: Vec<IndexedEvent> = env.storage().instance().get(&KEY_EVENTS).unwrap_or(Vec::new(&env));
        let mut result = Vec::new(&env);
        let mut count = 0u32;
        for e in events.iter() {
            if e.event_type == event_type && count < limit { result.push_back(e); count += 1; }
        }
        result
    }

    /// Get metric history for a key
    pub fn get_metric(env: Env, key: String) -> Vec<DataPoint> {
        let metrics: Map<String, Vec<DataPoint>> = env.storage().instance().get(&KEY_METRICS).unwrap_or(Map::new(&env));
        metrics.get(key).unwrap_or(Vec::new(&env))
    }

    /// Get all metric keys
    pub fn get_metric_keys(env: Env) -> Vec<String> {
        let metrics: Map<String, Vec<DataPoint>> = env.storage().instance().get(&KEY_METRICS).unwrap_or(Map::new(&env));
        metrics.keys().into()
    }

    /// Get last indexed block
    pub fn get_last_block(env: Env) -> u64 {
        env.storage().instance().get(&KEY_LAST_BLOCK).unwrap_or(0)
    }

    /// Get total event count
    pub fn get_event_count(env: Env) -> u32 {
        let events: Vec<IndexedEvent> = env.storage().instance().get(&KEY_EVENTS).unwrap_or(Vec::new(&env));
        events.len()
    }
}
