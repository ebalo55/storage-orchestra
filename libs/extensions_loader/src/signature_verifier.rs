use std::fs::read;
use tauri::AppHandle;
use tracing::debug;

/// Verifies the signature of a file.
///
/// # Arguments
///
/// * `app` - The Tauri application handle.
/// * `path` - The path to the file.
///
/// # Returns
///
/// A `Result` containing `true` if the signature is valid, `false` otherwise, or an error message if the signature could not be verified.
pub fn verify_signature(app: AppHandle, path: &str) -> Result<bool, String> {
    debug!("Verifying signature of '{}'", path);
    let signature = minisign_verify::Signature::from_file(format!("{}.sig", path))
        .map_err(|e| e.to_string())?;
    let config = app.config();
    debug!("Config: {:?}", config);

    let public_key = config.plugins.0.get("pubkey").ok_or("pubkey not found")?;

    let public_key = public_key.as_str().ok_or("pubkey is not a string")?;
    debug!("Public key: {}", public_key);

    let public_key = minisign_verify::PublicKey::decode(public_key).map_err(|e| e.to_string())?;

    let file_content = read(path).map_err(|e| e.to_string())?;
    Ok(public_key.verify(&file_content, &signature, false).is_ok())
}
