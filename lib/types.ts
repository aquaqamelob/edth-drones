// Sensor Data Types for EDTH Drone Defense Network

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GroundTruth {
  latitude: number;
  longitude: number;
  qrCodeId?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DeviceMotionData {
  acceleration: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  accelerationIncludingGravity: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  rotationRate: {
    alpha: number | null; // Z-axis rotation (yaw)
    beta: number | null;  // X-axis rotation (pitch)
    gamma: number | null; // Y-axis rotation (roll)
  };
  interval: number;
  timestamp: number;
}

export interface DeviceOrientationData {
  alpha: number | null; // Compass direction (0-360)
  beta: number | null;  // Front-back tilt (-180 to 180)
  gamma: number | null; // Left-right tilt (-90 to 90)
  absolute: boolean;
  timestamp: number;
}

export interface CompassHeading {
  magneticHeading: number;
  trueHeading: number | null;
  headingAccuracy: number | null;
  timestamp: number;
}

export interface CaptureMetadata {
  deviceId: string;
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  connectionType: string | null;
  connectionEffectiveType: string | null;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  language: string;
  timezone: string;
  timezoneOffset: number;
}

export interface LivenessValidation {
  isValid: boolean;
  motionDetected: boolean;
  averageRotation: number;
  motionSamples: number;
  suspiciousPatterns: string[];
  confidence: number;
}

export interface MediaCapture {
  video: Blob | null;
  videoDataUrl: string | null;
  videoDurationMs: number;
  frames: string[]; // Base64 encoded frames
  audio: Blob | null;
  audioDataUrl: string | null;
  audioDurationMs: number;
  thumbnail: string | null;
}

export interface SensorSnapshot {
  motionHistory: DeviceMotionData[];
  orientationHistory: DeviceOrientationData[];
  locationHistory: GeoLocation[];
}

export interface DroneReport {
  // Identification
  id: string;
  sessionId: string;
  reportedAt: string; // ISO timestamp
  
  // Location Data
  groundTruth: GroundTruth | null;
  deviceLocation: GeoLocation | null;
  
  // Sensor Data
  sensorSnapshot: SensorSnapshot;
  compassHeading: CompassHeading | null;
  
  // Media
  media: MediaCapture;
  
  // Validation
  liveness: LivenessValidation;
  
  // Device Metadata
  deviceMetadata: CaptureMetadata;
  
  // User Input (optional)
  userNotes?: string;
  droneDirection?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'OVERHEAD';
  estimatedAltitude?: 'LOW' | 'MEDIUM' | 'HIGH'; // <30m, 30-100m, >100m
  droneCount?: number;
}

export interface ReportSubmissionResponse {
  success: boolean;
  reportId: string;
  threatLevel: 'GREEN' | 'YELLOW' | 'RED';
  message: string;
  timestamp: string;
}

export type SensorPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface SensorPermissions {
  camera: SensorPermissionStatus;
  microphone: SensorPermissionStatus;
  geolocation: SensorPermissionStatus;
  motion: SensorPermissionStatus;
  orientation: SensorPermissionStatus;
}
