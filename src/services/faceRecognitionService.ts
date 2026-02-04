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