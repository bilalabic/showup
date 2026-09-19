use crate::{Config, ShowUpBondContractClient};

use super::support::setup;

#[test]
fn config_reads_back_after_construction() {
    let (env, contract_id, token, community_pool) = setup();
    let client = ShowUpBondContractClient::new(&env, &contract_id);

    assert_eq!(
        client.get_config(),
        Config {
            token,
            community_pool,
        }
    );
    assert_eq!(client.get_event_count(), 0);
}
