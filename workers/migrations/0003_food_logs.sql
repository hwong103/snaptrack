CREATE TABLE IF NOT EXISTS food_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  logged_at   INTEGER NOT NULL,
  name        TEXT NOT NULL,
  calories    INTEGER NOT NULL,
  protein_g   REAL,
  carbs_g     REAL,
  fat_g       REAL,
  confidence  INTEGER,
  notes       TEXT,
  source      TEXT NOT NULL DEFAULT 'vision'
              CHECK(source IN ('vision','manual')),
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_day
  ON food_logs(user_id, logged_at);
