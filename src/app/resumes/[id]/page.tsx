'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Dialog } from '@/design-system/patterns/Dialog';
import { Toast } from '@/design-system/primitives/Toast';
import { Banner } from '@/design-system/primitives/Banner';
import {
  ResumeTree,
  ResumeBullet,
  runFormatChecks,
} from '@trace/engine';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  GripVertical,
  HelpCircle,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
  X,
  Award,
  Trophy,
  BookOpen,
  Heart,
  Globe,
} from 'lucide-react';

const GithubIcon = () => (
  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.54a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26z" />
  </svg>
);

interface ResumeMetadata {
  id: string;
  title: string;
  source: 'uploaded' | 'built';
  isDefault: boolean;
  parseStatus: 'good' | 'needs_review' | 'failed';
  parseWarnings: string[];
  updatedAt: string;
  createdAt: string;
  fileName: string;
}

interface VersionItem {
  id: string;
  kind: 'original' | 'edited' | 'tailored';
  version_number: number;
  tree: ResumeTree;
  content_hash: string;
  created_at: string;
  application_id?: string;
  applicationTitle?: string;
}

export default function ResumeWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const resumeId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'edit' | 'original' | 'versions'>('edit');
  const [loading, setLoading] = useState(true);
  const [resumeMeta, setResumeMeta] = useState<ResumeMetadata | null>(null);
  const [tree, setTree] = useState<ResumeTree | null>(null);
  const [originalTree, setOriginalTree] = useState<ResumeTree | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [applications, setApplications] = useState<Array<{ id: string; role: string; company: string }>>([]);

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Save state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Accordion active section ('contact', 'summary', 'experience', 'projects', 'education', 'skills')
  const [activeAccordion, setActiveAccordion] = useState<string>('contact');

  // Optional section popover
  const [isOptionalPopoverOpen, setIsOptionalPopoverOpen] = useState(false);

  // Preview styling controls (from Stitch design floating pill)
  const [selectedFont, setSelectedFont] = useState<'font-sans' | 'font-serif' | 'font-mono'>('font-sans');
  const [accentColor, setAccentColor] = useState<'slate' | 'indigo' | 'emerald'>('slate');
  const [density, setDensity] = useState<'standard' | 'compact'>('standard');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const ACCENT_MAP = {
    slate: { text: 'var(--color-content-primary)', border: 'var(--color-border-control)' },
    indigo: { text: 'var(--color-action-primary-hover)', border: 'var(--color-action-focus-ring)' },
    emerald: { text: 'var(--color-status-strong-content)', border: 'var(--color-status-strong-border)' },
  };

  // Format checks (real-time pure function)
  const formatResults = useMemo(() => (tree ? runFormatChecks(tree) : null), [tree]);

  // Word count & estimated pages
  const wordCount = useMemo(() => {
    if (!tree) return 0;
    let text = `${tree.contact.name} ${tree.summary || ''} `;
    tree.experience.forEach((e) => {
      text += `${e.title} ${e.company} ${e.bullets.map((b) => b.text).join(' ')} `;
    });
    tree.projects.forEach((p) => {
      text += `${p.name} ${p.tech.join(' ')} ${p.bullets.map((b) => b.text).join(' ')} `;
    });
    tree.education.forEach((ed) => {
      text += `${ed.school} ${ed.degree} `;
    });
    text += `${tree.skills.join(' ')} `;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [tree]);

  // Format score (0-100) based on checks
  const atsScore = useMemo(() => {
    if (!formatResults) return 98;
    const deductions = formatResults.issuesCount * 8 + formatResults.opportunitiesCount * 2;
    return Math.max(65, 100 - deductions);
  }, [formatResults]);

  // AI Helper modal state
  const [suggestModal, setSuggestModal] = useState<{
    section: 'experience' | 'projects';
    itemId: string;
    bulletId: string;
    currentText: string;
    suggestion: string | null;
    isLoading: boolean;
    error: string | null;
  } | null>(null);

  const [questionsModal, setQuestionsModal] = useState<{
    section: 'experience' | 'projects';
    itemId: string;
    bulletId: string;
    originalText: string;
    questions: string[];
    answers: string[];
    isLoading: boolean;
    isSynthesizing: boolean;
    synthesizedResult: string | null;
    error: string | null;
  } | null>(null);

  // Diff comparison modal for versions tab
  const [diffVersion, setDiffVersion] = useState<VersionItem | null>(null);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Overflow menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchWorkspaceData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/resumes/${resumeId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/resumes');
          return;
        }
        throw new Error('Failed to load resume workspace');
      }

      const data = await res.json();
      setResumeMeta(data.resume);
      setTitleInput(data.resume.title);
      setTree(data.activeTree);
      setOriginalTree(data.originalTree);
      setCurrentVersion(data.currentVersionNumber || 1);
      setVersions(data.versions || []);
      setApplications(data.applications || []);
      setSaveStatus('saved');
      setConflictError(null);
    } catch {
      showToast('Error loading resume workspace.');
    } finally {
      setLoading(false);
    }
  }, [resumeId, router]);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await fetchWorkspaceData();
    }
    init();
  }, [fetchWorkspaceData, router, supabase]);

  // Save changes with optimistic concurrency
  const handleSaveTree = async (newTree: ResumeTree, newTitle?: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: newTree,
          expectedVersion: currentVersion,
          title: newTitle || resumeMeta?.title,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentVersion(data.versionNumber);
        setSaveStatus('saved');
        setConflictError(null);
        if (resumeMeta) {
          setResumeMeta({
            ...resumeMeta,
            updatedAt: data.updatedAt,
            title: newTitle || resumeMeta.title,
          });
        }
      } else if (res.status === 409) {
        setSaveStatus('unsaved');
        setConflictError(
          'Conflict: This resume was modified in another session. Please reload to see the latest version before saving.'
        );
      } else {
        setSaveStatus('unsaved');
        showToast(data.error || 'Failed to save changes.');
      }
    } catch {
      setSaveStatus('unsaved');
      showToast('Network error saving resume.');
    }
  };

  const updateTree = (updater: (prev: ResumeTree) => ResumeTree) => {
    if (!tree) return;
    const nextTree = updater(tree);
    setTree(nextTree);
    setSaveStatus('unsaved');
    handleSaveTree(nextTree);
  };

  // Section Accordion Toggle
  const toggleAccordion = (section: string) => {
    setActiveAccordion((curr) => (curr === section ? '' : section));
  };

  // Bullet manipulation
  const updateBullet = (
    section: 'experience' | 'projects',
    itemId: string,
    bulletId: string,
    newText: string
  ) => {
    updateTree((prev) => {
      if (section === 'experience') {
        return {
          ...prev,
          experience: prev.experience.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  bullets: item.bullets.map((b) => (b.id === bulletId ? { ...b, text: newText } : b)),
                }
              : item
          ),
        };
      } else {
        return {
          ...prev,
          projects: prev.projects.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  bullets: item.bullets.map((b) => (b.id === bulletId ? { ...b, text: newText } : b)),
                }
              : item
          ),
        };
      }
    });
  };

  const deleteBullet = (
    section: 'experience' | 'projects',
    itemId: string,
    bulletId: string
  ) => {
    updateTree((prev) => {
      if (section === 'experience') {
        return {
          ...prev,
          experience: prev.experience.map((item) =>
            item.id === itemId
              ? { ...item, bullets: item.bullets.filter((b) => b.id !== bulletId) }
              : item
          ),
        };
      } else {
        return {
          ...prev,
          projects: prev.projects.map((item) =>
            item.id === itemId
              ? { ...item, bullets: item.bullets.filter((b) => b.id !== bulletId) }
              : item
          ),
        };
      }
    });
  };

  const addBullet = (section: 'experience' | 'projects', itemId: string) => {
    const newBullet: ResumeBullet = {
      id: `bullet-${Date.now()}`,
      text: '',
    };
    updateTree((prev) => {
      if (section === 'experience') {
        return {
          ...prev,
          experience: prev.experience.map((item) =>
            item.id === itemId
              ? { ...item, bullets: [...item.bullets, newBullet] }
              : item
          ),
        };
      } else {
        return {
          ...prev,
          projects: prev.projects.map((item) =>
            item.id === itemId
              ? { ...item, bullets: [...item.bullets, newBullet] }
              : item
          ),
        };
      }
    });
  };

  // AI Helper: Suggest Wording
  const openSuggestModal = async (
    section: 'experience' | 'projects',
    itemId: string,
    bulletId: string,
    currentText: string
  ) => {
    setSuggestModal({
      section,
      itemId,
      bulletId,
      currentText,
      suggestion: null,
      isLoading: true,
      error: null,
    });

    try {
      const res = await fetch(`/api/resumes/${resumeId}/helpers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-wording',
          bulletText: currentText,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuggestModal((prev) =>
          prev
            ? {
                ...prev,
                suggestion: data.suggestion,
                isLoading: false,
              }
            : null
        );
      } else {
        setSuggestModal((prev) =>
          prev
            ? {
                ...prev,
                isLoading: false,
                error: data.error || 'Failed to generate wording suggestion.',
              }
            : null
        );
      }
    } catch {
      setSuggestModal((prev) =>
        prev
          ? {
              ...prev,
              isLoading: false,
              error: 'Network error calling suggestion helper.',
            }
          : null
      );
    }
  };

  // AI Helper: Ask Me Questions
  const openQuestionsModal = async (
    section: 'experience' | 'projects',
    itemId: string,
    bulletId: string,
    currentText: string
  ) => {
    setQuestionsModal({
      section,
      itemId,
      bulletId,
      originalText: currentText,
      questions: [],
      answers: ['', '', ''],
      isLoading: true,
      isSynthesizing: false,
      synthesizedResult: null,
      error: null,
    });

    try {
      const res = await fetch(`/api/resumes/${resumeId}/helpers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask-questions',
          bulletText: currentText,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setQuestionsModal((prev) =>
          prev
            ? {
                ...prev,
                questions: data.questions || [],
                answers: new Array(data.questions?.length || 3).fill(''),
                isLoading: false,
              }
            : null
        );
      } else {
        setQuestionsModal((prev) =>
          prev
            ? {
                ...prev,
                isLoading: false,
                error: data.error || 'Failed to generate questions.',
              }
            : null
        );
      }
    } catch {
      setQuestionsModal((prev) =>
        prev
          ? {
              ...prev,
              isLoading: false,
              error: 'Network error fetching questions.',
            }
          : null
      );
    }
  };

  const handleSynthesizeAnswers = async () => {
    if (!questionsModal) return;
    setQuestionsModal((prev) => (prev ? { ...prev, isSynthesizing: true, error: null } : null));

    try {
      const res = await fetch(`/api/resumes/${resumeId}/helpers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply-answers',
          originalBullet: questionsModal.originalText,
          questions: questionsModal.questions,
          answers: questionsModal.answers,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setQuestionsModal((prev) =>
          prev
            ? {
                ...prev,
                isSynthesizing: false,
                synthesizedResult: data.newBullet,
              }
            : null
        );
      } else {
        setQuestionsModal((prev) =>
          prev
            ? {
                ...prev,
                isSynthesizing: false,
                error: data.error || 'Failed to synthesize bullet.',
              }
            : null
        );
      }
    } catch {
      setQuestionsModal((prev) =>
        prev
          ? {
              ...prev,
              isSynthesizing: false,
              error: 'Network error synthesizing bullet.',
            }
          : null
      );
    }
  };

  const handleTitleSubmit = () => {
    if (!titleInput.trim()) return;
    setIsEditingTitle(false);
    if (tree && titleInput.trim() !== resumeMeta?.title) {
      handleSaveTree(tree, titleInput.trim());
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/resumes/${resumeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Resume duplicated.');
        router.push(`/resumes/${data.duplicatedResume.id}`);
      } else {
        showToast(data.error || 'Failed to duplicate resume.');
      }
    } catch {
      showToast('Network error duplicating resume.');
    }
  };

  const handleSetDefault = async () => {
    try {
      const res = await fetch(`/api/resumes/${resumeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default' }),
      });
      if (res.ok) {
        showToast('Set as default resume.');
        setIsMenuOpen(false);
        if (resumeMeta) setResumeMeta({ ...resumeMeta, isDefault: true });
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to set default.');
      }
    } catch {
      showToast('Network error setting default.');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Resume deleted.');
        router.push('/resumes');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete resume.');
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const handleRestoreVersion = async (version: VersionItem) => {
    setTree(version.tree);
    await handleSaveTree(version.tree);
    setDiffVersion(null);
    setActiveTab('edit');
    showToast(`Restored version ${version.version_number}.`);
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-surface-page flex flex-col justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary mb-3" />
        <p className="text-small font-mono text-content-secondary">
          Loading resume builder studio...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen bg-surface-page flex flex-col overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          type="success"
        />
      )}

      {/* ========================================================================= */}
      {/* 1. ZERO-CLUTTER TOP BAR (Stitch Spec)                                     */}
      {/* ========================================================================= */}
      <header className="h-14 border-b border-border-hairline bg-surface-elevated px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        {/* Left: Back Link, Title, Status & Version */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/resumes"
            className="p-1.5 text-content-secondary hover:text-content-primary hover:bg-surface-sunken rounded-(--radius-control) transition-colors shrink-0"
            title="Back to Resumes"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-7 h-7 rounded bg-action-primary flex items-center justify-center text-white font-semibold text-tiny tracking-wider shrink-0">
            T
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSubmit();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  onBlur={handleTitleSubmit}
                  autoFocus
                  className="text-small font-semibold text-content-primary bg-surface-page border border-action-primary rounded px-2 py-0.5 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleTitleSubmit}
                  className="p-1 text-action-primary hover:bg-surface-sunken rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  onClick={() => {
                    setTitleInput(resumeMeta?.title || '');
                    setIsEditingTitle(true);
                  }}
                  className="font-semibold text-small text-content-primary hover:bg-surface-sunken rounded px-1.5 py-0.5 cursor-pointer truncate"
                  title="Click to rename"
                >
                  {resumeMeta?.title}
                </span>
                <span className="text-tiny text-content-tertiary font-mono hidden sm:inline">
                  • Draft v{currentVersion}.0
                </span>
              </div>
            )}

            {/* Saved Indicator Badge */}
            <span
              className={`inline-flex items-center text-tiny font-medium px-2 py-0.5 rounded-full transition-opacity ${
                saveStatus === 'saving'
                  ? 'bg-surface-sunken text-content-secondary'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 mr-1 stroke-2" />
                  Saved
                </>
              )}
            </span>
          </div>
        </div>

        {/* Center: Tabs Switcher (Edit · Original · Versions) */}
        <div className="hidden md:flex items-center gap-1 bg-surface-sunken p-0.5 rounded-(--radius-control) border border-border-hairline text-tiny font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'edit'
                ? 'bg-surface-elevated text-content-primary shadow-subtle'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Edit Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('original')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'original'
                ? 'bg-surface-elevated text-content-primary shadow-subtle'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${
              activeTab === 'versions'
                ? 'bg-surface-elevated text-content-primary shadow-subtle'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <span>Versions</span>
            <span className="font-mono text-tiny px-1 rounded-full bg-surface-sunken">
              {versions.length}
            </span>
          </button>
        </div>

        {/* Right: ATS Score Pill, Export PDF, Options */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* ATS Score Pill */}
          <button
            type="button"
            onClick={() => setActiveAccordion('audit')}
            className="hidden sm:flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-tiny font-semibold px-2.5 py-1 rounded-full transition-colors"
            title="ATS Compatibility Score"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>ATS {atsScore}/100</span>
          </button>

          {/* Primary CTA: Export PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 bg-action-primary hover:bg-action-primary-hover active:scale-95 text-white text-tiny font-medium px-3 py-1.5 rounded-(--radius-control) shadow-subtle transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          {/* Overflow Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 text-content-secondary hover:text-content-primary hover:bg-surface-sunken rounded-(--radius-control) border border-border-subtle"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-elevated border border-border-hairline rounded-(--radius-control) shadow-subtle py-1 z-40 text-small">
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                >
                  <Copy className="w-3.5 h-3.5 text-content-tertiary" />
                  <span>Duplicate</span>
                </button>
                {!resumeMeta?.isDefault && (
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                  >
                    <Star className="w-3.5 h-3.5 text-content-tertiary" />
                    <span>Set as default</span>
                  </button>
                )}
                <div className="border-t border-border-hairline my-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDeleteOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-action-danger flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Conflict Warning Banner */}
      {conflictError && (
        <div className="px-6 py-2 border-b border-border-hairline bg-surface-elevated">
          <Banner
            variant="caution"
            title="Conflict detected"
            description={conflictError}
            actionLabel="Reload Workspace"
            onAction={fetchWorkspaceData}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WORKSPACE SPLIT: 45% LEFT EDITOR | 55% RIGHT A4 PREVIEW (Stitch Spec) */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden">
        {/* TAB 1: EDIT WORKSPACE */}
        {activeTab === 'edit' && tree && (
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden w-full">
            {/* =================================================================== */}
            {/* LEFT EDITOR PANEL (45% width, scrollable, progressive disclosure)   */}
            {/* =================================================================== */}
            <section className="w-full lg:w-[45%] border-r border-border-hairline bg-surface-page flex flex-col h-full overflow-hidden">
              {/* Top Sub-Header */}
              <div className="px-6 py-3 border-b border-border-hairline bg-surface-sunken/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider font-mono">
                    Editor Workspace
                  </span>
                  <span className="text-tiny text-content-tertiary">
                    • Single-section focus active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateTree((prev) => ({
                        ...prev,
                        summary: '',
                        experience: [],
                        projects: [],
                        education: [],
                        skills: [],
                      }));
                      showToast('Cleared sections');
                    }}
                    className="text-tiny text-content-secondary hover:text-action-danger font-medium"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {/* Accordion Stepper Scroll Area */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                {/* 1. Header & Contact Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('contact')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Header & Contact
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary font-mono">
                        {tree.contact.name || 'Name'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'contact' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'contact' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-3 text-small">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-tiny font-medium text-content-secondary mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={tree.contact.name}
                            onChange={(e) =>
                              updateTree((prev) => ({
                                ...prev,
                                contact: { ...prev.contact, name: e.target.value },
                              }))
                            }
                            className="w-full text-small text-content-primary px-3 py-1.5 border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                            placeholder="e.g. Alex Chen"
                          />
                        </div>
                        <div>
                          <label className="block text-tiny font-medium text-content-secondary mb-1">
                            Location
                          </label>
                          <input
                            type="text"
                            value={tree.contact.location || ''}
                            onChange={(e) =>
                              updateTree((prev) => ({
                                ...prev,
                                contact: { ...prev.contact, location: e.target.value },
                              }))
                            }
                            className="w-full text-small text-content-primary px-3 py-1.5 border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                            placeholder="City, Country"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-tiny font-medium text-content-secondary mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={tree.contact.email || ''}
                            onChange={(e) =>
                              updateTree((prev) => ({
                                ...prev,
                                contact: { ...prev.contact, email: e.target.value },
                              }))
                            }
                            className="w-full text-small text-content-primary px-3 py-1.5 border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                            placeholder="you@domain.com"
                          />
                        </div>
                        <div>
                          <label className="block text-tiny font-medium text-content-secondary mb-1">
                            Phone
                          </label>
                          <input
                            type="text"
                            value={tree.contact.phone || ''}
                            onChange={(e) =>
                              updateTree((prev) => ({
                                ...prev,
                                contact: { ...prev.contact, phone: e.target.value },
                              }))
                            }
                            className="w-full text-small text-content-primary px-3 py-1.5 border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>

                      {/* Links */}
                      <div>
                        <label className="block text-tiny font-medium text-content-secondary mb-1">
                          Links & Profiles
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-content-tertiary">
                              <GithubIcon />
                            </span>
                            <input
                              type="text"
                              value={tree.contact.github || ''}
                              onChange={(e) =>
                                updateTree((prev) => ({
                                  ...prev,
                                  contact: { ...prev.contact, github: e.target.value },
                                }))
                              }
                              className="w-full pl-8 pr-2 py-1.5 text-tiny text-content-primary border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                              placeholder="github.com/handle"
                            />
                          </div>

                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-content-tertiary">
                              <LinkedinIcon />
                            </span>
                            <input
                              type="text"
                              value={tree.contact.linkedin || ''}
                              onChange={(e) =>
                                updateTree((prev) => ({
                                  ...prev,
                                  contact: { ...prev.contact, linkedin: e.target.value },
                                }))
                              }
                              className="w-full pl-8 pr-2 py-1.5 text-tiny text-content-primary border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                              placeholder="linkedin.com/in/handle"
                            />
                          </div>

                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-content-tertiary">
                              <Globe className="w-3.5 h-3.5" />
                            </span>
                            <input
                              type="text"
                              value={tree.contact.website || ''}
                              onChange={(e) =>
                                updateTree((prev) => ({
                                  ...prev,
                                  contact: { ...prev.contact, website: e.target.value },
                                }))
                              }
                              className="w-full pl-8 pr-2 py-1.5 text-tiny text-content-primary border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary"
                              placeholder="portfolio.com"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Professional Summary Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('summary')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Professional Summary
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary font-mono">
                        {(tree.summary || '').length} chars
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'summary' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'summary' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-2.5">
                      <div className="flex items-center justify-between text-tiny">
                        <span className="text-content-secondary">
                          Concise 2–3 sentence value proposition
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!tree.summary) return;
                            openSuggestModal('experience', 'summary', 'sum', tree.summary);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-action-primary bg-surface-selected hover:bg-surface-sunken px-2 py-0.5 rounded border border-action-primary/20 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>AI Polish</span>
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={tree.summary || ''}
                        onChange={(e) =>
                          updateTree((prev) => ({ ...prev, summary: e.target.value }))
                        }
                        placeholder="Target: 250–400 characters focusing on domain, stack, and proven engineering impact..."
                        className="w-full text-small text-content-primary p-3 border border-border-subtle rounded bg-surface-elevated focus:outline-hidden focus:border-action-primary resize-y leading-relaxed"
                      />
                      <div className="flex items-center justify-between text-tiny text-content-tertiary font-mono">
                        <span>Target: 250–400 chars (Optimal for ATS readability)</span>
                        <span
                          className={
                            (tree.summary || '').length > 450
                              ? 'text-action-danger font-medium'
                              : 'text-emerald-600 font-medium'
                          }
                        >
                          {(tree.summary || '').length} / 450
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Work Experience Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('experience')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Experience
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary">
                        {tree.experience.length} {tree.experience.length === 1 ? 'Role' : 'Roles'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'experience' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'experience' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-4">
                      {tree.experience.map((exp) => (
                        <div
                          key={exp.id}
                          className="border border-border-hairline rounded-(--radius-control) p-3 bg-surface-elevated space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Job Title
                              </label>
                              <input
                                type="text"
                                value={exp.title}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((i) =>
                                      i.id === exp.id ? { ...i, title: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Company
                              </label>
                              <input
                                type="text"
                                value={exp.company}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((i) =>
                                      i.id === exp.id ? { ...i, company: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Dates
                              </label>
                              <input
                                type="text"
                                value={exp.startDate || ''}
                                placeholder="e.g. 2024 — Present"
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((i) =>
                                      i.id === exp.id ? { ...i, startDate: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small font-mono px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Location
                              </label>
                              <input
                                type="text"
                                value={exp.location || ''}
                                placeholder="City, State"
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((i) =>
                                      i.id === exp.id ? { ...i, location: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                          </div>

                          {/* Bullets with metric rewrite */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-tiny font-medium text-content-secondary">
                                Key Achievements (Metrics-focused)
                              </label>
                              <button
                                type="button"
                                onClick={() => addBullet('experience', exp.id)}
                                className="text-tiny text-action-primary hover:underline font-medium flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Bullet
                              </button>
                            </div>

                            <div className="space-y-2">
                              {exp.bullets.map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-start gap-2 bg-surface-page p-2 rounded border border-border-hairline group"
                                >
                                  <GripVertical className="w-3.5 h-3.5 text-content-tertiary mt-2 shrink-0" />
                                  <div className="relative flex-1">
                                    <textarea
                                      rows={2}
                                      value={b.text}
                                      placeholder="Engineered service with metric outcome..."
                                      onChange={(e) =>
                                        updateBullet('experience', exp.id, b.id, e.target.value)
                                      }
                                      className="w-full text-small pl-2.5 pr-14 py-1.5 border border-border-subtle rounded bg-surface-elevated text-content-primary focus:outline-hidden focus:border-action-primary resize-y"
                                    />
                                    <div className="absolute right-2 top-2 flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openSuggestModal('experience', exp.id, b.id, b.text)
                                        }
                                        className="text-content-tertiary hover:text-action-primary p-1"
                                        title="Rewrite with metrics"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openQuestionsModal('experience', exp.id, b.id, b.text)
                                        }
                                        className="text-content-tertiary hover:text-action-primary p-1"
                                        title="Ask me questions"
                                      >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteBullet('experience', exp.id, b.id)}
                                    className="text-content-tertiary hover:text-action-danger p-1 mt-1 shrink-0"
                                    title="Delete bullet"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          updateTree((prev) => ({
                            ...prev,
                            experience: [
                              ...prev.experience,
                              {
                                id: `exp-${Date.now()}`,
                                company: 'Company Name',
                                title: 'Software Engineer',
                                startDate: '2024 — Present',
                                bullets: [{ id: `b-${Date.now()}`, text: '' }],
                              },
                            ],
                          }))
                        }
                        className="w-full py-2 border border-dashed border-border-subtle hover:border-action-primary text-content-secondary hover:text-action-primary text-tiny font-medium rounded-(--radius-control) flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Position</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Projects Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('projects')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Projects
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary font-mono">
                        {tree.projects.length} Featured
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'projects' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'projects' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-4">
                      {tree.projects.map((proj) => (
                        <div
                          key={proj.id}
                          className="border border-border-hairline rounded-(--radius-control) p-3 bg-surface-elevated space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Project Name
                              </label>
                              <input
                                type="text"
                                value={proj.name}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    projects: prev.projects.map((p) =>
                                      p.id === proj.id ? { ...p, name: e.target.value } : p
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Tech Stack (comma separated)
                              </label>
                              <input
                                type="text"
                                value={proj.tech.join(', ')}
                                onChange={(e) => {
                                  const list = e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  updateTree((prev) => ({
                                    ...prev,
                                    projects: prev.projects.map((p) =>
                                      p.id === proj.id ? { ...p, tech: list } : p
                                    ),
                                  }));
                                }}
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-tiny">
                              <span className="font-medium text-content-secondary">
                                Impact Bullets
                              </span>
                              <button
                                type="button"
                                onClick={() => addBullet('projects', proj.id)}
                                className="text-action-primary hover:underline font-medium flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Bullet
                              </button>
                            </div>
                            {proj.bullets.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-start gap-2 bg-surface-page p-2 rounded border border-border-hairline"
                              >
                                <textarea
                                  rows={2}
                                  value={b.text}
                                  onChange={(e) =>
                                    updateBullet('projects', proj.id, b.id, e.target.value)
                                  }
                                  className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-elevated text-content-primary resize-y"
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteBullet('projects', proj.id, b.id)}
                                  className="text-content-tertiary hover:text-action-danger p-1 mt-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          updateTree((prev) => ({
                            ...prev,
                            projects: [
                              ...prev.projects,
                              {
                                id: `proj-${Date.now()}`,
                                name: 'New Project',
                                tech: ['Go', 'PostgreSQL'],
                                bullets: [{ id: `pb-${Date.now()}`, text: '' }],
                              },
                            ],
                          }))
                        }
                        className="w-full py-2 border border-dashed border-border-subtle hover:border-action-primary text-content-secondary hover:text-action-primary text-tiny font-medium rounded-(--radius-control) flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Project</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. Education Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('education')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Education
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary font-mono">
                        {tree.education[0]?.degree || 'B.S. CS'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'education' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'education' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-3">
                      {tree.education.map((edu) => (
                        <div
                          key={edu.id}
                          className="border border-border-hairline rounded-(--radius-control) p-3 bg-surface-elevated space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Degree
                              </label>
                              <input
                                type="text"
                                value={edu.degree}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    education: prev.education.map((i) =>
                                      i.id === edu.id ? { ...i, degree: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Institution
                              </label>
                              <input
                                type="text"
                                value={edu.school}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    education: prev.education.map((i) =>
                                      i.id === edu.id ? { ...i, school: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                Graduation Year
                              </label>
                              <input
                                type="text"
                                value={edu.year || ''}
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    education: prev.education.map((i) =>
                                      i.id === edu.id ? { ...i, year: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small font-mono px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-tiny font-medium text-content-secondary mb-0.5">
                                GPA / Honors (Optional)
                              </label>
                              <input
                                type="text"
                                value={edu.gpa || ''}
                                placeholder="e.g. 3.8 GPA"
                                onChange={(e) =>
                                  updateTree((prev) => ({
                                    ...prev,
                                    education: prev.education.map((i) =>
                                      i.id === edu.id ? { ...i, gpa: e.target.value } : i
                                    ),
                                  }))
                                }
                                className="w-full text-small px-2.5 py-1.5 border border-border-subtle rounded bg-surface-page text-content-primary"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Skills & Technologies Accordion Item */}
                <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated shadow-subtle transition-all">
                  <div
                    onClick={() => toggleAccordion('skills')}
                    className="flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface-sunken cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-content-tertiary" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-tiny font-semibold text-content-primary uppercase tracking-wider">
                        Skills & Technologies
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tiny text-content-tertiary font-mono">
                        {tree.skills.length} Skills
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-content-tertiary transition-transform ${
                          activeAccordion === 'skills' ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {activeAccordion === 'skills' && (
                    <div className="px-5 py-4 border-t border-border-hairline bg-surface-page space-y-3">
                      <label className="block text-tiny font-medium text-content-secondary">
                        Key Technologies & Frameworks (Click to remove, type to add)
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2.5 border border-border-subtle rounded bg-surface-elevated">
                        {tree.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center text-tiny bg-surface-page text-content-primary px-2.5 py-1 rounded border border-border-hairline"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateTree((prev) => ({
                                  ...prev,
                                  skills: prev.skills.filter((s) => s !== skill),
                                }))
                              }
                              className="ml-1.5 text-content-tertiary hover:text-content-primary"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="+ Type & Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              const val = e.currentTarget.value.trim();
                              if (!tree.skills.includes(val)) {
                                updateTree((prev) => ({ ...prev, skills: [...prev.skills, val] }));
                              }
                              e.currentTarget.value = '';
                            }
                          }}
                          className="text-tiny bg-transparent border-none outline-none py-1 px-1.5 text-content-primary w-28"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. "+ Add Optional Section" Drawer (Anti-Clutter Rule from Stitch) */}
                <div className="pt-2 relative">
                  <button
                    type="button"
                    onClick={() => setIsOptionalPopoverOpen(!isOptionalPopoverOpen)}
                    className="w-full py-2.5 px-4 bg-surface-sunken hover:bg-surface-selected border border-border-hairline text-content-primary hover:text-action-primary text-tiny font-medium rounded-(--radius-control) flex items-center justify-center gap-2 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4 text-action-primary" />
                    <span>+ Add Optional Section</span>
                  </button>

                  {isOptionalPopoverOpen && (
                    <div className="absolute left-0 right-0 bottom-12 bg-surface-elevated rounded-(--radius-control) shadow-subtle border border-border-subtle p-2 z-20 space-y-1">
                      <div className="px-3 py-1.5 text-tiny font-semibold text-content-tertiary uppercase tracking-wider font-mono">
                        Select Optional Section
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionalPopoverOpen(false);
                          showToast('Added Certifications section');
                        }}
                        className="w-full text-left px-3 py-2 text-tiny text-content-primary hover:bg-surface-sunken rounded flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-content-tertiary" />
                          <span>Certifications</span>
                        </span>
                        <span className="text-tiny text-content-tertiary">AWS, GCP, CKA</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionalPopoverOpen(false);
                          showToast('Added Awards & Honors section');
                        }}
                        className="w-full text-left px-3 py-2 text-tiny text-content-primary hover:bg-surface-sunken rounded flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-content-tertiary" />
                          <span>Awards & Honors</span>
                        </span>
                        <span className="text-tiny text-content-tertiary">Hackathons, Dean&apos;s List</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionalPopoverOpen(false);
                          showToast('Added Publications section');
                        }}
                        className="w-full text-left px-3 py-2 text-tiny text-content-primary hover:bg-surface-sunken rounded flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-content-tertiary" />
                          <span>Publications</span>
                        </span>
                        <span className="text-tiny text-content-tertiary">Papers & Preprints</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionalPopoverOpen(false);
                          showToast('Added Volunteering section');
                        }}
                        className="w-full text-left px-3 py-2 text-tiny text-content-primary hover:bg-surface-sunken rounded flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Heart className="w-3.5 h-3.5 text-content-tertiary" />
                          <span>Volunteering</span>
                        </span>
                        <span className="text-tiny text-content-tertiary">Community & Mentoring</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Left Panel Bottom Quick Audit Status */}
              <div className="p-3 border-t border-border-hairline bg-surface-sunken flex items-center justify-between text-tiny text-content-secondary shrink-0 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>
                    ATS Check: <strong>Single-Column Strict</strong>
                  </span>
                </div>
                <div className="text-content-tertiary">
                  {wordCount} Words (Target: 450–550)
                </div>
              </div>
            </section>

            {/* =================================================================== */}
            {/* RIGHT LIVE A4 PREVIEW CANVAS (55% width, Stitch Spec)               */}
            {/* =================================================================== */}
            <section className="w-full lg:w-[55%] bg-surface-sunken/60 flex flex-col h-full overflow-hidden relative">
              {/* Top Canvas Helper Header */}
              <div className="h-10 px-6 border-b border-border-hairline bg-surface-elevated/70 backdrop-blur-xs flex items-center justify-between shrink-0 text-tiny text-content-secondary">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-medium text-content-primary">Live A4 Canvas</span>
                  <span className="text-content-tertiary">•</span>
                  <span className="text-emerald-700 font-medium">1 Page Target</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-tiny">
                  <span className="text-content-tertiary">210mm × 297mm</span>
                  <span className="text-content-tertiary">•</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="hover:text-content-primary text-content-secondary"
                  >
                    {zoomLevel}% Fit
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Viewport */}
              <div className="flex-1 overflow-y-auto overflow-x-auto p-6 md:p-8 flex justify-center items-start relative">
                {/* THE A4 SHEET (1:1 standard dimensions) */}
                <article
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top center',
                    minHeight: 750,
                  }}
                  className={`w-full max-w-xl min-h-full bg-white text-zinc-900 border border-border-subtle shadow-subtle ${selectedFont} ${
                    density === 'compact' ? 'p-8 space-y-3' : 'p-10 space-y-4'
                  } transition-all duration-150 leading-relaxed text-tiny`}
                >
                  {/* Document Header */}
                  <header className="text-center pb-3 border-b border-zinc-200">
                    <h1
                      className="text-h2 font-bold tracking-tight uppercase"
                      style={{ color: ACCENT_MAP[accentColor].text }}
                    >
                      {tree.contact.name || 'YOUR NAME'}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-tiny text-zinc-600 mt-1 font-mono">
                      {tree.contact.location && <span>{tree.contact.location}</span>}
                      {tree.contact.phone && <span>• {tree.contact.phone}</span>}
                      {tree.contact.email && <span>• {tree.contact.email}</span>}
                      {tree.contact.github && <span>• {tree.contact.github}</span>}
                      {tree.contact.linkedin && <span>• {tree.contact.linkedin}</span>}
                    </div>
                  </header>

                  {/* Summary */}
                  {tree.summary && (
                    <section>
                      <h2
                        className="text-tiny font-bold uppercase tracking-wider border-b pb-0.5 mb-1.5"
                        style={{ color: ACCENT_MAP[accentColor].text, borderColor: ACCENT_MAP[accentColor].border }}
                      >
                        Professional Summary
                      </h2>
                      <p className="text-zinc-700 text-tiny leading-relaxed">
                        {tree.summary}
                      </p>
                    </section>
                  )}

                  {/* Experience */}
                  {tree.experience.length > 0 && (
                    <section>
                      <h2
                        className="text-tiny font-bold uppercase tracking-wider border-b pb-0.5 mb-2"
                        style={{ color: ACCENT_MAP[accentColor].text, borderColor: ACCENT_MAP[accentColor].border }}
                      >
                        Experience
                      </h2>
                      <div className="space-y-3">
                        {tree.experience.map((exp) => (
                          <div key={exp.id}>
                            <div className="flex justify-between items-baseline text-tiny">
                              <div>
                                <span className="font-bold text-zinc-900">{exp.company}</span>
                                <span className="text-zinc-600 italic"> — {exp.title}</span>
                              </div>
                              <span className="font-mono text-zinc-500 text-tiny">
                                {exp.startDate} {exp.endDate ? `— ${exp.endDate}` : ''}
                              </span>
                            </div>
                            {exp.location && (
                              <div className="text-tiny text-zinc-500 font-mono mb-1">
                                {exp.location}
                              </div>
                            )}
                            <ul className="list-disc list-outside pl-4 space-y-1 text-zinc-700 text-tiny">
                              {exp.bullets.map((b) => (
                                <li key={b.id}>{b.text || '(Drafting bullet)'}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Projects */}
                  {tree.projects.length > 0 && (
                    <section>
                      <h2
                        className="text-tiny font-bold uppercase tracking-wider border-b pb-0.5 mb-2"
                        style={{ color: ACCENT_MAP[accentColor].text, borderColor: ACCENT_MAP[accentColor].border }}
                      >
                        Projects
                      </h2>
                      <div className="space-y-2.5">
                        {tree.projects.map((proj) => (
                          <div key={proj.id}>
                            <div className="flex justify-between items-baseline text-tiny">
                              <span className="font-bold text-zinc-900">{proj.name}</span>
                              {proj.tech.length > 0 && (
                                <span className="font-mono text-zinc-500 text-tiny">
                                  {proj.tech.join(', ')}
                                </span>
                              )}
                            </div>
                            <ul className="list-disc list-outside pl-4 space-y-0.5 text-zinc-700 text-tiny">
                              {proj.bullets.map((b) => (
                                <li key={b.id}>{b.text}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Education */}
                  {tree.education.length > 0 && (
                    <section>
                      <h2
                        className="text-tiny font-bold uppercase tracking-wider border-b pb-0.5 mb-1.5"
                        style={{ color: ACCENT_MAP[accentColor].text, borderColor: ACCENT_MAP[accentColor].border }}
                      >
                        Education
                      </h2>
                      <div className="space-y-1">
                        {tree.education.map((edu) => (
                          <div
                            key={edu.id}
                            className="flex justify-between items-baseline text-tiny"
                          >
                            <div>
                              <span className="font-bold text-zinc-900">{edu.school}</span>
                              <span className="text-zinc-600"> — {edu.degree}</span>
                              {edu.gpa && (
                                <span className="text-zinc-500 italic ml-1">· {edu.gpa}</span>
                              )}
                            </div>
                            {edu.year && (
                              <span className="font-mono text-zinc-500 text-tiny">
                                {edu.year}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Skills */}
                  {tree.skills.length > 0 && (
                    <section>
                      <h2
                        className="text-tiny font-bold uppercase tracking-wider border-b pb-0.5 mb-1"
                        style={{ color: ACCENT_MAP[accentColor].text, borderColor: ACCENT_MAP[accentColor].border }}
                      >
                        Skills & Technologies
                      </h2>
                      <p className="text-zinc-700 text-tiny leading-relaxed">
                        {tree.skills.join(', ')}
                      </p>
                    </section>
                  )}
                </article>
              </div>

              {/* ================================================================= */}
              {/* 3. MINIMALIST FLOATING DESIGN CONTROLS PILL (Stitch Spec)          */}
              {/* ================================================================= */}
              <aside className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-surface-elevated/95 backdrop-blur-md border border-border-hairline shadow-subtle rounded-full px-4 py-2 flex items-center gap-4 select-none">
                {/* Control 1: Font Family */}
                <div className="flex items-center gap-1.5 border-r border-border-hairline pr-3">
                  <Type className="w-3.5 h-3.5 text-content-tertiary" />
                  <select
                    value={selectedFont}
                    onChange={(e) =>
                      setSelectedFont(e.target.value as 'font-sans' | 'font-serif' | 'font-mono')
                    }
                    className="text-tiny font-medium text-content-primary bg-transparent outline-none cursor-pointer pr-1"
                  >
                    <option value="font-sans">Geist (Sans)</option>
                    <option value="font-serif">Source Serif (Editorial)</option>
                    <option value="font-mono">JetBrains Mono (Tech)</option>
                  </select>
                </div>

                {/* Control 2: Accent Color Swatches */}
                <div className="flex items-center gap-2 border-r border-border-hairline pr-3">
                  <span className="text-tiny font-medium text-content-tertiary">Accent:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAccentColor('slate')}
                      className={`w-4 h-4 rounded-full bg-content-primary transition-all ${
                        accentColor === 'slate' ? 'ring-2 ring-offset-1 ring-content-primary' : ''
                      }`}
                      title="Monochrome Slate"
                    />
                    <button
                      type="button"
                      onClick={() => setAccentColor('indigo')}
                      className={`w-4 h-4 rounded-full bg-action-primary-hover transition-all ${
                        accentColor === 'indigo' ? 'ring-2 ring-offset-1 ring-action-primary-hover' : ''
                      }`}
                      title="Slate Navy / Indigo"
                    />
                    <button
                      type="button"
                      onClick={() => setAccentColor('emerald')}
                      className={`w-4 h-4 rounded-full bg-status-strong-content transition-all ${
                        accentColor === 'emerald' ? 'ring-2 ring-offset-1 ring-status-strong-content' : ''
                      }`}
                      title="Deep Emerald"
                    />
                  </div>
                </div>

                {/* Control 3: Density Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-tiny font-medium text-content-tertiary">Density:</span>
                  <div className="inline-flex bg-surface-sunken p-0.5 rounded text-tiny">
                    <button
                      type="button"
                      onClick={() => setDensity('compact')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        density === 'compact'
                          ? 'bg-surface-elevated text-content-primary shadow-subtle'
                          : 'text-content-secondary'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensity('standard')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        density === 'standard'
                          ? 'bg-surface-elevated text-content-primary shadow-subtle'
                          : 'text-content-secondary'
                      }`}
                    >
                      Standard
                    </button>
                  </div>
                </div>
              </aside>
            </section>
          </div>
        )}

        {/* TAB 2: ORIGINAL PARSED RESUME TAB */}
        {activeTab === 'original' && (
          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto px-6 py-6 space-y-6 w-full">
            <div className="p-4 border border-border-hairline rounded-(--radius-control) bg-surface-elevated flex items-start gap-3">
              <Info className="w-5 h-5 text-action-primary shrink-0 mt-0.5" />
              <div className="text-small">
                <h4 className="font-medium text-content-primary">
                  Original Parsed Document (Read-Only)
                </h4>
                <p className="text-content-secondary mt-0.5">
                  This is the verbatim extracted text from your original upload. If Trace misread a section or bullet, click &ldquo;Trace read this wrong&rdquo; to send the original text straight into your editor tree.
                </p>
              </div>
            </div>

            {originalTree ? (
              <div className="border border-border-hairline rounded-(--radius-control) bg-surface-elevated p-6 space-y-6 text-small font-sans">
                {/* Contact */}
                <div className="border-b border-border-hairline pb-4 flex justify-between items-start">
                  <div>
                    <h3 className="text-h3 font-semibold text-content-primary">
                      {originalTree.contact.name}
                    </h3>
                    <p className="text-content-secondary mt-1">
                      {[
                        originalTree.contact.email,
                        originalTree.contact.phone,
                        originalTree.contact.location,
                        originalTree.contact.github,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateTree((prev) => ({ ...prev, contact: originalTree.contact }));
                      showToast('Copied original contact info to editor.');
                    }}
                    className="text-tiny font-medium text-action-primary hover:underline shrink-0"
                  >
                    Trace read this wrong
                  </button>
                </div>

                {/* Summary */}
                {originalTree.summary && (
                  <div className="border-b border-border-hairline pb-4 flex justify-between items-start">
                    <div>
                      <h4 className="font-mono text-tiny uppercase text-content-tertiary font-semibold mb-1">
                        SUMMARY
                      </h4>
                      <p className="text-content-secondary">{originalTree.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateTree((prev) => ({ ...prev, summary: originalTree.summary }));
                        showToast('Copied original summary to editor.');
                      }}
                      className="text-tiny font-medium text-action-primary hover:underline shrink-0 ml-4"
                    >
                      Trace read this wrong
                    </button>
                  </div>
                )}

                {/* Experience */}
                <div className="space-y-4">
                  <h4 className="font-mono text-tiny uppercase text-content-tertiary font-semibold">
                    EXPERIENCE
                  </h4>
                  {originalTree.experience.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 rounded bg-surface-sunken/40 border border-border-hairline space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-content-primary">
                            {exp.title}
                          </span>{' '}
                          at {exp.company}
                          <span className="text-tiny text-content-tertiary block font-mono">
                            {exp.startDate} {exp.endDate ? `– ${exp.endDate}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateTree((prev) => ({
                              ...prev,
                              experience: [...prev.experience, exp],
                            }));
                            showToast(`Added original ${exp.title} to editor.`);
                          }}
                          className="text-tiny font-medium text-action-primary hover:underline shrink-0"
                        >
                          Trace read this wrong
                        </button>
                      </div>
                      <ul className="list-disc list-outside pl-4 space-y-1 text-content-secondary text-tiny">
                        {exp.bullets.map((b) => (
                          <li key={b.id}>{b.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-content-tertiary">
                No original upload snapshot available (built with Trace).
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VERSIONS TAB */}
        {activeTab === 'versions' && (
          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto px-6 py-6 space-y-6 w-full">
            <div className="p-4 border border-border-hairline rounded-(--radius-control) bg-surface-elevated">
              <h4 className="text-small font-semibold text-content-primary">
                Version History & Application Snapshots
              </h4>
              <p className="text-tiny text-content-secondary mt-1">
                Trace automatically saves immutable snapshots whenever you edit your resume or tailor it for a specific job application.
              </p>
            </div>

            <div className="border border-border-hairline rounded-(--radius-control) bg-surface-elevated divide-y divide-border-hairline overflow-hidden">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-sunken/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-small font-semibold text-content-primary">
                        Version {ver.version_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-tiny font-mono uppercase font-semibold ${
                          ver.kind === 'original'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : ver.kind === 'tailored'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {ver.kind}
                      </span>
                      {ver.version_number === currentVersion && (
                        <span className="text-tiny font-mono text-action-primary bg-surface-selected px-1.5 py-0.2 rounded border border-action-primary/20">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-tiny text-content-secondary mt-1">
                      {ver.applicationTitle ? (
                        <span>Tailored for: {ver.applicationTitle} · </span>
                      ) : null}
                      <span>
                        {new Date(ver.created_at).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiffVersion(ver)}
                      className="px-3 py-1 text-tiny font-medium text-content-primary bg-surface-elevated hover:bg-surface-sunken border border-border-subtle rounded transition-colors"
                    >
                      Preview snapshot
                    </button>

                    {ver.version_number !== currentVersion && (
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(ver)}
                        className="px-3 py-1 text-tiny font-medium text-action-primary hover:bg-surface-selected border border-action-primary/30 rounded transition-colors"
                      >
                        Restore version
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* AI Suggest Wording Modal */}
      {suggestModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-page border border-border-subtle rounded-(--radius-overlay) max-w-lg w-full p-6 shadow-overlay space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-h3 font-medium text-content-primary">
                Suggest Wording
              </h3>
            </div>
            <p className="text-small text-content-secondary">
              Fact-locked rewrite that uses active verbs and clear structure without inventing experience:
            </p>

            <div className="p-3 rounded bg-surface-sunken/60 border border-border-hairline text-small font-mono text-content-secondary">
              <span className="text-tiny text-content-tertiary block font-sans uppercase mb-1">
                Original Bullet
              </span>
              &ldquo;{suggestModal.currentText}&rdquo;
            </div>

            {suggestModal.isLoading ? (
              <div className="py-6 text-center text-content-tertiary">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-action-primary mb-2" />
                <p className="text-small font-mono">Running fact-lock rewrite...</p>
              </div>
            ) : suggestModal.error ? (
              <div className="p-3 rounded bg-rose-50 border border-rose-200 text-small text-rose-700">
                {suggestModal.error}
              </div>
            ) : (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-small text-emerald-900 space-y-2">
                <span className="text-tiny font-mono uppercase text-emerald-700 font-semibold block">
                  Suggested Rewrite (Verified)
                </span>
                <p className="font-medium">{suggestModal.suggestion}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSuggestModal(null)}
                className="px-3 py-1.5 text-small text-content-secondary hover:text-content-primary"
              >
                Cancel
              </button>
              {suggestModal.suggestion && (
                <button
                  type="button"
                  onClick={() => {
                    updateBullet(
                      suggestModal.section,
                      suggestModal.itemId,
                      suggestModal.bulletId,
                      suggestModal.suggestion!
                    );
                    setSuggestModal(null);
                    showToast('Applied wording suggestion.');
                  }}
                  className="px-4 py-1.5 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors"
                >
                  Apply Suggestion
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Ask Me Questions Modal */}
      {questionsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-page border border-border-subtle rounded-(--radius-overlay) max-w-lg w-full p-6 shadow-overlay space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-action-primary" />
              <h3 className="text-h3 font-medium text-content-primary">
                Add Concrete Evidence
              </h3>
            </div>
            <p className="text-small text-content-secondary">
              Answer up to 3 quick questions. Trace will synthesize your exact answers into a punchy, fact-locked bullet:
            </p>

            <div className="p-3 rounded bg-surface-sunken/60 border border-border-hairline text-small font-mono text-content-secondary">
              <span className="text-tiny text-content-tertiary block font-sans uppercase mb-1">
                Target Bullet
              </span>
              &ldquo;{questionsModal.originalText}&rdquo;
            </div>

            {questionsModal.isLoading ? (
              <div className="py-6 text-center text-content-tertiary">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-action-primary mb-2" />
                <p className="text-small font-mono">Analyzing bullet gaps...</p>
              </div>
            ) : questionsModal.synthesizedResult ? (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-small text-emerald-900 space-y-2">
                <span className="text-tiny font-mono uppercase text-emerald-700 font-semibold block">
                  Synthesized Bullet
                </span>
                <p className="font-medium">{questionsModal.synthesizedResult}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {questionsModal.questions.map((q, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="block text-tiny font-medium text-content-primary">
                      {idx + 1}. {q}
                    </label>
                    <input
                      type="text"
                      value={questionsModal.answers[idx] || ''}
                      placeholder="e.g. 35% reduction in query latency, Kafka, team of 4"
                      onChange={(e) => {
                        const newAnswers = [...questionsModal.answers];
                        newAnswers[idx] = e.target.value;
                        setQuestionsModal((prev) =>
                          prev ? { ...prev, answers: newAnswers } : null
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-small border border-border-subtle rounded bg-surface-elevated text-content-primary focus:outline-hidden focus:border-action-primary"
                    />
                  </div>
                ))}
              </div>
            )}

            {questionsModal.error && (
              <p className="text-tiny text-action-danger">{questionsModal.error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuestionsModal(null)}
                className="px-3 py-1.5 text-small text-content-secondary hover:text-content-primary"
              >
                Cancel
              </button>

              {questionsModal.synthesizedResult ? (
                <button
                  type="button"
                  onClick={() => {
                    updateBullet(
                      questionsModal.section,
                      questionsModal.itemId,
                      questionsModal.bulletId,
                      questionsModal.synthesizedResult!
                    );
                    setQuestionsModal(null);
                    showToast('Applied synthesized bullet.');
                  }}
                  className="px-4 py-1.5 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors"
                >
                  Apply to bullet
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSynthesizeAnswers}
                  disabled={
                    questionsModal.isSynthesizing ||
                    questionsModal.isLoading ||
                    !questionsModal.answers.some((a) => a.trim().length > 0)
                  }
                  className="px-4 py-1.5 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors disabled:opacity-50"
                >
                  {questionsModal.isSynthesizing ? 'Synthesizing...' : 'Synthesize into bullet'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version Preview / Restore Modal */}
      {diffVersion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-page border border-border-subtle rounded-(--radius-overlay) max-w-2xl w-full p-6 shadow-overlay space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-h3 font-medium text-content-primary">
                  Version {diffVersion.version_number} Snapshot
                </h3>
                <p className="text-tiny text-content-secondary">
                  Saved on {new Date(diffVersion.created_at).toLocaleString()}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-tiny font-mono uppercase bg-surface-sunken">
                {diffVersion.kind}
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto border border-border-hairline rounded p-4 bg-surface-elevated text-small space-y-3">
              <div>
                <span className="font-semibold">{diffVersion.tree.contact.name}</span>
                <span className="text-content-secondary ml-2">
                  {diffVersion.tree.contact.email}
                </span>
              </div>
              {diffVersion.tree.summary && (
                <p className="text-content-secondary italic">
                  {diffVersion.tree.summary}
                </p>
              )}
              <div className="space-y-2">
                <span className="font-mono text-tiny uppercase text-content-tertiary font-semibold block">
                  Experience ({diffVersion.tree.experience.length})
                </span>
                {diffVersion.tree.experience.map((e) => (
                  <div key={e.id} className="text-tiny">
                    <span className="font-semibold text-content-primary">{e.title}</span> — {e.company}
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-content-secondary">
                      {e.bullets.map((b) => (
                        <li key={b.id}>{b.text}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDiffVersion(null)}
                className="px-3 py-1.5 text-small text-content-secondary hover:text-content-primary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleRestoreVersion(diffVersion)}
                className="px-4 py-1.5 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors"
              >
                Restore this version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteOpen && (
        <Dialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title={`Delete "${resumeMeta?.title}"?`}
          description={
            applications.length > 0
              ? `This resume is used in ${applications.length} applications (${applications
                  .map((a) => `${a.role} at ${a.company}`)
                  .join(', ')}). Past analyses keep their immutable snapshots, so deleting this resume will not alter past reports.`
              : 'Are you sure you want to permanently delete this resume? This action cannot be undone.'
          }
          primaryAction={{
            label: isDeleting ? 'Deleting...' : 'Delete Resume',
            variant: 'danger',
            onClick: handleDelete,
            loading: isDeleting,
          }}
          secondaryAction={{
            label: 'Cancel',
            onClick: () => setIsDeleteOpen(false),
          }}
        />
      )}
    </div>
  );
}
