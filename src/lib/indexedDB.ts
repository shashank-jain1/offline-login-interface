const DB_NAME = 'OfflineFirstApp';
const DB_VERSION = 1;

export interface CachedUser {
  id: string;
  email: string;
  passwordHash: string;
  lastLogin: number;
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
      const request = store.put(details);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
      const index = store.index('pendingSync');
      const request = index.getAll(true);

      request.onsuccess = () => resolve(request.result || []);
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
}

export const indexedDBService = new IndexedDBService();
