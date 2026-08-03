// Ashen Spire desktop wrapper — Tauri main process (spike).
// Serves dist/AshenSpire.html unmodified via frontendDist; the injected
// probe (src/probe.js) measures boot-to-playable, gamepad API, and save
// persistence; these commands handle fullscreen verification and clean quit.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn spike_report(payload: String) {
    println!("SPIKE {}", payload);
}

#[tauri::command]
fn spike_fullscreen(window: tauri::WebviewWindow, on: bool) -> bool {
    window.set_fullscreen(on).expect("set_fullscreen failed");
    window.is_fullscreen().expect("is_fullscreen failed")
}

#[tauri::command]
fn spike_quit(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    let t0 = std::env::var("SPIKE_T0").unwrap_or_else(|_| "0".into());
    let mode = std::env::var("SPIKE_MODE").unwrap_or_else(|_| "write".into());
    let init = format!(
        "window.__SPIKE_T0={};window.__SPIKE_MODE='{}';{}",
        t0,
        mode,
        include_str!("probe.js")
    );

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            spike_report,
            spike_fullscreen,
            spike_quit
        ])
        .setup(move |app| {
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("AshenSpire.html".into()),
            )
            .title("Ashen Spire")
            .inner_size(1280.0, 720.0)
            .initialization_script(&init)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
