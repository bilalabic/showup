use crate::{
    events::EventCreated, Error, Event, EventStatus, ShowUpBondContractClient, MAX_TITLE_LENGTH,
    MAX_VENUE_LENGTH,
};
use soroban_sdk::{
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
    Address, Env, Event as _, IntoVal, InvokeError, String,
};

use super::support::{create_event, setup, setup_without_auth, valid_event, EventParams};

fn assert_rejected(env: &Env, contract_id: &Address, params: &EventParams, expected: Error) {
    let client = ShowUpBondContractClient::new(env, contract_id);

    assert_eq!(
        client.try_create_event(
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
        ),
        Err(Ok(expected))
    );
}

#[test]
fn valid_event_is_stored_and_ids_increment() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let first = valid_event(&env);
    let second = valid_event(&env);

    assert_eq!(create_event(&client, &first), 1);
    assert_eq!(
        client.get_event(&1),
        Event {
            id: 1,
            organizer: first.organizer.clone(),
            verifier: first.organizer.clone(),
            title: first.title.clone(),
            venue: first.venue.clone(),
            bond_amount: first.bond_amount,
            capacity: first.capacity,
            reserved_count: 0,
            start_time: first.start_time,
            checkin_start: first.checkin_start,
            checkin_deadline: first.checkin_deadline,
            cancellation_deadline: first.cancellation_deadline,
            organizer_bps: first.organizer_bps,
            community_bps: first.community_bps,
            status: EventStatus::Active,
        }
    );

    assert_eq!(create_event(&client, &second), 2);
    assert_eq!(client.get_event_count(), 2);
}

#[test]
fn event_creation_requires_organizer_auth() {
    let (env, contract_id, _, _) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);

    assert!(matches!(
        client.try_create_event(
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
        ),
        Err(Err(InvokeError::Abort))
    ));
}

// The no-signer case above proves the call needs *some* authorization. This one
// proves it needs the organizer's specifically: a valid signature from another
// address must not create an event on the organizer's behalf.
#[test]
fn event_creation_rejects_a_different_signer() {
    let (env, contract_id, _, _) = setup_without_auth();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);
    let other = Address::generate(&env);

    let result = client
        .mock_auths(&[MockAuth {
            address: &other,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_event",
                args: (
                    params.organizer.clone(),
                    params.title.clone(),
                    params.venue.clone(),
                    params.bond_amount,
                    params.capacity,
                    params.start_time,
                    params.checkin_start,
                    params.checkin_deadline,
                    params.cancellation_deadline,
                    params.organizer_bps,
                    params.community_bps,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_create_event(
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
        );

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
    assert_eq!(client.get_event_count(), 0);
}

#[test]
fn event_creation_emits_the_stable_event() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let params = valid_event(&env);

    create_event(&client, &params);

    let event = EventCreated {
        event_id: 1,
        organizer: params.organizer,
        bond_amount: params.bond_amount,
        capacity: params.capacity,
    };
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [event.to_xdr(&env, &contract_id)]
    );
}

#[test]
fn missing_event_returns_not_found() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);

    assert_eq!(client.try_get_event(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn invalid_basis_points_are_rejected() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.community_bps = 1_999;

    assert_rejected(&env, &contract_id, &params, Error::InvalidBasisPoints);
}

#[test]
fn basis_point_addition_overflow_is_typed() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.organizer_bps = u32::MAX;

    assert_rejected(&env, &contract_id, &params, Error::Overflow);
}

#[test]
fn non_positive_bond_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.bond_amount = 0;
    assert_rejected(&env, &contract_id, &params, Error::InvalidAmount);

    params.bond_amount = -1;
    assert_rejected(&env, &contract_id, &params, Error::InvalidAmount);
}

#[test]
fn zero_capacity_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.capacity = 0;

    assert_rejected(&env, &contract_id, &params, Error::InvalidAmount);
}

#[test]
fn invalid_schedule_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.cancellation_deadline = params.checkin_start + 1;
    assert_rejected(&env, &contract_id, &params, Error::InvalidSchedule);

    let mut params = valid_event(&env);
    params.checkin_start = params.checkin_deadline + 1;
    assert_rejected(&env, &contract_id, &params, Error::InvalidSchedule);

    let mut params = valid_event(&env);
    params.start_time = params.checkin_start - 1;
    assert_rejected(&env, &contract_id, &params, Error::InvalidSchedule);

    let mut params = valid_event(&env);
    params.start_time = params.checkin_deadline + 1;
    assert_rejected(&env, &contract_id, &params, Error::InvalidSchedule);
}

#[test]
fn text_over_the_on_chain_bounds_is_rejected() {
    let (env, contract_id, _, _) = setup();
    let mut params = valid_event(&env);
    params.title = String::from_bytes(&env, &[b'x'; (MAX_TITLE_LENGTH + 1) as usize]);
    assert_rejected(&env, &contract_id, &params, Error::InvalidAmount);

    let mut params = valid_event(&env);
    params.venue = String::from_bytes(&env, &[b'x'; (MAX_VENUE_LENGTH + 1) as usize]);
    assert_rejected(&env, &contract_id, &params, Error::InvalidAmount);
}

#[test]
fn exact_text_bounds_are_accepted() {
    let (env, contract_id, _, _) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);
    let mut params = valid_event(&env);
    params.title = String::from_bytes(&env, &[b'x'; MAX_TITLE_LENGTH as usize]);
    params.venue = String::from_bytes(&env, &[b'x'; MAX_VENUE_LENGTH as usize]);

    assert_eq!(create_event(&client, &params), 1);
}
