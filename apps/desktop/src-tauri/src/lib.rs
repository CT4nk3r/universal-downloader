//! Universal Downloader — Tauri desktop entry point.
//!
//! `run()` is invoked from `main.rs`. It wires up the plugins, registers
//! the `invoke_handler` (see [`commands`]) and starts the event loop.

pub mod commands;
pub mod error;
pub mod sidecar;

/// Build and run the Tauri application.
///
/// # Plugins
///   * `tauri-plugin-shell`     — execute bundled sidecars (`yt-dlp`, `ffmpeg`)
///   * `tauri-plugin-fs`        — scoped filesystem access for the download dir
///   * `tauri-plugin-dialog`    — native open/save dialogs
///   * `tauri-plugin-deep-link` — `universal-downloader://` URL handling
///   * `tauri-plugin-updater`   — GitHub-releases-backed self-update
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init());

    // The updater plugin is desktop-only.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|_app| {
            // Future: register a native menu, tray icon, deep-link handler, etc.
            // J1.8 will hook the deep-link receiver into the job queue here.
            Ok(())
        })
        .invoke_handler(crate::register_handlers!())
        .run(tauri::generate_context!())
        .expect("error while running Universal Downloader");
}
