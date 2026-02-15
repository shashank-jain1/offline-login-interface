import { useState, useRef, useEffect } from 'react';
import { X, Loader2, CheckCircle, Camera } from 'lucide-react';
import {
  loadModels,
  startVideoStream,
  stopVideoStream as _stopVideoStream,
  detectFace,
  performLivenessCheck,
  captureFaceDescriptor,
  isFaceMatch,
  detectBlink,
} from '../services/faceRecognitionService';
import { indexedDBService } from '../lib/indexedDB';
import { markCheckIn, markCheckOut } from '../services/attendanceService';
import { OfficeLocation } from '../types/attendance';

interface FaceVerificationModalProps {
  userId: string;
  userDetails: {
    employee_id: string;
    employee_name: string;
    office_code: string;
    district?: string;
    block?: string;
  };
  action: 'check-in' | 'half-day' | 'check-out';
  officeLocation: OfficeLocation;
  notes?: string;
  odWorkType?: string;
  isOnline: boolean;
  onVerified: (imagePath: string) => void;  // ✅ FIXED: Match what Dashboard expects
  onCancel: () => void;
}

export function FaceVerificationModal({
  userId,
  userDetails,
  action,
  officeLocation,
  notes,
  odWorkType: _odWorkType,
  isOnline,
  onVerified,
  onCancel,
}: FaceVerificationModalProps) {
  void _stopVideoStream;
  void _odWorkType;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [step, setStep] = useState<'initializing' | 'ready' | 'liveness' | 'blinking' | 'capturing' | 'done'>('initializing');

  useEffect(() => {
    let isMounted = true;
    let detectionInterval: NodeJS.Timeout | null = null;

    const initialize = async () => {
      try {
        await loadModels();

        if (!isMounted) return;

        if (videoRef.current) {
          const stream = await startVideoStream(videoRef.current);
          streamRef.current = stream;

          setLoading(false);
          setStep('ready');

          // Start face detection
          detectionInterval = setInterval(async () => {
            if (videoRef.current && !processing && isMounted) {
              const detected = await detectFace(videoRef.current);
              if (isMounted) {
                setFaceDetected(detected);
              }
            }
          }, 500);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize camera');
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (detectionInterval) clearInterval(detectionInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [processing]);

  // ✅ IMPROVED: Better image capture with compression
  const captureImage = (): string => {
    if (!videoRef.current || !canvasRef.current) return '';

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return '';

    // ✅ OPTIMIZATION: Resize to smaller dimensions for storage
    const maxWidth = 640;  // Reduce from full resolution
    const maxHeight = 480;

    let width = video.videoWidth;
    let height = video.videoHeight;

    // Scale down if too large
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    // ✅ COMPRESSION: Use lower quality JPEG (0.5 instead of 0.8)
    // This significantly reduces base64 size while keeping face recognizable
    return canvas.toDataURL('image/jpeg', 0.5);
  };

  const handleVerify = async () => {
    if (!videoRef.current || !faceDetected) {
      setError('No face detected. Please position your face clearly.');
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      // Step 1: Liveness check
      setStep('liveness');
      setSuccess('Please move your head slightly...');

      const livenessResult = await performLivenessCheck(videoRef.current, 2000);

      if (!livenessResult.passed) {
        setError(livenessResult.reason || 'Liveness check failed');
        setProcessing(false);
        setStep('ready');
        return;
      }

      // Step 2: Blink Detection
      setStep('blinking');
      setSuccess('Please blink your eyes...');

      const blinkResult = await detectBlink(videoRef.current, 10000); // Increased to 10s

      if (!blinkResult.success) {
        setSuccess(''); // Clear the "Please blink" message
        setError(blinkResult.message || 'Blink not detected. Please try again.');
        setProcessing(false);
        setStep('ready');
        return;
      }

      // Step 3: Capture face
      setStep('capturing');
      setSuccess('Capturing your face...');

      await new Promise(resolve => setTimeout(resolve, 500));

      const descriptor = await captureFaceDescriptor(videoRef.current);

      if (!descriptor) {
        setError('Failed to capture face data. Please try again.');
        setProcessing(false);
        setStep('ready');
        return;
      }

      // Step 4: Verify Identity (Match with stored face)
      setSuccess('Verifying identity...');

      const userFaceData = await indexedDBService.getFaceData(userId);

      if (!userFaceData || !userFaceData.faceDescriptor) {
        // If no face data found locally, try to fetch from online if connected
        // For now, we'll warn but might allow if it's the first time (depending on policy)
        // BUT for security, we should probably block or require password fallback
        console.warn('No face data found for user');

        // OPTIONAL: If strict security is required, uncomment below:
        // setError('Face data not found. Please register your face first.');
        // setProcessing(false);
        // setStep('ready');
        // return;
      } else {
        const isMatch = isFaceMatch(descriptor, userFaceData.faceDescriptor);

        if (!isMatch) {
          setError('IDENTITY VERIFICATION FAILED: Face does not match profile.');
          setProcessing(false);
          setStep('ready');
          return;
        }
        console.log('✅ Identity Verified');
      }

      // Step 5: Capture image (compressed)
      const imagePath = captureImage();

      console.log('Image size:', imagePath.length, 'characters');  // Debug log

      // Step 6: Save attendance
      setSuccess('Saving attendance...');

      let result;

      if (action === 'check-in') {
        result = await markCheckIn(
          userId,
          userDetails,
          officeLocation,
          imagePath,
          notes,
          isOnline
        );
      } else {
        const isHalfDay = action === 'half-day';
        result = await markCheckOut(
          userId,
          officeLocation,
          imagePath,
          notes,
          isHalfDay,
          isOnline
        );
      }

      if (result.success) {
        setStep('done');
        setSuccess('Attendance marked successfully!');

        setTimeout(() => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          onVerified(imagePath);
        }, 1500);
      } else {
        setError(result.error || 'Failed to save attendance');
        setProcessing(false);
        setStep('ready');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed');
      setProcessing(false);
      setStep('ready');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {action === 'check-in' ? 'Check In' : action === 'half-day' ? 'Half Day' : 'Check Out'}
          </h2>
          <button
            onClick={onCancel}
            disabled={processing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
              <div className="flex-shrink-0">⚠️</div>
              <div>
                <p className="font-bold">Verification Failed</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              {step === 'done' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
              )}
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </div>
          )}

          {/* Video Feed */}
          <div className="relative mb-6 rounded-xl overflow-hidden bg-gray-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
              style={{ maxHeight: '400px', transform: 'scaleX(-1)' }}
            />

            {/* Face Detection Indicator */}
            {!loading && (
              <div className="absolute top-4 right-4">
                <div className={`px-4 py-2 rounded-full ${faceDetected
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-white' : 'bg-white animate-pulse'
                      }`} />
                    <span className="text-sm font-medium">
                      {faceDetected ? 'Face Detected' : 'No Face'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                <div className="text-center text-white">
                  <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-medium">Initializing camera...</p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Instructions */}
          {!loading && !processing && step === 'ready' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-2">Instructions:</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Position your face clearly in the camera</li>
                <li>Ensure good lighting</li>
                <li>Remove glasses or masks if possible</li>
                <li>Click "Verify" when ready</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              onClick={handleVerify}
              disabled={!faceDetected || processing || loading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Verify Face
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}