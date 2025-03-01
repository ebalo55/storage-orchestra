use crate::crypt;
use crate::crypt::{CryptData, CryptDataMode, verify_hmac};
use crate::state::settings::{Settings, SettingsResult};
use crate::state::state::{
    AppState, AppStateDeep, AppStateDeepKeys, AppStateDeepResult, STATE_FILE,
};
use once_cell::sync::OnceCell;
use specta::specta;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State, command};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use tracing::debug;

/// The password for the application secure storage.
///
/// This is currently stored in plain text in memory.
/// TODO: Implement a secret manager to store the password securely while the application is running.
pub static PASSWORD: OnceCell<RwLock<String>> = OnceCell::new();

/// Sets the password for the application secure storage.
///
/// # Arguments
///
/// * `password` - The password to set.
///
/// # Returns
///
/// Nothing.
#[command]
#[specta]
pub async fn init_state(
    app: AppHandle,
    state: State<'_, AppState>,
    password: String,
) -> Result<(), String> {
    let resolver = app.path();
    let state_file = resolver
        .resolve(STATE_FILE, BaseDirectory::AppLocalData)
        .map_err(|e| e.to_string())?;

    // check if the state file exists
    if state_file.exists() {
        let stored_state = check_password(password.clone(), state_file).await?;

        // set the password
        let mut writable_state = state.write().await;
        *writable_state = stored_state;

        // update the password in the state to ensure the password gets saved to disk
        writable_state.password = Arc::new(RwLock::new(CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash]),
            None,
            None,
        )));

        // immediately drop the lock
        drop(writable_state);
    } else {
        create_state_file(state_file, password.clone()).await?;
        let mut writable_state = state.write().await;

        // update the password in the state to ensure the password gets saved to disk
        writable_state.password = Arc::new(RwLock::new(CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash]),
            None,
            None,
        )));

        // immediately drop the lock
        drop(writable_state);
    }

    // store the password
    PASSWORD
        .set(RwLock::new(password))
        .map_err(|e| "Password already defined")?;

    Ok(())
}

/// Checks if the user is authenticated.
///
/// # Returns
///
/// True if the user is authenticated, false otherwise.
#[command]
#[specta]
pub async fn is_authenticated() -> bool {
    PASSWORD.get().is_some()
}

/// Gets the password for the application secure storage if already loaded in memory.
///
/// # Why
///
/// This function is useful when the frontend needs to initialize the State class or some other
/// singleton but the password was not provided at application startup.
/// This is most commonly a development issue (commonly derived from hot-reloading) but implementing
/// a safe reboot of singleton in case the password is missing can be useful to improve the user
/// experience.
///
/// **Note**: This function DOES NOT expose the password to other applications or the networks.
///
/// # Returns
///
/// The password.
#[command]
#[specta]
pub async fn get_password() -> Result<String, String> {
    let psw = PASSWORD
        .get()
        .ok_or("Password not set".to_owned())?
        .read()
        .await
        .clone();

    Ok(psw)
}

/// Gets the settings of the application.
///
/// # Arguments
///
/// * `state` - The state to get the settings from.
///
/// # Returns
///
/// The settings of the application.
#[command]
#[specta]
pub async fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    get_from_state(state, AppStateDeepKeys::Settings)
        .await
        .map(|res| match res {
            AppStateDeepResult::settings(settings) => settings,
            _ => unreachable!(),
        })
}

/// Updates the settings of the application.
///
/// # Arguments
///
/// * `state` - The state to update the settings in.
/// * `value` - The settings to update.
///
/// # Returns
///
/// Nothing.
#[command]
#[specta]
pub async fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    value: SettingsResult,
) -> Result<(), String> {
    let mut settings = load_settings(state.clone()).await?;

    match value {
        SettingsResult::theme(data) => {
            settings.theme = data;
        }
        SettingsResult::general_behaviour(data) => {
            settings.general_behaviour = data;
        }
        SettingsResult::security(data) => {
            settings.security = data;
        }
    }

    insert_in_state(app, state, AppStateDeepResult::settings(settings)).await
}

/// Gets data from the state.
///
/// # Arguments
///
/// * `state` - The state to get the data from.
/// * `key` - The key to get the data from.
///
/// # Returns
///
/// The data as a JSON value.
#[command]
#[specta]
pub async fn get_from_state(
    state: State<'_, AppState>,
    key: AppStateDeepKeys,
) -> Result<AppStateDeepResult, String> {
    let readable_state = state.read().await;

    match key {
        AppStateDeepKeys::Password => Err("Cannot get data from password".to_owned()),
        AppStateDeepKeys::DebouncedSaver => Err("Cannot get data from debounced saver".to_owned()),
        AppStateDeepKeys::CancellationTokens => {
            Err("Cannot get data from cancellation tokens".to_owned())
        }
        AppStateDeepKeys::Providers => Ok(AppStateDeepResult::providers(
            readable_state.providers.clone(),
        )),
        AppStateDeepKeys::Settings => Ok(AppStateDeepResult::settings(
            readable_state.settings.clone(),
        )),
    }
}

