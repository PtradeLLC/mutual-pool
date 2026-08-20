// Audio playback utilities for Gemini TTS base64 PCM and Web Speech API fallback

let audioCtx: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass({ sampleRate: 24000 });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function getAnalyser(): AnalyserNode {
  const ctx = getAudioContext();
  if (!analyserNode) {
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 64;
    analyserNode.smoothingTimeConstant = 0.8;
  }
  return analyserNode;
}

// Convert base64 PCM 16-bit LE (24kHz, 1 channel) into AudioBuffer
export function base64PcmToAudioBuffer(base64Data: string, sampleRate = 24000): AudioBuffer {
  const ctx = getAudioContext();
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }

  const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
  audioBuffer.copyToChannel(float32Array, 0, 0);
  return audioBuffer;
}

export function stopCurrentAudio() {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {
      // ignore
    }
    currentSourceNode = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function playGeminiAudioBuffer(
  audioBuffer: AudioBuffer,
  onEnded?: () => void
): () => void {
  stopCurrentAudio();
  const ctx = getAudioContext();
  const analyser = getAnalyser();

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(ctx.destination);

  currentSourceNode = source;

  source.onended = () => {
    if (currentSourceNode === source) {
      currentSourceNode = null;
    }
    if (onEnded) onEnded();
  };

  source.start(0);

  return () => {
    try {
      source.stop();
      source.disconnect();
    } catch {}
  };
}

export function speakWithBrowserSpeech(
  text: string,
  voiceName?: string,
  onEnded?: () => void
): () => void {
  stopCurrentAudio();
  if (!('speechSynthesis' in window)) {
    if (onEnded) onEnded();
    return () => {};
  }

  const cleanText = text.replace(/[*_#`~\[\]]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    // Prefer natural English voices
    const preferred = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Victoria'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) {
      utterance.voice = preferred;
    }
  }

  utterance.onend = () => {
    if (onEnded) onEnded();
  };
  utterance.onerror = () => {
    if (onEnded) onEnded();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}
