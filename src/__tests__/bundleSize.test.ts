import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_ASSETS = join(__dirname, '..', '..', 'dist', 'assets');
const MAX_MAIN_CHUNK_GZIP_BYTES = 400 * 1024;

interface ChunkSize {
  name: string;
  rawBytes: number;
  gzipBytes: number;
}

function measureChunks(): ChunkSize[] {
  if (!existsSync(DIST_ASSETS)) return [];
  const files = readdirSync(DIST_ASSETS)
    .filter((f) => f.endsWith('.js'))
    .sort();
  return files.map((name) => {
    const buf = readFileSync(join(DIST_ASSETS, name));
    return {
      name,
      rawBytes: statSync(join(DIST_ASSETS, name)).size,
      gzipBytes: gzipSync(buf).length,
    };
  });
}

describe('bundle size', () => {
  it.skipIf(!existsSync(DIST_ASSETS))(
    'largest JS chunk is under 400 KB gzipped',
    () => {
      const chunks = measureChunks();
      console.log('Bundle sizes (gzipped):');
      for (const c of chunks) {
        console.log(`  ${c.name}  raw=${c.rawBytes}B  gzip=${c.gzipBytes}B`);
      }
      const largest = chunks.reduce<ChunkSize | undefined>(
        (acc, c) => (!acc || c.gzipBytes > acc.gzipBytes ? c : acc),
        undefined,
      );
      expect(largest, 'no js chunks found in dist/assets').toBeDefined();
      expect(
        largest!.gzipBytes,
        `largest chunk ${largest!.name} is ${largest!.gzipBytes}B gzipped — exceeds 400 KB budget`,
      ).toBeLessThanOrEqual(MAX_MAIN_CHUNK_GZIP_BYTES);
    },
  );
});
