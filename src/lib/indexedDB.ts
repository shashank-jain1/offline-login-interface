const DB_NAME = 'OfflineFirstApp';
const DB_VERSION = 2; // Increment version for new object store

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
  pendingSync: boolean;
  updatedAt: number;
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

        if (!db.objectStoreNames.contains('cachedUsers')) {
          const userStore = db.createObjectStore('cachedUsers', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }

        if (!db.objectStoreNames.contains('userDetails')) {
          const detailsStore = db.createObjectStore('userDetails', {
            keyPath: 'id',
            autoIncrement: true,
          });
          detailsStore.createIndex('userId', 'userId', { unique: true });
          detailsStore.createIndex('pendingSync', 'pendingSync', { unique: false });
        }

        // NEW: Separate face data store
        if (!db.objectStoreNames.contains('faceData')) {
          const faceStore = db.createObjectStore('faceData', { keyPath: 'userId' });
          faceStore.createIndex('userId', 'userId', { unique: true });
        }
      };
    });
  }

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

  // NEW: Face data methods
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
}

export const indexedDBService = new IndexedDBService();