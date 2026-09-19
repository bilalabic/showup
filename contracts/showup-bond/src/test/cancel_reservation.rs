use crate::{events::ReservationCancelled, Error, ReservationStatus, ShowUpBondContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
    Address, Env, Event as _, IntoVal, InvokeError,
};

use super::support::{
    create_event, mint, reserve, set_ledger_timestamp, setup, token_balance, valid_event,
    EventParams,
};

fn setup_reserved() -> (Env, Address, Address, Address, EventParams) {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client, 1, &participant);

    (env, contract_id, token, participant, params)
}

#[test]
fn cancellation_refunds_the_exact_bond_and_frees_the_seat() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);

    client.cancel_reservation(&1, &participant);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [ReservationCancelled {
            event_id: 1,
            participant: participant.clone(),
            amount: params.bond_amount,
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Cancelled
    );
    assert_eq!(client.get_event(&1).reserved_count, 0);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);

    let replacement = Address::generate(&env);
    mint(&env, &token, &replacement, params.bond_amount);
    reserve(&client, 1, &replacement);
    assert_eq!(client.get_event(&1).reserved_count, 1);
}

#[test]
fn cancellation_deadline_is_inclusive() {
    let (env, contract_id, _, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.cancellation_deadline);

    client.cancel_reservation(&1, &participant);

    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Cancelled
    );
}

#[test]
fn cancellation_after_deadline_keeps_funds_locked() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.cancellation_deadline + 1);

    assert_eq!(
        client.try_cancel_reservation(&1, &participant),
        Err(Ok(Error::CancellationDeadlinePassed))
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(token_balance(&env, &token, &participant), 0);
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn second_cancellation_is_rejected_without_a_second_refund() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    client.cancel_reservation(&1, &participant);

    assert_eq!(
        client.try_cancel_reservation(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(client.get_event(&1).reserved_count, 0);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn failed_refund_transfer_rolls_back_cancellation() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    mint(&env, &token, &participant, i128::MAX);

    assert!(client.try_cancel_reservation(&1, &participant).is_err());

    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(token_balance(&env, &token, &participant), i128::MAX);
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
    assert_eq!(env.events().all().filter_by_contract(&contract_id), []);
}

#[test]
fn missing_reservation_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let participant = Address::generate(&env);

    assert_eq!(
        client.try_cancel_reservation(&1, &participant),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn cancellation_rejects_a_different_signer() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let other = Address::generate(&env);

    let result = client
        .mock_auths(&[MockAuth {
            address: &other,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "cancel_reservation",
                args: (1_u64, participant.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_cancel_reservation(&1, &participant);

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
    assert_eq!(token_balance(&env, &token, &participant), 0);
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}
