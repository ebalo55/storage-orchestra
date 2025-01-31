use crate::crypt::encoding::{decode, encode};
use crate::crypt::encryption::{decrypt, encrypt};
use crate::crypt::hash::hash;
use crate::state::PASSWORD;
use crate::state::state::AppState;
use base64ct::Encoding;
use chacha20poly1305::KeyInit;
use chacha20poly1305::aead::Aead;
use serde::de::Visitor;
use serde::ser::SerializeStruct;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sha3::Digest;
use specta::{Type, specta};
use std::cmp::PartialEq;
use std::fmt::{Debug, Formatter};
use tauri::{State, command};

/// Define the working modes of the CryptData struct
#[derive(Debug, PartialEq, Eq)]
pub enum CryptDataMode {
    Hash = 0b001,
    Encode = 0b010,
    Encrypt = 0b100,
    ModifiedDuringSerialization = 0b1000_0000,
}

impl CryptDataMode {
    pub fn strip_string_mode(mode: &str) -> &str {
        if mode.starts_with("hash:") {
            return mode.strip_prefix("hash:").unwrap();
        }
        if mode.starts_with("encode:") {
            return mode.strip_prefix("encode:").unwrap();
        }
        if mode.starts_with("secret:") {
            return mode.strip_prefix("secret:").unwrap();
        }

        mode
    }
    /// Convert a u8 to the working modes
    ///
    /// # Arguments
    ///
    /// * `mode` - The u8 representation of the working modes
    ///
    /// # Returns
    ///
    /// The working modes
    pub fn from_u8(mode: u8) -> Vec<Self> {
        let mut modes = Vec::new();

        if Self::should_hash(mode) {
            modes.push(CryptDataMode::Hash);
        }
        if Self::should_encode(mode) {
            modes.push(CryptDataMode::Encode);
        }
        if Self::should_encrypt(mode) {
            modes.push(CryptDataMode::Encrypt);
        }
        if Self::has_been_modified_during_serialization(mode) {
            modes.push(CryptDataMode::ModifiedDuringSerialization);
        }

        modes
    }

    /// Convert the working modes to a u8
    ///
    /// # Arguments
    ///
    /// * `modes` - The working modes
    ///
    /// # Returns
    ///
    /// The u8 representation of the working modes
    pub fn to_u8(modes: Vec<Self>) -> u8 {
        let mut mode = 0;

        for m in modes {
            mode |= m as u8;
        }

        mode
    }

    /// Check if the data should be hashed
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be hashed
    pub fn should_hash(mode: u8) -> bool {
        mode & CryptDataMode::Hash as u8 != 0
    }

    /// Check if the data should be encoded
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be encoded
    pub fn should_encode(mode: u8) -> bool {
        mode & CryptDataMode::Encode as u8 != 0
    }

    /// Check if the data should be encrypted
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be encrypted
    pub fn should_encrypt(mode: u8) -> bool {
        mode & CryptDataMode::Encrypt as u8 != 0
    }

    /// Convert a string to the working modes
    ///
    /// # Arguments
    ///
    /// * `mode` - A string containing a prefixed working mode
    pub fn from_string(mode: &str) -> Vec<Self> {
        let mut modes = Vec::new();

        if mode.starts_with("hash:") {
            modes.push(CryptDataMode::Hash);
        }
        if mode.starts_with("encode:") {
            modes.push(CryptDataMode::Encode);
        }
        if mode.starts_with("secret:") {
            modes.push(CryptDataMode::Encrypt);
            modes.push(CryptDataMode::Encode);
        }

        modes
    }

    /// Convert a string to the working mode value
    ///
    /// # Arguments
    ///
    /// * `mode` - A string containing a prefixed working mode
    ///
    /// # Returns
    ///
    /// The working mode value
    pub fn from_string_to_u8(mode: &str) -> u8 {
        let modes = Self::from_string(mode);
        Self::to_u8(modes)
    }

    /// Check if the data has been modified during serialization
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data has been modified during serialization
    pub fn has_been_modified_during_serialization(mode: u8) -> bool {
        mode & CryptDataMode::ModifiedDuringSerialization as u8 != 0
    }
}

