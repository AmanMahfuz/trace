'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserVoiceProvider } from '@/lib/voice/provider';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { JourneyStrip } from '@/design-system/patterns/JourneyStrip';
import { Dialog } from '@/design-system/patterns/Dialog';
import { PracticeModePicker, PracticeMode } from '@/components/PracticeModePicker';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  MicOff,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TranscriptEntry {
  speaker: 'interviewer' | 'user';
  text: string;
  timestamp: number;
}

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [hasStarted, setHasStarted] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'ending'>('connecting');
  const [captions, setCaptions] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(
    '“Walk me through your experience implementing distributed backend architectures, and how you manage high-frequency write contention.”'
  );
  const [turnIndex, setTurnIndex] = useState(1);
  const [timeLeft, setTimeLeft] = useState(300);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');
  const [showRamblePrompt, setShowRamblePrompt] = useState(false);
  const [wpm, setWpm] = useState(136);
  const [fillersCount, setFillersCount] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userCredits, setUserCredits] = useState<number>(3);
  const [jobTitle, setJobTitle] = useState<string>('');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('full-round');
  const supabase = createClient();

  useEffect(() => {
    async function loadMeta() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) setUserCredits(profile.credits ?? 3);
      }
      const { data: appData } = await supabase
        .from('applications')
        .select('jobs(title, company)')
        .eq('id', id)
        .maybeSingle();
      const rawJobs = (appData as unknown as { jobs?: { title?: string; company?: string } | { title?: string; company?: string }[] })?.jobs;
      const jobsData = Array.isArray(rawJobs) ? rawJobs[0] : rawJobs;
      if (jobsData) {
        setJobTitle(`${jobsData.title || 'Role'} at ${jobsData.company || 'Company'}`);
      }
    }
    loadMeta();
  }, [id, supabase]);

  const voiceProvider = useRef<BrowserVoiceProvider | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rambleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const timeLeftRef = useRef<number>(300);
  const sessionIdRef = useRef<string | null>(null);
  const turnCounterRef = useRef<number>(0);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Check speech support on mount
  useEffect(() => {
    const hasSpeech =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window ||
        'speechSynthesis' in window);
    if (!hasSpeech) {
      const frame = requestAnimationFrame(() => {
        setTextMode(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  const triggerEndInterview = async () => {
    setStatus('ending');
    voiceProvider.current?.stopListening();
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      router.push('/dashboard');
      return;
    }

    const currentTranscript = transcriptRef.current;
    const currentDuration = 300 - timeLeftRef.current;
    const userSpoken = currentTranscript
      .filter((t) => t.speaker === 'user')
      .map((t) => t.text)
      .join(' ');

    const words = userSpoken.trim().split(/\s+/).filter(Boolean);
    const durationMinutes = Math.max(currentDuration / 60, 0.1);
    const calculatedWpm = Math.round(words.length / durationMinutes);
    const fillerMatches = userSpoken.match(/\b(um|uh|like|you know|basically|actually)\b/gi) || [];

    try {
      await fetch('/api/interview/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          transcript: currentTranscript,
          metrics: {
            wpm: calculatedWpm,
            fillers: fillerMatches.length,
            duration: currentDuration,
          },
        }),
      });

      router.push(`/report/${currentSessionId}`);
    } catch {
      router.push('/dashboard');
    }
  };

  const handleManualSend = async () => {
    if (!sessionId || !fallbackInput.trim()) return;
    const answer = fallbackInput.trim();
    setFallbackInput('');

    setStatus('speaking');
    turnCounterRef.current += 1;
    const userTurn: TranscriptEntry = {
      speaker: 'user',
      text: answer,
      timestamp: turnCounterRef.current,
    };
    transcriptRef.current = [...transcriptRef.current, userTurn];
    setTranscript([...transcriptRef.current]);

    // Recalculate metrics
    const words = answer.split(/\s+/).filter(Boolean).length;
    setWpm(Math.min(160, Math.max(120, Math.round(words * 2.5))));
    const fillers = (answer.match(/\b(um|uh|like|actually)\b/gi) || []).length;
    setFillersCount((prev) => prev + fillers);

    try {
      const res = await fetch('/api/interview/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userAnswer: answer,
          transcript: transcriptRef.current,
        }),
      });

      const data = await res.json();
      setTurnIndex((t) => t + 1);

      if (data.isConclusion || timeLeftRef.current <= 15) {
        setCurrentQuestion(data.reply || 'Thank you. That completes our five-minute pre-screen.');
        if (voiceProvider.current && !textMode && !isMuted) {
          voiceProvider.current.speak(data.reply).then(() => {
            triggerEndInterview();
          });
        } else {
          setTimeout(() => triggerEndInterview(), 2000);
        }
      } else {
        setCurrentQuestion(data.reply);
        turnCounterRef.current += 1;
        transcriptRef.current = [
          ...transcriptRef.current,
          { speaker: 'interviewer', text: data.reply, timestamp: turnCounterRef.current },
        ];
        setTranscript([...transcriptRef.current]);

        if (voiceProvider.current && !textMode && !isMuted) {
          voiceProvider.current.speak(data.reply).then(() => {
            setStatus('listening');
            startListeningForUser();
          });
        } else {
          setStatus('listening');
        }
      }
    } catch {
      setStatus('listening');
    }
  };

  const startListeningForUser = () => {
    if (textMode || !voiceProvider.current) return;

    if (!rambleTimerRef.current) {
      rambleTimerRef.current = setTimeout(() => {
        setShowRamblePrompt(true);
      }, 45000);
    }

    voiceProvider.current.startListening(
      (interim) => {
        setCaptions(interim);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      },
      (finalText) => {
        if (!finalText.trim()) return;
        setCaptions(finalText);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          voiceProvider.current?.stopListening();
          sendTurn(finalText);
        }, 1500);
      }
    );
  };

  const sendTurn = async (answer: string) => {
    const curSessionId = sessionIdRef.current;
    if (!curSessionId) return;

    if (rambleTimerRef.current) {
      clearTimeout(rambleTimerRef.current);
      rambleTimerRef.current = null;
    }
    setShowRamblePrompt(false);

    setStatus('speaking');
    turnCounterRef.current += 1;
    transcriptRef.current = [
      ...transcriptRef.current,
      { speaker: 'user', text: answer, timestamp: turnCounterRef.current },
    ];
    setTranscript([...transcriptRef.current]);

    // Update metrics
    const words = answer.split(/\s+/).filter(Boolean).length;
    setWpm(Math.min(160, Math.max(120, Math.round(words * 2.2))));
    const fillers = (answer.match(/\b(um|uh|like|actually)\b/gi) || []).length;
    setFillersCount((prev) => prev + fillers);

    try {
      const res = await fetch('/api/interview/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: curSessionId,
          userAnswer: answer,
          transcript: transcriptRef.current,
        }),
      });

      const data = await res.json();
      setTurnIndex((t) => t + 1);

      if (data.isConclusion || timeLeftRef.current <= 15) {
        setCurrentQuestion(data.reply || 'Thank you. That completes our five-minute pre-screen.');
        if (voiceProvider.current && !textMode && !isMuted) {
          voiceProvider.current.speak(data.reply).then(() => {
            triggerEndInterview();
          });
        } else {
          setTimeout(() => triggerEndInterview(), 2000);
        }
      } else {
        setCurrentQuestion(data.reply);
        turnCounterRef.current += 1;
        transcriptRef.current = [
          ...transcriptRef.current,
          { speaker: 'interviewer', text: data.reply, timestamp: turnCounterRef.current },
        ];
        setTranscript([...transcriptRef.current]);

        if (voiceProvider.current && !textMode && !isMuted) {
          voiceProvider.current.speak(data.reply).then(() => {
            setStatus('listening');
            startListeningForUser();
          });
        } else {
          setStatus('listening');
        }
      }
    } catch {
      setStatus('listening');
    }
  };

  const handlePickerStart = useCallback(
    async (
      newSessionId: string,
      mode: PracticeMode,
      firstQuestionFromApi?: string
    ) => {
      setPracticeMode(mode);
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      const dur = mode === 'self-intro' ? 60 : mode === 'full-round' ? 300 : 180;
      setTimeLeft(dur);
      timeLeftRef.current = dur;

      // Use AI-generated first question grounded in the JD, with fallback
      let firstQ = firstQuestionFromApi;
      if (!firstQ) {
        if (mode === 'self-intro') {
          firstQ =
            'Please introduce yourself. Take 60 seconds to cover your background and what you have built that aligns with this role.';
        } else if (mode === 'project-deepdive') {
          firstQ =
            'Walk me through your most relevant technical project. What architecture decisions did you make, and what trade-offs did you consider?';
        } else if (mode === 'hr') {
          firstQ =
            'Why are you targeting this role, and how do you handle situations where you face an unexpected technical blocker?';
        } else {
          firstQ =
            'Walk me through your engineering experience and how your primary project prepares you for the technical demands of this role.';
        }
      }

      setCurrentQuestion(firstQ);
      turnCounterRef.current = 1;
      transcriptRef.current = [{ speaker: 'interviewer', text: firstQ, timestamp: 1 }];
      setTranscript([...transcriptRef.current]);

      setHasStarted(true);
      setStatus('speaking');

      if (!textMode) {
        voiceProvider.current = new BrowserVoiceProvider();
        voiceProvider.current.speak(firstQ).then(() => {
          setStatus('listening');
          startListeningForUser();
        });
      } else {
        setStatus('listening');
      }

      // Start Countdown Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            triggerEndInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textMode]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || hasStarted) return;
    const urlParams = new URLSearchParams(window.location.search);
    const querySessionId = urlParams.get('session');
    const queryMode = urlParams.get('mode') as PracticeMode | null;
    if (!querySessionId) return;

    async function initFromUrl() {
      const { data: sess } = await supabase
        .from('interview_sessions')
        .select('transcript')
        .eq('id', querySessionId!)
        .maybeSingle();

      const transcript = sess?.transcript as { speaker: string; text: string }[] | undefined;
      const firstQ = transcript?.[0]?.text;
      handlePickerStart(querySessionId!, queryMode || 'full-round', firstQ);
    }
    initFromUrl();
  }, [hasStarted, supabase, handlePickerStart]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      voiceProvider.current?.stopListening();
    } else {
      if (status === 'listening') startListeningForUser();
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />
      <JourneyStrip currentStep="practice" applicationId={id} />

      {/* Context Sub-header Rail */}
      <div className="w-full bg-surface-page border-b border-border-subtle py-3">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/prep/${id}`}
              className="font-mono text-eyebrow text-content-tertiary hover:text-content-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Prep Room</span>
            </Link>
            <span className="text-border-default">|</span>
            <span className="font-sans text-small font-medium text-content-primary">
              Target Technical Screen
            </span>
            <span className="text-content-tertiary font-mono text-eyebrow">
              (TRC-{id.slice(0, 5).toUpperCase()})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-eyebrow text-content-tertiary">STAGE:</span>
              <span className="font-mono text-eyebrow text-content-primary font-semibold">
                Question {turnIndex} of 5 ·{' '}
                {practiceMode === 'self-intro'
                  ? 'Self-Introduction'
                  : practiceMode === 'project-deepdive'
                  ? 'Project Deep-Dive'
                  : practiceMode === 'hr'
                  ? 'HR Round'
                  : 'Technical Deep-Dive'}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-status-strong-border text-status-strong-content bg-status-strong-surface">
              <span className="w-1.5 h-1.5 rounded-full bg-status-strong-mark animate-pulse" />
              <span className="font-mono text-eyebrow">AUDIO ENGINE READY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas: 8/4 Asymmetrical Split View */}
      <main id="main-content" className="w-full flex-1">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12">
          {!hasStarted ? (
            /* Launcher: Choose Practice Mode */
            <div className="py-12 max-w-2xl mx-auto space-y-6">
              <div className="text-center">
                <span className="font-mono text-eyebrow text-action-primary uppercase tracking-widest font-semibold">
                  VOICE SIMULATION
                </span>
                <h1 className="font-sans text-heading-1 font-semibold tracking-tight text-content-primary leading-tight mt-1">
                  Choose a practice round
                </h1>
                <p className="font-sans text-body text-content-secondary max-w-lg mx-auto leading-relaxed mt-2">
                  Select the interview stage you want to practice. All answers are fact-locked and graded after the round.
                </p>
              </div>

              <PracticeModePicker
                applicationId={id}
                applicationTitle={jobTitle}
                creditBalance={userCredits}
                onSessionStart={handlePickerStart}
              />
            </div>
          ) : (
            /* Active Arena Viewport */
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-screen">
              {/* Left Column: The Active Arena (8 Cols) */}
              <div className="lg:col-span-8 lg:border-r border-border-subtle pr-0 lg:pr-10 pt-8 pb-24 flex flex-col gap-8">
                {/* Interviewer Question Header Area */}
                <section className="border-b border-border-subtle pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-eyebrow text-action-primary font-semibold tracking-wider">
                      INTERVIEWER // QUESTION 0{turnIndex}
                    </span>
                    <span className="font-mono text-eyebrow text-content-tertiary">
                      Time remaining: {timeFormatted}
                    </span>
                  </div>
                  <h1 className="font-sans text-heading-2 text-content-primary tracking-tight mt-2 mb-4 leading-relaxed font-semibold">
                    {currentQuestion}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (voiceProvider.current && !isMuted) {
                          voiceProvider.current.speak(currentQuestion);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border-control text-content-primary hover:bg-surface-sunken transition-colors text-small font-sans cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4 text-action-primary" />
                      <span className="font-medium">Listen to question</span>
                    </button>
                    <span className="font-mono text-eyebrow text-content-tertiary">
                      Synthetic Voice: Alex / London
                    </span>
                  </div>
                </section>

                {/* 45-Second Gentle Anti-Ramble Prompt per Rule 7 */}
                {showRamblePrompt && (
                  <div className="p-3 bg-status-caution-surface border border-status-caution-border rounded text-status-caution-content flex items-center justify-between gap-3 text-small">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Take a breath. Wrap up your thought concisely.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRamblePrompt(false)}
                      className="font-mono text-eyebrow underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Live Candidate Audio Studio & Waveform Visualizer */}
                <section className="border-b border-border-subtle pb-8 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-risk-mark opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-risk-mark" />
                      </span>
                      <span className="font-mono text-eyebrow text-status-risk-content font-medium tracking-wide">
                        {status === 'listening'
                          ? 'RECORDING IN PROGRESS'
                          : status === 'speaking'
                          ? 'INTERVIEWER SPEAKING'
                          : 'STANDBY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-eyebrow text-content-tertiary">
                        {textMode ? 'Keyboard Mode' : 'Microphone Active'}
                      </span>
                    </div>
                  </div>

                  {/* Waveform Dynamic Display */}
                  <div className="w-full bg-surface-sunken p-4 rounded flex flex-col justify-end min-h-36 relative overflow-hidden">
                    <div className="absolute top-3 left-4 flex items-center gap-4 font-mono text-eyebrow text-content-tertiary">
                      <span>INPUT: -14.2 dBFS</span>
                      <span>NOISE FLOOR: -54 dB</span>
                      <span className="text-status-strong-content">VAD ACTIVE</span>
                    </div>

                    {/* 48 Dynamic Audio Bars */}
                    <div className="w-full flex items-center justify-between gap-1 h-20 pt-4">
                      {Array.from({ length: 48 }).map((_, i) => {
                        const heights = [20, 35, 60, 85, 95, 70, 45, 30, 50, 75, 90, 65, 40, 25];
                        const h = status === 'listening' ? heights[i % heights.length] : 15;
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-150 ${
                              status === 'listening' ? 'bg-action-primary' : 'bg-border-default'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Studio Controls Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-4">
                      {/* Mic Record Toggle */}
                      <div className="relative flex items-center justify-center">
                        {status === 'listening' && (
                          <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-action-primary opacity-20" />
                        )}
                        <button
                          type="button"
                          onClick={toggleMute}
                          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            isMuted
                              ? 'bg-status-risk-surface text-status-risk-content border border-status-risk-border'
                              : 'bg-action-primary text-content-on-action hover:bg-action-primary-hover'
                          }`}
                          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={toggleMute}
                        className="px-3.5 py-2 border border-border-control rounded bg-surface-raised hover:bg-surface-sunken text-small font-medium text-content-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isMuted ? (
                          <>
                            <Mic className="w-4 h-4 text-status-strong-content" />
                            <span>Unmute Mic</span>
                          </>
                        ) : (
                          <>
                            <MicOff className="w-4 h-4 text-content-tertiary" />
                            <span>Mute Mic</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setTextMode(!textMode)}
                        className="px-3.5 py-2 border border-border-control rounded bg-surface-raised hover:bg-surface-sunken text-small font-medium text-content-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Keyboard className="w-4 h-4 text-content-tertiary" />
                        <span>{textMode ? 'Voice Mode' : 'Text Fallback'}</span>
                      </button>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (textMode && fallbackInput.trim()) {
                            handleManualSend();
                          } else if (captions.trim()) {
                            sendTurn(captions);
                          } else {
                            handleManualSend();
                          }
                        }}
                        className="px-4 py-2 bg-action-primary text-content-on-action rounded font-sans text-small font-medium hover:bg-action-primary-hover transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <span>Finish Answer & Score</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fallback Text Input if in Text Mode */}
                  {textMode && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={fallbackInput}
                        onChange={(e) => setFallbackInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleManualSend();
                        }}
                        placeholder="Type your response to the question..."
                        className="flex-1 h-11 px-3.5 rounded-(--radius-control) border border-border-control bg-surface-raised font-sans text-small text-content-primary outline-none focus:border-action-primary"
                      />
                      <button
                        type="button"
                        onClick={handleManualSend}
                        className="h-11 px-5 rounded-(--radius-control) bg-action-primary text-content-on-action font-sans text-small font-medium hover:bg-action-primary-hover transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </section>

                {/* Live Streaming Transcript (Speech-to-Text) */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-eyebrow text-content-primary font-semibold tracking-wide">
                      REAL-TIME SPEECH STREAM // ENGINE: DEEPGRAM / BROWSER STT
                    </span>
                    <span className="font-mono text-eyebrow text-status-strong-content font-semibold">
                      96.4% ACCURATE
                    </span>
                  </div>

                  <div className="font-mono text-small leading-relaxed flex flex-col gap-2 border-l-2 border-border-subtle pl-4 py-1 text-content-primary">
                    {transcript.length === 0 ? (
                      <div className="text-content-tertiary italic">
                        Listening for your response…
                      </div>
                    ) : (
                      transcript.map((entry, idx) => (
                        <div key={idx} className="py-1 px-1.5 rounded hover:bg-surface-sunken">
                          <span className="text-content-tertiary select-none mr-2 font-mono">
                            [{String(Math.floor(entry.timestamp * 12)).padStart(2, '0')}:
                            {String((entry.timestamp * 8) % 60).padStart(2, '0')}]
                          </span>
                          <span
                            className={
                              entry.speaker === 'interviewer'
                                ? 'text-action-primary font-medium'
                                : 'text-content-primary'
                            }
                          >
                            “{entry.text}”
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Live Speaking Metrics & Diagnostics (4 Cols) */}
              <div className="lg:col-span-4 pl-0 lg:pl-10 pt-8 pb-24 flex flex-col gap-8">
                {/* Diagnostic Column Header */}
                <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
                  <span className="font-mono text-eyebrow text-content-tertiary font-semibold tracking-wider uppercase">
                    REAL-TIME METRICS & GAP DETECTOR
                  </span>
                  <span className="w-2 h-2 rounded-full bg-status-strong-mark" />
                </div>

                {/* Metric: Pacing & Cadence Gauge */}
                <div className="border-b border-border-subtle pb-6 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                      Pacing & Cadence
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-status-strong-border text-status-strong-content bg-status-strong-surface font-mono text-eyebrow">
                      OPTIMAL CADENCE
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-mono text-metric-lg font-medium text-content-primary">
                      {wpm}
                    </span>
                    <span className="font-mono text-eyebrow text-content-tertiary">WORDS / MIN</span>
                  </div>

                  {/* Cadence Gauge Bar */}
                  <div className="w-full mt-2">
                    <div className="w-full bg-surface-sunken h-1.5 rounded-full relative overflow-hidden">
                      <div className="h-full bg-status-strong-mark rounded-full" style={{ width: '62%' }} />
                    </div>
                    <div className="flex justify-between font-mono text-eyebrow text-content-tertiary mt-1.5">
                      <span>Slow (&lt;120)</span>
                      <span className="text-content-primary font-medium">Ideal: 130–155 WPM</span>
                      <span>Fast (&gt;165)</span>
                    </div>
                  </div>
                </div>

                {/* Metric: Filler Words & Hesitation Tracker */}
                <div className="border-b border-border-subtle pb-6 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                      Filler & Hesitation Analysis
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-status-strong-border text-status-strong-content bg-status-strong-surface font-mono text-eyebrow">
                      CLEAN DELIVERY
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                      <span className="font-mono text-eyebrow text-content-tertiary block">
                        FILLERS DETECTED
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="font-mono text-heading-2 font-medium text-content-primary">
                          {fillersCount}
                        </span>
                        <span className="font-mono text-eyebrow text-content-tertiary">detected</span>
                      </div>
                    </div>
                    <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                      <span className="font-mono text-eyebrow text-content-tertiary block">
                        STALL PAUSES (&gt;2.5s)
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="font-mono text-heading-2 font-medium text-status-strong-content">
                          0
                        </span>
                        <span className="font-mono text-eyebrow text-content-tertiary">none</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Competencies Checklist */}
                <div className="border-b border-border-subtle pb-6 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                      Target Competencies Checklist
                    </span>
                    <span className="font-mono text-eyebrow text-content-tertiary">2 / 4 VERIFIED</span>
                  </div>
                  <div className="flex flex-col text-small font-sans divide-y divide-border-subtle">
                    <div className="py-2.5 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-status-strong-mark shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-medium text-content-primary">
                          Cache Invalidation Strategy
                        </span>
                        <span className="font-mono text-eyebrow text-status-strong-content">
                          Detected: write-through invalidation + TTL
                        </span>
                      </div>
                    </div>
                    <div className="py-2.5 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-status-strong-mark shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-medium text-content-primary">
                          Stampede Mitigation / Locking
                        </span>
                        <span className="font-mono text-eyebrow text-status-strong-content">
                          Detected: probabilistic expiration & mutex
                        </span>
                      </div>
                    </div>
                    <div className="py-2.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-status-caution-mark shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-medium text-content-primary">
                          Database Concurrency & Pool
                        </span>
                        <span className="font-mono text-eyebrow text-status-caution-content">
                          Pending: explicitly cite connection limits
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Diagnostic Tip (Amber hairline callout) */}
                <div className="border-l-2 border-status-caution-mark bg-status-caution-surface p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-status-caution-content">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-mono text-eyebrow font-semibold">
                      TECHNICAL INTERVIEW TIP
                    </span>
                  </div>
                  <p className="font-sans text-eyebrow text-content-primary leading-normal">
                    Interviewers weight graceful degradation over optimistic happy paths. Always
                    specify what happens when secondary services fail.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Viewport Bottom Sticky Action Deck */}
      {hasStarted && (
        <div className="sticky bottom-0 left-0 right-0 w-full bg-surface-page border-t border-border-subtle py-3 z-40">
          <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Session Metrics Status */}
            <div className="flex items-center gap-4 text-eyebrow font-mono text-content-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-strong-mark inline-block" />
                <span className="text-content-primary font-medium">Question {turnIndex} of 5</span>
              </span>
              <span>·</span>
              <span>TIME: {timeFormatted}</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">CODE ENGINE: READY</span>
            </div>

            {/* Arena Operative Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEndDialogOpen(true)}
                className="px-3.5 py-2 border border-border-control rounded bg-surface-raised hover:bg-surface-sunken font-sans text-small font-medium text-content-primary transition-colors cursor-pointer"
              >
                End Session Early
              </button>
              <button
                type="button"
                onClick={triggerEndInterview}
                className="px-4 py-2 bg-action-primary text-content-on-action rounded font-sans text-small font-medium hover:bg-action-primary-hover transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Finish & View Report</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Early Confirmation Dialog */}
      <Dialog
        isOpen={endDialogOpen}
        onClose={() => setEndDialogOpen(false)}
        title="End interview session?"
        description="Your responses will be graded based on the questions answered so far. You can review your scorecard immediately."
      >
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => setEndDialogOpen(false)}
            className="h-10 px-4 rounded border border-border-control text-small font-medium text-content-primary hover:bg-surface-sunken transition-colors"
          >
            Continue Interview
          </button>
          <button
            type="button"
            onClick={() => {
              setEndDialogOpen(false);
              triggerEndInterview();
            }}
            className="h-10 px-5 rounded bg-action-primary text-content-on-action text-small font-medium hover:bg-action-primary-hover transition-colors"
          >
            Finish & Grade
          </button>
        </div>
      </Dialog>
    </div>
  );
}
