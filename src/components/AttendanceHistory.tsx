
import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle, ChevronLeft } from 'lucide-react';
import { AttendanceRecord } from '../types/attendance';
import { getAttendanceHistory } from '../services/attendanceService';
import { formatDateForDisplay } from '../utils/timeUtils';

interface AttendanceHistoryProps {
  userId: string;
  isOnline: boolean;
  onBack: () => void;
}

export function AttendanceHistory({ userId, isOnline, onBack }: AttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    loadHistory();
  }, [userId, selectedMonth]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const history = await getAttendanceHistory(userId, startDate, endDate, isOnline);
      setRecords(history);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Half Day':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Absent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'On Leave':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'In Progress':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Present':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Half Day':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'Absent':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const summary = {
    totalDays: records.length,
    presentDays: records.filter(r => r.status === 'Present').length,
    halfDays: records.filter(r => r.status === 'Half Day').length,
    absentDays: records.filter(r => r.status === 'Absent').length,
    avgWorkingHours: records
      .filter(r => r.working_hours)
      .reduce((acc, r) => {
        const [h, m] = r.working_hours!.split(':').map(Number);
        return acc + h + m / 60;
      }, 0) / (records.filter(r => r.working_hours).length || 1),
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    const now = new Date();
    if (
      selectedMonth.getFullYear() < now.getFullYear() ||
      (selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() < now.getMonth())
    ) {
      setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading attendance history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
            <div className="w-10" />
          </div>

          {/* Month Selector */}
          <div className="flex items-center justify-between">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={nextMonth}
              disabled={
                selectedMonth.getFullYear() === new Date().getFullYear() &&
                selectedMonth.getMonth() === new Date().getMonth()
              }
              className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 rotate-180" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4">
            <p className="text-sm text-gray-600 mb-1">Total Days</p>
            <p className="text-2xl font-bold text-gray-900">{summary.totalDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4">
            <p className="text-sm text-green-600 mb-1">Present</p>
            <p className="text-2xl font-bold text-green-700">{summary.presentDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4">
            <p className="text-sm text-amber-600 mb-1">Half Day</p>
            <p className="text-2xl font-bold text-amber-700">{summary.halfDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4">
            <p className="text-sm text-red-600 mb-1">Absent</p>
            <p className="text-2xl font-bold text-red-700">{summary.absentDays}</p>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No attendance records for this month</p>
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(record.status)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatDateForDisplay(record.date)}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {record.time_in || '--:--'} - {record.time_out || '--:--'}
                        </span>
                        {record.working_hours && (
                          <span className="font-medium text-blue-600">
                            {record.working_hours} hrs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Attendance Details</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDateForDisplay(selectedRecord.date)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Check In</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRecord.time_in || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Check Out</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRecord.time_out || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Working Hours</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {selectedRecord.working_hours || 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div
                    className={`inline-block px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(
                      selectedRecord.status
                    )}`}
                  >
                    {selectedRecord.status}
                  </div>
                </div>

                {selectedRecord.time_in_geo_location && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Check-in Location
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedRecord.time_in_geo_location}
                    </p>
                  </div>
                )}

                {selectedRecord.time_out_geo_location && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Check-out Location
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedRecord.time_out_geo_location}
                    </p>
                  </div>
                )}

                {selectedRecord.notes && (
                  <div>
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedRecord.notes}</p>
                  </div>
                )}

                {selectedRecord.od_work_type && (
                  <div>
                    <p className="text-sm text-gray-600">OD Work Type</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedRecord.od_work_type}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}