/// Represent some data that have been managed cryptographically
#[derive(Clone, Default, Type)]
pub struct CryptData {
    /// The cryptographically modified data
    data: Vec<u8>,
    /// The raw data, never stored on disk (this field is never serialized)
    raw_data: Option<Vec<u8>>,
    /// The working mode of the data
    mode: u8,
}

impl Serialize for CryptData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut this = self.clone();
        let mut state = serializer.serialize_struct("CryptData", 2)?;

        // If the data is already encoded or hashed, serialize it as a string
        if CryptDataMode::should_encode(this.mode) || CryptDataMode::should_hash(this.mode) {
            let data = String::from_utf8_lossy(&this.data).to_string();
            state.serialize_field("data", data.as_str())?;
        } else {
            // Otherwise, encode the data and serialize it as a string
            let mut current_mode = CryptDataMode::from_u8(this.mode);
            current_mode.push(CryptDataMode::Encode);
            current_mode.push(CryptDataMode::ModifiedDuringSerialization);

            // Update the mode to include the encoding
            this.mode = CryptDataMode::to_u8(current_mode);

            // Encode the data
            state.serialize_field("data", encode(&this.data).as_str())?;
        }

        state.serialize_field("mode", &this.mode)?;
        state.end()
    }
}

impl<'ext_de> Deserialize<'ext_de> for CryptData {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'ext_de>,
    {
        #[derive(Deserialize)]
        #[serde(field_identifier, rename_all = "lowercase")]
        enum Field {
            Data,
            Mode,
        };

        struct CryptDataVisitor;
        impl<'de> Visitor<'de> for CryptDataVisitor {
            type Value = CryptData;

            fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
                formatter.write_str("struct CryptData")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: serde::de::MapAccess<'de>,
            {
                let mut data = None;
                let mut mode = None;

                while let Some(key) = map.next_key()? {
                    match key {
                        Field::Data => {
                            data = Some(map.next_value::<String>()?);
                        }
                        Field::Mode => {
                            mode = Some(map.next_value::<u8>()?);
                        }
                    }
                }

                if data.is_none() {
                    return Err(serde::de::Error::missing_field("data"));
                }

                if mode.is_none() {
                    return Err(serde::de::Error::missing_field("mode"));
                }

                let data = data.unwrap();
                let mode = mode.unwrap();

                let mut crypt_data = CryptData::default();
                crypt_data.data = data.as_bytes().to_vec();
                crypt_data.mode = mode;

                Ok(crypt_data)
            }
        }

        deserializer.deserialize_struct("CryptData", &["mode", "data"], CryptDataVisitor)
    }
}

impl Debug for CryptData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut pending_output = f.debug_struct("CryptData");
        pending_output.field("data", &self.data);

        #[cfg(debug_assertions)]
        pending_output.field("raw_data", &self.raw_data);
        #[cfg(not(debug_assertions))]
        pending_output.field("raw_data", &"<hidden>");

        pending_output.field("mode", &self.mode).finish()
    }
}

impl CryptData {
    /// Get modified data, this may be encrypted, hashed or encoded
    ///
    /// # Returns
    ///
    /// The modified data
    pub fn get_data(&self) -> Vec<u8> {
        self.data.clone()
    }

    /// Get modified data (that may be encrypted, hashed or encoded) as a string
    ///
    /// # Returns
    ///
    /// The modified data as a string
    pub fn get_data_as_string(&self) -> String {
        String::from_utf8_lossy(&self.data).to_string()
    }

    /// Create a new CryptData struct
    ///
    /// # Arguments
    ///
    /// * `data` - The data to manage
    /// * `mode` - The working mode of the data
    /// * `key` - The key to use for encryption and decryption (optional)
    ///
    /// # Returns
    ///
    /// The CryptData struct
    pub fn new(raw_data: Vec<u8>, mode: u8, key: Option<&[u8]>) -> Self {
        let mut instance = Self {
            raw_data: Some(raw_data),
            data: Vec::new(),
            mode,
        };

        // Hash, encrypt, and encode the data if needed
        instance.hash();
        if key.is_some() {
            let _ = instance.encrypt(key.unwrap());
        }
        instance.encode();

        instance
    }

