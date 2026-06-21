use tauri::State;
use crate::AppState;
use crate::AppSettings;
use crate::database::dao;
use crate::lock;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    state.db.with_conn(|conn| dao::settings::load_settings(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    state.db.with_conn(|conn| dao::settings::save_settings(conn, &settings))
        .map_err(|e| e.to_string())?;

    *lock!(state.settings) = settings;
    Ok(())
}
