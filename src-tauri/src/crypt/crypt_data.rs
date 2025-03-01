use crate::crypt::encoding::{decode, encode};
use crate::crypt::encryption::{decrypt, encrypt};
use crate::crypt::hash::hash;
use crate::crypt::{CryptDataMode, DerivedKey, ENCRYPTION_KEY_LENGTH, hmac};
use crate::state::PASSWORD;
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
use tauri::command;
use tracing::{debug, error};

/// Represent some data that have been managed cryptographically
#[derive(Clone, Default, Type, Eq)]
pub struct CryptData {
    /// The cryptographically modified data
    data: Vec<u8>,
    /// The raw data, never stored on disk (this field is never serialized)
    raw_data: Option<Vec<u8>>,
    /// The working mode of the data
    mode: u8,
    /// The salt applied when deriving the encryption key
    salt: Option<Vec<u8>>,
    /// The list of related keys in the parent struct, this is used to understand which values are
    /// required to (re-)compute the hash
    pub related_keys: Vec<String>,
}

impl PartialEq<Self> for CryptData {
    fn eq(&self, other: &Self) -> bool {
        self.data == other.data
            && self.mode == other.mode
            && self.salt == other.salt
            && self.related_keys == other.related_keys
    }
}

impl Serialize for CryptData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut this = self.clone();
        let mut state = serializer.serialize_struct("CryptData", 4)?;

        // If the data is already encoded or hashed, serialize it as a string
        if CryptDataMode::should_encode(this.mode)
            || CryptDataMode::should_hash(this.mode)
            || CryptDataMode::should_hmac(this.mode)
        {
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

        if let Some(salt) = &this.salt {
            state.serialize_field("salt", encode(salt).as_str())?;
        } else {
            state.serialize_field("salt", &None::<Vec<u8>>)?;
        }

        state.serialize_field("related_keys", &this.related_keys)?;

        state.end()
    }
}

impl<'ext_de> Deserialize<'ext_de> for CryptData {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'ext_de>,
    {
        #[derive(Deserialize)]
        #[serde(field_identifier, rename_all = "snake_case")]
        enum Field {
            Data,
            Mode,
            Salt,
            RelatedKeys,
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
                let mut salt = None;
                let mut related_keys = None;

                while let Some(key) = map.next_key()? {
                    match key {
                        Field::Data => {
                            data = Some(map.next_value::<String>()?);
                        }
                        Field::Mode => {
                            mode = Some(map.next_value::<u8>()?);
                        }
                        Field::Salt => {
                            salt = map.next_value::<Option<String>>()?;
                        }
                        Field::RelatedKeys => {
                            related_keys = Some(map.next_value::<Vec<String>>()?);
                        }
                    }
                }

                if data.is_none() {
                    return Err(serde::de::Error::missing_field("data"));
                }

                if mode.is_none() {
                    return Err(serde::de::Error::missing_field("mode"));
                }

                if related_keys.is_none() {
                    return Err(serde::de::Error::missing_field("related_keys"));
                }

                let data = data.unwrap();
                let mode = mode.unwrap();
                let related_keys = related_keys.unwrap();

                let mut crypt_data = CryptData::default();
                crypt_data.data = data.as_bytes().to_vec();
                crypt_data.mode = mode;
                crypt_data.raw_data = None;
                crypt_data.related_keys = related_keys;

                if salt.is_some() {
                    crypt_data.salt = Some(
                        decode(salt.unwrap().as_str()).map_err(|e| serde::de::Error::custom(e))?,
                    );
                }

                Ok(crypt_data)
            }
        }

        deserializer.deserialize_struct(
            "CryptData",
            &["mode", "data", "salt", "related_keys"],
            CryptDataVisitor,
        )
    }
}

