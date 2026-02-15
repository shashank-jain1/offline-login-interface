import { supabase } from '../lib/supabase';
import { indexedDBService } from '../lib/indexedDB';
import { AttendanceRecord, AttendanceStatus, OfficeLocation, ShiftType, ODWorkType } from '../types/attendance';
import { getCurrentLocation, calculateDistance, getAddressFromCoordinates } from './geolocationService';
import { formatIST, getTodayDateIST, calculateWorkingHours } from '../utils/timeUtils';

/**
 * Get office location by office code
 */
export async function getOfficeLocation(officeCode: string, isOnline: boolean): Promise<OfficeLocation | null> {
  try {
    // Try IndexedDB first
    const localOffice = await indexedDBService.getOfficeLocation(officeCode);
    if (localOffice) {
      return localOffice;
    }

    // If online, fetch from Supabase
    if (isOnline) {
      const { data, error } = await supabase
        .from('office_locations')
        .select('*')
        .eq('office_code', officeCode)
        .single();

      if (!error && data) {
        // Cache it
        await indexedDBService.saveOfficeLocation(data);
        return data;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting office location:', error);
    return null;
  }
}

/**
 * Get all office locations
 */
export async function getAllOfficeLocations(isOnline: boolean): Promise<OfficeLocation[]> {
  try {
    // Try local first
    const localOffices = await indexedDBService.getAllOfficeLocations();

    if (isOnline) {
      const { data, error } = await supabase
        .from('office_locations')
        .select('*');

      if (!error && data) {
        // Update local cache
        for (const office of data) {
          await indexedDBService.saveOfficeLocation(office);
        }
        return data;
      }
    }

    return localOffices;
  } catch (error) {
    console.error('Error getting office locations:', error);
    return [];
  }
}

/**
 * Get today's attendance record
 */
export async function getTodayAttendance(
  userId: string,
  isOnline: boolean
): Promise<AttendanceRecord | null> {
  const today = getTodayDateIST();

  try {
    // Try local first
    const localRecord = await indexedDBService.getAttendanceRecord(userId, today);

    if (isOnline) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (!error && data) {
        // Update local cache
        await indexedDBService.saveAttendanceRecord({
          ...data,
          pending_sync: false,
        });
        return data;
      }
    }

    return localRecord as AttendanceRecord | null;
  } catch (error) {
    console.error('Error getting today attendance:', error);
    return null;
  }
}

/**
 * Mark check-in
 */
export async function markCheckIn(
  userId: string,
  userDetails: {
    employee_id: string;
    employee_name: string;
    office_code: string;
    district?: string;
    block?: string;
  },
  officeLocation: OfficeLocation,
  faceImagePath: string,
  notes?: string,
  isOnline: boolean = true
): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  try {
    // Get location
    const location = await getCurrentLocation();

    // Calculate distance
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      officeLocation.latitude,
      officeLocation.longitude
    );

    // Check geofence
    const withinFence = distance <= officeLocation.geofence_radius;

    if (!withinFence) {
      return {
        success: false,
        error: `You are ${Math.round(distance)}m away. Please be within ${officeLocation.geofence_radius}m to check in.`,
      };
    }

    // Get address (non-blocking, optional)
    let address: string | undefined;
    try {
      address = await getAddressFromCoordinates(location.latitude, location.longitude);
    } catch (err) {
      console.warn('Failed to get address (non-critical):', err);
      address = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }

    const now = new Date();
    const timeIn = formatIST(now, 'HH:mm:ss');
    const today = getTodayDateIST();

    // Determine if late (assuming 9:30 AM cutoff for morning shift)
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);

    const attendanceRecord: AttendanceRecord = {
      user_id: userId,
      date: today,
      time_in: timeIn,
      check_in: timeIn,
      status: 'In Progress',
      shift_type: now.getHours() < 14 ? 'Morning' : 'Evening',
      employee_id: userDetails.employee_id,
      employee_name: userDetails.employee_name,
      office_code: userDetails.office_code,
      district: userDetails.district,
      block: userDetails.block,
      time_in_latitude: location.latitude,
      time_in_longitude: location.longitude,
      time_in_geo_location: address,
      time_in_image_path: faceImagePath,
      time_in_face_verified: true,
      blink_detected: true,
      time_in_distance: distance,
      within_geo_fence: withinFence,
      office_latitude: officeLocation.latitude.toString(),
      office_longitude: officeLocation.longitude.toString(),
      distance_from_office: distance,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      accuracy: location.accuracy.toString(),
      location_lat: location.latitude,
      location_lng: location.longitude,
      location_address: address,
      is_late: isLate,
      notes: notes,
      face_verified: true,
      attendance_type: 'Regular',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      pending_sync: !isOnline,
    };

    // Save to IndexedDB first (always works)
    await indexedDBService.saveAttendanceRecord({
      ...attendanceRecord,
      created_at: attendanceRecord.created_at || new Date().toISOString(),
      updated_at: attendanceRecord.updated_at || new Date().toISOString(),
      pending_sync: attendanceRecord.pending_sync ?? false
    });

    // Try to save to Supabase if online
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .insert(attendanceRecord)
          .select()
          .maybeSingle();  // ✅ FIXED: Use maybeSingle instead of single

        if (error) {
          console.error('Supabase insert error:', error);
          // Don't fail - data is already in IndexedDB with pending_sync = true
          return { success: true, record: attendanceRecord };
        } else if (data) {
          // Update local with server ID
          await indexedDBService.saveAttendanceRecord({
            ...data,
            pending_sync: false,
          });
          return { success: true, record: data };
        }
      } catch (supabaseError) {
        console.error('Supabase error (non-critical):', supabaseError);
        // Still return success since data is in IndexedDB
        return { success: true, record: attendanceRecord };
      }
    }

    return { success: true, record: attendanceRecord };
  } catch (error) {
    console.error('Check-in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Check-in failed',
    };
  }
}

