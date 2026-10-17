mod commands;

use std::{fs, path::PathBuf};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let database_path: PathBuf = app_data_dir.join("todo-capacity.sqlite");
            commands::initialize_database(&database_path)?;
            app.manage(commands::DatabasePath(database_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_tasks,
            commands::list_decisions,
            commands::save_task,
            commands::commit_state,
            commands::process_missed_tasks,
            commands::get_preferences,
            commands::save_preferences,
            commands::seed_sample_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
