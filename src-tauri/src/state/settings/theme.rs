use educe::Educe;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fmt::Display;

/// The theme settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Educe)]
#[educe(Default)]
pub struct ThemeSettings {
    /// The application font size in pixels
    #[educe(Default = 16)]
    pub font_size: u8,
    /// The application theme
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
pub struct ColorSettings {
    /// The color of the color setting pair
    pub color: Color,
    pub shade: Shade,
}

impl Display for ColorSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}", self.color, self.shade)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum Color {
    #[default]
    Default,
    Dark,
    Gray,
    Red,
    Pink,
    Grape,
    Violet,
    Indigo,
    Blue,
    Cyan,
    Green,
    Lime,
    Yellow,
    Orange,
    Teal,
}

impl Display for Color {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_string().to_lowercase())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum Shade {
    #[default]
    Default,
    #[serde(rename = "0")]
    _0,
    #[serde(rename = "1")]
    _1,
    #[serde(rename = "2")]
    _2,
    #[serde(rename = "3")]
    _3,
    #[serde(rename = "4")]
    _4,
    #[serde(rename = "5")]
    _5,
    #[serde(rename = "6")]
    _6,
    #[serde(rename = "7")]
    _7,
    #[serde(rename = "8")]
    _8,
    #[serde(rename = "9")]
    _9,
}

impl Display for Shade {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_string().to_lowercase().replace("_", ""))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    #[default]
    Light,
    Dark,
    System,
}
