use core::cmp::min;

use soroban_sdk::{contracttype, panic_with_error, Address, Env};

use crate::{Config, Error, Event, Reservation};

pub(crate) const DAY_IN_LEDGERS: u32 = 17_280;
pub(crate) const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub(crate) const BUMP_TO: u32 = 90 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub(crate) enum DataKey {
    Config,
    EventCount,
    Event(u64),
    Reservation(u64, Address),
}

fn ttl_policy(env: &Env) -> (u32, u32) {
    let max_ttl = env.storage().max_ttl();
    (min(BUMP_THRESHOLD, max_ttl), min(BUMP_TO, max_ttl))
}

fn bump_instance_ttl(env: &Env) {
    let (threshold, extend_to) = ttl_policy(env);
    env.storage().instance().extend_ttl(threshold, extend_to);
}

fn bump_persistent_ttl(env: &Env, key: &DataKey) {
    let (threshold, extend_to) = ttl_policy(env);
    env.storage()
        .persistent()
        .extend_ttl(key, threshold, extend_to);
}

pub(crate) fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
    bump_instance_ttl(env);
}

// Unreachable while the instance entry is live, because `__constructor` writes
// both keys. It becomes reachable only if the instance entry is archived, so it
// panics with a typed code the frontend can map rather than a bare string, which
// would surface as an opaque host abort.
pub(crate) fn get_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotFound))
}

pub(crate) fn set_event_count(env: &Env, event_count: u64) {
    env.storage()
        .instance()
        .set(&DataKey::EventCount, &event_count);
    bump_instance_ttl(env);
}

pub(crate) fn get_event_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::EventCount)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotFound))
}

pub(crate) fn set_event(env: &Env, event: &Event) {
    let key = DataKey::Event(event.id);
    env.storage().persistent().set(&key, event);
    bump_persistent_ttl(env, &key);
}

pub(crate) fn get_event(env: &Env, event_id: u64) -> Option<Event> {
    env.storage().persistent().get(&DataKey::Event(event_id))
}

pub(crate) fn get_reservation(
    env: &Env,
    event_id: u64,
    participant: &Address,
) -> Option<Reservation> {
    env.storage()
        .persistent()
        .get(&DataKey::Reservation(event_id, participant.clone()))
}

pub(crate) fn set_reservation(env: &Env, reservation: &Reservation) {
    let key = DataKey::Reservation(reservation.event_id, reservation.participant.clone());
    env.storage().persistent().set(&key, reservation);
    bump_persistent_ttl(env, &key);
}

#[cfg(test)]
pub(crate) fn instance_ttl(env: &Env) -> u32 {
    use soroban_sdk::testutils::storage::Instance as _;

    env.storage().instance().get_ttl()
}

#[cfg(test)]
pub(crate) fn event_ttl(env: &Env, event_id: u64) -> u32 {
    use soroban_sdk::testutils::storage::Persistent as _;

    env.storage()
        .persistent()
        .get_ttl(&DataKey::Event(event_id))
}

#[cfg(test)]
pub(crate) fn reservation_ttl(env: &Env, event_id: u64, participant: &Address) -> u32 {
    use soroban_sdk::testutils::storage::Persistent as _;

    env.storage()
        .persistent()
        .get_ttl(&DataKey::Reservation(event_id, participant.clone()))
}

#[cfg(test)]
pub(crate) fn network_max_ttl(env: &Env) -> u32 {
    env.storage().max_ttl()
}
