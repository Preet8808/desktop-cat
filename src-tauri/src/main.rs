// Prevents an extra console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, Window,
};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[derive(serde::Serialize)]
struct CursorPosition {
    x: f64,
    y: f64,
}

/// The desktop-pet window spans the whole primary monitor. Because the window
/// itself is transparent and (mostly) click-through, the OS lets mouse events
/// fall through to whatever app is beneath the cat. Only when the cursor is
/// actually over the cat sprite (as reported by the frontend hit-test) do we
/// flip the window back into "catch clicks" mode.
#[tauri::command]
fn set_click_through(window: Window, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_native_drag(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_cursor_position(window: Window) -> Result<CursorPosition, String> {
    let mut position = POINT { x: 0, y: 0 };
    let result = unsafe { GetCursorPos(&mut position) };
    if result == 0 {
        return Err("could not read cursor position".to_string());
    }
    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;

    Ok(CursorPosition {
        x: f64::from(position.x) / scale_factor,
        y: f64::from(position.y) / scale_factor,
    })
}

#[tauri::command]
fn get_save_path(app: AppHandle) -> Result<String, String> {
    let mut dir: PathBuf = app
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "could not resolve app data dir".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push("pet-save.json");
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn read_save_file(path: String) -> Result<String, String> {
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(_) => Ok(String::new()), // missing/corrupt save -> caller falls back to defaults
    }
}

#[tauri::command]
fn write_save_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

fn build_tray() -> SystemTray {
    let show = CustomMenuItem::new("show".to_string(), "Show Cat");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide Cat");
    let settings = CustomMenuItem::new("settings".to_string(), "Settings");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_item(settings)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);
    SystemTray::new().with_menu(menu)
}

fn main() {
    tauri::Builder::default()
        .system_tray(build_tray())
        .on_system_tray_event(|app, event| {
            if let SystemTrayEvent::MenuItemClick { id, .. } = event {
                let window = app.get_window("cat").unwrap();
                match id.as_str() {
                    "show" => {
                        let _ = window.show();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    "settings" => {
                        let _ = window.emit("open-settings", ());
                        let _ = window.show();
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                }
            }
        })
        .setup(|app| {
            let window = app.get_window("cat").unwrap();
            // Cover the full primary monitor so the cat can roam anywhere on screen.
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let size = monitor.size();
                let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height));
                let _ = window.set_position(tauri::PhysicalPosition::new(0, 0));
            }
            // Start fully click-through; the frontend flips this on/off as the
            // cursor enters/leaves the cat's hit area.
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.show();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            start_native_drag,
            get_cursor_position,
            get_save_path,
            read_save_file,
            write_save_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop cat application");
}
