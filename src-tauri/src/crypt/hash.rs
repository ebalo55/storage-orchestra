use crate::crypt::salt::make_salt_if_missing;
use crate::crypt::{decode, encode};
use sha3::{Digest, Sha3_512};

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

    format!("{}", encode(&data))
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
    let raw_hash = decode(hash).unwrap();
    let salt = &raw_hash[64..];
    let hash = &raw_hash[..64];

    let mut hasher = Sha3_512::new();
    hasher.update(data);
    hasher.update(salt);
    let hash2 = hasher.finalize().to_vec();

    hash == hash2
}
