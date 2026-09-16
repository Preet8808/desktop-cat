// Prevents an extra console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, Window,
};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetCursorPos, GetMessageW, KBDLLHOOKSTRUCT,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, WH_KEYBOARD_LL, WH_MOUSE_LL,
    WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP,
    WM_SYSKEYDOWN, WM_SYSKEYUP,
};

static BONGO_ACTIVE: AtomicBool = AtomicBool::new(false);
static mut HOOK_WINDOW: Option<Window> = None;

#[derive(serde::Serialize)]
struct CursorPosition {
    x: f64,
    y: f64,
}

#[tauri::command]
fn set_bongo_active(active: bool) {
    BONGO_ACTIVE.store(active, Ordering::Relaxed);
}

fn vk_to_key_name(vk: u32) -> String {
    match vk {
        0x30..=0x39 => format!("{}", (vk - 0x30)),
        0x41..=0x5A => format!("{}", ((vk as u8) as char)),
        0x60..=0x69 => format!("{}", (vk - 0x60)),
        0x20 => "SPACE".to_string(),
        0x0D => "ENTER".to_string(),
        0x08 => "BACKSPACE".to_string(),
        0x09 => "TAB".to_string(),
        0x1B => "ESC".to_string(),
        0x10 | 0xA0 => "SHIFT_L".to_string(),
        0xA1 => "SHIFT_R".to_string(),
        0x11 | 0xA2 => "CTRL_L".to_string(),
        0xA3 => "CTRL_R".to_string(),
        0x12 | 0xA4 => "ALT_L".to_string(),
        0xA5 => "ALT_R".to_string(),
        0x14 => "CAPSLOCK".to_string(),
        0x2E | 0x2D => "DELETE".to_string(),
        0xC0 => "`".to_string(),
        0xBF => "/".to_string(),
        0xBA => ";".to_string(),
        0xBB => "=".to_string(),
        0xBC => ",".to_string(),
        0xBD => "-".to_string(),
        0xBE => ".".to_string(),
        0xDE => "'".to_string(),
        0xDB => "[".to_string(),
        0xDD => "]".to_string(),
        0xDC => "\\".to_string(),
        0x6A => "*".to_string(),
        0x6B => "+".to_string(),
        0x6D => "-".to_string(),
        0x6E => ".".to_string(),
        0x6F => "/".to_string(),
        0x25 => "LEFT".to_string(),
        0x26 => "UP".to_string(),
        0x27 => "RIGHT".to_string(),
        0x28 => "DOWN".to_string(),
        0x70..=0x7B => format!("F{}", vk - 0x70 + 1),
        0x5B | 0x5C => "META".to_string(),
        _ => "".to_string(),
    }
}

unsafe extern "system" fn bongo_keyboard_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code >= 0 && BONGO_ACTIVE.load(Ordering::Relaxed) {
        let is_down = wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize;
        let is_up = wparam == WM_KEYUP as usize || wparam == WM_SYSKEYUP as usize;
        if is_down || is_up {
            let kb = *(lparam as *const KBDLLHOOKSTRUCT);
            let key_name = vk_to_key_name(kb.vkCode);
            if let Some(ref win) = HOOK_WINDOW {
                let _ = win.emit("bongo-key-event", (key_name, is_down));
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

unsafe extern "system" fn bongo_mouse_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code >= 0 && BONGO_ACTIVE.load(Ordering::Relaxed) {
        match wparam as u32 {
            WM_LBUTTONDOWN => {
                if let Some(ref win) = HOOK_WINDOW {
                    let _ = win.emit("bongo-mouse-event", ("left", true));
                }
            }
            WM_LBUTTONUP => {
                if let Some(ref win) = HOOK_WINDOW {
                    let _ = win.emit("bongo-mouse-event", ("left", false));
                }
            }
            WM_RBUTTONDOWN => {
                if let Some(ref win) = HOOK_WINDOW {
                    let _ = win.emit("bongo-mouse-event", ("right", true));
                }
            }
            WM_RBUTTONUP => {
                if let Some(ref win) = HOOK_WINDOW {
                    let _ = win.emit("bongo-mouse-event", ("right", false));
                }
            }
            _ => {}
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
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

            let hook_window = window.clone();
            unsafe {
                HOOK_WINDOW = Some(hook_window);
            }
            std::thread::spawn(|| {
                unsafe {
                    let k_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(bongo_keyboard_proc), std::ptr::null_mut(), 0);
                    let m_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(bongo_mouse_proc), std::ptr::null_mut(), 0);
                    let mut msg = std::mem::zeroed();
                    while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                        TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                    if !k_hook.is_null() {
                        UnhookWindowsHookEx(k_hook);
                    }
                    if !m_hook.is_null() {
                        UnhookWindowsHookEx(m_hook);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            start_native_drag,
            get_cursor_position,
            get_save_path,
            read_save_file,
            write_save_file,
            set_bongo_active
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop cat application");
}
