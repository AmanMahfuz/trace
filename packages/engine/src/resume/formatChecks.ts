import { ResumeTree, FormatCheckResult } from './types';

const COMMON_ACTION_VERBS = new Set([
  'built', 'created', 'developed', 'engineered', 'implemented', 'designed',
  'optimized', 'deployed', 'automated', 'reduced', 'increased', 'accelerated',
  'refactored', 'authored', 'configured', 'scaled', 'integrated', 'streamlined',
  'spearheaded', 'migrated', 'managed', 'led', 'architected', 'delivered',
  'conducted', 'collaborated', 'researched', 'established', 'initiated',
  'resolved', 'improved', 'maintained', 'trained', 'monitored', 'secured'
]);

/**
 * Pure format checker for resumes.
 * Runs identically in the client browser and on the server.
 * Returns a list of pass, issue, and opportunity checks without numeric gamified scores.
 */
export function runFormatChecks(tree: ResumeTree): FormatCheckResult {
  const checks: FormatCheckResult['checks'] = [];

  // 1. Contact Details Check
  const hasName = Boolean(tree.contact?.name && tree.contact.name.trim().length > 1);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasValidEmail = Boolean(tree.contact?.email && emailRegex.test(tree.contact.email.trim()));
  const hasPhoneOrLocation = Boolean(tree.contact?.phone?.trim() || tree.contact?.location?.trim());

  if (!hasName || !hasValidEmail) {
    checks.push({
      id: 'contact_essential',
      label: 'Contact details',
      level: 'issue',
      message: 'Missing essential contact information (name or valid email address).',
      suggestion: 'Provide your full legal name and active email so recruiters can reach you.',
    });
  } else if (!hasPhoneOrLocation) {
    checks.push({
      id: 'contact_recommended',
      label: 'Contact details',
      level: 'opportunity',
      message: 'Phone number and city/location are omitted.',
      suggestion: 'Adding a phone number or general metro location helps recruiters confirm work eligibility.',
    });
  } else {
    checks.push({
      id: 'contact_valid',
      label: 'Contact details',
      level: 'pass',
      message: 'Full contact details are present and cleanly formatted.',
    });
  }

  // 2. Single Column & Standard Headings
  const validHeadings = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'];
  const hasStandardHeadings = (tree.sectionsOrder || []).every((s) => validHeadings.includes(s));
  const hasCoreSections =
    (tree.experience && tree.experience.length > 0) ||
    (tree.projects && tree.projects.length > 0) ||
    (tree.skills && tree.skills.length > 0);

  if (hasStandardHeadings && hasCoreSections) {
    checks.push({
      id: 'layout_standard',
      label: 'Section structure',
      level: 'pass',
      message: 'Standard single-column headings compatible with all ATS parsers.',
    });
  } else {
    checks.push({
      id: 'layout_standard',
      label: 'Section structure',
      level: 'issue',
      message: 'Missing core sections (Experience, Projects, or Skills).',
      suggestion: 'Ensure your resume contains recognizable Experience or Projects sections.',
    });
  }

  // 3. Action Verb Starts
  let missingVerbsCount = 0;
  const allBullets = [
    ...(tree.experience || []).flatMap((e) => e.bullets || []),
    ...(tree.projects || []).flatMap((p) => p.bullets || []),
  ];

  for (const b of allBullets) {
    const firstWord = (b.text || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord && !COMMON_ACTION_VERBS.has(firstWord)) {
      missingVerbsCount++;
    }
  }

  if (allBullets.length > 0 && missingVerbsCount > 0) {
    checks.push({
      id: 'action_verbs',
      label: 'Action verbs',
      level: missingVerbsCount > 3 ? 'issue' : 'opportunity',
      message: `${missingVerbsCount} bullet point${missingVerbsCount === 1 ? '' : 's'} do not begin with an active verb.`,
      suggestion: 'Start each bullet with an active past-tense verb (e.g. "Engineered", "Optimized", "Built").',
    });
  } else if (allBullets.length > 0) {
    checks.push({
      id: 'action_verbs',
      label: 'Action verbs',
      level: 'pass',
      message: 'Every bullet point starts with a recognized strong action verb.',
    });
  }

  // 4. Bullet Length Check (Fresher readability: ~180-220 characters max)
  const longBullets = allBullets.filter((b) => (b.text || '').length > 220);
  if (longBullets.length > 0) {
    checks.push({
      id: 'bullet_length',
      label: 'Bullet conciseness',
      level: 'issue',
      message: `${longBullets.length} bullet point${longBullets.length === 1 ? '' : 's'} exceed 2 printed lines (>220 characters).`,
      suggestion: 'Split multi-clause bullets into separate points or edit out filler words for quick scanning.',
    });
  } else if (allBullets.length > 0) {
    checks.push({
      id: 'bullet_length',
      label: 'Bullet conciseness',
      level: 'pass',
      message: 'Bullet points stay concise and within recommended line lengths.',
    });
  }

  // 5. Total Page Length for Freshers (Target 1 page)
  let totalLineWeight = 6; // header + contact
  if (tree.summary) totalLineWeight += 3;
  for (const e of tree.experience || []) {
    totalLineWeight += 2 + (e.bullets?.length || 1);
  }
  for (const p of tree.projects || []) {
    totalLineWeight += 2 + (p.bullets?.length || 1);
  }
  totalLineWeight += (tree.education?.length || 0) * 2;
  if (tree.skills?.length) totalLineWeight += 3;

  if (totalLineWeight > 42) {
    checks.push({
      id: 'page_length',
      label: 'Length suitability',
      level: 'opportunity',
      message: 'Estimated content spills onto a second page.',
      suggestion: 'For freshers and junior roles, a tight 1-page resume receives higher recruiter engagement.',
    });
  } else {
    checks.push({
      id: 'page_length',
      label: 'Length suitability',
      level: 'pass',
      message: 'Content length fits cleanly onto a single page (ideal for freshers).',
    });
  }

  // 6. Concrete Metrics / Results Check (Flagged as OPPORTUNITY, not failure)
  const metricRegex = /\b(\d+%|\d+x|\$\d+|\d+\+?|\d+\s*(ms|s|sec|users|clients|requests|rpm|queries|stars|commits))\b/i;
  const bulletsWithoutMetrics = allBullets.filter((b) => !metricRegex.test(b.text || ''));

  if (allBullets.length > 0 && bulletsWithoutMetrics.length > allBullets.length / 2) {
    checks.push({
      id: 'metrics_opportunity',
      label: 'Measurable impact',
      level: 'opportunity',
      message: 'Several bullets describe responsibilities without quantifiable results or scope metrics.',
      suggestion: 'Consider adding quantifiable evidence (e.g. "improved latency by 35%", "tested with 10k mock rows").',
    });
  } else if (allBullets.length > 0) {
    checks.push({
      id: 'metrics_opportunity',
      label: 'Measurable impact',
      level: 'pass',
      message: 'Key bullets cite quantifiable scale, performance, or outcome numbers.',
    });
  }

  // 7. Link Formatting Check
  const links = [
    tree.contact?.linkedin,
    tree.contact?.github,
    tree.contact?.website,
    ...(tree.projects || []).map((p) => p.link),
  ].filter(Boolean) as string[];

  const invalidLinks = links.filter((l) => {
    try {
      if (!l.startsWith('http://') && !l.startsWith('https://')) {
        new URL(`https://${l}`);
      } else {
        new URL(l);
      }
      return false;
    } catch {
      return true;
    }
  });

  if (invalidLinks.length > 0) {
    checks.push({
      id: 'links_valid',
      label: 'Link formatting',
      level: 'issue',
      message: `${invalidLinks.length} web link${invalidLinks.length === 1 ? '' : 's'} have invalid URL formats.`,
      suggestion: 'Ensure profile and repository links are valid web addresses.',
    });
  } else if (links.length > 0) {
    checks.push({
      id: 'links_valid',
      label: 'Link formatting',
      level: 'pass',
      message: 'All external links and project URLs are valid.',
    });
  }

  const issuesCount = checks.filter((c) => c.level === 'issue').length;
  const opportunitiesCount = checks.filter((c) => c.level === 'opportunity').length;

  return {
    passed: issuesCount === 0,
    issuesCount,
    opportunitiesCount,
    checks,
  };
}
