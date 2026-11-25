'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  helperText?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required = false,
  helperText,
  hint,
  error,
  children,
  className = '',
}: FormFieldProps) {
  const errorId = id ? `${id}-error` : undefined;
  const helperId = id ? `${id}-helper` : undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-small font-medium text-content-primary select-none"
        >
          <span>{label}</span>
          {required && <span className="text-status-risk-content ml-1" aria-hidden="true">*</span>}
        </label>
        {hint && <span className="text-eyebrow text-content-tertiary font-sans">{hint}</span>}
      </div>

      <div>{children}</div>

      {helperText && !error && (
        <p id={helperId} className="text-small text-content-tertiary">
          {helperText}
        </p>
      )}

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-small text-status-risk-content"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
