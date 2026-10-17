CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  planned_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON tasks(status, planned_date);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_task_created ON decisions(task_id, created_at);

CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);

PRAGMA user_version = 1;
