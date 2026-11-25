'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Toast } from '@/design-system/primitives/Toast';
import { Banner } from '@/design-system/primitives/Banner';
import {
  ResumeTree,
  ResumeBullet,
  runFormatChecks,
} from '@trace/engine';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  FileSearch,
  HelpCircle,
} from 'lucide-react';

interface ProjectInput {
  id: string;
  title: string;
  tech: string;
  role: string;
  description: string;
  result: string;
  link: string;
}

interface ExperienceInput {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

interface DraftAnswers {
  targetArea?: 'it' | 'management';
  stage?: 'student' | 'final_year' | 'graduated' | 'working';
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  linkedin?: string;
  github?: string;
  college?: string;
  degree?: string;
  gradYear?: string;
  cgpa?: string;
  coursework?: string;
  experiences?: ExperienceInput[];
  projects?: ProjectInput[];
  skills?: string[];
  certifications?: string[];
  achievements?: string[];
}

const STEPS = [
  { id: 0, label: 'You' },
  { id: 1, label: 'Contact' },
  { id: 2, label: 'Education' },
  { id: 3, label: 'Experience' },
  { id: 4, label: 'Projects' },
  { id: 5, label: 'Skills' },
  { id: 6, label: 'Review' },
];

export default function NewResumeBuilderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<DraftAnswers>({
    targetArea: 'it',
    stage: 'final_year',
    experiences: [],
    projects: [
      {
        id: 'proj-1',
        title: '',
        tech: '',
        role: '',
        description: '',
        result: '',
        link: '',
      },
    ],
    skills: [],
    certifications: [],
    achievements: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  // Skill input state
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [achieveInput, setAchieveInput] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load active draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/resumes/draft');
        if (res.ok) {
          const data = await res.json();
          if (data.draft) {
            setDraftId(data.draft.id);
            setCurrentStep(data.draft.current_step || 0);
            if (data.draft.answers) {
              setAnswers((prev) => ({
                ...prev,
                ...data.draft.answers,
                projects:
                  data.draft.answers.projects?.length > 0
                    ? data.draft.answers.projects
                    : prev.projects,
              }));
            }
          }
        }
      } catch {
        // Fallback to fresh draft
      } finally {
        setIsLoading(false);
      }
    }
    loadDraft();
  }, [router, supabase]);

  // 2. Debounced autosave
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAutosave = useCallback(
    (newStep: number, newAnswers: DraftAnswers) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/resumes/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: draftId,
              current_step: newStep,
              answers: newAnswers,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.draft?.id) {
              setDraftId(json.draft.id);
            }
            setSaveStatus('saved');
          } else {
            setSaveStatus('error');
          }
        } catch {
          setSaveStatus('error');
        }
      }, 1000);
    },
    [draftId]
  );

  const updateAnswers = (patch: Partial<DraftAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      triggerAutosave(currentStep, next);
      return next;
    });
  };

  const handleNextStep = () => {
    const next = Math.min(STEPS.length - 1, currentStep + 1);
    setCurrentStep(next);
    triggerAutosave(next, answers);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    const prev = Math.max(0, currentStep - 1);
    setCurrentStep(prev);
    triggerAutosave(prev, answers);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAndExit = () => {
    triggerAutosave(currentStep, answers);
    showToast('Progress saved. You can resume anytime.');
    setTimeout(() => {
      router.push('/resumes');
    }, 600);
  };

  // Convert answers to live ResumeTree for the live A4 preview
  const liveTree: ResumeTree = useMemo(() => {
    const projectsConverted = (answers.projects || [])
      .filter((p) => p.title.trim())
      .map((p) => {
        const bullets: ResumeBullet[] = [];
        if (p.description.trim()) {
          bullets.push({
            id: `${p.id}-b1`,
            text: p.description.trim(),
          });
        }
        if (p.result.trim()) {
          bullets.push({
            id: `${p.id}-b2`,
            text: `Achieved: ${p.result.trim()}`,
          });
        }
        return {
          id: p.id,
          name: p.title,
          tech: p.tech
            ? p.tech
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          bullets,
        };
      });

    const experienceConverted = (answers.experiences || [])
      .filter((e) => e.company.trim() || e.role.trim())
      .map((e) => ({
        id: e.id,
        company: e.company,
        title: e.role,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        bullets: e.bullets.map((bText, idx) => ({
          id: `${e.id}-b${idx}`,
          text: bText,
        })),
      }));

    return {
      contact: {
        name: answers.name || 'YOUR NAME',
        email: answers.email || '',
        phone: answers.phone || '',
        location: answers.city || '',
        github: answers.github || '',
        linkedin: answers.linkedin || '',
      },
      summary:
        answers.targetArea === 'it'
          ? 'Motivated engineer with hands-on project experience in software development and problem solving.'
          : 'Proactive professional with project and leadership experience focused on process efficiency and execution.',
      sectionsOrder: ['summary', 'education', 'projects', 'skills', 'experience', 'certifications'],
      education: answers.college
        ? [
            {
              id: 'edu-1',
              school: answers.college,
              degree: answers.degree || 'Degree',
              year: answers.gradYear || '',
              gpa: answers.cgpa ? `CGPA: ${answers.cgpa}` : undefined,
            },
          ]
        : [],
      experience: experienceConverted,
      projects: projectsConverted,
      skills: answers.skills || [],
      certifications: answers.certifications || [],
    };
  }, [answers]);

  const formatChecks = useMemo(() => runFormatChecks(liveTree), [liveTree]);

  // Finish builder & create formal resume record
  const handleFinishResume = async (destination: 'resumes' | 'analyze') => {
    try {
      setIsFinishing(true);
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'build',
          title: `${answers.name || 'Candidate'}'s Resume`,
          tree: liveTree,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create resume');
      }

      const data = await res.json();
      const newResumeId = data.resume?.id;

      // Clean up the draft
      await fetch('/api/resumes/draft', { method: 'DELETE' });

      if (destination === 'analyze' && newResumeId) {
        router.push(`/?resumeId=${newResumeId}`);
      } else {
        router.push(newResumeId ? `/resumes/${newResumeId}` : '/resumes');
      }
    } catch {
      showToast('Error saving resume. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-action-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface-page">
      {/* 1. Builder Top Bar */}
      <header className="h-14 border-b border-border-hairline bg-surface-elevated px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/resumes"
            className="text-tiny font-medium text-content-secondary hover:text-content-primary flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Resumes</span>
          </Link>
          <span className="text-border-control">|</span>
          <span className="text-tiny font-semibold text-content-primary">
            Build with Trace
          </span>
          <span className="font-mono text-eyebrow text-content-tertiary">
            (Step {currentStep + 1} of {STEPS.length})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-eyebrow text-content-tertiary">
            {saveStatus === 'saving' && 'Autosaving...'}
            {saveStatus === 'saved' && '✓ Autosaved'}
            {saveStatus === 'error' && 'Failed to save'}
          </span>
          <button
            type="button"
            onClick={handleSaveAndExit}
            className="px-3 py-1.5 rounded text-tiny font-medium text-content-secondary hover:text-content-primary hover:bg-surface-sunken border border-border-subtle cursor-pointer transition-colors"
          >
            Save and continue later
          </button>
        </div>
      </header>

      {/* 2. Trace-Line Progress Rail */}
      <nav
        aria-label="Builder Progress"
        className="border-b border-border-hairline bg-surface-elevated/60 backdrop-blur-xs px-4 md:px-8 py-3 overflow-x-auto select-none"
      >
        <div className="max-w-4xl mx-auto relative flex items-center justify-between">
          {/* Continuous connecting rule */}
          <div
            className="absolute h-px bg-border-default -translate-y-1/2 z-0"
            style={{ left: 16, right: 16, top: 12 }}
            aria-hidden="true"
          />

          {STEPS.map((s, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setCurrentStep(idx);
                  triggerAutosave(idx, answers);
                }}
                className="relative z-10 flex flex-col items-center group cursor-pointer"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-surface-raised border-2 border-action-primary ring-4 ring-surface-selected text-action-primary'
                      : isDone
                      ? 'bg-action-primary text-content-inverse'
                      : 'bg-surface-page border border-border-control text-content-tertiary'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="font-mono text-tiny font-medium">{idx}</span>
                  )}
                </div>
                <span
                  className={`mt-1 font-mono text-eyebrow whitespace-nowrap ${
                    isCurrent
                      ? 'font-bold text-action-primary'
                      : isDone
                      ? 'text-content-secondary'
                      : 'text-content-tertiary'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. Main Workspace Split: 560px Stepper Form (Left) + Live A4 Preview (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Form Stepper */}
        <div className="w-full lg:w-1/2 xl:w-5/12 border-r border-border-hairline overflow-y-auto p-6 md:p-8 flex justify-center bg-surface-elevated">
          <div className="w-full" style={{ maxWidth: 560 }}>
            {/* Step 0: You */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 0
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Tell us about where you are starting
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Two questions only. This shapes the wording suggestions and level fit.
                  </p>
                </div>

                {/* Target Area */}
                <div className="space-y-2">
                  <label className="block text-small font-medium text-content-primary">
                    Target career area
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateAnswers({ targetArea: 'it' })}
                      className={`p-4 rounded border text-left cursor-pointer transition-all ${
                        answers.targetArea === 'it'
                          ? 'border-action-primary bg-surface-selected ring-1 ring-action-primary'
                          : 'border-border-control bg-surface-raised hover:bg-surface-sunken'
                      }`}
                    >
                      <div className="font-semibold text-small text-content-primary">
                        IT & Software
                      </div>
                      <div className="text-tiny text-content-tertiary mt-1">
                        Development, QA, Data, DevOps, Cloud
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateAnswers({ targetArea: 'management' })}
                      className={`p-4 rounded border text-left cursor-pointer transition-all ${
                        answers.targetArea === 'management'
                          ? 'border-action-primary bg-surface-selected ring-1 ring-action-primary'
                          : 'border-border-control bg-surface-raised hover:bg-surface-sunken'
                      }`}
                    >
                      <div className="font-semibold text-small text-content-primary">
                        Management & Ops
                      </div>
                      <div className="text-tiny text-content-tertiary mt-1">
                        Product, Business Analyst, Operations, Marketing
                      </div>
                    </button>
                  </div>
                </div>

                {/* Stage */}
                <div className="space-y-2">
                  <label className="block text-small font-medium text-content-primary">
                    Current stage
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'student', label: '1st - 3rd Year Student' },
                      { id: 'final_year', label: 'Final Year Student' },
                      { id: 'graduated', label: 'Recent Graduate' },
                      { id: 'working', label: 'Working / Early Career' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          updateAnswers({
                            stage: st.id as DraftAnswers['stage'],
                          })
                        }
                        className={`p-3 rounded border text-tiny font-medium text-left cursor-pointer transition-all ${
                          answers.stage === st.id
                            ? 'border-action-primary bg-surface-selected text-action-primary font-semibold'
                            : 'border-border-subtle bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Contact */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 1
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Contact & Profiles
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Recruiters use these details to contact you directly.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-tiny font-medium text-content-secondary mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={answers.name || ''}
                      onChange={(e) => updateAnswers({ name: e.target.value })}
                      placeholder="e.g. Asha Nair"
                      className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={answers.email || ''}
                        onChange={(e) => updateAnswers({ email: e.target.value })}
                        placeholder="asha@example.com"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={answers.phone || ''}
                        onChange={(e) => updateAnswers({ phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-tiny font-medium text-content-secondary mb-1">
                      City, State *
                    </label>
                    <input
                      type="text"
                      value={answers.city || ''}
                      onChange={(e) => updateAnswers({ city: e.target.value })}
                      placeholder="e.g. Bangalore, Karnataka"
                      className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        LinkedIn (Recommended)
                      </label>
                      <input
                        type="text"
                        value={answers.linkedin || ''}
                        onChange={(e) => updateAnswers({ linkedin: e.target.value })}
                        placeholder="linkedin.com/in/username"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        GitHub or Portfolio
                      </label>
                      <input
                        type="text"
                        value={answers.github || ''}
                        onChange={(e) => updateAnswers({ github: e.target.value })}
                        placeholder="github.com/username"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Education */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 2
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Education & Degrees
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Highlight your institution, branch, and relevant subjects.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-tiny font-medium text-content-secondary mb-1">
                      College / University Name *
                    </label>
                    <input
                      type="text"
                      value={answers.college || ''}
                      onChange={(e) => updateAnswers({ college: e.target.value })}
                      placeholder="e.g. National Institute of Technology"
                      className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Degree & Branch *
                      </label>
                      <input
                        type="text"
                        value={answers.degree || ''}
                        onChange={(e) => updateAnswers({ degree: e.target.value })}
                        placeholder="B.Tech Computer Science"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Graduation Year (or expected) *
                      </label>
                      <input
                        type="text"
                        value={answers.gradYear || ''}
                        onChange={(e) => updateAnswers({ gradYear: e.target.value })}
                        placeholder="2026"
                        className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-tiny font-medium text-content-secondary mb-1">
                      CGPA or Percentage <span className="text-content-tertiary">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={answers.cgpa || ''}
                      onChange={(e) => updateAnswers({ cgpa: e.target.value })}
                      placeholder="8.5 / 10"
                      className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-tiny font-medium text-content-secondary mb-1">
                      Relevant Coursework <span className="text-content-tertiary">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={answers.coursework || ''}
                      onChange={(e) => updateAnswers({ coursework: e.target.value })}
                      placeholder="Data Structures, Database Systems, Web Tech, Operating Systems"
                      className="w-full px-3 py-2 text-small border border-border-control rounded bg-surface-raised focus:outline-hidden focus:border-action-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Experience (Skippable) */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 3
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Work Experience
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Internships, part-time work, freelance, or college club roles.
                  </p>
                </div>

                <Banner
                  variant="info"
                  title="No formal experience yet? That's completely fine."
                  description="Freshers get hired for projects, coursework, and problem solving. You can skip directly to Projects."
                />

                {(answers.experiences || []).map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="p-4 border border-border-subtle rounded bg-surface-raised space-y-3 relative"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                        Experience #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = answers.experiences?.filter((e) => e.id !== exp.id);
                          updateAnswers({ experiences: updated });
                        }}
                        className="text-status-risk-content hover:underline text-tiny cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const list = [...(answers.experiences || [])];
                          list[idx].company = e.target.value;
                          updateAnswers({ experiences: list });
                        }}
                        placeholder="Company or Club Name"
                        className="px-2.5 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated"
                      />
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => {
                          const list = [...(answers.experiences || [])];
                          list[idx].role = e.target.value;
                          updateAnswers({ experiences: list });
                        }}
                        placeholder="Role / Title"
                        className="px-2.5 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated"
                      />
                    </div>

                    <textarea
                      rows={2}
                      value={exp.bullets.join('\n')}
                      onChange={(e) => {
                        const list = [...(answers.experiences || [])];
                        list[idx].bullets = e.target.value.split('\n').filter(Boolean);
                        updateAnswers({ experiences: list });
                      }}
                      placeholder="Key contributions (one bullet per line)"
                      className="w-full px-2.5 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated resize-none"
                    />
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newExp: ExperienceInput = {
                        id: `exp-${Date.now()}`,
                        company: '',
                        role: '',
                        location: '',
                        startDate: '',
                        endDate: '',
                        bullets: [],
                      };
                      updateAnswers({
                        experiences: [...(answers.experiences || []), newExp],
                      });
                    }}
                    className="px-3 py-1.5 rounded border border-border-control text-tiny font-medium text-content-primary hover:bg-surface-sunken flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add an Experience</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="text-tiny text-action-primary hover:underline cursor-pointer"
                  >
                    Skip to Projects →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Projects (The Core Step) */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 4 · Crucial for Freshers
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Projects You Built
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Final-year project, mini-projects, hackathons, open source, or side apps.
                  </p>
                </div>

                {(answers.projects || []).map((proj, pIdx) => (
                  <div
                    key={proj.id}
                    className="p-4 border border-border-subtle rounded bg-surface-raised space-y-3 relative"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                        Project #{pIdx + 1}
                      </span>
                      {answers.projects && answers.projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = answers.projects?.filter((p) => p.id !== proj.id);
                            updateAnswers({ projects: updated });
                          }}
                          className="text-status-risk-content hover:underline text-tiny cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Project Title *
                      </label>
                      <input
                        type="text"
                        value={proj.title}
                        onChange={(e) => {
                          const list = [...(answers.projects || [])];
                          list[pIdx].title = e.target.value;
                          updateAnswers({ projects: list });
                        }}
                        placeholder="e.g. Distributed Task Queue or Campus Marketplace"
                        className="w-full px-3 py-1.5 text-small border border-border-control rounded bg-surface-elevated"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-tiny font-medium text-content-secondary mb-1">
                          Tools & Technologies Used *
                        </label>
                        <input
                          type="text"
                          value={proj.tech}
                          onChange={(e) => {
                            const list = [...(answers.projects || [])];
                            list[pIdx].tech = e.target.value;
                            updateAnswers({ projects: list });
                          }}
                          placeholder="Python, Redis, Docker, React"
                          className="w-full px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated"
                        />
                      </div>
                      <div>
                        <label className="block text-tiny font-medium text-content-secondary mb-1">
                          Your Role
                        </label>
                        <input
                          type="text"
                          value={proj.role}
                          onChange={(e) => {
                            const list = [...(answers.projects || [])];
                            list[pIdx].role = e.target.value;
                            updateAnswers({ projects: list });
                          }}
                          placeholder="Solo Builder, Lead Backend"
                          className="w-full px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        In your own words, what did you build? *
                      </label>
                      <textarea
                        rows={3}
                        value={proj.description}
                        onChange={(e) => {
                          const list = [...(answers.projects || [])];
                          list[pIdx].description = e.target.value;
                          updateAnswers({ projects: list });
                        }}
                        placeholder="Explain the problem and what you built. No jargon needed—just what it does."
                        className="w-full px-3 py-2 text-tiny border border-border-control rounded bg-surface-elevated leading-relaxed"
                      />
                      {/* Non-AI Sentence Frame Helper */}
                      <div className="mt-1 flex items-start gap-1 text-tiny text-content-tertiary">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Sentence frame:</strong> &quot;Built [what] using [tools] so that [result].&quot;
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-tiny font-medium text-content-secondary mb-1">
                        Did you measure anything? <span className="text-content-tertiary">(Users, latency, accuracy, or time saved)</span>
                      </label>
                      <input
                        type="text"
                        value={proj.result}
                        onChange={(e) => {
                          const list = [...(answers.projects || [])];
                          list[pIdx].result = e.target.value;
                          updateAnswers({ projects: list });
                        }}
                        placeholder="If not, leave blank—we describe what you built honestly without invented numbers."
                        className="w-full px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-elevated"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const newProj: ProjectInput = {
                      id: `proj-${Date.now()}`,
                      title: '',
                      tech: '',
                      role: '',
                      description: '',
                      result: '',
                      link: '',
                    };
                    updateAnswers({
                      projects: [...(answers.projects || []), newProj],
                    });
                  }}
                  className="px-3 py-1.5 rounded border border-border-control text-tiny font-medium text-content-primary hover:bg-surface-sunken flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Project</span>
                </button>
              </div>
            )}

            {/* Step 5: Skills & Extras */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 5
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Skills & Achievements
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Rule: List only what you could confidently explain in an interview.
                  </p>
                </div>

                {/* Skills tags */}
                <div className="space-y-2">
                  <label className="block text-tiny font-medium text-content-secondary">
                    Skills & Technologies (Type and press Enter)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && skillInput.trim()) {
                          e.preventDefault();
                          if (!answers.skills?.includes(skillInput.trim())) {
                            updateAnswers({
                              skills: [...(answers.skills || []), skillInput.trim()],
                            });
                          }
                          setSkillInput('');
                        }
                      }}
                      placeholder="e.g. JavaScript, SQL, Git, React"
                      className="flex-1 px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-raised"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (skillInput.trim() && !answers.skills?.includes(skillInput.trim())) {
                          updateAnswers({
                            skills: [...(answers.skills || []), skillInput.trim()],
                          });
                          setSkillInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-surface-sunken border border-border-control text-tiny font-medium text-content-primary"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(answers.skills || []).map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-tiny bg-surface-sunken border border-border-subtle text-content-primary"
                      >
                        {sk}
                        <button
                          type="button"
                          onClick={() => {
                            updateAnswers({
                              skills: answers.skills?.filter((s) => s !== sk),
                            });
                          }}
                          className="hover:text-status-risk-content"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Certifications */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <label className="block text-tiny font-medium text-content-secondary">
                    Certifications <span className="text-content-tertiary">(Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={certInput}
                      onChange={(e) => setCertInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && certInput.trim()) {
                          e.preventDefault();
                          updateAnswers({
                            certifications: [...(answers.certifications || []), certInput.trim()],
                          });
                          setCertInput('');
                        }
                      }}
                      placeholder="e.g. AWS Certified Cloud Practitioner"
                      className="flex-1 px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-raised"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (certInput.trim()) {
                          updateAnswers({
                            certifications: [...(answers.certifications || []), certInput.trim()],
                          });
                          setCertInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-surface-sunken border border-border-control text-tiny font-medium text-content-primary"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="space-y-1 text-tiny text-content-secondary pl-4 list-disc">
                    {(answers.certifications || []).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                {/* Achievements */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <label className="block text-tiny font-medium text-content-secondary">
                    Honors & Achievements <span className="text-content-tertiary">(Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={achieveInput}
                      onChange={(e) => setAchieveInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && achieveInput.trim()) {
                          e.preventDefault();
                          updateAnswers({
                            achievements: [...(answers.achievements || []), achieveInput.trim()],
                          });
                          setAchieveInput('');
                        }
                      }}
                      placeholder="e.g. 1st Place in College Hackathon 2025"
                      className="flex-1 px-3 py-1.5 text-tiny border border-border-control rounded bg-surface-raised"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (achieveInput.trim()) {
                          updateAnswers({
                            achievements: [...(answers.achievements || []), achieveInput.trim()],
                          });
                          setAchieveInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-surface-sunken border border-border-control text-tiny font-medium text-content-primary"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="space-y-1 text-tiny text-content-secondary pl-4 list-disc">
                    {(answers.achievements || []).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Step 6: Review & Finalize */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                    Step 6 · Complete
                  </div>
                  <h1 className="text-h2 font-bold text-content-primary mt-1">
                    Your Fresher Resume is Ready
                  </h1>
                  <p className="text-small text-content-secondary mt-1">
                    Review your clean ATS format. When ready, save it or run your first job diagnostic.
                  </p>
                </div>

                {/* Format Checks Card */}
                <div className="p-4 border border-border-hairline rounded bg-surface-raised space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-small text-content-primary">
                      Format Health
                    </span>
                    <span className="font-mono text-tiny text-status-strong-content bg-status-strong-surface px-2 py-0.5 rounded">
                      {formatChecks.issuesCount === 0 ? 'Clean Format' : `${formatChecks.issuesCount} issues`}
                    </span>
                  </div>
                  <ul className="space-y-1 text-tiny text-content-secondary">
                    {formatChecks.checks.map((c) => (
                      <li key={c.id} className="flex items-center gap-1.5">
                        {c.level === 'pass' ? (
                          <Check className="w-3.5 h-3.5 text-status-strong-mark shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-status-caution-mark shrink-0" />
                        )}
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Actions */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isFinishing}
                    onClick={() => handleFinishResume('analyze')}
                    className="w-full py-3 px-4 rounded bg-action-primary hover:bg-action-primary-hover text-content-inverse font-semibold text-small flex items-center justify-center gap-2 cursor-pointer shadow-subtle transition-colors disabled:opacity-50"
                  >
                    {isFinishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSearch className="w-4 h-4" />
                    )}
                    <span>Analyze a Job with this Resume</span>
                  </button>

                  <button
                    type="button"
                    disabled={isFinishing}
                    onClick={() => handleFinishResume('resumes')}
                    className="w-full py-2.5 px-4 rounded border border-border-control hover:bg-surface-sunken text-content-primary font-medium text-small flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <span>Save to My Resumes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 mt-6 border-t border-border-hairline">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 rounded border border-border-control text-tiny font-medium text-content-secondary hover:text-content-primary hover:bg-surface-sunken flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 rounded bg-action-primary hover:bg-action-primary-hover text-content-inverse text-tiny font-semibold flex items-center gap-1.5 cursor-pointer shadow-subtle transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live A4 Document Preview (Desktop) */}
        <div className="hidden lg:flex flex-1 overflow-y-auto p-8 justify-center items-start bg-surface-page relative">
          <div className="w-full max-w-xl bg-surface-raised text-zinc-900 border border-border-subtle shadow-subtle p-10 space-y-4 text-tiny leading-relaxed font-sans">
            {/* Document Header */}
            <header className="text-center pb-3 border-b border-border-subtle">
              <h1 className="text-h2 font-bold tracking-tight uppercase text-content-primary">
                {liveTree.contact.name || 'YOUR NAME'}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-tiny text-content-secondary mt-1 font-mono">
                {liveTree.contact.location && <span>{liveTree.contact.location}</span>}
                {liveTree.contact.phone && <span>• {liveTree.contact.phone}</span>}
                {liveTree.contact.email && <span>• {liveTree.contact.email}</span>}
                {liveTree.contact.github && <span>• {liveTree.contact.github}</span>}
                {liveTree.contact.linkedin && <span>• {liveTree.contact.linkedin}</span>}
              </div>
            </header>

            {/* Summary */}
            {liveTree.summary && (
              <section>
                <h2 className="text-tiny font-bold uppercase tracking-wider border-b border-border-subtle pb-0.5 mb-1.5 text-content-primary">
                  Professional Summary
                </h2>
                <p className="text-content-secondary text-tiny leading-relaxed">
                  {liveTree.summary}
                </p>
              </section>
            )}

            {/* Education */}
            {liveTree.education.length > 0 && (
              <section>
                <h2 className="text-tiny font-bold uppercase tracking-wider border-b border-border-subtle pb-0.5 mb-1.5 text-content-primary">
                  Education
                </h2>
                {liveTree.education.map((edu) => (
                  <div key={edu.id} className="flex justify-between items-baseline text-tiny">
                    <div>
                      <span className="font-bold text-content-primary">{edu.school}</span>
                      <span className="text-content-secondary"> — {edu.degree}</span>
                      {edu.gpa && (
                        <span className="text-content-tertiary italic ml-1">· {edu.gpa}</span>
                      )}
                    </div>
                    {edu.year && (
                      <span className="font-mono text-content-tertiary text-tiny">{edu.year}</span>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Experience (if any) */}
            {liveTree.experience.length > 0 && (
              <section>
                <h2 className="text-tiny font-bold uppercase tracking-wider border-b border-border-subtle pb-0.5 mb-2 text-content-primary">
                  Experience
                </h2>
                <div className="space-y-3">
                  {liveTree.experience.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex justify-between items-baseline text-tiny">
                        <span className="font-bold text-content-primary">{exp.company}</span>
                        <span className="text-content-secondary font-medium">{exp.title}</span>
                      </div>
                      <ul className="list-disc list-outside pl-4 space-y-0.5 text-content-secondary text-tiny">
                        {exp.bullets.map((b) => (
                          <li key={b.id}>{b.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Projects */}
            {liveTree.projects.length > 0 && (
              <section>
                <h2 className="text-tiny font-bold uppercase tracking-wider border-b border-border-subtle pb-0.5 mb-2 text-content-primary">
                  Projects
                </h2>
                <div className="space-y-2.5">
                  {liveTree.projects.map((proj) => (
                    <div key={proj.id}>
                      <div className="flex justify-between items-baseline text-tiny">
                        <span className="font-bold text-content-primary">{proj.name}</span>
                        {proj.tech.length > 0 && (
                          <span className="font-mono text-content-tertiary text-tiny">
                            {proj.tech.join(', ')}
                          </span>
                        )}
                      </div>
                      <ul className="list-disc list-outside pl-4 space-y-0.5 text-content-secondary text-tiny">
                        {proj.bullets.map((b) => (
                          <li key={b.id}>{b.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Skills */}
            {liveTree.skills.length > 0 && (
              <section>
                <h2 className="text-tiny font-bold uppercase tracking-wider border-b border-border-subtle pb-0.5 mb-1 text-content-primary">
                  Skills & Technologies
                </h2>
                <p className="text-content-secondary text-tiny leading-relaxed">
                  {liveTree.skills.join(', ')}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        </div>
      )}
    </div>
  );
}
