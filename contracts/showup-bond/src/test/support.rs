use crate::{ShowUpBondContract, ShowUpBondContractClient};
use soroban_sdk::{
    testutils::Address as _,
    testutils::Ledger as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

pub const NOW: u64 = 1_800_000_000;

pub struct EventParams {
    pub organizer: Address,
    pub title: String,
    pub venue: String,
    pub bond_amount: i128,
    pub capacity: u32,
    pub start_time: u64,
    pub checkin_start: u64,
    pub checkin_deadline: u64,
    pub cancellation_deadline: u64,
    pub organizer_bps: u32,
    pub community_bps: u32,
}

fn setup_env(max_entry_ttl: u32) -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.ledger().set_timestamp(NOW);
    env.ledger().set_sequence_number(1_000_000);
    env.ledger().set_min_persistent_entry_ttl(120_960);
    env.ledger().set_max_entry_ttl(max_entry_ttl);

    let token = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let community_pool = Address::generate(&env);
    let contract_id = env.register(ShowUpBondContract, (&token, &community_pool));

    (env, contract_id, token, community_pool)
}

pub fn setup_without_auth() -> (Env, Address, Address, Address) {
    setup_env(3_110_400)
}

pub fn setup() -> (Env, Address, Address, Address) {
    let fixture = setup_without_auth();
    fixture.0.mock_all_auths();
    fixture
}

pub fn setup_with_max_ttl(max_entry_ttl: u32) -> (Env, Address, Address, Address) {
    let fixture = setup_env(max_entry_ttl);
    fixture.0.mock_all_auths();
    fixture
}

pub fn valid_event(env: &Env) -> EventParams {
    EventParams {
        organizer: Address::generate(env),
        title: String::from_str(env, "AI Builders Meetup Istanbul"),
        venue: String::from_str(env, "Istanbul"),
        bond_amount: 25_000_000,
        capacity: 20,
        start_time: NOW + 7_200,
        checkin_start: NOW + 6_900,
        checkin_deadline: NOW + 7_500,
        cancellation_deadline: NOW + 3_600,
        organizer_bps: 8_000,
        community_bps: 2_000,
    }
}

pub fn create_event(client: &ShowUpBondContractClient<'_>, params: &EventParams) -> u64 {
    client.create_event(
        &params.organizer,
        &params.title,
        &params.venue,
        &params.bond_amount,
        &params.capacity,
        &params.start_time,
        &params.checkin_start,
        &params.checkin_deadline,
        &params.cancellation_deadline,
        &params.organizer_bps,
        &params.community_bps,
    )
}

pub fn mint(env: &Env, token: &Address, participant: &Address, amount: i128) {
    StellarAssetClient::new(env, token)
        .mock_all_auths()
        .mint(participant, &amount);
}

pub fn token_balance(env: &Env, token: &Address, address: &Address) -> i128 {
    TokenClient::new(env, token).balance(address)
}

pub fn reserve(client: &ShowUpBondContractClient<'_>, event_id: u64, participant: &Address) {
    client.reserve(&event_id, participant);
}

pub fn set_ledger_timestamp(env: &Env, timestamp: u64) {
    env.ledger().with_mut(|ledger| {
        let elapsed = timestamp.saturating_sub(ledger.timestamp);
        ledger.timestamp = timestamp;
        ledger.sequence_number += (elapsed / 5) as u32;
    });
}

pub fn advance_ledgers(env: &Env, ledgers: u32) {
    env.ledger().with_mut(|ledger| {
        ledger.timestamp += u64::from(ledgers) * 5;
        ledger.sequence_number += ledgers;
    });
}
