use serde::{Deserialize, Serialize};
use specta::Type;

/// Events that can be sent by the watch process event channel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case", tag = "event", content = "data")]
pub enum WatchProcessEvent {
    /// The process to watch will be started soon.
    FiringApp,
    /// The process is waiting for the file to be opened.
    WaitingForProcessWakeup,
    /// The process has opened the file. We are now searching for the active process handling the file.
    SearchingNativeProcess { processes: Option<u32> },
    /// A process has been analyzed
    ProcessAnalyzed,
    /// The process was not found
    ProcessNotFound,
    /// The process has been found
    ProcessFound,
    /// Waiting for the process to exit to proceed to auto-sync
    WaitingForProcessExit,
    /// The process has exited
    ProcessExited,
}
