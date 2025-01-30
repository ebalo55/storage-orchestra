use async_trait::async_trait;
use tauri::State;
use crate::state::state::{AppState, AppStateInnerKeys};

#[async_trait]
pub trait FromStatefulJson<T> {
    /// Converts the data from an anonymous frontend json representation to the backend format
    ///
    /// # Arguments
    ///
    /// * `state` - The state of the application
    /// * `value` - The data from the frontend
    /// * `key` - The key of the object where data will be stored in the state
    ///
    /// # Returns
    ///
    /// The data in the backend format
    async fn from_stateful_json(state: State<'_, AppState>, value: serde_json::Value, key: AppStateInnerKeys) -> Result<T, String>
    where
        Self: Sized;
}