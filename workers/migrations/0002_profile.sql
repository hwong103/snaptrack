CREATE TABLE IF NOT EXISTS user_profile (
  user_id         TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  display_name    TEXT,
  age             INTEGER,
  sex             TEXT CHECK(sex IN ('male','female','other')),
  height_cm       REAL,
  weight_kg       REAL,
  activity_level  TEXT CHECK(activity_level IN ('sedentary','light','moderate','active','very_active'))
                  DEFAULT 'moderate',
  daily_goal_kcal INTEGER NOT NULL DEFAULT 2000,
  goal_suggested  INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER DEFAULT (unixepoch()),
  updated_at      INTEGER DEFAULT (unixepoch())
);
