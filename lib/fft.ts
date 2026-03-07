/**
 * FFT Audio Analysis for Drone Detection
 * 
 * Drones have characteristic audio signatures:
 * - Propeller frequencies: 50-500 Hz (depending on size/type)
 * - Motor harmonics: Multiple peaks at regular intervals
 * - Typical drone buzzing: 100-300 Hz fundamental with harmonics
 */

import * as fft from 'fft-js';

// Drone audio signature thresholds
export const DRONE_FREQUENCY_BANDS = {
  // Small consumer drones (DJI Mini, etc.)
  small: { min: 150, max: 400, peakExpected: 250 },
  // Medium drones (DJI Mavic, Phantom)
  medium: { min: 100, max: 350, peakExpected: 180 },
  // Large/industrial drones
  large: { min: 50, max: 200, peakExpected: 100 },
  // Racing/FPV drones (high RPM)
  racing: { min: 300, max: 600, peakExpected: 450 },
};

export interface FFTResult {
  frequencies: number[];
  magnitudes: number[];
  dominantFrequency: number;
  dominantMagnitude: number;
  spectralCentroid: number;
  spectralFlatness: number;
}

export interface DroneAudioSignature {
  detected: boolean;
  confidence: number; // 0-100
  estimatedType: 'small' | 'medium' | 'large' | 'racing' | 'unknown' | null;
  dominantFrequency: number;
  harmonicsDetected: number;
  powerInDroneBand: number;
  totalPower: number;
  signalToNoiseRatio: number;
  reasons: string[];
}

/**
 * Perform FFT on audio samples
 */
export function performFFT(
  samples: number[],
  sampleRate: number = 44100
): FFTResult {
  // Ensure power of 2 length for FFT
  const fftSize = Math.pow(2, Math.floor(Math.log2(samples.length)));
  const truncatedSamples = samples.slice(0, fftSize);
  
  // Apply Hanning window to reduce spectral leakage
  const windowedSamples = applyHanningWindow(truncatedSamples);
  
  // Perform FFT
  const phasors = fft.fft(windowedSamples);
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  
  // Calculate magnitude spectrum (only positive frequencies)
  for (let i = 0; i < fftSize / 2; i++) {
    const freq = (i * sampleRate) / fftSize;
    const real = phasors[i][0];
    const imag = phasors[i][1];
    const magnitude = Math.sqrt(real * real + imag * imag);
    
    frequencies.push(freq);
    magnitudes.push(magnitude);
  }
  
  // Find dominant frequency
  let maxMagnitude = 0;
  let dominantIndex = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMagnitude) {
      maxMagnitude = magnitudes[i];
      dominantIndex = i;
    }
  }
  
  // Calculate spectral centroid (center of mass of spectrum)
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    weightedSum += frequencies[i] * magnitudes[i];
    magnitudeSum += magnitudes[i];
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  
  // Calculate spectral flatness (how noise-like vs tonal)
  const geometricMean = Math.exp(
    magnitudes.reduce((sum, m) => sum + Math.log(m + 1e-10), 0) / magnitudes.length
  );
  const arithmeticMean = magnitudeSum / magnitudes.length;
  const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  
  return {
    frequencies,
    magnitudes,
    dominantFrequency: frequencies[dominantIndex],
    dominantMagnitude: maxMagnitude,
    spectralCentroid,
    spectralFlatness,
  };
}

/**
 * Apply Hanning window to reduce spectral leakage
 */
function applyHanningWindow(samples: number[]): number[] {
  const n = samples.length;
  return samples.map((sample, i) => {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    return sample * window;
  });
}

/**
 * Detect drone audio signature from FFT result
 */
export function detectDroneSignature(
  fftResult: FFTResult,
  sampleRate: number = 44100
): DroneAudioSignature {
  const reasons: string[] = [];
  let confidence = 0;
  let estimatedType: 'small' | 'medium' | 'large' | 'racing' | 'unknown' | null = null;
  
  const { frequencies, magnitudes, dominantFrequency, spectralCentroid, spectralFlatness } = fftResult;
  
  // Calculate total power and power in drone frequency bands
  let totalPower = 0;
  let droneBandPower = 0;
  const droneMinFreq = 50;
  const droneMaxFreq = 600;
  
  for (let i = 0; i < frequencies.length; i++) {
    const power = magnitudes[i] * magnitudes[i];
    totalPower += power;
    
    if (frequencies[i] >= droneMinFreq && frequencies[i] <= droneMaxFreq) {
      droneBandPower += power;
    }
  }
  
  // Calculate signal-to-noise ratio
  const signalToNoiseRatio = totalPower > 0 ? droneBandPower / (totalPower - droneBandPower + 1e-10) : 0;
  
  // Check if dominant frequency is in drone range
  if (dominantFrequency >= droneMinFreq && dominantFrequency <= droneMaxFreq) {
    confidence += 20;
    reasons.push(`Dominant frequency ${Math.round(dominantFrequency)}Hz in drone range`);
    
    // Determine drone type based on frequency
    for (const [type, band] of Object.entries(DRONE_FREQUENCY_BANDS)) {
      if (dominantFrequency >= band.min && dominantFrequency <= band.max) {
        estimatedType = type as 'small' | 'medium' | 'large' | 'racing';
        const distanceFromPeak = Math.abs(dominantFrequency - band.peakExpected);
        const bandWidth = band.max - band.min;
        const proximityScore = 1 - (distanceFromPeak / bandWidth);
        confidence += Math.round(proximityScore * 15);
        reasons.push(`Matches ${type} drone signature`);
        break;
      }
    }
  }
  
  // Check for harmonics (characteristic of motors)
  const harmonicsDetected = detectHarmonics(frequencies, magnitudes, dominantFrequency);
  if (harmonicsDetected >= 2) {
    confidence += 15;
    reasons.push(`${harmonicsDetected} harmonic frequencies detected`);
  }
  if (harmonicsDetected >= 4) {
    confidence += 10;
    reasons.push('Strong harmonic series indicates motor/propeller source');
  }
  
  // Check power concentration in drone band
  const powerRatio = droneBandPower / (totalPower + 1e-10);
  if (powerRatio > 0.3) {
    confidence += 15;
    reasons.push(`${Math.round(powerRatio * 100)}% of power in drone frequency band`);
  }
  if (powerRatio > 0.5) {
    confidence += 10;
  }
  
  // Spectral characteristics
  // Drones have tonal sound (low flatness = more tonal)
  if (spectralFlatness < 0.3) {
    confidence += 10;
    reasons.push('Tonal audio signature (consistent with drone motor)');
  }
  
  // Spectral centroid in drone range
  if (spectralCentroid >= 100 && spectralCentroid <= 500) {
    confidence += 5;
    reasons.push(`Spectral centroid at ${Math.round(spectralCentroid)}Hz`);
  }
  
  // SNR check
  if (signalToNoiseRatio > 2) {
    confidence += 10;
    reasons.push('High signal-to-noise ratio in drone band');
  }
  
  // Cap confidence at 100
  confidence = Math.min(confidence, 100);
  
  // Determine detection
  const detected = confidence >= 50;
  if (!detected && confidence >= 30) {
    reasons.push('Insufficient confidence for positive detection');
    estimatedType = 'unknown';
  }
  
  return {
    detected,
    confidence,
    estimatedType: detected ? estimatedType : null,
    dominantFrequency,
    harmonicsDetected,
    powerInDroneBand: droneBandPower,
    totalPower,
    signalToNoiseRatio,
    reasons,
  };
}

