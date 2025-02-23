use crate::native_apps::constants::PROCESS_WAKEUP_INTERVAL;
use crate::native_apps::detect_active_process::get_process_using_file;
use crate::native_apps::open_file::open_file;
use crate::native_apps::watch_process_event::WatchProcessEvent;
use crate::state::state::AppState;
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use sysinfo::{ProcessRefreshKind, RefreshKind, System};
use tauri::ipc::Channel;
use tauri::{AppHandle, State, command};
use tokio::fs;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

/// Watch a file for the default application to open it and return its content when the application
/// closes
///
/// # Arguments
///
/// * `app` - The Tauri app handle.
/// * `file_path` - The path to the file to watch.
///
/// # Returns
///
/// A `Result` containing the file path, or an error message if the file could not be opened.
#[command]
#[specta]
pub async fn watch_native_open(
    state: State<'_, AppState>,
    file_path: String,
    event: Channel<WatchProcessEvent>,
) -> Result<String, String> {
    let cancellation_token = CancellationToken::new();

    // store the cancellation token in the state
    let writable_state = state.write().await;
    let mut token_guard = writable_state
        .cancellation_tokens
        .watch_native_open_command
        .lock()
        .await;
    *token_guard = Some(cancellation_token.clone());
    drop(token_guard);
    drop(writable_state);

    // get the process handling file or fail if the operation is cancelled, this allows the user to
    // manually override the identification of the process and manually trigger the update of the
    // file in case of error
    let pid = tokio::select! {
        pid = get_process_using_file(file_path.as_str(), &event) => Some(pid?),
        _ = cancellation_token.cancelled() => {
            warn!("Automatic process detection cancelled");
            None
        }
    };

    if pid.is_none() {
        return Err("Automatic process detection cancelled".to_owned());
    }
    let pid = pid.unwrap();

    info!("Process {} opened file {}", pid, file_path);

    let mut system = System::new_with_specifics(
        RefreshKind::default().with_processes(ProcessRefreshKind::everything()),
    );
    let process = system.process(pid);
    if process.is_none() {
        error!("Process {} not found", pid);
        return Err(format!("Process {} not found", pid));
    }
    let process = process.unwrap();

    // Wait for the process to exit
    event
        .send(WatchProcessEvent::WaitingForProcessExit)
        .map_err(|e| e.to_string())?;
    info!("Waiting for process {} to exit", pid);
    process.wait();
    info!("Process {} exited", pid);
    event
        .send(WatchProcessEvent::ProcessExited)
        .map_err(|e| e.to_string())?;

    Ok(file_path)
}

/// Cancel the watch_native_open command if it is running
///
/// # Arguments
///
/// * `state` - The Tauri app state.
///
/// # Returns
///
/// A `Result` containing `Ok(())` if the command was cancelled, or an error message if the command
/// was not running.
#[command]
#[specta]
pub async fn cancel_watch_native_open(state: State<'_, AppState>) -> Result<(), String> {
    let readable_state = state.read().await;
    let mut token_guard = readable_state
        .cancellation_tokens
        .watch_native_open_command
        .lock()
        .await;

    if let Some(token) = token_guard.take() {
        token.cancel(); // Send the cancel signal
        info!("Cancelled watch_native_open command");
        Ok(())
    } else {
        Err("No command to cancel".to_owned())
    }
}
