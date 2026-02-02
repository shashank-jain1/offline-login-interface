import { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface ReauthModalProps {
  email: string;
  onReauth: (password: string) => Promise<boolean>;
  onCancel: () => void;
}

export function ReauthModal({ email, onReauth, onCancel }: ReauthModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await onReauth(password);
      if (!success) {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Re-authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
          <Lock className="w-6 h-6 text-blue-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Re-authenticate to Sync
        </h2>
        <p className="text-gray-600 mb-6">
          You have {' '}
          <span className="font-semibold">pending changes</span> that need to be synced.
          Please enter your password to sync with the server.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sync Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}