/// Removes data from the state.
///
/// # Arguments
///
/// * `state` - The state to remove the data from.
/// * `key` - The key to remove the data from.
///
/// # Returns
///
/// Nothing.
#[command]
#[specta]
pub async fn remove_from_state(
    app: AppHandle,
    state: State<'_, AppState>,
    key: AppStateDeepKeys,
) -> Result<(), String> {
    let mut writable_state = state.write().await;
    match key {
        AppStateDeepKeys::Password => {
            return Err("Cannot remove password from the state".to_owned());
        }
        AppStateDeepKeys::DebouncedSaver => {
            return Err("Cannot remove debounced saver from the state".to_owned());
        }
        AppStateDeepKeys::CancellationTokens => {
            return Err("Cannot remove cancellation tokens from the state".to_owned());
        }
        AppStateDeepKeys::Providers => {
            writable_state.providers = Vec::new();
        }
        AppStateDeepKeys::Settings => {
            writable_state.settings = Settings::default();
        }
    }

    drop(writable_state);

    save(app, state).await
}

/// Inserts data in the state.
///
/// # Arguments
///
/// * `state` - The state to insert the data in.
/// * `value` - The data to insert.
///
/// # Returns
///
/// Nothing.
#[command]
#[specta]
pub async fn insert_in_state(
    app: AppHandle,
    state: State<'_, AppState>,
    value: AppStateDeepResult,
) -> Result<(), String> {
    match value {
        AppStateDeepResult::password(_) => {
            return Err("Cannot insert data in password, use 'init_state' instead".to_owned());
        }
        AppStateDeepResult::providers(data) => {
            let mut writable_state = state.write().await;
            writable_state.providers = data;
            drop(writable_state);
        }
        AppStateDeepResult::settings(data) => {
            let mut writable_state = state.write().await;
            writable_state.settings = data;
            drop(writable_state);
        }
    }

    save(app, state).await
}

