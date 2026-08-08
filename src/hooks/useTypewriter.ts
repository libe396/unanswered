import { useEffect, useRef, useState } from 'react';

interface TypewriterResult {
  displayed: string;
  done: boolean;
}

/** Reveals `text` one character at a time after `startDelay`, at `speed` ms/char. */
export function useTypewriter(text: string, speed = 38, startDelay = 900): TypewriterResult {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setDisplayed('');
    setDone(false);

    timeoutRef.current = window.setTimeout(() => {
      let index = 0;
      intervalRef.current = window.setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) {
          window.clearInterval(intervalRef.current);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      window.clearTimeout(timeoutRef.current);
      window.clearInterval(intervalRef.current);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
