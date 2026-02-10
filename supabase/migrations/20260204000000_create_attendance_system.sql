
-- Create office_locations table first
CREATE TABLE IF NOT EXISTS office_locations (
  id SERIAL PRIMARY KEY,
  office_code VARCHAR(255) UNIQUE NOT NULL,
  office_name VARCHAR(255) NOT NULL,
  district VARCHAR(255),
  block VARCHAR(255),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  geofence_radius INT DEFAULT 200,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create attendance table with all columns
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  status VARCHAR(50) DEFAULT 'In Progress',
  shift_type VARCHAR(50),
  od_work_type VARCHAR(100),
  attendance_type VARCHAR(20),
  geo_location VARCHAR(100),
  face_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  image_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  check_in TIME,
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  accuracy VARCHAR(20),
  distance_from_office FLOAT,
  office_latitude VARCHAR(20),
  office_longitude VARCHAR(20),
  photo VARCHAR(255),
  blink_detected BOOLEAN DEFAULT FALSE,
  within_geo_fence BOOLEAN DEFAULT FALSE,
  district VARCHAR(255),
  block VARCHAR(255),
  office_code VARCHAR(255),
  employee_id VARCHAR(255),
  employee_name VARCHAR(255),
  time_in_latitude DECIMAL(10,8),
  time_in_longitude DECIMAL(11,8),
  time_out_latitude DECIMAL(10,8),
  time_out_longitude DECIMAL(11,8),
  time_in_geo_location VARCHAR(100),
  time_out_geo_location VARCHAR(100),
  time_in_image_path VARCHAR(255),
  time_out_image_path VARCHAR(255),
  time_in_face_verified BOOLEAN DEFAULT FALSE,
  time_out_face_verified BOOLEAN DEFAULT FALSE,
  working_hours TIME,
  is_late BOOLEAN DEFAULT FALSE,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_address TEXT,
  synced_to_mssql BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMP,
  time_in_distance DECIMAL(10,2),
  time_out_distance DECIMAL(10,2),
  pending_sync BOOLEAN DEFAULT FALSE,
  
  UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_office_code ON attendance(office_code);
CREATE INDEX idx_pending_sync ON attendance(pending_sync);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own attendance"
  ON attendance FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Everyone can view office locations"
  ON office_locations FOR SELECT
  TO authenticated
  USING (true);

-- Insert sample office locations (REPLACE WITH YOUR ACTUAL DATA)
INSERT INTO office_locations (office_code, office_name, district, block, latitude, longitude)
VALUES 
  ('HQ001', 'Head Office Bhopal', 'Bhopal', 'HQ', 23.2599, 77.4126, 200),
  ('DIST001', 'District Office', 'Your District', 'Block 1', 0.0, 0.0, 200)
ON CONFLICT (office_code) DO NOTHING;