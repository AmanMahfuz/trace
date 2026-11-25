'use client';

import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Field';

export interface VoiceStageProps {
  status: 'connecting' | 'listening' | 'speaking' | 'ending';
  captions: string;
  prevCaptions?: string;
  turnIndex: number;
  textMode: boolean;
  fallbackInput: string;
  onFallbackInputChange: (val: string) => void;
  onFallbackSend: () => void;
  className?: string;
}

export function VoiceStage({
  status,
  captions,
  prevCaptions,
  turnIndex,
  textMode,
  fallbackInput,
  onFallbackInputChange,
  onFallbackSend,
  className = '',
}: VoiceStageProps) {
  return (
    <main className={`max-w-(--size-reading-max) mx-auto w-full py-12 flex flex-col items-center justify-center space-y-8 text-center ${className}`}>
      {/* 32 waveform vertical bars */}
      <div
        className="flex items-center justify-center gap-1.5 h-36 w-full"
        aria-hidden="true"
      >
        {Array.from({ length: 32 }).map((_, i) => {
          const isSpeaking = status === 'speaking';
          const isListening = status === 'listening';
          const barHeight = isSpeaking
            ? ((i * 7) % 70) + 30
            : isListening
            ? ((i * 11) % 60) + 20
            : 8;

          return (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-transform duration-fast ${
                isSpeaking
                  ? 'bg-content-primary'
                  : isListening
                  ? 'bg-action-primary'
                  : 'bg-border-default'
              }`}
              style={{
                height: `${barHeight}%`,
                transform: 'scaleY(1)',
              }}
            />
          );
        })}
      </div>

      {/* Status line */}
      <div className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary" aria-live="polite">
        {status === 'speaking'
          ? 'Interviewer is speaking…'
          : status === 'listening'
          ? 'Listening…'
          : status === 'ending'
          ? 'Grading your answers…'
          : 'Thinking…'}
      </div>

      {/* Captions */}
      <div className="space-y-3 w-full">
        <span className="font-mono text-eyebrow text-content-disabled uppercase block">
          Question {turnIndex}
        </span>

        {prevCaptions && (
          <p className="text-small text-content-disabled line-clamp-1 italic">
            {prevCaptions}
          </p>
        )}

        <p className="text-heading-2 font-normal text-content-primary leading-snug min-h-16" aria-live="polite">
          {captions || '…'}
        </p>
      </div>

      {/* Text fallback input */}
      {textMode && (
        <div className="w-full flex gap-2 pt-4">
          <Input
            type="text"
            placeholder="Type your reply and press Enter…"
            value={fallbackInput}
            onChange={(e) => onFallbackInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onFallbackSend();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="primary"
            onClick={onFallbackSend}
            icon={<Send className="w-4 h-4" />}
            aria-label="Send reply"
          >
            Send
          </Button>
        </div>
      )}
    </main>
  );
}
