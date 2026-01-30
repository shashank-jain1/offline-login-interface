export type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityDetector {
  private listeners: ConnectivityListener[] = [];
  private isOnline: boolean = navigator.onLine;

  constructor() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notifyListeners(true);
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notifyListeners(false);
  };

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  public addListener(listener: ConnectivityListener) {
    this.listeners.push(listener);
    listener(this.isOnline);
  }

  public removeListener(listener: ConnectivityListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners = [];
  }
}

export const connectivityDetector = new ConnectivityDetector();
