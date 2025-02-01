use crate::crypt;
use crate::crypt::{CryptData, CryptDataMode};
use crate::state::state::{
    AppState, AppStateInner, AppStateInnerKeys, AppStateInnerResult, STATE_FILE,
};
use once_cell::sync::OnceCell;
use specta::specta;
use std::path::PathBuf;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State, command};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

pub static PASSWORD: OnceCell<String> = OnceCell::new();

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
        writable_state.password = CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash]),
            None,
        );

        // immediately drop the lock
        drop(writable_state);
    } else {
        create_state_file(state_file, password.clone()).await?;
        let mut writable_state = state.write().await;

        // update the password in the state to ensure the password gets saved to disk
        writable_state.password = CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash]),
            None,
        );

        // immediately drop the lock
        drop(writable_state);
    }

    // store the password
    PASSWORD
        .set(password)
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
    key: AppStateInnerKeys,
) -> Result<AppStateInnerResult, String> {
    let readable_state = state.read().await;

    match key {
        AppStateInnerKeys::Password => Err("Cannot get data from password".to_owned()),
        AppStateInnerKeys::DebouncedSaver => Err("Cannot get data from debounced saver".to_owned()),
        AppStateInnerKeys::Providers => Ok(AppStateInnerResult::providers(
            readable_state.providers.clone(),
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
    key: AppStateInnerKeys,
) -> Result<(), String> {
    let mut writable_state = state.write().await;
    match key {
        AppStateInnerKeys::Password => {
            return Err("Cannot remove password from the state".to_owned());
        }
        AppStateInnerKeys::DebouncedSaver => {
            return Err("Cannot remove debounced saver from the state".to_owned());
        }
        AppStateInnerKeys::Providers => {
            writable_state.providers = Vec::new();
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
    value: AppStateInnerResult,
) -> Result<(), String> {
    match value {
        AppStateInnerResult::password(_) => {
            return Err("Cannot insert data in password, use 'init_state' instead".to_owned());
        }
        AppStateInnerResult::providers(data) => {
            let mut writable_state = state.write().await;
            writable_state.providers = data;
            drop(writable_state);
        }
    }

    save(app, state).await
}

async fn save(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
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
async fn check_password(psw: String, state_file: PathBuf) -> Result<AppStateInner, String> {
    let state_file = File::options()
        .read(true)
        .open(state_file)
        .await
        .map_err(|err| err.to_string())?;
    let mut stored_state = serde_json::from_reader::<_, AppStateInner>(state_file.into_std().await)
        .map_err(|err| err.to_string())?;

    if crypt::verify(
        psw.as_str().as_bytes(),
        stored_state.password.get_data_as_string().as_str(),
    ) {
        Ok(stored_state)
    } else {
        Err("Invalid password".to_string())
    }
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

    let state = AppStateInner {
        password: CryptData::new(
            password.as_str().as_bytes().to_vec(),
            CryptDataMode::to_u8(vec![CryptDataMode::Hash]),
            None,
        ),
        ..Default::default()
    };

    serde_json::to_writer(state_file.into_std().await, &state).map_err(|err| err.to_string())?;
    Ok(())
}