    /// Hash the data if needed
    ///
    /// # Returns
    ///
    /// Nothing
    fn hash(&mut self) {
        if CryptDataMode::should_hash(self.mode) {
            self.data = hash(&self.raw_data.as_ref().unwrap(), None)
                .as_bytes()
                .to_vec();
        }
    }

    /// Encode the data if needed
    ///
    /// # Returns
    ///
    /// Nothing
    fn encode(&mut self) {
        if CryptDataMode::should_encode(self.mode) {
            self.data = encode(&self.raw_data.as_ref().unwrap()).as_bytes().to_vec();
        }
    }

    /// Encrypt the data if needed
    ///
    /// # Arguments
    ///
    /// * `key` - The key to use for encryption
    ///
    /// # Returns
    ///
    /// Nothing
    fn encrypt(&mut self, key: &[u8]) -> Result<(), String> {
        if CryptDataMode::should_encrypt(self.mode) {
            self.data = encrypt(&self.raw_data.as_ref().unwrap(), &key)?;
        }

        Ok(())
    }

    /// Decrypt the data if needed
    ///
    /// # Arguments
    ///
    /// * `key` - The key to use for decryption
    ///
    /// # Returns
    ///
    /// Nothing
    fn decrypt(&mut self, key: &[u8]) -> Result<(), String> {
        if CryptDataMode::should_encrypt(self.mode) {
            self.raw_data = Some(decrypt(&self.data, &key)?);
        }

        Ok(())
    }

    /// Decode the data if needed
    ///
    /// # Returns
    ///
    /// Nothing
    fn decode(&mut self) -> Result<(), String> {
        if CryptDataMode::should_encode(self.mode) {
            let string = String::from_utf8_lossy(&self.data).to_string();
            self.raw_data = Some(decode(string.as_str())?);
        }

        Ok(())
    }

    /// Get the raw data
    ///
    /// # Arguments
    ///
    /// * `key` - The key to use for decryption (optional)
    ///
    /// # Returns
    ///
    /// The raw data
    pub fn get_raw_data(&mut self, key: Option<&[u8]>) -> Result<Vec<u8>, String> {
        // If the raw data is already set, return it
        if self.raw_data.is_some() {
            Ok(self.raw_data.clone().unwrap())
        } else {
            // Otherwise, decode the data, decrypt it if needed, and return it
            self.decode()?;

            if key.is_some() {
                self.decrypt(key.unwrap())?;
            }

            if self.raw_data.is_none() {
                return Err("Raw data unset, is this a hash?".to_owned());
            }

            Ok(self.raw_data.clone().unwrap())
        }
    }

    /// Get the raw data as a string
    ///
    /// # Arguments
    ///
    /// * `key` - The key to use for decryption (optional)
    ///
    /// # Returns
    ///
    /// The raw data as a string
    pub fn get_raw_data_as_string(&mut self, key: Option<&[u8]>) -> Result<String, String> {
        let raw_data = self.get_raw_data(key)?;
        Ok(String::from_utf8_lossy(&raw_data).to_string())
    }
}

/// Get the raw data as a string
///
/// # Arguments
///
/// * `state` - The state to get the data from
/// * `data` - The data to get
///
/// # Returns
///
/// The raw data as a string
#[command]
#[specta]
pub async fn crypt_data_get_raw_data_as_string(mut data: CryptData) -> Result<String, String> {
    let key = PASSWORD.get().ok_or("Password not set")?;

    Ok(data.get_raw_data_as_string(Some(key.as_bytes()))?)
}

/// Get the raw data
///
/// # Arguments
///
/// * `state` - The state to get the data from
/// * `data` - The data to get
///
/// # Returns
///
/// The raw data
#[command]
#[specta]
pub async fn crypt_data_get_raw_data(mut data: CryptData) -> Result<Vec<u8>, String> {
    let key = PASSWORD.get().ok_or("Password not set")?;

    Ok(data.get_raw_data(Some(key.as_bytes()))?)
}
