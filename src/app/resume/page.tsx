'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResumeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/resumes');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-surface-page text-content-tertiary text-small">
      Redirecting to resumes...
    </div>
  );
}
