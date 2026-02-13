SET client_encoding TO 'UTF8';
CREATE TABLE IF NOT EXISTS substations (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Вбудована', 'Окремо стояча', 'Щоглова')),
  apartments_count INTEGER NOT NULL CHECK (apartments_count > 0),
  power REAL NOT NULL CHECK (power > 0),
  last_repair_date DATE NOT NULL
);
