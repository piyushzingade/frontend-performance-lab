import { useEffect, useRef, useState } from 'react';

/** Types "Sales Account" char-by-char (~60–100ms) through the form's real change path. */
const TARGET = 'Sales Account';

export function useFastTypist(applyText: (text: string) => void) {
  const [typing, setTyping] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const simulate = () => {
    if (typing) return;
    applyText('');
    setTyping(true);
    let i = 0;
    const step = () => {
      i += 1;
      applyText(TARGET.slice(0, i));
      if (i < TARGET.length) {
        timerRef.current = window.setTimeout(step, 60 + Math.random() * 40);
      } else {
        timerRef.current = null;
        setTyping(false);
      }
    };
    timerRef.current = window.setTimeout(step, 120);
  };

  return { typing, simulate };
}
