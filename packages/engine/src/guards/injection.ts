/**
 * Injection Defense Guard for Trace Engine
 * Scans untrusted input (resumes, job postings) for prompt injection patterns,
 * jailbreak attempts, hidden PDF artifacts, and wraps untrusted content with safe delimiters.
 */

export interface InjectionScanResult {
  detected: boolean;
  flags: string[];
  sanitized: string;
}

const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'ignore_instructions', regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { name: 'disregard_system', regex: /disregard\s+(the\s+)?(system|initial|prompt|guidelines)/i },
  { name: 'system_prompt_leak', regex: /(system\s+prompt|developer\s+mode|developer\s+instructions|system\s+instructions)/i },
  { name: 'role_hijack', regex: /(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(a\s+different|dan|unrestricted|god\s+mode)/i },
  { name: 'special_tokens', regex: /(<\|endoftext\|>|<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\])/i },
  { name: 'override_eval', regex: /(score\s+(?:this\s+)?(?:candidate\s+)?100|give\s+(?:a\s+)?perfect\s+score|always\s+return\s+met|perfect\s+score)/i },
  { name: 'jailbreak_marker', regex: /(developer\s+mode\s+enabled|jailbreak\s+active|bypass\s+safety)/i },
];

const HIDDEN_TEXT_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'zero_width_chars', regex: /[\u200B-\u200D\uFEFF]{3,}/ },
  { name: 'css_hidden', regex: /(font-size:\s*0|display:\s*none|visibility:\s*hidden|color:\s*transparent|color:\s*(#fff|#ffffff|white))/i },
];

/**
 * Scans input text for known injection indicators and hidden content anomalies.
 */
export function scanForInjection(text: string): InjectionScanResult {
  const flags: string[] = [];

  for (const { name, regex } of INJECTION_PATTERNS) {
    if (regex.test(text)) {
      flags.push(`injection:${name}`);
    }
  }

  for (const { name, regex } of HIDDEN_TEXT_PATTERNS) {
    if (regex.test(text)) {
      flags.push(`hidden_content:${name}`);
    }
  }

  // Remove zero-width characters in sanitized output
  const sanitized = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  return {
    detected: flags.length > 0,
    flags,
    sanitized,
  };
}

/**
 * Wraps untrusted user/external content in strict boundary tags.
 * Escapes any embedded occurrences of the closing tag to prevent delimiter collision/breakout.
 */
export function wrapUntrustedContent(content: string, tag = 'untrusted_content'): string {
  const closingTagRegex = new RegExp(`</${tag}>`, 'gi');
  const safeContent = content.replace(closingTagRegex, `&lt;/${tag}&gt;`);
  return `<${tag}>\n${safeContent}\n</${tag}>`;
}
