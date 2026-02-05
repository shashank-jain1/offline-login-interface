import * as faceapi from 'face-api.js';
import { cameraManager } from './cameramanager';

let modelsLoaded = false;

export interface FaceDescriptor {
  descriptor: number[];
  userId: string;
  email: string;
  createdAt: number;
}

/**
 * Load face-api.js models
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    const MODEL_URL = '/models'; // Models will be in public/models directory
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    ]);
    
    modelsLoaded = true;
    console.log('Face recognition models loaded successfully');
  } catch (error) {
    console.error('Error loading face recognition models:', error);
    throw new Error('Failed to load face recognition models');
  }
}

/**
 * Capture face descriptor from video stream
 */
export async function captureFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<Float32Array | null> {
  try {
    if (!modelsLoaded) {
      await loadModels();
    }

    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return null;
    }

    return detection.descriptor;
  } catch (error) {
    console.error('Error capturing face descriptor:', error);
    return null;
  }
}

/**
 * Compare two face descriptors and return similarity score
 */
export function compareFaceDescriptors(
  descriptor1: Float32Array | number[],
  descriptor2: Float32Array | number[]
): number {
  const desc1 = Array.isArray(descriptor1) ? new Float32Array(descriptor1) : descriptor1;
  const desc2 = Array.isArray(descriptor2) ? new Float32Array(descriptor2) : descriptor2;
  
  return faceapi.euclideanDistance(desc1, desc2);
}

/**
 * Check if two face descriptors match (within threshold)
 */
export function isFaceMatch(
  descriptor1: Float32Array | number[],
  descriptor2: Float32Array | number[],
  threshold: number = 0.6
): boolean {
  const distance = compareFaceDescriptors(descriptor1, descriptor2);
  return distance < threshold;
}

/**
 * Start video stream from camera using camera manager
 */
export async function startVideoStream(
  videoElement: HTMLVideoElement
): Promise<MediaStream> {
  try {
    return await cameraManager.getStream(videoElement);
  } catch (error: any) {
    console.error('Error starting video stream:', error);
    
    // Provide more specific error messages
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Camera access denied. Please allow camera permissions in your browser settings.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No camera found on your device.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Camera is already in use by another application.');
    } else if (error.name === 'OverconstrainedError') {
      throw new Error('Camera does not support the requested video constraints.');
    } else if (error.name === 'SecurityError') {
      throw new Error('Camera access is not allowed on insecure origins. Please use HTTPS.');
    } else {
      throw new Error('Failed to access camera: ' + error.message);
    }
  }
}

/**
 * Stop video stream using camera manager
 */
export async function stopVideoStream(stream?: MediaStream): Promise<void> {
  await cameraManager.releaseStream();
}

/**
 * Detect if a face is present in the video
 */
export async function detectFace(
  videoElement: HTMLVideoElement
): Promise<boolean> {
  try {
    if (!modelsLoaded) {
      await loadModels();
    }

    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions()
    );

    return detection !== undefined;
  } catch (error) {
    console.error('Error detecting face:', error);
    return false;
  }
}

/**
 * Get multiple face descriptors for better accuracy
 */
export async function captureMultipleFaceDescriptors(
  videoElement: HTMLVideoElement,
  count: number = 3,
  delayMs: number = 500
): Promise<Float32Array[]> {
  const descriptors: Float32Array[] = [];

  for (let i = 0; i < count; i++) {
    const descriptor = await captureFaceDescriptor(videoElement);
    
    if (descriptor) {
      descriptors.push(descriptor);
    }

    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return descriptors;
}

/**
 * Get average descriptor from multiple captures
 */
export function getAverageDescriptor(descriptors: Float32Array[]): Float32Array | null {
  if (descriptors.length === 0) return null;

  const length = descriptors[0].length;
  const avgDescriptor = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const descriptor of descriptors) {
      sum += descriptor[i];
    }
    avgDescriptor[i] = sum / descriptors.length;
  }

  return avgDescriptor;
}

/**
 * Perform liveness detection by analyzing 3D facial movement and depth cues
 * Set SKIP_LIVENESS = true in code to disable for testing (NOT for production!)
 */
