// codex/mcp are desktop-only assistant features (spawn subprocesses, touch the
// filesystem) — iOS/Android sandboxes forbid that, so gate them off mobile.
#[cfg(desktop)]
mod codex;
#[cfg(desktop)]
mod mcp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_os::init());

    // Desktop-only plugins + handlers: window-state, updater, the native menu and
    // the codex/mcp commands. The updater plugin has no mobile support, and
    // window-state/menu are meaningless on a phone.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            codex::codex_check,
            codex::codex_login,
            codex::codex_send,
            mcp::mcp_status,
            mcp::mcp_install,
            mcp::mcp_uninstall,
            mcp::mcp_set_active_card,
            mcp::skill_install,
            mcp::skill_uninstall,
            check_for_updates_cmd,
            install_update_cmd,
        ])
        .setup(|app| {
            desktop_setup(app)?;
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn desktop_setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, SubmenuBuilder};

    // Application menu — mirrors the previous Electrobun menu
    // (app menu with Quit + an Edit menu with the standard roles).
    let app_menu = SubmenuBuilder::new(app, "B Productive").quit().build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu])
        .build()?;
    app.set_menu(menu)?;

    // Check on startup, then every hour.
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(e) = check_and_notify(handle.clone()).await {
                log::error!("Update check failed: {e}");
            }
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        }
    });

    Ok(())
}

/// Shared by the background loop and the frontend-triggered command.
/// Emits `update:available` when a newer version is found.
/// The frontend is responsible for calling `install_update_cmd` to apply it.
#[cfg(desktop)]
async fn check_and_notify(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri::Emitter;
    use tauri_plugin_updater::UpdaterExt;

    if let Some(update) = app.updater()?.check().await? {
        log::info!("Update available: {}", update.version);
        let _ = app.emit("update:available", update.version.clone());
    }
    Ok(())
}

/// Called from the frontend to manually trigger an update check.
#[tauri::command]
#[cfg(desktop)]
async fn check_for_updates_cmd(app: tauri::AppHandle) -> Result<(), String> {
    check_and_notify(app).await.map_err(|e| e.to_string())
}

/// Called from the frontend after the user confirms. Downloads, installs, and relaunches.
#[tauri::command]
#[cfg(desktop)]
async fn install_update_cmd(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_plugin_updater::UpdaterExt;

    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(update) = update {
        let _ = app.emit("update:downloading", ());
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        let _ = app.emit("update:ready", ());
        app.restart();
    }
    Ok(())
}
