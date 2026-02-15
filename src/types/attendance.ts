
export type AttendanceStatus = 'Present' | 'Absent' | 'On Leave' | 'On Training' | 'Half Day' | 'In Progress';
export type ShiftType = 'Morning' | 'Evening';
export type ODWorkType = 'Meeting' | 'Evaluation' | 'School Work' | 'Survey/BLO' | 'Exam_Duty' | 'Election_Duty' | 'Sports_Event';

export interface AttendanceRecord {
  id?: number;
  user_id: string;
  date: string;
  time_in?: string;
  time_out?: string;
  status: AttendanceStatus;
  shift_type?: ShiftType;
  od_work_type?: ODWorkType;
  attendance_type?: string;
  geo_location?: string;
  face_verified?: boolean;
  notes?: string;
  image_path?: string;
  created_at?: string;
  updated_at?: string;
  check_in?: string;
  latitude?: string;
  longitude?: string;
  accuracy?: string;
  distance_from_office?: number;
  office_latitude?: string;
  office_longitude?: string;
  photo?: string;
  blink_detected?: boolean;
  within_geo_fence?: boolean;
  district?: string;
  block?: string;
  office_code?: string;
  employee_id?: string;
  employee_name?: string;
  time_in_latitude?: number;
  time_in_longitude?: number;
  time_out_latitude?: number;
  time_out_longitude?: number;
  time_in_geo_location?: string;
  time_out_geo_location?: string;
  time_in_image_path?: string;
  time_out_image_path?: string;
  time_in_face_verified?: boolean;
  time_out_face_verified?: boolean;
  working_hours?: string;
  is_late?: boolean;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  synced_to_mssql?: boolean;
  last_synced_at?: string;
  time_in_distance?: number;
  time_out_distance?: number;
  pending_sync?: boolean;
}

export interface OfficeLocation {
  id: number;
  office_code: string;
  office_name: string;
  district: string;
  block: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  avgWorkingHours: string;
}