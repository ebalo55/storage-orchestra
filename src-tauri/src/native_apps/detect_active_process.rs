use crate::native_apps::constants::PROCESS_WAKEUP_INTERVAL;
use crate::native_apps::open_file::open_file;
use crate::native_apps::watch_process_event::WatchProcessEvent;
use std::process::Command;
use sysinfo::Pid;
use tauri::AppHandle;
use tauri::ipc::Channel;
use tauri_plugin_shell::ShellExt;
use tracing::{debug, error, warn};

/// Opens a file using the default app and detects the process that opened it.
///
/// # Arguments
///
/// * `app` - The Tauri app handle.
/// * `file_path` - The path to the file to check.
///
/// # Returns
///
/// A `Result` containing the process ID of the process that opened the file, or `None` if the process could not be detected.
pub async fn get_process_using_file(
    file_path: &str,
    event: &Channel<WatchProcessEvent>,
) -> Result<Pid, String> {
    event
        .send(WatchProcessEvent::FiringApp)
        .map_err(|e| e.to_string())?;
    open_file(file_path)?;

    debug!(
        "File {} opened, waiting {}s",
        file_path,
        PROCESS_WAKEUP_INTERVAL.as_secs_f64()
    );
    // Wait for the file to be opened
    event
        .send(WatchProcessEvent::WaitingForProcessWakeup)
        .map_err(|e| e.to_string())?;
    tokio::time::sleep(PROCESS_WAKEUP_INTERVAL).await;

    // Detect which process opened the file (Windows: uses the custom implementation of handle.exe, Mac/Linux: uses lsof)

    #[cfg(target_os = "windows")]
    {
        return super::detect_active_process_windows::find_process_handling_file(file_path, event)
            .await;
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        // don't know how many processes are using the file in *nix systems
        event
            .send(WatchProcessEvent::SearchingNativeProcess { processes: None })
            .map_err(|e| e.to_string())?;

        let output = Command::new("lsof")
            .arg("-t")
            .arg(file_path)
            .output()
            .ok()
            .ok_or("Failed to run lsof")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(Pid::from(
            stdout
                .lines()
                .next()
                .ok_or("Cannot get process PID")?
                .parse::<u32>()
                .map_err(|e| e.to_string())?,
        ));
    }
}