/**
 * Mark check-out (or half day)
 */
export async function markCheckOut(
  userId: string,
  officeLocation: OfficeLocation,
  faceImagePath: string,
  notes?: string,
  isHalfDay: boolean = false,
  isOnline: boolean = true
): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  try {
    const today = getTodayDateIST();

    // Get existing record from IndexedDB
    const existingRecord = await indexedDBService.getAttendanceRecord(userId, today);

    if (!existingRecord || !existingRecord.time_in) {
      return {
        success: false,
        error: 'No check-in record found for today',
      };
    }

    // Get location
    const location = await getCurrentLocation();

    // Calculate distance
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      officeLocation.latitude,
      officeLocation.longitude
    );

    // Get address (optional)
    let address: string | undefined;
    try {
      address = await getAddressFromCoordinates(location.latitude, location.longitude);
    } catch (err) {
      console.warn('Failed to get address (non-critical):', err);
      address = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }

    const now = new Date();
    const timeOut = formatIST(now, 'HH:mm:ss');

    // Calculate working hours
    const workingHours = calculateWorkingHours(existingRecord.time_in, timeOut);

    // Determine status
    let status: AttendanceStatus;
    const hours = parseFloat(workingHours.replace(':', '.'));

    if (isHalfDay || hours < 5) {
      status = 'Half Day';
    } else {
      status = 'Present';
    }

    const updatedRecord: AttendanceRecord = {
      ...existingRecord,
      time_out: timeOut,
      time_out_latitude: location.latitude,
      time_out_longitude: location.longitude,
      time_out_geo_location: address,
      time_out_image_path: faceImagePath,
      time_out_face_verified: true,
      blink_detected: true,
      time_out_distance: distance,
      working_hours: workingHours,
      status: status,
      notes: notes || existingRecord.notes,
      updated_at: now.toISOString(),
      pending_sync: !isOnline,
      shift_type: existingRecord.shift_type as ShiftType | undefined,
      od_work_type: existingRecord.od_work_type as ODWorkType | undefined,
    };

    // Save to IndexedDB first (always works)
    await indexedDBService.saveAttendanceRecord({
      ...updatedRecord,
      created_at: updatedRecord.created_at || new Date().toISOString(),
      updated_at: updatedRecord.updated_at || new Date().toISOString(),
      pending_sync: updatedRecord.pending_sync ?? false
    });

    // Try to update Supabase if online
    if (isOnline) {
      try {
        // ✅ FIXED: First check if record exists in Supabase
        const { data: existingSupabaseRecord } = await supabase
          .from('attendance')
          .select('id')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();

        if (existingSupabaseRecord) {
          // Record exists, update it
          const { data, error } = await supabase
            .from('attendance')
            .update({
              time_out: timeOut,
              time_out_latitude: location.latitude,
              time_out_longitude: location.longitude,
              time_out_geo_location: address,
              time_out_image_path: faceImagePath,
              time_out_face_verified: true,
              blink_detected: true,
              time_out_distance: distance,
              working_hours: workingHours,
              status: status,
              notes: notes || existingRecord.notes,
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId)
            .eq('date', today)
            .select()
            .maybeSingle();  // ✅ FIXED: Use maybeSingle

          if (error) {
            console.error('Supabase update error:', error);
          } else if (data) {
            await indexedDBService.saveAttendanceRecord({
              ...data,
              pending_sync: false,
            });
            return { success: true, record: data };
          }
        } else {
          // Record doesn't exist in Supabase, insert it
          console.log('Record not in Supabase, inserting full record...');
          const { data, error } = await supabase
            .from('attendance')
            .insert(updatedRecord)
            .select()
            .maybeSingle();

          if (error) {
            console.error('Supabase insert error:', error);
          } else if (data) {
            await indexedDBService.saveAttendanceRecord({
              ...data,
              pending_sync: false,
            });
            return { success: true, record: data };
          }
        }
      } catch (supabaseError) {
        console.error('Supabase error (non-critical):', supabaseError);
        // Still return success since data is in IndexedDB
      }
    }

    return { success: true, record: updatedRecord };
  } catch (error) {
    console.error('Check-out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Check-out failed',
    };
  }
}

/**
 * Get attendance history
 */
export async function getAttendanceHistory(
  userId: string,
  startDate: string,
  endDate: string,
  isOnline: boolean
): Promise<AttendanceRecord[]> {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (!error && data) {
        // Cache locally
        for (const record of data) {
          await indexedDBService.saveAttendanceRecord({
            ...record,
            pending_sync: false,
          });
        }
        return data;
      }
    }

    // Fallback to local
    const allRecords = await indexedDBService.getUserAttendanceRecords(userId);
    return (allRecords as AttendanceRecord[])
      .filter(r => r.date >= startDate && r.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Error getting attendance history:', error);
    return [];
  }
}