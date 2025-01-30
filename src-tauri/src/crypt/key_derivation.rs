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
        let salt = make_salt_if_missing(salt);
        let hk = Hkdf::<Sha3_512>::new(Some(&salt), password.as_bytes());

        let mut okm = vec![0u8; key_length as usize];
        hk.expand(&[0u8], &mut okm).map_err(|err| err.to_string())?;

        Ok(DerivedKey {
            key: okm,
            salt: salt.to_vec(),
        })
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
    pub fn from_vec(password: Vec<u8>, salt: Option<&[u8]>, key_length: u8) -> Result<Self, String> {
        let password = String::from_utf8_lossy(password.as_slice()).to_string();
        DerivedKey::new(password.as_str(), salt, key_length)
    }

    /// Restores the derived key from a password.
    ///
    /// # Arguments
    ///
    /// * `password` - The password to restore the key from.
    /// * `key_length` - The length of the key to derive.
    ///
    /// # Returns
    ///
    /// The restored derived key.
    pub fn restore(&mut self, password: &str, key_length: u8) -> Result<(), String> {
        let instance = DerivedKey::new(password, Some(self.salt.as_slice()), key_length)?;
        self.key = instance.key;

        Ok(())
    }
}
