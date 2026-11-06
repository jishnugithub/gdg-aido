import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { GeoPoint } from '@/types';

export interface LocationContextType {
  currentLocation: GeoPoint | null;
  locationError: string | null;
  isTracking: boolean;
  requestPermission: () => Promise<boolean>;
  startTracking: () => void;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<GeoPoint>;
}

export const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);

  // Get current one-off location with Promise resolution
  const getCurrentLocation = useCallback((): Promise<GeoPoint> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const errorMsg = 'Geolocation is not supported by your browser or environment.';
        setLocationError(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point: GeoPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(point);
          setLocationError(null);
          resolve(point);
        },
        (error) => {
          let errorMsg = 'Failed to retrieve current location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission was denied. Please allow location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out. Please try again.';
              break;
          }
          setLocationError(errorMsg);
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }, []);

  // Request location permission explicitly
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return false;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        if (permissionStatus.state === 'granted') {
          await getCurrentLocation();
          return true;
        }

        if (permissionStatus.state === 'denied') {
          setLocationError('Location permission is denied in browser settings.');
          return false;
        }
      }

      // If prompt or permissions API not fully supported, invoke getCurrentLocation
      await getCurrentLocation();
      return true;
    } catch {
      return false;
    }
  }, [getCurrentLocation]);

  // Start continuous position tracking
  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      // Already actively watching
      return;
    }

    setIsTracking(true);
    setLocationError(null);

    try {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const point: GeoPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(point);
          setLocationError(null);
        },
        (error) => {
          let errorMsg = 'Failed to watch location.';
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = 'Location permission denied while tracking.';
            setIsTracking(false);
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
          }
          setLocationError(errorMsg);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );

      watchIdRef.current = id;
    } catch (err) {
      console.error('[LocationContext] Error starting watchPosition:', err);
      setIsTracking(false);
      setLocationError('Unable to start continuous location tracking.');
    }
  }, []);

  // Stop continuous position tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const value: LocationContextType = {
    currentLocation,
    locationError,
    isTracking,
    requestPermission,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
