import { describe, it, expect } from 'vitest';
import tokens from '../design-system/tokens.json';

// Helper to convert hex to sRGB relative luminance
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Resolve token value from JSON
function resolveColor(tokenKey: string): string {
  const semanticVal = (tokens.semantic as Record<string, { $value: string }>)[tokenKey]?.$value;
  if (!semanticVal) {
    throw new Error(`Token ${tokenKey} not found in semantic tokens`);
  }
  // If it's a reference alias like "{reference.paper-50}"
  const match = semanticVal.match(/\{reference\.([^}]+)\}/);
  if (match) {
    const refKey = match[1];
    return (tokens.reference as Record<string, { $value: string }>)[refKey].$value;
  }
  return semanticVal;
}

describe('Trace Design System WCAG 2.2 AA Contrast Assertions', () => {
  const pairs: Array<{
    name: string;
    foreground: string;
    background: string;
    minRatio: number;
  }> = [
    {
      name: 'content-primary on surface-page',
      foreground: 'color-content-primary',
      background: 'color-surface-page',
      minRatio: 4.5,
    },
    {
      name: 'content-secondary on surface-page',
      foreground: 'color-content-secondary',
      background: 'color-surface-page',
      minRatio: 4.5,
    },
    {
      name: 'content-tertiary on surface-page',
      foreground: 'color-content-tertiary',
      background: 'color-surface-page',
      minRatio: 4.5,
    },
    {
      name: 'content-link on surface-page',
      foreground: 'color-content-link',
      background: 'color-surface-page',
      minRatio: 4.5,
    },
    {
      name: 'content-on-action on action-primary',
      foreground: 'color-content-on-action',
      background: 'color-action-primary',
      minRatio: 4.5,
    },
    {
      name: 'status-strong-content on status-strong-surface',
      foreground: 'color-status-strong-content',
      background: 'color-status-strong-surface',
      minRatio: 4.5,
    },
    {
      name: 'status-caution-content on status-caution-surface',
      foreground: 'color-status-caution-content',
      background: 'color-status-caution-surface',
      minRatio: 4.5,
    },
    {
      name: 'status-risk-content on status-risk-surface',
      foreground: 'color-status-risk-content',
      background: 'color-status-risk-surface',
      minRatio: 4.5,
    },
    {
      name: 'border-control on surface-page (non-text control)',
      foreground: 'color-border-control',
      background: 'color-surface-page',
      minRatio: 3.0,
    },
    {
      name: 'border-control on surface-raised (non-text control)',
      foreground: 'color-border-control',
      background: 'color-surface-raised',
      minRatio: 3.0,
    },
  ];

  pairs.forEach(({ name, foreground, background, minRatio }) => {
    it(`verifies ${name} meets minimum ratio ${minRatio}:1`, () => {
      const fgHex = resolveColor(foreground);
      const bgHex = resolveColor(background);
      const ratio = getContrastRatio(fgHex, bgHex);
      expect(ratio).toBeGreaterThanOrEqual(minRatio);
    });
  });
});
