use soroban_sdk::{contracterror, contracttype, Address, String};

/// Maximum UTF-8 byte length stored for an event title.
pub const MAX_TITLE_LENGTH: u32 = 96;

/// Maximum UTF-8 byte length stored for an event venue.
pub const MAX_VENUE_LENGTH: u32 = 160;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub token: Address,
    pub community_pool: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Event {
    pub id: u64,
    pub organizer: Address,
    pub verifier: Address,
    pub title: String,
    pub venue: String,
    pub bond_amount: i128,
    pub capacity: u32,
    pub reserved_count: u32,
    pub start_time: u64,
    pub checkin_start: u64,
    pub checkin_deadline: u64,
    pub cancellation_deadline: u64,
    pub organizer_bps: u32,
    pub community_bps: u32,
    pub status: EventStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reservation {
    pub event_id: u64,
    pub participant: Address,
    pub amount: i128,
    pub reserved_at: u64,
    pub status: ReservationStatus,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventStatus {
    Active,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReservationStatus {
    Locked,
    Attended,
    Cancelled,
    Refunded,
    NoShowSettled,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    NotActive = 2,
    AlreadyReserved = 3,
    EventFull = 4,
    NotLocked = 5,
    CheckInNotOpen = 6,
    CheckInWindowClosed = 7,
    CancellationDeadlinePassed = 8,
    SettlementTooEarly = 9,
    InvalidBasisPoints = 10,
    InvalidSchedule = 11,
    InvalidAmount = 12,
    Overflow = 13,
    /// The event is still Active, so there is nothing to claim a refund from.
    /// Distinct from `NotActive`, which means the opposite — that an event has
    /// already been cancelled. Sharing one code for both would leave the
    /// frontend unable to render a correct message for either.
    EventNotCancelled = 14,
}
