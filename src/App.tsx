import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { UserDetailsForm } from './components/UserDetailsForm';
import { SyncIndicator } from './components/SyncIndicator';
import { ReauthModal } from './components/ReauthModal';
import { connectivityDetector } from './utils/connectivity';
import { syncService } from './services/syncService';
import { indexedDBService } from './lib/indexedDB';
import { loginOnline } from './services/authService';

interface UserSession {
  userId: string;
  email: string;
  isOfflineMode: boolean;
}

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);

  useEffect(() => {
    indexedDBService.init();

    const connectivityListener = async (online: boolean) => {
      setIsOnline(online);
      
      if (online && userSession) {
        // Check if there are pending changes and if we're in offline mode
        const pendingCount = await syncService.getPendingCount();
        
        if (pendingCount > 0 && userSession.isOfflineMode) {
          // Show reauth modal to get password
          setShowReauthModal(true);
        } else {
          // Normal sync
          setTimeout(() => syncService.syncPendingData(), 1000);
        }
      }
    };

    connectivityDetector.addListener(connectivityListener);

    return () => {
      connectivityDetector.removeListener(connectivityListener);
    };
  }, [userSession]);

  const handleLoginSuccess = (userId: string, email: string, isOfflineMode: boolean) => {
    setUserSession({ userId, email, isOfflineMode });
    
    // Trigger sync after login if online
    if (isOnline) {
      setTimeout(() => syncService.syncPendingData(), 1000);
    }
  };

  const handleReauth = async (password: string): Promise<boolean> => {
    if (!userSession) return false;
    
    const result = await loginOnline(userSession.email, password);
    
    if (result.success) {
      // Update session to mark as online mode
      setUserSession({
        ...userSession,
        isOfflineMode: false,
      });
      
      // Close modal and sync
      setShowReauthModal(false);
      setTimeout(() => syncService.syncPendingData(), 500);
      return true;
    }
    
    return false;
  };

  const handleLogout = () => {
    setUserSession(null);
  };

  if (!userSession) {
    return <Login isOnline={isOnline} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <SyncIndicator isOnline={isOnline} onLogout={handleLogout} />
      <div className="pt-16">
        <UserDetailsForm
          userId={userSession.userId}
          email={userSession.email}
          isOnline={isOnline}
          isOfflineMode={userSession.isOfflineMode}
        />
      </div>
      
      {showReauthModal && (
        <ReauthModal
          email={userSession.email}
          onReauth={handleReauth}
          onCancel={() => setShowReauthModal(false)}
        />
      )}
    </>
  );
}

export default App;