use crate::crypt::{CryptData, CryptDataMode, DerivedKey, ENCRYPTION_KEY_LENGTH};
use crate::state::state::{AppState, AppStateInnerKeys};
use crate::state::storage_provider::StorageProvider;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use tauri::State;

/// The data of a storage provider
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct ProviderData {
    /// The access token
    pub access_token: CryptData,
    /// The refresh token
    pub refresh_token: CryptData,
    /// The expiry date of the token (utc unix timestamp)
    pub expiry: u64,
    /// The owner of the token (email)
    pub owner: String,
    /// The provider of the token
    pub provider: StorageProvider,
}
