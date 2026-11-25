import { Store, CacheEntry } from '../store';

export class RouterCache {
  constructor(private store: Store) {}

  async generateKey(task: string, promptVersion: string, input: unknown): Promise<string> {
    const serialized = typeof input === 'string' ? input : JSON.stringify(input);
    const text = `${task}:${promptVersion}:${serialized}`;
    const enc = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async get<T>(key: string, expectedVersion: string): Promise<T | null> {
    const entry: CacheEntry | null = await this.store.getCache(key);
    if (!entry) return null;
    if (entry.promptVersion !== expectedVersion) return null;
    return entry.output as T;
  }

  async set(key: string, output: unknown, promptVersion: string): Promise<void> {
    await this.store.setCache(key, output, promptVersion);
  }
}
