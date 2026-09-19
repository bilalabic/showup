use crate::{events::BondLocked, Error, Reservation, ReservationStatus, ShowUpBondContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    Address, Event as _, IntoVal, InvokeError,
};

use super::support::{
    create_event, mint, reserve, set_ledger_timestamp, setup, token_balance, valid_event,
};

#[test]
fn reserve_locks_exact_bond_and_records_the_two_node_auth_tree() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount * 2);

    reserve(&client, 1, &participant);

    assert_eq!(
        env.auths(),
        std::vec![(
            participant.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    symbol_short!("reserve"),
                    (1_u64, participant.clone()).into_val(&env),
                )),
                sub_invocations: std::vec![AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        token.clone(),
                        symbol_short!("transfer"),
                        (participant.clone(), contract_id.clone(), params.bond_amount,)
                            .into_val(&env),
                    )),
                    sub_invocations: std::vec![],
                }],
            }
        )]
    );
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [BondLocked {
            event_id: 1,
            participant: participant.clone(),
            amount: params.bond_amount,
        }
        .to_xdr(&env, &contract_id)]
    );

    assert_eq!(
        client.get_reservation(&1, &participant),
        Some(Reservation {
            event_id: 1,
            participant: participant.clone(),
            amount: params.bond_amount,
            reserved_at: super::support::NOW,
            status: ReservationStatus::Locked,
        })
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn duplicate_reservation_is_rejected_without_a_second_transfer() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount * 2);
    reserve(&client, 1, &participant);

    assert_eq!(
        client.try_reserve(&1, &participant),
        Err(Ok(Error::AlreadyReserved))
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn failed_token_transfer_rolls_back_reservation_and_count() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);

    assert!(client.try_reserve(&1, &participant).is_err());

    assert_eq!(client.get_reservation(&1, &participant), None);
    assert_eq!(client.get_event(&1).reserved_count, 0);
    assert_eq!(token_balance(&env, &token, &participant), 0);
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
    assert_eq!(env.events().all().filter_by_contract(&contract_id), []);
}

#[test]
fn capacity_one_allows_only_one_participant() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let mut params = valid_event(&env);
    params.capacity = 1;
    let first = Address::generate(&env);
    let second = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &first, params.bond_amount);
    mint(&env, &token, &second, params.bond_amount);

    reserve(&client, 1, &first);
    assert_eq!(client.try_reserve(&1, &second), Err(Ok(Error::EventFull)));

    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(token_balance(&env, &token, &second), params.bond_amount);
    assert_eq!(client.get_reservation(&1, &second), None);
}

#[test]
fn reserve_deadline_is_exclusive() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    set_ledger_timestamp(&env, params.checkin_deadline);

    assert_eq!(
        client.try_reserve(&1, &participant),
        Err(Ok(Error::CheckInWindowClosed))
    );
    assert_eq!(client.get_reservation(&1, &participant), None);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
}

#[test]
fn reserve_succeeds_one_second_before_deadline() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    set_ledger_timestamp(&env, params.checkin_deadline - 1);

    reserve(&client, 1, &participant);

    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Locked
    );
}

#[test]
fn missing_event_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let participant = Address::generate(&env);

    assert_eq!(
        client.try_reserve(&99, &participant),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn reserve_rejects_a_different_signer() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    let other = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);

    let result = client
        .mock_auths(&[MockAuth {
            address: &other,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "reserve",
                args: (1_u64, participant.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_reserve(&1, &participant);

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
    assert_eq!(client.get_reservation(&1, &participant), None);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
}
