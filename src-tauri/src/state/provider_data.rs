use crate::crypt::CryptData;
use crate::state::storage_provider::StorageProvider;
use as_inner_serializable::AsInnerSerializable;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tokio::sync::RwLock;

/// The data of a storage provider
#[derive(Debug, Clone, Default, Type, AsInnerSerializable)]
pub struct ProviderData {
    /// The access token
    pub access_token: Arc<RwLock<CryptData>>,
    /// The refresh token
    pub refresh_token: Arc<RwLock<CryptData>>,
    /// The expiry date of the token (utc unix timestamp)
    pub expiry: u64,
    /// The owner of the token (email)
    pub owner: String,
    /// The provider of the token
    pub provider: StorageProvider,
}
