# Trace (MVP)

**Trace** helps freshers (final-year students, IT and management roles) decide *which jobs are worth applying to*, fix their resume for each one, practice a short voice interview, and understand *why* they were rejected.

The core differentiator is the **Why-Not Engine**:
1. **Honest Odds** before applying: a band (`Long shot` / `Fair` / `Strong`) with a factor breakdown. NEVER a fake precise percentage.
2. **Ghost-Job Risk** flag (`Low` / `Medium` / `High`) with explicit signals found (reposts, expired listings, evergreen phrases, fresher vs. 3+ years experience contradiction).
3. **Bullet Tailoring without Fabrication**: If metrics or facts are missing, prompts the candidate with clarifying questions rather than inventing facts.
4. **Voice Sparring Arena**: 5-minute pre-interview screening with real-time pacing (WPM), filler-word detection (`um`, `uh`, `like`, `you know`), STAR structure completeness grading, and grounded answer rewrites.
5. **Rejection Autopsy**: Inferred most likely reasons, a max-3-step action fix plan, and a follow-up email draft for ghosted cases.

---

## Tech Stack & Design System

- **Framework**: Next.js 16 (App Router), React 19, TypeScript strict mode
- **Styling**: Tailwind CSS v4, Lucide icons, Framer Motion
- **Design System 1**: High-Trust Career & Technical Platform
  - Electric Indigo (`#6366F1`) primary accent, Signal Violet (`#A855F7`), Signal Emerald (`#10B981`) verified passes, Crimson (`#EF4444`) ghost risks.
  - Typography: Geist/Inter for UI paired with Geist/JetBrains Mono for diagnostic scores, odds factors, WPM, and STAR metrics.
  - Surfaces: Clean Snow/Slate (`#F8FAFC`) light mode and Deep Slate (`#090D16`) dark mode with `rounded-lg` (8px) cards and `rounded-md` (6px) buttons.
- **Database & Storage**: Supabase (Postgres with RLS, Auth via Google OAuth + Magic Link, private `resumes-raw` Storage bucket)
- **AI Core**: Provider-agnostic engine (`src/lib/ai/provider.ts`)
  - Primary: Google Gemini (`gemini-3.1-flash-lite` for FAST, `gemini-3.5-flash` for MID/STRONG)
  - Automatic Fallback: Anthropic (`claude-haiku-5-5`) with error logging to `ai_logs` table
- **PDF Generation**: `@react-pdf/renderer` single-column ATS vector PDF generator
- **Job Scraping**: Cheerio (for JSON-LD schema) + Jina Reader with pre-lookup SSRF and private IP blocking

---

## Setup & Local Development

### 1. Prerequisites
- Node.js 20+ (Node 24 supported)
- npm 10+
- Supabase project credentials

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and populate your keys:
```bash
cp .env.example .env.local
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_MODEL_FAST=gemini-3.1-flash-lite
AI_MODEL_MID=gemini-3.5-flash
AI_MODEL_STRONG=gemini-3.5-flash
AI_FALLBACK_MODEL=claude-haiku-5-5
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Migration
Apply the SQL migration file located at:
`supabase/migrations/001_init.sql`

This creates:
- `profiles` table with automatic user creation trigger on auth signup
- `resumes` and `jobs` tables with SHA-256 repost hashing
- `applications` table with `tailored` resume tree, `odds`, `ghost`, and `suggestions`
- `interview_sessions`, `credit_ledger`, `waitlist`, and `ai_logs` tables
- Complete Row Level Security (RLS) policies for user data isolation
- Private `resumes-raw` storage bucket with per-user path policies

### 4. Run the Test Suite
Run the Vitest unit tests:
```bash
npm test
```
Validates:
- SSRF Guard (blocks private IPs like `127.0.0.1`, `169.254.169.254`, and internal hostnames)
- Ghost Job Risk Engine (heuristics, reposts, expired dates, evergreen phrases)
- Deterministic Odds Engine (0–100 weighting and band categorization)
- Speech Metrics Helper (WPM calculation and filler-word detection)

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Linting

```bash
npm run lint
npm run build
```

---

## Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Configure the environment variables from `.env.local` in the Vercel Project Settings.
4. Set the Build Command to `npm run build` and Output Directory to `.next`.
5. Deploy.
# trace
