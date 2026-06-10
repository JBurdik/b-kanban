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

    // Check for updates on startup (GitHub releases via updater plugin).
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = check_for_updates(handle).await {
            log::error!("Update check failed: {e}");
        }
    });

    Ok(())
}

#[cfg(desktop)]
async fn check_for_updates(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;

    if let Some(update) = app.updater()?.check().await? {
        log::info!("Update available: {}, downloading...", update.version);
        update.download_and_install(|_, _| {}, || {}).await?;
        log::info!("Update installed; will apply on restart.");
    }
    Ok(())
}
