CREATE TABLE IF NOT EXISTS flood_predictions (
  id SERIAL PRIMARY KEY,
  city TEXT,
  risk_score DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sos_reports (
  id SERIAL PRIMARY KEY,
  text TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_url TEXT,
  status TEXT DEFAULT 'verified',
  verified BOOLEAN DEFAULT true,
  severity TEXT DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW()
);