'use client';

import React, { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

export interface ToastProps {
  message?: string | null;
  isOpen?: boolean;
  onClose: () => void;
  type?: 'success' | 'info' | 'error';
  durationMs?: number;
}

export function Toast({
  message,
  isOpen,
  onClose,
  type = 'info',
  durationMs = 4000,
}: ToastProps) {
  const visible = typeof isOpen === 'boolean' ? (isOpen && Boolean(message)) : Boolean(message);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onClose]);

  if (!visible || !message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-(--z-toast) bg-content-primary text-content-inverse px-4 py-2.5 rounded-(--radius-control) text-small font-sans shadow-(--shadow-overlay) flex items-center gap-2 max-w-sm transition-all"
    >
      {type === 'success' && <Check className="w-4 h-4 text-status-strong-mark shrink-0" aria-hidden="true" />}
      {type === 'error' && <AlertCircle className="w-4 h-4 text-status-risk-mark shrink-0" aria-hidden="true" />}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-content-disabled hover:text-content-inverse p-0.5 ml-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action-focus-ring"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
