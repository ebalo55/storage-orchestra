use serde::{Deserialize, Serialize};
use specta::Type;

/// The available storage providers
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type, Eq, PartialEq, Hash)]
pub enum StorageProvider {
    #[serde(rename = "unrecognized")]
    #[default]
    Unrecognized,
    #[serde(rename = "google")]
    Google,
    #[serde(rename = "dropbox")]
    Dropbox,
    #[serde(rename = "onedrive")]
    OneDrive,
    #[serde(rename = "terabox")]
    Terabox,
}

impl TryFrom<&str> for StorageProvider {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "google" => Ok(Self::Google),
            "dropbox" => Ok(Self::Dropbox),
            "onedrive" => Ok(Self::OneDrive),
            "terabox" => Ok(Self::Terabox),
            _ => Err(format!("{} is not a valid provider", value)),
        }
    }
}
