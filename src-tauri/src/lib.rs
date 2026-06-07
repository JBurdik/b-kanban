use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri_plugin_updater::UpdaterExt;

mod codex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            codex::codex_check,
            codex::codex_login,
            codex::codex_send,
        ])
        .setup(|app| {
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
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn check_for_updates(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        log::info!("Update available: {}, downloading...", update.version);
        update.download_and_install(|_, _| {}, || {}).await?;
        log::info!("Update installed; will apply on restart.");
    }
    Ok(())
}
