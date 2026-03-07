/**
 * Combined Risk Assessment System
 * 
 * Aggregates multiple risk signals into a unified threat assessment:
 * - Audio FFT analysis (drone signature detection)
 * - IP risk assessment (geolocation, VPN, datacenter detection)
 * - ML model predictions (audio/image classification)
 * - Geographic proximity to critical infrastructure
 * - Report clustering (multiple reports in same area)
 * - Device/user behavior patterns
 */

import type { DroneAudioSignature } from './fft';
import type { IPRiskAssessment, GeoDistanceCheck } from './ip-risk';
import type { DroneClassification } from './ml-model';

// Threat level thresholds
export const THREAT_THRESHOLDS = {
  GREEN: { max: 30 },      // Low risk - likely false positive
  YELLOW: { max: 60 },     // Medium risk - needs monitoring
  ORANGE: { max: 80 },     // High risk - alert dispatchers
  RED: { max: 100 },       // Critical - immediate response
};

// Weight configuration for different risk factors
export const RISK_WEIGHTS = {
  // Audio analysis (max 30 points)
  audio: {
    fftDetection: 15,
    mlClassification: 15,
  },
  
  // Location factors (max 25 points)
  location: {
    nearCriticalInfrastructure: 20,
    groundTruthMatch: 5,
  },
  
  // IP/network factors (max 20 points)
  ip: {
    highRiskCountry: 10,
    vpnDatacenter: 8,
    geoAnomaly: 7,
    rateLimited: 5,
  },
  
  // Clustering factors (max 15 points)
  clustering: {
    multipleReports: 10,
    sameDevice: -5, // Negative - same device spamming
  },
  
  // Validation factors (max 10 points)
  validation: {
    liveness: 5,
    deviceMetadata: 3,
    mediaQuality: 2,
  },
};

export type ThreatLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
export type RiskCategory = 'audio' | 'location' | 'ip' | 'clustering' | 'validation';

export interface RiskFactor {
  name: string;
  category: RiskCategory;
  score: number;
  maxScore: number;
  triggered: boolean;
  details: string;
}

export interface CombinedRiskAssessment {
  // Overall assessment
  threatLevel: ThreatLevel;
  totalScore: number;
  maxPossibleScore: number;
  confidence: number; // 0-100, based on data quality
  
  // Individual scores
  audioScore: number;
  locationScore: number;
  ipScore: number;
  clusteringScore: number;
  validationScore: number;
  
  // Detailed factors
  riskFactors: RiskFactor[];
  triggeringFactors: RiskFactor[];
  mitigatingFactors: RiskFactor[];
  
  // Recommendations
  recommendations: string[];
  requiredActions: string[];
  
  // Metadata
  timestamp: string;
  processingTimeMs: number;
}

export interface RiskAssessmentInput {
  // Audio analysis results
  audioSignature?: DroneAudioSignature | null;
  mlAudioClassification?: DroneClassification | null;
  mlImageClassification?: DroneClassification | null;
  
  // Location data
  deviceLatitude?: number | null;
  deviceLongitude?: number | null;
  groundTruthLatitude?: number | null;
  groundTruthLongitude?: number | null;
  distanceToInfrastructure?: number | null; // meters
  infrastructureName?: string | null;
  
  // IP data
  ipAssessment?: IPRiskAssessment | null;
  geoAnomaly?: GeoDistanceCheck | null;
  isRateLimited?: boolean;
  
  // Clustering data
  nearbyReportCount?: number;
  sameDeviceReportCount?: number;
  timeWindowMinutes?: number;
  
  // Validation data
  livenessConfidence?: number; // 0-100
  hasCompleteMetadata?: boolean;
  mediaQualityScore?: number; // 0-100
}

/**
 * Calculate combined risk assessment from all inputs
 */
