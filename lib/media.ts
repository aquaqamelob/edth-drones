'use client';

import { useState, useRef, useCallback } from 'react';
import type { MediaCapture } from './types';

interface UseMediaCaptureOptions {
  videoDuration?: number; // milliseconds
  captureFrames?: boolean;
  frameInterval?: number; // milliseconds between frames
}

export function useMediaCapture(options: UseMediaCaptureOptions = {}) {
  const {
    videoDuration = 5000,
    captureFrames = true,
    frameInterval = 500,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const framesRef = useRef<string[]>([]);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize camera and microphone
  const initializeMedia = useCallback(async (): Promise<boolean> => {
    try {
      // First check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera is not supported by this browser');
        return false;
      }

      // Detect iOS specifically
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // On iOS, check if permissions API is available and query camera status
      if (isIOS && navigator.permissions) {
        try {
          // Note: camera permission query may not be available on all browsers
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('[Media] iOS camera permission status:', cameraPermission.state);
          
          if (cameraPermission.state === 'denied') {
            setError('Camera access blocked. Go to Settings → Safari → Camera and allow access.');
            return false;
          }
        } catch (permErr) {
          // Permission query not supported, continue with getUserMedia
          console.log('[Media] Permission query not supported, proceeding with getUserMedia');
        }
      }
      
      // Request video with environment camera (back camera on mobile)
      // iOS Safari has specific requirements for camera constraints
      const videoConstraints: MediaTrackConstraints = isMobile
        ? isIOS 
          ? {
              // iOS works better with ideal rather than exact for facingMode
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { exact: 'environment' },
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
            }
        : {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          };

      let mediaStream: MediaStream;
      
      try {
        console.log('[Media] Requesting camera with constraints:', JSON.stringify(videoConstraints));
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (firstError: any) {
        console.warn('[Media] First camera attempt failed:', firstError?.name, firstError?.message);
        
        // Handle specific iOS errors
        if (firstError?.name === 'NotAllowedError') {
          if (isIOS) {
            setError('Camera access blocked. Go to Settings → Safari → Camera and change to "Allow" or "Ask".');
          } else {
            setError('Camera access blocked. Allow access in browser settings.');
          }
          return false;
        }
        
        if (firstError?.name === 'NotFoundError') {
          setError('Camera not found. Make sure your device has a camera.');
          return false;
        }
        
        // If exact facingMode fails, try without it (fallback for devices without back camera)
        console.log('[Media] Trying fallback camera constraints...');
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
        } catch (fallbackError: any) {
          console.error('[Media] Fallback camera also failed:', fallbackError?.name, fallbackError?.message);
          
          if (fallbackError?.name === 'NotAllowedError') {
            if (isIOS) {
              setError('Camera access blocked. Go to Settings → Safari → Camera and change to "Allow".');
            } else {
              setError('Camera access blocked.');
            }
          } else {
            setError(fallbackError?.message || 'Cannot access camera');
          }
          return false;
        }
      }

      console.log('[Media] Camera stream obtained successfully');
      setStream(mediaStream);
      setIsPermissionGranted(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Important for iOS: must set these attributes
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.muted = true;
        
        // iOS Safari requires load() before play() in some cases
        if (isIOS) {
          videoRef.current.load();
        }
        
        try {
          await videoRef.current.play();
          console.log('[Media] Video playback started');
        } catch (playError) {
          console.warn('[Media] Video autoplay failed, user interaction may be needed:', playError);
          // On iOS, we might need to set up a play on user interaction
        }
      }

      return true;
    } catch (err: any) {
      console.error('[Media] Initialization error:', err?.name, err?.message);
      
      // Provide iOS-specific error messages
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      let message: string;
      
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        message = isIOS 
          ? 'Camera access blocked. Go to iPhone Settings → Safari → Camera and allow access.'
          : 'Camera access blocked. Allow access and refresh the page.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        message = 'Camera not found.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        message = 'Camera is being used by another application. Close other apps and try again.';
      } else if (err?.name === 'OverconstrainedError') {
        message = 'Requested camera configuration is not supported.';
      } else if (err?.name === 'SecurityError') {
        message = 'Camera access requires HTTPS connection.';
      } else {
        message = err?.message || 'Cannot access camera/microphone';
      }
      
      setError(message);
      setIsPermissionGranted(false);
      return false;
    }
  }, []);

  // Capture a single frame from video
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<void> => {
    if (!stream) {
      throw new Error('Media stream not initialized');
    }

    setIsRecording(true);
    chunksRef.current = [];
    audioChunksRef.current = [];
    framesRef.current = [];

    // Detect platform for better MIME type selection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Video recorder (video + audio combined)
    // iOS Safari requires MP4 with proper codec specification
    let videoMimeType: string;
    if (isIOS || isSafari) {
      // Safari/iOS supports mp4 natively
      videoMimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
        ? 'video/mp4;codecs=avc1,mp4a.40.2'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : ''; // Let browser choose default
    } else {
      videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    }

    console.log('[Media] Recording with video MIME type:', videoMimeType || 'default');

    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: 2500000,
    };
    if (videoMimeType) {
      recorderOptions.mimeType = videoMimeType;
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
    } catch (recorderError) {
      console.warn('[Media] MediaRecorder creation failed with options, trying default:', recorderError);
      // Fallback: create without options
      mediaRecorderRef.current = new MediaRecorder(stream);
    }

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.start(100); // Collect data every 100ms

    // Separate audio recorder for acoustic analysis
    const audioStream = new MediaStream(stream.getAudioTracks());
    
    let audioMimeType: string;
    if (isIOS || isSafari) {
      audioMimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
    } else {
      audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    }

    console.log('[Media] Recording with audio MIME type:', audioMimeType || 'default');

    const audioRecorderOptions: MediaRecorderOptions = {
      audioBitsPerSecond: 128000,
    };
    if (audioMimeType) {
      audioRecorderOptions.mimeType = audioMimeType;
    }

    try {
      audioRecorderRef.current = new MediaRecorder(audioStream, audioRecorderOptions);
    } catch (audioRecorderError) {
      console.warn('[Media] Audio MediaRecorder creation failed, trying default:', audioRecorderError);
      audioRecorderRef.current = new MediaRecorder(audioStream);
    }

    audioRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    audioRecorderRef.current.start(100);

    // Capture frames periodically
    if (captureFrames) {
      frameIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          framesRef.current.push(frame);
        }
      }, frameInterval);
    }
  }, [stream, captureFrames, frameInterval, captureFrame]);

  // Stop recording and return captured media
  const stopRecording = useCallback((): Promise<MediaCapture> => {
    return new Promise((resolve) => {
      const startTime = Date.now();

      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;
      const audioRecorder = audioRecorderRef.current;

      let videoResolved = false;
      let audioResolved = false;
      let videoBlob: Blob | null = null;
      let audioBlob: Blob | null = null;

      const tryResolve = () => {
        if (videoResolved && audioResolved) {
          const duration = Date.now() - startTime;
          
          // Create thumbnail from first frame
          const thumbnail = framesRef.current[0] || captureFrame();

          resolve({
            video: videoBlob,
            videoDataUrl: null, // Will be set if needed
            videoDurationMs: duration,
            frames: framesRef.current,
            audio: audioBlob,
            audioDataUrl: null,
            audioDurationMs: duration,
            thumbnail,
          });

          setIsRecording(false);
        }
      };

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = () => {
          videoBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          videoResolved = true;
          tryResolve();
        };
        mediaRecorder.stop();
      } else {
        videoResolved = true;
        tryResolve();
      }

      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.onstop = () => {
          audioBlob = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType });
          audioResolved = true;
          tryResolve();
        };
        audioRecorder.stop();
      } else {
        audioResolved = true;
        tryResolve();
      }
    });
  }, [captureFrame]);

  // Capture for specified duration
  const captureForDuration = useCallback(async (): Promise<MediaCapture> => {
    await startRecording();
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await stopRecording();
        resolve(result);
      }, videoDuration);
    });
  }, [startRecording, stopRecording, videoDuration]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsRecording(false);
  }, [stream]);

  // Set video element ref
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && stream) {
      // Detect iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Set srcObject
      if (element.srcObject !== stream) {
        element.srcObject = stream;
        
        // iOS-specific attributes
        element.setAttribute('playsinline', 'true');
        element.setAttribute('webkit-playsinline', 'true');
        element.setAttribute('autoplay', 'true');
        element.muted = true;
        
        // iOS Safari requires load() before play() in some cases
        if (isIOS) {
          element.load();
        }
        
        console.log('[Media] Video element connected to stream');
        
        // Start playback
        element.play().catch((err) => {
          console.warn('[Media] Video play failed in setVideoElement:', err);
        });
      }
    }
  }, [stream]);

  // Set canvas element ref (for frame capture)
  const setCanvasElement = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element;
  }, []);

  return {
    isRecording,
    isPermissionGranted,
    error,
    stream,
    initializeMedia,
    startRecording,
    stopRecording,
    captureForDuration,
    captureFrame,
    cleanup,
    setVideoElement,
    setCanvasElement,
  };
}

