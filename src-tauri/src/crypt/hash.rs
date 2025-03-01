use crate::crypt::salt::make_salt_if_missing;
use crate::crypt::{decode, encode};
use sha3::{Digest, Sha3_512};
use tracing::error;

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

    let data = [hash, salt].concat();

    encode(&data)
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
    let raw_hash = decode(hash);
    if raw_hash.is_err() {
        error!(
            "Failed to verify hash, hash cannot be decoded: {}",
            raw_hash.unwrap_err()
        );
        return false;
    }
    let raw_hash = raw_hash.unwrap();

    let salt = &raw_hash[64..];
    let hash = &raw_hash[..64];

    let mut hasher = Sha3_512::new();
    hasher.update(data);
    hasher.update(salt);
    let hash2 = hasher.finalize().to_vec();

    hash == hash2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_with_salt() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let salt = vec![10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        let hash = hash(data.as_slice(), Some(salt.as_slice()));
        assert_eq!(hash.len(), 99);
    }

    #[test]
    fn test_verify_with_salt() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let salt = vec![10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        let hash = hash(data.as_slice(), Some(salt.as_slice()));
        assert!(verify(data.as_slice(), &hash));
    }

    #[test]
    fn test_verify_invalid_hash() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let invalid_hash = "invalidhash";
        assert!(!verify(data.as_slice(), invalid_hash));
    }
}
