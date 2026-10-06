import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True while the page is being printed. Set synchronously in `beforeprint`
 *  so the static layout is what the print engine lays out. */
function usePrinting() {
  const printMedia = useMedia('print');
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return printing || printMedia;
}

/**
 * 'cine' — the scroll-driven layout: pinned sections, scroll-linked
 * transform/opacity/filter. 'static' — the plain vertical layout, used at
 * ≤720px, under prefers-reduced-motion, and for print.
 */
export function useCatalogMode(): 'cine' | 'static' {
  const narrow = useMedia('(max-width: 720px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const printing = usePrinting();
  return narrow || reduced || printing ? 'static' : 'cine';
}

export function useNarrow() {
  return useMedia('(max-width: 720px)');
}
