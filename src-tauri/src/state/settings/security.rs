use crate::crypt::CryptData;
use as_inner_serializable::AsInnerSerializable;
use educe::Educe;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Type, Default, AsInnerSerializable)]
pub struct Security {
    /// The encryption settings
    pub encryption: EncryptionSettings,
    /// The two-factor authentication settings
    pub two_factor_authentication: TwoFactorAuthentication,
    /// The state file signature, this is used to verify the integrity of the state file.
    pub signature: Arc<RwLock<CryptData>>,
}

/// The encryption settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Educe)]
#[educe(Default)]
pub struct EncryptionSettings {
    /// Whether to encrypt the state file.
    pub encrypt_state: bool,
    /// Whether to compress the state file.
    pub compress_state: bool,
}

/// The two factor authentication settings
#[derive(Debug, Clone, Type, Default, AsInnerSerializable)]
pub struct TwoFactorAuthentication {
    /// Whether to use two factor authentication
    pub enabled: bool,
    /// The two factor authentication secret
    pub secret: Option<Arc<RwLock<CryptData>>>,
}
