use crate::{events::CheckedIn, Error, ReservationStatus, ShowUpBondContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
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
fn verifier_check_in_refunds_the_bond_and_records_auth() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_start);

    client.check_in(&1, &participant);

    assert_eq!(
        env.auths(),
        std::vec![(
            params.organizer.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    symbol_short!("check_in"),
                    (1_u64, participant.clone()).into_val(&env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [CheckedIn {
            event_id: 1,
            participant: participant.clone(),
            amount: params.bond_amount,
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Attended
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn check_in_window_is_inclusive_at_the_deadline() {
    let (env, contract_id, _, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline);

    client.check_in(&1, &participant);

    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Attended
    );
}

#[test]
fn check_in_before_the_window_is_rejected() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_start - 1);

    assert_eq!(
        client.try_check_in(&1, &participant),
        Err(Ok(Error::CheckInNotOpen))
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
fn check_in_after_the_window_is_rejected() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_deadline + 1);

    assert_eq!(
        client.try_check_in(&1, &participant),
        Err(Ok(Error::CheckInWindowClosed))
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
fn check_in_cannot_run_twice() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    set_ledger_timestamp(&env, params.checkin_start);
    client.check_in(&1, &participant);

    assert_eq!(
        client.try_check_in(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn failed_refund_transfer_rolls_back_check_in() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    mint(&env, &token, &participant, i128::MAX);
    set_ledger_timestamp(&env, params.checkin_start);

    assert!(client.try_check_in(&1, &participant).is_err());

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
fn check_in_rejects_a_different_signer() {
    let (env, contract_id, token, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let other = Address::generate(&env);
    set_ledger_timestamp(&env, params.checkin_start);

    let result = client
        .mock_auths(&[MockAuth {
            address: &other,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "check_in",
                args: (1_u64, participant.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_check_in(&1, &participant);

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
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
fn cancelled_and_attended_reservations_are_terminal() {
    let (env, contract_id, _, participant, params) = setup_reserved();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    client.cancel_reservation(&1, &participant);
    set_ledger_timestamp(&env, params.checkin_start);

    assert_eq!(
        client.try_check_in(&1, &participant),
        Err(Ok(Error::NotLocked))
    );

    let second = Address::generate(&env);
    mint(
        &env,
        &client.get_config().token,
        &second,
        params.bond_amount,
    );
    reserve(&client, 1, &second);
    client.check_in(&1, &second);

    assert_eq!(
        client.try_cancel_reservation(&1, &second),
        Err(Ok(Error::NotLocked))
    );
}
