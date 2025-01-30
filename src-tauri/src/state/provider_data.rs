use async_trait::async_trait;
use crate::crypt::{CryptData, CryptDataMode, DerivedKey, ENCRYPTION_KEY_LENGTH};
use crate::state::state::{AppState, AppStateInnerKeys};
use crate::state::storage_provider::StorageProvider;
use crate::state::traits::FromStatefulJson;
use serde::{Deserialize, Serialize};
use specta::{specta, Type};
use tauri::State;

/// The data of a storage provider
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct ProviderData {
    /// The access token
    access_token: CryptData,
    /// The refresh token
    refresh_token: CryptData,
    /// The expiry date of the token (utc unix timestamp)
    expiry: u64,
    /// The owner of the token (email)
    owner: String,
    /// The provider of the token
    provider: StorageProvider,
    /// The salt used to derive the encryption key
    salt: CryptData,
}

impl ProviderData {
    /// Converts the data from the frontend to the backend format
    ///
    /// # Arguments
    ///
    /// * `value` - The data from the frontend
    /// * `key` - The key to decrypt the data
    ///
    /// # Returns
    ///
    /// The data in the backend format
    fn from_fe_data(value: FEProviderData, key: Vec<u8>) -> Result<Self, String> {
        // derive the key to the correct length for encryption
        let derived_key = DerivedKey::from_vec(key, None, ENCRYPTION_KEY_LENGTH as u8)?;

        let access_token = value.access_token.as_str();
        let refresh_token = value.refresh_token.as_str();
        Ok(Self {
            access_token: CryptData::new(
                CryptDataMode::strip_string_mode(access_token)
                    .as_bytes()
                    .to_vec(),
                CryptDataMode::from_string_to_u8(access_token),
                Some(derived_key.key.as_slice()),
            ),
            refresh_token: CryptData::new(
                CryptDataMode::strip_string_mode(refresh_token)
                    .as_bytes()
                    .to_vec(),
                CryptDataMode::from_string_to_u8(refresh_token),
                Some(derived_key.key.as_slice()),
            ),
            expiry: value.expiry,
            owner: value.owner,
            provider: value.provider,
            salt: CryptData::new(
                derived_key.salt,
                CryptDataMode::to_u8(vec![CryptDataMode::Encode]),
                None,
            ),
        })
    }
}

#[async_trait]
impl FromStatefulJson<Vec<Self>> for ProviderData {
    async fn from_stateful_json(
        state: State<'_, AppState>,
        value: serde_json::Value,
        key: AppStateInnerKeys,
    ) -> Result<Vec<Self>, String> {
        // get the password from the state, this is needed to encrypt the data
        let mut readable_state = state.write().await;
        let password = readable_state.password.get_raw_data(None)?;
        drop(readable_state);

        let fe_data = FEProviderData::from_stateful_json(state, value, key).await?;

        // convert the data to the backend format
        let data = fe_data
            .into_iter()
            .map(|value| -> Result<ProviderData, String> {
                Ok(Self::from_fe_data(value, password.clone())?)
            })
            .collect::<Vec<Result<ProviderData, String>>>();

        // check if all the data were parsed correctly (if not, return the error)
        let mut writable_data = Vec::new();
        for value in data {
            writable_data.push(value?);
        }

        Ok(writable_data)
    }
}

/// The data of a storage provider
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FEProviderData {
    /// The access token
    access_token: String,
    /// The refresh token
    refresh_token: String,
    /// The expiry date of the token (utc unix timestamp)
    expiry: u64,
    /// The owner of the token (email)
    owner: String,
    /// The provider of the token
    provider: StorageProvider,
}

impl TryFrom<serde_json::Value> for FEProviderData {
    type Error = String;

    fn try_from(value: serde_json::Value) -> Result<Self, Self::Error> {
        let access_token = value["access_token"]
            .as_str()
            .ok_or("access_token is missing")?;
        let refresh_token = value["refresh_token"]
            .as_str()
            .ok_or("refresh_token is missing")?;
        let expiry = value["expiry"].as_u64().ok_or("expiry is missing")?;
        let owner = value["owner"].as_str().ok_or("owner is missing")?;
        let provider = value["provider"].as_str().ok_or("provider is missing")?;

        Ok(Self {
            access_token: access_token.to_string(),
            refresh_token: refresh_token.to_string(),
            expiry,
            owner: owner.to_string(),
            provider: StorageProvider::try_from(provider)?,
        })
    }
}

#[async_trait]
impl FromStatefulJson<Vec<Self>> for FEProviderData {
    async fn from_stateful_json(
        _state: State<'_, AppState>,
        value: serde_json::Value,
        key: AppStateInnerKeys,
    ) -> Result<Vec<Self>, String> {
        // cast the data to an array
        let value = value.as_array().ok_or(format!(
            "Invalid data provided for key '{}', array expected",
            key
        ))?;

        // try to parse the data into a vector of FEProviderData
        let data = value
            .into_iter()
            .map(|value| -> Result<FEProviderData, String> {
                // try to parse the data
                Ok(Self::try_from(value.clone()).map_err(|e| e.to_string())?)
            })
            .collect::<Vec<Result<FEProviderData, String>>>();

        // check if all the data were parsed correctly (if not, return the error)
        let mut parsed_data = Vec::new();
        for value in data {
            parsed_data.push(value?);
        }

        Ok(parsed_data)
    }
}