/**
 * Detect harmonic frequencies (multiples of fundamental)
 */
function detectHarmonics(
  frequencies: number[],
  magnitudes: number[],
  fundamental: number,
  tolerance: number = 0.1 // 10% tolerance
): number {
  if (fundamental < 20) return 0;
  
  // Find peaks in magnitude spectrum
  const peaks: { freq: number; mag: number }[] = [];
  const threshold = Math.max(...magnitudes) * 0.1; // 10% of max
  
  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (
      magnitudes[i] > threshold &&
      magnitudes[i] > magnitudes[i - 1] &&
      magnitudes[i] > magnitudes[i + 1]
    ) {
      peaks.push({ freq: frequencies[i], mag: magnitudes[i] });
    }
  }
  
  // Count harmonics (2f, 3f, 4f, etc.)
  let harmonicCount = 0;
  for (let n = 2; n <= 8; n++) {
    const expectedFreq = fundamental * n;
    const minFreq = expectedFreq * (1 - tolerance);
    const maxFreq = expectedFreq * (1 + tolerance);
    
    const found = peaks.some(p => p.freq >= minFreq && p.freq <= maxFreq);
    if (found) harmonicCount++;
  }
  
  return harmonicCount;
}

/**
 * Analyze audio buffer and return drone signature
 */
export async function analyzeAudioBuffer(
  audioBuffer: ArrayBuffer,
  sampleRate: number = 44100
): Promise<DroneAudioSignature> {
  // Decode audio to samples
  const audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
  
  try {
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
    const channelData = decodedAudio.getChannelData(0); // Mono channel
    const samples = Array.from(channelData);
    
    // Perform FFT analysis
    const fftResult = performFFT(samples, sampleRate);
    return detectDroneSignature(fftResult, sampleRate);
  } finally {
    await audioContext.close();
  }
}

/**
 * Real-time analysis using AnalyserNode data
 */
export function analyzeFrequencyData(
  frequencyData: Uint8Array,
  sampleRate: number = 44100,
  fftSize: number = 2048
): DroneAudioSignature {
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  
  // Convert Uint8Array to frequency/magnitude pairs
  for (let i = 0; i < frequencyData.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    const magnitude = frequencyData[i] / 255; // Normalize to 0-1
    frequencies.push(freq);
    magnitudes.push(magnitude);
  }
  
  // Find dominant frequency
  let maxMagnitude = 0;
  let dominantIndex = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMagnitude) {
      maxMagnitude = magnitudes[i];
      dominantIndex = i;
    }
  }
  
  // Calculate spectral features
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    weightedSum += frequencies[i] * magnitudes[i];
    magnitudeSum += magnitudes[i];
  }
  
  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  const geometricMean = Math.exp(
    magnitudes.reduce((sum, m) => sum + Math.log(m + 1e-10), 0) / magnitudes.length
  );
  const arithmeticMean = magnitudeSum / magnitudes.length;
  const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  
  const fftResult: FFTResult = {
    frequencies,
    magnitudes,
    dominantFrequency: frequencies[dominantIndex],
    dominantMagnitude: maxMagnitude,
    spectralCentroid,
    spectralFlatness,
  };
  
  return detectDroneSignature(fftResult, sampleRate);
}

/**
 * Risk level based on drone audio confidence
 */
export function getAudioRiskLevel(signature: DroneAudioSignature): {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
} {
  if (!signature.detected) {
    return { level: 'LOW', score: 0 };
  }
  
  if (signature.confidence >= 80) {
    return { level: 'CRITICAL', score: 100 };
  }
  
  if (signature.confidence >= 65) {
    return { level: 'HIGH', score: 75 };
  }
  
  if (signature.confidence >= 50) {
    return { level: 'MEDIUM', score: 50 };
  }
  
  return { level: 'LOW', score: 25 };
}
