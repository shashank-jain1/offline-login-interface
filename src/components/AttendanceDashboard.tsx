import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle, Calendar, User } from 'lucide-react';
import { AttendanceRecord, OfficeLocation } from '../types/attendance';
import { getTodayAttendance, getOfficeLocation } from '../services/attendanceService';
import { getCurrentLocation, calculateDistance, getDistanceText } from '../services/geolocationService';
import { getGreeting, getTodayDateIST, formatDateForDisplay } from '../utils/timeUtils';
import { AttendanceTimer } from './AttendanceTimer';
import { FaceVerificationModal } from './FaceVerificationModal';

interface AttendanceDashboardProps {
  userId: string;
  email: string;
  isOnline: boolean;
  userDetails: {
    name: string;
    employee_id: string;
    office_code: string;
    district?: string;
    block?: string;
  };
  onNavigateToProfile: () => void;
  onNavigateToHistory: () => void;
}

type AttendanceAction = 'check-in' | 'half-day' | 'check-out' | null;

export function AttendanceDashboard({
  userId,
  email: _email,
  isOnline,
  userDetails,
  onNavigateToProfile,
  onNavigateToHistory,
}: AttendanceDashboardProps) {
  void _email;
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<{
    withinFence: boolean;
    distance: number;
    error?: string;
  } | null>(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<AttendanceAction>(null);
  const [notes, setNotes] = useState('');
  const [_odWorkType, setOdWorkType] = useState<string>('');
  void _odWorkType;
  const [refreshKey, setRefreshKey] = useState(0);

  const greeting = getGreeting();
  const today = getTodayDateIST();

  useEffect(() => {
    loadData();
  }, [userId, refreshKey]);

  useEffect(() => {
    if (officeLocation) {
      checkLocation();
      const interval = setInterval(checkLocation, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [officeLocation]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load office location
      const office = await getOfficeLocation(userDetails.office_code, isOnline);
      if (office) {
        setOfficeLocation(office);
      }

      // Load today's attendance
      const attendance = await getTodayAttendance(userId, isOnline);
      setTodayAttendance(attendance);
    } catch (_error) {
      console.error('Error loading attendance data:', _error);
    } finally {
      setLoading(false);
    }
  };

  const checkLocation = async () => {
    if (!officeLocation) return;

    try {
      const location = await getCurrentLocation();

      // ✅ FIXED: Calculate distance first, then check if within fence
      const distanceInMeters = calculateDistance(
        location.latitude,
        location.longitude,
        officeLocation.latitude,
        officeLocation.longitude
      );

      const withinFence = distanceInMeters <= officeLocation.geofence_radius;

      setLocationStatus({
        withinFence,
        distance: distanceInMeters,
      });
    } catch (_error) {
      setLocationStatus({
        withinFence: false,
        distance: 0,
        error: 'Unable to get location',
      });
    }
  };

  const handleActionClick = (action: AttendanceAction) => {
    if (!locationStatus?.withinFence && action !== 'check-in') {
      alert('You must be within office geofence to perform this action');
      return;
    }

    setCurrentAction(action);
    setShowFaceModal(true);
  };
  const handleFaceVerified = async (_imagePath: string) => {
    void _imagePath;
    setShowFaceModal(false);
    setRefreshKey(prev => prev + 1);
    setNotes('');
    setOdWorkType('');
  };
  const _canCheckIn = !todayAttendance || !todayAttendance.time_in;
  void _canCheckIn;
  const canHalfDay = Boolean(todayAttendance?.time_in && !todayAttendance.time_out);
  const canCheckOut = Boolean(todayAttendance?.time_in && !todayAttendance.time_out);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 pb-20">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        {/* Greeting Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{greeting.icon}</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {greeting.text}, {userDetails.name || 'User'}!
                  </h1>
                  <p className="text-gray-600">{formatDateForDisplay(today)}</p>
                </div>
              </div>

              {officeLocation && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-700">{officeLocation.office_name}</span>
                </div>
              )}
            </div>

            <button
              onClick={onNavigateToProfile}
              className="p-3 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
            >
              <User className="w-6 h-6 text-blue-600" />
            </button>
          </div>
        </div>

        {/* Location Status */}
        {locationStatus && (
          <div className={`rounded-xl p-4 mb-6 ${locationStatus.withinFence
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
            }`}>
            <div className="flex items-center gap-3">
              {locationStatus.withinFence ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <p className={`font-medium ${locationStatus.withinFence ? 'text-green-900' : 'text-amber-900'
                  }`}>
                  {locationStatus.withinFence ? 'Within Office Geofence' : 'Outside Office Area'}
                </p>
                {!locationStatus.withinFence && (
                  <p className="text-sm text-amber-700">
                    {locationStatus.error || `You are ${getDistanceText(locationStatus.distance)} from office`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {!todayAttendance || !todayAttendance.time_in ? (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Not Checked In</h2>
              <p className="text-gray-600 mb-6">Start your day by marking attendance</p>

              <button
                onClick={() => handleActionClick('check-in')}
                disabled={!locationStatus?.withinFence || !officeLocation}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-lg"
              >
                📸 Check In
              </button>

              {!locationStatus?.withinFence && (
                <p className="text-sm text-amber-600 mt-4">
                  Please be within office geofence to check in
                </p>
              )}
            </div>
          ) : !todayAttendance.time_out ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Checked In</h2>
                  <p className="text-sm text-gray-600">at {todayAttendance.time_in}</p>
                </div>
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {todayAttendance.status}
                </div>
              </div>

              {/* Timer */}
              {todayAttendance.time_in && (
                <AttendanceTimer
                  checkInTime={todayAttendance.time_in}
                  onHalfDayClick={() => handleActionClick('half-day')}
                  onCheckOutClick={() => handleActionClick('check-out')}
                  canHalfDay={canHalfDay}
                  canCheckOut={canCheckOut}
                />
              )}

              {/* Notes Input */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Day Completed</h2>
              <div className="space-y-2 text-gray-600">
                <p>Check In: {todayAttendance.time_in}</p>
                <p>Check Out: {todayAttendance.time_out}</p>
                <p>Working Hours: {todayAttendance.working_hours || 'N/A'}</p>
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mt-4 ${todayAttendance.status === 'Present'
                  ? 'bg-green-100 text-green-800'
                  : todayAttendance.status === 'Half Day'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                  }`}>
                  {todayAttendance.status}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onNavigateToHistory}
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">View History</p>
          </button>

          <button
            onClick={onNavigateToProfile}
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">My Profile</p>
          </button>
        </div>
      </div>

      {/* Face Verification Modal */}
      {showFaceModal && currentAction && officeLocation && (
        <FaceVerificationModal
          userId={userId}
          userDetails={{ ...userDetails, employee_name: userDetails.name }}
          action={currentAction}
          officeLocation={officeLocation}
          notes={notes}
          isOnline={isOnline}
          onVerified={handleFaceVerified}
          onCancel={() => {
            setShowFaceModal(false);
            setCurrentAction(null);
          }}
        />
      )}
    </div>
  );
}