import { ChipVariant } from '../primitives/Chip';
import { StatusType } from '../primitives/StatusIcon';

export interface BandMeta {
  status: StatusType;
  chipVariant: ChipVariant;
  label: string;
}

export const ODDS_BANDS: Record<'Strong' | 'Fair' | 'Long shot', BandMeta> = {
  Strong: {
    status: 'strong',
    chipVariant: 'strong',
    label: 'Strong',
  },
  Fair: {
    status: 'caution',
    chipVariant: 'caution',
    label: 'Fair',
  },
  'Long shot': {
    status: 'risk',
    chipVariant: 'risk',
    label: 'Long shot',
  },
};

export const GHOST_LEVELS: Record<'Low' | 'Medium' | 'High', BandMeta> = {
  Low: {
    status: 'ghost-low',
    chipVariant: 'strong',
    label: 'Low risk',
  },
  Medium: {
    status: 'ghost-medium',
    chipVariant: 'caution',
    label: 'Medium risk',
  },
  High: {
    status: 'ghost-high',
    chipVariant: 'risk',
    label: 'High risk',
  },
};

export function getOddsMeta(band: string): BandMeta {
  if (band === 'Strong') return ODDS_BANDS.Strong;
  if (band === 'Long shot') return ODDS_BANDS['Long shot'];
  return ODDS_BANDS.Fair;
}

export function getGhostMeta(level: string): BandMeta {
  if (level === 'High') return GHOST_LEVELS.High;
  if (level === 'Medium') return GHOST_LEVELS.Medium;
  return GHOST_LEVELS.Low;
}