export function calculateRiskAssessment(input: RiskAssessmentInput): CombinedRiskAssessment {
  const startTime = performance.now();
  const riskFactors: RiskFactor[] = [];
  
  // Calculate individual category scores
  const audioScore = calculateAudioScore(input, riskFactors);
  const locationScore = calculateLocationScore(input, riskFactors);
  const ipScore = calculateIPScore(input, riskFactors);
  const clusteringScore = calculateClusteringScore(input, riskFactors);
  const validationScore = calculateValidationScore(input, riskFactors);
  
  // Calculate total score
  const totalScore = Math.max(0, Math.min(100,
    audioScore + locationScore + ipScore + clusteringScore + validationScore
  ));
  
  // Determine threat level
  const threatLevel = getThreatLevel(totalScore);
  
  // Calculate confidence based on data completeness
  const confidence = calculateConfidence(input);
  
  // Separate triggering and mitigating factors
  const triggeringFactors = riskFactors.filter(f => f.triggered && f.score > 0);
  const mitigatingFactors = riskFactors.filter(f => f.score < 0);
  
  // Generate recommendations
  const { recommendations, requiredActions } = generateRecommendations(
    threatLevel,
    triggeringFactors,
    input
  );
  
  const processingTimeMs = performance.now() - startTime;
  
  return {
    threatLevel,
    totalScore,
    maxPossibleScore: 100,
    confidence,
    audioScore,
    locationScore,
    ipScore,
    clusteringScore,
    validationScore,
    riskFactors,
    triggeringFactors,
    mitigatingFactors,
    recommendations,
    requiredActions,
    timestamp: new Date().toISOString(),
    processingTimeMs,
  };
}

/**
 * Calculate audio-based risk score
 */
function calculateAudioScore(input: RiskAssessmentInput, factors: RiskFactor[]): number {
  let score = 0;
  
  // FFT-based detection
  if (input.audioSignature) {
    const fftScore = input.audioSignature.detected
      ? Math.round((input.audioSignature.confidence / 100) * RISK_WEIGHTS.audio.fftDetection)
      : 0;
    
    factors.push({
      name: 'FFT Drone Signature',
      category: 'audio',
      score: fftScore,
      maxScore: RISK_WEIGHTS.audio.fftDetection,
      triggered: input.audioSignature.detected,
      details: input.audioSignature.detected
        ? `Detected ${input.audioSignature.estimatedType || 'unknown'} drone at ${input.audioSignature.confidence}% confidence`
        : 'No drone audio signature detected',
    });
    
    score += fftScore;
  }
  
  // ML audio classification
  if (input.mlAudioClassification) {
    const mlScore = input.mlAudioClassification.isDrone
      ? Math.round(input.mlAudioClassification.confidence * RISK_WEIGHTS.audio.mlClassification)
      : 0;
    
    factors.push({
      name: 'ML Audio Classification',
      category: 'audio',
      score: mlScore,
      maxScore: RISK_WEIGHTS.audio.mlClassification,
      triggered: input.mlAudioClassification.isDrone,
      details: input.mlAudioClassification.isDrone
        ? `ML classified as ${input.mlAudioClassification.droneType} (${Math.round(input.mlAudioClassification.confidence * 100)}%)`
        : 'ML did not detect drone audio',
    });
    
    score += mlScore;
  }
  
  // ML image classification (bonus points)
  if (input.mlImageClassification?.isDrone) {
    const imageScore = Math.round(input.mlImageClassification.confidence * 10);
    
    factors.push({
      name: 'ML Image Classification',
      category: 'audio', // Grouped with audio for simplicity
      score: imageScore,
      maxScore: 10,
      triggered: true,
      details: `Visual drone detected: ${input.mlImageClassification.droneType} (${Math.round(input.mlImageClassification.confidence * 100)}%)`,
    });
    
    score += imageScore;
  }
  
  return score;
}

/**
 * Calculate location-based risk score
 */
