use crate::crypt;
use crate::state::state::AppState;
use specta::specta;
use tauri::{State, command};

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

    if crypt::verify(
        password.as_str().as_bytes(),
        stored_password.get_data_as_string().as_str(),
    ) {
        Ok(())
    } else {
        Err("Invalid password".to_string())
    }
}

pub async fn update_password(
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    check_password(state.clone(), current_password.clone()).await?;

    let mut writable_state = state.write().await;
}
