import { loginWithFace } from '../services/authService';
import { supabase } from '../lib/supabase';
import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, CheckCircle2, XCircle, ScanFace } from 'lucide-react';
import {
  loadModels,
  startVideoStream,
  stopVideoStream,
  compareFaceDescriptors,
  detectFace,
  captureFaceDescriptor,
  getAverageDescriptor,
} from '../services/faceRecognitionService';
import { indexedDBService } from '../lib/indexedDB';

interface FaceLoginProps {
  isOnline: boolean;
  onLoginSuccess: (userId: string, email: string, isOfflineMode: boolean) => void;
  onBack: () => void;
}

export function FaceLogin({ isOnline, onLoginSuccess, onBack }: FaceLoginProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let detectionInterval: NodeJS.Timeout | null = null;

    const initializeCamera = async () => {
      try {
        setError('');
        setModelsLoading(true);
        console.log('Loading face recognition models...');
        await loadModels();
        console.log('Models loaded successfully');
        
        if (!isMounted) return;
        
        setModelsLoading(false);

        // Wait a bit for video element to be mounted
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!videoRef.current) {
          console.error('Video element not found!');
          setError('Video element not ready. Please try again.');
          return;
        }

        console.log('Starting video stream...');
        const stream = await startVideoStream(videoRef.current);
        
        if (!isMounted) {
          stopVideoStream(stream);
          return;
        }
        
        streamRef.current = stream;
        console.log('Video stream started');
        
        // Start face detection
        detectionInterval = setInterval(async () => {
          if (videoRef.current && !scanning && isMounted) {
            const detected = await detectFace(videoRef.current);
            if (isMounted) {
              setFaceDetected(detected);
            }
          }
        }, 500);
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to initialize camera. Please check permissions.');
          setModelsLoading(false);
        }
      }
    };

    initializeCamera();

    return () => {
      isMounted = false;
      console.log('[FaceLogin] Component unmounting, cleaning up...');
      
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [retrying, scanning]);

  const handleRetry = () => {
    setError('');
    setRetrying(prev => !prev);
  };

  const handleFaceLogin = async () => {
    if (!videoRef.current || !faceDetected) {
      setError('No face detected. Please position your face in the camera.');
      return;
    }
  
    setLoading(true);
    setScanning(true);
    setError('');
    setSuccess('');
  
    try {
      console.log('Starting face capture...');
      
      // Capture multiple face descriptors with timeout protection
      const descriptors = [];
      const maxAttempts = 5;
      
      for (let i = 0; i < maxAttempts; i++) {
        console.log(`Capture attempt ${i + 1}/${maxAttempts}...`);
        
        try {
          const descriptor = await Promise.race([
            captureFaceDescriptor(videoRef.current),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 3000)
            )
          ]);
          
          if (descriptor) {
            descriptors.push(descriptor);
            console.log(`✓ Captured descriptor ${i + 1}`);
          }
          
          if (descriptors.length >= 3) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.warn(`Capture attempt ${i + 1} failed:`, err);
        }
      }
  
      if (descriptors.length === 0) {
        setError('Failed to capture face data. Please ensure good lighting and try again.');
        setLoading(false);
        setScanning(false);
        return;
      }
  
      console.log(`Captured ${descriptors.length} face descriptors`);
  
      const capturedDescriptor = getAverageDescriptor(descriptors);
  
      if (!capturedDescriptor) {
        setError('Failed to process face data. Please try again.');
        setLoading(false);
        setScanning(false);
        return;
      }
  
      console.log('Processing captured descriptor...');
  
      // Get face data from IndexedDB
      const allFaceData = await indexedDBService.getAllFaceData();
      console.log(`Found ${allFaceData.length} face data entries in IndexedDB`);
  
      let matchedUserId = null;
      let bestMatchDistance = Infinity;
  
      // Check IndexedDB first
      for (const faceData of allFaceData) {
        if (faceData.faceDescriptor && faceData.faceDescriptor.length > 0) {
          const distance = compareFaceDescriptors(
            capturedDescriptor,
            faceData.faceDescriptor
          );
  
          console.log(`User ${faceData.userId}: distance = ${distance.toFixed(4)}`);
  
          if (distance < 0.7 && distance < bestMatchDistance) {
            bestMatchDistance = distance;
            matchedUserId = faceData.userId;
          }
        }
      }
  
      // If online and no match found in IndexedDB, check Supabase
      if (!matchedUserId && isOnline) {
        console.log('No local match, checking online database...');
        
        try {
          const { data: onlineFaceData, error } = await supabase
            .from('user_face_data')
            .select('user_id, face_descriptor');
  
          if (!error && onlineFaceData) {
            console.log(`Found ${onlineFaceData.length} face data entries online`);
            
            for (const faceData of onlineFaceData) {
              if (faceData.face_descriptor && faceData.face_descriptor.length > 0) {
                const distance = compareFaceDescriptors(
                  capturedDescriptor,
                  faceData.face_descriptor
                );
  
                console.log(`Online user ${faceData.user_id}: distance = ${distance.toFixed(4)}`);
  
                if (distance < 0.7 && distance < bestMatchDistance) {
                  bestMatchDistance = distance;
                  matchedUserId = faceData.user_id;
                  
                  // Cache this face data locally for future offline use
                  await indexedDBService.saveFaceData({
                    userId: faceData.user_id,
                    faceDescriptor: faceData.face_descriptor,
                    updatedAt: Date.now(),
                  });
                  console.log('✅ Cached face data locally from online database');
                }
              }
            }
          }
        } catch (err) {
          console.error('Error checking online face data:', err);
        }
      }
  
      console.log(`Best match distance: ${bestMatchDistance.toFixed(4)}`);
  
      if (matchedUserId) {
        // Get user details from cached users
        const cachedUsers = await indexedDBService.getAllCachedUsers();
        const matchedUser = cachedUsers.find(u => u.id === matchedUserId);
      
        if (matchedUser) {
          console.log(`✅ Matched user: ${matchedUser.email}`);
          setSuccess('Face recognized! Logging in...');
          
          // Use face login which will authenticate with Supabase if online
          const loginResult = await loginWithFace(matchedUser.id, matchedUser.email, isOnline);
          
          if (loginResult.success) {
            setTimeout(() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
              }
              onLoginSuccess(
                loginResult.userId!,
                loginResult.email!,
                loginResult.isOfflineMode || false
              );
            }, 1000);
          } else {
            setError(loginResult.error || 'Face login failed');
            setLoading(false);
            setScanning(false);
          }
        } else {
          console.log('❌ User ID matched but no cached user found');
          setError('User account not found locally. Please login with password first.');
        }
      } else {
        console.log('❌ No face match found');
        setError(`Face not recognized. Best match distance: ${bestMatchDistance.toFixed(4)}. Please try again with better lighting.`);
      }
    } catch (err) {
      console.error('Face login error:', err);
      setError('Face recognition failed. Please try again.');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <ScanFace className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Face Recognition Login</h1>
          <p className="text-gray-600">Position your face in the camera to login</p>
        </div>

        {modelsLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading face recognition models...</p>
          </div>
        ) : (
          <>
            <div className="relative mb-6 rounded-xl overflow-hidden bg-gray-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
              
              {/* Face detection overlay */}
              <div className="absolute top-4 right-4">
                {faceDetected ? (
                  <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Face Detected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg">
                    <Camera className="w-5 h-5" />
                    <span className="text-sm font-medium">Looking for face...</span>
                  </div>
                )}
              </div>

              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-2" />
                    <p className="text-white font-medium">Scanning face...</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{error}</p>
                    <button
                      onClick={handleRetry}
                      className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back to Login
              </button>
              <button
                onClick={handleFaceLogin}
                disabled={loading || !faceDetected}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-5 h-5" />
                    Login with Face
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}