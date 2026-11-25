'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface DropzoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSizeBytes?: number; // defaults to 5MB
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropzone({
  file,
  onFileSelect,
  accept = 'application/pdf',
  maxSizeBytes = 5 * 1024 * 1024,
  error,
  disabled = false,
  className = '',
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeError = error || internalError;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const validateAndSet = (selected: File) => {
    setInternalError(null);
    if (accept && accept.includes('pdf') && selected.type !== 'application/pdf') {
      setInternalError('Please select a PDF document.');
      return;
    }
    if (selected.size > maxSizeBytes) {
      setInternalError('File size exceeds the 5MB limit.');
      return;
    }
    onFileSelect(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSet(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSet(e.target.files[0]);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {file ? (
        // File selected state
        <div className="h-40 flex flex-col justify-between p-4 bg-surface-sunken border border-border-default rounded-(--radius-dropzone) transition-all">
          <div className="flex items-start gap-3 truncate">
            <FileText className="w-5 h-5 text-action-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="truncate space-y-0.5">
              <p className="text-small font-medium text-content-primary truncate">{file.name}</p>
              <p className="font-mono text-eyebrow text-content-tertiary">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for extraction
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-eyebrow text-status-strong-content font-medium flex items-center gap-1 font-mono">
              ✓ Ready
            </span>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              disabled={disabled}
              onClick={() => onFileSelect(null)}
              iconRight={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Replace
            </Button>
          </div>
        </div>
      ) : (
        // Empty drop target
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`h-40 border-2 border-dashed rounded-(--radius-dropzone) p-6 flex flex-col items-center justify-center transition-colors text-center group bg-surface-raised cursor-pointer select-none ${
            isDragOver
              ? 'border-action-primary bg-surface-selected'
              : 'border-border-default hover:border-action-primary hover:bg-surface-sunken'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={handleInputChange}
            className="sr-only"
            aria-label="Upload document"
          />
          <UploadCloud
            className="w-7 h-7 text-content-tertiary group-hover:text-action-primary mb-2 transition-colors"
            aria-hidden="true"
          />
          <span className="text-small font-medium text-content-primary">
            Drop your resume PDF here
          </span>
          <span className="text-eyebrow text-content-tertiary mt-1">
            Parsed privately. Never used to train public AI models.
          </span>
        </label>
      )}

      {activeError && (
        <div
          role="alert"
          className="p-3 bg-status-risk-surface border border-status-risk-border text-small text-status-risk-content flex items-start gap-2 rounded-(--radius-control)"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
}
