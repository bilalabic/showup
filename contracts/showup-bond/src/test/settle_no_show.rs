use crate::{events::NoShowSettled, Error, ReservationStatus, ShowUpBondContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Env, Event as _,
};

use super::support::{
    create_event, mint, reserve, set_ledger_timestamp, setup_without_auth, token_balance,
    valid_event, EventParams,
};

fn setup_reserved_with_amount(
    amount: i128,
) -> (Env, Address, Address, Address, Address, EventParams) {
    let (env, contract_id, token, community_pool) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let mut params = valid_event(&env);
    params.bond_amount = amount;
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    mint(&env, &token, &participant, amount);
    reserve(&client.mock_all_auths(), 1, &participant);

    (env, contract_id, token, community_pool, participant, params)
}

#[test]
fn no_show_settlement_is_permissionless_exact_and_dust_free() {
    let (env, contract_id, token, community_pool, participant, params) =
        setup_reserved_with_amount(101);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    client.settle_no_show(&1, &participant);

    assert!(env.auths().is_empty());
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [NoShowSettled {
            event_id: 1,
            participant: participant.clone(),
            organizer_amount: 80,
            community_amount: 21,
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::NoShowSettled
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(token_balance(&env, &token, &params.organizer), 80);
    assert_eq!(token_balance(&env, &token, &community_pool), 21);
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn settlement_at_the_deadline_is_too_early() {
    let (env, contract_id, token, _, participant, params) = setup_reserved_with_amount(25_000_000);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline);

    assert_eq!(
        client.try_settle_no_show(&1, &participant),
        Err(Ok(Error::SettlementTooEarly))
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn no_show_settlement_cannot_run_twice() {
    let (env, contract_id, token, community_pool, participant, params) =
        setup_reserved_with_amount(101);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);
    client.settle_no_show(&1, &participant);

    assert_eq!(
        client.try_settle_no_show(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(token_balance(&env, &token, &params.organizer), 80);
    assert_eq!(token_balance(&env, &token, &community_pool), 21);
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn attended_reservation_cannot_be_settled_as_a_no_show() {
    let (env, contract_id, token, _, participant, params) = setup_reserved_with_amount(25_000_000);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_start);
    client.mock_all_auths().check_in(&1, &participant);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    assert_eq!(
        client.try_settle_no_show(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn cancelled_event_cannot_settle_a_locked_reservation() {
    let (env, contract_id, token, _, participant, params) = setup_reserved_with_amount(25_000_000);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    client.mock_all_auths().cancel_event(&1);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    assert_eq!(
        client.try_settle_no_show(&1, &participant),
        Err(Ok(Error::NotActive))
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn no_show_split_overflow_is_a_typed_error() {
    let (env, contract_id, token, _, participant, params) = setup_reserved_with_amount(i128::MAX);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    assert_eq!(
        client.try_settle_no_show(&1, &participant),
        Err(Ok(Error::Overflow))
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(token_balance(&env, &token, &contract_id), i128::MAX);
    assert_eq!(token_balance(&env, &token, &params.organizer), 0);
}

#[test]
fn failure_on_the_second_transfer_rolls_back_the_first_transfer() {
    let (env, contract_id, token, community_pool, participant, params) =
        setup_reserved_with_amount(101);
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    mint(&env, &token, &community_pool, i128::MAX);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    assert!(client.try_settle_no_show(&1, &participant).is_err());

    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 101);
    assert_eq!(token_balance(&env, &token, &params.organizer), 0);
    assert_eq!(token_balance(&env, &token, &community_pool), i128::MAX);
    assert_eq!(env.events().all().filter_by_contract(&contract_id), []);
}
