import { supabase } from '../lib/supabase';
import { indexedDBService, LocalUserDetails } from '../lib/indexedDB';

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
    this.notifyListeners({ isSyncing: true, pendingCount: 0 });

    try {
      const pendingRecords = await indexedDBService.getPendingSyncRecords();

      if (pendingRecords.length === 0) {
        this.isSyncing = false;
        this.lastSyncTime = Date.now();
        this.notifyListeners({
          isSyncing: false,
          lastSyncTime: this.lastSyncTime,
          pendingCount: 0,
        });
        return;
      }

      for (const record of pendingRecords) {
        await this.syncRecord(record);
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
      const pendingRecords = await indexedDBService.getPendingSyncRecords();
      this.notifyListeners({
        isSyncing: false,
        pendingCount: pendingRecords.length,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  private async syncRecord(record: LocalUserDetails): Promise<void> {
    const { data: existingData } = await supabase
      .from('user_details')
      .select('updated_at')
      .eq('user_id', record.userId)
      .maybeSingle();

    if (existingData) {
      const remoteUpdatedAt = new Date(existingData.updated_at).getTime();
      if (record.updatedAt > remoteUpdatedAt) {
        await supabase
          .from('user_details')
          .update({
            name: record.name,
            age: record.age,
            phone: record.phone,
            date_of_birth: record.dateOfBirth,
            updated_at: new Date(record.updatedAt).toISOString(),
          })
          .eq('user_id', record.userId);
      }
    } else {
      await supabase.from('user_details').insert({
        user_id: record.userId,
        name: record.name,
        age: record.age,
        phone: record.phone,
        date_of_birth: record.dateOfBirth,
        updated_at: new Date(record.updatedAt).toISOString(),
      });
    }

    if (record.id) {
      await indexedDBService.markAsSynced(record.id);
    }
  }

  async getPendingCount(): Promise<number> {
    const records = await indexedDBService.getPendingSyncRecords();
    return records.length;
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
