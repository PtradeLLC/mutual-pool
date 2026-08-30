import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, X, ChevronDown, 
  Send, RefreshCw, Compass, ArrowRight, Play, Square,
  Sliders
} from 'lucide-react';
import { 
  getAnalyser, 
  base64PcmToAudioBuffer, 
  playGeminiAudioBuffer, 
  speakWithBrowserSpeech, 
  stopCurrentAudio 
} from '../utils/audioPlayer';
import { User } from '../types';
import { useTranslation } from '../i18n';

export interface VoiceAgentProps {
  currentUser: User | null;
  activeTab: string;
  onNavigateTab: (tab: 'my-pods' | 'explore-pods' | 'perks' | 'campaigns' | 'audit-log' | 'admin-ops') => void;
  onOpenCreatePod: () => void;
  onOpenKyc: () => void;
  onOpenBank: () => void;
  onOpenHardship: () => void;
  onOpenAbout: () => void;
  onOpenHowItWorks: () => void;
  onOpenContact: () => void;
  onOpenAdvertiser: () => void;
  onOpenFaq?: (category?: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  spokenText: string;
  displayText: string;
  timestamp: string;
  suggestedActions?: Array<{
    label: string;
    action: 'NAVIGATE_TAB' | 'OPEN_MODAL' | 'SPEAK_EXPLANATION';
    tab?: string;
    modal?: string;
    prompt?: string;
  }>;
  navigationAction?: {
    type: string;
    target?: string;
  } | null;
}

const VOICE_OPTIONS = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Warm & friendly' },
  { id: 'Kore', name: 'Kore', description: 'Calm & reassuring' },
  { id: 'Puck', name: 'Puck', description: 'Upbeat & energetic' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Deep & confident' },
  { id: 'Charon', name: 'Charon', description: 'Clear & professional' },
];

export const VoiceAgent: React.FC<VoiceAgentProps> = ({
  currentUser,
  activeTab,
  onNavigateTab,
  onOpenCreatePod,
  onOpenKyc,
  onOpenBank,
  onOpenHardship,
  onOpenAbout,
  onOpenHowItWorks,
  onOpenContact,
  onOpenAdvertiser,
  onOpenFaq,
}) => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_1',
      sender: 'agent',
      spokenText: t('voiceAgent.welcomeSpoken'),
      displayText: t('voiceAgent.welcomeDisplay'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        { label: t('voiceAgent.q1Label'), action: 'SPEAK_EXPLANATION', prompt: t('voiceAgent.q1Query') },
        { label: t('voiceAgent.q7Label') || '3% Host Rewards', action: 'SPEAK_EXPLANATION', prompt: t('voiceAgent.q7Query') || 'How does the 3% Creator Host Stewardship Reward work?' },
        { label: t('voiceAgent.browseFaq') || 'Browse Full FAQ', action: 'OPEN_MODAL', modal: 'FAQ' },
      ],
    },
  ]);

  // Update initial welcome message when language changes if no interaction has occurred
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome_1') {
        return [
          {
            id: 'welcome_1',
            sender: 'agent',
            spokenText: t('voiceAgent.welcomeSpoken'),
            displayText: t('voiceAgent.welcomeDisplay'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedActions: [
              { label: t('voiceAgent.q1Label'), action: 'SPEAK_EXPLANATION', prompt: t('voiceAgent.q1Query') },
              { label: t('voiceAgent.q7Label') || '3% Host Rewards', action: 'SPEAK_EXPLANATION', prompt: t('voiceAgent.q7Query') || 'How does the 3% Creator Host Stewardship Reward work?' },
              { label: t('voiceAgent.browseFaq') || 'Browse Full FAQ', action: 'OPEN_MODAL', modal: 'FAQ' },
            ],
          },
        ];
      }
      return prev;
    });
  }, [language, t]);

  const guidedQuestions = [
    { label: t('voiceAgent.q1Label'), query: t('voiceAgent.q1Query') },
    { label: t('voiceAgent.q7Label'), query: t('voiceAgent.q7Query') },
    { label: t('voiceAgent.q8Label'), query: t('voiceAgent.q8Query') },
    { label: t('voiceAgent.q9Label'), query: t('voiceAgent.q9Query') },
    { label: t('voiceAgent.q10Label'), query: t('voiceAgent.q10Query') },
    { label: t('voiceAgent.q11Label'), query: t('voiceAgent.q11Query') },
    { label: t('voiceAgent.q6Label'), query: t('voiceAgent.q6Query') },
    { label: t('voiceAgent.q2Label'), query: t('voiceAgent.q2Query') },
    { label: t('voiceAgent.q3Label'), query: t('voiceAgent.q3Query') },
    { label: t('voiceAgent.q4Label'), query: t('voiceAgent.q4Query') },
    { label: t('voiceAgent.q5Label'), query: t('voiceAgent.q5Query') },
  ];

  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Global event listener to open Voice Agent from other components (like FAQ modal)
  useEffect(() => {
    const handleOpenVoice = (e: any) => {
      setIsOpen(true);
      setIsMinimized(false);
      if (e?.detail?.prompt) {
        handleSendQuery(e.detail.prompt);
      }
    };
    window.addEventListener('open-voice-agent', handleOpenVoice);
    return () => window.removeEventListener('open-voice-agent', handleOpenVoice);
  }, []);

  // Audio Visualizer Loop
  const renderVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    let analyser: AnalyserNode | null = null;
    try {
      analyser = getAnalyser();
    } catch {}

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);
    if (analyser && (isSpeaking || isListening)) {
      analyser.getByteFrequencyData(dataArray);
    }

    const barCount = 24;
    const barWidth = (width / barCount) - 3;
    const centerY = height / 2;

    for (let i = 0; i < barCount; i++) {
      let value = 0;
      if (isSpeaking) {
        // Frequency data or synthetic gentle wave
        const freqVal = dataArray[i % bufferLength] || 0;
        value = Math.max(12, (freqVal / 255) * (height * 0.85));
      } else if (isListening) {
        // Listening pulse
        const time = Date.now() / 200;
        const wave = Math.sin(time + i * 0.4);
        value = 8 + Math.abs(wave) * 22;
      } else if (isThinking) {
        // Thinking shimmer
        const time = Date.now() / 150;
        const wave = Math.sin(time + i * 0.3);
        value = 6 + Math.abs(wave) * 14;
      } else {
        // Idle gentle breathing
        const time = Date.now() / 600;
        value = 4 + Math.sin(time + i * 0.2) * 3;
      }

      const x = i * (barWidth + 3) + 2;
      const barHeight = Math.max(4, value);
      const y = centerY - barHeight / 2;

      // Color gradients based on state
      let fillStyle = '#94A3B8';
      if (isSpeaking) {
        fillStyle = '#005FB8'; // Brand primary blue
      } else if (isListening) {
        fillStyle = '#10B981'; // Emerald recording
      } else if (isThinking) {
        fillStyle = '#8B5CF6'; // Purple thinking
      }

      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 3);
      ctx.fill();
    }

    animationFrameRef.current = requestAnimationFrame(renderVisualizer);
  }, [isSpeaking, isListening, isThinking]);

  useEffect(() => {
    if (isOpen) {
      renderVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, renderVisualizer]);

  // Execute in-app navigation requested by AI
  const executeNavigation = useCallback((action: { type: string; target?: string }) => {
    if (!action) return;
    if (action.type === 'NAVIGATE_TAB' && action.target) {
      onNavigateTab(action.target as any);
    } else if (action.type === 'OPEN_MODAL' && action.target) {
      if (action.target === 'CREATE_POD') onOpenCreatePod();
      else if (action.target === 'KYC') onOpenKyc();
      else if (action.target === 'BANK') onOpenBank();
      else if (action.target === 'HARDSHIP') onOpenHardship();
      else if (action.target === 'ABOUT') onOpenAbout();
      else if (action.target === 'HOW_IT_WORKS') onOpenHowItWorks();
      else if (action.target === 'CONTACT') onOpenContact();
      else if (action.target === 'FAQ') onOpenFaq?.();
    } else if (action.type === 'OPEN_ADVERTISER') {
      onOpenAdvertiser();
    }
  }, [onNavigateTab, onOpenCreatePod, onOpenKyc, onOpenBank, onOpenHardship, onOpenAbout, onOpenHowItWorks, onOpenContact, onOpenAdvertiser, onOpenFaq]);

  // Natural TTS audio playback
  const playResponseAudio = useCallback(async (spokenText: string) => {
    if (!autoSpeak || !spokenText) return;
    setIsSpeaking(true);

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          voiceName: selectedVoice,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.audioBase64) {
        const audioBuffer = base64PcmToAudioBuffer(data.audioBase64, data.sampleRate || 24000);
        playGeminiAudioBuffer(audioBuffer, () => {
          setIsSpeaking(false);
        });
      } else {
        // Fallback to Web Speech Synthesis
        speakWithBrowserSpeech(spokenText, selectedVoice, () => {
          setIsSpeaking(false);
        });
      }
    } catch {
      speakWithBrowserSpeech(spokenText, selectedVoice, () => {
        setIsSpeaking(false);
      });
    }
  }, [autoSpeak, selectedVoice]);

  // Send query to Voice Guide backend
  const handleSendQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    // Stop ongoing audio
    stopCurrentAudio();
    setIsSpeaking(false);
    if (isListening) {
      stopListening();
    }

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      spokenText: trimmed,
      displayText: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/voice-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          currentContext: {
            activeTab,
            isUserLoggedIn: !!currentUser,
            userName: currentUser?.displayName || 'Member',
            platform: currentUser?.platform || 'DoorDash',
            treasuryBalance: currentUser?.treasury?.balanceUsd ?? 0,
            activePodsCount: currentUser?.completedPodsCount ?? 0,
            language,
          },
        }),
      });

      const data = await res.json();
      setIsThinking(false);

      const agentMsg: Message = {
        id: `agent_${Date.now()}`,
        sender: 'agent',
        spokenText: data.spokenText || data.displayText || 'Here is what I found.',
        displayText: data.displayText || data.spokenText || 'Here is the guide.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: data.suggestedActions,
        navigationAction: data.navigationAction,
      };

      setMessages(prev => [...prev, agentMsg]);

      // Play natural voice
      if (data.spokenText) {
        playResponseAudio(data.spokenText);
      }

      // Auto-trigger navigation if explicitly directed
      if (data.navigationAction) {
        executeNavigation(data.navigationAction);
      }
    } catch (err) {
      console.error('Error communicating with Voice AI:', err);
      setIsThinking(false);
      const errorMsg: Message = {
        id: `agent_${Date.now()}`,
        sender: 'agent',
        spokenText: t('voiceAgent.connectionErrorSpoken'),
        displayText: `### ⚠️ ${t('voiceAgent.connectionErrorTitle')}\n\n${t('voiceAgent.connectionErrorDesc')}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: [
          { label: t('voiceAgent.explorePods'), action: 'NAVIGATE_TAB', tab: 'explore-pods' },
          { label: t('voiceAgent.browsePerks'), action: 'NAVIGATE_TAB', tab: 'perks' },
        ],
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  // Speech Recognition Handling
  const startListening = () => {
    stopCurrentAudio();
    setIsSpeaking(false);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert(t('voiceAgent.speechNotSupported'));
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-FR' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
        if (event.results[0].isFinal) {
          handleSendQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Could not start recognition:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleStopSpeaking = () => {
    stopCurrentAudio();
    setIsSpeaking(false);
  };

  return (
    <>
      {/* Floating Trigger Button in bottom-right */}
      {!isOpen && (
        <div id="voice-agent-trigger-container" className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200 text-xs font-semibold text-slate-700 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-[#005FB8]" />
            <span>{t('voiceAgent.triggerOnline')}</span>
          </div>

          <button
            id="voice-agent-open-btn"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            aria-label={t('voiceAgent.triggerAria')}
            className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#005FB8] to-[#2563EB] text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 ring-4 ring-[#005FB8]/20 focus:outline-none"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping pointer-events-none opacity-40 group-hover:opacity-60" />
            <Mic className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
          </button>
        </div>
      )}

      {/* Expanded Voice Agent Assistant Panel */}
      {isOpen && (
        <div 
          id="voice-agent-panel" 
          className={`fixed z-50 transition-all duration-300 ${
            isMinimized 
              ? 'bottom-6 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4' 
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] max-h-[85vh] h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#005FB8] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5 text-sky-300" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                  isSpeaking ? 'bg-[#005FB8] animate-ping' : isListening ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white tracking-wide">{t('voiceAgent.assistantName')}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-sky-200 font-medium">
                    {isSpeaking ? t('voiceAgent.statusSpeaking') : isListening ? t('voiceAgent.statusListening') : isThinking ? t('voiceAgent.statusThinking') : t('voiceAgent.statusReady')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{t('voiceAgent.guideSubtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="voice-agent-settings-btn"
                onClick={() => setShowSettings(!showSettings)}
                title={t('voiceAgent.settingsTitle')}
                className={`p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors ${showSettings ? 'bg-white/20 text-white' : ''}`}
              >
                <Sliders className="w-4 h-4" />
              </button>

              <button
                id="voice-agent-toggle-mute-btn"
                onClick={() => {
                  if (isSpeaking) handleStopSpeaking();
                  setAutoSpeak(!autoSpeak);
                }}
                title={autoSpeak ? t('voiceAgent.muteBtn') : t('voiceAgent.replayAudio')}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {autoSpeak ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </button>

              <button
                id="voice-agent-minimize-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`} />
              </button>

              <button
                id="voice-agent-close-btn"
                onClick={() => {
                  stopCurrentAudio();
                  stopListening();
                  setIsOpen(false);
                }}
                title="Close"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Minimized View Body */}
          {isMinimized ? (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <canvas ref={canvasRef} width={120} height={28} className="rounded-md" />
                <span>{isSpeaking ? t('voiceAgent.statusSpeaking') : isListening ? t('voiceAgent.statusListening') : t('voiceAgent.minimizedActive')}</span>
              </div>
              <button
                onClick={handleToggleListening}
                className={`p-2 rounded-full text-white ${isListening ? 'bg-rose-500 animate-pulse' : 'bg-[#005FB8]'}`}
              >
                {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <>
              {/* Settings Dropdown Drawer */}
              {showSettings && (
                <div className="bg-slate-50 border-b border-slate-200 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">{t('voiceAgent.settingsTitle')}</span>
                    <span className="text-slate-500 text-[11px]">{t('voiceAgent.settingsEngine')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {VOICE_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        className={`p-2 rounded-lg text-left border transition-all ${
                          selectedVoice === v.id
                            ? 'bg-[#005FB8] text-white border-[#005FB8] font-semibold shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-semibold">{v.name}</div>
                        <div className={`text-[10px] truncate ${selectedVoice === v.id ? 'text-sky-100' : 'text-slate-500'}`}>
                          {v.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoSpeak}
                        onChange={(e) => setAutoSpeak(e.target.checked)}
                        className="rounded text-[#005FB8] focus:ring-[#005FB8]"
                      />
                      <span>{t('voiceAgent.autoSpeakLabel')}</span>
                    </label>

                    {isSpeaking && (
                      <button
                        onClick={handleStopSpeaking}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                      >
                        <Square className="w-3 h-3" />
                        <span>{t('voiceAgent.stopVoiceBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Real-time Waveform Canvas & Status bar */}
              <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <canvas ref={canvasRef} width={180} height={28} className="rounded" />
                  <span className="text-[11px] font-medium text-slate-300">
                    {isSpeaking ? t('voiceAgent.statusStreamingAudio') : isListening ? t('voiceAgent.statusListeningMic') : isThinking ? t('voiceAgent.statusAnalyzing') : t('voiceAgent.statusReadyQuestion')}
                  </span>
                </div>

                {isSpeaking && (
                  <button
                    onClick={handleStopSpeaking}
                    className="text-[11px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 flex items-center gap-1"
                  >
                    <Square className="w-3 h-3" />
                    <span>{t('voiceAgent.muteBtn')}</span>
                  </button>
                )}
              </div>

              {/* Chat & Transcript Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#005FB8] text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-line prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1 prose-headings:text-slate-900 font-sans">
                        {msg.displayText}
                      </div>

                      {msg.sender === 'agent' && msg.spokenText && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                          <button
                            onClick={() => playResponseAudio(msg.spokenText)}
                            className="flex items-center gap-1 text-[11px] font-medium text-[#005FB8] hover:text-[#004A94] bg-sky-50 px-2 py-0.5 rounded-full"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t('voiceAgent.replayAudio')}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Suggested Action Chips */}
                    {msg.sender === 'agent' && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                        {msg.suggestedActions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (action.action === 'NAVIGATE_TAB' && action.tab) {
                                onNavigateTab(action.tab as any);
                              } else if (action.action === 'OPEN_MODAL') {
                                executeNavigation({ type: 'OPEN_MODAL', target: action.modal });
                              } else if (action.prompt) {
                                handleSendQuery(action.prompt);
                              }
                            }}
                            className="text-[11px] font-medium px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-[#005FB8] hover:text-[#005FB8] hover:bg-sky-50 text-slate-700 shadow-2xs transition-all flex items-center gap-1"
                          >
                            <span>{action.label}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs w-44">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#005FB8]" />
                    <span>{t('voiceAgent.thinkingName')}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Guided Topics Accordion/Chips */}
              <div className="bg-white border-t border-slate-200 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-[#005FB8]" />
                  <span>{t('voiceAgent.popularGuides')}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {guidedQuestions.map((gq, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendQuery(gq.query)}
                      className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                    >
                      {gq.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Input Controls */}
              <div className="p-3 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendQuery(inputText);
                  }}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    id="voice-agent-mic-btn"
                    onClick={handleToggleListening}
                    title={isListening ? t('voiceAgent.stopVoiceBtn') : t('voiceAgent.triggerAria')}
                    className={`relative p-3 rounded-2xl font-semibold flex items-center justify-center transition-all shadow-md ${
                      isListening
                        ? 'bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse'
                        : 'bg-[#005FB8] text-white hover:bg-[#004A94]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={isListening ? t('voiceAgent.listeningPlaceholder') : t('voiceAgent.inputPlaceholder')}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:bg-white transition-all"
                    />
                    {inputText.trim() && (
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#005FB8] hover:bg-sky-50 rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
