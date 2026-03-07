/**
 * IP Risk Assessment Module
 * 
 * Analyzes request IP addresses to detect potential threats:
 * - VPN/Proxy detection
 * - Data center/hosting provider detection
 * - Geographic anomalies
 * - Suspicious country origins
 * - Known threat IPs
 */

// GeoIP lookup type for optional dependency
type GeoIPLookup = {
  country: string;
  region: string;
  city: string;
  ll: [number, number];
  timezone: string;
} | null;

// Dynamic geoip loading with error handling
let geoipModule: { lookup: (ip: string) => GeoIPLookup } | null = null;
let geoipLoadAttempted = false;

// Initialize geoip module lazily
function initGeoIP(): void {
  if (geoipLoadAttempted) return;
  geoipLoadAttempted = true;
  
  try {
    // Only try to load in Node.js server environment
    if (typeof window === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      geoipModule = require('geoip-lite');
      console.log('[IP-Risk] geoip-lite loaded successfully');
    }
  } catch (error) {
    console.warn('[IP-Risk] geoip-lite not available, IP geolocation disabled:', 
      error instanceof Error ? error.message : 'Unknown error');
    geoipModule = null;
  }
}

// Synchronous lookup that returns null if geoip not available
function geoipLookup(ip: string): GeoIPLookup {
  initGeoIP();
  if (!geoipModule) return null;
  try {
    return geoipModule.lookup(ip);
  } catch {
    return null;
  }
}

// High-risk countries for drone-related threats (critical infrastructure attacks)
const HIGH_RISK_COUNTRIES = new Set([
  'RU', // Russia
  'BY', // Belarus
  'CN', // China (state-sponsored concerns)
  'KP', // North Korea
  'IR', // Iran
]);

// Countries with known drone attack activity
const ELEVATED_RISK_COUNTRIES = new Set([
  'UA', // Ukraine (conflict zone)
  'SY', // Syria
  'IQ', // Iraq
  'YE', // Yemen
  'LY', // Libya
]);

// Common VPN/proxy ASN patterns (these are indicative, not exhaustive)
const VPN_HOSTING_KEYWORDS = [
  'digital ocean',
  'amazon',
  'aws',
  'google cloud',
  'microsoft azure',
  'linode',
  'vultr',
  'ovh',
  'hetzner',
  'cloudflare',
  'akamai',
  'fastly',
  'vpn',
  'proxy',
  'hosting',
  'data center',
  'datacenter',
  'server',
  'cloud',
  'vps',
];

// Known data center IP ranges (partial list for demonstration)
const DATACENTER_ASN_PREFIXES = [
  'AS14061', // DigitalOcean
  'AS16509', // Amazon
  'AS15169', // Google
  'AS8075',  // Microsoft
  'AS13335', // Cloudflare
  'AS20473', // Vultr
  'AS63949', // Linode
  'AS16276', // OVH
];

export interface IPRiskAssessment {
  ip: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  coordinates: { lat: number; lon: number } | null;
  
  // Risk factors
  isHighRiskCountry: boolean;
  isElevatedRiskCountry: boolean;
  isPotentialVPN: boolean;
  isPotentialDatacenter: boolean;
  isPrivateIP: boolean;
  isTor: boolean;
  
  // Analysis details
  reasons: string[];
  recommendations: string[];
}

export interface GeoDistanceCheck {
  deviceLat: number;
  deviceLon: number;
  ipLat: number;
  ipLon: number;
  distanceKm: number;
  isAnomaly: boolean;
  anomalyThresholdKm: number;
}

/**
 * Analyze IP address for risk factors
 */