// Audio analyzer for FFT-based drone detection
export function useAudioAnalyzer(stream: MediaStream | null) {
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initializeAnalyzer = useCallback(() => {
    if (!stream) return null;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    
    analyzerRef.current = analyser;
    audioContextRef.current = audioContext;
    
    return analyser;
  }, [stream]);

  // Get frequency data for FFT analysis
  const getFrequencyData = useCallback((): Float32Array | null => {
    if (!analyzerRef.current) return null;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyzerRef.current.getFloatFrequencyData(dataArray);
    
    return dataArray;
  }, []);

  // Detect drone-like audio signature
  // Drones typically have strong signatures in 100-400Hz (motor) and 2-8kHz (propeller)
  const detectDroneSignature = useCallback((): {
    isDroneSignature: boolean;
    confidence: number;
    frequencies: { low: number; mid: number; high: number };
  } => {
    const data = getFrequencyData();
    if (!data || !audioContextRef.current) {
      return { isDroneSignature: false, confidence: 0, frequencies: { low: 0, mid: 0, high: 0 } };
    }

    const sampleRate = audioContextRef.current.sampleRate;
    const binSize = sampleRate / 2048;

    // Calculate average power in drone-relevant frequency bands
    const getLevelInRange = (minHz: number, maxHz: number): number => {
      const minBin = Math.floor(minHz / binSize);
      const maxBin = Math.floor(maxHz / binSize);
      let sum = 0;
      let count = 0;
      
      for (let i = minBin; i <= maxBin && i < data.length; i++) {
        sum += Math.pow(10, data[i] / 20); // Convert dB to linear
        count++;
      }
      
      return count > 0 ? sum / count : 0;
    };

    const lowFreq = getLevelInRange(100, 400);   // Motor noise
    const midFreq = getLevelInRange(400, 2000);  // Motor harmonics
    const highFreq = getLevelInRange(2000, 8000); // Propeller noise

    // Drone signature: strong low + high, relatively weaker mid
    const droneRatio = (lowFreq + highFreq) / (midFreq + 0.001);
    const totalPower = lowFreq + midFreq + highFreq;
    
    // Confidence based on how "drone-like" the signature is
    let confidence = 0;
    if (droneRatio > 2 && totalPower > 0.01) {
      confidence = Math.min(100, droneRatio * 15);
    }

    const isDroneSignature = confidence > 50;

    return {
      isDroneSignature,
      confidence,
      frequencies: { low: lowFreq, mid: midFreq, high: highFreq },
    };
  }, [getFrequencyData]);

  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  return {
    initializeAnalyzer,
    getFrequencyData,
    detectDroneSignature,
    cleanup,
  };
}
