use crate::{events::RefundClaimed, Error, ReservationStatus, ShowUpBondContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Env, Event as _,
};

use super::support::{
    create_event, mint, reserve, set_ledger_timestamp, setup_without_auth, token_balance,
    valid_event, EventParams,
};

fn setup_cancelled() -> (Env, Address, Address, Address, Address, EventParams) {
    let (env, contract_id, token, community_pool) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client.mock_all_auths(), 1, &participant);
    client.mock_all_auths().cancel_event(&1);

    (env, contract_id, token, community_pool, participant, params)
}

#[test]
fn cancelled_event_refund_is_permissionless_and_exact() {
    let (env, contract_id, token, _, participant, params) = setup_cancelled();
    let client = ShowUpBondContractClient::new(&env, &contract_id);

    client.claim_cancelled_event_refund(&1, &participant);

    assert!(env.auths().is_empty());
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [RefundClaimed {
            event_id: 1,
            participant: participant.clone(),
            amount: params.bond_amount,
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::Refunded
    );
    assert_eq!(client.get_event(&1).reserved_count, 1);
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn refund_before_event_cancellation_is_rejected() {
    let (env, contract_id, token, _) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client.mock_all_auths(), 1, &participant);

    assert_eq!(
        client.try_claim_cancelled_event_refund(&1, &participant),
        Err(Ok(Error::EventNotCancelled))
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
fn cancelled_event_refund_cannot_run_twice() {
    let (env, contract_id, token, _, participant, params) = setup_cancelled();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    client.claim_cancelled_event_refund(&1, &participant);

    assert_eq!(
        client.try_claim_cancelled_event_refund(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

#[test]
fn failed_refund_transfer_rolls_back_the_claim() {
    let (env, contract_id, token, _, participant, params) = setup_cancelled();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    mint(&env, &token, &participant, i128::MAX);

    assert!(client
        .try_claim_cancelled_event_refund(&1, &participant)
        .is_err());

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
fn attended_reservation_cannot_claim_a_cancelled_event_refund() {
    let (env, contract_id, token, _) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client.mock_all_auths(), 1, &participant);
    set_ledger_timestamp(&env, params.checkin_start);
    client.mock_all_auths().check_in(&1, &participant);
    client.mock_all_auths().cancel_event(&1);

    assert_eq!(
        client.try_claim_cancelled_event_refund(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(
        token_balance(&env, &token, &participant),
        params.bond_amount
    );
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
}

// The reachable ordering is: settle the no-show while the event is still Active,
// then cancel the event. A settled bond has already left custody, so the later
// cancellation must not make it claimable a second time.
#[test]
fn settled_reservation_cannot_claim_a_cancelled_event_refund() {
    let (env, contract_id, token, community_pool) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    mint(&env, &token, &participant, params.bond_amount);
    reserve(&client.mock_all_auths(), 1, &participant);

    set_ledger_timestamp(&env, params.checkin_deadline + 1);
    client.settle_no_show(&1, &participant);
    client.mock_all_auths().cancel_event(&1);

    let organizer_share = params.bond_amount * i128::from(params.organizer_bps) / 10_000;

    assert_eq!(
        client.try_claim_cancelled_event_refund(&1, &participant),
        Err(Ok(Error::NotLocked))
    );
    assert_eq!(
        client.get_reservation(&1, &participant).unwrap().status,
        ReservationStatus::NoShowSettled
    );
    assert_eq!(token_balance(&env, &token, &participant), 0);
    assert_eq!(token_balance(&env, &token, &contract_id), 0);
    assert_eq!(
        token_balance(&env, &token, &params.organizer),
        organizer_share
    );
    assert_eq!(
        token_balance(&env, &token, &community_pool),
        params.bond_amount - organizer_share
    );
}

#[test]
fn missing_reservation_cannot_claim_a_refund() {
    let (env, contract_id, _, _) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let participant = Address::generate(&env);
    create_event(&client.mock_all_auths(), &params);
    client.mock_all_auths().cancel_event(&1);

    assert_eq!(
        client.try_claim_cancelled_event_refund(&1, &participant),
        Err(Ok(Error::NotFound))
    );
}
