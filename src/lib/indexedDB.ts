const DB_NAME = 'OfflineFirstApp';
const DB_VERSION = 3; // Increment for attendance store

export interface CachedUser {
  id: string;
  email: string;
  passwordHash: string;
  encryptedPassword?: string;
  lastLogin: number;
}

export interface FaceData {
  userId: string;
  faceDescriptor: number[];
  updatedAt: number;
}

export interface LocalUserDetails {
  id?: number;
  userId: string;
  name: string;
  age: number;
  phone: string;
  dateOfBirth: string;
  employee_id?: string;
  district?: string;
  block?: string;
  office_code?: string;
  pendingSync: boolean;
  updatedAt: number;
}

export interface LocalAttendanceRecord {
  id?: number;
  user_id: string;
  date: string;
  time_in?: string;
  time_out?: string;
  status: string;
  shift_type?: string;
  od_work_type?: string;
  office_code?: string;
  employee_id?: string;
  employee_name?: string;
  time_in_latitude?: number;
  time_in_longitude?: number;
  time_out_latitude?: number;
  time_out_longitude?: number;
  time_in_face_verified?: boolean;
  time_out_face_verified?: boolean;
  working_hours?: string;
  distance_from_office?: number;
  within_geo_fence?: boolean;
  notes?: string;
  pending_sync: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Cached users store
        if (!db.objectStoreNames.contains('cachedUsers')) {
          const userStore = db.createObjectStore('cachedUsers', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }

        // User details store
        if (!db.objectStoreNames.contains('userDetails')) {
          const detailsStore = db.createObjectStore('userDetails', {
            keyPath: 'id',
            autoIncrement: true,
          });
          detailsStore.createIndex('userId', 'userId', { unique: true });
          detailsStore.createIndex('pendingSync', 'pendingSync', { unique: false });
        }

        // Face data store
        if (!db.objectStoreNames.contains('faceData')) {
          const faceStore = db.createObjectStore('faceData', { keyPath: 'userId' });
          faceStore.createIndex('userId', 'userId', { unique: true });
        }

        // Attendance store
        if (!db.objectStoreNames.contains('attendance')) {
          const attendanceStore = db.createObjectStore('attendance', {
            keyPath: 'id',
            autoIncrement: true,
          });
          attendanceStore.createIndex('user_id', 'user_id', { unique: false });
          attendanceStore.createIndex('date', 'date', { unique: false });
          attendanceStore.createIndex('user_date', ['user_id', 'date'], { unique: false });
          attendanceStore.createIndex('pending_sync', 'pending_sync', { unique: false });
        }

        // Office locations store
        if (!db.objectStoreNames.contains('officeLocations')) {
          const officeStore = db.createObjectStore('officeLocations', { keyPath: 'office_code' });
          officeStore.createIndex('office_code', 'office_code', { unique: true });
        }
      };
    });
  }

  // ===== CACHED USERS METHODS =====
  
  async cacheUser(user: CachedUser): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedUsers'], 'readwrite');
      const store = transaction.objectStore('cachedUsers');
      const request = store.put(user);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedUser(email: string): Promise<CachedUser | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedUsers'], 'readonly');
      const store = transaction.objectStore('cachedUsers');
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedUsers(): Promise<CachedUser[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedUsers'], 'readonly');
      const store = transaction.objectStore('cachedUsers');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== USER DETAILS METHODS =====

  async saveUserDetails(details: LocalUserDetails): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userDetails'], 'readwrite');
      const store = transaction.objectStore('userDetails');
      const index = store.index('userId');
      const getRequest = index.get(details.userId);

      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
        const dataToSave = existingRecord
          ? { ...details, id: existingRecord.id }
          : details;

        const putRequest = store.put(dataToSave);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getUserDetails(userId: string): Promise<LocalUserDetails | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userDetails'], 'readonly');
      const store = transaction.objectStore('userDetails');
      const index = store.index('userId');
      const request = index.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncRecords(): Promise<LocalUserDetails[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userDetails'], 'readonly');
      const store = transaction.objectStore('userDetails');
      const request = store.getAll();

      request.onsuccess = () => {
        const allRecords = request.result || [];
        const pendingRecords = allRecords.filter(record => record.pendingSync === true);
        resolve(pendingRecords);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAsSynced(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userDetails'], 'readwrite');
      const store = transaction.objectStore('userDetails');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.pendingSync = false;
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ===== FACE DATA METHODS =====

  async saveFaceData(faceData: FaceData): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['faceData'], 'readwrite');
      const store = transaction.objectStore('faceData');
      const request = store.put(faceData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFaceData(userId: string): Promise<FaceData | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['faceData'], 'readonly');
      const store = transaction.objectStore('faceData');
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFaceData(): Promise<FaceData[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['faceData'], 'readonly');
      const store = transaction.objectStore('faceData');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async hasFaceData(userId: string): Promise<boolean> {
    const faceData = await this.getFaceData(userId);
    return faceData !== null && faceData.faceDescriptor.length > 0;
  }

  // ===== ATTENDANCE METHODS =====

  async saveAttendanceRecord(record: LocalAttendanceRecord): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance'], 'readwrite');
      const store = transaction.objectStore('attendance');
      const index = store.index('user_date');
      const getRequest = index.get([record.user_id, record.date]);

      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
        const dataToSave = existingRecord
          ? { ...record, id: existingRecord.id }
          : record;

        const putRequest = store.put(dataToSave);
        putRequest.onsuccess = () => resolve(putRequest.result as number);
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getAttendanceRecord(userId: string, date: string): Promise<LocalAttendanceRecord | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const index = store.index('user_date');
      const request = index.get([userId, date]);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserAttendanceRecords(userId: string): Promise<LocalAttendanceRecord[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const index = store.index('user_id');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingAttendanceRecords(): Promise<LocalAttendanceRecord[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const request = store.getAll();

      request.onsuccess = () => {
        const allRecords = request.result || [];
        const pendingRecords = allRecords.filter(record => record.pending_sync === true);
        resolve(pendingRecords);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAttendanceAsSynced(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance'], 'readwrite');
      const store = transaction.objectStore('attendance');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.pending_sync = false;
          record.synced_to_mssql = true;
          record.last_synced_at = new Date().toISOString();
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ===== OFFICE LOCATION METHODS =====

  async saveOfficeLocation(location: any): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['officeLocations'], 'readwrite');
      const store = transaction.objectStore('officeLocations');
      const request = store.put(location);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getOfficeLocation(officeCode: string): Promise<any> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['officeLocations'], 'readonly');
      const store = transaction.objectStore('officeLocations');
      const request = store.get(officeCode);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllOfficeLocations(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['officeLocations'], 'readonly');
      const store = transaction.objectStore('officeLocations');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBService = new IndexedDBService();