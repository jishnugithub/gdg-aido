import { useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { GeoPoint } from '@/types';

declare global {
  interface Window {
    google?: any;
  }
}

export interface UseGeocodingReturn {
  reverseGeocode: (lat: number, lng: number) => Promise<string>;
  geocode: (address: string) => Promise<GeoPoint>;
  loading: boolean;
  error: string | null;
}

let geocoderInstance: any = null;
let loaderPromise: Promise<void> | null = null;

async function getGoogleGeocoder(): Promise<any> {
  if (geocoderInstance) {
    return geocoderInstance;
  }

  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    geocoderInstance = new window.google.maps.Geocoder();
    return geocoderInstance;
  }

  if (!loaderPromise) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (apiKey) {
      try {
        setOptions({ key: apiKey, v: 'weekly' });
        loaderPromise = importLibrary('geocoding')
          .then((lib: any) => {
            if (lib?.Geocoder) {
              geocoderInstance = new lib.Geocoder();
            }
          })
          .catch((err) => {
            console.warn('[useGeocoding] Google Maps importLibrary failed:', err);
          });
      } catch (e) {
        console.warn('[useGeocoding] Error configuring Google Maps:', e);
        loaderPromise = Promise.resolve();
      }
    } else {
      loaderPromise = Promise.resolve();
    }
  }

  await loaderPromise;

  if (geocoderInstance) {
    return geocoderInstance;
  }

  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    geocoderInstance = new window.google.maps.Geocoder();
    return geocoderInstance;
  }

  throw new Error('Google Maps Geocoder not initialized');
}

export const useGeocoding = (): UseGeocodingReturn => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Convert GPS coordinates into a human-readable street address
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      // 1. Try Google Maps Geocoder API
      try {
        const geocoder = await getGoogleGeocoder();
        const response = await geocoder.geocode({
          location: { lat, lng },
        });

        if (response.results && response.results.length > 0) {
          return response.results[0].formatted_address;
        }
      } catch (googleErr) {
        console.warn('[useGeocoding] Google Geocoding failed, trying fallback:', googleErr);
      }

      // 2. Fallback to OpenStreetMap Nominatim (if Google Maps API key is not configured or fails)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          return data.display_name;
        }
      }

      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      console.error('[useGeocoding] Reverse geocoding error:', err);
      const fallbackStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setError('Unable to fetch address details');
      return fallbackStr;
    } finally {
      setLoading(false);
    }
  }, []);

  // Convert a street address string into { lat, lng } coordinates
  const geocode = useCallback(async (address: string): Promise<GeoPoint> => {
    const trimmed = address.trim();
    if (!trimmed) {
      throw new Error('Address cannot be empty');
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try Google Maps Geocoder API
      try {
        const geocoder = await getGoogleGeocoder();
        const response = await geocoder.geocode({ address: trimmed });

        if (response.results && response.results.length > 0) {
          const loc = response.results[0].geometry.location;
          return {
            lat: typeof loc.lat === 'function' ? loc.lat() : (loc.lat as number),
            lng: typeof loc.lng === 'function' ? loc.lng() : (loc.lng as number),
          };
        }
      } catch (googleErr) {
        console.warn('[useGeocoding] Google Geocoding address failed, trying fallback:', googleErr);
      }

      // 2. Fallback to OpenStreetMap Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
        }
      }

      throw new Error(`Location not found for "${trimmed}"`);
    } catch (err) {
      console.error('[useGeocoding] Geocode error:', err);
      setError(`Could not find coordinates for "${trimmed}"`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reverseGeocode,
    geocode,
    loading,
    error,
  };
};
