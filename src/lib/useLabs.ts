import { useEffect, useState } from 'react';
import { reads } from './api';
import type { Lab } from './types';

/** Labs by slug (for per-lab point scales in admin tables). */
export function useLabsBySlug(): Record<string, Lab> {
  const [labs, setLabs] = useState<Record<string, Lab>>({});
  useEffect(() => {
    reads.labs().then((l) => setLabs(Object.fromEntries(l.map((x) => [x.slug, x]))), () => undefined);
  }, []);
  return labs;
}