function calculateLocationScore(input: RiskAssessmentInput, factors: RiskFactor[]): number {
  let score = 0;
  
  // Proximity to critical infrastructure
  if (input.distanceToInfrastructure !== null && input.distanceToInfrastructure !== undefined) {
    let infraScore = 0;
    const distance = input.distanceToInfrastructure;
    
    if (distance < 50) {
      infraScore = RISK_WEIGHTS.location.nearCriticalInfrastructure; // Full points
    } else if (distance < 100) {
      infraScore = Math.round(RISK_WEIGHTS.location.nearCriticalInfrastructure * 0.8);
    } else if (distance < 200) {
      infraScore = Math.round(RISK_WEIGHTS.location.nearCriticalInfrastructure * 0.5);
    } else if (distance < 500) {
      infraScore = Math.round(RISK_WEIGHTS.location.nearCriticalInfrastructure * 0.25);
    }
    
    factors.push({
      name: 'Infrastructure Proximity',
      category: 'location',
      score: infraScore,
      maxScore: RISK_WEIGHTS.location.nearCriticalInfrastructure,
      triggered: infraScore > 0,
      details: `${Math.round(distance)}m from ${input.infrastructureName || 'critical infrastructure'}`,
    });
    
    score += infraScore;
  }
  
  // Ground truth verification
  if (
    input.groundTruthLatitude !== null && input.groundTruthLatitude !== undefined &&
    input.deviceLatitude !== null && input.deviceLatitude !== undefined
  ) {
    const gtDistance = haversineDistance(
      input.deviceLatitude,
      input.deviceLongitude!,
      input.groundTruthLatitude,
      input.groundTruthLongitude!
    );
    
    // Ground truth match (from QR code) within 100m
    const gtMatch = gtDistance < 100;
    const gtScore = gtMatch ? RISK_WEIGHTS.location.groundTruthMatch : 0;
    
    factors.push({
      name: 'Ground Truth Match',
      category: 'location',
      score: gtScore,
      maxScore: RISK_WEIGHTS.location.groundTruthMatch,
      triggered: gtMatch,
      details: gtMatch
        ? `Device within ${Math.round(gtDistance)}m of QR code location`
        : `Device ${Math.round(gtDistance)}m from expected location`,
    });
    
    score += gtScore;
  }
  
  return score;
}

/**
 * Calculate IP-based risk score
 */
function calculateIPScore(input: RiskAssessmentInput, factors: RiskFactor[]): number {
  let score = 0;
  
  if (input.ipAssessment) {
    const ip = input.ipAssessment;
    
    // High-risk country
    if (ip.isHighRiskCountry) {
      factors.push({
        name: 'High-Risk Country',
        category: 'ip',
        score: RISK_WEIGHTS.ip.highRiskCountry,
        maxScore: RISK_WEIGHTS.ip.highRiskCountry,
        triggered: true,
        details: `Request from ${ip.countryName} (${ip.country})`,
      });
      score += RISK_WEIGHTS.ip.highRiskCountry;
    } else if (ip.isElevatedRiskCountry) {
      const elevatedScore = Math.round(RISK_WEIGHTS.ip.highRiskCountry * 0.5);
      factors.push({
        name: 'Elevated-Risk Country',
        category: 'ip',
        score: elevatedScore,
        maxScore: RISK_WEIGHTS.ip.highRiskCountry,
        triggered: true,
        details: `Request from ${ip.countryName} (${ip.country})`,
      });
      score += elevatedScore;
    }
    
    // VPN/Datacenter
    if (ip.isPotentialDatacenter || ip.isPotentialVPN) {
      factors.push({
        name: 'VPN/Datacenter IP',
        category: 'ip',
        score: RISK_WEIGHTS.ip.vpnDatacenter,
        maxScore: RISK_WEIGHTS.ip.vpnDatacenter,
        triggered: true,
        details: 'IP appears to originate from datacenter/VPN',
      });
      score += RISK_WEIGHTS.ip.vpnDatacenter;
    }
    
    // Tor
    if (ip.isTor) {
      factors.push({
        name: 'Tor Exit Node',
        category: 'ip',
        score: RISK_WEIGHTS.ip.vpnDatacenter,
        maxScore: RISK_WEIGHTS.ip.vpnDatacenter,
        triggered: true,
        details: 'Request from Tor network',
      });
      score += RISK_WEIGHTS.ip.vpnDatacenter;
    }
  }
  
  // Geo anomaly (IP location far from device location)
  if (input.geoAnomaly?.isAnomaly) {
    factors.push({
      name: 'Geographic Anomaly',
      category: 'ip',
      score: RISK_WEIGHTS.ip.geoAnomaly,
      maxScore: RISK_WEIGHTS.ip.geoAnomaly,
      triggered: true,
      details: `IP location ${Math.round(input.geoAnomaly.distanceKm)}km from device GPS`,
    });
    score += RISK_WEIGHTS.ip.geoAnomaly;
  }
  
  // Rate limiting
  if (input.isRateLimited) {
    factors.push({
      name: 'Rate Limited',
      category: 'ip',
      score: RISK_WEIGHTS.ip.rateLimited,
      maxScore: RISK_WEIGHTS.ip.rateLimited,
      triggered: true,
      details: 'IP has exceeded request rate limit',
    });
    score += RISK_WEIGHTS.ip.rateLimited;
  }
  
  return score;
}

