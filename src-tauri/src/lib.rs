#![feature(let_chains)]

mod crypt;
mod native_apps;
mod state;
mod utility;

use crate::state::state::{AppStateDeep, STATE_FILE};
use specta::specta;
use specta_typescript::Typescript;
use std::{fs, io};
use tauri::async_runtime::RwLock;
use tauri::{Emitter, Manager as _, Window, command};
use tauri_plugin_oauth::start;
use tauri_specta::{Builder, collect_commands, collect_events};
use tracing::Level;
use tracing_subscriber::Registry;
use tracing_subscriber::fmt::layer;
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_subscriber::prelude::*;

#[command]
#[specta]
async fn start_server(window: Window) -> Result<u16, String> {
    start(move |url| {
        // Because of the unprotected localhost port, you must verify the URL here.
        // Preferebly send back only the token, or nothing at all if you can handle everything else in Rust.
        let _ = window.emit("redirect_uri", url);
    })
    .map_err(|err| err.to_string())
}

fn setup_tracing() -> Result<(), String> {
    // Setup tracing
    let log_file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open("storage-orchestra.log")
        .map_err(|e| e.to_string())?;

    let stdout_layer = layer()
        .with_writer(io::stdout.with_max_level(Level::INFO))
        .with_ansi(true)
        .with_level(true)
        .with_file(false)
        .with_line_number(false)
        .compact();

    Registry::default()
        .with(stdout_layer)
        .with(
            layer()
                .with_writer(log_file.with_max_level(Level::DEBUG))
                .with_ansi(false)
                .with_level(true)
                .with_file(false)
                .with_line_number(false)
                .compact(),
        )
        .init();

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), String> {
    sysinfo::set_open_files_limit(0);
    setup_tracing()?;

    let mut builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            start_server,
            state::init_state,
            state::get_from_state,
            state::remove_from_state,
            state::insert_in_state,
            state::is_authenticated,
            state::get_password,
            state::load_settings,
            state::update_settings,
            state::check_password,
            state::update_password,
            crypt::crypt_data_get_raw_data_as_string,
            crypt::crypt_data_get_raw_data,
            crypt::make_crypt_data_from_qualified_string,
            native_apps::watch_native_open,
        ])
        .events(collect_events![])
        .constant("STATE_FILE", STATE_FILE);

    // Only export on non-release builds
    #[cfg(debug_assertions)]
    {
        let language_exporter =
            Typescript::default().bigint(specta_typescript::BigIntExportBehavior::BigInt);

        builder
            .export(language_exporter, "../src/tauri-bindings.ts")
            .expect("Failed to export typescript bindings");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            app.manage(RwLock::new(AppStateDeep::default()));

            // let window = app.get_webview_window("main").unwrap();
            // window.eval("window.location.replace('https://google.com')");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
