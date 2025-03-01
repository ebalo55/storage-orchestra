use crate::crypt::salt::make_salt_with_length_if_missing;
use chacha20poly1305::aead::{Aead, Nonce};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305};
use tracing::{debug, error};

pub static ENCRYPTION_KEY_LENGTH: usize = 32;
pub static ENCRYPTION_NONCE_LENGTH: usize = 24;

/// Encrypts data using the XChaCha20-Poly1305 cipher.
///
/// # Arguments
///
/// * `data` - The data to encrypt.
/// * `key` - The key to use for encryption.
///
/// # Returns
///
/// The encrypted data.
pub fn encrypt(data: &[u8], key: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != ENCRYPTION_KEY_LENGTH {
        error!(
            "Key is not the correct length, it must be {} bytes",
            ENCRYPTION_KEY_LENGTH
        );
        return Err(format!(
            "Key is not the correct length, it must be {} bytes",
            ENCRYPTION_KEY_LENGTH
        ));
    }

    debug!("Encrypting data");

    let cipher = XChaCha20Poly1305::new(key.into());
    debug!("Cypher created");

    let nonce = make_salt_with_length_if_missing(None, ENCRYPTION_NONCE_LENGTH);
    let nonce = Nonce::<XChaCha20Poly1305>::from_slice(nonce.as_slice());
    debug!("Nonce created");

    let encrypted = cipher.encrypt(&nonce, data.as_ref()).map_err(|err| {
        error!("Error encrypting data: {}", err);
        err.to_string()
    })?;
    debug!("Data encrypted successfully");

    let mut result = Vec::new();
    result.extend_from_slice(nonce.as_slice());
    result.extend_from_slice(encrypted.as_slice());

    Ok(result)
}

/// Decrypts data using the XChaCha20-Poly1305 cipher.
///
/// # Arguments
///
/// * `data` - The data to decrypt.
/// * `key` - The key to use for decryption.
///
/// # Returns
///
/// The decrypted data.
pub fn decrypt(data: &[u8], key: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() <= ENCRYPTION_NONCE_LENGTH {
        error!("Data is too short to be decrypted");
        return Err("Data is too short to be decrypted".to_string());
    }

    if key.len() != ENCRYPTION_KEY_LENGTH {
        error!(
            "Key is not the correct length, it must be {} bytes",
            ENCRYPTION_KEY_LENGTH
        );
        return Err(format!(
            "Key is not the correct length, it must be {} bytes",
            ENCRYPTION_KEY_LENGTH
        ));
    }

    debug!("Decrypting data");

    let cipher = XChaCha20Poly1305::new(key.into());
    debug!("Cypher created");

    let nonce = Nonce::<XChaCha20Poly1305>::from_slice(&data[0..ENCRYPTION_NONCE_LENGTH]);
    debug!("Nonce created");

    let decrypted = cipher
        .decrypt(nonce, &data[ENCRYPTION_NONCE_LENGTH..])
        .map_err(|err| {
            error!("Error decrypting data: {}", err);
            err.to_string()
        })?;
    debug!("Data decrypted successfully");

    Ok(decrypted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing_subscriber;

    fn init() {
        let _ = tracing_subscriber::fmt::try_init();
    }

    #[test]
    fn test_encrypt_with_invalid_key_length() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH - 1];
        let data = b"Hello, world!";
        let result = encrypt(data, &key);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_with_invalid_key_length() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH - 1];
        let data = vec![0; ENCRYPTION_NONCE_LENGTH + 1];
        let result = decrypt(&data, &key);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_with_short_data() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH];
        let data = vec![0; ENCRYPTION_NONCE_LENGTH - 1];
        let result = decrypt(&data, &key);
        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_and_decrypt() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH];
        let data = b"Hello, world!";
        let encrypted = encrypt(data, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(data, decrypted.as_slice());
    }

    #[test]
    fn test_encrypt_with_valid_key() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH];
        let data = b"Hello, world!";
        let result = encrypt(data, &key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_decrypt_with_valid_data() {
        init();
        let key = vec![0; ENCRYPTION_KEY_LENGTH];
        let data = b"Hello, world!";
        let encrypted = encrypt(data, &key).unwrap();
        let result = decrypt(&encrypted, &key);
        assert!(result.is_ok());
    }
}
