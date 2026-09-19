use crate::{
    storage::{event_ttl, instance_ttl, network_max_ttl, reservation_ttl, BUMP_THRESHOLD, BUMP_TO},
    ReservationStatus, ShowUpBondContractClient,
};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;

use super::support::{
    advance_ledgers, create_event, mint, reserve, setup, setup_with_max_ttl, valid_event, NOW,
};

#[test]
fn constructor_and_event_writes_extend_ttl() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    create_event(&client, &params);

    env.as_contract(&contract_id, || {
        assert_eq!(instance_ttl(&env), BUMP_TO);
        assert_eq!(event_ttl(&env, 1), BUMP_TO);
    });
}

#[test]
fn ttl_extension_is_clamped_to_the_network_maximum() {
    let (env, contract_id, _, _) = setup_with_max_ttl(1_000_000);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    create_event(&client, &params);

    env.as_contract(&contract_id, || {
        let max_ttl = network_max_ttl(&env);
        assert_eq!(instance_ttl(&env), max_ttl);
        assert_eq!(event_ttl(&env, 1), max_ttl);
    });
}

#[test]
fn reservation_survives_past_the_live_persistent_floor() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client, 1, &participant);

    env.as_contract(&contract_id, || {
        assert_eq!(reservation_ttl(&env, 1, &participant), BUMP_TO);
    });

    let ledgers = 120_961;
    advance_ledgers(&env, ledgers);

    env.as_contract(&contract_id, || {
        assert_eq!(reservation_ttl(&env, 1, &participant), BUMP_TO - ledgers);
    });
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
}

#[test]
fn cancellation_refreshes_event_and_reservation_ttl() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let mut params = valid_event(&env);
    let ledgers = BUMP_TO - BUMP_THRESHOLD + 1;
    let elapsed = u64::from(ledgers) * 5;
    params.cancellation_deadline = NOW + elapsed + 60;
    params.checkin_start = params.cancellation_deadline;
    params.start_time = params.checkin_start + 60;
    params.checkin_deadline = params.start_time + 60;
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client, 1, &participant);

    advance_ledgers(&env, ledgers);
    env.as_contract(&contract_id, || {
        assert_eq!(event_ttl(&env, 1), BUMP_THRESHOLD - 1);
        assert_eq!(reservation_ttl(&env, 1, &participant), BUMP_THRESHOLD - 1);
    });

    client.cancel_reservation(&1, &participant);

    env.as_contract(&contract_id, || {
        assert_eq!(event_ttl(&env, 1), BUMP_TO);
        assert_eq!(reservation_ttl(&env, 1, &participant), BUMP_TO);
    });
}
