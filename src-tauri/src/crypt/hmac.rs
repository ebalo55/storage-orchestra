use crate::crypt::salt::make_salt_if_missing;
use crate::crypt::{DerivedKey, decode, encode};
use hmac::{Hmac, Mac};
use sha3::{Digest, Sha3_512};
use tracing::error;

pub type HmacSha3_512 = Hmac<Sha3_512>;

/// Hashes data using the SHA-3 512-bit algorithm.
///
/// # Arguments
///
/// * `data` - The data to hash.
///
/// # Returns
///
/// The hashed data.
pub fn hmac(data: &[u8], key: &[u8], salt: Option<&[u8]>) -> Result<String, String> {
    let salt = make_salt_if_missing(salt);

    let key = DerivedKey::from_byte_key(key, Some(&salt), 64)?.key;

    let mut hasher = HmacSha3_512::new_from_slice(&key).map_err(|err| err.to_string())?;
    hasher.update(data);
    hasher.update(&salt);
    let hash = hasher.finalize().into_bytes().to_vec();

    let data = [hash, salt].concat();

    Ok(encode(&data))
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
pub fn verify_hmac(data: &[u8], key: &[u8], hash: &str) -> bool {
    let raw_hash = decode(hash);
    if raw_hash.is_err() {
        error!("Failed to decode hash: {}", raw_hash.err().unwrap());
        return false;
    }
    let raw_hash = raw_hash.unwrap();

    let salt = &raw_hash[64..];
    let hash = &raw_hash[..64];

    let key = DerivedKey::from_byte_key(key, Some(&salt), 64);
    if key.is_err() {
        error!("Failed to derive key: {}", key.err().unwrap());
        return false;
    }
    let key = key.unwrap().key;

    let hasher = HmacSha3_512::new_from_slice(&key).map_err(|err| err.to_string());
    if hasher.is_err() {
        error!("Failed to create hasher: {}", hasher.err().unwrap());
        return false;
    }
    let mut hasher = hasher.unwrap();

    hasher.update(data);
    hasher.update(&salt);

    let result = hasher.verify_slice(hash);
    if result.is_err() {
        error!("Failed to verify hash: {}", result.err().unwrap());
    }

    result.is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let hash = hmac(data.as_slice(), &key, None).unwrap();
        assert_eq!(hash.len(), 128);
    }

    #[test]
    fn test_verify() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let hash = hmac(data.as_slice(), &key, None).unwrap();
        assert!(verify_hmac(data.as_slice(), &key, hash.as_str()));
    }

    #[test]
    fn test_hash_with_salt() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let salt = vec![10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        let hash = hmac(data.as_slice(), &key, Some(salt.as_slice())).unwrap();
        assert_eq!(hash.len(), 99);
    }

    #[test]
    fn test_verify_with_salt() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let salt = vec![10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        let hash = hmac(data.as_slice(), &key, Some(salt.as_slice())).unwrap();
        assert!(verify_hmac(data.as_slice(), &key, hash.as_str()));
    }

    #[test]
    fn test_verify_invalid_hash() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let invalid_hash = "invalidhash";
        assert!(!verify_hmac(data.as_slice(), &key, invalid_hash));
    }

    #[test]
    fn test_verify_invalid_key() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let invalid_key = vec![1; 10];
        let hash = hmac(data.as_slice(), &key, None).unwrap();
        assert!(!verify_hmac(data.as_slice(), &invalid_key, hash.as_str()));
    }

    #[test]
    fn test_hash_with_invalid_key() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let key = vec![0; 10];
        let invalid_key = vec![1; 10];
        let result = hmac(data.as_slice(), &invalid_key, None);
        assert!(result.is_ok());
    }
}
