use crate::crypt::CryptData;
use crate::state::provider_data::ProviderData;
use crate::state::settings::Settings;
use crate::utility::debounced_saver::DebouncedSaver;
use as_inner_serializable::AsInnerSerializable;
use as_result_enum::AsResultEnum;
use key_as_enum::KeysAsEnum;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::rc::Rc;
use std::sync::Arc;
use tauri::async_runtime::RwLock;

pub static STATE_FILE: &str = "state.json";

#[derive(Debug, Default, Clone, AsInnerSerializable, KeysAsEnum, AsResultEnum)]
#[derive_extra(Type)]
pub struct AppStateDeep {
    /// The debounced saver
    #[serde(skip)]
    pub debounced_saver: DebouncedSaver,
    /// The password to access the secure storage
    pub password: Arc<RwLock<CryptData>>,
    /// The list of providers
    pub providers: Vec<ProviderData>,
    /// The settings of the application
    pub settings: Settings,
}

pub type AppState = RwLock<AppStateDeep>;
