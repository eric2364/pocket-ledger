CREATE TABLE wallet_records (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
