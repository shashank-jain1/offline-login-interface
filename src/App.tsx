import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { FaceLogin } from './components/FaceLogin';
import { FaceRegistration } from './components/FaceRegistration';
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
  showFaceRegistration?: boolean;
}

type LoginView = 'password' | 'face';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [loginView, setLoginView] = useState<LoginView>('password');

  useEffect(() => {
    indexedDBService.init();
  
    const connectivityListener = async (online: boolean) => {
      setIsOnline(online);
      
      if (online && userSession) {
        console.log('Coming back online...');
        
        // If user was in offline mode, try to reauth first
        if (userSession.isOfflineMode) {
          console.log('User was offline, attempting reauth...');
          
          const reauthSuccess = await handleReauth();
          
          if (reauthSuccess) {
            console.log('✅ Automatic reauth successful!');
            // handleReauth already triggers sync
          } else {
            console.log('❌ Automatic reauth failed, showing modal...');
            setShowReauthModal(true);
          }
        } else {
          // User was already online, just sync normally
          const pendingCount = await syncService.getPendingCount();
          if (pendingCount > 0) {
            setTimeout(() => syncService.syncPendingData(), 1000);
          }
        }
      }
    };
  
    // Also listen to sync errors to trigger reauth
    const syncListener = (status: any) => {
      if (status.error && status.error.includes('Authentication required')) {
        console.log('Sync requires authentication, attempting reauth...');
        if (userSession && userSession.isOfflineMode) {
          handleReauth().then((success) => {
            if (!success) {
              setShowReauthModal(true);
            }
          });
        }
      }
    };
  
    connectivityDetector.addListener(connectivityListener);
    syncService.addListener(syncListener);
  
    return () => {
      connectivityDetector.removeListener(connectivityListener);
      syncService.removeListener(syncListener);
    };
  }, [userSession]);

  const handleLoginSuccess = async (userId: string, email: string, isOfflineMode: boolean) => {
    // Check if user has face data registered
    const hasFaceData = await indexedDBService.hasFaceData(userId);
    
    setUserSession({ 
      userId, 
      email, 
      isOfflineMode,
      showFaceRegistration: !hasFaceData && !isOfflineMode // Only show if no face data and online
    });
    
    // Trigger sync after login if online
    if (isOnline) {
      setTimeout(() => syncService.syncPendingData(), 1000);
    }
  };

  const handleReauth = async (password?: string): Promise<boolean> => {
    if (!userSession) return false;
    
    try {
      let loginResult;
      
      // If password is provided, use it
      if (password) {
        loginResult = await loginOnline(userSession.email, password);
      } else {
        // Try to get encrypted password from IndexedDB
        const cachedUser = await indexedDBService.getCachedUser(userSession.email);
        
        if (cachedUser && cachedUser.encryptedPassword) {
          console.log('Using stored encrypted password for reauth...');
          // Decrypt and login
          const decryptedPassword = atob(cachedUser.encryptedPassword);
          loginResult = await loginOnline(userSession.email, decryptedPassword);
        } else {
          console.log('No encrypted password found, manual reauth required');
          return false;
        }
      }
      
      if (loginResult.success) {
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
    } catch (error) {
      console.error('Reauth error:', error);
      return false;
    }
  };

  const handleLogout = () => {
    setUserSession(null);
  };

  if (!userSession) {
    if (loginView === 'face') {
      return (
        <FaceLogin
          isOnline={isOnline}
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setLoginView('password')}
        />
      );
    }
    
    return (
      <Login
        isOnline={isOnline}
        onLoginSuccess={handleLoginSuccess}
        onFaceLoginClick={() => setLoginView('face')}
      />
    );
  }

  // Show face registration if user just logged in and doesn't have face data
  if (userSession.showFaceRegistration) {
    return (
      <FaceRegistration
        userId={userSession.userId}
        email={userSession.email}
        isOnline={isOnline}
        onComplete={() => setUserSession({ ...userSession, showFaceRegistration: false })}
        onSkip={() => setUserSession({ ...userSession, showFaceRegistration: false })}
      />
    );
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