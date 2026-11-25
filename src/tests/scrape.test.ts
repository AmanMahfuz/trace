import { describe, it, expect, vi } from 'vitest';
import { isPrivateIP, validateSafeUrl } from '../lib/scrape';

// Mock dns/promises so validateSafeUrl tests never require live network access.
// The mock returns a realistic public IP for any hostname that isn't blocked
// by the hostname-level isPrivateIP check earlier in the function.
vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
  },
}));

describe('SSRF Protection Guard', () => {
  it('identifies local, private, and reserved IPv4/IPv6 blocks correctly', () => {
    expect(isPrivateIP('localhost')).toBe(true);
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('169.254.169.254')).toBe(true);
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.100')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
    expect(isPrivateIP('::1')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fd12:3456:789a::1')).toBe(true);
  });

  it('permits valid public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
    expect(isPrivateIP('142.250.190.46')).toBe(false);
  });

  it('rejects non-http/https protocols', async () => {
    await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow(
      'Only HTTP and HTTPS protocols are permitted'
    );
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow(
      'Only HTTP and HTTPS protocols are permitted'
    );
  });

  it('rejects localhost and 127.0.0.1 direct hosts', async () => {
    await expect(validateSafeUrl('http://localhost:3000')).rejects.toThrow(
      'Access to private/local destinations is forbidden'
    );
    await expect(validateSafeUrl('http://127.0.0.1/admin')).rejects.toThrow(
      'Access to private/local destinations is forbidden'
    );
  });

  it('rejects cloud metadata link-local IP 169.254.169.254', async () => {
    await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      'Access to private/local destinations is forbidden'
    );
  });

  it('rejects private 10.0.0.1 IP', async () => {
    await expect(validateSafeUrl('http://10.0.0.1/status')).rejects.toThrow(
      'Access to private/local destinations is forbidden'
    );
  });

  it('accepts a valid public URL', async () => {
    const url = await validateSafeUrl('https://example.com/job/123');
    expect(url.hostname).toBe('example.com');
    expect(url.protocol).toBe('https:');
  });
});
