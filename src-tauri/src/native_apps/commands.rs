use crate::native_apps::constants::PROCESS_WAKEUP_INTERVAL;
use crate::native_apps::detect_active_process::{get_process_using_file};
use crate::native_apps::open_file::open_file;
use specta::specta;
use sysinfo::{ProcessRefreshKind, RefreshKind, System};
use tauri::{command, AppHandle};
use tokio::fs;
use tracing::{debug, error, info};

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
/// A `Result` containing the content of the file (at closing time) if the file was opened
/// successfully, or an error message if the file could not be opened.
#[command]
#[specta]
pub async fn watch_native_open(app: AppHandle, file_path: String) -> Result<Vec<u8>, String> {
    let pid = get_process_using_file(app, file_path.as_str()).await?;

    info!("Process {} opened file {}", pid, file_path);

    let mut system = System::new_with_specifics(RefreshKind::default().with_processes(ProcessRefreshKind::everything()));
    let process = system.process(pid);
    if process.is_none() {
        error!("Process {} not found", pid);
        return Err(format!("Process {} not found", pid));
    }
    let process = process.unwrap();

    // Wait for the process to exit
    info!("Waiting for process {} to exit", pid);
    process.wait();
    info!("Process {} exited", pid);

    let content = tokio::fs::read(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    fs::remove_file(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    info!("File {} deleted", file_path);

    Ok(content)
}
