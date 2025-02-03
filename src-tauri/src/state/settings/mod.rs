use serde::{Deserialize, Serialize};
use specta::Type;
use as_result_enum::AsResultEnum;
use key_as_enum::KeysAsEnum;
use crate::state::settings::general_behaviour::GeneralBehaviour;
use crate::state::settings::theme::ThemeSettings;

pub mod theme;
pub mod general_behaviour;

/// The settings of the application
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default, AsResultEnum)]
#[derive_extra(Type)]
pub struct Settings {
    /// The theme settings
    pub theme: ThemeSettings,
    /// The general behaviour settings
    pub general_behaviour: GeneralBehaviour,
}