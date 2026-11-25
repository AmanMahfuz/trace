import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  savePendingUpload,
  getPendingUpload,
  clearPendingUpload,
  hasPendingUpload,
  StorageQuotaError,
} from '@/lib/storage/upload-handoff';

// In-memory mock of IndexedDB shared across simulated tabs
class MockIDBRequest {
  result: unknown = null;
  error: Error | DOMException | null = null;
  onsuccess: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  triggerSuccess(val: unknown) {
    this.result = val;
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  triggerError(err: Error | DOMException) {
    this.error = err;
    if (this.onerror) this.onerror({ target: this });
  }
}

class MockObjectStore {
  constructor(private storage: Map<string, unknown>, public throwQuota = false) {}

  put(record: { id: string }) {
    const req = new MockIDBRequest();
    queueMicrotask(() => {
      if (this.throwQuota) {
        req.triggerError(new DOMException('QuotaExceededError', 'QuotaExceededError'));
        return;
      }
      this.storage.set(record.id, record);
      req.triggerSuccess(record.id);
    });
    return req;
  }

  get(id: string) {
    const req = new MockIDBRequest();
    queueMicrotask(() => {
      const val = this.storage.get(id);
      req.triggerSuccess(val);
    });
    return req;
  }

  delete(id: string) {
    const req = new MockIDBRequest();
    queueMicrotask(() => {
      this.storage.delete(id);
      req.triggerSuccess(undefined);
    });
    return req;
  }
}

class MockTransaction {
  error: Error | DOMException | null = null;
  onerror: ((e: unknown) => void) | null = null;

  constructor(private storage: Map<string, unknown>, private throwQuota = false) {}

  objectStore() {
    return new MockObjectStore(this.storage, this.throwQuota);
  }
}

class MockIDBDatabase {
  objectStoreNames = {
    contains: () => true,
  };

  constructor(private storage: Map<string, unknown>, public throwQuota = false) {}

  transaction() {
    return new MockTransaction(this.storage, this.throwQuota);
  }

  createObjectStore() {
    return new MockObjectStore(this.storage);
  }
}

describe('IndexedDB Upload Handoff', () => {
  const sharedStorage = new Map<string, unknown>();
  let throwQuotaOnNextPut = false;

  beforeEach(() => {
    sharedStorage.clear();
    throwQuotaOnNextPut = false;

    // Install mock on global window
    const mockFactory = {
      open: () => {
        const req = new MockIDBRequest();
        queueMicrotask(() => {
          const db = new MockIDBDatabase(sharedStorage, throwQuotaOnNextPut);
          req.triggerSuccess(db);
        });
        return req;
      },
    };

    (globalThis as unknown as { indexedDB: unknown }).indexedDB = mockFactory;
    (globalThis as unknown as { window: unknown }).window = {
      indexedDB: mockFactory,
    };
  });

  it('stores and retrieves pending file and job input within 30-minute expiry window', async () => {
    const dummyFile = new File(['Dummy resume text content'], 'resume.pdf', {
      type: 'application/pdf',
    });
    const jobInput = 'https://jobs.example.com/software-engineer';

    await savePendingUpload(dummyFile, jobInput);

    const hasUpload = await hasPendingUpload();
    expect(hasUpload).toBe(true);

    const pending = await getPendingUpload();
    expect(pending).not.toBeNull();
    expect(pending?.jobInput).toBe(jobInput);
    expect(pending?.file.name).toBe('resume.pdf');
    expect(pending?.file.type).toBe('application/pdf');

    const fileContent = await pending!.file.text();
    expect(fileContent).toBe('Dummy resume text content');
  });

  it('expires records older than 30 minutes and clears them', async () => {
    const dummyFile = new File(['Candidate PDF content'], 'resume.pdf', {
      type: 'application/pdf',
    });
    const jobInput = 'Software Engineer Role';

    await savePendingUpload(dummyFile, jobInput);

    // Fast-forward time past 30 minutes (31 minutes)
    const originalNow = Date.now;
    const futureTime = originalNow() + 31 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(futureTime);

    const pending = await getPendingUpload();
    expect(pending).toBeNull();

    // Verify subsequent lookup is clean
    const hasUpload = await hasPendingUpload();
    expect(hasUpload).toBe(false);

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('handles QuotaExceededError by throwing StorageQuotaError', async () => {
    const dummyFile = new File(['Huge File'], 'huge.pdf', { type: 'application/pdf' });
    throwQuotaOnNextPut = true;

    await expect(savePendingUpload(dummyFile, 'Job Context')).rejects.toThrow(
      StorageQuotaError
    );
  });

  it('simulates Magic Link opened in a new tab: tab B recovers pending upload stored by tab A', async () => {
    // Tab A: Unauthenticated user drops resume on landing page
    const tabAFile = new File(['Resume from Tab A'], 'john_doe_resume.pdf', {
      type: 'application/pdf',
    });
    const tabAJob = 'Frontend Engineer at TechCorp';
    await savePendingUpload(tabAFile, tabAJob);

    // Tab B: User opens magic link email in a separate browser tab
    // Because IndexedDB is shared across tabs on the same origin (unlike sessionStorage),
    // Tab B can seamlessly access the stored upload
    const tabBPending = await getPendingUpload();
    expect(tabBPending).not.toBeNull();
    expect(tabBPending?.file.name).toBe('john_doe_resume.pdf');
    expect(tabBPending?.jobInput).toBe('Frontend Engineer at TechCorp');

    // Tab B completes analysis and clears upload
    await clearPendingUpload();

    // Stored upload is now cleared
    const checkAfter = await getPendingUpload();
    expect(checkAfter).toBeNull();
  });

  it('returns null when stored upload is missing or expired after login handoff', async () => {
    await clearPendingUpload();
    const missing = await getPendingUpload();
    expect(missing).toBeNull();
  });
});
