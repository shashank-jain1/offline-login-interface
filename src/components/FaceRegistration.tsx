import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, CheckCircle2, XCircle, ScanFace } from 'lucide-react';
import {
  loadModels,
  startVideoStream,
  stopVideoStream,
  detectFace,
  captureFaceDescriptor,
  getAverageDescriptor,
  performLivenessCheck,
} from '../services/faceRecognitionService';
import { indexedDBService } from '../lib/indexedDB';
import { supabase } from '../lib/supabase';

interface FaceRegistrationProps {
  userId: string;
  email: string;
  isOnline: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function FaceRegistration({
  userId,
  email: _email,
  isOnline,
  onComplete,
  onSkip,
}: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

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
          if (videoRef.current && !capturing && isMounted) {
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
      console.log('[FaceRegistration] Cleaning up...');
      
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [capturing]);

  const cleanupCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleRegisterFace = async () => {
    if (!videoRef.current || !faceDetected) {
      setError('No face detected. Please position your face in the camera.');
      return;
    }
  
    setLoading(true);
    setCapturing(true);
    setError('');
    setSuccess('');
    setCaptureProgress(0);
  
    try {
      console.log('Starting liveness detection...');
      setSuccess('Please move your head slightly...');
      
      // Liveness detection
      const livenessResult = await performLivenessCheck(videoRef.current, 2000, 0.02);
      
      if (!livenessResult.passed) {
        setError(livenessResult.reason || 'Liveness check failed');
        setLoading(false);
        setCapturing(false);
        return;
      }
      
      console.log('✓ Liveness check passed');
      setSuccess('');
      
      console.log('Starting face registration...');
      
      // Continue with existing registration code...
      const totalCaptures = 10;
      const descriptors = [];
  
      for (let i = 0; i < totalCaptures; i++) {
        const progress = ((i + 1) / totalCaptures) * 100;
        setCaptureProgress(progress);
        console.log(`Capture ${i + 1}/${totalCaptures} (${Math.round(progress)}%)...`);
        
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
        } catch (err) {
          console.warn(`Capture attempt ${i + 1} failed:`, err);
        }
  
        if (i < totalCaptures - 1) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }
  
      // Rest of the registration code stays the same...
      if (descriptors.length < 5) {
        console.error(`Only captured ${descriptors.length} descriptors`);
        setError(`Failed to capture enough face data (got ${descriptors.length}/10). Please ensure good lighting and try again.`);
        setLoading(false);
        setCapturing(false);
        setCaptureProgress(0);
        return;
      }
  
      console.log(`✓ Captured ${descriptors.length} face descriptors`);
  
      const averageDescriptor = getAverageDescriptor(descriptors);
  
      if (!averageDescriptor) {
        setError('Failed to process face data. Please try again.');
        setLoading(false);
        setCapturing(false);
        setCaptureProgress(0);
        return;
      }
  
      const descriptorArray = Array.from(averageDescriptor);
  
      await indexedDBService.saveFaceData({
        userId,
        faceDescriptor: descriptorArray,
        updatedAt: Date.now(),
      });
      console.log(`✅ Face descriptor saved to IndexedDB for user ${userId}`);
      console.log(`Descriptor length: ${descriptorArray.length}`);
      console.log(`First few values: ${descriptorArray.slice(0, 5).join(', ')}`);
  
      if (isOnline) {
        try {
          const { error: dbError } = await supabase
            .from('user_face_data')
            .upsert({
              user_id: userId,
              face_descriptor: descriptorArray,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id',
            });
  
          if (dbError) {
            console.error('Error saving face data to database:', dbError);
          } else {
            console.log('✅ Face descriptor saved to Supabase');
          }
        } catch (err) {
          console.error('Error uploading face data:', err);
        }
      }
  
      setSuccess('Face registered successfully!');
      
      setTimeout(() => {
        cleanupCamera();
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Face registration error:', err);
      setError('Face registration failed. Please try again.');
      setLoading(false);
      setCapturing(false);
      setCaptureProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <ScanFace className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Register Your Face</h1>
          <p className="text-gray-600">
            Set up face recognition for quick and secure login
          </p>
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

              {capturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">Capturing face data...</p>
                    <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${captureProgress}%` }}
                      />
                    </div>
                    <p className="text-white text-sm mt-2">{Math.round(captureProgress)}%</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Position your face clearly in the camera</li>
                <li>Ensure good lighting on your face</li>
                <li>Look directly at the camera</li>
                <li>Hold still during capture</li>
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
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
                onClick={() => {
                  cleanupCamera();
                  onSkip();
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for Now
              </button>
              <button
                onClick={handleRegisterFace}
                disabled={loading || !faceDetected}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-5 h-5" />
                    Register Face
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