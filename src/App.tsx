import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { UserDetailsForm } from './components/UserDetailsForm';
import { SyncIndicator } from './components/SyncIndicator';
import { connectivityDetector } from './utils/connectivity';
import { syncService } from './services/syncService';
import { indexedDBService } from './lib/indexedDB';

interface UserSession {
  userId: string;
  email: string;
  isOfflineMode: boolean;
}

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  useEffect(() => {
    indexedDBService.init();

    const connectivityListener = (online: boolean) => {
      setIsOnline(online);
      if (online) {
        syncService.syncPendingData();
      }
    };

    connectivityDetector.addListener(connectivityListener);

    return () => {
      connectivityDetector.removeListener(connectivityListener);
    };
  }, []);

  const handleLoginSuccess = (userId: string, email: string, isOfflineMode: boolean) => {
    setUserSession({ userId, email, isOfflineMode });
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
    </>
  );
}

export default App;