impl Debug for CryptData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut pending_output = f.debug_struct("CryptData");
        pending_output.field("data", &self.data);

        #[cfg(debug_assertions)]
        pending_output.field("raw_data", &self.raw_data);
        #[cfg(not(debug_assertions))]
        pending_output.field("raw_data", &"<hidden>");

        pending_output
            .field("mode", &self.mode)
            .field("salt", &self.salt)
            .field("related_keys", &self.related_keys)
            .finish()
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

    /// Get the working mode of the data
    ///
    /// # Returns
    ///
    /// The working mode of the data
    pub fn get_modes(&self) -> Vec<CryptDataMode> {
        CryptDataMode::from_u8(self.mode)
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
    pub fn new(
        raw_data: Vec<u8>,
        mode: u8,
        key: Option<&[u8]>,
        related_keys: Option<Vec<String>>,
    ) -> Self {
        let mut instance = Self {
            raw_data: Some(raw_data),
            data: Vec::new(),
            mode,
            salt: None,
            related_keys: related_keys.unwrap_or_default(),
        };

        // Hash, encrypt, and encode the data if needed
        instance.hash();

        if key.is_some() {
            let key = key.unwrap();

            let _ = instance.hmac(key);
            let _ = instance.encrypt(key);
        }
        instance.encode();

        instance
    }

    /// HMAC the data if needed
    ///
    /// # Arguments
    ///
    /// * `key` - The key to use for HMACing
    ///
    /// # Returns
    ///
    /// Nothing
    fn hmac(&mut self, key: &[u8]) -> Result<(), String> {
        if CryptDataMode::should_hmac(self.mode) {
            debug!("Data is not HMACed, HMACing it");

            // Perform the HMAC
            self.data = hmac(&self.raw_data.as_ref().unwrap(), key, None)?.into_bytes();
            debug!("Data HMACed successfully");
        }

        Ok(())
    }

    /// Hash the data if needed
    ///
    /// # Returns
    ///
    /// Nothing
    fn hash(&mut self) {
        if CryptDataMode::should_hash(self.mode) {
            self.data = hash(&self.raw_data.as_ref().unwrap(), None).into_bytes();
        }
    }

    /// Encode the data if needed
    ///
    /// # Returns
    ///
    /// Nothing
    fn encode(&mut self) {
        if CryptDataMode::should_encode(self.mode) {
            debug!("Encoding data");

            let data = if CryptDataMode::should_encrypt(self.mode) {
                debug!("Encryption has been performed, using data from previous step(s)");
                &self.data
            } else {
                self.raw_data.as_ref().unwrap()
            };

            self.data = encode(data).as_bytes().to_vec();
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
            debug!("Data is not encrypted, encrypting it");

            // Derive the key using the salt if it exists or a new one will be generated during the process
            let derived_key = if let Some(salt) = &self.salt {
                DerivedKey::from_vec(key.to_vec(), Some(salt), ENCRYPTION_KEY_LENGTH as u8)?
            } else {
                DerivedKey::from_vec(key.to_vec(), None, ENCRYPTION_KEY_LENGTH as u8)?
            };
            debug!("Key derived successfully");

            // store the salt
            self.salt = Some(derived_key.salt);
            debug!("Salt stored");

            // finally perform the encryption
            self.data = encrypt(&self.raw_data.as_ref().unwrap(), &derived_key.key)?;
            debug!("Data encrypted successfully");
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
            debug!("Data is encrypted, decrypting it");

            if self.salt.is_none() {
                error!("Broken encryption, salt is missing");
                return Err("Broken encryption, salt is missing".to_owned());
            }
            let salt = self.salt.clone().unwrap();
            debug!("Salt correctly retrieved");

            debug!("Deriving key from salt");
            let derived_key =
                DerivedKey::from_vec(key.to_vec(), Some(&salt), ENCRYPTION_KEY_LENGTH as u8)?;
            debug!("Key derived successfully");

            let data = if CryptDataMode::should_encode(self.mode) {
                debug!("Data have been encoded, using data from previous step(s)");
                self.raw_data.as_ref().unwrap()
            } else {
                &self.data
            };

            self.raw_data = Some(decrypt(data, &derived_key.key)?);
            debug!("Data decrypted successfully");
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
            debug!("Data is encoded, decoding it");

            let string = String::from_utf8_lossy(&self.data).to_string();
            self.raw_data = Some(decode(string.as_str())?);

            debug!("Data decoded successfully");
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
            debug!("Raw data already set, returning it");
            Ok(self.raw_data.clone().unwrap())
        } else {
            // Otherwise, decode the data, decrypt it if needed, and return it
            self.decode()?;

            if key.is_some() {
                self.decrypt(key.unwrap())?;
            }

            if self.raw_data.is_none() {
                error!("Raw data unset, is this a hash?");
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
    debug!("Getting raw data as string from {:?}", data);
    let key = PASSWORD.get().ok_or("Password not set")?.read().await;

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
    debug!("Getting raw data from {:?}", data);
    let key = PASSWORD.get().ok_or("Password not set")?.read().await;

    Ok(data.get_raw_data(Some(key.as_bytes()))?)
}

/// Create a new CryptData struct using a fully qualified string
///
/// # Arguments
///
/// * `data` - The fully qualified string
///
/// # Returns
///
/// The CryptData struct
///
/// # Example
///
/// ```typescript
/// const data = "example string";
/// const qualified_data = StateMarker.asSecret(data);
///
/// const crypt_data = await invoke("make_crypt_data_from_qualified_string", {data: qualified_data});
/// ```
#[command]
#[specta]
pub async fn make_crypt_data_from_qualified_string(data: String) -> Result<CryptData, String> {
    debug!("Creating CryptData from qualified string");

    let mode = CryptDataMode::from_string_to_u8(data.as_str());
    debug!("Mode: {}", mode);

    let data = CryptDataMode::strip_string_mode(data.as_str())
        .as_bytes()
        .to_vec();

    if mode == 0 {
        return Err("No mode set".to_owned());
    }

    let key = PASSWORD.get().ok_or("Password not set")?.read().await;

    Ok(CryptData::new(data, mode, Some(key.as_bytes()), None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypt::verify;
    use tokio::sync::RwLock;

    #[test]
    fn test_new() {
        let data = vec![1, 2, 3];
        let mode = CryptDataMode::Encode as u8;
        let crypt_data = CryptData::new(data.clone(), mode, None, None);
        assert_eq!(crypt_data.raw_data.unwrap(), data);
        assert!(!crypt_data.data.is_empty());
        assert_eq!(crypt_data.mode, mode);
    }

    #[test]
    fn test_hash() {
        let data = CryptData::new(vec![1, 2, 3], CryptDataMode::Hash as u8, None, None);
        assert!(!data.data.is_empty());
        assert!(verify(
            vec![1, 2, 3].as_slice(),
            String::from_utf8_lossy(&data.data).to_string().as_str()
        ));
    }

    #[test]
    fn test_encode() {
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encode as u8, None, None);
        data.encode();
        assert!(!data.data.is_empty());
        assert_eq!("AQID", String::from_utf8_lossy(&data.data).to_string());
    }

    #[test]
    fn test_encrypt() {
        let key = b"supersecretkey";
        let data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        assert!(!data.data.is_empty());
        assert!(data.salt.is_some());
    }

    #[test]
    fn test_decrypt() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        data.decrypt(key).unwrap();
        assert_eq!(data.raw_data.unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn test_get_raw_data() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        let raw_data = data.get_raw_data(Some(key)).unwrap();
        assert_eq!(raw_data, vec![1, 2, 3]);
    }

    #[test]
    fn test_get_raw_data_as_string() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(
            b"test string".to_vec(),
            CryptDataMode::Encrypt as u8,
            Some(key),
            None,
        );
        let raw_data_str = data.get_raw_data_as_string(Some(key)).unwrap();
        assert_eq!(raw_data_str, "test string");
    }

    #[test]
    fn test_get_raw_data_with_secret_mode() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(
            vec![1, 2, 3],
            CryptDataMode::to_u8(vec![CryptDataMode::Encode, CryptDataMode::Encrypt]),
            Some(key),
            None,
        );
        let raw_data = data.get_raw_data(Some(key)).unwrap();
        assert_eq!(raw_data, vec![1, 2, 3]);
    }

    #[test]
    fn test_get_raw_data_as_string_with_secret_mode() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(
            b"test string".to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Encode, CryptDataMode::Encrypt]),
            Some(key),
            None,
        );
        let raw_data_str = data.get_raw_data_as_string(Some(key)).unwrap();
        assert_eq!(raw_data_str, "test string");
    }

    #[test]
    fn test_can_get_raw_data_multiple_times() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(
            b"test string".to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Encode, CryptDataMode::Encrypt]),
            Some(key),
            None,
        );
        let raw_data_str = data.get_raw_data_as_string(Some(key)).unwrap();
        assert_eq!(raw_data_str, "test string");
        let raw_data_str_2 = data.get_raw_data_as_string(Some(key)).unwrap();
        assert_eq!(raw_data_str_2, "test string");
    }

    #[tokio::test]
    async fn test_make_crypt_data_from_qualified_string() {
        let key = b"supersecretkey";
        let _ = PASSWORD.set(RwLock::new(String::from_utf8_lossy(key).to_string()));

        let qualified_data = "secret:test string".to_owned();
        let mut crypt_data = make_crypt_data_from_qualified_string(qualified_data)
            .await
            .unwrap();
        let raw_data_str = crypt_data.get_raw_data_as_string(Some(key)).unwrap();
        assert_eq!(raw_data_str, "test string");
    }

    #[tokio::test]
    async fn test_crypt_data_get_raw_data_as_string() {
        let key = b"supersecretkey";
        let _ = PASSWORD.set(RwLock::new(String::from_utf8_lossy(key).to_string()));

        let qualified_data = "secret:test string".to_owned();
        let crypt_data = make_crypt_data_from_qualified_string(qualified_data)
            .await
            .unwrap();
        let raw_data_str = crypt_data_get_raw_data_as_string(crypt_data).await.unwrap();
        assert_eq!(raw_data_str, "test string");
    }

    #[tokio::test]
    async fn test_crypt_data_get_raw_data() {
        let key = b"supersecretkey";
        let _ = PASSWORD.set(RwLock::new(String::from_utf8_lossy(key).to_string()));

        let qualified_data = "secret:test string".to_owned();
        let crypt_data = make_crypt_data_from_qualified_string(qualified_data)
            .await
            .unwrap();
        let raw_data = crypt_data_get_raw_data(crypt_data).await.unwrap();
        assert_eq!(raw_data, "test string".as_bytes());
    }

    #[test]
    fn test_serialize() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(
            b"test string".to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Encode, CryptDataMode::Encrypt]),
            Some(key),
            None,
        );
        let serialized = serde_json::to_string(&data).unwrap();
        let mut deserialized = serde_json::from_str::<CryptData>(serialized.as_str()).unwrap();

        assert_eq!(data.data, deserialized.data);
        assert_eq!(data.salt, deserialized.salt);
        assert_eq!(data.mode, deserialized.mode);

        let original_raw_data = data.get_raw_data(Some(key)).unwrap();
        let deserialized_raw_data = deserialized.get_raw_data(Some(key)).unwrap();
        assert_eq!(original_raw_data, deserialized_raw_data);
    }

    #[test]
    fn test_new_with_key() {
        let data = vec![1, 2, 3];
        let mode = CryptDataMode::Encode as u8;
        let key = b"supersecretkey";
        let crypt_data = CryptData::new(data.clone(), mode, Some(key), None);
        assert_eq!(crypt_data.raw_data.unwrap(), data);
        assert!(!crypt_data.data.is_empty());
        assert_eq!(crypt_data.mode, mode);
    }

    #[test]
    fn test_hmac() {
        let key = b"supersecretkey";
        let data = CryptData::new(vec![1, 2, 3], CryptDataMode::Hmac as u8, Some(key), None);
        assert!(!data.data.is_empty());
    }

    #[test]
    fn test_hash_with_salt() {
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Hash as u8, None, None);
        data.salt = Some(vec![4, 5, 6]);
        data.hash();
        assert!(!data.data.is_empty());
    }

    #[test]
    fn test_encode_with_encryption() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        data.encode();
        assert!(!data.data.is_empty());
    }

    #[test]
    fn test_encrypt_with_salt() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        data.salt = Some(vec![4, 5, 6]);
        data.encrypt(key).unwrap();
        assert!(!data.data.is_empty());
    }

    #[test]
    fn test_decrypt_without_salt() {
        let key = b"supersecretkey";
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encrypt as u8, Some(key), None);
        data.salt = None;
        let result = data.decrypt(key);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_with_invalid_data() {
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encode as u8, None, None);
        data.data = vec![255, 255, 255]; // Invalid base64 data
        let result = data.decode();
        assert!(result.is_err());
    }

    #[test]
    fn test_get_raw_data_without_key() {
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encode as u8, None, None);
        let raw_data = data.get_raw_data(None).unwrap();
        assert_eq!(raw_data, vec![1, 2, 3]);
    }

    #[test]
    fn test_get_raw_data_as_string_without_key() {
        let mut data = CryptData::new(vec![1, 2, 3], CryptDataMode::Encode as u8, None, None);
        let raw_data_str = data.get_raw_data_as_string(None).unwrap();
        assert_eq!(raw_data_str.as_bytes(), &[1, 2, 3]);
    }
}
