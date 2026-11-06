import React, { useEffect, useRef } from 'react';
import { MapPin, Navigation, Compass } from 'lucide-react';
import type { GeoPoint } from '@/types';

export interface MarkerInfo {
  id: string;
  location: GeoPoint;
  title?: string;
  type?: 'task' | 'requester' | 'aidmate';
}

export interface MapViewProps {
  center?: GeoPoint | null;
  zoom?: number;
  markers?: MarkerInfo[];
  draggableMarker?: boolean;
  onMarkerDragEnd?: (location: GeoPoint) => void;
  className?: string;
  height?: string;
  interactive?: boolean;
  addressLabel?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  center = { lat: 12.9716, lng: 77.5946 }, // Default Bangalore
  zoom = 15,
  markers = [],
  draggableMarker = false,
  onMarkerDragEnd,
  className = '',
  height = '300px',
  addressLabel,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * Google Maps Initialization Placeholder:
     * When ready to attach real Google Maps:
     *
     * const loader = new Loader({
     *   apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
     *   version: 'weekly',
     * });
     *
     * loader.load().then(() => {
     *   if (mapRef.current && window.google?.maps) {
     *     const map = new google.maps.Map(mapRef.current, {
     *       center: center || { lat: 12.9716, lng: 77.5946 },
     *       zoom,
     *       disableDefaultUI: false,
     *       zoomControl: true,
     *     });
     *
     *     // Add markers
     *     markers.forEach((m) => {
     *       new google.maps.Marker({
     *         position: m.location,
     *         map,
     *         title: m.title,
     *         draggable: draggableMarker,
     *       });
     *     });
     *   }
     * });
     */
  }, [center, zoom, markers, draggableMarker, onMarkerDragEnd]);

  const activeCenter = center || { lat: 12.9716, lng: 77.5946 };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 flex flex-col items-center justify-center select-none ${className}`}
      style={{ height }}
    >
      {/* Map DOM Element Container for Google Maps */}
      <div id="map" ref={mapRef} className="absolute inset-0 w-full h-full z-0">
        {/* Styled Simulated Hyperlocal Map Background */}
        <div className="w-full h-full bg-[#f1f5f9] relative overflow-hidden">
          {/* Stylized road & grid lines */}
          <svg className="w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
              </pattern>
              <pattern id="roads" width="240" height="240" patternUnits="userSpaceOnUse">
                <path d="M 0 120 L 240 120 M 120 0 L 120 240" fill="none" stroke="#fed7aa" strokeWidth="8" />
                <path d="M 0 120 L 240 120 M 120 0 L 120 240" fill="none" stroke="#ffffff" strokeWidth="5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <rect width="100%" height="100%" fill="url(#roads)" />
          </svg>

          {/* Central Map Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center group cursor-pointer animate-bounce-subtle">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center shadow-lg shadow-[#FF6B4A]/40 ring-4 ring-white">
                <MapPin className="w-5 h-5 fill-white text-[#FF6B4A]" />
              </div>
              <div className="w-2.5 h-1 bg-black/20 rounded-full mx-auto mt-1 blur-[1px]" />
            </div>
            {addressLabel && (
              <span className="mt-1 px-2.5 py-1 rounded-full bg-[#1A1D3E] text-white text-[11px] font-medium shadow-md whitespace-nowrap max-w-[200px] truncate">
                {addressLabel}
              </span>
            )}
          </div>

          {/* Render extra markers if any */}
          {markers.map((marker, idx) => {
            const isAidmate = marker.type === 'aidmate';
            const offset = (idx + 1) * 28;
            return (
              <div
                key={marker.id}
                style={{
                  top: `calc(50% + ${idx % 2 === 0 ? offset : -offset}px)`,
                  left: `calc(50% + ${idx % 2 === 0 ? -offset : offset}px)`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md ring-2 ring-white ${
                    isAidmate ? 'bg-[#22C55E]' : 'bg-[#1A1D3E]'
                  }`}
                >
                  <Navigation className="w-4 h-4 fill-white" />
                </div>
                {marker.title && (
                  <span className="mt-0.5 px-2 py-0.5 rounded-md bg-white text-[#1A1D3E] text-[10px] font-bold shadow-sm border border-slate-200">
                    {marker.title}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Map Controls & Overlays */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <div className="p-2 bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200 text-[#1A1D3E]">
          <Compass className="w-4 h-4 text-[#FF6B4A] animate-spin-slow" />
        </div>
      </div>

      {/* Location Bar Footer */}
      <div className="absolute bottom-2 left-2 right-2 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/80 shadow-md flex items-center justify-between text-xs text-[#1A1D3E]">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#FF6B4A] shrink-0" />
          <span className="truncate font-medium">
            {addressLabel || `${activeCenter.lat.toFixed(4)}, ${activeCenter.lng.toFixed(4)}`}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">Hyperlocal GPS</span>
      </div>
    </div>
  );
};

export default MapView;
