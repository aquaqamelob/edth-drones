/**
 * TensorFlow.js Model Loader for Drone Detection
 * 
 * Loads and runs Keras models converted to TensorFlow.js format
 * Can be used for:
 * - Audio classification (drone sounds)
 * - Image classification (drone detection in frames)
 * - Multi-modal classification
 */

import * as tf from '@tensorflow/tfjs';

// Model types supported
export type ModelType = 'audio' | 'image' | 'multimodal';

export interface ModelConfig {
  type: ModelType;
  modelPath: string;
  inputShape: number[];
  outputClasses: string[];
  preprocessingConfig?: PreprocessingConfig;
}

export interface PreprocessingConfig {
  // Audio preprocessing
  sampleRate?: number;
  fftSize?: number;
  hopLength?: number;
  nMels?: number;
  
  // Image preprocessing
  imageSize?: [number, number];
  normalize?: boolean;
  meanSubtract?: number[];
}

export interface PredictionResult {
  className: string;
  confidence: number;
  allProbabilities: { class: string; probability: number }[];
  inferenceTimeMs: number;
}

export interface DroneClassification {
  isDrone: boolean;
  droneType: string | null;
  confidence: number;
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  details: PredictionResult | null;
}

// Default model configurations
export const DEFAULT_AUDIO_MODEL_CONFIG: ModelConfig = {
  type: 'audio',
  modelPath: '/models/drone_audio_classifier/model.json',
  inputShape: [128, 128, 1], // Mel spectrogram
  outputClasses: ['background', 'small_drone', 'medium_drone', 'large_drone', 'helicopter', 'airplane'],
  preprocessingConfig: {
    sampleRate: 44100,
    fftSize: 2048,
    hopLength: 512,
    nMels: 128,
  },
};

export const DEFAULT_IMAGE_MODEL_CONFIG: ModelConfig = {
  type: 'image',
  modelPath: '/models/drone_image_classifier/model.json',
  inputShape: [224, 224, 3], // Standard image size
  outputClasses: ['no_drone', 'quadcopter', 'fixed_wing', 'helicopter', 'unknown_uav'],
  preprocessingConfig: {
    imageSize: [224, 224],
    normalize: true,
    meanSubtract: [0.485, 0.456, 0.406], // ImageNet means
  },
};

// Singleton model instances
let audioModel: tf.LayersModel | null = null;
let imageModel: tf.LayersModel | null = null;
let multimodalModel: tf.LayersModel | null = null;

/**
 * Load a TensorFlow.js model from path
 */
export async function loadModel(config: ModelConfig): Promise<tf.LayersModel> {
  console.log(`[ML] Loading ${config.type} model from ${config.modelPath}`);
  
  try {
    const model = await tf.loadLayersModel(config.modelPath);
    console.log(`[ML] Model loaded successfully. Input shape: ${model.inputs[0].shape}`);
    
    // Warm up the model with a dummy prediction
    const dummyInput = tf.zeros([1, ...config.inputShape]);
    await model.predict(dummyInput);
    dummyInput.dispose();
    
    console.log('[ML] Model warmed up and ready');
    return model;
  } catch (error) {
    console.error(`[ML] Failed to load model: ${error}`);
    throw error;
  }
}

/**
 * Get or load the audio classification model
 */
export async function getAudioModel(modelPath?: string): Promise<tf.LayersModel> {
  if (!audioModel) {
    const config = { ...DEFAULT_AUDIO_MODEL_CONFIG };
    if (modelPath) config.modelPath = modelPath;
    audioModel = await loadModel(config);
  }
  return audioModel;
}

/**
 * Get or load the image classification model
 */
export async function getImageModel(modelPath?: string): Promise<tf.LayersModel> {
  if (!imageModel) {
    const config = { ...DEFAULT_IMAGE_MODEL_CONFIG };
    if (modelPath) config.modelPath = modelPath;
    imageModel = await loadModel(config);
  }
  return imageModel;
}

/**
 * Preprocess audio for model input (convert to mel spectrogram)
 */