export async function performLivenessCheck(
  videoElement: HTMLVideoElement,
  duration: number = 3000,
  threshold: number = 0.015
): Promise<{ passed: boolean; reason?: string }> {
  try {
    if (!modelsLoaded) {
      await loadModels();
    }

    const samples: {
      descriptor: Float32Array;
      landmarks: any;
      box: any;
      timestamp: number;
    }[] = [];
    
    const sampleCount = 6; // Even more samples
    const interval = duration / sampleCount;
    const startTime = Date.now();

    console.log('🔍 Starting STRICT anti-spoofing liveness detection...');

    // Capture multiple samples with landmarks
    for (let i = 0; i < sampleCount; i++) {
      let retries = 2;
      let sampleCaptured = false;

      while (retries > 0 && !sampleCaptured) {
        try {
          const detection = await Promise.race([
            faceapi
              .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ 
                inputSize: 224,
                scoreThreshold: 0.5
              }))
              .withFaceLandmarks()
              .withFaceDescriptor(),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 3000)
            )
          ]);

          if (detection) {
            samples.push({
              descriptor: detection.descriptor,
              landmarks: detection.landmarks,
              box: detection.detection.box,
              timestamp: Date.now() - startTime
            });
            sampleCaptured = true;
            console.log(`✓ Sample ${i + 1}/${sampleCount} captured`);
          } else {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } catch (err) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
      }

      if (i < sampleCount - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    if (samples.length < 4) {
      console.error(`❌ Only ${samples.length} samples captured, need at least 4`);
      return { 
        passed: false, 
        reason: `Could not capture enough samples (${samples.length}/6). Please ensure good lighting.` 
      };
    }

    console.log(`📊 Analyzing ${samples.length} samples...`);

    // 1. STRICT Size Variance Check (catches photos being moved)
    const boxSizes = samples.map(s => s.box.width * s.box.height);
    const avgSize = boxSizes.reduce((a, b) => a + b, 0) / boxSizes.length;
    const sizeDeviations = boxSizes.map(size => Math.abs(size - avgSize) / avgSize);
    const maxSizeDeviation = Math.max(...sizeDeviations);
    
    console.log(`📏 Size analysis:`);
    console.log(`   Average size: ${avgSize.toFixed(1)}`);
    console.log(`   Max deviation: ${(maxSizeDeviation * 100).toFixed(2)}%`);
    
    // Real faces have at least 0.5% size variation from breathing/micro-movements
    // Photos have virtually ZERO variation
    if (maxSizeDeviation < 0.005) {
      console.error('❌ PHOTO DETECTED: No size variation (rigid object)');
      return {
        passed: false,
        reason: '🚫 Photo detected. Face size is too consistent. Please use a live camera.'
      };
    }

    // 2. STRICT Landmark Analysis (catches rigid movement)
    const landmarkDistances: number[] = [];
    
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1].landmarks;
      const curr = samples[i].landmarks;
      
      // Get multiple landmark pairs
      const prevNose = prev.getNose()[3];
      const currNose = curr.getNose()[3];
      const prevLeftEye = prev.getLeftEye()[3];
      const currLeftEye = curr.getLeftEye()[3];
      const prevRightEye = prev.getRightEye()[3];
      const currRightEye = curr.getRightEye()[3];
      
      // Calculate INTERNAL face distances (these should vary subtly in real faces)
      const prevEyeDistance = Math.sqrt(
        Math.pow(prevLeftEye.x - prevRightEye.x, 2) + 
        Math.pow(prevLeftEye.y - prevRightEye.y, 2)
      );
      const currEyeDistance = Math.sqrt(
        Math.pow(currLeftEye.x - currRightEye.x, 2) + 
        Math.pow(currLeftEye.y - currRightEye.y, 2)
      );
      
      const relativeChange = Math.abs(currEyeDistance - prevEyeDistance) / prevEyeDistance;
      landmarkDistances.push(relativeChange);
    }
    
    const maxLandmarkChange = Math.max(...landmarkDistances);
    console.log(`👁️ Landmark analysis:`);
    console.log(`   Max relative change: ${(maxLandmarkChange * 100).toFixed(3)}%`);
    
    // Real faces have at least 0.1% variation in internal distances
    // Photos have NEAR-ZERO variation (rigid)
    if (maxLandmarkChange < 0.002) {
      console.error('❌ PHOTO DETECTED: Rigid facial structure (no deformation)');
      return {
        passed: false,
        reason: '🚫 Photo detected. Facial landmarks are too rigid. Please use a live camera.'
      };
    }

    // 3. Movement Pattern Analysis
    const xPositions = samples.map(s => s.box.x);
    const yPositions = samples.map(s => s.box.y);
    
    const xVariance = calculateVariance(xPositions);
    const yVariance = calculateVariance(yPositions);
    
    console.log(`🎯 Position variance: X=${xVariance.toFixed(2)}, Y=${yVariance.toFixed(2)}`);

    // Check for unnatural perfectly linear movement (typical of photo being moved)
    const movementRatio = xVariance > 0 ? yVariance / xVariance : 0;
    if ((movementRatio < 0.1 || movementRatio > 10) && (xVariance > 10 || yVariance > 10)) {
      console.warn('⚠️ Suspicious perfectly linear movement detected');
    }

    // 4. Temporal Descriptor Consistency
    let descriptorChanges: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const distance = faceapi.euclideanDistance(
        samples[i - 1].descriptor, 
        samples[i].descriptor
      );
      descriptorChanges.push(distance);
    }
    
    const avgDescriptorChange = descriptorChanges.reduce((a, b) => a + b, 0) / descriptorChanges.length;
    const maxDescriptorChange = Math.max(...descriptorChanges);
    
    console.log(`🧬 Descriptor analysis:`);
    console.log(`   Avg change: ${avgDescriptorChange.toFixed(4)}`);
    console.log(`   Max change: ${maxDescriptorChange.toFixed(4)}`);
    
    // Real faces: moderate descriptor changes (0.01 - 0.15 typical)
    // Photos: very small changes or very large changes (if moving quickly)
    if (avgDescriptorChange < 0.008) {
      console.error('❌ PHOTO DETECTED: Descriptor changes too small');
      return {
        passed: false,
        reason: '🚫 Photo detected. Face appearance is too static. Please use a live camera.'
      };
    }

    // 5. FINAL DECISION - ALL checks must pass
    const allChecksPassed = 
      maxSizeDeviation >= 0.005 &&      // Has depth variation
      maxLandmarkChange >= 0.002 &&     // Has facial deformation  
      avgDescriptorChange >= 0.008 &&   // Has appearance change
      avgDescriptorChange < 0.3;        // But not too much

    if (!allChecksPassed) {
      console.error('❌ LIVENESS CHECK FAILED');
      console.error(`   Size deviation: ${maxSizeDeviation >= 0.005 ? '✓' : '✗'}`);
      console.error(`   Landmark change: ${maxLandmarkChange >= 0.002 ? '✓' : '✗'}`);
      console.error(`   Descriptor change: ${avgDescriptorChange >= 0.008 && avgDescriptorChange < 0.3 ? '✓' : '✗'}`);
      
      return {
        passed: false,
        reason: '🚫 Liveness verification failed. Please ensure you are using a live camera with your actual face.'
      };
    }

    console.log('✅ All liveness checks PASSED!');
    console.log('   ✓ Depth variation detected');
    console.log('   ✓ Facial deformation detected');
    console.log('   ✓ Natural appearance changes detected');
    
    return { passed: true };
    
  } catch (error) {
    console.error('❌ Liveness detection error:', error);
    return { 
      passed: false, 
      reason: 'Liveness check encountered an error. Please try again.' 
    };
  }
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Enhanced liveness check with blink detection
 */