/**
 * Calculate clustering risk score
 */
function calculateClusteringScore(input: RiskAssessmentInput, factors: RiskFactor[]): number {
  let score = 0;
  
  // Multiple reports in area
  if (input.nearbyReportCount && input.nearbyReportCount >= 2) {
    const clusterScore = Math.min(
      RISK_WEIGHTS.clustering.multipleReports,
      input.nearbyReportCount * 3
    );
    
    factors.push({
      name: 'Report Cluster',
      category: 'clustering',
      score: clusterScore,
      maxScore: RISK_WEIGHTS.clustering.multipleReports,
      triggered: true,
      details: `${input.nearbyReportCount} reports in area within ${input.timeWindowMinutes || 5} minutes`,
    });
    
    score += clusterScore;
  }
  
  // Same device spamming (negative factor)
  if (input.sameDeviceReportCount && input.sameDeviceReportCount >= 3) {
    factors.push({
      name: 'Same Device Spam',
      category: 'clustering',
      score: RISK_WEIGHTS.clustering.sameDevice,
      maxScore: 0,
      triggered: true,
      details: `${input.sameDeviceReportCount} reports from same device - possible spam`,
    });
    
    score += RISK_WEIGHTS.clustering.sameDevice;
  }
  
  return score;
}

/**
 * Calculate validation risk score
 */
function calculateValidationScore(input: RiskAssessmentInput, factors: RiskFactor[]): number {
  let score = 0;
  
  // Liveness validation
  if (input.livenessConfidence !== undefined) {
    const livenessScore = input.livenessConfidence >= 70
      ? RISK_WEIGHTS.validation.liveness
      : Math.round((input.livenessConfidence / 100) * RISK_WEIGHTS.validation.liveness);
    
    factors.push({
      name: 'Liveness Validation',
      category: 'validation',
      score: livenessScore,
      maxScore: RISK_WEIGHTS.validation.liveness,
      triggered: input.livenessConfidence >= 50,
      details: `Liveness confidence: ${Math.round(input.livenessConfidence)}%`,
    });
    
    score += livenessScore;
  }
  
  // Metadata completeness
  if (input.hasCompleteMetadata) {
    factors.push({
      name: 'Complete Metadata',
      category: 'validation',
      score: RISK_WEIGHTS.validation.deviceMetadata,
      maxScore: RISK_WEIGHTS.validation.deviceMetadata,
      triggered: true,
      details: 'All device metadata fields present',
    });
    score += RISK_WEIGHTS.validation.deviceMetadata;
  }
  
  // Media quality
  if (input.mediaQualityScore !== undefined) {
    const qualityScore = Math.round(
      (input.mediaQualityScore / 100) * RISK_WEIGHTS.validation.mediaQuality
    );
    
    factors.push({
      name: 'Media Quality',
      category: 'validation',
      score: qualityScore,
      maxScore: RISK_WEIGHTS.validation.mediaQuality,
      triggered: input.mediaQualityScore >= 50,
      details: `Media quality score: ${Math.round(input.mediaQualityScore)}%`,
    });
    
    score += qualityScore;
  }
  
  return score;
}

/**
 * Determine threat level from total score
 */
