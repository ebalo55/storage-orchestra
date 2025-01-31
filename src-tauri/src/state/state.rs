use crate::crypt::CryptData;
use crate::state::provider_data::ProviderData;
use crate::utility::debounced_saver::DebouncedSaver;
use as_result_enum::AsResultEnum;
use key_as_enum::KeysAsEnum;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::async_runtime::RwLock;

pub static STATE_FILE: &str = "state.json";

#[derive(Debug, Default, Serialize, Deserialize, Clone, KeysAsEnum, AsResultEnum)]
#[derive_extra(Type)]
pub struct AppStateInner {
    /// The debounced saver
    #[serde(skip)]
    pub debounced_saver: DebouncedSaver,
    /// The password to access the secure storage
    pub password: CryptData,
    /// The list of providers
    pub providers: Vec<ProviderData>,
}

pub type AppState = RwLock<AppStateInner>;
