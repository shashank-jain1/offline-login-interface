
import { GeolocationData, OfficeLocation } from '../types/attendance';

/**
 * Get current device location
 */
export async function getCurrentLocation(): Promise<GeolocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if user is within geofence
 */
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  officeLat: number,
  officeLng: number,
  radius: number = 200
): boolean {
  const distance = calculateDistance(userLat, userLng, officeLat, officeLng);
  return distance <= radius;
}

/**
 * Get distance from office in a formatted string
 */
export function getDistanceText(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m away`;
  }
  return `${(distanceInMeters / 1000).toFixed(1)}km away`;
}

/**
 * Reverse geocoding - get address from coordinates
 * Using OpenStreetMap Nominatim API (free, no API key needed)
 */
export async function getAddressFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'AttendanceApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    return data.display_name || 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}

/**
 * Validate geofence and prepare location data
 */
export async function validateAndPrepareLocation(
  officeLocation: OfficeLocation
): Promise<{
  valid: boolean;
  data?: GeolocationData & { 
    distance: number; 
    withinFence: boolean;
    address?: string;
  };
  error?: string;
}> {
  try {
    const location = await getCurrentLocation();
    
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      officeLocation.latitude,
      officeLocation.longitude
    );
    
    const withinFence = distance <= officeLocation.geofence_radius;
    
    // Get address (non-blocking)
    let address: string | undefined;
    try {
      address = await getAddressFromCoordinates(location.latitude, location.longitude);
    } catch (err) {
      console.warn('Failed to get address:', err);
    }
    
    if (!withinFence) {
      return {
        valid: false,
        error: `You are ${getDistanceText(distance)} from the office. Please be within ${officeLocation.geofence_radius}m to mark attendance.`,
        data: {
          ...location,
          distance,
          withinFence: false,
          address,
        },
      };
    }
    
    return {
      valid: true,
      data: {
        ...location,
        distance,
        withinFence: true,
        address,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Location error',
    };
  }
}

/**
 * Watch position for continuous tracking (use sparingly)
 */
export function watchPosition(
  callback: (position: GeolocationData) => void,
  errorCallback: (error: string) => void
): number {
  if (!navigator.geolocation) {
    errorCallback('Geolocation not supported');
    return -1;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => {
      errorCallback(error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );
}

/**
 * Clear position watch
 */
export function clearWatch(watchId: number): void {
  if (watchId !== -1 && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}