export function preprocessAudio(
  audioSamples: Float32Array | number[],
  config: PreprocessingConfig = DEFAULT_AUDIO_MODEL_CONFIG.preprocessingConfig!
): tf.Tensor {
  return tf.tidy(() => {
    const samples = audioSamples instanceof Float32Array 
      ? Array.from(audioSamples) 
      : audioSamples;
    
    const { sampleRate = 44100, fftSize = 2048, hopLength = 512, nMels = 128 } = config;
    
    // Simplified mel spectrogram computation
    // In production, use a proper audio processing library
    const numFrames = Math.floor((samples.length - fftSize) / hopLength) + 1;
    const spectrogram: number[][] = [];
    
    for (let frame = 0; frame < numFrames && frame < nMels; frame++) {
      const start = frame * hopLength;
      const windowSamples = samples.slice(start, start + fftSize);
      
      // Apply Hanning window
      const windowed = windowSamples.map((s, i) => 
        s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      );
      
      // Simple magnitude estimation (simplified, not full FFT)
      const frameData: number[] = [];
      for (let i = 0; i < nMels; i++) {
        // Simplified: just use raw windowed values for demo
        const idx = Math.floor((i / nMels) * windowed.length);
        frameData.push(Math.abs(windowed[idx] || 0));
      }
      spectrogram.push(frameData);
    }
    
    // Pad to target shape
    while (spectrogram.length < nMels) {
      spectrogram.push(new Array(nMels).fill(0));
    }
    
    // Convert to tensor and add batch/channel dimensions
    const tensor2d = tf.tensor2d(spectrogram.slice(0, nMels));
    const normalized = tensor2d.div(tensor2d.max().add(1e-10));
    return normalized.expandDims(0).expandDims(-1) as tf.Tensor;
  });
}

/**
 * Preprocess image for model input
 */
export function preprocessImage(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement,
  config: PreprocessingConfig = DEFAULT_IMAGE_MODEL_CONFIG.preprocessingConfig!
): tf.Tensor {
  return tf.tidy(() => {
    const { imageSize = [224, 224], normalize = true, meanSubtract } = config;
    
    let tensor = tf.browser.fromPixels(imageData);
    
    // Resize
    tensor = tf.image.resizeBilinear(tensor, imageSize);
    
    // Normalize to 0-1
    if (normalize) {
      tensor = tensor.div(255);
    }
    
    // Subtract ImageNet means if specified
    if (meanSubtract) {
      const means = tf.tensor1d(meanSubtract);
      tensor = tensor.sub(means);
    }
    
    // Add batch dimension
    return tensor.expandDims(0);
  });
}

/**
 * Run inference on preprocessed input
 */
export async function runInference(
  model: tf.LayersModel,
  input: tf.Tensor,
  classNames: string[]
): Promise<PredictionResult> {
  const startTime = performance.now();
  
  const predictions = model.predict(input) as tf.Tensor;
  const probabilities = await predictions.data();
  
  const inferenceTimeMs = performance.now() - startTime;
  
  // Find top prediction
  let maxProb = 0;
  let maxIdx = 0;
  const allProbabilities: { class: string; probability: number }[] = [];
  
  for (let i = 0; i < probabilities.length; i++) {
    const prob = probabilities[i];
    allProbabilities.push({
      class: classNames[i] || `class_${i}`,
      probability: prob,
    });
    
    if (prob > maxProb) {
      maxProb = prob;
      maxIdx = i;
    }
  }
  
  // Sort by probability
  allProbabilities.sort((a, b) => b.probability - a.probability);
  
  // Cleanup
  predictions.dispose();
  input.dispose();
  
  return {
    className: classNames[maxIdx] || `class_${maxIdx}`,
    confidence: maxProb,
    allProbabilities,
    inferenceTimeMs,
  };
}

/**
 * Classify audio as drone or not
 */
export async function classifyAudio(
  audioSamples: Float32Array | number[],
  modelPath?: string
): Promise<DroneClassification> {
  try {
    const model = await getAudioModel(modelPath);
    const input = preprocessAudio(audioSamples);
    const result = await runInference(model, input, DEFAULT_AUDIO_MODEL_CONFIG.outputClasses);
    
    // Determine if drone detected
    const droneClasses = ['small_drone', 'medium_drone', 'large_drone'];
    const isDrone = droneClasses.includes(result.className);
    
    // Calculate threat level based on confidence
    let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
    if (isDrone) {
      if (result.confidence >= 0.8) threatLevel = 'HIGH';
      else if (result.confidence >= 0.6) threatLevel = 'MEDIUM';
      else threatLevel = 'LOW';
    }
    
    return {
      isDrone,
      droneType: isDrone ? result.className : null,
      confidence: result.confidence,
      threatLevel,
      details: result,
    };
  } catch (error) {
    console.error('[ML] Audio classification failed:', error);
    return {
      isDrone: false,
      droneType: null,
      confidence: 0,
      threatLevel: 'NONE',
      details: null,
    };
  }
}

