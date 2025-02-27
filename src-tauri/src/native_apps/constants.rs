use std::time::Duration;

/// The interval at which to check if the process is awake.
pub const PROCESS_WAKEUP_INTERVAL: Duration = Duration::from_secs(10);
