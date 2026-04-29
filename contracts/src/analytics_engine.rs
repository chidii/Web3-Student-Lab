use soroban_sdk::{contract, contractimpl, contracttype, Env, Map, String, Symbol, Vec};

const KEY_ANALYTICS: Symbol = Symbol::new("analytics");
const KEY_AGGREGATES: Symbol = Symbol::new("aggregates");
const KEY_TRENDS: Symbol = Symbol::new("trends");

#[contracttype]
#[derive(Clone, Debug)]
pub struct AnalyticsResult {
    pub metric: String,
    pub total: i128,
    pub average: i128,
    pub min: i128,
    pub max: i128,
    pub count: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TrendPoint {
    pub period: String,
    pub value: i128,
    pub change_pct: i32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct AggregateSnapshot {
    pub metric: String,
    pub sum: i128,
    pub count: u32,
    pub window_start: u64,
    pub window_end: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct AnalyticsComputedEvent {
    pub metric: String,
    pub total: i128,
    pub average: i128,
    pub timestamp: u64,
}

#[contract]
pub struct AnalyticsEngine;

#[contractimpl]
impl AnalyticsEngine {
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&KEY_ANALYTICS) { panic!("Already initialized"); }
        env.storage().instance().set(&KEY_ANALYTICS, &Map::<String, AnalyticsResult>::new(&env));
        env.storage().instance().set(&KEY_AGGREGATES, &Map::<String, Vec<AggregateSnapshot>>::new(&env));
        env.storage().instance().set(&KEY_TRENDS, &Vec::<TrendPoint>(&env));
    }

    /// Compute analytics for a set of values
    pub fn compute_analytics(env: Env, metric: String, values: Vec<i128>) -> AnalyticsResult {
        let count = values.len() as u32;
        let mut total: i128 = 0;
        let mut min_val: i128 = i128::MAX;
        let mut max_val: i128 = i128::MIN;

        for v in values.iter() {
            total += v;
            if v < min_val { min_val = v; }
            if v > max_val { max_val = v; }
        }

        let average = if count > 0 { total / count as i128 } else { 0 };
        if count == 0 { min_val = 0; max_val = 0; }

        let result = AnalyticsResult { metric: metric.clone(), total, average, min: min_val, max: max_val, count, timestamp: env.ledger().timestamp() };

        let mut analytics: Map<String, AnalyticsResult> = env.storage().instance().get(&KEY_ANALYTICS).unwrap_or(Map::new(&env));
        analytics.set(metric.clone(), result.clone());
        env.storage().instance().set(&KEY_ANALYTICS, &analytics);

        env.events().publish((Symbol::new(&env, "analytics_computed"),), AnalyticsComputedEvent {
            metric, total, average, timestamp: env.ledger().timestamp(),
        });

        result
    }

    /// Store a time-windowed aggregate
    pub fn store_aggregate(env: Env, metric: String, sum: i128, count: u32, window_start: u64, window_end: u64) {
        let mut aggregates: Map<String, Vec<AggregateSnapshot>> = env.storage().instance().get(&KEY_AGGREGATES).unwrap_or(Map::new(&env));
        let mut snaps = aggregates.get(metric.clone()).unwrap_or(Vec::new(&env));
        snaps.push_back(AggregateSnapshot { metric, sum, count, window_start, window_end });
        aggregates.set(metric, snaps);
        env.storage().instance().set(&KEY_AGGREGATES, &aggregates);
    }

    /// Calculate trend between current and previous value
    pub fn calculate_trend(env: Env, period: String, current: i128, previous: i128) -> TrendPoint {
        let change_pct = if previous != 0 { (((current - previous) * 10000) / previous) as i32 } else { 0 };
        let point = TrendPoint { period, value: current, change_pct };

        let mut trends: Vec<TrendPoint> = env.storage().instance().get(&KEY_TRENDS).unwrap_or(Vec::new(&env));
        trends.push_back(point.clone());
        env.storage().instance().set(&KEY_TRENDS, &trends);
        point
    }

    /// Get stored analytics for a metric
    pub fn get_analytics(env: Env, metric: String) -> AnalyticsResult {
        let analytics: Map<String, AnalyticsResult> = env.storage().instance().get(&KEY_ANALYTICS).unwrap_or(Map::new(&env));
        analytics.get(metric).unwrap_or(AnalyticsResult { metric, total: 0, average: 0, min: 0, max: 0, count: 0, timestamp: 0 })
    }

    /// Get aggregates for a metric
    pub fn get_aggregates(env: Env, metric: String) -> Vec<AggregateSnapshot> {
        let aggregates: Map<String, Vec<AggregateSnapshot>> = env.storage().instance().get(&KEY_AGGREGATES).unwrap_or(Map::new(&env));
        aggregates.get(metric).unwrap_or(Vec::new(&env))
    }

    /// Get recent trends
    pub fn get_trends(env: Env, limit: u32) -> Vec<TrendPoint> {
        let trends: Vec<TrendPoint> = env.storage().instance().get(&KEY_TRENDS).unwrap_or(Vec::new(&env));
        let mut result = Vec::new(&env);
        let start = trends.len().saturating_sub(limit as usize);
        for i in start..trends.len() {
            result.push_back(trends.get(i as u32).unwrap());
        }
        result
    }
}
