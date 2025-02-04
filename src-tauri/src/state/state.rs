use crate::crypt::CryptData;
use crate::state::provider_data::ProviderData;
use crate::state::settings::Settings;
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
    /// The settings of the application
    pub settings: Settings,
}

pub type AppState = RwLock<AppStateInner>;

impl AppStateInner {
    /// Count the number of instances of crypt data in the state
    pub fn count_crypt_data_instances(&self) -> u32 {
        let mut count = 0u32;

        let default_crypt_data = CryptData::default();

        if self.password != default_crypt_data {
            count += 1;
        }

        for provider in self.providers.iter() {
            if provider.access_token != default_crypt_data {
                count += 1;
            }

            if provider.refresh_token != default_crypt_data {
                count += 1;
            }
        }

        if self.settings.security.signature != default_crypt_data {
            count += 1;
        }

        if let Some(_) = self.settings.security.two_factor_authentication.secret {
            count += 1;
        }

        count
    }

    /// Get a mutable iterator over the crypt data instances
    ///
    /// # Returns
    ///
    /// Returns a mutable iterator over the crypt data instances
    pub fn iter_mut(&mut self) -> AppStateInnerIterMut {
        AppStateInnerIterMut::new(self)
    }
}

pub struct AppStateInnerIterMut<'a> {
    inner: Box<&'a mut AppStateInner>,
}

impl<'a> AppStateInnerIterMut {
    pub fn new(inner: &'a mut AppStateInner) -> Self {
        Self {
            inner: Box::new(inner),
        }
    }
}

impl<'a> Iterator for AppStateInnerIterMut {
    type Item = &'a mut CryptData;

    fn next(&mut self) -> Option<Self::Item> {
        let default_crypt_data = CryptData::default();

        if self.inner.password != default_crypt_data {
            return Some(&mut self.inner.password);
        }

        for mut provider in self.inner.providers.iter_mut() {
            if provider.access_token != default_crypt_data {
                return Some(&mut provider.access_token);
            }

            if provider.refresh_token != default_crypt_data {
                return Some(&mut provider.refresh_token);
            }
        }

        if self.inner.settings.security.signature != default_crypt_data {
            return Some(&mut self.inner.settings.security.signature);
        }

        if let Some(secret) = self
            .inner
            .settings
            .security
            .two_factor_authentication
            .secret
            .as_mut()
        {
            return Some(secret);
        }

        None
    }
}