/// Saves the state to disk.
///
/// # Arguments
///
/// * `app` - The application handle.
/// * `state` - The state to save.
///
/// # Returns
///
/// Nothing.
pub async fn save(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    update_state_signature(state.clone()).await?;
    let readable_state = state.read().await;

    readable_state
        .debounced_saver
        .save(
            serde_json::to_string(&*readable_state).map_err(|e| e.to_string())?,
            async move |content: String| -> Result<(), String> {
                let resolver = app.path();
                let state_file = resolver
                    .resolve(STATE_FILE, BaseDirectory::AppLocalData)
                    .map_err(|e| e.to_string())?;

                let mut file = File::options()
                    .write(true)
                    .truncate(true)
                    .create(true)
                    .open(state_file)
                    .await
                    .map_err(|e| e.to_string())?;

                file.write_all(content.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
                file.flush().await.map_err(|e| e.to_string())?;

                Ok(())
            },
        )
        .await;

    Ok(())
}

/// Updates the state signature.
///
/// This function is used to update the state signature after a state modification.
///
/// # Arguments
///
/// * `state` - The state to update the signature in.
///
/// # Returns
///
/// Nothing.
async fn update_state_signature(state: State<'_, AppState>) -> Result<(), String> {
    let mut unsigned_state = state.write().await;
    // set the signature to a new empty signature, this is needed to compute the signature of the state
    unsigned_state.settings.security.signature = Arc::new(RwLock::new(CryptData::default()));
    let json = serde_json::to_string(&*unsigned_state).map_err(|e| e.to_string())?;
    drop(unsigned_state);

    // compute the signature of the state
    let signature = CryptData::new(
        json.into_bytes(),
        CryptDataMode::to_u8(vec![CryptDataMode::SignatureHash, CryptDataMode::Hmac]),
        Some(PASSWORD.get().unwrap().read().await.as_bytes()),
        None,
    );

    let mut writable_state = state.write().await;
    writable_state.settings.security.signature = Arc::new(RwLock::new(signature));
    drop(writable_state);

    Ok(())
}

/// Checks the password for the application secure storage.
///
/// If the password is correct, the state is returned.
///
/// # Arguments
///
/// * `psw` - The password to check.
/// * `state_file` - The path to the state file.
///
/// # Returns
///
/// Nothing.
async fn check_password(psw: String, state_file: PathBuf) -> Result<AppStateDeep, String> {
    let state_file = File::options()
        .read(true)
        .open(state_file)
        .await
        .map_err(|err| err.to_string())?;
    let stored_state = serde_json::from_reader::<_, AppStateDeep>(state_file.into_std().await)
        .map_err(|err| err.to_string())?;

    if crypt::verify(
        psw.as_str().as_bytes(),
        stored_state
            .password
            .read()
            .await
            .get_data_as_string()
            .as_str(),
    ) {
        verify_state_signature(stored_state.clone(), psw.as_str()).await?;

        Ok(stored_state)
    } else {
        Err("Invalid password".to_string())
    }
}

/// Verifies the state signature.
///
/// # Arguments
///
/// * `state` - The state to verify the signature of.
/// * `psw` - The password to use to verify the signature.
///
/// # Returns
///
/// Nothing.
async fn verify_state_signature(mut state: AppStateDeep, psw: &str) -> Result<(), String> {
    // extract the signature from the state
    let state_signature = state
        .settings
        .security
        .signature
        .read()
        .await
        .get_data_as_string();
    debug!("verify_state_signature: {}", state_signature);

    // reset the signature to a default empty signature
    state.settings.security.signature = Arc::new(RwLock::new(CryptData::default()));
    let json = serde_json::to_string(&state).map_err(|e| e.to_string())?;

    debug!("verify_state_signature.JSON: {}", json);

    if !verify_hmac(json.as_bytes(), psw.as_bytes(), state_signature.as_str()) {
        return Err("Invalid state signature".to_string());
    }

    Ok(())
}

/// Creates the state file.
///
/// # Arguments
///
/// * `state_file` - The path to the state file.
/// * `state` - The state to write to the file.
///
/// # Returns
///
/// Nothing.
async fn create_state_file(state_file: PathBuf, password: String) -> Result<(), String> {
    let state_file = File::options()
        .write(true)
        .truncate(true)
        .create(true)
        .open(state_file)
        .await
        .map_err(|e| e.to_string())?;

    let state = AppStateDeep {
        password: Arc::new(RwLock::new(CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash, CryptDataMode::PasswordHash]),
            None,
            None,
        ))),
        ..Default::default()
    };

    serde_json::to_writer(state_file.into_std().await, &state).map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::settings::Settings;
    use crate::state::settings::theme::{Theme, ThemeSettings};
    use crate::state::state::AppStateDeep;
    use tauri::{App, Manager};
    use tokio::sync::RwLock;

    fn build() -> App {
        tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![])
            .build(tauri::generate_context!())
            .expect("Failed to build app")
    }

    fn make_state(with_password: bool) -> RwLock<AppStateDeep> {
        let mut state = AppStateDeep::default();

        if with_password {
            state.password = Arc::new(RwLock::new(CryptData::new(
                "test_password".as_bytes().to_vec(),
                CryptDataMode::to_u8(vec![CryptDataMode::Hash, CryptDataMode::PasswordHash]),
                None,
                None,
            )));
        }

        RwLock::new(AppStateDeep::default())
    }

    #[tokio::test]
    async fn test_init_state_existing_file() {
        let app = build();
        app.manage(make_state(true));
        let handle = app.handle();
        save(handle.clone(), handle.state()).await.unwrap();

        let result = init_state(handle.clone(), app.state(), "test_password".to_string()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_init_state_new_file() {
        let app = build();
        app.manage(make_state(false));
        let handle = app.handle();

        let password = "test_password".to_string();

        let result = init_state(handle.clone(), app.state(), password).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_is_authenticated() {
        PASSWORD
            .set(RwLock::new("test_password".to_string()))
            .unwrap();
        let result = is_authenticated().await;
        assert!(result);
    }

    #[tokio::test]
    async fn test_get_password() {
        PASSWORD
            .set(RwLock::new("test_password".to_string()))
            .unwrap();
        let result = get_password().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test_password");
    }

    #[tokio::test]
    async fn test_load_settings() {
        let app = build();
        app.manage(make_state(true));

        let result = load_settings(app.state()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_update_settings() {
        let app = build();
        app.manage(make_state(true));
        let handle = app.handle();

        let settings_result = SettingsResult::theme(ThemeSettings {
            font_size: 18,
            theme: Theme::Dark,
        });

        let result = update_settings(handle.clone(), app.state(), settings_result).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_from_state() {
        let app = build();
        app.manage(make_state(true));

        let result = get_from_state(app.state(), AppStateDeepKeys::Settings).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_remove_from_state() {
        let app = build();
        app.manage(make_state(true));
        let handle = app.handle();

        let result =
            remove_from_state(handle.clone(), app.state(), AppStateDeepKeys::Settings).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_in_state() {
        let app = build();
        app.manage(make_state(true));
        let handle = app.handle();
        let settings = Settings::default();

        let result = insert_in_state(
            handle.clone(),
            app.state(),
            AppStateDeepResult::settings(settings),
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_save() {
        let app = build();
        app.manage(make_state(true));
        let handle = app.handle();

        let result = save(handle.clone(), app.state()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_update_state_signature() {
        let app = build();
        app.manage(make_state(true));

        let result = update_state_signature(app.state()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_check_password() {
        let password = "test_password".to_string();
        let state_file = PathBuf::from("test_state.json");

        // Mock the state file content
        // ...

        let result = check_password(password, state_file).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_verify_state_signature() {
        let state = AppStateDeep::default();
        let password = "test_password";

        let result = verify_state_signature(state, password).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_state_file() {
        let state_file = PathBuf::from("test_state.json");
        let password = "test_password".to_string();

        let result = create_state_file(state_file, password).await;
        assert!(result.is_ok());
    }
}