export function analyzeIP(ip: string): IPRiskAssessment {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;
  
  // Check for private/local IPs
  const isPrivateIP = isPrivateIPAddress(ip);
  if (isPrivateIP) {
    return {
      ip,
      riskLevel: 'LOW',
      riskScore: 0,
      country: null,
      countryName: null,
      region: null,
      city: null,
      timezone: null,
      coordinates: null,
      isHighRiskCountry: false,
      isElevatedRiskCountry: false,
      isPotentialVPN: false,
      isPotentialDatacenter: false,
      isPrivateIP: true,
      isTor: false,
      reasons: ['Private/local IP address - trusted network'],
      recommendations: [],
    };
  }
  
  // Lookup GeoIP data
  const geo = geoipLookup(ip);
  
  const country = geo?.country || null;
  const countryName = country ? getCountryName(country) : null;
  const region = geo?.region || null;
  const city = geo?.city || null;
  const timezone = geo?.timezone || null;
  const coordinates = geo?.ll ? { lat: geo.ll[0], lon: geo.ll[1] } : null;
  
  // Check high-risk countries
  const isHighRiskCountry = country ? HIGH_RISK_COUNTRIES.has(country) : false;
  if (isHighRiskCountry) {
    riskScore += 40;
    reasons.push(`High-risk country: ${countryName} (${country})`);
    recommendations.push('Verify user identity and device authentication');
  }
  
  // Check elevated risk countries
  const isElevatedRiskCountry = country ? ELEVATED_RISK_COUNTRIES.has(country) : false;
  if (isElevatedRiskCountry) {
    riskScore += 20;
    reasons.push(`Elevated-risk country: ${countryName} (${country})`);
  }
  
  // Check for potential VPN/datacenter
  const isPotentialDatacenter = checkDatacenterIP(ip);
  if (isPotentialDatacenter) {
    riskScore += 25;
    reasons.push('IP appears to be from a data center/hosting provider');
    recommendations.push('May be VPN or automated submission');
  }
  
  // Check for Tor exit nodes (simplified check - would need Tor exit list in production)
  const isTor = checkTorExitNode(ip);
  if (isTor) {
    riskScore += 35;
    reasons.push('IP identified as potential Tor exit node');
    recommendations.push('Anonymous submission - extra verification needed');
  }
  
  // No geolocation data is suspicious for non-private IPs
  if (!geo) {
    riskScore += 15;
    reasons.push('No geolocation data available for IP');
  }
  
  // Unknown or uncommon timezone
  if (timezone && !isCommonTimezone(timezone)) {
    riskScore += 5;
    reasons.push(`Uncommon timezone: ${timezone}`);
  }
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore >= 70) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 25) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }
  
  if (reasons.length === 0) {
    reasons.push('Standard residential/mobile IP - no risk factors detected');
  }
  
  return {
    ip,
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    country,
    countryName,
    region,
    city,
    timezone,
    coordinates,
    isHighRiskCountry,
    isElevatedRiskCountry,
    isPotentialVPN: isPotentialDatacenter, // Using same check for VPN
    isPotentialDatacenter,
    isPrivateIP,
    isTor,
    reasons,
    recommendations,
  };
}

/**
 * Check if geo distance between device location and IP location is anomalous
 */
export function checkGeoAnomaly(
  deviceLat: number,
  deviceLon: number,
  ipAssessment: IPRiskAssessment,
  thresholdKm: number = 500
): GeoDistanceCheck | null {
  if (!ipAssessment.coordinates) {
    return null;
  }
  
  const { lat: ipLat, lon: ipLon } = ipAssessment.coordinates;
  const distanceKm = haversineDistance(deviceLat, deviceLon, ipLat, ipLon);
  const isAnomaly = distanceKm > thresholdKm;
  
  return {
    deviceLat,
    deviceLon,
    ipLat,
    ipLon,
    distanceKm,
    isAnomaly,
    anomalyThresholdKm: thresholdKm,
  };
}

/**
 * Calculate haversine distance between two points in km
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if IP is a private/local address
 */
function isPrivateIPAddress(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80:/i,
    /^fc00:/i,
    /^fd00:/i,
  ];
  
  return privateRanges.some(range => range.test(ip));
}

/**
 * Check if IP might be from a datacenter (simplified check)
 */
