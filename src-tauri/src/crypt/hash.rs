use sha3::{Digest, Sha3_512};
use crate::crypt::{decode, encode};
use crate::crypt::salt::make_salt_if_missing;

/// Hashes data using the SHA-3 512-bit algorithm.
///
/// # Arguments
///
/// * `data` - The data to hash.
///
/// # Returns
///
/// The hashed data.
pub fn hash(data: &[u8], salt: Option<&[u8]>) -> String {
    let salt = make_salt_if_missing(salt);

    let mut hasher = Sha3_512::new();
    hasher.update(data);
    hasher.update(&salt);
    let hash = hasher.finalize().to_vec();

    format!("{}.{}", encode(&hash), encode(&salt))
}

/// Verifies a hash.
///
/// # Arguments
///
/// * `data` - The data to verify.
/// * `hash` - The hash to verify against.
///
/// # Returns
///
/// Whether the hash is valid.
pub fn verify(data: &[u8], hash: &str) -> bool {
    let parts: Vec<&str> = hash.split('.').collect();
    if parts.len() != 2 {
        return false;
    }

    let hash = decode(parts[0]);
    let salt = decode(parts[1]);
    if hash.is_err() || salt.is_err() {
        return false;
    }
    let hash = hash.unwrap();
    let salt = salt.unwrap();

    let mut hasher = Sha3_512::new();
    hasher.update(data);
    hasher.update(salt);
    let hash2 = hasher.finalize().to_vec();

    hash == hash2
}