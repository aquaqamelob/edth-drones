'use client';

import { useState, useEffect } from 'react';
import {
  useDeviceMotion,
  useDeviceOrientation,
  useGeolocation,
  useDeviceMetadata,
  useSensorPermissions,
} from '@/lib/sensors';

export default function TestPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const { motion, history: motionHistory, permissionStatus: motionStatus, requestPermission: requestMotion, needsPermission: needsMotionPermission } = useDeviceMotion(isRunning);
  const { orientation, permissionStatus: orientationStatus, requestPermission: requestOrientation, getCompassHeading, needsPermission: needsOrientationPermission } = useDeviceOrientation(isRunning);
  const { location, permissionStatus: geoStatus, requestPermission: requestGeo, error: geoError } = useGeolocation(isRunning);
  const deviceMetadata = useDeviceMetadata();
  const { permissions, requestAllPermissions } = useSensorPermissions();

  const [cameraStatus, setCameraStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [micStatus, setMicStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
  }, []);

  const handleStartTest = async () => {
    setIsRequesting(true);

    try {
      // iOS specific: Request motion/orientation permissions first (requires direct user gesture)
      if (isIOS) {
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          try {
            const motionPerm = await (DeviceMotionEvent as any).requestPermission();
            console.log('Motion permission:', motionPerm);
          } catch (e) {
            console.warn('Motion permission error:', e);
          }
        }
        
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          try {
            const orientPerm = await (DeviceOrientationEvent as any).requestPermission();
            console.log('Orientation permission:', orientPerm);
          } catch (e) {
            console.warn('Orientation permission error:', e);
          }
        }
      }

      // Request sensor permissions
      await requestMotion();
      await requestOrientation();
      await requestGeo();

      // Test camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        setCameraStatus('granted');
      } catch {
        setCameraStatus('denied');
      }

      // Test mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicStatus('granted');
      } catch {
        setMicStatus('denied');
      }

      setIsRunning(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'granted': return '✅';
      case 'denied': return '❌';
      default: return '⏳';
    }
  };

  const compass = getCompassHeading();

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <header className="max-w-2xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Test Sensorów</h1>
        <p className="text-gray-400">
          Sprawdź dostępność i działanie wszystkich czujników urządzenia
        </p>
        {isIOS && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-2">
            <p className="text-blue-300 text-sm">
              📱 Wykryto iOS - czujniki ruchu wymagają osobnego zezwolenia
            </p>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {!isRunning ? (
          <div className="space-y-4">
            <button
              onClick={handleStartTest}
              disabled={isRequesting}
              className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3"
            >
              {isRequesting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Żądanie uprawnień...</span>
                </>
              ) : (
                'Rozpocznij Test Sensorów'
              )}
            </button>
            
            {isIOS && (
              <p className="text-sm text-gray-500 text-center">
                Po naciśnięciu przycisku pojawią się okna z prośbą o dostęp do czujników.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Permissions Status */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Status Uprawnień</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{statusIcon(cameraStatus)}</span>
                  <span>Kamera</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{statusIcon(micStatus)}</span>
                  <span>Mikrofon</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{statusIcon(geoStatus)}</span>
                  <span>Lokalizacja</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{statusIcon(motionStatus)}</span>
                  <span>Ruch/Orientacja</span>
                </div>
              </div>
            </div>

            {/* Motion Data */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">
                Żyroskop / Akcelerometr
                <span className="text-sm text-gray-400 ml-2">({motionHistory.length} samples)</span>
              </h2>
              
              {motion ? (
                <div className="space-y-4 font-mono text-sm">
                  <div>
                    <h3 className="text-gray-400 mb-1">Rotation Rate (°/s)</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">α</span>{' '}
                        <span className="text-red-400">{motion.rotationRate.alpha?.toFixed(2) || '—'}</span>
                      </div>
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">β</span>{' '}
                        <span className="text-green-400">{motion.rotationRate.beta?.toFixed(2) || '—'}</span>
                      </div>
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">γ</span>{' '}
                        <span className="text-blue-400">{motion.rotationRate.gamma?.toFixed(2) || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-gray-400 mb-1">Acceleration (m/s²)</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">x</span>{' '}
                        <span className="text-red-400">{motion.acceleration.x?.toFixed(2) || '—'}</span>
                      </div>
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">y</span>{' '}
                        <span className="text-green-400">{motion.acceleration.y?.toFixed(2) || '—'}</span>
                      </div>
                      <div className="bg-zinc-800 rounded p-2">
                        <span className="text-gray-500">z</span>{' '}
                        <span className="text-blue-400">{motion.acceleration.z?.toFixed(2) || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Czekam na dane...</p>
              )}
            </div>

            {/* Orientation / Compass */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Kompas / Orientacja</h2>
              
              {orientation ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ transform: `rotate(${orientation.alpha || 0}deg)` }}
                      >
                        <div className="w-1 h-16 bg-red-500 rounded origin-bottom" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {Math.round(orientation.alpha || 0)}°
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-sm">
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-gray-500">α (yaw)</div>
                      <div>{orientation.alpha?.toFixed(1) || '—'}°</div>
                    </div>
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-gray-500">β (pitch)</div>
                      <div>{orientation.beta?.toFixed(1) || '—'}°</div>
                    </div>
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-gray-500">γ (roll)</div>
                      <div>{orientation.gamma?.toFixed(1) || '—'}°</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Czekam na dane...</p>
              )}
            </div>

            {/* Location */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Lokalizacja GPS</h2>
              
              {location ? (
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Szerokość:</span>
                    <span>{location.latitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Długość:</span>
                    <span>{location.longitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dokładność:</span>
                    <span>±{location.accuracy.toFixed(0)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wysokość:</span>
                    <span>{location.altitude?.toFixed(1) || '—'}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prędkość:</span>
                    <span>{location.speed?.toFixed(1) || '—'} m/s</span>
                  </div>
                </div>
              ) : geoError ? (
                <p className="text-red-400">{geoError}</p>
              ) : (
                <p className="text-gray-500">Czekam na GPS...</p>
              )}
            </div>

            {/* Device Metadata */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Metadane Urządzenia</h2>
              
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Device ID:</span>
                  <span className="truncate max-w-[200px]">{deviceMetadata.deviceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform:</span>
                  <span>{deviceMetadata.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Screen:</span>
                  <span>{deviceMetadata.screenWidth}x{deviceMetadata.screenHeight} @{deviceMetadata.pixelRatio}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Connection:</span>
                  <span>{deviceMetadata.connectionEffectiveType || deviceMetadata.connectionType || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Battery:</span>
                  <span>
                    {deviceMetadata.batteryLevel !== null 
                      ? `${Math.round(deviceMetadata.batteryLevel * 100)}%${deviceMetadata.batteryCharging ? ' ⚡' : ''}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Language:</span>
                  <span>{deviceMetadata.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Timezone:</span>
                  <span>{deviceMetadata.timezone}</span>
                </div>
              </div>
            </div>

            {/* Liveness Check Demo */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Liveness Check</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Motion Samples:</span>
                  <span className={motionHistory.length >= 10 ? 'text-green-400' : 'text-yellow-400'}>
                    {motionHistory.length} / 10 min
                  </span>
                </div>
                
                {motionHistory.length >= 10 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Rotation:</span>
                      <span>
                        {(motionHistory.reduce((sum, m) => 
                          sum + Math.abs(m.rotationRate.alpha || 0) + Math.abs(m.rotationRate.beta || 0) + Math.abs(m.rotationRate.gamma || 0)
                        , 0) / motionHistory.length).toFixed(2)}°/s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      {motionHistory.some(m => 
                        Math.abs(m.rotationRate.alpha || 0) > 0.1 ||
                        Math.abs(m.rotationRate.beta || 0) > 0.1 ||
                        Math.abs(m.rotationRate.gamma || 0) > 0.1
                      ) ? (
                        <span className="text-green-400">✓ Ludzki ruch wykryty</span>
                      ) : (
                        <span className="text-red-400">⚠ Zbyt stabilne - podejrzane</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
