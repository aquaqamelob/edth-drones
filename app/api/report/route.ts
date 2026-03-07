import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { analyzeIP, checkGeoAnomaly, checkRateLimit, cleanupRateLimits } from '@/lib/ip-risk';
import { calculateRiskAssessment, type RiskAssessmentInput, type ThreatLevel, type CombinedRiskAssessment } from '@/lib/risk-assessment';
import { performFFT, detectDroneSignature, type DroneAudioSignature } from '@/lib/fft';
import { simulateAudioClassification, simulateImageClassification, type DroneClassification } from '@/lib/ml-model';
import type { IPAnalysis, GeoAnomalyCheck } from '@/lib/types';

// Railway line coordinates for proximity check (example: Warsaw area)
const RAILWAY_CORRIDORS = [
  // Warsaw Zachodnia approach - example coordinates
  { lat: 52.2204, lng: 20.9661, name: 'Warsaw Zachodnia' },
  { lat: 52.2285, lng: 20.9756, name: 'Warsaw Ochota' },
  { lat: 52.2319, lng: 21.0067, name: 'Warsaw Centralna' },
  { lat: 52.2296, lng: 21.0458, name: 'Warsaw Wschodnia' },
  // Add more critical points as needed
];

const CRITICAL_DISTANCE_METERS = 50;
const CLUSTER_RADIUS_METERS = 500;
const CLUSTER_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store for clustering (replace with Redis/DB in production)
const recentReports: Map<string, {
  lat: number;
  lng: number;
  timestamp: number;
  deviceId: string;
  hasAudioSignature: boolean;
}> = new Map();

interface ThreatAssessment {
  level: 'GREEN' | 'YELLOW' | 'RED';
  nearestRailway: string | null;
  distanceToRailway: number | null;
  clusterCount: number;
  audioConfirmed: boolean;
  reasons: string[];
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const formData = await request.formData();
    const dataJson = formData.get('data') as string;
    const videoFile = formData.get('video') as File | null;
    const audioFile = formData.get('audio') as File | null;

    if (!dataJson) {
      return NextResponse.json(
        { success: false, error: 'Missing report data' },
        { status: 400 }
      );
    }

