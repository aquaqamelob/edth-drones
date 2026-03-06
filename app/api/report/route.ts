import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

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

    // Get location for threat assessment
    const location = reportData.groundTruth || reportData.deviceLocation;
    const lat = location?.latitude;
    const lng = location?.longitude;

    // Assess threat level
    const assessment = assessThreat(
      lat,
      lng,
      reportData.liveness?.confidence || 0,
      reportData.deviceMetadata?.deviceId
    );

    // Store report for clustering
    if (lat && lng) {
      recentReports.set(reportId, {
        lat,
        lng,
        timestamp: Date.now(),
        deviceId: reportData.deviceMetadata?.deviceId || 'unknown',
        hasAudioSignature: false, // Will be updated after audio analysis
      });

      // Clean old reports
      cleanOldReports();
    }

    // Store media files
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

    // Store metadata
    const fullReport = {
      ...reportData,
      assessment,
      timestamp,
      videoPath: videoFile ? `${reportId}/video.webm` : null,
      audioPath: audioFile ? `${reportId}/audio.webm` : null,
    };

    await writeFile(
      join(storagePath, 'report.json'),
      JSON.stringify(fullReport, null, 2)
    );

    // If RED alert, trigger immediate notification
    if (assessment.level === 'RED') {
      await triggerCriticalAlert(fullReport, assessment);
    }

    // Log for audit
    console.log(`[REPORT] ${reportId} | Level: ${assessment.level} | Location: ${lat?.toFixed(6)}, ${lng?.toFixed(6)} | Railway: ${assessment.nearestRailway}`);

    return NextResponse.json({
      success: true,
      reportId,
      threatLevel: assessment.level,
      message: getResponseMessage(assessment.level),
      timestamp,
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

async function triggerCriticalAlert(report: any, assessment: ThreatAssessment) {
  // In production, this would:
  // 1. Send SMS to SOK patrol units
  // 2. Push notification to ABW dashboard
  // 3. Email to PKP PLK security center
  // 4. Add to real-time monitoring dashboard

  console.log('='.repeat(60));
  console.log('[CRITICAL ALERT] DRONE THREAT DETECTED');
  console.log(`Railway: ${assessment.nearestRailway}`);
  console.log(`Distance: ${assessment.distanceToRailway?.toFixed(0)}m`);
  console.log(`Cluster: ${assessment.clusterCount} reports`);
  console.log(`Reasons: ${assessment.reasons.join(', ')}`);
  console.log('='.repeat(60));

  // TODO: Implement actual notification channels
  // await sendSMSToSOK(report, assessment);
  // await pushToABWDashboard(report, assessment);
  // await emailPKPSecurity(report, assessment);
}

function getResponseMessage(level: 'GREEN' | 'YELLOW' | 'RED'): string {
  switch (level) {
    case 'RED':
      return 'ALERT KRYTYCZNY - Służby ochrony infrastruktury zostały powiadomione. Zachowaj bezpieczną odległość.';
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
