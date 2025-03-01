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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    fn create_test_file(path: &str, content: &[u8]) {
        let mut file = File::create(path).unwrap();
        file.write_all(content).unwrap();
    }

    #[test]
    fn test_hash_file_success() {
        let path = "test_file.txt";
        let content = b"test content";
        create_test_file(path, content);

        let result = hash_file(path);
        assert!(result.is_ok());

        // Clean up
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn test_hash_file_failure() {
        let path = "non_existent_file.txt";
        let result = hash_file(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_hash_trusted_true() {
        let path = "trusted_file.txt";
        let content = b"trusted content";
        create_test_file(path, content);

        // Add the hash of the content to the trusted hashes
        let hash = hash_file(path).unwrap();
        // dbg!(hash);

        let result = is_hash_trusted(path);
        assert!(result);

        // Clean up
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn test_is_hash_trusted_false() {
        let path = "untrusted_file.txt";
        let content = b"untrusted content";
        create_test_file(path, content);

        let result = is_hash_trusted(path);
        assert!(!result);

        // Clean up
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn test_is_hash_trusted_file_not_found() {
        let path = "non_existent_file.txt";
        let result = is_hash_trusted(path);
        assert!(!result);
    }
}
