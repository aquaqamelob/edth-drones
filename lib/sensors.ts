'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DeviceMotionData,
  DeviceOrientationData,
  GeoLocation,
  CompassHeading,
  CaptureMetadata,
  LivenessValidation,
  SensorPermissions,
  SensorPermissionStatus,
} from './types';

// Generate unique device ID (persisted in localStorage)
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let deviceId = localStorage.getItem('edth_device_id');
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('edth_device_id', deviceId);
  }
  return deviceId;
}

// Generate session ID for this capture session
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== DEVICE MOTION HOOK ====================
export function useDeviceMotion(enabled: boolean = true) {
  const [motion, setMotion] = useState<DeviceMotionData | null>(null);
  const [history, setHistory] = useState<DeviceMotionData[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<SensorPermissionStatus>('prompt');
  const [isListening, setIsListening] = useState(false);

  // Check if iOS permission API exists
  const needsPermission = typeof window !== 'undefined' && 
    typeof (DeviceMotionEvent as any).requestPermission === 'function';

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // iOS 13+ requires explicit permission request from user gesture
    if (needsPermission) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        const granted = permission === 'granted';
        setPermissionStatus(granted ? 'granted' : 'denied');
        if (granted) setIsListening(true);
        return granted;
      } catch (err) {
        console.error('[DeviceMotion] Permission error:', err);
        setPermissionStatus('denied');
        return false;
      }
    }
    // Android and older iOS don't need explicit permission
    setPermissionStatus('granted');
    setIsListening(true);
    return true;
  }, [needsPermission]);

  useEffect(() => {
    if (!enabled || !isListening) return;
    if (typeof window === 'undefined') return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const data: DeviceMotionData = {
        acceleration: {
          x: event.acceleration?.x ?? null,
          y: event.acceleration?.y ?? null,
          z: event.acceleration?.z ?? null,
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x ?? null,
          y: event.accelerationIncludingGravity?.y ?? null,
          z: event.accelerationIncludingGravity?.z ?? null,
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha ?? null,
          beta: event.rotationRate?.beta ?? null,
          gamma: event.rotationRate?.gamma ?? null,
        },
        interval: event.interval,
        timestamp: Date.now(),
      };

      setMotion(data);
      setHistory((prev) => [...prev.slice(-100), data]); // Keep last 100 samples
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled, isListening]);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { motion, history, permissionStatus, requestPermission, clearHistory, needsPermission };
}

// ==================== DEVICE ORIENTATION HOOK ====================
export function useDeviceOrientation(enabled: boolean = true) {
  const [orientation, setOrientation] = useState<DeviceOrientationData | null>(null);
  const [history, setHistory] = useState<DeviceOrientationData[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<SensorPermissionStatus>('prompt');
  const [isListening, setIsListening] = useState(false);

  // Check if iOS permission API exists
  const needsPermission = typeof window !== 'undefined' && 
    typeof (DeviceOrientationEvent as any).requestPermission === 'function';

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (needsPermission) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        const granted = permission === 'granted';
        setPermissionStatus(granted ? 'granted' : 'denied');
        if (granted) setIsListening(true);
        return granted;
      } catch (err) {
        console.error('[DeviceOrientation] Permission error:', err);
        setPermissionStatus('denied');
        return false;
      }
    }
    setPermissionStatus('granted');
    setIsListening(true);
    return true;
  }, [needsPermission]);

  useEffect(() => {
    if (!enabled || !isListening) return;
    if (typeof window === 'undefined') return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const data: DeviceOrientationData = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        timestamp: Date.now(),
      };

      setOrientation(data);
      setHistory((prev) => [...prev.slice(-100), data]);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [enabled, isListening]);

  const clearHistory = useCallback(() => setHistory([]), []);
  
  // Get compass heading
  const getCompassHeading = useCallback((): CompassHeading | null => {
    if (!orientation) return null;
    return {
      magneticHeading: orientation.alpha ?? 0,
      trueHeading: orientation.absolute ? orientation.alpha : null,
      headingAccuracy: null,
      timestamp: orientation.timestamp,
    };
  }, [orientation]);

  return { orientation, history, permissionStatus, requestPermission, getCompassHeading, clearHistory, needsPermission };
}

