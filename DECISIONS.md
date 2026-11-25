# Architectural Decisions

1. **Design System 1: High-Trust Career & Technical Platform**:
   - Palette: Electric Indigo (`#6366F1`) primary accent, Signal Violet (`#A855F7`), Signal Emerald (`#10B981`) for verified passes, Crimson (`#EF4444`) for ghost signals/gaps.
   - Typography: Geist/Inter for clean UI hierarchy paired with Geist/JetBrains Mono for diagnostic scores, odds factors, WPM, and STAR metrics.
   - Surfaces: Clean Snow/Slate (`#F8FAFC`) in light mode and Deep Slate (`#090D16`) in dark mode with 8px radius (`rounded-lg`) cards and 6px (`rounded-md`) buttons.

2. **Next.js 16 App Router & React 19**:
   - Clean client/server boundaries. Dynamic views (`/prep/[id]`, `/arena/[id]`) leverage client-side hydration with secure server API routes.

3. **Provider-Agnostic AI Resilience**:
   - Model requests funnel through `src/lib/ai/provider.ts`.
   - Primary tiers default to Google Gemini (`gemini-3.1-flash-lite` for fast tasks, `gemini-3.5-flash` for mid/strong tasks).
   - If a quota, rate-limit, 5xx, or schema failure occurs, the engine automatically retries once on `AI_FALLBACK_MODEL` (`claude-haiku-5-5`), writes telemetry to the `ai_logs` table, and cleanly raises `AIUnavailableError` without crashing the application.

4. **Deterministic Odds Engine**:
   - LLMs provide only the factor assessment scores (0–100) and proof citations.
   - The overall weighted score and categorization bracket ('Long shot', 'Fair', 'Strong') are computed 100% deterministically in application code to prevent metric hallucinations.

5. **SSRF Hardening**:
   - The job scraper uses Node's `dns.promises.lookup` to inspect DNS resolutions before making requests, blocking private IPv4, IPv6, loopback (`localhost`), and link-local ranges (`169.254.x.x`).
