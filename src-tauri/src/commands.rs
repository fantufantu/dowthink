use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde_json::Value;
use tauri::State;

#[derive(Clone)]
pub struct DatabasePath(pub PathBuf);

pub fn initialize_database(path: &Path) -> rusqlite::Result<()> {
    let connection = Connection::open(path)?;
    let version: i32 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version == 0 {
        connection.execute_batch(include_str!("../migrations/001_initial.sql"))?;
    }
    Ok(())
}

fn open_connection(path: &DatabasePath) -> rusqlite::Result<Connection> {
    Connection::open(&path.0)
}

fn task_column<'a>(task: &'a Value, key: &str) -> Option<&'a str> {
    task.get(key).and_then(Value::as_str)
}

fn parse_date_key(date: &str) -> Option<(i64, i64, i64)> {
    let mut parts = date.split('-');
    let year = parts.next()?.parse::<i64>().ok()?;
    let month = parts.next()?.parse::<i64>().ok()?;
    let day = parts.next()?.parse::<i64>().ok()?;
    if parts.next().is_some() || !(1..=12).contains(&month) {
        return None;
    }
    let max_day = days_in_month(year, month);
    if day < 1 || day > max_day {
        return None;
    }
    Some((year, month, day))
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let adjusted_year = year - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let shifted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * shifted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let era = days.div_euclid(146_097);
    let day_of_era = days - era * 146_097;
    let year_of_era = (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn format_date_key(year: i64, month: i64, day: i64) -> String {
    format!("{year:04}-{month:02}-{day:02}")
}

fn add_days_to_date_key(date: &str, days: i64) -> Option<String> {
    let (year, month, day) = parse_date_key(date)?;
    let (next_year, next_month, next_day) =
        civil_from_days(days_from_civil(year, month, day).checked_add(days)?);
    Some(format_date_key(next_year, next_month, next_day))
}

fn cycle_boundary(start_date: &str, interval: i64, unit: &str, cycle_number: i64) -> Option<String> {
    let (year, month, day) = parse_date_key(start_date)?;
    let offset = interval.checked_mul(cycle_number)?;
    match unit {
        "day" | "week" => {
            let days = if unit == "week" { offset.checked_mul(7)? } else { offset };
            let (next_year, next_month, next_day) = civil_from_days(days_from_civil(year, month, day).checked_add(days)?);
            Some(format_date_key(next_year, next_month, next_day))
        }
        "month" => {
            let total_month = year.checked_mul(12)?.checked_add(month - 1)?.checked_add(offset)?;
            let target_year = total_month.div_euclid(12);
            let target_month = total_month.rem_euclid(12) + 1;
            Some(format_date_key(target_year, target_month, day.min(days_in_month(target_year, target_month))))
        }
        _ => None,
    }
}

fn elapsed_cycle_boundaries(
    start_date: &str,
    interval: i64,
    unit: &str,
    last_processed_date: Option<&str>,
    today: &str,
) -> Vec<String> {
    let processed_through = last_processed_date.unwrap_or(start_date);
    let mut boundaries = Vec::new();
    let mut cycle_number = 1_i64;
    while let Some(boundary) = cycle_boundary(start_date, interval, unit, cycle_number) {
        if boundary.as_str() > today {
            break;
        }
        if boundary.as_str() > processed_through {
            boundaries.push(boundary);
        }
        let Some(next_cycle) = cycle_number.checked_add(1) else { break };
        cycle_number = next_cycle;
    }
    boundaries
}

fn upsert_task(transaction: &Transaction<'_>, task: &Value) -> rusqlite::Result<()> {
    let id = task_column(task, "id").unwrap_or_default();
    let status = task_column(task, "status").unwrap_or("inbox");
    let planned_date = task_column(task, "plannedDate");
    let sort_order = task.get("sortOrder").and_then(Value::as_i64).unwrap_or_default();

    transaction.execute(
        "INSERT INTO tasks (id, status, planned_date, sort_order, payload)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           planned_date = excluded.planned_date,
           sort_order = excluded.sort_order,
           payload = excluded.payload",
        params![id, status, planned_date, sort_order, task.to_string()],
    )?;
    Ok(())
}

#[tauri::command]
pub fn list_tasks(path: State<'_, DatabasePath>) -> Result<Vec<Value>, String> {
    let connection = open_connection(&path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT payload FROM tasks ORDER BY sort_order, id")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        let payload = row.map_err(|error| error.to_string())?;
        serde_json::from_str(&payload).map_err(|error| error.to_string())
    })
    .collect()
}

#[tauri::command]
pub fn list_decisions(path: State<'_, DatabasePath>) -> Result<Vec<Value>, String> {
    let connection = open_connection(&path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT payload FROM decisions ORDER BY created_at, id")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        let payload = row.map_err(|error| error.to_string())?;
        serde_json::from_str(&payload).map_err(|error| error.to_string())
    })
    .collect()
}

