import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';
import { syncService, SyncStatus } from '../services/syncService';
import { logout } from '../services/authService';

interface SyncIndicatorProps {
  isOnline: boolean;
  onLogout: () => void;
}

export function SyncIndicator({ isOnline, onLogout }: SyncIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
  });

  useEffect(() => {
    const listener = (status: SyncStatus) => {
      setSyncStatus(status);
    };

    syncService.addListener(listener);

    syncService.getPendingCount().then(count => {
      setSyncStatus(prev => ({ ...prev, pendingCount: count }));
    });

    return () => {
      syncService.removeListener(listener);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-600">Offline</span>
              </>
            )}
          </div>

          {syncStatus.isSyncing && (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-600">Syncing...</span>
            </div>
          )}

          {!syncStatus.isSyncing && syncStatus.pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                {syncStatus.pendingCount} pending {syncStatus.pendingCount === 1 ? 'change' : 'changes'}
              </span>
            </div>
          )}

          {!syncStatus.isSyncing && syncStatus.pendingCount === 0 && syncStatus.lastSyncTime && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">All synced</span>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
