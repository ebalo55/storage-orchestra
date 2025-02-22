use crate::native_apps::constants::PROCESS_WAKEUP_INTERVAL;
use crate::native_apps::open_file::open_file;
use std::process::Command;
use sysinfo::Pid;
use tauri::AppHandle;
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
pub async fn get_process_using_file(file_path: &str) -> Result<Pid, String> {
    open_file(file_path)?;

    debug!(
        "File {} opened, waiting {}s",
        file_path,
        PROCESS_WAKEUP_INTERVAL.as_secs_f64()
    );
    // Wait for the file to be opened
    tokio::time::sleep(PROCESS_WAKEUP_INTERVAL).await;

    // Detect which process opened the file (Windows: uses the custom implementation of handle.exe, Mac/Linux: uses lsof)

    #[cfg(target_os = "windows")]
    {
        let mut response =
            super::detect_active_process_windows::find_process_handling_file(file_path).await;
        if response.is_err() {
            error!(
                "Failed to get process PID: {}",
                response.as_ref().unwrap_err()
            );
            warn!("Retrying");
            response =
                super::detect_active_process_windows::find_process_handling_file(file_path).await;
        }
        return response;
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
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

    Err("Cannot get process PID".to_string())
}
