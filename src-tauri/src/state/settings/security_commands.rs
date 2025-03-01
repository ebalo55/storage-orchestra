use crate::crypt;
use crate::crypt::{CryptData, CryptDataMode};
use crate::state::settings::state_cryptdata_instances::{
    count_states_cryptdata_instances, cryptdatas_of_state, visit_states_cryptdata_instances,
};
use crate::state::state::AppState;
use crate::state::{PASSWORD, save};
use crate::utility::get_json_value::get_json_value;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::{Type, specta};
use std::sync::Arc;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, State, command};
use tokio::sync::RwLock;
use tracing::{error, warn};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case", tag = "event", content = "data")]
pub enum PasswordUpdateEvent {
    Initialized { steps: u32 },
    StepCompleted,
    Completed,
}

/// Check that the password is correct
///
/// # Arguments
///
/// - `state` - The application state
/// - `password` - The password to check
///
/// # Returns
///
/// Returns `Ok(())` if the password is correct, otherwise returns `Err("Invalid password")`
#[command]
#[specta]
pub async fn check_password(state: State<'_, AppState>, password: String) -> Result<(), String> {
    let readable_state = state.read().await;
    let stored_password = readable_state.password.clone();
    drop(readable_state);

    let stored_password = stored_password.read().await;

    if crypt::verify(
        password.as_str().as_bytes(),
        stored_password.get_data_as_string().as_str(),
    ) {
        Ok(())
    } else {
        Err("Invalid password".to_string())
    }
}

/// Update the password
///
/// Note that this triggers the update of all encrypted data too as the password is used to encrypt them.
///
/// # Arguments
///
/// - `state` - The application state
/// - `current_password` - The current password
/// - `new_password` - The new password
/// - `ev` - The event channel
///
/// # Returns
///
/// Returns `Ok(())` if the password was updated successfully, otherwise returns `Err(String)`
#[command]
#[specta]
pub async fn update_password(
    app: AppHandle,
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
    ev: Channel<PasswordUpdateEvent>,
) -> Result<(), String> {
    check_password(state.clone(), current_password.clone()).await?;

    let async_state = Arc::new(state);
    let async_ev = Arc::new(ev);

    // send the initialization event with the count of how many cryptdata should be updated
    async_ev
        .send(PasswordUpdateEvent::Initialized {
            steps: count_states_cryptdata_instances(async_state.clone()).await,
        })
        .map_err(|e| e.to_string())?;

    let delayed_items = Arc::new(RwLock::new(Vec::new()));
    let delayed_items_visit_clone = delayed_items.clone();

    let passed_keys = Arc::new(RwLock::new(Vec::new()));
    let passed_keys_visit_clone = passed_keys.clone();

    let ev_visit_clone = async_ev.clone();

    let new_psw_visit_clone = new_password.clone();

    // update the password for all the crypt data instances
    visit_states_cryptdata_instances(
        async_state.clone(),
        Box::new(move |key: String, crypt_data: Arc<RwLock<CryptData>>| {
            let current_password = current_password.clone();
            let new_password = new_psw_visit_clone.clone();
            let delayed_items = delayed_items_visit_clone.clone();
            let passed_keys = passed_keys_visit_clone.clone();
            let ev = ev_visit_clone.clone();

            Box::pin(async move {
                tokio::time::sleep(Duration::from_millis(500)).await;

                let readable_crypt_data = crypt_data.read().await;
                let modes = readable_crypt_data.get_modes();
                let related_keys = if !readable_crypt_data.related_keys.is_empty() {
                    Some(readable_crypt_data.related_keys.clone())
                } else {
                    None
                };
                drop(readable_crypt_data);

                let mut writable_crypt_data = crypt_data.write().await;

                let new_psw = new_password.clone();
                let current_password = current_password.clone();

                if modes.contains(&CryptDataMode::PasswordHash) {
                    *writable_crypt_data = CryptData::new(
                        new_psw.into_bytes(),
                        CryptDataMode::to_u8(modes),
                        None,
                        None,
                    );
                } else if modes.contains(&CryptDataMode::SignatureHash) {
                    // skip signature as it is automatically updated on state save
                } else if modes.contains(&CryptDataMode::Hash) {
                    // delay all the hashed items
                    let mut delayed_items = delayed_items.write().await;
                    delayed_items.push(crypt_data.clone());

                    // skip the current crypt data instance
                    return Ok(());
                } else {
                    // handle other modes
                    *writable_crypt_data = CryptData::new(
                        (writable_crypt_data).get_raw_data(Some(current_password.as_bytes()))?,
                        CryptDataMode::to_u8(modes),
                        Some(new_psw.as_bytes()),
                        related_keys,
                    );
                }

                ev.send(PasswordUpdateEvent::StepCompleted)
                    .map_err(|e| e.to_string())?;

                let mut passed_keys = passed_keys.write().await;
                passed_keys.push(key);
                Ok(())
            })
        }),
    )
    .await?;

    // sort the delayed items, ensure SignatureHash is last
    let delayed_items = delayed_items.write().await;

    // update the delayed items
    for crypt_data in delayed_items.iter() {
        tokio::time::sleep(Duration::from_millis(500)).await;

        let readable_crypt_data = crypt_data.read().await;

        let modes = readable_crypt_data.get_modes();
        let new_psw = new_password.clone();

        let state_value = async_state.read().await;
        let json_state = serde_json::to_value(&*state_value).map_err(|e| e.to_string())?;

        // get the related keys as a string
        let dataset = get_related_hash_data(crypt_data.clone(), &json_state).await;

        // ensure that all the keys the dataset depends on are already passed from the iterator
        // if this is not the case maybe a deadlock has been reached
        if should_delay_hashing(async_state.clone(), crypt_data.clone(), passed_keys.clone()).await
        {
            error!(
                "Failed to update the password for crypt data instance: {:?}",
                crypt_data
            );
            continue;
        }

        make_dynamic_hash(crypt_data.clone(), dataset, new_psw.clone(), modes).await;

        async_ev
            .send(PasswordUpdateEvent::StepCompleted)
            .map_err(|e| e.to_string())?;
    }

    async_ev
        .send(PasswordUpdateEvent::Completed)
        .map_err(|e| e.to_string())?;

    // Update the static password in memory
    let mut static_psw = PASSWORD.get().unwrap().write().await;
    *static_psw = new_password;
    drop(static_psw);

    save(
        app,
        Arc::into_inner(async_state).ok_or("Cannot take state ownership")?,
    )
    .await?;

    Ok(())
}

