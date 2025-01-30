use crate::crypt::salt::make_salt_with_length_if_missing;
use chacha20poly1305::aead::{Aead, Nonce};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305};

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
    let cipher = XChaCha20Poly1305::new(key.into());

    let nonce = make_salt_with_length_if_missing(
        None,
        ENCRYPTION_NONCE_LENGTH,
    );
    let nonce = Nonce::<XChaCha20Poly1305>::from_slice(nonce.as_slice());
    let encrypted = cipher
        .encrypt(&nonce, data.as_ref())
        .map_err(|err| err.to_string())?;

    let data = [nonce.to_vec(), encrypted].concat();

    Ok(data)
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
    let cipher = XChaCha20Poly1305::new(key.into());

    let nonce = Nonce::<XChaCha20Poly1305>::from_slice(&data[0..ENCRYPTION_NONCE_LENGTH]);
    let decrypted = cipher
        .decrypt(nonce, &data[ENCRYPTION_NONCE_LENGTH..])
        .map_err(|err| err.to_string())?;

    Ok(decrypted)
}
