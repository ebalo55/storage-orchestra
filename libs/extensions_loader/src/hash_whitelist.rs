use crate::trusted_hashes::TRUSTED_HASHES;
use sha3::{Digest, Sha3_512};
use std::fs;
use std::io::Read;

/// Hashes a file using SHA-3 512.
///
/// # Arguments
///
/// * `path` - The path to the file.
///
/// # Returns
///
/// A `Result` containing the hash of the file, or an error message if the file could not be read.
pub fn hash_file(path: &str) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha3_512::new();
    let mut buffer = [0; 4096];

    while let Ok(n) = file.read(&mut buffer) {
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Checks if the hash of a file is trusted.
///
/// # Arguments
///
/// * `path` - The path to the file.
///
/// # Returns
///
/// `true` if the hash of the file is trusted, `false` otherwise.
pub fn is_hash_trusted(path: &str) -> bool {
    match hash_file(path) {
        Ok(hash) => TRUSTED_HASHES.contains(&hash.as_str()),
        Err(_) => false,
    }
}
