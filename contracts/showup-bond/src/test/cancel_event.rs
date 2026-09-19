use crate::{
    events::EventCancelled, Error, EventStatus, ReservationStatus, ShowUpBondContractClient,
};
use soroban_sdk::{
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    Address, Event as _, IntoVal, InvokeError, Symbol,
};

use super::support::{
    create_event, mint, reserve, set_ledger_timestamp, setup, token_balance, valid_event,
};

#[test]
fn organizer_cancels_without_moving_locked_funds() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client, 1, &participant);

    client.cancel_event(&1);

    assert_eq!(
        env.auths(),
        std::vec![(
            params.organizer.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "cancel_event"),
                    (1_u64,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventCancelled {
            event_id: 1,
            organizer: params.organizer,
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(client.get_event(&1).status, EventStatus::Cancelled);
    assert_eq!(client.get_event(&1).reserved_count, 1);
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

#[test]
fn cancel_event_rejects_a_different_signer() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let other = Address::generate(&env);
    create_event(&client, &params);

    let result = client
        .mock_auths(&[MockAuth {
            address: &other,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "cancel_event",
                args: (1_u64,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_cancel_event(&1);

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
    assert_eq!(client.get_event(&1).status, EventStatus::Active);
}

#[test]
fn event_cancellation_is_terminal_and_blocks_active_paths() {
    let (env, contract_id, token, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    let replacement = Address::generate(&env);
    create_event(&client, &params);
    mint(&env, &token, &participant, params.bond_amount);
    mint(&env, &token, &replacement, params.bond_amount);
    reserve(&client, 1, &participant);
    client.cancel_event(&1);

    assert_eq!(client.try_cancel_event(&1), Err(Ok(Error::NotActive)));
    assert_eq!(
        client.try_reserve(&1, &replacement),
        Err(Ok(Error::NotActive))
    );
    assert_eq!(
        client.try_cancel_reservation(&1, &participant),
        Err(Ok(Error::NotActive))
    );
    set_ledger_timestamp(&env, params.checkin_start);
    assert_eq!(
        client.try_check_in(&1, &participant),
        Err(Ok(Error::NotActive))
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(
        token_balance(&env, &token, &replacement),
        params.bond_amount
    );
    assert_eq!(
        token_balance(&env, &token, &contract_id),
        params.bond_amount
    );
}

#[test]
fn missing_event_cannot_be_cancelled() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);

    assert_eq!(client.try_cancel_event(&99), Err(Ok(Error::NotFound)));
}
