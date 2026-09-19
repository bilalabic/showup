#![no_std]

//! ShowUp attendance bond contract.

#[cfg(test)]
extern crate std;

mod events;
mod storage;
mod types;

pub use types::{
    Config, Error, Event, EventStatus, Reservation, ReservationStatus, MAX_TITLE_LENGTH,
    MAX_VENUE_LENGTH,
};

use events::{
    BondLocked, CheckedIn, EventCancelled, EventCreated, NoShowSettled, RefundClaimed,
    ReservationCancelled,
};
use soroban_sdk::{contract, contractimpl, token::TokenClient, Address, Env, String};

#[contract]
pub struct ShowUpBondContract;

#[contractimpl]
impl ShowUpBondContract {
    pub fn __constructor(env: Env, token: Address, community_pool: Address) {
        storage::set_config(
            &env,
            &Config {
                token,
                community_pool,
            },
        );
        storage::set_event_count(&env, 0);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_event(
        env: Env,
        organizer: Address,
        title: String,
        venue: String,
        bond_amount: i128,
        capacity: u32,
        start_time: u64,
        checkin_start: u64,
        checkin_deadline: u64,
        cancellation_deadline: u64,
        organizer_bps: u32,
        community_bps: u32,
    ) -> Result<u64, Error> {
        organizer.require_auth();

        if bond_amount <= 0
            || capacity == 0
            || title.len() > MAX_TITLE_LENGTH
            || venue.len() > MAX_VENUE_LENGTH
        {
            return Err(Error::InvalidAmount);
        }

        let total_bps = organizer_bps
            .checked_add(community_bps)
            .ok_or(Error::Overflow)?;
        if total_bps != 10_000 {
            return Err(Error::InvalidBasisPoints);
        }

        if cancellation_deadline > checkin_start
            || checkin_start > checkin_deadline
            || start_time < checkin_start
            || start_time > checkin_deadline
        {
            return Err(Error::InvalidSchedule);
        }

        let event_id = storage::get_event_count(&env)
            .checked_add(1)
            .ok_or(Error::Overflow)?;
        let event = Event {
            id: event_id,
            organizer: organizer.clone(),
            verifier: organizer.clone(),
            title,
            venue,
            bond_amount,
            capacity,
            reserved_count: 0,
            start_time,
            checkin_start,
            checkin_deadline,
            cancellation_deadline,
            organizer_bps,
            community_bps,
            status: EventStatus::Active,
        };

        storage::set_event_count(&env, event_id);
        storage::set_event(&env, &event);

        EventCreated {
            event_id,
            organizer,
            bond_amount,
            capacity,
        }
        .publish(&env);

        Ok(event_id)
    }

    pub fn reserve(env: Env, event_id: u64, participant: Address) -> Result<(), Error> {
        participant.require_auth();

        let mut event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        if event.status != EventStatus::Active {
            return Err(Error::NotActive);
        }

        let now = env.ledger().timestamp();
        if now >= event.checkin_deadline {
            return Err(Error::CheckInWindowClosed);
        }
        if event.reserved_count >= event.capacity {
            return Err(Error::EventFull);
        }
        if storage::get_reservation(&env, event_id, &participant).is_some() {
            return Err(Error::AlreadyReserved);
        }

        event.reserved_count = event.reserved_count.checked_add(1).ok_or(Error::Overflow)?;
        let reservation = Reservation {
            event_id,
            participant: participant.clone(),
            amount: event.bond_amount,
            reserved_at: now,
            status: ReservationStatus::Locked,
        };

        storage::set_event(&env, &event);
        storage::set_reservation(&env, &reservation);

        let config = storage::get_config(&env);
        TokenClient::new(&env, &config.token).transfer(
            &participant,
            env.current_contract_address(),
            &reservation.amount,
        );

        BondLocked {
            event_id,
            participant,
            amount: reservation.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_reservation(env: Env, event_id: u64, participant: Address) -> Result<(), Error> {
        participant.require_auth();

        let mut reservation =
            storage::get_reservation(&env, event_id, &participant).ok_or(Error::NotFound)?;
        if reservation.status != ReservationStatus::Locked {
            return Err(Error::NotLocked);
        }

        let mut event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        if event.status != EventStatus::Active {
            return Err(Error::NotActive);
        }
        if env.ledger().timestamp() > event.cancellation_deadline {
            return Err(Error::CancellationDeadlinePassed);
        }

        event.reserved_count = event.reserved_count.checked_sub(1).ok_or(Error::Overflow)?;
        reservation.status = ReservationStatus::Cancelled;

        storage::set_event(&env, &event);
        storage::set_reservation(&env, &reservation);

        let config = storage::get_config(&env);
        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &participant,
            &reservation.amount,
        );

        ReservationCancelled {
            event_id,
            participant,
            amount: reservation.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn check_in(env: Env, event_id: u64, participant: Address) -> Result<(), Error> {
        let mut reservation =
            storage::get_reservation(&env, event_id, &participant).ok_or(Error::NotFound)?;
        if reservation.status != ReservationStatus::Locked {
            return Err(Error::NotLocked);
        }

        let event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        event.verifier.require_auth();
        if event.status != EventStatus::Active {
            return Err(Error::NotActive);
        }

        let now = env.ledger().timestamp();
        if now < event.checkin_start {
            return Err(Error::CheckInNotOpen);
        }
        if now > event.checkin_deadline {
            return Err(Error::CheckInWindowClosed);
        }

        reservation.status = ReservationStatus::Attended;
        storage::set_reservation(&env, &reservation);

        let config = storage::get_config(&env);
        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &reservation.participant,
            &reservation.amount,
        );

        CheckedIn {
            event_id,
            participant: reservation.participant,
            amount: reservation.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_event(env: Env, event_id: u64) -> Result<(), Error> {
        let mut event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        event.organizer.require_auth();
        if event.status != EventStatus::Active {
            return Err(Error::NotActive);
        }

        event.status = EventStatus::Cancelled;
        storage::set_event(&env, &event);

        EventCancelled {
            event_id,
            organizer: event.organizer,
        }
        .publish(&env);

        Ok(())
    }

    pub fn claim_cancelled_event_refund(
        env: Env,
        event_id: u64,
        participant: Address,
    ) -> Result<(), Error> {
        let mut reservation =
            storage::get_reservation(&env, event_id, &participant).ok_or(Error::NotFound)?;
        if reservation.status != ReservationStatus::Locked {
            return Err(Error::NotLocked);
        }

        let event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        if event.status != EventStatus::Cancelled {
            return Err(Error::EventNotCancelled);
        }

        reservation.status = ReservationStatus::Refunded;
        storage::set_reservation(&env, &reservation);

        let config = storage::get_config(&env);
        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &reservation.participant,
            &reservation.amount,
        );

        RefundClaimed {
            event_id,
            participant: reservation.participant,
            amount: reservation.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn settle_no_show(env: Env, event_id: u64, participant: Address) -> Result<(), Error> {
        let mut reservation =
            storage::get_reservation(&env, event_id, &participant).ok_or(Error::NotFound)?;
        if reservation.status != ReservationStatus::Locked {
            return Err(Error::NotLocked);
        }

        let event = storage::get_event(&env, event_id).ok_or(Error::NotFound)?;
        if event.status != EventStatus::Active {
            return Err(Error::NotActive);
        }
        if env.ledger().timestamp() <= event.checkin_deadline {
            return Err(Error::SettlementTooEarly);
        }

        let organizer_amount = reservation
            .amount
            .checked_mul(i128::from(event.organizer_bps))
            .ok_or(Error::Overflow)?
            .checked_div(10_000)
            .ok_or(Error::Overflow)?;
        let community_amount = reservation
            .amount
            .checked_sub(organizer_amount)
            .ok_or(Error::Overflow)?;

        reservation.status = ReservationStatus::NoShowSettled;
        storage::set_reservation(&env, &reservation);

        let config = storage::get_config(&env);
        let token = TokenClient::new(&env, &config.token);
        token.transfer(
            &env.current_contract_address(),
            &event.organizer,
            &organizer_amount,
        );
        token.transfer(
            &env.current_contract_address(),
            &config.community_pool,
            &community_amount,
        );

        NoShowSettled {
            event_id,
            participant: reservation.participant,
            organizer_amount,
            community_amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_config(env: Env) -> Config {
        storage::get_config(&env)
    }

    pub fn get_event_count(env: Env) -> u64 {
        storage::get_event_count(&env)
    }

    pub fn get_event(env: Env, event_id: u64) -> Result<Event, Error> {
        storage::get_event(&env, event_id).ok_or(Error::NotFound)
    }

    pub fn get_reservation(env: Env, event_id: u64, participant: Address) -> Option<Reservation> {
        storage::get_reservation(&env, event_id, &participant)
    }
}

#[cfg(test)]
mod test;
