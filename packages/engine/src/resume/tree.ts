import { ResumeTree, ResumeExperienceItem, ResumeProjectItem, ResumeEducationItem } from './types';

/**
 * Normalizes any parsed JSON resume object into a standard ResumeTree.
 */
export function normalizeToResumeTree(parsed: unknown): ResumeTree {
  const p = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>;
  const contact = (typeof p.contact === 'object' && p.contact !== null ? p.contact : {}) as Record<string, unknown>;

  const experience: ResumeExperienceItem[] = Array.isArray(p.experience)
    ? p.experience.map((e, idx) => {
        const item = e as Record<string, unknown>;
        return {
          id: String(item.id || `exp-${idx + 1}`),
          company: String(item.company || 'Company'),
          title: String(item.title || 'Role'),
          location: item.location ? String(item.location) : undefined,
          startDate: item.startDate || item.start ? String(item.startDate || item.start) : undefined,
          endDate: item.endDate || item.end ? String(item.endDate || item.end) : undefined,
          bullets: Array.isArray(item.bullets)
            ? item.bullets.map((b, bIdx) => {
                if (typeof b === 'string') {
                  return { id: `b-${idx}-${bIdx}`, text: b };
                }
                const bObj = (b || {}) as Record<string, unknown>;
                return {
                  id: String(bObj.id || `b-${idx}-${bIdx}`),
                  text: String(bObj.text || ''),
                };
              })
            : [],
        };
      })
    : [];

  const education: ResumeEducationItem[] = Array.isArray(p.education)
    ? p.education.map((ed, idx) => {
        const item = ed as Record<string, unknown>;
        return {
          id: String(item.id || `edu-${idx + 1}`),
          school: String(item.school || 'University'),
          degree: String(item.degree || 'Degree'),
          year: item.year ? String(item.year) : undefined,
          gpa: item.gpa ? String(item.gpa) : undefined,
        };
      })
    : [];

  const projects: ResumeProjectItem[] = Array.isArray(p.projects)
    ? p.projects.map((proj, idx) => {
        const item = proj as Record<string, unknown>;
        return {
          id: String(item.id || `proj-${idx + 1}`),
          name: String(item.name || 'Project'),
          tech: Array.isArray(item.tech) ? item.tech.map(String) : [],
          link: item.link ? String(item.link) : undefined,
          bullets: Array.isArray(item.bullets)
            ? item.bullets.map((b, bIdx) => {
                if (typeof b === 'string') {
                  return { id: `pb-${idx}-${bIdx}`, text: b };
                }
                const bObj = (b || {}) as Record<string, unknown>;
                return {
                  id: String(bObj.id || `pb-${idx}-${bIdx}`),
                  text: String(bObj.text || ''),
                };
              })
            : [],
        };
      })
    : [];

  const skills: string[] = Array.isArray(p.skills) ? p.skills.map(String) : [];
  const certifications: string[] = Array.isArray(p.certifications) ? p.certifications.map(String) : [];

  return {
    contact: {
      name: String(contact.name || 'Candidate Name'),
      email: contact.email ? String(contact.email) : undefined,
      phone: contact.phone ? String(contact.phone) : undefined,
      location: contact.location ? String(contact.location) : undefined,
      linkedin: contact.linkedin ? String(contact.linkedin) : undefined,
      github: contact.github ? String(contact.github) : undefined,
      website: contact.website ? String(contact.website) : undefined,
    },
    summary: p.summary ? String(p.summary) : undefined,
    sectionsOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'],
    experience,
    education,
    projects,
    skills,
    certifications,
    layout: {
      fontSize: 'md',
      spacing: 'normal',
      margin: 'normal',
    },
  };
}

/**
 * Deterministic hash of resume text content to detect modifications.
 */
export function computeContentHash(tree: ResumeTree): string {
  const serialized = JSON.stringify({
    contact: tree.contact,
    summary: tree.summary,
    experience: tree.experience,
    education: tree.education,
    projects: tree.projects,
    skills: tree.skills,
    certifications: tree.certifications,
  });

  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
