import { describe, it, expect } from 'vitest';
import { extractText } from 'unpdf';
import { renderToBuffer } from '@react-pdf/renderer';
import { createResumeDocument } from '@/components/ResumePDFDocument';
import { Resume } from '@/lib/schemas';

describe('PDF Text Extraction CPU Time Benchmark', () => {
  it('extracts text from a large real resume PDF well under the 2-second CPU limit', async () => {
    // Construct a comprehensive real resume with extensive work history & technical projects
    const heavyResume: Resume = {
      contact: {
        name: 'Alexander Chen',
        email: 'alex.chen@engineering-alumni.edu',
        phone: '+1 (415) 555-0199',
        location: 'San Francisco, CA',
        github: 'https://github.com/alexchen',
        linkedin: 'https://linkedin.com/in/alexchen',
      },
      summary:
        'Principal Infrastructure & Systems Architect with 8+ years designing low-latency distributed storage engines, transactional consensus protocols (Raft, Paxos), and resilient edge services processing over 500,000 requests per second across hybrid multi-cloud topologies.',
      experience: Array.from({ length: 6 }, (_, i) => ({
        id: `exp-${i + 1}`,
        company: `HyperScale Distributed Systems Inc. ${i + 1}`,
        title: `Staff Systems Engineer ${i + 1}`,
        location: 'San Francisco, CA',
        startDate: `202${i}-01`,
        endDate: `202${i + 1}-01`,
        bullets: [
          {
            id: `b-${i}-1`,
            text: 'Architected high-throughput write-ahead logging (WAL) and LSM-tree persistence storage engine decreasing p99 disk write latency from 45ms to 1.8ms under 250k sustained IOPS.',
            verified: true,
          },
          {
            id: `b-${i}-2`,
            text: 'Implemented zero-copy serialization protocol using FlatBuffers and memory-mapped virtual allocations, reducing garbage collection pauses by 84% across a 120-node Kubernetes cluster.',
            verified: true,
          },
          {
            id: `b-${i}-3`,
            text: 'Engineered multi-region PostgreSQL replication orchestrator with automated failover and split-brain detection, eliminating database downtime across 14 consecutive calendar months.',
            verified: true,
          },
        ],
      })),
      projects: Array.from({ length: 5 }, (_, i) => ({
        id: `proj-${i + 1}`,
        name: `Trace Distributed Consensus Engine ${i + 1}`,
        description: 'High-performance consensus layer implementing Raft state replication.',
        tech: ['Rust', 'PostgreSQL', 'WebAssembly', 'Kafka'],
        bullets: [
          {
            id: `pb-${i}-1`,
            text: 'Built deterministic distributed transaction coordinator benchmarked against Jepsen testing suites with zero data loss under simulated network partitions.',
            verified: true,
          },
          {
            id: `pb-${i}-2`,
            text: 'Authored cross-platform WebAssembly runtime powering client-side verification of cryptographic proofs and zero-knowledge claim assertions.',
            verified: true,
          },
        ],
      })),
      education: [
        {
          id: 'edu-1',
          school: 'University of California, Berkeley',
          degree: 'Bachelor of Science in Electrical Engineering & Computer Science (EECS)',
          year: '2018',
        },
      ],
      skills: [
        'Rust',
        'TypeScript',
        'Go',
        'PostgreSQL',
        'Distributed Systems',
        'WebAssembly',
        'Linux Kernel',
        'Kubernetes',
        'Docker',
        'eBPF',
        'Kafka',
        'Redis',
        'Next.js',
      ],
    };

    // Render real valid multi-page PDF document buffer
    const doc = createResumeDocument(heavyResume);
    const pdfBuffer = await renderToBuffer(doc);
    expect(pdfBuffer.byteLength).toBeGreaterThan(5000);

    // Measure CPU user + system time of extraction
    const startCpu = process.cpuUsage();
    const startTime = performance.now();

    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer));

    const elapsedCpu = process.cpuUsage(startCpu);
    const wallClockMs = performance.now() - startTime;
    const cpuTimeMs = (elapsedCpu.user + elapsedCpu.system) / 1000;

    console.log(
      `[CPU Benchmark] Extracted ${totalPages} pages (${pdfBuffer.byteLength} bytes) in ${wallClockMs.toFixed(2)}ms wall-clock, ${cpuTimeMs.toFixed(2)}ms CPU time.`
    );

    // Assert extraction accuracy & CPU limit compliance
    expect(totalPages).toBeGreaterThanOrEqual(2);
    const extractedStr = Array.isArray(text) ? text.join('\n') : String(text);
    expect(extractedStr.toUpperCase()).toContain('ALEXANDER CHEN');
    expect(extractedStr).toContain('HyperScale Distributed Systems');

    // Strict constraint: Must stay well under 2s (2000ms) CPU limit for Supabase Edge Functions
    expect(cpuTimeMs).toBeLessThan(2000);
    expect(cpuTimeMs).toBeLessThan(500); // typically < 100ms
  });
});
