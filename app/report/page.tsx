'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useDeviceMotion,
  useDeviceOrientation,
  useGeolocation,
  useDeviceMetadata,
  useLivenessValidation,
  useSensorPermissions,
  generateSessionId,
} from '@/lib/sensors';
import { useMediaCapture, useAudioAnalyzer } from '@/lib/media';
import type { DroneReport, GroundTruth, ReportSubmissionResponse } from '@/lib/types';

type ReportStage = 'init' | 'permissions' | 'ready' | 'capturing' | 'processing' | 'complete' | 'error';

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Ładowanie...</div>
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}

function ReportPageContent() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<ReportStage>('init');
  const [groundTruth, setGroundTruth] = useState<GroundTruth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ReportSubmissionResponse | null>(null);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [sessionId] = useState(generateSessionId);

  const videoElementRef = useRef<HTMLVideoElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);

  // Sensors
  const { motion, history: motionHistory, requestPermission: requestMotion, clearHistory: clearMotion } = useDeviceMotion(stage === 'ready' || stage === 'capturing');
  const { orientation, history: orientationHistory, requestPermission: requestOrientation, getCompassHeading, clearHistory: clearOrientation } = useDeviceOrientation(stage === 'ready' || stage === 'capturing');
  const { location, history: locationHistory, requestPermission: requestGeo, clearHistory: clearLocation, error: geoError, isSecureContext } = useGeolocation(stage === 'ready' || stage === 'capturing');
  const deviceMetadata = useDeviceMetadata();
  const { validate: validateLiveness } = useLivenessValidation(motionHistory);
  const { permissions, requestAllPermissions } = useSensorPermissions();

  // Media
  const {
    isRecording,
    stream,
    initializeMedia,
    captureForDuration,
    setVideoElement,
    setCanvasElement,
    cleanup: cleanupMedia,
  } = useMediaCapture({ videoDuration: 5000 });

  const { initializeAnalyzer, detectDroneSignature, cleanup: cleanupAnalyzer } = useAudioAnalyzer(stream);

  // Parse ground truth from URL (from QR code)
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng') || searchParams.get('long');
    const qrId = searchParams.get('qr');

    if (lat && lng) {
      setGroundTruth({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        qrCodeId: qrId || undefined,
        confidence: 'HIGH',
      });
    } else {
      // No ground truth - lower confidence report
      setGroundTruth(null);
    }

    setStage('permissions');
  }, [searchParams]);

  // Initialize video element refs
  useEffect(() => {
    if (videoElementRef.current) {
      setVideoElement(videoElementRef.current);
    }
    if (canvasElementRef.current) {
      setCanvasElement(canvasElementRef.current);
    }
  }, [setVideoElement, setCanvasElement]);

  // Request all permissions
  const handleRequestPermissions = useCallback(async () => {
    try {
      // Request sensor permissions (iOS specific)
      await requestMotion();
      await requestOrientation();
      await requestGeo();

      // Initialize camera/mic
      const mediaGranted = await initializeMedia();
      if (!mediaGranted) {
        setError('Camera or microphone access denied');
        setStage('error');
        return;
      }

      // Initialize audio analyzer
      initializeAnalyzer();

      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize sensors');
      setStage('error');
    }
  }, [requestMotion, requestOrientation, requestGeo, initializeMedia, initializeAnalyzer]);

  // Start capture
  const handleStartCapture = useCallback(async () => {
    // Clear previous sensor history
    clearMotion();
    clearOrientation();
    clearLocation();

    setStage('capturing');
    setCaptureProgress(0);

    // Progress indicator
    const progressInterval = setInterval(() => {
      setCaptureProgress(prev => Math.min(prev + 2, 100));
    }, 100);

    try {
      // Capture video and audio for 5 seconds
      const mediaCapture = await captureForDuration();

      clearInterval(progressInterval);
      setCaptureProgress(100);
      setStage('processing');

      // Validate liveness
      const liveness = validateLiveness();

      // Detect drone audio signature
      const droneSignature = detectDroneSignature();

      // Get compass heading
      const compassHeading = getCompassHeading();

      // Build the report
      const report: DroneReport = {
        id: `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        reportedAt: new Date().toISOString(),
        groundTruth,
        deviceLocation: location,
        sensorSnapshot: {
          motionHistory,
          orientationHistory,
          locationHistory,
        },
        compassHeading,
        media: mediaCapture,
        liveness,
        deviceMetadata,
        droneDirection: getDirectionFromCompass(compassHeading?.magneticHeading),
      };

      // Submit report
      await submitReport(report);

    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Capture failed');
      setStage('error');
    }
  }, [
    clearMotion, clearOrientation, clearLocation,
    captureForDuration, validateLiveness, detectDroneSignature,
    getCompassHeading, sessionId, groundTruth, location,
    motionHistory, orientationHistory, locationHistory, deviceMetadata,
  ]);

  // Submit report to backend
  const submitReport = async (report: DroneReport) => {
    try {
      const formData = new FormData();
      
      // Add JSON data
      const reportData = {
        ...report,
        media: {
          ...report.media,
          video: undefined,
          audio: undefined,
        },
      };
      formData.append('data', JSON.stringify(reportData));

      // Add video blob
      if (report.media.video) {
        formData.append('video', report.media.video, 'capture.webm');
      }

      // Add audio blob
      if (report.media.audio) {
        formData.append('audio', report.media.audio, 'capture.webm');
      }

      const response = await fetch('/api/report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result: ReportSubmissionResponse = await response.json();
      setSubmissionResult(result);
      setStage('complete');

    } catch (err) {
      // Queue for offline sync if network error
      if (!navigator.onLine) {
        await queueOfflineReport(report);
        setSubmissionResult({
          success: true,
          reportId: report.id,
          threatLevel: 'YELLOW',
          message: 'Zgłoszenie zapisane - zostanie wysłane gdy połączenie będzie dostępne',
          timestamp: new Date().toISOString(),
        });
        setStage('complete');
      } else {
        throw err;
      }
    }
  };

  // Queue report for offline sync
  const queueOfflineReport = async (report: DroneReport) => {
    const db = await openReportDB();
    const tx = db.transaction('pending_reports', 'readwrite');
    await tx.objectStore('pending_reports').add({
      data: report,
      timestamp: Date.now(),
    });
    
    // Register for background sync
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-reports');
      }
    }
  };

  // Open IndexedDB
  const openReportDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('EDTHDroneReports', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('pending_reports')) {
          db.createObjectStore('pending_reports', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
      cleanupAnalyzer();
    };
  }, [cleanupMedia, cleanupAnalyzer]);

  // Render based on stage
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasElementRef} className="hidden" />

      {/* Header */}
      <header className="bg-red-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold text-sm uppercase tracking-wider">EDTH Defense</span>
        </div>
        {groundTruth && (
          <div className="text-xs text-red-300">
            QR: {groundTruth.latitude.toFixed(4)}, {groundTruth.longitude.toFixed(4)}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {stage === 'permissions' && (
          <PermissionsStage 
            onRequest={handleRequestPermissions} 
            isSecureContext={isSecureContext}
            geoError={geoError}
          />
        )}

        {stage === 'ready' && (
          <ReadyStage
            videoRef={videoElementRef}
            compass={getCompassHeading()?.magneticHeading}
            motion={motion}
            location={location}
            groundTruth={groundTruth}
            onCapture={handleStartCapture}
          />
        )}

        {stage === 'capturing' && (
          <CapturingStage
            videoRef={videoElementRef}
            progress={captureProgress}
          />
        )}

        {stage === 'processing' && (
          <ProcessingStage />
        )}

        {stage === 'complete' && submissionResult && (
          <CompleteStage result={submissionResult} />
        )}

        {stage === 'error' && (
          <ErrorStage error={error} onRetry={() => setStage('permissions')} />
        )}
      </main>

      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel
          stage={stage}
          motion={motion}
          orientation={orientation}
          location={location}
          motionSamples={motionHistory.length}
        />
      )}
    </div>
  );
}

// ==================== STAGE COMPONENTS ====================

function PermissionsStage({ 
  onRequest, 
  isSecureContext, 
  geoError 
}: { 
  onRequest: () => void;
  isSecureContext?: boolean;
  geoError?: string | null;
}) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isIOS, setIsIOS] = useState(false);
  const [localSecureContext, setLocalSecureContext] = useState(true);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    // Check secure context locally as well
    const secure = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    setLocalSecureContext(secure);
  }, []);

  const handleRequest = async () => {
    setIsRequesting(true);
    
    try {
      // On iOS, we need to request motion/orientation permissions first
      // as they require direct user interaction
      if (isIOS) {
        setCurrentStep('Żądanie dostępu do czujników ruchu...');
        
        // Request DeviceMotion permission
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          try {
            const motionPermission = await (DeviceMotionEvent as any).requestPermission();
            if (motionPermission !== 'granted') {
              console.warn('Motion permission denied');
            }
          } catch (motionErr) {
            console.warn('Motion permission request failed:', motionErr);
          }
        }
        
        // Request DeviceOrientation permission
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          try {
            const orientationPermission = await (DeviceOrientationEvent as any).requestPermission();
            if (orientationPermission !== 'granted') {
              console.warn('Orientation permission denied');
            }
          } catch (orientationErr) {
            console.warn('Orientation permission request failed:', orientationErr);
          }
        }
        
        // iOS camera permission - must be requested from user gesture
        // We'll show a step indicator before requesting camera
        setCurrentStep('Żądanie dostępu do kamery...');
        
        // Small delay to ensure UI updates before permission dialog
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // After iOS-specific permissions, call the main handler
      setCurrentStep('Inicjalizacja kamery i mikrofonu...');
      await onRequest();
    } catch (err) {
      console.error('Permission request error:', err);
      setIsRequesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 mb-6 rounded-full bg-red-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      
      <h1 className="text-2xl font-bold mb-2">Zgłoś Drona</h1>
      <p className="text-gray-400 mb-6 max-w-xs">
        System wymaga dostępu do kamery, mikrofonu, lokalizacji i czujników ruchu.
      </p>

      {/* HTTPS Warning */}
      {!localSecureContext && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 mb-4 max-w-xs">
          <p className="text-red-300 text-sm font-bold mb-1">⚠️ Wymagane HTTPS</p>
          <p className="text-red-400 text-xs">
            Geolokalizacja i sensory wymagają bezpiecznego połączenia. 
            Otwórz stronę przez <code className="bg-red-900 px-1 rounded">https://</code> lub <code className="bg-red-900 px-1 rounded">localhost</code>.
          </p>
        </div>
      )}

      {/* Geo Error */}
      {geoError && (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 mb-4 max-w-xs">
          <p className="text-orange-400 text-sm">
            📍 {geoError}
          </p>
        </div>
      )}

      {isIOS && localSecureContext && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 mb-4 max-w-xs">
          <p className="text-yellow-400 text-sm font-medium mb-2">
            📱 Ważne dla iPhone/iPad:
          </p>
          <ul className="text-yellow-400/80 text-xs space-y-1 list-disc list-inside">
            <li>Pojawią się okna z prośbą o dostęp</li>
            <li>Zezwól na <strong>kamerę</strong>, <strong>mikrofon</strong> i <strong>lokalizację</strong></li>
            <li>Jeśli kamera nie działa, przejdź do <strong>Ustawienia → Safari → Kamera</strong> i ustaw na "Pytaj" lub "Zezwól"</li>
          </ul>
        </div>
      )}

      {isRequesting ? (
        <div className="w-full max-w-xs">
          <div className="py-4 px-6 bg-zinc-800 rounded-xl">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-300">{currentStep || 'Proszę czekać...'}</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleRequest}
          disabled={!localSecureContext}
          className={`w-full max-w-xs py-4 px-6 rounded-xl font-bold text-lg transition-colors ${
            localSecureContext 
              ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' 
              : 'bg-zinc-700 cursor-not-allowed opacity-50'
          }`}
        >
          {localSecureContext ? 'Zezwól i Kontynuuj' : 'HTTPS Wymagane'}
        </button>
      )}

      <p className="text-xs text-gray-500 mt-4 max-w-xs">
        Wszystkie dane są szyfrowane i przesyłane bezpośrednio do służb ochrony infrastruktury.
      </p>

      {/* Permission requirements list */}
      <div className="mt-8 text-left max-w-xs w-full">
        <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Wymagane uprawnienia:</p>
        <ul className="space-y-1 text-sm text-gray-500">
          <li className="flex items-center gap-2">
            <span>📸</span> Kamera (tylna)
          </li>
          <li className="flex items-center gap-2">
            <span>🎤</span> Mikrofon
          </li>
          <li className="flex items-center gap-2">
            <span>📍</span> Lokalizacja GPS
          </li>
          <li className="flex items-center gap-2">
            <span>🔄</span> Czujniki ruchu i orientacji
          </li>
        </ul>
      </div>
    </div>
  );
}

function ReadyStage({
  videoRef,
  compass,
  motion,
  location,
  groundTruth,
  onCapture,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  compass: number | undefined;
  motion: any;
  location: any;
  groundTruth: GroundTruth | null;
  onCapture: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Video preview */}
      <div className="relative flex-1 bg-zinc-900">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Crosshair overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-red-500/50 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
          </div>
        </div>

        {/* Compass indicator */}
        {compass !== undefined && (
          <div className="absolute top-4 right-4 bg-black/70 rounded-lg px-3 py-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" style={{ transform: `rotate(${compass}deg)` }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" />
            </svg>
            <span className="text-sm font-mono">{Math.round(compass)}°</span>
          </div>
        )}

        {/* Location indicator */}
        <div className="absolute top-4 left-4 bg-black/70 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            {groundTruth ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-400">QR Verified</span>
              </>
            ) : location ? (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-xs text-yellow-400">GPS: ±{Math.round(location.accuracy)}m</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400">Szukam GPS...</span>
              </>
            )}
          </div>
        </div>

        {/* Motion indicator */}
        <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${motion ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-xs">Czujniki aktywne</span>
          </div>
        </div>
      </div>

      {/* Capture button */}
      <div className="p-4 bg-zinc-900">
        <button
          onClick={onCapture}
          className="w-full py-5 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-xl transition-colors flex items-center justify-center gap-3"
        >
          <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
          Nagrywaj Drona (5s)
        </button>
        <p className="text-center text-xs text-gray-500 mt-2">
          Skieruj telefon w stronę drona i trzymaj stabilnie
        </p>
      </div>
    </div>
  );
}

function CapturingStage({
  videoRef,
  progress,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  progress: number;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Video preview */}
      <div className="relative flex-1 bg-zinc-900">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Recording indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 rounded-full px-4 py-2 flex items-center gap-2 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-white" />
          <span className="font-bold">NAGRYWANIE</span>
        </div>

        {/* Pulse ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-4 border-red-500 rounded-full animate-ping opacity-30" />
          <div className="absolute w-48 h-48 border-2 border-red-500 rounded-full" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="p-4 bg-zinc-900">
        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">
          Zbieranie danych... {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}

function ProcessingStage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-bold mb-2">Przetwarzanie...</h2>
      <p className="text-gray-400 text-center">
        Analizowanie sygnału audio i weryfikacja danych
      </p>
    </div>
  );
}

function CompleteStage({ result }: { result: ReportSubmissionResponse }) {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'RED': return 'bg-red-600 border-red-500';
      case 'YELLOW': return 'bg-yellow-600 border-yellow-500';
      default: return 'bg-green-600 border-green-500';
    }
  };

  const getThreatText = (level: string) => {
    switch (level) {
      case 'RED': return 'KRYTYCZNE - Służby powiadomione';
      case 'YELLOW': return 'OSTRZEŻENIE - Weryfikacja w toku';
      default: return 'OK - Zgłoszenie zarejestrowane';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className={`w-24 h-24 rounded-full ${getThreatColor(result.threatLevel)} border-4 flex items-center justify-center mb-6`}>
        {result.success ? (
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-2">
        {result.success ? 'Zgłoszenie Wysłane' : 'Błąd'}
      </h2>
      
      <div className={`px-4 py-2 rounded-full ${getThreatColor(result.threatLevel)} mb-4`}>
        <span className="font-bold text-sm uppercase">
          {getThreatText(result.threatLevel)}
        </span>
      </div>

      <p className="text-gray-400 mb-2">{result.message}</p>
      <p className="text-xs text-gray-600 font-mono">ID: {result.reportId}</p>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
      >
        Nowe Zgłoszenie
      </button>
    </div>
  );
}

function ErrorStage({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-red-900 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 className="text-xl font-bold mb-2">Błąd</h2>
      <p className="text-gray-400 mb-6">{error || 'Nieznany błąd'}</p>

      <button
        onClick={onRetry}
        className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
      >
        Spróbuj Ponownie
      </button>
    </div>
  );
}

function DebugPanel({ stage, motion, orientation, location, motionSamples }: any) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 text-xs p-2 font-mono text-green-400 max-h-32 overflow-auto">
      <div>Stage: {stage} | Motion samples: {motionSamples}</div>
      {motion && (
        <div>Rotation: α={motion.rotationRate.alpha?.toFixed(2)} β={motion.rotationRate.beta?.toFixed(2)} γ={motion.rotationRate.gamma?.toFixed(2)}</div>
      )}
      {orientation && (
        <div>Orientation: α={orientation.alpha?.toFixed(2)} β={orientation.beta?.toFixed(2)} γ={orientation.gamma?.toFixed(2)}</div>
      )}
      {location && (
        <div>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} (±{location.accuracy.toFixed(0)}m)</div>
      )}
    </div>
  );
}

// ==================== HELPERS ====================

function getDirectionFromCompass(heading: number | undefined): DroneReport['droneDirection'] {
  if (heading === undefined) return undefined;
  
  const directions: DroneReport['droneDirection'][] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}
