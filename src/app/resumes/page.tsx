'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { Dialog } from '@/design-system/patterns/Dialog';
import { Toast } from '@/design-system/primitives/Toast';
import { Banner } from '@/design-system/primitives/Banner';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  MoreVertical,
  Star,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Edit2,
  ExternalLink,
  Loader2,
  Download,
  RotateCw,
} from 'lucide-react';

interface ResumeSummaryItem {
  id: string;
  title: string;
  source: 'uploaded' | 'built';
  isDefault: boolean;
  parseStatus: 'good' | 'needs_review' | 'failed';
  parseWarnings: string[];
  updatedAt: string;
  createdAt: string;
  fileName: string;
  applicationsCount: number;
  applications: Array<{ id: string; role: string; company: string }>;
  formatSummary: {
    passed: boolean;
    issuesCount: number;
    opportunitiesCount: number;
  };
}

export default function ResumesLibraryPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resumes, setResumes] = useState<ResumeSummaryItem[]>([]);
  const [totalApplications, setTotalApplications] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Duplicate detected dialog
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingId: string;
    title: string;
  } | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ResumeSummaryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<ResumeSummaryItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Applications view modal
  const [viewAppsTarget, setViewAppsTarget] = useState<ResumeSummaryItem | null>(null);

  // Action menu active row
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Limit reached
  const [isLimitReached, setIsLimitReached] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch('/api/resumes');
      if (res.ok) {
        const data = await res.json();
        const list: ResumeSummaryItem[] = data.resumes || [];
        setResumes(list);
        const appsTotal = list.reduce((acc, r) => acc + (r.applicationsCount || 0), 0);
        setTotalApplications(appsTotal);
        setIsLimitReached(list.length >= (data.maxAllowed || 5));
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await fetchResumes();
    }
    init();
  }, [router, supabase]);

  // Handle outside click to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.resume-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleUploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be under 5 MB.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/resumes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        if (data.duplicate) {
          setDuplicateInfo({
            existingId: data.existingId,
            title: data.title,
          });
        } else {
          showToast('Resume uploaded and parsed successfully.');
          await fetchResumes();
          if (data.resume?.id) {
            router.push(`/resumes/${data.resume.id}`);
          }
        }
      } else {
        setUploadError(data.error || 'Failed to upload and parse resume.');
      }
    } catch {
      setUploadError('Network error uploading resume.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBuildNew = async () => {
    if (isLimitReached) {
      showToast('You have reached the 5-resume limit. Delete an older resume to create a new one.');
      return;
    }

    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build', title: 'New Resume' }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('Created new resume workspace.');
        router.push(`/resumes/${data.resume.id}`);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to initialize resume.');
      }
    } catch {
      showToast('Network error initializing resume.');
    }
  };

  const handleSetDefault = async (resume: ResumeSummaryItem) => {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default' }),
      });
      if (res.ok) {
        showToast(`Set "${resume.title}" as default resume.`);
        setActiveMenuId(null);
        await fetchResumes();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to set default.');
      }
    } catch {
      showToast('Network error setting default.');
    }
  };

  const handleDuplicate = async (resume: ResumeSummaryItem) => {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      if (res.ok) {
        showToast(`Duplicated "${resume.title}".`);
        setActiveMenuId(null);
        await fetchResumes();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to duplicate resume.');
      }
    } catch {
      showToast('Network error duplicating resume.');
    }
  };

  const handleReRead = async (resume: ResumeSummaryItem) => {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 're-read' }),
      });
      if (res.ok) {
        showToast(`Re-reading complete for "${resume.title}".`);
        await fetchResumes();
      }
    } catch {
      showToast('Failed to re-read resume.');
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget || !renameTitle.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/resumes/${renameTarget.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', title: renameTitle.trim() }),
      });
      if (res.ok) {
        showToast('Resume renamed.');
        setRenameTarget(null);
        await fetchResumes();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to rename resume.');
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/resumes/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Resume deleted.');
        setDeleteTarget(null);
        await fetchResumes();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete resume.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-surface-page flex flex-col justify-between">
      {/* Toast Feedback */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          type="success"
        />
      )}

      {/* Main Content Area */}
      <div>
        <AppHeader />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Top Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border-hairline">
            <div>
              <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                RESUME MANAGEMENT
              </div>
              <h1 className="text-display font-semibold text-content-primary tracking-tight mt-1">
                Resumes
              </h1>
              <p className="font-mono text-small text-content-secondary mt-1">
                {resumes.length} {resumes.length === 1 ? 'resume' : 'resumes'} · used in{' '}
                {totalApplications} {totalApplications === 1 ? 'application' : 'applications'}{' '}
                <span className="text-content-tertiary">({resumes.length}/5 used)</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                }}
              />

              <button
                type="button"
                onClick={handleBuildNew}
                disabled={isLimitReached}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-small font-medium text-content-secondary hover:text-content-primary hover:bg-surface-sunken rounded-(--radius-control) border border-border-subtle transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Build one with Trace
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isLimitReached}
                className="inline-flex items-center gap-2 px-4 py-2 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) shadow-subtle transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing resume...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload a resume</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Limit Reached Banner */}
          {isLimitReached && (
            <div className="mt-6">
              <Banner
                variant="caution"
                description="You have reached the 5-saved-resume limit on the free plan. To upload or build a new resume, please delete an older one."
              />
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="mt-6">
              <Banner
                variant="risk"
                description={uploadError}
                actionLabel="Dismiss"
                onAction={() => setUploadError(null)}
              />
            </div>
          )}

          {/* Quick Dropzone Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleUploadFile(file);
            }}
            className={`mt-6 p-4 rounded-(--radius-control) border border-dashed transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDragOver
                ? 'border-action-primary bg-surface-selected'
                : 'border-border-subtle bg-surface-sunken/40 hover:bg-surface-sunken/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-content-secondary shrink-0 border border-border-hairline">
                <FileText className="w-4 h-4 text-action-primary" />
              </div>
              <div>
                <p className="text-small font-medium text-content-primary">
                  Drop a new resume PDF here to parse and save (max 5 MB)
                </p>
                <p className="text-tiny text-content-tertiary">
                  Stored securely to power your tailoring and interview practice. Delete any time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLimitReached}
              className="text-small font-medium text-action-primary hover:underline shrink-0"
            >
              Browse files
            </button>
          </div>

          {/* Resumes List Table */}
          <div className="mt-8">
            {loading ? (
              <div className="py-16 text-center text-content-tertiary">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-action-primary" />
                <p className="text-small font-mono">Loading saved resumes...</p>
              </div>
            ) : resumes.length === 0 ? (
              /* Empty State */
              <div className="py-16 text-center border border-border-hairline rounded-(--radius-control) bg-surface-elevated/50 p-8">
                <div className="w-12 h-12 rounded-full bg-surface-sunken mx-auto flex items-center justify-center text-content-tertiary mb-4">
                  <FileText className="w-6 h-6 text-action-primary" />
                </div>
                <h3 className="text-h3 font-medium text-content-primary">
                  No resumes saved yet
                </h3>
                <p className="text-small text-content-secondary max-w-md mx-auto mt-2">
                  Upload an existing PDF resume to analyze your odds, or build a clean, ATS-formatted resume with Trace from scratch.
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload PDF resume
                  </button>
                  <button
                    type="button"
                    onClick={handleBuildNew}
                    className="inline-flex items-center gap-2 px-4 py-2 text-small font-medium text-content-primary bg-surface-elevated hover:bg-surface-sunken border border-border-subtle rounded-(--radius-control) transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Build one with Trace
                  </button>
                </div>
              </div>
            ) : (
              /* Rows Table */
              <div className="border border-border-hairline rounded-(--radius-control) overflow-hidden bg-surface-elevated divide-y divide-border-hairline">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface-sunken text-eyebrow font-mono text-content-secondary uppercase tracking-wider font-semibold">
                  <div className="col-span-5 sm:col-span-4">Title & Source</div>
                  <div className="col-span-3 sm:col-span-2">Updated</div>
                  <div className="col-span-2 hidden sm:block">Status</div>
                  <div className="col-span-2 hidden sm:block">Format Checks</div>
                  <div className="col-span-4 sm:col-span-2 text-right">Actions</div>
                </div>

                {/* Rows */}
                {resumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-surface-sunken/40 transition-colors"
                  >
                    {/* Title, default tag, and source */}
                    <div className="col-span-5 sm:col-span-4 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/resumes/${resume.id}`}
                          className="text-body font-medium text-content-primary hover:text-action-primary truncate font-sans"
                        >
                          {resume.title}
                        </Link>
                        {resume.isDefault && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-tiny font-mono font-medium bg-surface-selected text-action-primary border border-action-primary/20 shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-tiny text-content-tertiary">
                        <span>
                          {resume.source === 'uploaded' ? 'Uploaded PDF' : 'Built with Trace'}
                        </span>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => setViewAppsTarget(resume)}
                          className="text-content-secondary hover:text-action-primary underline decoration-border-subtle"
                        >
                          Used in {resume.applicationsCount}{' '}
                          {resume.applicationsCount === 1 ? 'application' : 'applications'}
                        </button>
                      </div>
                    </div>

                    {/* Updated Date */}
                    <div className="col-span-3 sm:col-span-2 text-small text-content-secondary font-mono">
                      {formatDate(resume.updatedAt)}
                    </div>

                    {/* Parse Status Chip */}
                    <div className="col-span-2 hidden sm:block">
                      {resume.parseStatus === 'good' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-tiny font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Read well</span>
                        </span>
                      )}
                      {resume.parseStatus === 'needs_review' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-tiny font-medium text-amber-700 bg-amber-50 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Needs review</span>
                        </span>
                      )}
                      {resume.parseStatus === 'failed' && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-tiny font-medium text-rose-700 bg-rose-50 border border-rose-200">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Couldn&apos;t read</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReRead(resume)}
                            title="Re-read resume"
                            className="text-tiny font-mono text-action-primary hover:underline flex items-center gap-0.5"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Re-read</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Format Checks Summary */}
                    <div className="col-span-2 hidden sm:block text-small">
                      {resume.formatSummary.issuesCount === 0 ? (
                        <span className="inline-flex items-center gap-1 text-tiny font-medium text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Clean format
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-tiny font-medium text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          {resume.formatSummary.issuesCount}{' '}
                          {resume.formatSummary.issuesCount === 1 ? 'issue' : 'issues'}
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-1 resume-menu-container relative">
                      <Link
                        href={`/resumes/${resume.id}`}
                        className="px-2.5 py-1 text-small font-medium text-action-primary hover:bg-surface-sunken rounded-(--radius-control) transition-colors"
                      >
                        Open
                      </Link>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === resume.id ? null : resume.id);
                          }}
                          className="p-1.5 text-content-tertiary hover:text-content-primary hover:bg-surface-sunken rounded-(--radius-control) transition-colors"
                          aria-label="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Overflow Dropdown */}
                        {activeMenuId === resume.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated border border-border-hairline rounded-(--radius-control) shadow-subtle py-1 z-20 text-small">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                router.push(`/?resumeId=${resume.id}`);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-content-tertiary" />
                              <span>Use for a new job</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRenameTarget(resume);
                                setRenameTitle(resume.title);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-content-tertiary" />
                              <span>Rename</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicate(resume)}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                            >
                              <Copy className="w-3.5 h-3.5 text-content-tertiary" />
                              <span>Duplicate</span>
                            </button>

                            {!resume.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(resume)}
                                className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                              >
                                <Star className="w-3.5 h-3.5 text-content-tertiary" />
                                <span>Set as default</span>
                              </button>
                            )}

                            <Link
                              href={`/resumes/${resume.id}?export=pdf`}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-sunken flex items-center gap-2 text-content-primary"
                              onClick={() => setActiveMenuId(null)}
                            >
                              <Download className="w-3.5 h-3.5 text-content-tertiary" />
                              <span>Download PDF</span>
                            </Link>

                            <div className="border-t border-border-hairline my-1"></div>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(resume);
                                setActiveMenuId(null);
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Duplicate File Detected Dialog */}
      {duplicateInfo && (
        <Dialog
          isOpen={Boolean(duplicateInfo)}
          onClose={() => setDuplicateInfo(null)}
          title="Duplicate Resume Detected"
          description={`An identical resume file has already been uploaded as "${duplicateInfo.title}". Would you like to open the existing resume instead of creating a duplicate?`}
          primaryAction={{
            label: 'Open Existing Resume',
            onClick: () => {
              const id = duplicateInfo.existingId;
              setDuplicateInfo(null);
              router.push(`/resumes/${id}`);
            },
          }}
          secondaryAction={{
            label: 'Close',
            onClick: () => setDuplicateInfo(null),
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <Dialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title={`Delete "${deleteTarget.title}"?`}
          description={
            deleteTarget.applicationsCount > 0
              ? `This resume is currently referenced in ${deleteTarget.applicationsCount} application analyses (${deleteTarget.applications
                  .map((a) => `${a.role} at ${a.company}`)
                  .join(', ')}). Past analyses keep their own immutable snapshot, so deleting this resume will not alter or delete your past application reports.`
              : 'Are you sure you want to permanently delete this resume? This action cannot be undone.'
          }
          primaryAction={{
            label: deleting ? 'Deleting...' : 'Delete Resume',
            variant: 'danger',
            onClick: handleDeleteSubmit,
            loading: deleting,
          }}
          secondaryAction={{
            label: 'Cancel',
            onClick: () => setDeleteTarget(null),
          }}
        />
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-page border border-border-subtle rounded-(--radius-overlay) max-w-md w-full p-6 shadow-overlay space-y-4">
            <h3 className="text-h3 font-medium text-content-primary">
              Rename resume
            </h3>
            <p className="text-small text-content-secondary">
              Enter a descriptive title for this resume.
            </p>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full px-3 py-2 text-small border border-border-subtle rounded-(--radius-control) bg-surface-elevated text-content-primary focus:outline-hidden focus:border-action-primary"
              placeholder="e.g. Backend Engineer Resume (2026)"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1.5 text-small text-content-secondary hover:text-content-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameSubmit}
                disabled={renaming || !renameTitle.trim()}
                className="px-4 py-1.5 text-small font-medium text-white bg-action-primary hover:bg-action-primary-hover rounded-(--radius-control) transition-colors disabled:opacity-50"
              >
                {renaming ? 'Saving...' : 'Save title'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Associated Applications Modal */}
      {viewAppsTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-page border border-border-subtle rounded-(--radius-overlay) max-w-md w-full p-6 shadow-overlay space-y-4">
            <h3 className="text-h3 font-medium text-content-primary">
              Applications using &ldquo;{viewAppsTarget.title}&rdquo;
            </h3>
            <p className="text-small text-content-secondary">
              Trace saves an immutable snapshot for every evaluation:
            </p>

            {viewAppsTarget.applications.length === 0 ? (
              <p className="text-small text-content-tertiary italic py-2">
                Not yet used in any applications.
              </p>
            ) : (
              <div className="border border-border-hairline rounded-(--radius-control) divide-y divide-border-hairline max-h-60 overflow-y-auto">
                {viewAppsTarget.applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 flex items-center justify-between text-small hover:bg-surface-sunken"
                  >
                    <div>
                      <span className="font-medium text-content-primary block">
                        {app.role}
                      </span>
                      <span className="text-tiny text-content-secondary">
                        {app.company}
                      </span>
                    </div>
                    <Link
                      href={`/prep/${app.id}`}
                      className="text-tiny font-medium text-action-primary hover:underline"
                    >
                      View prep
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewAppsTarget(null)}
                className="px-4 py-1.5 text-small font-medium bg-surface-elevated hover:bg-surface-sunken border border-border-subtle rounded-(--radius-control)"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
