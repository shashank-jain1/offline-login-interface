import { supabase } from '../lib/supabase';
import { indexedDBService, LocalUserDetails, LocalAttendanceRecord } from '../lib/indexedDB';

export type SyncListener = (status: SyncStatus) => void;

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: number;
  pendingCount: number;
  error?: string;
}

class SyncService {
  private listeners: SyncListener[] = [];
  private isSyncing = false;
  private lastSyncTime?: number;

  async syncPendingData(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      // Check if we have a valid session FIRST
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No valid session - need to reauth
        const pendingUserDetails = await indexedDBService.getPendingSyncRecords();
        const pendingAttendance = await indexedDBService.getPendingAttendanceRecords();
        const totalPending = pendingUserDetails.length + pendingAttendance.length;

        this.isSyncing = false;
        this.notifyListeners({
          isSyncing: false,
          pendingCount: totalPending,
          error: 'Authentication required. Please log in again to sync your changes.',
        });
        return;
      }

      // Get pending records
      const pendingUserDetails = await indexedDBService.getPendingSyncRecords();
      const pendingAttendance = await indexedDBService.getPendingAttendanceRecords();
      const totalPending = pendingUserDetails.length + pendingAttendance.length;

      this.notifyListeners({ isSyncing: true, pendingCount: totalPending });

      if (totalPending === 0) {
        this.isSyncing = false;
        this.lastSyncTime = Date.now();
        this.notifyListeners({
          isSyncing: false,
          lastSyncTime: this.lastSyncTime,
          pendingCount: 0,
        });
        return;
      }

      // Sync user details
      for (const record of pendingUserDetails) {
        await this.syncUserDetailsRecord(record);
      }

      // Sync attendance records
      for (const record of pendingAttendance) {
        await this.syncAttendanceRecord(record);
      }

      this.lastSyncTime = Date.now();
      this.isSyncing = false;
      this.notifyListeners({
        isSyncing: false,
        lastSyncTime: this.lastSyncTime,
        pendingCount: 0,
      });
    } catch (error) {
      this.isSyncing = false;
      let pendingCount = 0;
      try {
        const pendingUserDetails = await indexedDBService.getPendingSyncRecords();
        const pendingAttendance = await indexedDBService.getPendingAttendanceRecords();
        pendingCount = pendingUserDetails.length + pendingAttendance.length;
      } catch {
        // Ignore error getting pending count
      }
      this.notifyListeners({
        isSyncing: false,
        pendingCount,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  private async syncUserDetailsRecord(record: LocalUserDetails): Promise<void> {
    const { data: existingData } = await supabase
      .from('user_details')
      .select('updated_at')
      .eq('user_id', record.userId)
      .maybeSingle();

    const syncData = {
      name: record.name,
      age: record.age,
      phone: record.phone,
      date_of_birth: record.dateOfBirth,
      employee_id: record.employee_id,
      district: record.district,
      block: record.block,
      office_code: record.office_code,
      updated_at: new Date(record.updatedAt).toISOString(),
    };

    if (existingData) {
      const remoteUpdatedAt = new Date(existingData.updated_at).getTime();
      if (record.updatedAt > remoteUpdatedAt) {
        await supabase
          .from('user_details')
          .update(syncData)
          .eq('user_id', record.userId);
      }
    } else {
      await supabase.from('user_details').insert({
        user_id: record.userId,
        ...syncData,
      });
    }

    if (record.id) {
      await indexedDBService.markAsSynced(record.id);
    }
  }

  private async syncAttendanceRecord(record: LocalAttendanceRecord): Promise<void> {
    // Remove local-only fields
    const { id, pending_sync: _pending_sync, ...attendanceData } = record;
    void _pending_sync; // Acknowledge _pending_sync is intentionally unused

    // Check if record exists
    const { data: existingData } = await supabase
      .from('attendance')
      .select('id, updated_at')
      .eq('user_id', record.user_id)
      .eq('date', record.date)
      .maybeSingle();

    if (existingData) {
      // Update existing record
      await supabase
        .from('attendance')
        .update(attendanceData)
        .eq('id', existingData.id);
    } else {
      // Insert new record
      await supabase
        .from('attendance')
        .insert(attendanceData);
    }

    // Mark as synced in IndexedDB
    if (id) {
      await indexedDBService.markAttendanceAsSynced(id);
    }
  }

  async getPendingCount(): Promise<number> {
    const userDetailsRecords = await indexedDBService.getPendingSyncRecords();
    const attendanceRecords = await indexedDBService.getPendingAttendanceRecords();
    return userDetailsRecords.length + attendanceRecords.length;
  }

  addListener(listener: SyncListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: SyncListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(status: SyncStatus) {
    this.listeners.forEach(listener => listener(status));
  }
}

export const syncService = new SyncService();