import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, WifiOff, Building2, MapPin, User, Hash, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { indexedDBService } from '../lib/indexedDB';

interface UserDetailsFormProps {
  userId: string;
  email: string;
  isOnline: boolean;
  isOfflineMode: boolean;
  onSaveSuccess?: () => void;
  onBack?: () => void;  // ✅ NEW: Optional back button callback
}

interface FormData {
  name: string;
  age: string;
  phone: string;
  dateOfBirth: string;
  employee_id: string;      // ✅ NEW
  office_code: string;       // ✅ NEW
  district: string;          // ✅ NEW
  block: string;             // ✅ NEW
}

export function UserDetailsForm({
  userId,
  email: _email,
  isOnline,
  isOfflineMode,
  onSaveSuccess,
  onBack  // ✅ NEW: Extract back callback
}: UserDetailsFormProps) {
  void _email;
  const [formData, setFormData] = useState<FormData>({
    name: '',
    age: '',
    phone: '',
    dateOfBirth: '',
    employee_id: '',
    office_code: '',
    district: '',
    block: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadUserDetails();
  }, [userId, isOnline]);

  const loadUserDetails = async () => {
    setLoading(true);
    try {
      // Try IndexedDB first
      const localData = await indexedDBService.getUserDetails(userId);
      if (localData) {
        setFormData({
          name: localData.name || '',
          age: localData.age ? localData.age.toString() : '',
          phone: localData.phone || '',
          dateOfBirth: localData.dateOfBirth || '',
          employee_id: localData.employee_id || '',
          office_code: localData.office_code || '',
          district: localData.district || '',
          block: localData.block || '',
        });
      }

      // If online, also try to fetch from Supabase
      if (isOnline && !isOfflineMode) {
        const { data } = await supabase
          .from('user_details')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          setFormData({
            name: data.name || '',
            age: data.age ? data.age.toString() : '',
            phone: data.phone || '',
            dateOfBirth: data.date_of_birth || '',
            employee_id: data.employee_id || '',
            office_code: data.office_code || '',
            district: data.district || '',
            block: data.block || '',
          });
        }
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      // Validation
      const ageNum = parseInt(formData.age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
        setError('Please enter a valid age');
        setSaving(false);
        return;
      }

      // ✅ Validate required attendance fields
      if (!formData.name.trim()) {
        setError('Name is required');
        setSaving(false);
        return;
      }

      if (!formData.employee_id.trim()) {
        setError('Employee ID is required for attendance');
        setSaving(false);
        return;
      }

      if (!formData.office_code.trim()) {
        setError('Office Code is required for attendance');
        setSaving(false);
        return;
      }

      const updatedAt = Date.now();

      const detailsData = {
        userId,
        name: formData.name.trim(),
        age: ageNum,
        phone: formData.phone.trim(),
        dateOfBirth: formData.dateOfBirth,
        employee_id: formData.employee_id.trim(),
        office_code: formData.office_code.trim(),
        district: formData.district.trim(),
        block: formData.block.trim(),
        updatedAt,
        pendingSync: !isOnline,
      };

      // Save to IndexedDB
      await indexedDBService.saveUserDetails(detailsData);

      // Save to Supabase if online
      if (isOnline) {
        const { data: existingData } = await supabase
          .from('user_details')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        const supabaseData = {
          name: formData.name.trim(),
          age: ageNum,
          phone: formData.phone.trim(),
          date_of_birth: formData.dateOfBirth,
          employee_id: formData.employee_id.trim(),
          office_code: formData.office_code.trim(),
          district: formData.district.trim(),
          block: formData.block.trim(),
          updated_at: new Date(updatedAt).toISOString(),
        };

        if (existingData) {
          await supabase
            .from('user_details')
            .update(supabaseData)
            .eq('user_id', userId);
        } else {
          await supabase.from('user_details').insert({
            user_id: userId,
            ...supabaseData,
          });
        }
      }

      setSuccess(true);

      // Call onSaveSuccess callback after a short delay
      if (onSaveSuccess) {
        setTimeout(() => {
          onSaveSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header with Back Button */}
          <div className="mb-8">
            {/* ✅ NEW: Back button */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium">Back to Dashboard</span>
              </button>
            )}

            <h2 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h2>
            <p className="text-gray-600">Please fill in all required fields to access the attendance system</p>
          </div>

          {/* Offline Warning */}
          {!isOnline && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">Offline Mode</p>
                <p className="text-xs text-amber-700">Changes will sync when you're back online</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-700 font-medium">Profile saved successfully!</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Personal Information
              </h3>

              <div className="space-y-4">
                {/* Name - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                {/* Age & Date of Birth Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => handleChange('age', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Age"
                      min="1"
                      max="150"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Information Section */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Attendance Information
              </h3>

              <div className="space-y-4">
                {/* Employee ID - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.employee_id}
                      onChange={(e) => handleChange('employee_id', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., EMP001"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Your unique employee identification number</p>
                </div>

                {/* Office Code - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Office Code <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.office_code}
                      onChange={(e) => handleChange('office_code', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., HQ001, BPL001"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Your office location code for attendance tracking</p>
                </div>

                {/* District & Block Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      District <span className="text-gray-400">(Optional)</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => handleChange('district', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Bhopal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Block <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.block}
                      onChange={(e) => handleChange('block', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., TT Nagar"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Details
                  </>
                )}
              </button>
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500">
              Fields marked with <span className="text-red-500">*</span> are required for attendance tracking
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}