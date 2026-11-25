import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../src/lib/supabase/server';
import { POST } from '../src/app/api/analyze/route';
import { NextRequest } from 'next/server';

// 1. Create a minimal valid PDF in memory with proper Tj operators
function createMinimalPdf(textContent: string): Buffer {
  const lines = textContent
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let stream = 'BT /F1 10 Tf 40 750 Td\n';
  lines.forEach((line) => {
    const safeText = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    stream += `(${safeText}) Tj T*\n`;
  });
  stream += 'ET';

  const streamLength = Buffer.byteLength(stream);
  const pdfData = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000325 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
405
%%EOF`;
  return Buffer.from(pdfData, 'utf-8');
}

async function run() {
  console.log('=== TEST E2E ANALYZE PIPELINE ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, anonKey);

  // Authenticate with a test user or sign in
  const testEmail = `candidate_${Date.now()}@trace.dev`;
  const testPassword = 'Password123!Secure';

  console.log(`1. Signing up candidate: ${testEmail}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (authError || !authData.session) {
    console.error('Auth error:', authError);
    // Try signing in if user exists
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) throw signInError;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const userId = sessionData.session?.user.id;
  console.log(`Authenticated as user ID: ${userId}`);

  // Create real resume content
  const resumeText = `
ALEX MORGAN
alex.morgan@stanford.edu | (555) 234-5678 | https://github.com/alexm-dev | San Francisco, CA

EDUCATION
Stanford University, B.S. in Computer Science, Expected June 2025

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, SQL, HTML/CSS
Frameworks: React, Next.js, Node.js, Express, TailwindCSS
Tools & Databases: PostgreSQL, Docker, Git, Jest, Supabase, Vercel

WORK EXPERIENCE
FinTech Labs - Software Engineering Intern (June 2024 - Sept 2024)
- Developed responsive customer dashboard in TypeScript and React used by 4,200 active financial advisors.
- Optimized PostgreSQL transaction queries, indexing primary account tables to decrease 95th percentile latency by 32%.
- Integrated REST APIs with automated validation using Zod and built Jest unit test suites achieving 88% branch coverage.

PROJECTS
TraceTask - Real-Time Collaborative Kanban (https://tracetask-demo.dev)
- Architected fullstack Next.js and PostgreSQL web application supporting real-time drag-and-drop workspace updates.
- Implemented Supabase Row-Level Security (RLS) policies and session authentication for 800+ beta users.
- Containerized development workflow with Docker and Docker Compose to automate local service orchestration.
`;

  const pdfBuffer = createMinimalPdf(resumeText);

  // Create real public job description
  const jobText = `
Software Engineer, Early Career / New Grad
Stripe | San Francisco, CA | Full-time | $135,000 - $160,000

About the role:
Stripe builds economic infrastructure for the internet. As an early-career engineer on our Developer Infrastructure team, you will write reliable code and build tools that empower millions of businesses worldwide.

Requirements:
- Strong foundations in TypeScript, JavaScript, or modern systems programming.
- Hands-on experience developing web applications with React or Next.js.
- Solid understanding of relational database fundamentals (PostgreSQL preferred).
- Familiarity with containerization (Docker) and automated CI/CD practices is a plus.
- 0 to 1 years of industry experience. We strongly welcome 2024/2025 university graduates and bootcamp grads with personal project experience.
`;

  console.log('\n2. Submitting multipart/form-data to POST /api/analyze...');
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'Alex_Morgan_Resume.pdf');
  formData.append('jobText', jobText);

  // Build NextRequest with session cookie and Authorization Bearer header
  const req = new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      cookie: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token=${JSON.stringify([token])};`,
    },
  });

  // Mock cookies via request headers / supabase SSR
  // Because createServerClient in App Router inspects cookies, we can also pass the authorization header or authenticate supabase client directly
  const response = await POST(req);
  const json = await response.json();

  console.log('API Response status:', response.status);
  console.log('API Response body:', JSON.stringify(json, null, 2));

  if (json.applicationId) {
    console.log(`\n3. Querying applications row for id: ${json.applicationId} from Supabase...`);
    const { data: appRow, error: appError } = await supabase
      .from('applications')
      .select('*, jobs(*), resumes(*)')
      .eq('id', json.applicationId)
      .single();

    if (appError) {
      console.error('Error fetching applications row:', appError);
    } else {
      console.log('\n=== RAW SUPABASE APPLICATION RECORD ===');
      console.log(JSON.stringify(appRow, null, 2));
    }
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