/**
 * Classify image frame for drone detection
 */
export async function classifyImage(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement,
  modelPath?: string
): Promise<DroneClassification> {
  try {
    const model = await getImageModel(modelPath);
    const input = preprocessImage(imageData);
    const result = await runInference(model, input, DEFAULT_IMAGE_MODEL_CONFIG.outputClasses);
    
    // Determine if drone detected
    const droneClasses = ['quadcopter', 'fixed_wing', 'helicopter', 'unknown_uav'];
    const isDrone = droneClasses.includes(result.className);
    
    // Calculate threat level
    let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
    if (isDrone) {
      if (result.confidence >= 0.8) threatLevel = 'HIGH';
      else if (result.confidence >= 0.6) threatLevel = 'MEDIUM';
      else threatLevel = 'LOW';
    }
    
    return {
      isDrone,
      droneType: isDrone ? result.className : null,
      confidence: result.confidence,
      threatLevel,
      details: result,
    };
  } catch (error) {
    console.error('[ML] Image classification failed:', error);
    return {
      isDrone: false,
      droneType: null,
      confidence: 0,
      threatLevel: 'NONE',
      details: null,
    };
  }
}

/**
 * Cleanup model resources
 */
export function disposeModels(): void {
  if (audioModel) {
    audioModel.dispose();
    audioModel = null;
  }
  if (imageModel) {
    imageModel.dispose();
    imageModel = null;
  }
  if (multimodalModel) {
    multimodalModel.dispose();
    multimodalModel = null;
  }
  console.log('[ML] All models disposed');
}

/**
 * Get memory info for debugging
 */
export function getMemoryInfo(): tf.MemoryInfo {
  return tf.memory();
}

/**
 * Check if WebGL backend is available (for GPU acceleration)
 */
export async function initializeTensorFlow(): Promise<{
  backend: string;
  webglAvailable: boolean;
}> {
  // Try WebGL first for GPU acceleration
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    return {
      backend: tf.getBackend(),
      webglAvailable: true,
    };
  } catch (e) {
    // Fall back to CPU
    await tf.setBackend('cpu');
    await tf.ready();
    return {
      backend: tf.getBackend(),
      webglAvailable: false,
    };
  }
}

/**
 * Create a simple drone detection model (for testing without a trained model)
 */
export function createDummyModel(inputShape: number[], numClasses: number): tf.LayersModel {
  const model = tf.sequential();
  
  model.add(tf.layers.conv2d({
    inputShape,
    filters: 32,
    kernelSize: 3,
    activation: 'relu',
  }));
  
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.5 }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));
  
  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  
  return model;
}

// ==================== SIMULATED CLASSIFICATION ====================
// These functions simulate ML classification based on FFT analysis
// Used when actual trained models are not available

import type { DroneAudioSignature } from './fft';

/**
 * Simulate audio classification based on FFT analysis results
 * This provides realistic-looking ML output without needing a trained model
 */
export function simulateAudioClassification(
  fftSignature: DroneAudioSignature | null
): DroneClassification {
  const startTime = performance.now();
  
  if (!fftSignature) {
    return {
      isDrone: false,
      droneType: null,
      confidence: 0,
      threatLevel: 'NONE',
      details: null,
    };
  }
  
  // Map FFT results to simulated ML classification
  const isDrone = fftSignature.detected;
  const baseConfidence = fftSignature.confidence / 100;
  
  // Add some variance to simulate ML uncertainty
  const mlVariance = (Math.random() - 0.5) * 0.15;
  const confidence = Math.max(0, Math.min(1, baseConfidence + mlVariance));
  
  // Map drone type from FFT
  let className = 'background';
  if (isDrone && fftSignature.estimatedType) {
    className = fftSignature.estimatedType === 'small' ? 'small_drone' :
                fftSignature.estimatedType === 'medium' ? 'medium_drone' :
                fftSignature.estimatedType === 'large' ? 'large_drone' :
                fftSignature.estimatedType === 'racing' ? 'racing_drone' : 'unknown_drone';
  }
  
  // Generate realistic probability distribution
  const classes = DEFAULT_AUDIO_MODEL_CONFIG.outputClasses;
  const allProbabilities = classes.map(cls => {
    if (cls === className) {
      return { class: cls, probability: confidence };
    } else if (isDrone && cls.includes('drone')) {
      return { class: cls, probability: Math.random() * (1 - confidence) * 0.5 };
    } else {
      return { class: cls, probability: Math.random() * (1 - confidence) * 0.3 };
    }
  });
  
  // Normalize probabilities
  const totalProb = allProbabilities.reduce((sum, p) => sum + p.probability, 0);
  allProbabilities.forEach(p => p.probability /= totalProb);
  allProbabilities.sort((a, b) => b.probability - a.probability);
  
  const inferenceTimeMs = performance.now() - startTime + Math.random() * 50;
  
  // Determine threat level
  let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  if (isDrone) {
    if (confidence >= 0.8) threatLevel = 'HIGH';
    else if (confidence >= 0.6) threatLevel = 'MEDIUM';
    else threatLevel = 'LOW';
  }
  
  return {
    isDrone,
    droneType: isDrone ? className : null,
    confidence,
    threatLevel,
    details: {
      className,
      confidence,
      allProbabilities,
      inferenceTimeMs,
    },
  };
}

