use crate::crypt::CryptData;
use educe::Educe;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct Security {
    /// The password hint, this is used to help the user remember their password.
    /// This will be shown on every login screen.
    pub password_hint: Option<String>,
    /// The encryption settings
    pub encryption: EncryptionSettings,
    /// The two-factor authentication settings
    pub two_factor_authentication: TwoFactorAuthentication,
    /// The state file signature, this is used to verify the integrity of the state file.
    pub signature: CryptData,
}

/// The encryption settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Educe)]
#[educe(Default)]
pub struct EncryptionSettings {
    /// Whether to use advanced encryption.
    /// Advanced encryption is the default option based on XChaCha20-Poly1305.
    /// Data:
    ///  - key: 256 bits (32 bytes)
    ///  - nonce: 192 bits (24 bytes)
    ///  - tag: 128 bits (16 bytes)
    /// Notes:
    ///  - Implemented in TLS
    ///  - Generally considered "more" secure than AES-GCM due to the longer nonce
    ///  - Not a NIST standard
    ///  - Very low probability of nonce reuse
    #[educe(Default = true)]
    pub advanced_encryption: bool,
    /// Whether to use military grade encryption.
    /// Military grade encryption is based on AES-256-GCM (SIV mode, https://en.wikipedia.org/wiki/AES-GCM-SIV).
    /// Data:
    ///  - key: 256 bits (32 bytes)
    ///  - nonce: 96 bits (12 bytes)
    ///  - tag: 128 bits (16 bytes)
    /// Notes:
    ///  - NIST accepted security standard
    ///  - Used by the US government to protect classified information
    ///  - Notably shorter nonce than XChaCha20-Poly1305
    ///  - Higher probability of nonce reuse
    pub military_grade_encryption: bool,
    /// Whether to encrypt the state file.
    pub encrypt_state: bool,
    /// Whether to compress the state file.
    pub compress_state: bool,
}

/// The two factor authentication settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct TwoFactorAuthentication {
    /// Whether to use two factor authentication
    pub enabled: bool,
    /// The two factor authentication secret
    pub secret: Option<CryptData>,
}
