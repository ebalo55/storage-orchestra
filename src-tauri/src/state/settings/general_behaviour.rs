use serde::{Deserialize, Serialize};
use specta::Type;
use crate::state::storage_provider::StorageProvider;

/// The general behaviour settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct GeneralBehaviour {
    /// The default page
    pub default_page: DefaultPageGroups,
}

/// The default page groups
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case")]
pub enum DefaultPageGroups {
    /// The general default page
    General(DefaultPageGeneralGroup),
    /// The provider default page
    Providers(ProviderPage)
}

impl Default for DefaultPageGroups {
    fn default() -> Self {
        DefaultPageGroups::General(DefaultPageGeneralGroup::default())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum DefaultPageGeneralGroup {
    /// The dashboard page
    #[default]
    Dashboard,
    /// The all my drives page
    AllMyDrives,
    /// The settings page
    Settings,
}

/// A provider page
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct ProviderPage {
    /// The storage provider
    pub provider: StorageProvider,
    /// The owner of the provider
    pub owner: String
}