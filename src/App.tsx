import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { FaceLogin } from './components/FaceLogin';
import { FaceRegistration } from './components/FaceRegistration';
import { AttendanceDashboard } from './components/AttendanceDashboard';
import { AttendanceHistory } from './components/AttendanceHistory';
import { UserDetailsForm } from './components/UserDetailsForm';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';
import { ReauthModal } from './components/ReauthModal';
import { Menu } from 'lucide-react';
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
type AppView = 'dashboard' | 'profile' | 'history';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [loginView, setLoginView] = useState<LoginView>('password');
  const [appView, setAppView] = useState<AppView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    indexedDBService.init();

    const connectivityListener = async (online: boolean) => {
      setIsOnline(online);

      if (online && userSession) {
        if (userSession.isOfflineMode) {
          const reauthSuccess = await handleReauth();
          if (!reauthSuccess) {
            setShowReauthModal(true);
          }
        } else {
          const pendingCount = await syncService.getPendingCount();
          if (pendingCount > 0) {
            setTimeout(() => syncService.syncPendingData(), 1000);
          }
        }
      }
    };

    const syncListener = (status: any) => {
      if (status.error && status.error.includes('Authentication required')) {
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

  // Load user details when session is set
  useEffect(() => {
    if (userSession) {
      loadUserDetails();
    }
  }, [userSession]);

  // ✅ IMPROVED: Better profile completeness check
  const isProfileComplete = (details: any): boolean => {
    if (!details) return false;
    
    // Check if required fields have non-empty values
    const hasName = details.name && details.name.trim().length > 0;
    const hasEmployeeId = details.employee_id && details.employee_id.trim().length > 0;
    const hasOfficeCode = details.office_code && details.office_code.trim().length > 0;
    
    return hasName && hasEmployeeId && hasOfficeCode;
  };

  const loadUserDetails = async () => {
    if (!userSession) return;

    setLoadingProfile(true);
    try {
      const details = await indexedDBService.getUserDetails(userSession.userId);
      
      if (details && isProfileComplete(details)) {
        // ✅ Profile is complete, set it and stay on dashboard
        console.log('✅ Profile complete:', details);
        setUserDetails({
          name: details.name,
          employee_id: details.employee_id || '',
          office_code: details.office_code || '',
          district: details.district || '',
          block: details.block || '',
        });
        setAppView('dashboard'); // Explicitly set to dashboard
      } else {
        // ⚠️ Profile incomplete or missing, navigate to profile form
        console.log('⚠️ Profile incomplete, navigating to profile form');
        setUserDetails({
          name: details?.name || '',
          employee_id: details?.employee_id || '',
          office_code: details?.office_code || '',
          district: details?.district || '',
          block: details?.block || '',
        });
        setAppView('profile'); // Navigate to profile
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      // On error, set empty and go to profile
      setUserDetails({
        name: '',
        employee_id: '',
        office_code: '',
        district: '',
        block: '',
      });
      setAppView('profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLoginSuccess = async (userId: string, email: string, isOfflineMode: boolean) => {
    const hasFaceData = await indexedDBService.hasFaceData(userId);

    setUserSession({
      userId,
      email,
      isOfflineMode,
      showFaceRegistration: !hasFaceData && !isOfflineMode,
    });

    if (isOnline) {
      setTimeout(() => syncService.syncPendingData(), 1000);
    }
  };

  const handleReauth = async (password?: string): Promise<boolean> => {
    if (!userSession) return false;

    try {
      let loginResult;

      if (password) {
        loginResult = await loginOnline(userSession.email, password);
      } else {
        const cachedUser = await indexedDBService.getCachedUser(userSession.email);

        if (cachedUser && cachedUser.encryptedPassword) {
          const decryptedPassword = atob(cachedUser.encryptedPassword);
          loginResult = await loginOnline(userSession.email, decryptedPassword);
        } else {
          return false;
        }
      }

      if (loginResult.success) {
        setUserSession({
          ...userSession,
          isOfflineMode: false,
        });

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
    setAppView('dashboard');
    setUserDetails(null);
    setLoadingProfile(false);
  };

  // ✅ NEW: Handle profile save success
  const handleProfileSaved = async () => {
    console.log('Profile saved successfully, reloading...');
    await loadUserDetails();
    // loadUserDetails will automatically navigate to dashboard if profile is complete
  };

  // Login flow
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

  // Face registration flow
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

  // ✅ Show loading only while checking profile
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Main app views
  return (
    <>
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Attendance System</h1>
          <SyncIndicator isOnline={isOnline} onLogout={handleLogout} />
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={userSession.email}
        onNavigateToProfile={() => setAppView('profile')}
        onNavigateToHistory={() => setAppView('history')}
        onNavigateToDashboard={() => setAppView('dashboard')}
        onLogout={handleLogout}
        currentView={appView}
      />

      {/* Main Content */}
      <div className="pt-16">
        {appView === 'dashboard' && userDetails && isProfileComplete(userDetails) && (
          <AttendanceDashboard
            userId={userSession.userId}
            email={userSession.email}
            isOnline={isOnline}
            userDetails={userDetails}
            onNavigateToProfile={() => setAppView('profile')}
            onNavigateToHistory={() => setAppView('history')}
          />
        )}

        {appView === 'profile' && (
          <UserDetailsForm
            userId={userSession.userId}
            email={userSession.email}
            isOnline={isOnline}
            isOfflineMode={userSession.isOfflineMode}
            onSaveSuccess={handleProfileSaved}
            onBack={() => setAppView('dashboard')}
          />
        )}

        {appView === 'history' && userDetails && isProfileComplete(userDetails) && (
          <AttendanceHistory
            userId={userSession.userId}
            isOnline={isOnline}
            onBack={() => setAppView('dashboard')}
          />
        )}

        {/* ✅ NEW: Show message if trying to access dashboard/history with incomplete profile */}
        {(appView === 'dashboard' || appView === 'history') && (!userDetails || !isProfileComplete(userDetails)) && (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Incomplete</h2>
              <p className="text-gray-600 mb-6">
                Please complete your profile to access the attendance system.
              </p>
              <button
                onClick={() => setAppView('profile')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Complete Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reauth Modal */}
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