// ==================== GEOLOCATION HOOK ====================
export function useGeolocation(enabled: boolean = true) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [history, setHistory] = useState<GeoLocation[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<SensorPermissionStatus>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Check if we're in a secure context (HTTPS or localhost)
  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const data: GeoLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };

    setLocation(data);
    setHistory((prev) => [...prev.slice(-50), data]);
    setPermissionStatus('granted');
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.error('[Geolocation] Error code:', err.code, 'Message:', err.message);
    
    // Provide more helpful error messages
    let errorMessage = err.message;
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = 'Location access denied. Check your browser and system settings.';
        setPermissionStatus('denied');
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = 'Location unavailable. Make sure GPS is enabled.';
        break;
      case 3: // TIMEOUT
        errorMessage = 'Location request timed out. Please try again.';
        break;
    }
    
    setError(errorMessage);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Check for secure context first
    if (typeof window !== 'undefined' && !isSecureContext) {
      const msg = 'Geolocation requires HTTPS connection. Open the page via https:// or use localhost.';
      console.error('[Geolocation]', msg);
      setError(msg);
      setPermissionStatus('denied');
      return false;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermissionStatus('unavailable');
      setError('Geolocation is not supported by this browser.');
      return false;
    }

    // Try using Permissions API first to check status (if available)
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[Geolocation] Permission status:', result.state);
        
        if (result.state === 'denied') {
          setPermissionStatus('denied');
          setError('Location access is blocked. Change settings in your browser or system.');
          return false;
        }
      } catch (e) {
        // Permissions API not fully supported, continue with normal flow
        console.log('[Geolocation] Permissions API not available, using fallback');
      }
    }

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position);
          setIsWatching(true);
          resolve(true);
        },
        (err) => {
          handleError(err);
          resolve(false);
        },
        { 
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0 
        }
      );
    });
  }, [isSecureContext, handleSuccess, handleError]);

  // Start watching only after permission is granted
  useEffect(() => {
    if (!enabled || !isWatching) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    };
    
    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess, 
      handleError, 
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, isWatching, handleSuccess, handleError]);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { location, history, permissionStatus, requestPermission, error, clearHistory, isSecureContext };
}

// ==================== DEVICE METADATA HOOK ====================
export function useDeviceMetadata(): CaptureMetadata {
  const [metadata, setMetadata] = useState<CaptureMetadata>({
    deviceId: '',
    userAgent: '',
    platform: '',
    screenWidth: 0,
    screenHeight: 0,
    pixelRatio: 1,
    connectionType: null,
    connectionEffectiveType: null,
    batteryLevel: null,
    batteryCharging: null,
    language: '',
    timezone: '',
    timezoneOffset: 0,
  });

  useEffect(() => {
    const collectMetadata = async () => {
      const nav = navigator as any;
      
      // Battery info (if available)
      let batteryLevel: number | null = null;
      let batteryCharging: boolean | null = null;
      
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          batteryLevel = battery.level;
          batteryCharging = battery.charging;
        } catch {
          // Battery API not available
        }
      }

      // Connection info
      const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

      setMetadata({
        deviceId: getDeviceId(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        connectionType: connection?.type ?? null,
        connectionEffectiveType: connection?.effectiveType ?? null,
        batteryLevel,
        batteryCharging,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
      });
    };

    collectMetadata();
  }, []);

  return metadata;
}

