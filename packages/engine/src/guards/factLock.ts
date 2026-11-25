/**
 * Fact-Lock Guard for Trace Engine
 *
 * Enforces honesty by construction:
 * Extracts numbers, percentages, currencies, URLs, capitalized entities, and tech/tool names
 * from a suggested resume rewrite. Every critical token must be grounded in the candidate's
 * original resume, interview transcript, or explicitly provided user details.
 */

export interface FactLockCheckResult {
  passed: boolean;
  unverifiedTokens: string[];
  details: {
    numbers: { token: string; verified: boolean }[];
    currencies: { token: string; verified: boolean }[];
    entities: { token: string; verified: boolean }[];
    urls: { token: string; verified: boolean }[];
  };
}

// Common conversational / non-proprietary words that may appear capitalized
const STOP_WORDS = new Set([
  'A', 'An', 'The', 'And', 'Or', 'But', 'If', 'Then', 'With', 'By', 'For', 'In',
  'On', 'At', 'To', 'From', 'As', 'Built', 'Led', 'Created', 'Designed', 'Engineered',
  'Developed', 'Implemented', 'Refactored', 'Managed', 'Delivered', 'Collaborated',
  'Accelerated', 'Integrated', 'Automated', 'Optimized', 'Resolved', 'Spearheaded',
  'Architected', 'Deployed', 'Achieved', 'Maintained', 'Standardized', 'Tested',
  'Scaled', 'Analyzed', 'Utilized', 'Authored', 'Coordinated', 'Streamlined',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
}

/**
 * Extracts factual tokens (numbers, percentages, currencies, URLs, capitalized entities)
 * from candidate rewrite text and verifies presence against allowed source texts.
 */
export function verifyRewriteWithFactLock(
  rewrite: string,
  sourceTexts: string[]
): FactLockCheckResult {
  const combinedSource = sourceTexts.join(' \n ');
  const normalizedSource = normalizeText(combinedSource);
  const unverifiedTokens: string[] = [];

  // 1. Currencies (e.g., $500, €1000, £50k, ₹10L)
  const currencyRegex = /(?:[\$€£₹]|USD|EUR|GBP|INR)\s*[\d,]+(?:\.\d+)?(?:k|m|b|lakh|cr)?\b/gi;
  const rawCurrencies = rewrite.match(currencyRegex) || [];
  const currencies = rawCurrencies.map((token) => {
    const cleanToken = token.trim();
    const verified = combinedSource.includes(cleanToken) ||
      combinedSource.toLowerCase().includes(cleanToken.toLowerCase());
    if (!verified) unverifiedTokens.push(cleanToken);
    return { token: cleanToken, verified };
  });

  // 2. URLs
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  const rawUrls = rewrite.match(urlRegex) || [];
  const urls = rawUrls.map((token) => {
    const verified = combinedSource.includes(token);
    if (!verified) unverifiedTokens.push(token);
    return { token, verified };
  });

  // 3. Numbers & Percentages (e.g. 50%, 40x, 200ms, 15,000, 99.99%)
  // Exclude single digit ordinals if harmless, but strictly check all metric claims
  const numberRegex = /\b\d+(?:[\.,]\d+)?(?:\s*(?:%|x|ms|s|k|m|b|fps|gb|mb|tb))?(?!\w)/gi;
  const rawNumbers = rewrite.match(numberRegex) || [];
  const numbers: { token: string; verified: boolean }[] = [];

  for (const token of rawNumbers) {
    const trimmed = token.trim();
    // Allow single digits 1 or 2 as common words unless accompanied by % or units
    if ((trimmed === '1' || trimmed === '2') && !/[%xms]/i.test(token)) {
      continue;
    }

    // Check exact or normalized substring
    const tokenNorm = trimmed.toLowerCase().replace(/,/g, '');
    const inRaw = combinedSource.includes(trimmed);
    const inNorm = normalizedSource.includes(tokenNorm);
    const verified = inRaw || inNorm;

    if (!verified) {
      unverifiedTokens.push(trimmed);
    }
    numbers.push({ token: trimmed, verified });
  }

  // 4. Capitalized Entities / Tools / Frameworks
  // Match TitleCase or ALLCAPS words that are not at the very start of a sentence or stop words
  const entityRegex = /\b[A-Z][a-zA-Z0-9+#.]*\b/g;
  const rawEntities = rewrite.match(entityRegex) || [];
  const entities: { token: string; verified: boolean }[] = [];

  for (const token of rawEntities) {
    if (STOP_WORDS.has(token) || token.length <= 1) continue;

    const tokenLower = token.toLowerCase();
    // Check if token exists in normalized source
    const tokenWords = tokenLower.split(/[^a-z0-9]/).filter(Boolean);
    const verified = tokenWords.every((word) =>
      normalizedSource.includes(` ${word} `) ||
      normalizedSource.startsWith(`${word} `) ||
      normalizedSource.endsWith(` ${word}`) ||
      combinedSource.toLowerCase().includes(tokenLower)
    );

    if (!verified) {
      unverifiedTokens.push(token);
    }
    entities.push({ token, verified });
  }

  const passed = unverifiedTokens.length === 0;

  return {
    passed,
    unverifiedTokens: Array.from(new Set(unverifiedTokens)),
    details: {
      numbers,
      currencies,
      entities,
      urls,
    },
  };
}