function getThreatLevel(score: number): ThreatLevel {
  if (score >= THREAT_THRESHOLDS.ORANGE.max) return 'RED';
  if (score >= THREAT_THRESHOLDS.YELLOW.max) return 'ORANGE';
  if (score >= THREAT_THRESHOLDS.GREEN.max) return 'YELLOW';
  return 'GREEN';
}

/**
 * Calculate confidence based on input completeness
 */
function calculateConfidence(input: RiskAssessmentInput): number {
  let dataPoints = 0;
  let availablePoints = 0;
  
  // Check what data is available
  if (input.audioSignature !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  if (input.mlAudioClassification !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  if (input.deviceLatitude !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  if (input.ipAssessment !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  if (input.livenessConfidence !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  if (input.groundTruthLatitude !== undefined) { dataPoints++; availablePoints++; }
  else availablePoints++;
  
  return Math.round((dataPoints / availablePoints) * 100);
}

/**
 * Generate recommendations based on assessment
 */
function generateRecommendations(
  level: ThreatLevel,
  triggeringFactors: RiskFactor[],
  input: RiskAssessmentInput
): { recommendations: string[]; requiredActions: string[] } {
  const recommendations: string[] = [];
  const requiredActions: string[] = [];
  
  switch (level) {
    case 'RED':
      requiredActions.push('IMMEDIATE: Alert infrastructure security team');
      requiredActions.push('IMMEDIATE: Deploy countermeasures if available');
      requiredActions.push('VERIFY: Cross-reference with radar/visual confirmation');
      recommendations.push('Document all sensor data for incident report');
      recommendations.push('Check for additional reports in 1km radius');
      break;
      
    case 'ORANGE':
      requiredActions.push('ALERT: Notify on-call security personnel');
      requiredActions.push('MONITOR: Increase surveillance in reported area');
      recommendations.push('Request visual confirmation from ground units');
      recommendations.push('Check historical reports for pattern analysis');
      break;
      
    case 'YELLOW':
      recommendations.push('Continue monitoring for additional reports');
      recommendations.push('Log for pattern analysis');
      recommendations.push('Consider ground patrol if multiple YELLOW reports cluster');
      break;
      
    case 'GREEN':
      recommendations.push('Standard logging - no immediate action required');
      recommendations.push('Review if accompanied by other reports');
      break;
  }
  
  // Add factor-specific recommendations
  if (triggeringFactors.some(f => f.name === 'VPN/Datacenter IP')) {
    recommendations.push('Verify reporter identity - request additional authentication');
  }
  
  if (triggeringFactors.some(f => f.name === 'Geographic Anomaly')) {
    recommendations.push('Possible GPS spoofing or VPN use - verify location independently');
  }
  
  if (input.sameDeviceReportCount && input.sameDeviceReportCount >= 3) {
    recommendations.push('Device may be spamming - consider temporary block');
  }
  
  return { recommendations, requiredActions };
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Quick threat assessment for real-time use
 */
export function quickAssessment(
  audioDetected: boolean,
  distanceToInfrastructure: number | null,
  nearbyReports: number
): ThreatLevel {
  let score = 0;
  
  if (audioDetected) score += 25;
  if (distanceToInfrastructure !== null && distanceToInfrastructure < 100) score += 30;
  if (nearbyReports >= 2) score += 15;
  if (nearbyReports >= 3) score += 15;
  
  return getThreatLevel(score);
}

/**
 * Export risk report as JSON
 */
export function exportRiskReport(assessment: CombinedRiskAssessment): string {
  return JSON.stringify({
    summary: {
      threatLevel: assessment.threatLevel,
      score: assessment.totalScore,
      confidence: assessment.confidence,
      timestamp: assessment.timestamp,
    },
    scores: {
      audio: assessment.audioScore,
      location: assessment.locationScore,
      ip: assessment.ipScore,
      clustering: assessment.clusteringScore,
      validation: assessment.validationScore,
    },
    factors: assessment.triggeringFactors.map(f => ({
      name: f.name,
      score: f.score,
      details: f.details,
    })),
    actions: assessment.requiredActions,
    recommendations: assessment.recommendations,
  }, null, 2);
}
