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

    // get the public key from the config
    let config = app.config();
    let updater = config.plugins.0.get("updater").ok_or("updater not found")?;
    let public_key = updater.get("pubkey").ok_or("pubkey not found")?;
    let public_key = public_key.as_str().ok_or("pubkey is not a string")?;

    // read the file content
    let file_content = read(path).map_err(|e| e.to_string())?;

    // finally, verify the signature
    _verify(public_key.to_string(), signature_b64, file_content)
}

/// Verifies the signature of a file.
///
/// # Arguments
///
/// * `raw_public_key` - The raw public key, this is base64 encoded.
/// * `raw_signature` - The raw signature, this is base64 encoded content of the .sig file.
/// * `file_content` - The content of the file to verify.
///
/// # Returns
///
/// A `Result` containing `true` if the signature is valid, `false` otherwise, or an error message if the signature could not be verified.
fn _verify(
    raw_public_key: String,
    raw_signature: String,
    file_content: Vec<u8>,
) -> Result<bool, String> {
    // decode the signature from base64
    let signature = b64_to_string(raw_signature)?;
    // decode the signature from minisign
    let signature =
        minisign_verify::Signature::decode(signature.as_str()).map_err(|e| e.to_string())?;

    // decode the public key from base64
    let public_key = b64_to_string(raw_public_key)?;
    // decode the public key from minisign
    let public_key =
        minisign_verify::PublicKey::decode(public_key.as_str()).map_err(|e| e.to_string())?;

    // finally, verify the signature
    Ok(public_key.verify(&file_content, &signature, false).is_ok())
}

/// Decodes a base64 string to a regular string.
///
/// # Arguments
///
/// * `value` - The base64 encoded string.
///
/// # Returns
///
/// A `Result` containing the decoded string if successful, or an error message if the string could not be decoded.
fn b64_to_string(value: String) -> Result<String, String> {
    Ok(base64ct::Base64::decode_vec(value.as_str())
        .map_err(|e| e.to_string())?
        .iter()
        .map(|&x| x as char)
        .collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_valid_signature() {
        let raw_public_key = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFFN0I3RDQyOTBCOTAxNjkKUldScEFibVFRbjE3SHRTMFQ2MzcxaElrclZybHQvaUxYM0Zlc05vL2Y5aXU2M05TNFhSWWhVazcK";
        let raw_signature = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVScEFibVFRbjE3SGpHSzRveng2UFFiL3Y3OUxqOUJOR1NZVFJrRWszUkJFR2JBbWhqbytITnA5NGlnWk1kSEhHSDd1MTExMWo4UndpZExLUjRYcUY0VUpJVWcwaVRxVkFzPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzQwODM0NTg0CWZpbGU6ZmlsZS50eHQKakFrOC84UU1vai9Nb0dWbTZ2NmF5MVU2UHU1S0lFT21nNXk0TjduWTJLNW9kb2JDbTFBRlNuajNhR3FvS2kvbUswT3dVQ2x6ZHhrL1hhTHh5UkRGQ1E9PQo=";
        let file_content = [
            255, 254, 116, 0, 101, 0, 115, 0, 116, 0, 32, 0, 99, 0, 111, 0, 110, 0, 116, 0, 101, 0,
            110, 0, 116, 0,
        ]
        .to_vec();

        let result = _verify(
            raw_public_key.to_string(),
            raw_signature.to_string(),
            file_content,
        );

        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_verify_invalid_signature() {
        let raw_public_key = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDMzOEZDMkExNDcyMTY4NTEKUldSUmFDRkhvY0tQTTFGeldEL3lBSlhPaUZwVTFJdkpyUnpLMlRsYTNEUzRIbGN2WmpBK2hTamoK";
        let raw_signature = "invalidsignature";
        let file_content = [
            255, 254, 116, 0, 101, 0, 115, 0, 116, 0, 32, 0, 99, 0, 111, 0, 110, 0, 116, 0, 101, 0,
            110, 0, 116, 0,
        ]
        .to_vec();

        let result = _verify(
            raw_public_key.to_string(),
            raw_signature.to_string(),
            file_content,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_invalid_public_key() {
        let raw_public_key = "invalid_pubkey";
        let raw_signature = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVSUmFDRkhvY0tQTTV5MjhpK3pHMVAvRTlLRjhhS2cvVEtRdWk1T2ZOVTZFc3lVcUo3NVVaMVFySGg3QkpYWUtaNHlyeVY3WHQwYjZRTFpJYzhPdC9nbmZlTUw4WjlZbndNPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzQwODI0Mzk5CWZpbGU6ZmlsZS50eHQKSkw3MG5jWENkQ3AyTUFHdWNkRTdCek5id2ZUL0RXTW5IWWU5akpYR2tTZi91L0xnMk02MjlMa25SZVgyUkN1U0s2Zm5jb3VPdTBsQ0JzbGE0R3oxREE9PQo=";
        let file_content = [
            255, 254, 116, 0, 101, 0, 115, 0, 116, 0, 32, 0, 99, 0, 111, 0, 110, 0, 116, 0, 101, 0,
            110, 0, 116, 0,
        ]
        .to_vec();

        let result = _verify(
            raw_public_key.to_string(),
            raw_signature.to_string(),
            file_content,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_invalid_base64_signature() {
        let raw_public_key = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDMzOEZDMkExNDcyMTY4NTEKUldSUmFDRkhvY0tQTTFGeldEL3lBSlhPaUZwVTFJdkpyUnpLMlRsYTNEUzRIbGN2WmpBK2hTamoK";
        let raw_signature = "invalid_base64_signature";
        let file_content = [
            255, 254, 116, 0, 101, 0, 115, 0, 116, 0, 32, 0, 99, 0, 111, 0, 110, 0, 116, 0, 101, 0,
            110, 0, 116, 0,
        ]
        .to_vec();

        let result = _verify(
            raw_public_key.to_string(),
            raw_signature.to_string(),
            file_content,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_invalid_base64_public_key() {
        let raw_public_key = "invalid_base64_pubkey".to_string();
        let raw_signature = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVSUmFDRkhvY0tQTTV5MjhpK3pHMVAvRTlLRjhhS2cvVEtRdWk1T2ZOVTZFc3lVcUo3NVVaMVFySGg3QkpYWUtaNHlyeVY3WHQwYjZRTFpJYzhPdC9nbmZlTUw4WjlZbndNPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzQwODI0Mzk5CWZpbGU6ZmlsZS50eHQKSkw3MG5jWENkQ3AyTUFHdWNkRTdCek5id2ZUL0RXTW5IWWU5akpYR2tTZi91L0xnMk02MjlMa25SZVgyUkN1U0s2Zm5jb3VPdTBsQ0JzbGE0R3oxREE9PQo=";
        let file_content = [
            255, 254, 116, 0, 101, 0, 115, 0, 116, 0, 32, 0, 99, 0, 111, 0, 110, 0, 116, 0, 101, 0,
            110, 0, 116, 0,
        ]
        .to_vec();

        let result = _verify(
            raw_public_key.to_string(),
            raw_signature.to_string(),
            file_content,
        );
        assert!(result.is_err());
    }
}
