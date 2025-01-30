mod crypt;
mod state;
mod utility;

use crate::state::state::AppStateInner;
use specta::specta;
use specta_typescript::Typescript;
use tauri::async_runtime::RwLock;
use tauri::{command, Emitter, Manager as _, Window};
use tauri_plugin_oauth::start;
use tauri_specta::{collect_commands, collect_events, Builder};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![
            start_server,
            state::init_state,
            state::get_from_state,
            state::remove_from_state,
            state::insert_in_state
        ])
        .events(collect_events![]);

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    builder
        .export(Typescript::default(), "../src/tauri-bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // This is also required if you want to use events
            builder.mount_events(app);

            app.manage(RwLock::new(AppStateInner::default()));

            // let window = app.get_webview_window("main").unwrap();
            // window.eval("window.location.replace('https://google.com')");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
