use soroban_sdk::{contractevent, Address};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCreated {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub organizer: Address,
    pub bond_amount: i128,
    pub capacity: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BondLocked {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub participant: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReservationCancelled {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub participant: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckedIn {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub participant: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCancelled {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub organizer: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundClaimed {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub participant: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NoShowSettled {
    #[topic]
    pub event_id: u64,
    #[topic]
    pub participant: Address,
    pub organizer_amount: i128,
    pub community_amount: i128,
}
