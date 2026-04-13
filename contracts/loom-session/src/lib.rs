//! Loom session policy (MVP).
//!
//! **Flow**
//! 1. `init` — **owner** signs once; stores relayer address + daily spend cap (in abstract “units”).
//! 2. `relay_execute` — **relayer** signs each chain tx; contract checks identity + nonce + daily cap,
//!    then records spend and bumps nonce.
//!
//! This does **not** invoke Soroswap yet; it proves the authorization + limits pattern. A later
//! step adds `invoke_swap` that builds router calls under the same checks.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
};

const CONFIG: Symbol = symbol_short!("config");

/// Spend units are arbitrary (e.g. stroops or your own accounting); router integration picks real amounts.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionConfig {
    pub owner: Address,
    pub relayer: Address,
    pub nonce: u64,
    /// Max `spend_amount` sum per UTC day (ledger-aligned day bucket).
    pub max_daily_spend: i128,
    pub spent_today: i128,
    /// `ledger_timestamp() / 86400` bucket when `spent_today` applies.
    pub day_bucket: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    UnauthorizedRelayer = 3,
    DailyLimitExceeded = 4,
    InvalidSpendAmount = 5,
}

fn day_bucket(env: &Env) -> u64 {
    env.ledger().timestamp() / 86400
}

fn load_config(env: &Env) -> Result<SessionConfig, Error> {
    env.storage()
        .instance()
        .get(&CONFIG)
        .ok_or(Error::NotInitialized)
}

fn save_config(env: &Env, cfg: &SessionConfig) {
    env.storage().instance().set(&CONFIG, cfg);
}

#[contract]
pub struct LoomSession;

#[contractimpl]
impl LoomSession {
    /// One-time setup. **Owner** must authorize.
    pub fn init(
        env: Env,
        owner: Address,
        relayer: Address,
        max_daily_spend: i128,
    ) -> Result<(), Error> {
        owner.require_auth();
        if env.storage().instance().has(&CONFIG) {
            return Err(Error::AlreadyInitialized);
        }
        let day = day_bucket(&env);
        let cfg = SessionConfig {
            owner,
            relayer,
            nonce: 0,
            max_daily_spend,
            spent_today: 0,
            day_bucket: day,
        };
        save_config(&env, &cfg);
        Ok(())
    }

    /// **Relayer** signs the transaction. Increments nonce; adds `spend_amount` to daily tally.
    pub fn relay_execute(env: Env, relayer: Address, spend_amount: i128) -> Result<u64, Error> {
        relayer.require_auth();
        if spend_amount < 0 {
            return Err(Error::InvalidSpendAmount);
        }

        let mut cfg = load_config(&env)?;
        if cfg.relayer != relayer {
            return Err(Error::UnauthorizedRelayer);
        }

        let day = day_bucket(&env);
        if day != cfg.day_bucket {
            cfg.day_bucket = day;
            cfg.spent_today = 0;
        }

        let next_spent = cfg
            .spent_today
            .checked_add(spend_amount)
            .expect("spend overflow");
        if next_spent > cfg.max_daily_spend {
            return Err(Error::DailyLimitExceeded);
        }

        cfg.spent_today = next_spent;
        cfg.nonce = cfg.nonce.checked_add(1).expect("nonce overflow");

        let out_nonce = cfg.nonce;
        save_config(&env, &cfg);
        Ok(out_nonce)
    }

    /// Read-only helper for off-chain relayer / indexers.
    pub fn get_config(env: Env) -> Result<SessionConfig, Error> {
        load_config(&env)
    }
}
