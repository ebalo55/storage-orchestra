use crate::crypt::CryptData;
use crate::state::state::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

/// Get the json paths of the crypt data instances in the state
///
/// # Arguments
///
/// - `state` - The application state
///
/// # Returns
///
/// A vector of json paths
pub async fn cryptdatas_of_state(state: Arc<State<'_, AppState>>) -> Vec<String> {
    let state = state.read().await;
    let mut cryptdatas = Vec::new();

    cryptdatas.push("password".to_owned());

    let mut index = 0;
    for provider in state.providers.iter() {
        cryptdatas.push(format!("providers.{}.access_token", index));
        cryptdatas.push(format!("providers.{}.refresh_token", index));

        index += 1;
    }

    cryptdatas.push("settings.security.signature".to_owned());

    if let Some(secret) = state
        .settings
        .security
        .two_factor_authentication
        .secret
        .as_ref()
    {
        cryptdatas.push("settings.security.two_factor_authentication.secret".to_owned());
    }

    cryptdatas
}

/// Count the number of instances of crypt data in the state
///
/// # Arguments
///
/// - `state` - The application state
///
/// # Returns
///
/// The number of instances of crypt data in the state
pub async fn count_states_cryptdata_instances(state: Arc<State<'_, AppState>>) -> u32 {
    let state = state.read().await;
    let mut count = 0u32;

    let default_crypt_data = CryptData::default();

    if *state.password.read().await != default_crypt_data {
        count += 1;
    }

    for provider in state.providers.iter() {
        if *provider.access_token.read().await != default_crypt_data {
            count += 1;
        }

        if *provider.refresh_token.read().await != default_crypt_data {
            count += 1;
        }
    }

    if *state.settings.security.signature.read().await != default_crypt_data {
        count += 1;
    }

    if let Some(_) = state.settings.security.two_factor_authentication.secret {
        count += 1;
    }

    count
}

/// Traverse the states crypt data instances
///
/// # Arguments
///
/// - `state` - The application state
///
/// # Returns
///
/// A vector of mutable references to the crypt data instances
pub async fn visit_states_cryptdata_instances<F, Fut>(
    state: Arc<State<'_, AppState>>,
    mut visit_fn: Box<F>,
) -> Result<(), String>
where
    F: FnMut(String, Arc<RwLock<CryptData>>) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Result<(), String>> + Send + 'static,
{
    let mut state = state.write().await;
    let default_crypt_data = CryptData::default();

    if *state.password.read().await != default_crypt_data {
        visit_fn("password".to_owned(), state.password.clone()).await?;
    }

    let mut index = 0;
    for provider in state.providers.iter_mut() {
        if *provider.access_token.read().await != default_crypt_data {
            visit_fn(
                format!("providers.{}.access_token", index),
                provider.access_token.clone(),
            )
            .await?;
        }

        if *provider.refresh_token.read().await != default_crypt_data {
            visit_fn(
                format!("providers.{}.refresh_token", index),
                provider.refresh_token.clone(),
            )
            .await?;
        }

        index += 1;
    }

    if *state.settings.security.signature.read().await != default_crypt_data {
        visit_fn(
            "settings.security.signature".to_owned(),
            state.settings.security.signature.clone(),
        )
        .await?;
    }

    if let Some(secret) = state
        .settings
        .security
        .two_factor_authentication
        .secret
        .as_ref()
    {
        visit_fn(
            "settings.security.two_factor_authentication.secret".to_owned(),
            secret.clone(),
        )
        .await?;
    }

    Ok(())
}
