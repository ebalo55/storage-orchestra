use crate::state::storage_provider::StorageProvider;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// The general behaviour settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct GeneralBehaviour {
    /// The default page
    pub default_page: DefaultPageGroups,
    /// Whether to open files using the native application (if possible)
    ///
    /// This option requires 2 preconditions:
    ///  - a native application for the file type must be installed (such as word for .docx files)
    ///  - the provider must allow the file to be downloaded (example, onedrive for business may
    ///    not allow this)
    ///  - this optionally can install the ONLYOFFICE desktop editors
    ///    https://www.onlyoffice.com/download-desktop.aspx
    pub default_to_native_app: bool,
    /// Whether to default to the web editor if the provider supports it
    ///
    /// This option requires the provider to support a web editor, if the provider does not support
    /// a web editor, this option will be ignored
    pub default_to_web_editor: bool,
    /// Whether to compress files before uploading, this is a per-provider setting.
    /// Note that providers with editor and collaborative capabilities will be unable to read and
    /// use your files.
    pub compress_files: HashMap<StorageProvider, bool>,
}

/// The default page groups
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case")]
pub enum DefaultPageGroups {
    /// The general default page
    General(DefaultPageGeneralGroup),
    /// The provider default page
    Providers(ProviderPage),
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
    pub owner: String,
}
