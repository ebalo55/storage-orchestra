use crate::native_apps::constants::PROCESS_WAKEUP_INTERVAL;
use crate::native_apps::detect_active_process::get_process_using_file;
use crate::native_apps::mimetype::{FileMimes, Mime};
use crate::native_apps::open_file::open_file;
use crate::state::state::AppState;
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use sysinfo::{ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, State, command};
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
/// A `Result` containing the file path, or an error message if the file could not be opened.
#[command]
#[specta]
pub async fn watch_native_open(file_path: String) -> Result<String, String> {
    let pid = get_process_using_file(file_path.as_str()).await?;

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
    info!("Waiting for process {} to exit", pid);
    process.wait();
    info!("Process {} exited", pid);

    Ok(file_path)
}

/// Get the mimetype of a file from its path
///
/// # Arguments
///
/// * `path` - The path to the file to get the mime type of
///
/// # Returns
///
/// A `Result` containing the mime type of the file, or an error message if the mime type could not be found
#[command]
#[specta]
pub async fn get_mime_from_path(path: String) -> Result<Mime, String> {
    let buffer = fs::read(path.as_str()).await.map_err(|e| e.to_string())?;
    let mime = infer::get(&buffer).ok_or("No mime type found or mime type unrecognized")?;

    match mime.mime_type() {
        // document types are most of the time simple zips with specialized content, by default
        // this is not checked by the crate
        "application/zip" => {
            if infer::doc::is_doc(&buffer) {
                return Ok(Mime::from(FileMimes::DOC));
            } else if infer::doc::is_xls(&buffer) {
                return Ok(Mime::from(FileMimes::XLS));
            } else if infer::doc::is_ppt(&buffer) {
                return Ok(Mime::from(FileMimes::PPT));
            } else if infer::doc::is_docx(&buffer) {
                return Ok(Mime::from(FileMimes::DOCX));
            } else if infer::doc::is_xlsx(&buffer) {
                return Ok(Mime::from(FileMimes::XLSX));
            } else if infer::doc::is_pptx(&buffer) {
                return Ok(Mime::from(FileMimes::PPTX));
            } else if infer::odf::is_odp(&buffer) {
                return Ok(Mime::from(FileMimes::ODP));
            } else if infer::odf::is_ods(&buffer) {
                return Ok(Mime::from(FileMimes::ODS));
            } else if infer::odf::is_odt(&buffer) {
                return Ok(Mime::from(FileMimes::ODT));
            }

            Ok(Mime::from(mime))
        }
        _ => Ok(Mime::from(mime)),
    }
}