/**
 * Simulate image classification based on visual features
 * Generates realistic-looking ML output for UI demo
 */
export function simulateImageClassification(
  hasMotion: boolean = false,
  motionIntensity: number = 0
): DroneClassification {
  const startTime = performance.now();
  
  // Simulate detection based on motion
  // In a real scenario, we'd analyze actual image frames
  const detectionProbability = hasMotion ? 0.3 + motionIntensity * 0.4 : 0.1;
  const isDrone = Math.random() < detectionProbability;
  
  const classes = DEFAULT_IMAGE_MODEL_CONFIG.outputClasses;
  let className = 'no_drone';
  let confidence = 0.5 + Math.random() * 0.3;
  
  if (isDrone) {
    // Pick a random drone type
    const droneClasses = classes.filter(c => c !== 'no_drone');
    className = droneClasses[Math.floor(Math.random() * droneClasses.length)];
  } else {
    confidence = 0.7 + Math.random() * 0.25;
  }
  
  // Generate probability distribution
  const allProbabilities = classes.map(cls => {
    if (cls === className) {
      return { class: cls, probability: confidence };
    } else {
      return { class: cls, probability: Math.random() * (1 - confidence) / (classes.length - 1) };
    }
  });
  
  // Normalize
  const totalProb = allProbabilities.reduce((sum, p) => sum + p.probability, 0);
  allProbabilities.forEach(p => p.probability /= totalProb);
  allProbabilities.sort((a, b) => b.probability - a.probability);
  
  const inferenceTimeMs = performance.now() - startTime + Math.random() * 100;
  
  let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  if (isDrone) {
    if (confidence >= 0.8) threatLevel = 'HIGH';
    else if (confidence >= 0.6) threatLevel = 'MEDIUM';
    else threatLevel = 'LOW';
  }
  
  return {
    isDrone,
    droneType: isDrone ? className : null,
    confidence,
    threatLevel,
    details: {
      className,
      confidence,
      allProbabilities,
      inferenceTimeMs,
    },
  };
}

/**
 * Combined simulated classification using both audio and motion data
 */
export function simulateCombinedClassification(
  audioSignature: DroneAudioSignature | null,
  hasMotion: boolean = false,
  motionIntensity: number = 0
): {
  audio: DroneClassification;
  image: DroneClassification;
  combined: DroneClassification;
} {
  const audio = simulateAudioClassification(audioSignature);
  const image = simulateImageClassification(hasMotion, motionIntensity);
  
  // Combine results with weighted average
  const audioWeight = 0.6;
  const imageWeight = 0.4;
  
  const combinedIsDrone = audio.isDrone || image.isDrone;
  const combinedConfidence = combinedIsDrone
    ? (audio.isDrone ? audio.confidence * audioWeight : 0) +
      (image.isDrone ? image.confidence * imageWeight : 0)
    : Math.min(audio.confidence, image.confidence);
  
  // Use audio drone type if available, otherwise image
  const combinedType = audio.droneType || image.droneType;
  
  let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  if (combinedIsDrone) {
    if (combinedConfidence >= 0.75) threatLevel = 'HIGH';
    else if (combinedConfidence >= 0.55) threatLevel = 'MEDIUM';
    else threatLevel = 'LOW';
  }
  
  return {
    audio,
    image,
    combined: {
      isDrone: combinedIsDrone,
      droneType: combinedType,
      confidence: combinedConfidence,
      threatLevel,
      details: {
        className: combinedType || 'no_drone',
        confidence: combinedConfidence,
        allProbabilities: [],
        inferenceTimeMs: (audio.details?.inferenceTimeMs || 0) + (image.details?.inferenceTimeMs || 0),
      },
    },
  };
}
