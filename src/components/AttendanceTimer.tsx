import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { timeToSeconds, secondsToTime } from '../utils/timeUtils';

interface AttendanceTimerProps {
  checkInTime: string;
  onHalfDayClick: () => void;    // ✅ FIXED: Match what Dashboard passes
  onCheckOutClick: () => void;   // ✅ FIXED: Match what Dashboard passes
  canHalfDay: boolean;           // ✅ NEW: From Dashboard
  canCheckOut: boolean;          // ✅ NEW: From Dashboard
}

const THREE_HOURS = 3 * 60 * 60; // 3 hours in seconds
const FIVE_HOURS = 5 * 60 * 60;  // 5 hours in seconds

export function AttendanceTimer({
  checkInTime,
  onHalfDayClick,
  onCheckOutClick,
  canHalfDay,
  canCheckOut,
}: AttendanceTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [halfDayUnlocked, setHalfDayUnlocked] = useState(false);
  const [checkOutUnlocked, setCheckOutUnlocked] = useState(false);

  useEffect(() => {
    const checkInSeconds = timeToSeconds(checkInTime);
    
    const updateTimer = () => {
      const now = new Date();
      const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const elapsed = currentSeconds - checkInSeconds;
      
      setElapsedSeconds(elapsed >= 0 ? elapsed : 0);

      // Update unlock states based on time
      if (elapsed >= THREE_HOURS) {
        setHalfDayUnlocked(true);
      }

      if (elapsed >= FIVE_HOURS) {
        setCheckOutUnlocked(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [checkInTime]);

  const timeString = secondsToTime(elapsedSeconds);
  const progressPercent = Math.min((elapsedSeconds / FIVE_HOURS) * 100, 100);
  const halfDayPercent = (THREE_HOURS / FIVE_HOURS) * 100;

  return (
    <div className="space-y-6">
      {/* Timer Display */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Clock className="w-8 h-8 text-blue-600" />
          <p className="text-sm font-medium text-gray-600">Working Time</p>
        </div>
        <div className="text-5xl font-bold text-blue-600 font-mono tracking-wider">
          {timeString}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
          
          {/* Half Day Marker */}
          <div
            className="absolute inset-y-0 w-1 bg-amber-500"
            style={{ left: `${halfDayPercent}%` }}
          />
          
          {/* Time Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">
            <span className={elapsedSeconds >= THREE_HOURS ? 'text-white' : 'text-gray-700'}>
              3 hrs
            </span>
            <span className={elapsedSeconds >= FIVE_HOURS ? 'text-white' : 'text-gray-700'}>
              5 hrs
            </span>
          </div>
        </div>

        {/* Status Labels */}
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              halfDayUnlocked ? 'bg-amber-500' : 'bg-gray-300'
            }`} />
            <span className={halfDayUnlocked ? 'text-amber-700 font-medium' : 'text-gray-500'}>
              Half Day {halfDayUnlocked ? '✓' : '🔒'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              checkOutUnlocked ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span className={checkOutUnlocked ? 'text-green-700 font-medium' : 'text-gray-500'}>
              Check Out {checkOutUnlocked ? '✓' : '🔒'}
            </span>
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      {!checkOutUnlocked && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {elapsedSeconds < THREE_HOURS ? (
              <>Time until half day: {secondsToTime(THREE_HOURS - elapsedSeconds)}</>
            ) : (
              <>Time until full day: {secondsToTime(FIVE_HOURS - elapsedSeconds)}</>
            )}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onHalfDayClick}
          disabled={!halfDayUnlocked || !canHalfDay}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            halfDayUnlocked && canHalfDay
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {halfDayUnlocked && canHalfDay ? '✓ Half Day' : '🔒 Half Day'}
        </button>

        <button
          onClick={onCheckOutClick}
          disabled={!checkOutUnlocked || !canCheckOut}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            checkOutUnlocked && canCheckOut
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {checkOutUnlocked && canCheckOut ? '✓ Check Out' : '🔒 Check Out'}
        </button>
      </div>

      {/* Help Text */}
      {!checkOutUnlocked && (
        <p className="text-xs text-center text-gray-500">
          {!halfDayUnlocked && 'Work for 3 hours to unlock Half Day, or 5 hours for full day'}
          {halfDayUnlocked && !checkOutUnlocked && 'Work 2 more hours to unlock full day Check Out'}
        </p>
      )}
    </div>
  );
}