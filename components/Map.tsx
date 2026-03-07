'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Fix Leaflet default marker icons in Next.js
const fixLeafletIcons = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
};

interface MapProps {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  groundTruthLat?: number;
  groundTruthLng?: number;
  className?: string;
}

export default function Map({
  latitude,
  longitude,
  accuracy,
  groundTruthLat,
  groundTruthLng,
  className = '',
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const groundTruthMarkerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Fix Leaflet icons for bundlers
    fixLeafletIcons();

    // Small delay to ensure container is properly sized
    const initTimeout = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Default center (Warsaw, Poland) if no location yet
      const defaultCenter: L.LatLngExpression = [52.2297, 21.0122];
      const initialCenter = latitude && longitude ? [latitude, longitude] as L.LatLngExpression : defaultCenter;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control to bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add attribution to bottom left
      L.control.attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('© <a href="https://openstreetmap.org">OSM</a>')
        .addTo(map);

      mapRef.current = map;
      setIsMapReady(true);

      // Force recalculation of map size after layout settles
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }, 50);

    return () => {
      clearTimeout(initTimeout);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !latitude || !longitude) return;

    const map = mapRef.current;
    const position: L.LatLngExpression = [latitude, longitude];

    // Update or create accuracy circle
    if (accuracy) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng(position);
        accuracyCircleRef.current.setRadius(accuracy);
      } else {
        accuracyCircleRef.current = L.circle(position, {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);
      }
    }

    // Update or create user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(position);
    } else {
      userMarkerRef.current = L.circleMarker(position, {
        radius: 10,
        color: '#ffffff',
        fillColor: '#3b82f6',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);

      // Add pulsing effect via CSS class
      const el = userMarkerRef.current.getElement();
      if (el) {
        el.classList.add('user-location-marker');
      }
    }

    // Pan to user location
    map.setView(position, map.getZoom());
  }, [latitude, longitude, accuracy, isMapReady]);

  // Update ground truth marker (QR verified location)
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    // Remove existing marker if coordinates cleared
    if (!groundTruthLat || !groundTruthLng) {
      if (groundTruthMarkerRef.current) {
        groundTruthMarkerRef.current.remove();
        groundTruthMarkerRef.current = null;
      }
      return;
    }

    const position: L.LatLngExpression = [groundTruthLat, groundTruthLng];

    // Create custom icon for ground truth
    const groundTruthIcon = L.divIcon({
      className: 'ground-truth-marker',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (groundTruthMarkerRef.current) {
      groundTruthMarkerRef.current.setLatLng(position);
    } else {
      groundTruthMarkerRef.current = L.marker(position, {
        icon: groundTruthIcon,
      }).addTo(map);
      
      groundTruthMarkerRef.current.bindPopup('QR Verified Location');
    }
  }, [groundTruthLat, groundTruthLng, isMapReady]);

  return (
    <div className={`relative w-full h-full ${className}`} style={{ minHeight: '300px' }}>
      <div ref={mapContainerRef} className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      
      {/* Loading state */}
      {!isMapReady && (
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
          <div className="text-gray-400">Loading map...</div>
        </div>
      )}

      {/* No location indicator */}
      {isMapReady && (!latitude || !longitude) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-lg px-4 py-2 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm text-yellow-400">Waiting for GPS...</span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .user-location-marker {
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }
        
        .ground-truth-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
