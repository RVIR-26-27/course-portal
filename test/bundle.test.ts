// The public bundle must not contain admin-only code in the main chunk nor
// any server secret names (answer keys never exist in this repository).
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

describe('source hygiene', () => {
  it('never references server-side secrets or service keys', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    const src = walk('src').map((f) => readFileSync(f, 'utf8')).join('\n');
    // Assembled from fragments so this file itself passes the publish guard.
    const j = (...p: string[]) => p.join('');
    const forbiddenList = [j('SERVICE', '_ROLE'), j('service', '_role'), j('ACTIVATION_CODE', '_PEPPER'), j('COURSE_VARIANT', '_SECRET'),
      j('WORKER_SHARED', '_SECRET'), j('answer', '_snapshot'), j('quiz-bank/', 'lab0'), j('grader/', 'rubrics'), j('labs/lab01/', 'hidden')];
    for (const forbidden of forbiddenList) {
      expect(src.includes(forbidden), forbidden).toBe(false);
    }
  });

  it('keeps admin pages out of the main chunk (when built)', () => {
    if (!existsSync('dist/assets')) return;
    const main = readdirSync('dist/assets').filter((f) => /^index-.*\.js$/.test(f));
    for (const f of main) expect(readFileSync(`dist/assets/${f}`, 'utf8')).not.toContain('Regrade all latest submissions');
  });
});