function checkDatacenterIP(ip: string): boolean {
  // In production, you'd check against a datacenter IP database
  // For now, we do a simple heuristic based on reverse DNS
  // This is a placeholder - real implementation would use ASN data
  
  // Common datacenter IP patterns (very simplified)
  const datacenterPatterns = [
    /\d+\.compute\.amazonaws\.com$/i,
    /\d+\.googleusercontent\.com$/i,
    /\.cloud$/i,
    /\.vps\./i,
    /\.server\./i,
  ];
  
  // Would need reverse DNS lookup here
  // For now, return false (can't determine without DNS)
  return false;
}

/**
 * Check if IP is a known Tor exit node (placeholder)
 */
function checkTorExitNode(ip: string): boolean {
  // In production, you'd check against the Tor exit node list
  // https://check.torproject.org/torbulkexitlist
  // This is a placeholder
  return false;
}

/**
 * Get country name from ISO code
 */
function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    PL: 'Poland',
    US: 'United States',
    GB: 'United Kingdom',
    DE: 'Germany',
    FR: 'France',
    RU: 'Russia',
    CN: 'China',
    BY: 'Belarus',
    UA: 'Ukraine',
    KP: 'North Korea',
    IR: 'Iran',
    SY: 'Syria',
    IQ: 'Iraq',
    YE: 'Yemen',
    LY: 'Libya',
    // Add more as needed
  };
  
  return countries[code] || code;
}

/**
 * Check if timezone is common/expected
 */
function isCommonTimezone(tz: string): boolean {
  // Check for European timezones (expected for Poland/EU deployment)
  const commonPrefixes = [
    'Europe/',
    'America/',
    'Asia/',
    'UTC',
    'GMT',
  ];
  
  return commonPrefixes.some(prefix => tz.startsWith(prefix));
}

/**
 * Batch analyze multiple IPs
 */
export function analyzeMultipleIPs(ips: string[]): IPRiskAssessment[] {
  return ips.map(ip => analyzeIP(ip));
}

/**
 * Get combined risk score from multiple factors
 */
export function getCombinedIPRisk(
  ipAssessment: IPRiskAssessment,
  geoAnomaly: GeoDistanceCheck | null
): {
  totalScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
} {
  let totalScore = ipAssessment.riskScore;
  const factors = [...ipAssessment.reasons];
  
  if (geoAnomaly?.isAnomaly) {
    totalScore += 30;
    factors.push(`Device location ${Math.round(geoAnomaly.distanceKm)}km from IP location`);
  }
  
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (totalScore >= 80) {
    level = 'CRITICAL';
  } else if (totalScore >= 55) {
    level = 'HIGH';
  } else if (totalScore >= 30) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }
  
  return {
    totalScore: Math.min(totalScore, 100),
    level,
    factors,
  };
}

/**
 * Rate limiting data structure
 */
export interface RateLimitInfo {
  ip: string;
  requestCount: number;
  firstRequestTime: number;
  lastRequestTime: number;
  isRateLimited: boolean;
  remainingRequests: number;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; firstTime: number; lastTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Check rate limiting for an IP
 */
export function checkRateLimit(ip: string): RateLimitInfo {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);
  
  if (!existing || now - existing.firstTime > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, firstTime: now, lastTime: now });
    return {
      ip,
      requestCount: 1,
      firstRequestTime: now,
      lastRequestTime: now,
      isRateLimited: false,
      remainingRequests: MAX_REQUESTS_PER_WINDOW - 1,
    };
  }
  
  // Update existing
  existing.count++;
  existing.lastTime = now;
  rateLimitStore.set(ip, existing);
  
  const isRateLimited = existing.count > MAX_REQUESTS_PER_WINDOW;
  
  return {
    ip,
    requestCount: existing.count,
    firstRequestTime: existing.firstTime,
    lastRequestTime: existing.lastTime,
    isRateLimited,
    remainingRequests: Math.max(0, MAX_REQUESTS_PER_WINDOW - existing.count),
  };
}

/**
 * Clean up old rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.firstTime > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}
