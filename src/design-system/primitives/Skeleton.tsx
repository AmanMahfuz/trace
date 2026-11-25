import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-sunken animate-pulse rounded-(--radius-control) ${className}`}
    />
  );
}