    const reportData = JSON.parse(dataJson);
    const reportId = reportData.id || `rpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // ==================== IP ANALYSIS ====================
    // Get client IP
    const clientIP = getClientIP(request);
    const ipAssessment: IPAnalysis = analyzeIP(clientIP);
    
    // Check rate limiting
    const rateLimit = checkRateLimit(clientIP);
    if (rateLimit.isRateLimited) {
      console.log(`[REPORT] Rate limited: ${clientIP}`);
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait.' },
        { status: 429 }
      );
    }
    
    // Cleanup old rate limit entries periodically
    if (Math.random() < 0.1) {
      cleanupRateLimits();
    }

    // ==================== LOCATION ANALYSIS ====================
    const location = reportData.groundTruth || reportData.deviceLocation;
    const lat = location?.latitude;
    const lng = location?.longitude;
    
    // Check geo anomaly (IP location vs device GPS)
    let geoAnomaly: GeoAnomalyCheck | null = null;
    if (lat && lng && ipAssessment.coordinates) {
      const anomalyCheck = checkGeoAnomaly(lat, lng, ipAssessment);
      if (anomalyCheck) {
        geoAnomaly = anomalyCheck;
      }
    }

    // Find nearest infrastructure
    let nearestInfra: { name: string; distance: number } | null = null;
    if (lat && lng) {
      for (const rail of RAILWAY_CORRIDORS) {
        const distance = haversineDistance(lat, lng, rail.lat, rail.lng);
        if (!nearestInfra || distance < nearestInfra.distance) {
          nearestInfra = { name: rail.name, distance };
        }
      }
    }

    // ==================== CLUSTERING ANALYSIS ====================
    const clusterCount = countNearbyReports(lat, lng, reportData.deviceMetadata?.deviceId);
    const sameDeviceCount = countSameDeviceReports(reportData.deviceMetadata?.deviceId);

    // Store report for clustering
    if (lat && lng) {
      recentReports.set(reportId, {
        lat,
        lng,
        timestamp: Date.now(),
        deviceId: reportData.deviceMetadata?.deviceId || 'unknown',
        hasAudioSignature: false, // Will be updated after audio analysis
      });
      cleanOldReports();
    }

    // ==================== AUDIO/ML ANALYSIS ====================
    // Analyze audio from the client-side FFT data if available
    let audioSignature: DroneAudioSignature | null = null;
    let mlAudioClassification: DroneClassification | null = null;
    let mlImageClassification: DroneClassification | null = null;
    
    // Check if client sent FFT analysis data
    if (reportData.audioAnalysis) {
      // Use client-side analysis
      audioSignature = reportData.audioAnalysis;
    } else if (reportData.droneSignature) {
      // Alternative field name
      audioSignature = reportData.droneSignature;
    }
    
    // Run simulated ML classification based on FFT results
    if (audioSignature) {
      mlAudioClassification = simulateAudioClassification(audioSignature);
      
      // Update report store with audio signature
      if (lat && lng) {
        const existing = recentReports.get(reportId);
        if (existing) {
          existing.hasAudioSignature = audioSignature.detected;
          recentReports.set(reportId, existing);
        }
      }
    }
    
    // Simulate image classification based on liveness/motion data
    const hasMotion = reportData.liveness?.motionDetected || false;
    const motionIntensity = reportData.liveness?.averageRotation 
      ? Math.min(1, reportData.liveness.averageRotation / 10) 
      : 0;
    mlImageClassification = simulateImageClassification(hasMotion, motionIntensity);

    // ==================== COMBINED RISK ASSESSMENT ====================
    const riskInput: RiskAssessmentInput = {
      // Audio analysis
      audioSignature,
      mlAudioClassification,
      mlImageClassification,
      
      // Location
      deviceLatitude: lat,
      deviceLongitude: lng,
      groundTruthLatitude: reportData.groundTruth?.latitude,
      groundTruthLongitude: reportData.groundTruth?.longitude,
      distanceToInfrastructure: nearestInfra?.distance ?? null,
      infrastructureName: nearestInfra?.name ?? null,
      
      // IP
      ipAssessment,
      geoAnomaly,
      isRateLimited: rateLimit.isRateLimited,
      
      // Clustering
      nearbyReportCount: clusterCount,
      sameDeviceReportCount: sameDeviceCount,
      timeWindowMinutes: CLUSTER_TIME_WINDOW_MS / 60000,
      
      // Validation
      livenessConfidence: reportData.liveness?.confidence || 0,
      hasCompleteMetadata: !!reportData.deviceMetadata?.deviceId,
      mediaQualityScore: videoFile ? 70 : 30, // Simplified quality check
    };
    
    const riskAssessment: CombinedRiskAssessment = calculateRiskAssessment(riskInput);

    // ==================== STORE FILES ====================
    const storagePath = join(process.cwd(), 'data', 'reports', reportId);
    await mkdir(storagePath, { recursive: true });

    if (videoFile) {
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      await writeFile(join(storagePath, 'video.webm'), videoBuffer);
    }

    if (audioFile) {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      await writeFile(join(storagePath, 'audio.webm'), audioBuffer);
    }

    // ==================== STORE REPORT ====================
    const fullReport = {
      ...reportData,
      audioSignature,
      mlAudioClassification,
      mlImageClassification,
      riskAssessment,
      ipAnalysis: {
        ip: ipAssessment.ip,
        country: ipAssessment.country,
        riskLevel: ipAssessment.riskLevel,
        riskScore: ipAssessment.riskScore,
      },
      geoAnomaly: geoAnomaly ? {
        distanceKm: geoAnomaly.distanceKm,
        isAnomaly: geoAnomaly.isAnomaly,
      } : null,
      nearestInfrastructure: nearestInfra,
      clusterCount,
      timestamp,
      processingTimeMs: performance.now() - startTime,
      videoPath: videoFile ? `${reportId}/video.webm` : null,
      audioPath: audioFile ? `${reportId}/audio.webm` : null,
    };

    await writeFile(
      join(storagePath, 'report.json'),
      JSON.stringify(fullReport, null, 2)
    );

    // ==================== ALERTS ====================
    // If RED or ORANGE alert, trigger immediate notification
    if (riskAssessment.threatLevel === 'RED') {
      await triggerCriticalAlert(fullReport, riskAssessment);
    } else if (riskAssessment.threatLevel === 'ORANGE') {
      await triggerHighAlert(fullReport, riskAssessment);
    }

    // Log for audit
    const logDetails = [
      `Level: ${riskAssessment.threatLevel}`,
      `Score: ${riskAssessment.totalScore}`,
      `Confidence: ${riskAssessment.confidence}%`,
      `Location: ${lat?.toFixed(6)}, ${lng?.toFixed(6)}`,
      `IP: ${ipAssessment.country || 'unknown'}`,
      nearestInfra ? `Infra: ${nearestInfra.name} @ ${Math.round(nearestInfra.distance)}m` : null,
      clusterCount > 0 ? `Cluster: ${clusterCount}` : null,
    ].filter(Boolean).join(' | ');
    
    console.log(`[REPORT] ${reportId} | ${logDetails}`);

    // Map 4-level threat to 3-level for API response (for backwards compatibility)
    const apiThreatLevel = riskAssessment.threatLevel === 'ORANGE' ? 'YELLOW' : riskAssessment.threatLevel;

    return NextResponse.json({
      success: true,
      reportId,
      threatLevel: apiThreatLevel,
      fullThreatLevel: riskAssessment.threatLevel,
      riskScore: riskAssessment.totalScore,
      confidence: riskAssessment.confidence,
      message: getResponseMessage(riskAssessment.threatLevel),
      timestamp,
      riskFactors: riskAssessment.triggeringFactors.map(f => f.details),
      requiredActions: riskAssessment.requiredActions,
      // ML Classification results
      droneDetection: {
        audio: mlAudioClassification ? {
          detected: mlAudioClassification.isDrone,
          type: mlAudioClassification.droneType,
          confidence: Math.round((mlAudioClassification.confidence || 0) * 100),
          threatLevel: mlAudioClassification.threatLevel,
        } : null,
        visual: mlImageClassification ? {
          detected: mlImageClassification.isDrone,
          type: mlImageClassification.droneType,
          confidence: Math.round((mlImageClassification.confidence || 0) * 100),
          threatLevel: mlImageClassification.threatLevel,
        } : null,
        fft: audioSignature ? {
          detected: audioSignature.detected,
          dominantFrequency: Math.round(audioSignature.dominantFrequency),
          estimatedType: audioSignature.estimatedType,
          confidence: audioSignature.confidence,
        } : null,
      },
      // Score breakdown
      scoreBreakdown: {
        audio: riskAssessment.audioScore,
        location: riskAssessment.locationScore,
        ip: riskAssessment.ipScore,
        clustering: riskAssessment.clusteringScore,
        validation: riskAssessment.validationScore,
      },
    });

  } catch (error) {
    console.error('[REPORT ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function assessThreat(
  lat: number | null | undefined,
  lng: number | null | undefined,
  livenessConfidence: number,
  deviceId: string | undefined
): ThreatAssessment {
  const reasons: string[] = [];
  let level: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';

  // Check proximity to railway
  let nearestRailway: string | null = null;
  let minDistance: number | null = null;

  if (lat && lng) {
    for (const rail of RAILWAY_CORRIDORS) {
      const distance = haversineDistance(lat, lng, rail.lat, rail.lng);
      if (minDistance === null || distance < minDistance) {
        minDistance = distance;
        nearestRailway = rail.name;
      }
    }

    if (minDistance !== null && minDistance < CRITICAL_DISTANCE_METERS) {
      level = 'RED';
      reasons.push(`Within ${Math.round(minDistance)}m of railway corridor`);
    }
  }

  // Check clustering (multiple reports in same area)
  const clusterCount = countNearbyReports(lat, lng, deviceId);
  if (clusterCount >= 2) {
    if (level !== 'RED') level = 'YELLOW';
    if (clusterCount >= 3) level = 'RED';
    reasons.push(`${clusterCount} reports in area within 5 minutes`);
  }

  // Check liveness (anti-spoofing)
  if (livenessConfidence < 30) {
    reasons.push('Low liveness confidence - possible automated submission');
    // Don't escalate to RED based on low liveness alone, but flag it
  }

  // Final RED condition: near railway + multiple reports
  if (minDistance !== null && minDistance < CRITICAL_DISTANCE_METERS && clusterCount >= 2) {
    level = 'RED';
    reasons.push('CRITICAL: Multiple confirmed reports near railway infrastructure');
  }

  return {
    level,
    nearestRailway,
    distanceToRailway: minDistance,
    clusterCount,
    audioConfirmed: false, // TODO: Implement audio analysis
    reasons,
  };
}

function countNearbyReports(
  lat: number | null | undefined,
  lng: number | null | undefined,
  excludeDeviceId: string | undefined
): number {
  if (!lat || !lng) return 0;

  const now = Date.now();
  let count = 0;
  const seenDevices = new Set<string>();

  for (const [, report] of recentReports) {
    // Skip old reports
    if (now - report.timestamp > CLUSTER_TIME_WINDOW_MS) continue;
    
    // Skip if same device (prevent single user from escalating)
    if (report.deviceId === excludeDeviceId) continue;
    if (seenDevices.has(report.deviceId)) continue;

    // Check distance
    const distance = haversineDistance(lat, lng, report.lat, report.lng);
    if (distance <= CLUSTER_RADIUS_METERS) {
      count++;
      seenDevices.add(report.deviceId);
    }
  }

  return count;
}

function cleanOldReports() {
  const now = Date.now();
  for (const [id, report] of recentReports) {
    if (now - report.timestamp > CLUSTER_TIME_WINDOW_MS * 2) {
      recentReports.delete(id);
    }
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getClientIP(request: NextRequest): string {
  // Try various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback (may not work in all environments)
  return '127.0.0.1';
}

function countSameDeviceReports(deviceId: string | undefined): number {
  if (!deviceId) return 0;
  
  const now = Date.now();
  let count = 0;
  
  for (const [, report] of recentReports) {
    if (now - report.timestamp > CLUSTER_TIME_WINDOW_MS) continue;
    if (report.deviceId === deviceId) count++;
  }
  
  return count;
}

async function triggerCriticalAlert(report: any, assessment: CombinedRiskAssessment) {
  // In production, this would:
  // 1. Send SMS to SOK patrol units
  // 2. Push notification to ABW dashboard
  // 3. Email to PKP PLK security center
  // 4. Add to real-time monitoring dashboard

  console.log('='.repeat(60));
  console.log('[CRITICAL ALERT] RED - DRONE THREAT DETECTED');
  console.log(`Threat Level: ${assessment.threatLevel} | Score: ${assessment.totalScore}/100`);
  console.log(`Confidence: ${assessment.confidence}%`);
  console.log(`Infrastructure: ${report.nearestInfrastructure?.name || 'N/A'} @ ${Math.round(report.nearestInfrastructure?.distance || 0)}m`);
  console.log(`Cluster: ${report.clusterCount} nearby reports`);
  console.log(`Triggering Factors:`);
  assessment.triggeringFactors.forEach(f => console.log(`  - ${f.details}`));
  console.log(`Required Actions:`);
  assessment.requiredActions.forEach(a => console.log(`  - ${a}`));
  console.log('='.repeat(60));

  // TODO: Implement actual notification channels
  // await sendSMSToSOK(report, assessment);
  // await pushToABWDashboard(report, assessment);
  // await emailPKPSecurity(report, assessment);
}

async function triggerHighAlert(report: any, assessment: CombinedRiskAssessment) {
  // ORANGE level - high priority but not critical
  console.log('-'.repeat(60));
  console.log('[HIGH ALERT] ORANGE - Elevated Drone Threat');
  console.log(`Threat Level: ${assessment.threatLevel} | Score: ${assessment.totalScore}/100`);
  console.log(`Confidence: ${assessment.confidence}%`);
  console.log(`Location: ${report.nearestInfrastructure?.name || 'Unknown'}`);
  console.log(`Factors: ${assessment.triggeringFactors.map(f => f.name).join(', ')}`);
  console.log('-'.repeat(60));
  
  // TODO: Implement notification channels for ORANGE alerts
  // await notifyDispatcher(report, assessment);
}

function getResponseMessage(level: ThreatLevel): string {
  switch (level) {
    case 'RED':
      return 'ALERT KRYTYCZNY - Służby ochrony infrastruktury zostały powiadomione. Zachowaj bezpieczną odległość.';
    case 'ORANGE':
      return 'ALERT PODWYŻSZONY - Zgłoszenie przekazane do weryfikacji. Służby zostały powiadomione.';
    case 'YELLOW':
      return 'Zgłoszenie zarejestrowane - trwa weryfikacja. Dziękujemy za czujność.';
    default:
      return 'Zgłoszenie przyjęte. Dane zostaną przeanalizowane.';
  }
}

// GET endpoint for dispatcher dashboard
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // Simple auth check (replace with proper auth in production)
  if (authHeader !== `Bearer ${process.env.DISPATCHER_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return recent reports for dashboard
  const reports = Array.from(recentReports.entries()).map(([id, data]) => ({
    id,
    ...data,
    age: Math.round((Date.now() - data.timestamp) / 1000),
  }));

  return NextResponse.json({
    count: reports.length,
    reports,
    timestamp: new Date().toISOString(),
  });
}
