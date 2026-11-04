-- Схема БД информационной системы «Прокат автомобилей» (SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  iin         TEXT NOT NULL UNIQUE CHECK (length(iin) = 12),
  phone       TEXT NOT NULL,
  license_no  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS cars (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  brand       TEXT NOT NULL,
  model       TEXT NOT NULL,
  plate       TEXT NOT NULL UNIQUE,
  vin         TEXT,
  year        INTEGER NOT NULL,
  daily_price INTEGER NOT NULL CHECK (daily_price > 0),
  status      TEXT NOT NULL DEFAULT 'free'
              CHECK (status IN ('free', 'rented', 'service')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS rentals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id),
  car_id      INTEGER NOT NULL REFERENCES cars(id),
  date_from   TEXT NOT NULL,
  date_to     TEXT NOT NULL,
  total       INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_rentals_car ON rentals(car_id);
CREATE INDEX IF NOT EXISTS idx_rentals_client ON rentals(client_id);
