import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { indexedDBService } from '../lib/indexedDB';

interface UserDetailsFormProps {
  userId: string;
  email: string;
  isOnline: boolean;
  isOfflineMode: boolean;
}

interface FormData {
  name: string;
  age: string;
  phone: string;
  dateOfBirth: string;
}

export function UserDetailsForm({ userId, email, isOnline, isOfflineMode }: UserDetailsFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    age: '',
    phone: '',
    dateOfBirth: '',
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
      if (isOnline && !isOfflineMode) {
        const { data } = await supabase
          .from('user_details')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          setFormData({
            name: data.name,
            age: data.age.toString(),
            phone: data.phone,
            dateOfBirth: data.date_of_birth,
          });
        }
      }

      const localData = await indexedDBService.getUserDetails(userId);
      if (localData) {
        setFormData({
          name: localData.name,
          age: localData.age.toString(),
          phone: localData.phone,
          dateOfBirth: localData.dateOfBirth,
        });
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
      const updatedAt = Date.now();
      const ageNum = parseInt(formData.age);

      if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
        setError('Please enter a valid age');
        setSaving(false);
        return;
      }

      const detailsData = {
        userId,
        name: formData.name,
        age: ageNum,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        updatedAt,
        pendingSync: !isOnline,
      };

      await indexedDBService.saveUserDetails(detailsData);

      if (isOnline) {
        const { data: existingData } = await supabase
          .from('user_details')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingData) {
          await supabase
            .from('user_details')
            .update({
              name: formData.name,
              age: ageNum,
              phone: formData.phone,
              date_of_birth: formData.dateOfBirth,
              updated_at: new Date(updatedAt).toISOString(),
            })
            .eq('user_id', userId);
        } else {
          await supabase.from('user_details').insert({
            user_id: userId,
            name: formData.name,
            age: ageNum,
            phone: formData.phone,
            date_of_birth: formData.dateOfBirth,
            updated_at: new Date(updatedAt).toISOString(),
          });
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Profile</h1>
            <p className="text-gray-600">Logged in as: {email}</p>
          </div>

          {!isOnline && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Offline Mode</p>
                <p className="text-sm text-amber-700 mt-1">
                  Your data will be synced when connection is restored
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
                required
                min="1"
                max="150"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="25"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              <input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">Details saved successfully!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </form>
        </div>
      </div>
    </div>
  );
}