#[tauri::command]
pub fn save_task(path: State<'_, DatabasePath>, task: Value) -> Result<(), String> {
    let mut connection = open_connection(&path).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    upsert_task(&transaction, &task).map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn commit_state(
    path: State<'_, DatabasePath>,
    tasks: Vec<Value>,
    decisions: Vec<Value>,
) -> Result<(), String> {
    let mut connection = open_connection(&path).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;

    for task in tasks {
        upsert_task(&transaction, &task).map_err(|error| error.to_string())?;
    }
    for decision in decisions {
        let id = task_column(&decision, "id").unwrap_or_default();
        let task_id = task_column(&decision, "taskId").unwrap_or_default();
        let action = task_column(&decision, "action").unwrap_or_default();
        let created_at = task_column(&decision, "createdAt").unwrap_or_default();
        transaction
            .execute(
                "INSERT OR IGNORE INTO decisions (id, task_id, action, created_at, payload)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, task_id, action, created_at, decision.to_string()],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn process_missed_tasks(
    path: State<'_, DatabasePath>,
    today_local_date: String,
    processed_at: String,
) -> Result<(), String> {
    let mut connection = open_connection(&path).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let mut statement = transaction
        .prepare(
            "SELECT payload FROM tasks
             WHERE status = 'planned' AND planned_date IS NOT NULL AND planned_date < ?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([&today_local_date], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let payloads = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    drop(statement);

    for payload in payloads {
        let mut task: Value = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
        if task.get("deletedAt").is_some_and(|value| !value.is_null())
            || task.get("completedAt").is_some_and(|value| !value.is_null())
        {
            continue;
        }
        let planned_date = task_column(&task, "plannedDate").unwrap_or_default().to_string();
        let last_processed_date = task.get("lastProcessedCycleDate").and_then(Value::as_str);
        let recurrence = task.get("recurrence").and_then(|value| {
            let interval = value.get("interval")?.as_i64()?;
            let unit = value.get("unit")?.as_str()?;
            (interval > 0 && matches!(unit, "day" | "week" | "month"))
                .then_some((interval, unit))
        });

        if let Some((interval, unit)) = recurrence {
            let boundaries = elapsed_cycle_boundaries(
                &planned_date,
                interval,
                unit,
                last_processed_date,
                &today_local_date,
            );
            if boundaries.is_empty() {
                continue;
            }

            let task_id = task_column(&task, "id").unwrap_or_default();
            let mut carryover_count = task
                .get("carryoverCount")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let mut previous_boundary = last_processed_date.unwrap_or(&planned_date).to_string();
            for boundary in &boundaries {
                carryover_count += 1;
                let decision = serde_json::json!({
                    "id": format!("missed_cycle:{task_id}:{boundary}"),
                    "taskId": task_id,
                    "action": "missed_cycle",
                    "fromDate": previous_boundary,
                    "toDate": boundary,
                    "createdAt": processed_at.clone(),
                    "metadata": { "carryoverCount": carryover_count }
                });
                transaction
                    .execute(
                        "INSERT OR IGNORE INTO decisions (id, task_id, action, created_at, payload)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![
                            task_column(&decision, "id").unwrap_or_default(),
                            task_column(&decision, "taskId").unwrap_or_default(),
                            task_column(&decision, "action").unwrap_or_default(),
                            task_column(&decision, "createdAt").unwrap_or_default(),
                            decision.to_string()
                        ],
                    )
                    .map_err(|error| error.to_string())?;
                previous_boundary = boundary.clone();
            }

            task["carryoverCount"] = Value::from(carryover_count);
            task["lastProcessedCycleDate"] = Value::String(boundaries[boundaries.len() - 1].clone());
            task["updatedAt"] = Value::String(processed_at.clone());
            upsert_task(&transaction, &task).map_err(|error| error.to_string())?;
        } else {
            if planned_date >= today_local_date {
                continue;
            }

            let task_id = task_column(&task, "id").unwrap_or_default();
            let mut carryover_count = task
                .get("carryoverCount")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let mut missed_date = planned_date;
            while missed_date < today_local_date {
                if last_processed_date.map_or(true, |last| missed_date.as_str() > last) {
                    carryover_count += 1;
                    let next_date = add_days_to_date_key(&missed_date, 1)
                        .ok_or_else(|| "Invalid task date".to_string())?;
                    let decision = serde_json::json!({
                        "id": format!("missed_cycle:{task_id}:{missed_date}"),
                        "taskId": task_id,
                        "action": "missed_cycle",
                        "fromDate": missed_date,
                        "toDate": next_date,
                        "createdAt": processed_at.clone(),
                        "metadata": { "carryoverCount": carryover_count }
                    });
                    transaction
                        .execute(
                            "INSERT OR IGNORE INTO decisions (id, task_id, action, created_at, payload)
                             VALUES (?1, ?2, ?3, ?4, ?5)",
                            params![
                                task_column(&decision, "id").unwrap_or_default(),
                                task_column(&decision, "taskId").unwrap_or_default(),
                                task_column(&decision, "action").unwrap_or_default(),
                                task_column(&decision, "createdAt").unwrap_or_default(),
                                decision.to_string()
                            ],
                        )
                        .map_err(|error| error.to_string())?;
                }
                missed_date = add_days_to_date_key(&missed_date, 1)
                    .ok_or_else(|| "Invalid task date".to_string())?;
            }

            task["plannedDate"] = Value::String(today_local_date.clone());
            task["carryoverCount"] = Value::from(carryover_count);
            task["lastProcessedCycleDate"] = Value::String(
                add_days_to_date_key(&today_local_date, -1)
                    .ok_or_else(|| "Invalid current date".to_string())?,
            );
            task["updatedAt"] = Value::String(processed_at.clone());
            upsert_task(&transaction, &task).map_err(|error| error.to_string())?;
        }
    }

    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_preferences(path: State<'_, DatabasePath>) -> Result<Option<Value>, String> {
    let connection = open_connection(&path).map_err(|error| error.to_string())?;
    let payload = connection
        .query_row("SELECT payload FROM preferences WHERE id = 'default'", [], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(|error| error.to_string())?;
    payload
        .map(|value| serde_json::from_str(&value).map_err(|error| error.to_string()))
        .transpose()
}

#[tauri::command]
pub fn save_preferences(path: State<'_, DatabasePath>, preferences: Value) -> Result<(), String> {
    let connection = open_connection(&path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO preferences (id, payload) VALUES ('default', ?1)
             ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
            [preferences.to_string()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn seed_sample_data(
    path: State<'_, DatabasePath>,
    tasks: Vec<Value>,
    preferences: Value,
) -> Result<(), String> {
    let mut connection = open_connection(&path).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    for task in tasks {
        let id = task_column(&task, "id").unwrap_or_default();
        if !id.starts_with("sample-") {
            continue;
        }
        let exists: bool = transaction
            .query_row("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = ?1)", [id], |row| {
                row.get(0)
            })
            .map_err(|error| error.to_string())?;
        if !exists {
            upsert_task(&transaction, &task).map_err(|error| error.to_string())?;
        }
    }
    transaction
        .execute(
            "INSERT INTO preferences (id, payload) VALUES ('default', ?1)
             ON CONFLICT(id) DO NOTHING",
            [preferences.to_string()],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}
