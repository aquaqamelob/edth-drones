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

export interface DroneDetectionResult {
  detected: boolean;
  type: string | null;
  confidence: number;
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FFTDetectionResult {
  detected: boolean;
  dominantFrequency: number;
  estimatedType: string | null;
  confidence: number;
}

export interface ScoreBreakdown {
  audio: number;
  location: number;
  ip: number;
  clustering: number;
  validation: number;
}

export interface ReportSubmissionResponse {
  success: boolean;
  reportId: string;
  threatLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  fullThreatLevel?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  riskScore?: number;
  confidence?: number;
  message: string;
  timestamp: string;
  riskFactors?: string[];
  requiredActions?: string[];
  droneDetection?: {
    audio: DroneDetectionResult | null;
    visual: DroneDetectionResult | null;
    fft: FFTDetectionResult | null;
  };
  scoreBreakdown?: ScoreBreakdown;
  riskAssessment?: FullRiskAssessment;
}

export type SensorPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface SensorPermissions {
  camera: SensorPermissionStatus;
  microphone: SensorPermissionStatus;
  geolocation: SensorPermissionStatus;
  motion: SensorPermissionStatus;
  orientation: SensorPermissionStatus;
}

// ==================== FFT / Audio Analysis Types ====================

export interface FFTAnalysisResult {
  frequencies: number[];
  magnitudes: number[];
  dominantFrequency: number;
  dominantMagnitude: number;
  spectralCentroid: number;
  spectralFlatness: number;
}

export interface DroneAudioDetection {
  detected: boolean;
  confidence: number;
  estimatedType: 'small' | 'medium' | 'large' | 'racing' | 'unknown' | null;
  dominantFrequency: number;
  harmonicsDetected: number;
  powerInDroneBand: number;
  totalPower: number;
  signalToNoiseRatio: number;
  reasons: string[];
}

// ==================== IP Risk Types ====================

export interface IPAnalysis {
  ip: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  coordinates: { lat: number; lon: number } | null;
  isHighRiskCountry: boolean;
  isElevatedRiskCountry: boolean;
  isPotentialVPN: boolean;
  isPotentialDatacenter: boolean;
  isPrivateIP: boolean;
  isTor: boolean;
  reasons: string[];
  recommendations: string[];
}

export interface GeoAnomalyCheck {
  deviceLat: number;
  deviceLon: number;
  ipLat: number;
  ipLon: number;
  distanceKm: number;
  isAnomaly: boolean;
  anomalyThresholdKm: number;
}

// ==================== ML Classification Types ====================

export interface MLPrediction {
  className: string;
  confidence: number;
  allProbabilities: { class: string; probability: number }[];
  inferenceTimeMs: number;
}

export interface DroneMLClassification {
  isDrone: boolean;
  droneType: string | null;
  confidence: number;
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  details: MLPrediction | null;
}

// ==================== Combined Risk Assessment Types ====================

export type FullThreatLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface RiskFactor {
  name: string;
  category: 'audio' | 'location' | 'ip' | 'clustering' | 'validation';
  score: number;
  maxScore: number;
  triggered: boolean;
  details: string;
}

export interface FullRiskAssessment {
  threatLevel: FullThreatLevel;
  totalScore: number;
  maxPossibleScore: number;
  confidence: number;
  
  // Category scores
  audioScore: number;
  locationScore: number;
  ipScore: number;
  clusteringScore: number;
  validationScore: number;
  
  // Factor breakdown
  riskFactors: RiskFactor[];
  triggeringFactors: RiskFactor[];
  mitigatingFactors: RiskFactor[];
  
  // Action items
  recommendations: string[];
  requiredActions: string[];
  
  // Metadata
  timestamp: string;
  processingTimeMs: number;
}

// ==================== Enhanced Report Types ====================

export interface EnhancedDroneReport extends DroneReport {
  // Audio analysis
  audioAnalysis?: DroneAudioDetection;
  
  // ML classifications
  audioClassification?: DroneMLClassification;
  imageClassification?: DroneMLClassification;
  
  // IP/network analysis
  ipAnalysis?: IPAnalysis;
  geoAnomaly?: GeoAnomalyCheck;
  
  // Combined risk
  riskAssessment?: FullRiskAssessment;
}

// ==================== Infrastructure Types ====================

export interface CriticalInfrastructure {
  id: string;
  name: string;
  type: 'railway' | 'airport' | 'power_station' | 'government' | 'military' | 'other';
  latitude: number;
  longitude: number;
  radius: number; // meters
  alertThreshold: FullThreatLevel;
}

export interface InfrastructureProximity {
  infrastructure: CriticalInfrastructure;
  distanceMeters: number;
  withinAlertRadius: boolean;
}

// ==================== Clustering Types ====================

export interface ReportCluster {
  centroidLat: number;
  centroidLon: number;
  reportCount: number;
  uniqueDevices: number;
  firstReportTime: number;
  lastReportTime: number;
  averageConfidence: number;
  threatLevel: FullThreatLevel;
}

export interface ClusterAnalysis {
  clusters: ReportCluster[];
  activeClusterCount: number;
  highThreatClusters: ReportCluster[];
}