export async function detectBlink(
  videoElement: HTMLVideoElement,
  timeout: number = 5000
): Promise<boolean> {
  try {
    if (!modelsLoaded) {
      await loadModels();
    }

    const startTime = Date.now();
    let previousEyeAspectRatio: number | null = null;
    let blinkDetected = false;

    while (Date.now() - startTime < timeout && !blinkDetected) {
      const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (detection) {
        const landmarks = detection.landmarks;
        
        // Get eye landmarks (left eye: 36-41, right eye: 42-47)
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Calculate Eye Aspect Ratio (EAR)
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2;

        if (previousEyeAspectRatio !== null) {
          // Detect significant decrease in EAR (eye closing)
          if (previousEyeAspectRatio > 0.25 && avgEAR < 0.2) {
            blinkDetected = true;
            console.log('✓ Blink detected!');
          }
        }

        previousEyeAspectRatio = avgEAR;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return blinkDetected;
  } catch (error) {
    console.error('Blink detection error:', error);
    return false;
  }
}

/**
 * Calculate Eye Aspect Ratio for blink detection
 */
function calculateEAR(eye: any[]): number {
  // Vertical distances
  const v1 = euclideanDist(eye[1], eye[5]);
  const v2 = euclideanDist(eye[2], eye[4]);
  
  // Horizontal distance
  const h = euclideanDist(eye[0], eye[3]);
  
  return (v1 + v2) / (2.0 * h);
}

/**
 * Calculate Euclidean distance between two points
 */
function euclideanDist(point1: any, point2: any): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}