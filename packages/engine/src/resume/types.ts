export interface ResumeContact {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ResumeBullet {
  id: string;
  text: string;
}

export interface ResumeExperienceItem {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets: ResumeBullet[];
}

export interface ResumeEducationItem {
  id: string;
  school: string;
  degree: string;
  year?: string;
  gpa?: string;
}

export interface ResumeProjectItem {
  id: string;
  name: string;
  tech: string[];
  bullets: ResumeBullet[];
  link?: string;
}

export type ResumeSectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certifications';

export interface ResumeLayoutOptions {
  fontSize: 'sm' | 'md' | 'lg';
  spacing: 'compact' | 'normal' | 'relaxed';
  margin: 'narrow' | 'normal' | 'wide';
}

export interface ResumeTree {
  contact: ResumeContact;
  summary?: string;
  sectionsOrder: ResumeSectionKey[];
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  projects: ResumeProjectItem[];
  skills: string[];
  certifications: string[];
  layout?: ResumeLayoutOptions;
}

export interface FormatCheckResult {
  passed: boolean;
  issuesCount: number;
  opportunitiesCount: number;
  checks: Array<{
    id: string;
    label: string;
    level: 'pass' | 'issue' | 'opportunity';
    message: string;
    suggestion?: string;
  }>;
}
