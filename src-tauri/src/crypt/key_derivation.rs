use crate::crypt::salt::make_salt_if_missing;
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha3::Sha3_512;

/// A derived key.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DerivedKey {
    /// The derived key.
    #[serde(skip)]
    pub key: Vec<u8>,
    /// The salt used to derive the key.
    pub salt: Vec<u8>,
}

impl DerivedKey {
    /// Helper function to derive a key.
    ///
    /// # Arguments
    ///
    /// * `password` - The password to derive the key from.
    /// * `salt` - The salt to use for the derivation. If `None`, a random salt will be generated.
    /// * `key_length` - The length of the key to derive.
    ///
    /// # Returns
    ///
    /// The derived key.
    fn derive_key(password: &[u8], salt: Option<&[u8]>, key_length: u8) -> Result<Self, String> {
        if password.is_empty() {
            return Err("Password cannot be empty".to_string());
        }
        if key_length <= 0 {
            return Err("Key length must be greater than 0".to_string());
        }

        let salt = make_salt_if_missing(salt);
        let hk = Hkdf::<Sha3_512>::new(Some(&salt), password);

        let mut okm = vec![0u8; key_length as usize];
        hk.expand(&[0u8], &mut okm).map_err(|err| err.to_string())?;

        Ok(DerivedKey {
            key: okm.to_vec(),
            salt,
        })
    }

    /// Derives a key from a password.
    ///
    /// # Arguments
    ///
    /// * `password` - The password to derive the key from.
    /// * `salt` - The salt to use for the derivation. If `None`, a random salt will be generated.
    /// * `key_length` - The length of the key to derive.
    ///
    /// # Returns
    ///
    /// The derived key.
    pub fn new(password: &str, salt: Option<&[u8]>, key_length: u8) -> Result<Self, String> {
        Self::derive_key(password.as_bytes(), salt, key_length)
    }

    /// Derives a key from a password.
    ///
    /// # Arguments
    ///
    /// * `password` - The password to derive the key from.
    /// * `salt` - The salt to use for the derivation. If `None`, a random salt will be generated.
    /// * `key_length` - The length of the key to derive.
    ///
    /// # Returns
    ///
    /// The derived key.
    pub fn from_byte_key(
        password: &[u8],
        salt: Option<&[u8]>,
        key_length: u8,
    ) -> Result<Self, String> {
        Self::derive_key(password, salt, key_length)
    }

    /// Derives a key from a password vector.
    ///
    /// # Arguments
    ///
    /// * `password` - The password to derive the key from.
    /// * `salt` - The salt to use for the derivation. If `None`, a random salt will be generated.
    /// * `key_length` - The length of the key to derive.
    ///
    /// # Returns
    ///
    /// The derived key.
    pub fn from_vec(
        password: Vec<u8>,
        salt: Option<&[u8]>,
        key_length: u8,
    ) -> Result<Self, String> {
        Self::derive_key(&password, salt, key_length)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_with_salt() {
        let password = "password";
        let key_length = 32;
        let salt = [0u8; 32];
        let derived_key = DerivedKey::new(password, Some(&salt), key_length).unwrap();
        assert_eq!(derived_key.key.len(), key_length as usize);
        assert_eq!(derived_key.salt, salt);
    }

    #[test]
    fn test_new_with_invalid_key_length() {
        let password = "password";
        let key_length = 0; // Invalid key length
        let result = DerivedKey::new(password, None, key_length);
        assert!(result.is_err());
    }

    #[test]
    fn test_from_byte_key_with_salt() {
        let password = b"password";
        let key_length = 32;
        let salt = [0u8; 32];
        let derived_key = DerivedKey::from_byte_key(password, Some(&salt), key_length).unwrap();
        assert_eq!(derived_key.key.len(), key_length as usize);
        assert_eq!(derived_key.salt, salt);
    }

    #[test]
    fn test_from_byte_key_with_invalid_key_length() {
        let password = b"password";
        let key_length = 0; // Invalid key length
        let result = DerivedKey::from_byte_key(password, None, key_length);
        assert!(result.is_err());
    }

    #[test]
    fn test_from_vec_with_salt() {
        let password = b"password".to_vec();
        let key_length = 32;
        let salt = [0u8; 32];
        let derived_key = DerivedKey::from_vec(password, Some(&salt), key_length).unwrap();
        assert_eq!(derived_key.key.len(), key_length as usize);
        assert_eq!(derived_key.salt, salt);
    }

    #[test]
    fn test_from_vec_with_invalid_key_length() {
        let password = b"password".to_vec();
        let key_length = 0; // Invalid key length
        let result = DerivedKey::from_vec(password, None, key_length);
        assert!(result.is_err());
    }

    #[test]
    fn test_multiple_derivation_with_different_salt() {
        let password = "password";
        let key_length = 32;
        let salt1 = [0u8; 32];
        let salt2 = [1u8; 32];

        let derived_key_1 = DerivedKey::new(password, Some(&salt1), key_length).unwrap();
        let derived_key_2 = DerivedKey::new(password, Some(&salt2), key_length).unwrap();

        assert_ne!(derived_key_1.key, derived_key_2.key);
        assert_ne!(derived_key_1.salt, derived_key_2.salt);
    }
}
