use std::process::{Child, Command};
use tracing::info;

/// Open a file with the default application.
///
/// # Arguments
///
/// * `file_path` - The path to the file to open.
///
/// # Returns
///
/// A `Result` containing the `Child` process if the file was opened successfully, or an error message if the file could not be opened.
pub fn open_file(file_path: &str) -> Result<Child, String> {
    info!("Opening file: {}", file_path);

    #[cfg(target_os = "windows")]
    let child = Command::new("explorer").arg(file_path).spawn();

    #[cfg(target_os = "macos")]
    let child = Command::new("open").arg(file_path).spawn();

    #[cfg(target_os = "linux")]
    let child = Command::new("xdg-open").arg(file_path).spawn();

    child.map_err(|e| e.to_string())
}
