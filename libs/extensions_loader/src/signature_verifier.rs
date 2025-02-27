use base64ct::Encoding;
use std::fs::read;
use tauri::AppHandle;

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
    // read the signature from the file
    let signature_b64 = read(format!("{}.sig", path))
        .map_err(|e| e.to_string())?
        .iter()
        .map(|&x| x as char)
        .collect::<String>();
    // decode the signature from base64
    let signature = base64ct::Base64::decode_vec(signature_b64.as_str())
        .map_err(|e| e.to_string())?
        .iter()
        .map(|&x| x as char)
        .collect::<String>();
    // decode the signature from minisign
    let signature =
        minisign_verify::Signature::decode(signature.as_str()).map_err(|e| e.to_string())?;

    // get the public key from the config
    let config = app.config();
    let updater = config.plugins.0.get("updater").ok_or("updater not found")?;
    let public_key = updater.get("pubkey").ok_or("pubkey not found")?;
    let public_key = public_key.as_str().ok_or("pubkey is not a string")?;

    // decode the public key from base64
    let pub_key_decoded = base64ct::Base64::decode_vec(public_key)
        .map_err(|e| e.to_string())?
        .iter()
        .map(|&x| x as char)
        .collect::<String>();
    // decode the public key from minisign
    let public_key =
        minisign_verify::PublicKey::decode(pub_key_decoded.as_str()).map_err(|e| e.to_string())?;

    // read the file content
    let file_content = read(path).map_err(|e| e.to_string())?;

    // finally, verify the signature
    Ok(public_key.verify(&file_content, &signature, false).is_ok())
}
