import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const scannedRoots = ['src', 'messages'];
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const mojibakeMarkers = [
  String.fromCodePoint(0x00e2),
  String.fromCodePoint(0x00c2),
  String.fromCodePoint(0x00c3),
  `${String.fromCodePoint(0x00f0)}${String.fromCodePoint(0x0178)}`,
  String.fromCodePoint(0xfffd),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    const extension = path.match(/\.[^.]+$/)?.[0] ?? '';
    return scannedExtensions.has(extension) ? [path] : [];
  });
}

describe('app text encoding', () => {
  it('does not ship mojibake markers in app source', () => {
    const offenders = scannedRoots
      .flatMap(walk)
      .flatMap((path) => {
        const text = readFileSync(path, 'utf8');
        return mojibakeMarkers
          .filter((marker) => text.includes(marker))
          .map((marker) => `${path}: contains ${marker}`);
      });

    expect(offenders).toEqual([]);
  });
});
