import { describe, it, expect } from 'vitest';

function calculateSpeechMetrics(
  transcript: Array<{ speaker: string; text: string; durationSec?: number }>
) {
  const userTurns = transcript.filter((t) => t.speaker === 'user');
  const allText = userTurns.map((t) => t.text).join(' ');
  const words = allText.trim().split(/\s+/).filter(Boolean);
  const totalDuration = userTurns.reduce((acc, curr) => acc + (curr.durationSec || 0), 0);

  const minutes = Math.max(totalDuration / 60, 0.1);
  const wpm = Math.round(words.length / minutes);

  const fillerRegex = /\b(um|uh|like|you know|basically|actually)\b/gi;
  const fillers = (allText.match(fillerRegex) || []).map((f) => f.toLowerCase());

  return { wpm, fillerCount: fillers.length };
}

describe('Speech Metrics Helper', () => {
  it('correctly quantifies fillers and computes standard words per minute', () => {
    const data = [
      {
        speaker: 'user',
        text: 'Um, I basically like implemented actually that feature you know.',
        durationSec: 30,
      },
    ];
    const metrics = calculateSpeechMetrics(data);
    expect(metrics.fillerCount).toBe(5);
    expect(metrics.wpm).toBeGreaterThan(0);
  });
});
