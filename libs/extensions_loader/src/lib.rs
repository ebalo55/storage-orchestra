mod extensions;
mod hash_whitelist;
mod signature_verifier;
mod trusted_hashes;

use crate::extensions::{EXTENSIONS, load_extension};
use crate::hash_whitelist::is_hash_trusted;
use crate::signature_verifier::verify_signature;
pub use extensions::Extension;
pub use hash_whitelist::hash_file;
use libloading::library_filename;
use std::fs::read_dir;
pub use tauri;
use tauri::AppHandle;
use tracing::{error, info, warn};

/// Load all extensions from the `./extensions` directory.
///
/// # Arguments
///
/// * `app` - The Tauri application handle.
///
/// # Returns
///
/// A `Result` containing `()` if the extensions were loaded successfully, or an error message if they were not.
pub fn load_extensions(app: AppHandle) -> Result<(), String> {
    let extension_path = "./extensions";
    let items = read_dir(extension_path).map_err(|e| e.to_string())?;
    let mut available_extensions_number = 0;

    for entry in items {
        available_extensions_number += 1;
        let entry = entry.unwrap();
        let path = entry.path();

        // ensure the file is correct for the platform
        if path.file_name().unwrap() != library_filename(path.file_stem().unwrap()) {
            warn!(
                "Skipping invalid extension for current platform: {}",
                path.to_str().unwrap()
            );
            continue;
        }

        let path = path.to_str().unwrap();
        if !is_hash_trusted(&path) {
            warn!("Skipping untrusted extension: {}", path);
            continue;
        }

        let signature_verification = verify_signature(app.clone(), &path);
        if signature_verification.is_err() {
            error!(
                "Failed to verify signature of extension at '{}': {}",
                path,
                signature_verification.err().unwrap()
            );
            continue;
        }

        let signature_verification = signature_verification?;
        if !signature_verification {
            warn!("Skipping extension with invalid signature: {}", path);
            continue;
        }

        let extension = unsafe { load_extension(&path) };
        if extension.is_err() {
            error!(
                "Failed to load extension at '{}': {}",
                path,
                extension.err().unwrap()
            );
            continue;
        }
        let extension = extension?;
        info!(
            "Loaded extension '{} v{}' by {}",
            extension.name(),
            extension.version(),
            extension.author()
        );
        extension.run(app.clone());

        let mut extensions = EXTENSIONS.write().unwrap();
        extensions.push(extension);
        drop(extensions);
    }

    if available_extensions_number == 0 {
        warn!("No extensions found in the `./extensions` directory.");
    }

    let extensions = EXTENSIONS.read().unwrap();
    let extensions_number = extensions.len();
    drop(extensions);

    info!(
        "Loaded {}/{} extensions.",
        extensions_number, available_extensions_number
    );

    Ok(())
}