// ==================== LIVENESS VALIDATION HOOK ====================
export function useLivenessValidation(motionHistory: DeviceMotionData[]) {
  const validate = useCallback((): LivenessValidation => {
    if (motionHistory.length < 10) {
      return {
        isValid: false,
        motionDetected: false,
        averageRotation: 0,
        motionSamples: motionHistory.length,
        suspiciousPatterns: ['Insufficient motion data'],
        confidence: 0,
      };
    }

    const suspiciousPatterns: string[] = [];
    
    // Calculate average rotation
    let totalRotation = 0;
    let rotationSamples = 0;
    
    for (const sample of motionHistory) {
      const alpha = Math.abs(sample.rotationRate.alpha ?? 0);
      const beta = Math.abs(sample.rotationRate.beta ?? 0);
      const gamma = Math.abs(sample.rotationRate.gamma ?? 0);
      
      totalRotation += alpha + beta + gamma;
      rotationSamples++;
    }

    const averageRotation = rotationSamples > 0 ? totalRotation / rotationSamples : 0;

    // Check for suspiciously still phone (potential fake/mounted camera)
    // Real human hand jitter should produce > 0.1 deg/s average rotation
    if (averageRotation < 0.1) {
      suspiciousPatterns.push('Phone too stable - possible tripod/mount');
    }

    // Check for perfectly periodic motion (possible shake generator)
    const rotationRates = motionHistory.map(m => 
      (m.rotationRate.alpha ?? 0) + (m.rotationRate.beta ?? 0) + (m.rotationRate.gamma ?? 0)
    );
    
    // Calculate variance - too low variance with high motion = suspicious
    const mean = rotationRates.reduce((a, b) => a + b, 0) / rotationRates.length;
    const variance = rotationRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rotationRates.length;
    
    if (averageRotation > 5 && variance < 1) {
      suspiciousPatterns.push('Suspiciously uniform motion pattern');
    }

    // Check acceleration for natural hand movement
    const accelerations = motionHistory.map(m => 
      Math.sqrt(
        Math.pow(m.acceleration.x ?? 0, 2) +
        Math.pow(m.acceleration.y ?? 0, 2) +
        Math.pow(m.acceleration.z ?? 0, 2)
      )
    );
    const avgAcceleration = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;

    if (avgAcceleration < 0.01 && averageRotation < 0.1) {
      suspiciousPatterns.push('No acceleration or rotation detected');
    }

    // Calculate confidence score
    let confidence = 100;
    confidence -= suspiciousPatterns.length * 25;
    if (averageRotation >= 0.1 && averageRotation <= 10) confidence += 10;
    if (avgAcceleration >= 0.01 && avgAcceleration <= 5) confidence += 10;
    confidence = Math.max(0, Math.min(100, confidence));

    const isValid = suspiciousPatterns.length === 0 || confidence >= 50;
    const motionDetected = averageRotation > 0.05 || avgAcceleration > 0.01;

    return {
      isValid,
      motionDetected,
      averageRotation,
      motionSamples: motionHistory.length,
      suspiciousPatterns,
      confidence,
    };
  }, [motionHistory]);

  return { validate };
}

// ==================== COMBINED PERMISSIONS HOOK ====================
export function useSensorPermissions() {
  const [permissions, setPermissions] = useState<SensorPermissions>({
    camera: 'prompt',
    microphone: 'prompt',
    geolocation: 'prompt',
    motion: 'prompt',
    orientation: 'prompt',
  });

  const checkPermissions = useCallback(async () => {
    const newPermissions: SensorPermissions = { ...permissions };

    // Check camera
    try {
      const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      newPermissions.camera = cameraStatus.state as SensorPermissionStatus;
    } catch {
      newPermissions.camera = 'prompt';
    }

    // Check microphone
    try {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      newPermissions.microphone = micStatus.state as SensorPermissionStatus;
    } catch {
      newPermissions.microphone = 'prompt';
    }

    // Check geolocation
    try {
      const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
      newPermissions.geolocation = geoStatus.state as SensorPermissionStatus;
    } catch {
      newPermissions.geolocation = 'prompt';
    }

    // Motion/Orientation checked via their events (iOS specific)
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      newPermissions.motion = 'prompt';
      newPermissions.orientation = 'prompt';
    } else if (window.DeviceMotionEvent) {
      newPermissions.motion = 'granted';
      newPermissions.orientation = 'granted';
    } else {
      newPermissions.motion = 'unavailable';
      newPermissions.orientation = 'unavailable';
    }

    setPermissions(newPermissions);
    return newPermissions;
  }, [permissions]);

  const requestAllPermissions = useCallback(async () => {
    const results: SensorPermissions = { ...permissions };

    // Request camera & microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      results.camera = 'granted';
      results.microphone = 'granted';
    } catch {
      results.camera = 'denied';
      results.microphone = 'denied';
    }

    // Request geolocation
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(() => resolve(), reject);
      });
      results.geolocation = 'granted';
    } catch {
      results.geolocation = 'denied';
    }

    // Request motion (iOS)
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        results.motion = permission === 'granted' ? 'granted' : 'denied';
      } catch {
        results.motion = 'denied';
      }
    }

    // Request orientation (iOS)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        results.orientation = permission === 'granted' ? 'granted' : 'denied';
      } catch {
        results.orientation = 'denied';
      }
    }

    setPermissions(results);
    return results;
  }, [permissions]);

  return { permissions, checkPermissions, requestAllPermissions };
}
