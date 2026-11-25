'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = '', disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full h-(--input-height) px-3 bg-surface-raised border rounded-(--input-radius) text-body text-content-primary placeholder:text-content-disabled transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring disabled:opacity-50 disabled:bg-surface-sunken disabled:cursor-not-allowed ${
          error
            ? 'border-status-risk-content focus-visible:ring-status-risk-content'
            : 'border-border-control hover:border-content-primary'
        } ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className = '', disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full p-3 bg-surface-raised border rounded-(--input-radius) text-body text-content-primary placeholder:text-content-disabled transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring disabled:opacity-50 disabled:bg-surface-sunken disabled:cursor-not-allowed ${
          error
            ? 'border-status-risk-content focus-visible:ring-status-risk-content'
            : 'border-border-control hover:border-content-primary'
        } ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className = '', disabled, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full h-(--input-height) px-3 bg-surface-raised border rounded-(--input-radius) text-small text-content-primary transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring disabled:opacity-50 disabled:bg-surface-sunken disabled:cursor-not-allowed cursor-pointer ${
          error
            ? 'border-status-risk-content focus-visible:ring-status-risk-content'
            : 'border-border-control hover:border-content-primary'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';