/// Get the related hash data
///
/// # Arguments
///
/// - `crypt_data` - The crypt data instance
/// - `state` - The application state as a JSON value
///
/// # Returns
///
/// Returns the related hash data
async fn get_related_hash_data(
    crypt_data: Arc<RwLock<CryptData>>,
    state: &Value,
) -> Vec<(String, String)> {
    let mut dataset = Vec::new();

    let crypt_data = crypt_data.read().await;

    for key in crypt_data.related_keys.iter() {
        let value = get_json_value(state, key.as_str());

        if value.is_none() {
            warn!("Key '{}' not found in state", key);
            continue;
        }

        dataset.push((key.clone(), value.unwrap().to_string()));
    }

    dataset
}

/// Check if hashing should be delayed
///
/// # Arguments
///
/// - `state` - The application state
/// - `crypt_data` - The crypt data instance
/// - `iterator` - The application state iterator
///
/// # Returns
///
/// Returns `true` if hashing should be delayed, otherwise returns `false`
async fn should_delay_hashing(
    state: Arc<State<'_, AppState>>,
    crypt_data: Arc<RwLock<CryptData>>,
    passed_keys: Arc<RwLock<Vec<String>>>,
) -> bool {
    let crypt_data = crypt_data.read().await;
    let passed_keys = passed_keys.read().await;
    let valid_keys = cryptdatas_of_state(state).await;

    for key in crypt_data.related_keys.iter() {
        if valid_keys.contains(key) && !passed_keys.contains(key) {
            return true;
        }
    }

    false
}

/// Make dynamic hash
///
/// # Arguments
///
/// - `crypt_data` - The crypt data instance
/// - `dataset` - The related hash data
/// - `new_psw` - The new password
/// - `modes` - The crypt data modes
///
/// # Returns
///
/// Updates in-place the crypt data instance
async fn make_dynamic_hash(
    crypt_data: Arc<RwLock<CryptData>>,
    dataset: Vec<(String, String)>,
    new_psw: String,
    modes: Vec<CryptDataMode>,
) {
    let raw_data = dataset
        .into_iter()
        .map(|item| item.1)
        .collect::<Vec<String>>()
        .join("\n");

    let mut writable_crypt_data = crypt_data.write().await;
    let crypt_data = crypt_data.read().await;

    // handle dynamic hashing based on the related fields
    *writable_crypt_data = CryptData::new(
        raw_data.into_bytes(),
        CryptDataMode::to_u8(modes),
        Some(new_psw.as_bytes()),
        if !crypt_data.related_keys.is_empty() {
            Some(crypt_data.related_keys.clone())
        } else {
            None
        },
    );
}
